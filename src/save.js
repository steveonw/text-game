// Passwords (M6): save v5 is the only format. SAVE writes it and LOAD reads it.
//
// v13 and the builds up to M5 wrote longer codes in other formats. The owner
// decided not to carry them over (spec section 8): they describe a game with no
// trail and no clock dates, and converting them gave games that were neither.
// LOAD refuses them with v13's own lines.
//
// Bytes, in order, then base64url without padding:
//
//   version          1 byte, 5
//   seed             zigzag varint
//   x, y             1 byte each
//   fatigue, rep     1 byte: fatigue in the low 4 bits, reputation in the high 4
//   steps            varint
//   flags            1 byte: bit 0 routes stirring, bit 1 war, bit 2 capital fallen
//   found sign       varint length n, then n bytes: bit i of the mask is trail
//                    position i; trailing zero bytes are trimmed
//   towns entered    1 byte: bit i is G.towns[i]
//   sick towns       varint count, then a varint tile index (y*20+x) each
//   burned towns     the same
//   closed roads     the same
//   people           varint count (22 at most), then each as in v13:
//                      identity: 0 the cabbage merchant; 1 (| 4 in the wild) an
//                      ambient speaker, then tx, ty; 2, then a cell id, tx, ty
//                      familiarity 1 byte (0 to 99); trust + 5 in the low nibble
//                      and hostility in the next 3 bits; asked-topic mask 1 byte
//   check            CRC-16-CCITT of everything above, 2 bytes little-endian

import { G } from './state.js';
import { initCabbageRoute } from './clock.js';
import { CABBAGE } from './content/pools.js';
import { log, render } from './io.js';
import { clamp } from './rng.js';
import { trail } from './trail.js';
import { WORLD_SIZE } from './tuning.js';
import { addDogHint, computeTowns, hasDogHint, passable, placePlayer, resetDogHints } from './world.js';

export const SAVE_VERSION = 5;
const MAX_PEOPLE = 22;
const MAX_TILES = 50;
const TOPICS = ["dog", "road", "town", "routes", "war", "sickness", "work"];

export function crc16ccitt(u8){
  let crc = 0xFFFF;
  for (let i=0;i<u8.length;i++){
    crc ^= (u8[i] << 8);
    for (let b=0;b<8;b++){
      if (crc & 0x8000) crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      else crc = (crc << 1) & 0xFFFF;
    }
  }
  return crc & 0xFFFF;
}

export function b64urlEnc(u8){
  // Convert to binary string in chunks (avoid call stack blowups).
  let bin = "";
  const CH = 0x8000;
  for (let i=0;i<u8.length;i+=CH){
    const sub = u8.subarray(i, i+CH);
    bin += String.fromCharCode.apply(null, sub);
  }
  return btoa(bin).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,"");
}

export function b64urlDec(s){
  s = (s||"").replace(/\s+/g,"");
  // padding
  const pad = s.length % 4;
  if (pad) s += "====".slice(pad);
  s = s.replace(/-/g,"+").replace(/_/g,"/");
  const bin = atob(s);
  const out = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) out[i] = bin.charCodeAt(i) & 255;
  return out;
}

export function zz32(n){ n = n|0; return ((n<<1) ^ (n>>31)) >>> 0; }

export function unzz32(z){ z = z>>>0; return ((z>>>1) ^ (-(z & 1))) | 0; }

export function encVarint(n, out){
  n = n >>> 0;
  while (n > 127){
    out.push((n & 127) | 128);
    n = n >>> 7;
  }
  out.push(n & 127);
}

export function decVarint(u8, idx){
  let res = 0, shift = 0;
  while (true){
    if (idx.i >= u8.length) throw new Error("eof");
    const b = u8[idx.i++] | 0;
    res |= (b & 127) << shift;
    if ((b & 128) === 0) break;
    shift += 7;
    if (shift > 35) throw new Error("varint");
  }
  return res >>> 0;
}

export const CELL_TO_ID = {".":0,"I":1,"M":2,"S":3,"T":4,"G":5,"r":6,"w":7,"t":8};

export const ID_TO_CELL = [".","I","M","S","T","G","r","w","t"];

function tileList(prefix){
  const out = [];
  for (const e of G.worldEvents){
    if (!e.startsWith(prefix)) continue;
    const [x, y] = e.slice(prefix.length).split("_").map(Number);
    if (Number.isInteger(x) && Number.isInteger(y) && x >= 0 && y >= 0 && x < WORLD_SIZE && y < WORLD_SIZE) out.push(y*WORLD_SIZE + x);
  }
  return out.sort((a,b) => a-b).slice(0, MAX_TILES);
}

// The people worth saving, most familiar first, as v13 chose them.
function peopleToSave(){
  const rows = [];
  for (const [id, n] of Object.entries(G.npcMemory)){
    if (!n) continue;
    if ((n.familiarity|0) > 0 || (n.trust|0) !== 0 || (n.hostility|0) > 0) rows.push([id, n]);
  }
  rows.sort((a,b) => (b[1].familiarity|0) - (a[1].familiarity|0));
  return rows.slice(0, MAX_PEOPLE);
}

function identityBytes(id){
  if (id === CABBAGE.id) return [0];
  const parts = id.split("_");
  if (id.startsWith("npc_ambient_")) return [1 | (parts[2] === "WILD" ? 4 : 0), (parts[3]|0) & 255, (parts[4]|0) & 255];
  if (id.startsWith("npc_")){
    const cid = CELL_TO_ID[parts[1]];
    if (cid != null) return [2, cid, (parts[2]|0) & 255, (parts[3]|0) & 255];
  }
  return null; // not a speaker the game makes: not saved
}

export function packState(){
  const out = [SAVE_VERSION];
  encVarint(zz32(G.seed|0), out);
  out.push(G.player.x & 255, G.player.y & 255);
  out.push((clamp(G.player.fatigue|0, 0, 5) & 15) | ((clamp(G.player.rep|0, 0, 5) & 15) << 4));
  encVarint(G.steps >>> 0, out);
  out.push((G.worldEvents.has("routes_stirring") ? 1 : 0) | (G.worldEvents.has("war_started") ? 2 : 0) | (G.worldEvents.has("capital_fallen") ? 4 : 0));

  // Found sign over trail positions.
  const tiles = trail().tiles;
  const mask = new Uint8Array((tiles.length + 7) >> 3);
  tiles.forEach((t, i) => { if (hasDogHint(t.x, t.y)) mask[i >> 3] |= 1 << (i & 7); });
  let n = mask.length;
  while (n > 0 && mask[n-1] === 0) n--;
  encVarint(n, out);
  for (let i = 0; i < n; i++) out.push(mask[i]);

  out.push(G.townsEntered & 255);

  for (const prefix of ["plague_", "burned_", "road_blocked_"]){
    const list = tileList(prefix);
    encVarint(list.length, out);
    for (const i of list) encVarint(i, out);
  }

  const people = peopleToSave().map(([id, st]) => [identityBytes(id), st]).filter(([b]) => b);
  encVarint(people.length, out);
  for (const [bytes, st] of people){
    out.push(...bytes);
    out.push(clamp(st.familiarity|0, 0, 99) & 255);
    out.push(((clamp(st.trust|0, -5, 5) + 5) & 15) | ((clamp(st.hostility|0, 0, 5) & 7) << 4));
    let asked = 0;
    for (const f of (Array.isArray(st.flags) ? st.flags : [])) { const k = TOPICS.indexOf(String(f).replace(/^asked_/, "")); if (k >= 0 && String(f).startsWith("asked_")) asked |= 1 << k; }
    out.push(asked & 127);
  }

  const payload = new Uint8Array(out);
  const crc = crc16ccitt(payload);
  const framed = new Uint8Array(payload.length + 2);
  framed.set(payload, 0);
  framed[payload.length] = crc & 255;
  framed[payload.length + 1] = (crc >>> 8) & 255;
  return b64urlEnc(framed);
}

// Reads a v5 code into the game. Returns false, and changes nothing, if it is not one.
export function tryLoad(code){
  let bytes;
  try { bytes = b64urlDec(code); } catch(e){ return false; }
  if (!bytes || bytes.length < 12) return false;
  // Only the exact spelling SAVE writes: the last character can carry unused bits.
  if (b64urlEnc(bytes) !== code) return false;
  const payload = bytes.subarray(0, bytes.length - 2);
  const crcGot = bytes[bytes.length-2] | (bytes[bytes.length-1] << 8);
  if (crcGot !== crc16ccitt(payload) || payload[0] !== SAVE_VERSION) return false;

  // Read everything before touching the game.
  let st;
  try {
    const idx = {i: 1};
    const byte = () => { if (idx.i >= payload.length) throw new Error("eof"); return payload[idx.i++]; };
    st = { seed: unzz32(decVarint(payload, idx)), x: byte(), y: byte() };
    const fr = byte(); st.fatigue = clamp(fr & 15, 0, 5); st.rep = clamp(fr >> 4, 0, 5);
    st.steps = decVarint(payload, idx) >>> 0;
    st.flags = byte();
    const n = decVarint(payload, idx); st.mask = [];
    for (let i = 0; i < n; i++) st.mask.push(byte());
    st.towns = byte();
    st.lists = [];
    for (let k = 0; k < 3; k++){ const c = decVarint(payload, idx); const l = []; for (let i = 0; i < c; i++) l.push(decVarint(payload, idx)); st.lists.push(l); }
    const pc = decVarint(payload, idx); st.people = [];
    for (let i = 0; i < pc; i++){
      const t = byte(); let id;
      if (t === 0) id = CABBAGE.id;
      else if ((t & 3) === 1){ const tx = byte(), ty = byte(); id = "npc_ambient_" + ((t & 4) ? "WILD" : "TOWN") + "_" + tx + "_" + ty; }
      else if (t === 2){ const cell = ID_TO_CELL[byte()] || "."; const tx = byte(), ty = byte(); id = "npc_" + cell + "_" + tx + "_" + ty; }
      else throw new Error("person");
      const fam = clamp(byte(), 0, 99), b = byte(), asked = byte();
      st.people.push([id, { familiarity: fam, trust: clamp((b & 15) - 5, -5, 5), hostility: clamp((b >> 4) & 7, 0, 5), flags: TOPICS.filter((_, k) => asked & (1 << k)).map(k => "asked_" + k) }]);
    }
    if (idx.i !== payload.length) throw new Error("trailing");
  } catch(e){ return false; }

  G.seed = st.seed;
  computeTowns();
  G.player.x = clamp(st.x, 0, WORLD_SIZE-1);
  G.player.y = clamp(st.y, 0, WORLD_SIZE-1);
  G.player.fatigue = st.fatigue;
  G.player.rep = st.rep;
  G.steps = st.steps;
  G.lastPressureStep = st.steps; // the clock has already read this step
  G.worldEvents = new Set();
  if (st.flags & 1) G.worldEvents.add("routes_stirring");
  if (st.flags & 2) G.worldEvents.add("war_started");
  if (st.flags & 4) G.worldEvents.add("capital_fallen");
  ["plague_", "burned_", "road_blocked_"].forEach((prefix, k) => {
    for (const i of st.lists[k]) G.worldEvents.add(prefix + (i % WORLD_SIZE) + "_" + ((i / WORLD_SIZE) | 0));
  });
  resetDogHints();
  const tiles = trail().tiles;
  st.mask.forEach((b, j) => { for (let k = 0; k < 8; k++) if (b & (1 << k)) { const t = tiles[j*8 + k]; if (t) addDogHint(t.x, t.y); } });
  G.townsEntered = st.towns & ((1 << G.towns.length) - 1);
  G.npcMemory = Object.create(null);
  for (const [id, n] of st.people) G.npcMemory[id] = n;

  if (!passable(G.player.x, G.player.y)) placePlayer();
  initCabbageRoute();
  G.mode = "WORLD";
  G.local = null;
  return true;
}

export function savePassword(){
  return packState();
}

// v13's lines: "Invalid password." for nothing, too little, or characters no code
// has; "The password refuses to settle." for a code that does not check out.
export function loadPassword(code){
  code = (code||"").trim();
  if (code.length < 10 || !/^[A-Za-z0-9_-]+$/.test(code)){ log("Invalid password.", "m"); return; }
  if (tryLoad(code)){ log("The password takes.", "m"); render(); return; }
  log("The password refuses to settle.", "m");
}
