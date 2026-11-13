// The world map: terrain fields, tiles, towns, the capital, the start tile (the
// yard) and the hint bits. The dog and its trail are in trail.js.

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

// Terrain only (towns are placed separately via townSet). A pure function of the
// seed, so each tile is worked out once per seed and remembered on G (M4: the clock
// walks the map far more than v13 did).
export function tileAt(x,y){
  if (x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE) return terrainAt(x,y);
  if (!G.terrain || G.terrain.seed !== G.seed) G.terrain = { seed: G.seed, cells: new Array(WORLD_SIZE*WORLD_SIZE) };
  const i = y*WORLD_SIZE + x;
  return G.terrain.cells[i] || (G.terrain.cells[i] = terrainAt(x,y));
}

function terrainAt(x,y){
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

  // The trail is a function of the seed and its towns: forget the old one.
  G.trail = null;
}

// ---------- Walking ----------
export function passable(x,y){
  const t = finalTileAt(x,y);
  return t !== "~" && t !== "^" && t !== "#";
}

// Terrain alone: the same for a seed whatever has happened in the world since.
// The yard and the trail are built on this, so neither moves when a road closes.
export function walkable(x,y){
  if (x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE) return false;
  const t = tileAt(x,y);
  return t !== "~" && t !== "^";
}

export const STEPS = [[1,0],[-1,0],[0,1],[0,-1]];

// Steps from (sx,sy) to every tile `open` allows, as an array indexed y*WORLD_SIZE+x; -1 where it cannot be reached.
export function stepsFrom(sx,sy, open){
  const dist = new Int16Array(WORLD_SIZE*WORLD_SIZE).fill(-1);
  dist[sy*WORLD_SIZE+sx] = 0;
  const q = [[sx,sy]];
  for (let h=0; h<q.length; h++){
    const [cx,cy] = q[h];
    for (const [dx,dy] of STEPS){
      const nx=cx+dx, ny=cy+dy;
      if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE) continue;
      const i = ny*WORLD_SIZE+nx;
      if (dist[i]>=0 || !open(nx,ny)) continue;
      dist[i] = dist[cy*WORLD_SIZE+cx] + 1;
      q.push([nx,ny]);
    }
  }
  return dist;
}

// ---------- Start placement: the yard ----------
// Where the game is played: the largest connected set of walkable tiles that holds a
// town, as a mask indexed y*WORLD_SIZE+x. Equal sizes: the first in reading order.
// On a few seeds every town sits in a pocket of a dozen tiles or fewer while the
// mainland has none (3 of the 2,000 sweep seeds). A pocket cannot hold a trail, so
// below homeRegionMinTiles the largest set of all is used instead, town or no town.
export function homeRegion(){
  const seen = new Uint8Array(WORLD_SIZE*WORLD_SIZE);
  let withTown = null, withTownSize = 0, largest = null, largestSize = 0;
  for (let y=0; y<WORLD_SIZE; y++){
    for (let x=0; x<WORLD_SIZE; x++){
      if (seen[y*WORLD_SIZE+x] || !walkable(x,y)) continue;
      const dist = stepsFrom(x,y, walkable);
      let size = 0, town = false;
      for (let i=0; i<dist.length; i++){
        if (dist[i] < 0) continue;
        seen[i] = 1; size++;
        if (!town && isTownAt(i % WORLD_SIZE, (i / WORLD_SIZE) | 0)) town = true;
      }
      if (town && size > withTownSize){ withTown = dist; withTownSize = size; }
      if (size > largestSize){ largest = dist; largestSize = size; }
    }
  }
  const best = (withTownSize >= TUNE.homeRegionMinTiles) ? withTown : largest;
  const mask = new Uint8Array(WORLD_SIZE*WORLD_SIZE);
  if (best) for (let i=0; i<best.length; i++) if (best[i] >= 0) mask[i] = 1;
  return mask;
}

// The yard: v13's seeded candidates in v13's order, but a candidate is taken only if
// it lies in the home region, so the whole trail can be walked from it on every seed.
// v13 took any tile that could reach a town. A pure function of the seed.
export function startTile(){
  const home = homeRegion();
  for (let i=0;i<300;i++){
    const x = (mix32(G.seed + i*17)>>>0)%WORLD_SIZE;
    const y = (mix32(G.seed + i*33)>>>0)%WORLD_SIZE;
    if (home[y*WORLD_SIZE+x]) return {x, y};
  }
  // fallback scan
  for (let y=0;y<WORLD_SIZE;y++){
    for (let x=0;x<WORLD_SIZE;x++){
      if (home[y*WORLD_SIZE+x]) return {x, y};
    }
  }
  // A world with no walkable tile at all. No seed has produced one.
  return {x:10, y:10};
}

export function placePlayer(){
  const s = startTile();
  G.player.x = s.x; G.player.y = s.y;
}
