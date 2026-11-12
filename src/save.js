// Passwords: the packed code SAVE writes, and every format LOAD still reads.

import { G } from './state.js';
import { initCabbageRoute } from './clock.js';
import { CABBAGE } from './content/pools.js';
import { pruneNPCMemory } from './people.js';
import { log, render } from './io.js';
import { clamp, fnv1a32 } from './rng.js';
import { TUNE, WORLD_SIZE } from './tuning.js';
import { addDogHint, computeTowns, passable, placePlayer, resetDogHints } from './world.js';

// ---------- Save/load (password) ----------
export const BASE32 = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function b32enc(bytes){
  let out="", buffer=0, bits=0;
  for (const b of bytes){
    buffer = (buffer<<8) | b;
    bits += 8;
    while (bits >= 5){
      out += BASE32[(buffer >>> (bits-5)) & 31];
      bits -= 5;
    }
  }
  if (bits>0) out += BASE32[(buffer << (5-bits)) & 31];
  return out;
}

export function b32dec(str){
  let buffer=0, bits=0;
  const out=[];
  for (const ch of str){
    const idx = BASE32.indexOf(ch);
    if (idx < 0) throw new Error("badchar");
    buffer = (buffer<<5) | idx;
    bits += 5;
    if (bits >= 8){
      out.push((buffer >>> (bits-8)) & 255);
      bits -= 8;
      if (out.length > 4000) throw new Error("toolong");
    }
  }
  return new Uint8Array(out);
}

export function chk(str){
  let sum=0;
  for (let i=0;i<str.length;i++) sum = (sum + str.charCodeAt(i)) % 31;
  return BASE32[sum];
}

export function sanitizeNPCMemory(n){
  const out = Object.create(null);
  if (!n || typeof n !== "object") return out;
  for (const [k,v] of Object.entries(n)){
    if (k === "__proto__" || k === "constructor" || k === "prototype") continue;
    if (!v || typeof v !== "object") continue;
    out[k] = {
      trust: clamp((v.trust|0), -5, 5),
      hostility: clamp((v.hostility|0), 0, 5),
      familiarity: clamp((v.familiarity|0), 0, 99),
      flags: Array.isArray(v.flags) ? v.flags.filter(x=>typeof x==="string").slice(0,20) : []
    };
  }
  return out;
}

// --- Packed Save Codes (binary + base64url + CRC16) ---
// Goal: short "1970-style" passwords that still survive copy/paste.
//
// Base64url alphabet: A-Z a-z 0-9 - _  (no padding).
// CRC16-CCITT detects typos.
// Binary format (v=3):
// [v:1][seed:zigzag-varint][x:1][y:1][fatigue:1][rep:1][steps:varint][flags:1]
// [plagueCount:varint][plagueIdx...]
// [burnedCount:varint][burnedIdx...]
// [blockedCount:varint][blockedIdx...]
// [npcCount:varint][npcRecords...]
// then [crc16:2] little-endian over all previous bytes.
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

export function packStateV3(){
  const out = [];
  const VER = 4;
  out.push(VER);

  // seed (signed) as zigzag varint
  encVarint(zz32(G.seed|0), out);

  out.push(G.player.x & 255, G.player.y & 255);
  out.push(G.player.fatigue & 255, G.player.rep & 255);
  encVarint((G.steps>>>0), out);

  // global flags
  let flags = 0;
  if (G.worldEvents.has("routes_stirring")) flags |= 1<<0;
  if (G.worldEvents.has("war_started"))    flags |= 1<<1;
  if (G.worldEvents.has("capital_fallen"))  flags |= 1<<2;
  // dog hint progress (0..3) packed into flags bits 3-4
  const dh = Math.max(0, Math.min(3, G.dogHintCount|0));
  flags |= (dh & 3) << 3;

  out.push(flags & 255);

  // dog hint bitset (fixed-size, bounded)
  encVarint(G.hintBits.length, out);
  for (let i=0;i<G.hintBits.length;i++) out.push(G.hintBits[i] & 255);

  // tile events as compact indices
  const plague=[], burned=[], blocked=[];
  for (const e of G.worldEvents){
    const str = String(e);
    if (str.startsWith("plague_")){
      const xy = str.slice(7).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; plague.push((y*WORLD_SIZE+x)>>>0); }
    } else if (str.startsWith("burned_")){
      const xy = str.slice(7).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; burned.push((y*WORLD_SIZE+x)>>>0); }
    } else if (str.startsWith("road_blocked_")){
      const xy = str.slice(13).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; blocked.push((y*WORLD_SIZE+x)>>>0); }
    }
  }
  plague.sort((a,b)=>a-b); burned.sort((a,b)=>a-b); blocked.sort((a,b)=>a-b);
  encVarint(Math.min(plague.length, 50), out);
  for (const idx of plague.slice(0,50)) encVarint(idx, out);
  encVarint(Math.min(burned.length, 35), out);
  for (const idx of burned.slice(0,35)) encVarint(idx, out);
  encVarint(Math.min(blocked.length, 35), out);
  for (const idx of blocked.slice(0,35)) encVarint(idx, out);

  // NPCs: compact record list
  const sig = [];
  for (const [id,n] of Object.entries(G.npcMemory)){
    if (!n) continue;
    if ((n.familiarity|0)>0 || (n.trust|0)!==0 || (n.hostility|0)>0) sig.push([id,n]);
  }
  sig.sort((a,b)=> (b[1].familiarity|0) - (a[1].familiarity|0));
  const npcRows = sig.slice(0, 22);

  // asked-topic mask (7 bits)
  const TOP = { DOG:1<<0, ROAD:1<<1, TOWN:1<<2, ROUTES:1<<3, WAR:1<<4, SICKNESS:1<<5, WORK:1<<6 };
  function askedMask(n){
    let m = 0;
    const flags = (n && Array.isArray(n.flags)) ? n.flags : [];
    for (const f of flags){
      if (typeof f !== "string") continue;
      if (f==="asked_dog") m |= TOP.DOG;
      else if (f==="asked_road") m |= TOP.ROAD;
      else if (f==="asked_town") m |= TOP.TOWN;
      else if (f==="asked_routes") m |= TOP.ROUTES;
      else if (f==="asked_war") m |= TOP.WAR;
      else if (f==="asked_sickness") m |= TOP.SICKNESS;
      else if (f==="asked_work") m |= TOP.WORK;
    }
    return m & 127;
  }

  encVarint(npcRows.length, out);
  for (const [id,n] of npcRows){
    // Identity
    if (id === CABBAGE.id){
      out.push(0); // type 0
    } else if (id.startsWith("npc_ambient_")){
      const parts = id.split("_");
      const kind = parts[2]||"TOWN";
      const tx = parts[3]|0, ty = parts[4]|0;
      out.push(1 | ((kind==="WILD")?4:0)); // type 1, bit2 = wild
      out.push(tx & 255, ty & 255);
    } else if (id.startsWith("npc_")){
      const parts = id.split("_");
      const cell = parts[1]||".";
      const tx = parts[2]|0, ty = parts[3]|0;
      const cid = (CELL_TO_ID[cell] != null) ? CELL_TO_ID[cell] : 0;
      out.push(2); // type 2
      out.push(cid & 255);
      out.push(tx & 255, ty & 255);
    } else {
      // Unknown: store hashed identity (less perfect but safe)
      out.push(3);
      encVarint(fnv1a32(id)>>>0, out);
    }

    const fam = clamp((n.familiarity|0), 0, 99) & 255;
    const tr  = clamp((n.trust|0), -5, 5) | 0;
    const ho  = clamp((n.hostility|0), 0, 5) | 0;
    const am  = askedMask(n);

    out.push(fam);
    const b1 = ((tr + 5) & 15) | ((ho & 7) << 4); // trust nibble + hostility
    out.push(b1 & 255);
    out.push(am & 127);
  }

  // CRC16 over payload
  const payload = new Uint8Array(out);
  const crc = crc16ccitt(payload);
  const framed = new Uint8Array(payload.length + 2);
  framed.set(payload, 0);
  framed[framed.length-2] = crc & 255;
  framed[framed.length-1] = (crc >>> 8) & 255;

  return b64urlEnc(framed);
}

export function tryLoadPackedV3(code){
  let bytes;
  try { bytes = b64urlDec(code); } catch(e){ return false; }
  if (!bytes || bytes.length < 8) return false;

  const payload = bytes.subarray(0, bytes.length-2);
  const crcGot = (bytes[bytes.length-2] | (bytes[bytes.length-1] << 8)) & 0xFFFF;
  const crcOk = crc16ccitt(payload);
  if (crcGot !== crcOk) return false;

  const idx = {i:0};
  const ver = payload[idx.i++] | 0;
  if (ver !== 3 && ver !== 4) return false;

  const seedZZ = decVarint(payload, idx);
  G.seed = unzz32(seedZZ);

  computeTowns(); // depends on SEED

  G.player.x = clamp(payload[idx.i++]|0, 0, WORLD_SIZE-1);
  G.player.y = clamp(payload[idx.i++]|0, 0, WORLD_SIZE-1);
  G.player.fatigue = clamp(payload[idx.i++]|0, 0, 5);
  G.player.rep = clamp(payload[idx.i++]|0, 0, 5);
  G.steps = Math.max(0, decVarint(payload, idx) | 0);
  const flags = payload[idx.i++]|0;

  G.worldEvents = new Set();
  G.npcMemory = Object.create(null);
  resetDogHints();

  // restore dog hint positions (v4+)
  if (ver >= 4){
    const hintLen = decVarint(payload, idx) >>> 0;
    const copyLen = Math.min(hintLen, G.hintBits.length);
    for (let i=0;i<copyLen && idx.i < payload.length; i++){
      G.hintBits[i] = payload[idx.i++] & 255;
    }
    // skip any extra hint bytes from future versions
    const skip = hintLen > copyLen ? (hintLen - copyLen) : 0;
    idx.i = Math.min(payload.length, idx.i + skip);

    // recompute count from bits
    let c = 0;
    for (let i=0;i<G.hintBits.length;i++){
      let v = G.hintBits[i] & 255;
      // popcount 8-bit
      v = v - ((v >> 1) & 0x55);
      v = (v & 0x33) + ((v >> 2) & 0x33);
      c += (((v + (v >> 4)) & 0x0F) * 0x01);
    }
    G.dogHintCount = c|0;
  } else {
    G.dogHintCount = (flags >>> 3) & 3;
  }

  if (flags & (1<<0)) G.worldEvents.add("routes_stirring");
  if (flags & (1<<1)) G.worldEvents.add("war_started");
  if (flags & (1<<2)) G.worldEvents.add("capital_fallen");
  if (G.dogHintCount >= TUNE.hintsToStir && !G.worldEvents.has("routes_stirring")) G.worldEvents.add("routes_stirring");

  function addIdx(prefix, n){
    const x = (n % WORLD_SIZE) | 0;
    const y = ((n / WORLD_SIZE) | 0);
    if (x>=0 && y>=0 && x<WORLD_SIZE && y<WORLD_SIZE) G.worldEvents.add(prefix + x + "_" + y);
  }

  const pc = decVarint(payload, idx);
  for (let i=0;i<pc;i++) addIdx("plague_", decVarint(payload, idx));
  const bc = decVarint(payload, idx);
  for (let i=0;i<bc;i++) addIdx("burned_", decVarint(payload, idx));
  const kc = decVarint(payload, idx);
  for (let i=0;i<kc;i++) addIdx("road_blocked_", decVarint(payload, idx));

  const npcCount = decVarint(payload, idx);
  const TOP = { DOG:1<<0, ROAD:1<<1, TOWN:1<<2, ROUTES:1<<3, WAR:1<<4, SICKNESS:1<<5, WORK:1<<6 };
  function flagsFromMask(mask){
    const out = [];
    if (mask & TOP.DOG) out.push("asked_dog");
    if (mask & TOP.ROAD) out.push("asked_road");
    if (mask & TOP.TOWN) out.push("asked_town");
    if (mask & TOP.ROUTES) out.push("asked_routes");
    if (mask & TOP.WAR) out.push("asked_war");
    if (mask & TOP.SICKNESS) out.push("asked_sickness");
    if (mask & TOP.WORK) out.push("asked_work");
    return out;
  }

  for (let n=0;n<npcCount;n++){
    if (idx.i >= payload.length) break;
    const t = payload[idx.i++]|0;
    let id = null;

    if (t===0){
      id = CABBAGE.id;
    } else if ((t & 3) === 1){
      const wild = (t & 4) !== 0;
      const tx = payload[idx.i++]|0, ty = payload[idx.i++]|0;
      id = "npc_ambient_" + (wild ? "WILD" : "TOWN") + "_" + tx + "_" + ty;
    } else if (t===2){
      const cid = payload[idx.i++]|0;
      const cell = ID_TO_CELL[cid] || ".";
      const tx = payload[idx.i++]|0, ty = payload[idx.i++]|0;
      id = "npc_" + cell + "_" + tx + "_" + ty;
    } else if (t===3){
      // hashed unknown, skip
      const _h = decVarint(payload, idx);
      id = null;
    }

    const fam = clamp(payload[idx.i++]|0, 0, 99);
    const b1 = payload[idx.i++]|0;
    const tr = clamp(((b1 & 15) - 5)|0, -5, 5);
    const ho = clamp(((b1 >>> 4) & 7)|0, 0, 5);
    const am = payload[idx.i++]|0;

    if (id){
      G.npcMemory[id] = { familiarity: fam, trust: tr, hostility: ho, flags: flagsFromMask(am & 127) };
    }
  }

  if (!passable(G.player.x, G.player.y)) placePlayer();

  initCabbageRoute();
  G.mode="WORLD";
  G.local=null;
  return true;
}

export function savePasswordPacked(){
  return packStateV3();
}

export function loadPasswordAny(code){
  code = (code||"").trim();
  if (!code){ log("Invalid password.", "m"); return; }
  // First try packed+CRC.
  if (tryLoadPackedV3(code)){
    log("The password takes.", "m");
    render();
    return;
  }
  // Fallback to legacy base32/checksum saves.
  loadPasswordLegacy(code);
}

export function savePasswordLegacy(){
  // Slim save format:
  // - store major flags as a bitmask
  // - store per-tile events (plague/burned/blocked) as compact indices (y*WORLD_SIZE+x)
  // - store NPCs with compact IDs + tiny asked-topic bitmask
  const FLAG = {
    ROUTES: 1<<0,
    WAR:    1<<1,
    CAP:    1<<2
  };
  let F = 0;
  if (G.worldEvents.has("routes_stirring")) F |= FLAG.ROUTES;
  if (G.worldEvents.has("war_started"))    F |= FLAG.WAR;
  if (G.worldEvents.has("capital_fallen"))  F |= FLAG.CAP;

  const plague=[], burned=[], blocked=[];
  for (const e of G.worldEvents){
    const str = String(e);
    if (str.startsWith("plague_")){
      const xy = str.slice(7).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; plague.push(y*WORLD_SIZE+x); }
    } else if (str.startsWith("burned_")){
      const xy = str.slice(7).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; burned.push(y*WORLD_SIZE+x); }
    } else if (str.startsWith("road_blocked_")){
      const xy = str.slice(13).split("_"); if (xy.length===2){ const x=xy[0]|0, y=xy[1]|0; blocked.push(y*WORLD_SIZE+x); }
    }
  }

  // Keep only significant NPCs, cap count.
  const sig = [];
  for (const [id,n] of Object.entries(G.npcMemory)){
    if (!n) continue;
    if ((n.familiarity|0)>0 || (n.trust|0)!==0 || (n.hostility|0)>0) sig.push([id,n]);
  }
  sig.sort((a,b)=> (b[1].familiarity|0) - (a[1].familiarity|0));

  const TOP = { DOG:1<<0, ROAD:1<<1, TOWN:1<<2, ROUTES:1<<3, WAR:1<<4, SICKNESS:1<<5, WORK:1<<6 };

  function compactNpcId(id){
    if (id === CABBAGE.id) return "c";
    if (id.startsWith("npc_ambient_")){
      const parts = id.split("_"); // npc ambient KIND tx ty
      const kind = parts[2]||"TOWN";
      const tx = parts[3]|0, ty = parts[4]|0;
      return "a"+(kind==="TOWN"?"t":"w")+tx+"."+ty;
    }
    if (id.startsWith("npc_")){
      const parts = id.split("_"); // npc CELL tx ty
      const cell = parts[1]||".";
      const tx = parts[2]|0, ty = parts[3]|0;
      return cell+tx+"."+ty;
    }
    return "u"+fnv1a32(id).toString(36); // unknown fallback
  }

  function askedMask(n){
    let m = 0;
    const flags = (n && Array.isArray(n.flags)) ? n.flags : [];
    for (const f of flags){
      if (typeof f !== "string") continue;
      if (f==="asked_dog") m |= TOP.DOG;
      else if (f==="asked_road") m |= TOP.ROAD;
      else if (f==="asked_town") m |= TOP.TOWN;
      else if (f==="asked_routes") m |= TOP.ROUTES;
      else if (f==="asked_war") m |= TOP.WAR;
      else if (f==="asked_sickness") m |= TOP.SICKNESS;
      else if (f==="asked_work") m |= TOP.WORK;
    }
    return m|0;
  }

  const nOut = [];
  for (const [id,n] of sig.slice(0,18)){
    nOut.push([compactNpcId(id), n.familiarity|0, n.trust|0, n.hostility|0, askedMask(n)]);
  }

  // Sort compact arrays for determinism; cap to keep passwords short.
  plague.sort((a,b)=>a-b); burned.sort((a,b)=>a-b); blocked.sort((a,b)=>a-b);
  const state = {
    v: 2,
    s: G.seed|0,
    x: G.player.x|0, y: G.player.y|0,
    f: G.player.fatigue|0, r: G.player.rep|0,
    st: G.steps|0,
    F: F|0,
    p: plague.slice(0, 32),
    b: burned.slice(0, 24),
    k: blocked.slice(0, 24),
    n: nOut
  };

  const json = JSON.stringify(state);
  const bytes = new TextEncoder().encode(json);
  const body = b32enc(bytes);
  return body + chk(body);
}

export function loadPasswordLegacy(code){
  code = (code||"").toUpperCase().replace(/[^A-Z0-9]/g,"");
  if (code.length < 10){ log("Invalid password.", "m"); return; }

  const body = code.slice(0,-1);
  const c = code.slice(-1);
  if (chk(body) !== c){ log("The password refuses to settle.", "m"); return; }

  try{
    const bytes = b32dec(body);
    const json = new TextDecoder().decode(bytes);
    const st = JSON.parse(json);
    if (!st || typeof st !== "object") throw new Error("badstate");

    // Common fields
    G.seed = (st.s|0);
    computeTowns();

    G.player.x = clamp((st.x|0), 0, WORLD_SIZE-1);
    G.player.y = clamp((st.y|0), 0, WORLD_SIZE-1);
    G.player.fatigue = clamp((st.f|0), 0, 5);
    G.player.rep = clamp((st.r|0), 0, 5);
    G.steps = Math.max(0, (st.st|0));

    G.worldEvents = new Set();
        resetDogHints();
G.npcMemory = Object.create(null);

    // v2 slim format
    if ((st.v|0) === 2){
      const F = (st.F|0);
      if (F & (1<<0)) G.worldEvents.add("routes_stirring");
      if (F & (1<<1)) G.worldEvents.add("war_started");
      if (F & (1<<2)) G.worldEvents.add("capital_fallen");

      function addIdx(prefix, idx){
        idx = idx|0;
        const x = idx % WORLD_SIZE;
        const y = (idx / WORLD_SIZE) | 0;
        if (x>=0 && y>=0 && x<WORLD_SIZE && y<WORLD_SIZE) G.worldEvents.add(prefix + x + "_" + y);
      }
      if (Array.isArray(st.p)) for (const idx of st.p.slice(0,64)) addIdx("plague_", idx);
      if (Array.isArray(st.b)) for (const idx of st.b.slice(0,64)) addIdx("burned_", idx);
      if (Array.isArray(st.k)) for (const idx of st.k.slice(0,64)) addIdx("road_blocked_", idx);

      const TOP = { DOG:1<<0, ROAD:1<<1, TOWN:1<<2, ROUTES:1<<3, WAR:1<<4, SICKNESS:1<<5, WORK:1<<6 };

      function expandNpcId(cid){
        if (cid==="c") return CABBAGE.id;
        if (typeof cid!=="string" || cid.length<2) return null;
        if (cid[0]==="a"){
          const kind = (cid[1]==="t") ? "TOWN" : "WILD";
          const rest = cid.slice(2).split(".");
          const tx = rest[0]|0, ty = rest[1]|0;
          return "npc_ambient_"+kind+"_"+tx+"_"+ty;
        }
        // building cell like "M12.7"
        const m = cid.match(/^(.)(-?\d+)\.(-?\d+)$/);
        if (m){
          const cell = m[1];
          const tx = m[2]|0, ty = m[3]|0;
          return "npc_"+cell+"_"+tx+"_"+ty;
        }
        return null;
      }

      function flagsFromMask(mask){
        const out = [];
        if (mask & TOP.DOG) out.push("asked_dog");
        if (mask & TOP.ROAD) out.push("asked_road");
        if (mask & TOP.TOWN) out.push("asked_town");
        if (mask & TOP.ROUTES) out.push("asked_routes");
        if (mask & TOP.WAR) out.push("asked_war");
        if (mask & TOP.SICKNESS) out.push("asked_sickness");
        if (mask & TOP.WORK) out.push("asked_work");
        return out;
      }

      if (Array.isArray(st.n)){
        for (const row of st.n.slice(0, 32)){
          if (!Array.isArray(row) || row.length < 4) continue;
          const id = expandNpcId(row[0]);
          if (!id) continue;
          const fam = clamp((row[1]|0), 0, 99);
          const tr = clamp((row[2]|0), -5, 5);
          const ho = clamp((row[3]|0), 0, 5);
          const mask = (row[4]|0);
          G.npcMemory[id] = { familiarity: fam, trust: tr, hostility: ho, flags: flagsFromMask(mask) };
        }
      }
    } else {
      // Backward compatibility: older format used st.e (events strings) and st.n (npc object)
      const eArr = Array.isArray(st.e) ? st.e : [];
      for (const e of eArr){
      if (e === "war_on_roads") { G.worldEvents.add("war_started"); continue; }

        if (typeof e !== "string") continue;
        if (e.length > 64) continue;
        if (e.startsWith("doghint_")){
        const xy = e.slice(8).split("_");
        if (xy.length===2) addDogHint(clamp(xy[0]|0,0,WORLD_SIZE-1), clamp(xy[1]|0,0,WORLD_SIZE-1));
        continue;
      }
      G.worldEvents.add(e);
      }
      G.npcMemory = sanitizeNPCMemory(st.n||{});
    pruneNPCMemory();
    }

    // Ensure loaded position is playable
    if (!passable(G.player.x, G.player.y)){
      placePlayer();
    }

    initCabbageRoute();
    G.mode="WORLD";
    G.local=null;

    log("The password takes.", "m");
    render();
  } catch(e){
    console.error("Load error:", e);
    log("The password refuses to settle.", "m");
  }
}
