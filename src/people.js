// People: what each remembers of you, the mood of the moment, and which line
// gets said. The narrator's inner voice is picked here too.

import { G } from './state.js';
import { BUILDING_POOLS, EVENT_OVERLAYS, INTERNAL, V } from './content/pools.js';
import { log } from './io.js';
import { clamp, noise01 } from './rng.js';
import { TUNE } from './tuning.js';
import { keyForXY, profileAt } from './world.js';

export function vAdd(a,b){ return a.map((x,idx)=>x+b[idx]); }

export function vScale(a,s){ return a.map(x=>x*s); }

export function vDist(a,b){ let d=0; for (let i=0;i<a.length;i++) d += Math.abs(a[i]-b[i]); return d; }

export function pruneNPCMemory(){
  const keys = Object.keys(G.npcMemory);
  const MAX = TUNE.npcMemoryMax;
  if (keys.length <= MAX) return;

  // Keep the NPCs that matter: familiarity first, then recency.
  const scored = keys.map(k=>{
    const n = G.npcMemory[k]||{};
    const fam = (n.familiarity|0);
    const rec = (n.lastSeen|0);
    // lower score = more likely to be pruned
    const score = fam*10 + Math.max(0, 5000 - Math.abs((G.steps|0) - rec));
    return {k, fam, rec, score};
  });
  scored.sort((a,b)=>{
    if (a.fam !== b.fam) return a.fam - b.fam;
    if (a.rec !== b.rec) return a.rec - b.rec;
    return a.score - b.score;
  });

  const drop = keys.length - MAX;
  for (let i=0;i<drop;i++){
    delete G.npcMemory[scored[i].k];
  }
}

export function getNPC(id){
  const st = G.npcMemory[id];
  if (st && typeof st === "object") return st;
  return {trust:0, hostility:0, familiarity:0, flags:[], lastSeen: G.steps|0};
}

export function setNPC(id, st){
  if (!st || typeof st !== "object") st = {};
  st.trust = clamp(st.trust|0, -5, 5);
  st.hostility = clamp(st.hostility|0, 0, 5);
  st.familiarity = clamp(st.familiarity|0, 0, 99);
  st.flags = Array.isArray(st.flags) ? st.flags.filter(f=>typeof f==="string").slice(0, 24) : [];
  st.lastSeen = G.steps|0;
  G.npcMemory[id] = st;
  pruneNPCMemory();
}

export function buildContextVector(building, x, y, npc){
  const fat = clamp(G.player.fatigue/5, 0, 1);
  const p = profileAt(x,y);

  // World pressure / instability baseline
  const instBase = G.worldEvents.has("routes_stirring") ? 0.45 : 0.12;
  const inst = clamp(instBase + p.dN*0.25 + (G.worldEvents.has("capital_fallen") ? 0.18 : 0.0), 0, 1);

  // NPC memory (very small influence, but it makes persistence *real*)
  const trust = npc ? clamp((npc.trust||0)/5, -1, 1) : 0;
  const hostility = npc ? clamp((npc.hostility||0)/5, 0, 1) : 0;

  // Warmth comes from civ + trust, drops in wild/high danger
  let warmth = 0.10 + p.cN*0.55 + trust*0.18 - p.dN*0.18 - hostility*0.10;
  if (G.mode==="LOCAL" && G.local && G.local.kind==="WILD") warmth -= 0.08;
  warmth = clamp(warmth, 0, 1);

  // Fear comes from danger + instability + sickness nearby
  const k = keyForXY(x,y);
  const sickHere = G.worldEvents.has("plague_"+k) ? 0.25 : 0.0;
  const fear = clamp(0.12 + p.dN*0.58 + inst*0.18 + sickHere + hostility*0.12, 0, 1);

  // Authority comes from building type + capital proximity + (slightly) low trust
  let auth = 0.10 + (building==="G" ? 0.55 : 0.0) + p.capProx*0.18 + (p.town ? 0.12 : 0.0) - trust*0.06;
  auth = clamp(auth, 0, 1);

  return V(warmth, fear, auth, fat, inst);
}

export function pickFragmentFrom(list, targetV, extraAvoid, familiarity){
  if (!list || list.length===0) return null;
  const avoid = new Set(G.recentFragments.slice(-TUNE.noRepeatWindow));
  if (extraAvoid) for (const a of extraAvoid) avoid.add(a);

  // Filter by familiarity requirement - entries with fam:N require familiarity >= N
  const fam = familiarity || 0;
  const famFiltered = list.filter(f => !f.fam || fam >= f.fam);
  const searchList = famFiltered.filter(f=>!avoid.has(f.t));
  if (extraAvoid && searchList.length===0) return null;
  const useList = searchList.length ? searchList : famFiltered;
  if (!useList.length) return null;

  let best = null, bestScore = 999;
  for (const f of useList){
    // Prefer familiarity-gated lines when player has earned them
    const famBonus = (f.fam && fam >= f.fam) ? -TUNE.earnedLineBonus : 0;
    const score = vDist(f.v, targetV) + noise01(f.t.length, (bestScore*10)|0, G.seed ^ G.steps) * 0.06 + famBonus;
    if (score < bestScore){ bestScore = score; best = f; }
  }
  if (!best) best = useList[Math.floor(noise01(G.steps, useList.length, G.seed)*useList.length)];
  return (best && best.t) ? best.t : null;
}

export function pickMany(list, targetV, count, familiarity){
  const out = [];
  const extraAvoid = new Set();
  for (let i=0;i<count;i++){
    const t = pickFragmentFrom(list, targetV, extraAvoid, familiarity);
    if (!t) break;
    out.push(t);
    extraAvoid.add(t);
    G.recentFragments.push(t);
    if (G.recentFragments.length>40) G.recentFragments = G.recentFragments.slice(-25);
  }
  return out;
}

export function pickFragment(list, targetV, familiarity){
  return pickMany(list, targetV, 1, familiarity)[0] || "...";
}

export function activeOverlaysAt(tx,ty){
  const ov = [];
  const k = keyForXY(tx,ty);
  if (G.worldEvents.has("plague_"+k)) ov.push(EVENT_OVERLAYS.plague);
  if (G.worldEvents.has("routes_stirring")) ov.push(EVENT_OVERLAYS.routes);
  if (G.worldEvents.has("war_started")) ov.push(EVENT_OVERLAYS.war);
  return ov;
}

export function sayNPC(building, topic, opts={}){
  const pool = BUILDING_POOLS[building] || BUILDING_POOLS["."];
  const topicKey = String(topic||"ROAD").toLowerCase();
  const bodyLines = clamp((opts.bodyLines|0) || 1, 1, 3);
  const overlayCap = (opts.overlayCap==null) ? 2 : clamp(opts.overlayCap|0, 0, 2);
  const npcFam = opts.npc ? (opts.npc.familiarity || 0) : 0;
  const frame = (opts.frame !== false); // include opener/close by default

  const sx = (G.mode==="LOCAL" && G.local) ? G.local.tx : G.player.x;
  const sy = (G.mode==="LOCAL" && G.local) ? G.local.ty : G.player.y;
  let ctx = buildContextVector(building, sx, sy, opts.npc||null);

  // Prefer topic-specific bodies. If a building lacks the topic, fall back to generic '.' topic,
  // and only then to that building's 'road' (so ASK feels like it's answering the question).
  let bodyList =
    (pool && pool[topicKey]) ||
    (BUILDING_POOLS["."] && BUILDING_POOLS["."][topicKey]) ||
    (pool && pool.road) ||
    (BUILDING_POOLS["."] && BUILDING_POOLS["."].road) ||
    [];

  const overlays = (G.mode==="LOCAL" && G.local) ? activeOverlaysAt(G.local.tx, G.local.ty) : activeOverlaysAt(G.player.x, G.player.y);

  const injected = [];
  if (overlayCap > 0){
    for (const o of overlays){
      if (injected.length >= overlayCap) break;
      if (o.inject && noise01(G.steps, injected.length+7, G.seed^0x0E) < TUNE.overlayChance){
        const ln = pickFragment(o.inject, ctx);
        if (ln) injected.push(ln);
        ctx = vAdd(ctx, vScale(V(0,0,0,0,o.instabilityBias||0), 0.6));
      }
    }
  }

  const body = pickMany(bodyList, ctx, bodyLines, npcFam);

  if (!frame){
    return [...injected, ...body].filter(Boolean);
  }

  const opener = pickMany(pool.openers || BUILDING_POOLS["."].openers, ctx, 1, npcFam)[0];
  const close  = pickMany(pool.close   || BUILDING_POOLS["."].close,   ctx, 1, npcFam)[0];

  return [opener, ...injected, ...body, close].filter(Boolean);
}

export function maybeInternal(kind){
  if (G.mode==="END") return;
  if (G.steps - G.lastInternalStep < TUNE.innerVoiceMinGap) return;
  if (noise01(G.steps, 123, G.seed^0x51) < TUNE.innerVoiceSkipChance) return;

  const list = INTERNAL[kind] || INTERNAL.travel;
  const avoid = new Set(G.recentInternal.slice(-2));
  const choices = list.filter(t=>!avoid.has(t));
  const pick = (choices.length?choices:list)[Math.floor(noise01(G.steps, list.length, G.seed^0x0A)*list.length)];
  if (!pick) return;
  G.recentInternal.push(pick);
  if (G.recentInternal.length>20) G.recentInternal = G.recentInternal.slice(-10);
  G.lastInternalStep = G.steps;
  log(pick, "m");
}
