// The world map: terrain fields, tiles, towns, the capital, the start tile and,
// until M3 gives the dog a trail, the dog signal and its hint bits.

import { G } from './state.js';
import { clamp, mix32, nCentered, noise01 } from './rng.js';
import { TUNE, WORLD_SIZE } from './tuning.js';

export function resetDogHints(){
  G.hintBits.fill(0);
  G.dogHintCount = 0;
}

export function dogHintIndex(x,y){ return (y*WORLD_SIZE + x) | 0; }

export function hasDogHint(x,y){
  const i = dogHintIndex(x,y);
  const b = i >> 3, bit = i & 7;
  return (G.hintBits[b] & (1<<bit)) !== 0;
}

export function addDogHint(x,y){
  const i = dogHintIndex(x,y);
  const b = i >> 3, bit = i & 7;
  const mask = (1<<bit);
  if (G.hintBits[b] & mask) return false;
  G.hintBits[b] |= mask;
  G.dogHintCount++;
  return true;
}

export function keyForXY(x,y){ return x + "_" + y; }

export function isTownAt(x,y){ return G.townSet.has(keyForXY(x,y)); }

export function profileAt(x,y){
  const e = elevation(x,y);
  const m = moisture(x,y);
  const c = civ(x,y);
  const d = danger(x,y);
  const eN = clamp((e + 1.6) / 3.2, 0, 1);
  const mN = clamp((m + 1.6) / 3.2, 0, 1);
  const cN = clamp((c + 1.6) / 3.2, 0, 1);
  const dN = clamp(d / 3.0, 0, 1);
  const town = isTownAt(x,y);
  const capDist = G.capital ? (Math.abs(G.capital.x-x)+Math.abs(G.capital.y-y)) : 999;
  const capProx = clamp(1 - capDist / (WORLD_SIZE*0.9), 0, 1);
  return {eN,mN,cN,dN,town,capProx};
}

// ---------- Terrain curves ----------
export function elevation(x,y){
  const s = G.seed * 0.0001;
  return Math.sin((x + s*40)*0.35) + Math.cos((y - s*30)*0.25) + nCentered(x,y,G.seed)*0.7;
}

export function moisture(x,y){
  const s = G.seed * 0.0001;
  return Math.cos((x + s*25)*0.18) - Math.sin((y + s*33)*0.22) + nCentered(x+99,y-77,G.seed)*0.7;
}

export function civ(x,y){
  const s = G.seed * 0.0001;
  return Math.sin((x+y + s*50)*0.12) + nCentered(x-31,y+55,G.seed)*0.6;
}

export function danger(x,y){
  const s = G.seed * 0.0001;
  return Math.abs(Math.sin((x - s*30)*0.27) + Math.cos((y + s*28)*0.19)) + noise01(x+10,y+10,G.seed);
}

export function tileAt(x,y){
  // Terrain only (towns are placed separately via townSet).
  const e = elevation(x,y);
  const m = moisture(x,y);
  const c = civ(x,y);
  const d = danger(x,y);

  if (e < TUNE.waterBelowElevation) return "~";
  if (e > TUNE.mountainAboveElevation) return "^";
  if (m > TUNE.forestAboveMoisture && e < TUNE.forestBelowElevation) return "F";
  if (d > TUNE.ruinsAboveDanger && c < TUNE.ruinsBelowCiv && e < TUNE.ruinsBelowElevation) return "R";
  return ".";
}

export function finalTileAt(x,y){
  const base = isTownAt(x,y) ? "T" : tileAt(x,y);
  const k = keyForXY(x,y);

  // Capital precedence (so plague can show on the capital)
  if (G.capital && x===G.capital.x && y===G.capital.y){
    if (G.worldEvents.has("capital_fallen")) return "R";
    if (G.worldEvents.has("plague_"+k)) return "!";
    return "C";
  }

  if (G.worldEvents.has("road_blocked_"+k)) return "#";
  if (base==="T" && G.worldEvents.has("plague_"+k)) return "!";
  if (base==="T" && G.worldEvents.has("burned_"+k)) return "R";
  return base;
}

// ---------- Dog signal ----------
export function dogSignal(x,y){
  const a = noise01(x*3, y*3, G.seed ^ 0x0A11CE);
  const b = noise01(x+17, y-11, G.seed ^ 0x0D06D);
  const c = Math.abs(Math.sin((x+y+G.seed*0.001)*0.23));
  return (a*0.55 + b*0.30 + c*0.35);
}

export function dogIsNear(x,y){ return dogSignal(x,y) > TUNE.dogNearAbove && finalTileAt(x,y) !== "~"; }

export function dogIsVeryNear(x,y){ return dogSignal(x,y) > TUNE.dogVeryNearAbove && finalTileAt(x,y) !== "~"; }

// ---------- Towns + capital ----------
export function computeTowns(){
  G.towns = [];
  G.townSet = new Set();

  // Candidate selection: pick a small number of well-spaced towns.
  const candidates = [];
  for (let y=0; y<WORLD_SIZE; y++){
    for (let x=0; x<WORLD_SIZE; x++){
      const t = tileAt(x,y);
      if (t==="~" || t==="^" || t==="R") continue; // no towns in water/mountains/ruins
      // Score uses the same "graphs" but is tuned to avoid dense clusters.
      const score =
        civ(x,y) * 1.00
        + (0.15 - Math.abs(elevation(x,y))*0.05)
        + (noise01(x,y,G.seed^1234) * 0.20)
        - (t==="F" ? 0.06 : 0.0); // slight preference for open land
      candidates.push({x,y,score});
    }
  }
  candidates.sort((a,b)=> b.score - a.score);

  const MAX_TOWNS = TUNE.maxTowns;
  const MIN_DIST = TUNE.townMinDistance; // Manhattan distance

  for (const c of candidates){
    if (G.towns.length >= MAX_TOWNS) break;
    if (c.score < TUNE.townMinScore && G.towns.length >= TUNE.townsAlwaysKept) break; // stop once quality drops
    let ok = true;
    for (const t of G.towns){
      const dist = Math.abs(t.x - c.x) + Math.abs(t.y - c.y);
      if (dist < MIN_DIST){ ok = false; break; }
    }
    if (!ok) continue;
    G.towns.push({x:c.x, y:c.y, score:c.score});
    G.townSet.add(keyForXY(c.x,c.y));
  }

  // Ensure at least one town.
  if (G.towns.length===0){
    const best = candidates[0] || {x:10,y:10,score:0};
    G.towns.push(best);
    G.townSet.add(keyForXY(best.x,best.y));
  }

  // Choose capital as best-scoring town.
  let best = G.towns[0];
  for (const t of G.towns) if (t.score > best.score) best = t;
  G.capital = {x: best.x, y: best.y};

  // Strip score from public list for cleanliness.
  G.towns = G.towns.map(t=>({x:t.x,y:t.y}));
}

export function dogDirectionHint(x,y){
  // Returns a vague cardinal hint based on the local gradient of the dog signal.
  // Intentionally fuzzy: doesn't point exactly to the max, just the strongest neighbor direction.
  const cx = clamp(x|0, 0, WORLD_SIZE-1);
  const cy = clamp(y|0, 0, WORLD_SIZE-1);

  function sig(xx,yy){
    xx = clamp(xx|0, 0, WORLD_SIZE-1);
    yy = clamp(yy|0, 0, WORLD_SIZE-1);
    // Avoid water/mountains for hinting (feels wrong to "sniff" across impassable).
    if (finalTileAt(xx,yy)==="~" || finalTileAt(xx,yy)==="^") return -1;
    return dogSignal(xx,yy);
  }

  const c = sig(cx,cy);
  const n = sig(cx,cy-1);
  const s = sig(cx,cy+1);
  const w = sig(cx-1,cy);
  const e = sig(cx+1,cy);

  const opts = [
    {d:"north", v:n},
    {d:"south", v:s},
    {d:"west",  v:w},
    {d:"east",  v:e},
  ].filter(o=>o.v >= 0);

  if (!opts.length) return null;
  opts.sort((a,b)=>b.v-a.v);
  const best = opts[0];

  // If the gradient is weak, don't claim direction.
  // (Also helps keep the hint from feeling too "GPS".)
  if (c >= 0 && best.v - c < TUNE.gestureMinGradient) return null;
  if (best.v < TUNE.gestureMinSignal) return null;

  // Rarely mislead a little to keep it mystical.
  if (noise01(G.steps, (cx<<8)^cy, G.seed^0xD066) < TUNE.gestureMisleadChance && opts.length>1) return opts[1].d;

  return best.d;
}

// ---------- Start placement (connected to a town) ----------
export function passable(x,y){
  const t = finalTileAt(x,y);
  return t !== "~" && t !== "^" && t !== "#";
}

export function reachableTownFrom(sx,sy){
  const q = [{x:sx,y:sy}];
  const seen = new Set([keyForXY(sx,sy)]);
  while (q.length){
    const p = q.shift();
    if (isTownAt(p.x,p.y)) return true;
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for (const [dx,dy] of dirs){
      const nx=p.x+dx, ny=p.y+dy;
      if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE) continue;
      if (!passable(nx,ny)) continue;
      const k=keyForXY(nx,ny);
      if (seen.has(k)) continue;
      seen.add(k);
      q.push({x:nx,y:ny});
    }
  }
  return false;
}

export function placePlayer(){
  // try seeded candidates
  for (let i=0;i<300;i++){
    const x = (mix32(G.seed + i*17)>>>0)%WORLD_SIZE;
    const y = (mix32(G.seed + i*33)>>>0)%WORLD_SIZE;
    if (!passable(x,y)) continue;
    if (reachableTownFrom(x,y)){ G.player.x=x; G.player.y=y; return; }
  }
  // fallback scan
  for (let y=0;y<WORLD_SIZE;y++){
    for (let x=0;x<WORLD_SIZE;x++){
      if (passable(x,y) && reachableTownFrom(x,y)){ G.player.x=x; G.player.y=y; return; }
    }
  }
  // Absolute last resort: find any passable tile.
  for (let yy=0; yy<WORLD_SIZE; yy++){
    for (let xx=0; xx<WORLD_SIZE; xx++){
      if (passable(xx,yy)){ G.player.x=xx; G.player.y=yy; return; }
    }
  }
  G.player.x=10; G.player.y=10;
}
