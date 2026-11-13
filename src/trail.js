// The dog and its trail (M3).
//
// One dog, in one place, on one trail. The trail is an ordered list of world
// tiles from the yard to the threshold, and it is a pure function of the seed:
// nothing that happens in a game moves it. The dog waits at den 1, moves on to
// den 2 when the war starts, and to the threshold when the capital falls. Every
// trail tile from the yard up to the dog carries sign.
//
// v13 had no dog until ENTER rolled one: a signal field said "near" on a quarter
// of the map and "very near" on a tenth, and two very-near tiles in five held it.

import { G } from './state.js';
import { noise01 } from './rng.js';
import { TUNE, WORLD_SIZE } from './tuning.js';
import { STEPS, isTownAt, passable, startTile, stepsFrom, tileAt, walkable } from './world.js';

const at = (x,y) => y*WORLD_SIZE + x;

// Fixed salts. Changing one moves every trail.
const SALT_THRESHOLD = 0x7E5D01;
const SALT_VIA       = 0x7E5D02;
const SALT_PATH      = 0x7E5D03;
const SALT_GESTURE   = 0x7E5D04;

// Among candidates {x,y,score}, the lowest score; equal scores go to the higher seeded roll.
function pick(cands, salt){
  let best = null, bestRoll = -1;
  for (const c of cands){
    const roll = noise01(c.x, c.y, G.seed ^ salt);
    if (!best || c.score < best.score || (c.score === best.score && roll > bestRoll)){ best = c; bestRoll = roll; }
  }
  return best;
}

// The shortest way from a to b over tiles `open` allows, both ends included, or null.
// Where two steps are equally short the seeded roll chooses, so the path is the same every time.
function shortestPath(a, b, open){
  const toB = stepsFrom(b.x, b.y, open);
  if (toB[at(a.x,a.y)] < 0) return null;
  const path = [{x:a.x, y:a.y}];
  let cx = a.x, cy = a.y;
  while (toB[at(cx,cy)] > 0){
    const want = toB[at(cx,cy)] - 1;
    let next = null, nextRoll = -1;
    for (const [dx,dy] of STEPS){
      const nx = cx+dx, ny = cy+dy;
      if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE || toB[at(nx,ny)] !== want) continue;
      const roll = noise01(nx, ny, G.seed ^ SALT_PATH);
      if (roll > nextRoll){ next = {x:nx, y:ny}; nextRoll = roll; }
    }
    path.push(next);
    cx = next.x; cy = next.y;
  }
  return path;
}

// Yard to threshold, by way of `via` when there is one, with no tile used twice.
function route(yard, via, threshold, open){
  if (via){
    const first = shortestPath(yard, via, open);
    if (first){
      const used = new Set(first.slice(0, -1).map(t => at(t.x,t.y)));
      const second = shortestPath(via, threshold, (x,y) => open(x,y) && !used.has(at(x,y)));
      if (second) return first.concat(second.slice(1));
    }
  }
  return shortestPath(yard, threshold, open);
}

const isDenGround = (t) => { const g = tileAt(t.x,t.y); return (g === "." || g === "F") && !isTownAt(t.x,t.y); };

// Builds the trail for the current seed. Needs computeTowns() to have run for it.
export function buildTrail(){
  const yard = startTile();
  const fromYard = stepsFrom(yard.x, yard.y, walkable);

  // The threshold: a reachable natural ruin 20 or more steps out, as near 30 steps as there is.
  // Where the land has none, a plains or forest tile as near 30 steps as there is.
  const ruins = [], open = [], any = [];
  for (let y=0; y<WORLD_SIZE; y++){
    for (let x=0; x<WORLD_SIZE; x++){
      const d = fromYard[at(x,y)];
      if (d < 1 || isTownAt(x,y)) continue;
      const c = {x, y, score: Math.abs(d - TUNE.trailLength)};
      const g = tileAt(x,y);
      if (g === "R"){ if (d >= TUNE.thresholdMinSteps) ruins.push(c); }
      else open.push(c);
      any.push(c);
    }
  }
  const onRuins = ruins.length > 0;
  const threshold = pick(onRuins ? ruins : open.length ? open : any, SALT_THRESHOLD) || {x:yard.x, y:yard.y};

  // The via point: where a town lies within 10 steps of the yard, the tile beside the nearest such town that is nearest the yard.
  let via = null;
  const towns = G.towns.map(t => ({x:t.x, y:t.y, score: fromYard[at(t.x,t.y)]})).filter(t => t.score >= 1 && t.score <= TUNE.viaTownWithin);
  const town = pick(towns, SALT_VIA);
  if (town){
    const beside = [];
    for (const [dx,dy] of STEPS){
      const x = town.x+dx, y = town.y+dy;
      if (!walkable(x,y) || isTownAt(x,y) || fromYard[at(x,y)] < 0) continue;
      beside.push({x, y, score: fromYard[at(x,y)]});
    }
    via = pick(beside, SALT_VIA);
    if (via && ((via.x === yard.x && via.y === yard.y) || (via.x === threshold.x && via.y === threshold.y))) via = null;
  }

  // The tiles. The trail passes beside towns, not through them, wherever the land allows.
  const isYard = (x,y) => x === yard.x && y === yard.y;
  const aroundTowns = (x,y) => walkable(x,y) && (!isTownAt(x,y) || isYard(x,y));
  const tiles = route(yard, via, threshold, aroundTowns) || route(yard, via, threshold, walkable) || [{x:yard.x, y:yard.y}];

  const index = new Int16Array(WORLD_SIZE*WORLD_SIZE).fill(-1);
  tiles.forEach((t, i) => { index[at(t.x,t.y)] = i; });
  if (via && index[at(via.x,via.y)] < 0) via = null; // the land gave no way through it without doubling back

  // The dens: the plains or forest tiles nearest 40% and 70% of the way along. Never a town, the yard or the threshold.
  const last = tiles.length - 1;
  const nearest = (target, from, to) => {
    let best = -1;
    for (let i = from; i <= to; i++){
      if (!isDenGround(tiles[i])) continue;
      if (best < 0 || Math.abs(i - target) < Math.abs(best - target)) best = i;
    }
    return best;
  };
  const want1 = Math.round(TUNE.den1At * last), want2 = Math.round(TUNE.den2At * last);
  let den1 = nearest(want1, 1, last - 1);
  let den2 = den1 < 0 ? -1 : nearest(want2, den1 + 1, last - 1);
  if (den1 >= 0 && den2 < 0){
    // Nothing suitable beyond den 1 (a trail that ends in a long run of ruins).
    // Den 2 takes that tile and den 1 moves back, so the dog still moves on when the war starts.
    const earlier = nearest(want1, 1, den1 - 1);
    if (earlier >= 0){ den2 = den1; den1 = earlier; }
  }
  // A trail with no such ground between its ends, or one tile of it: the dog waits where it can.
  if (den1 < 0) den1 = last;
  if (den2 < 0) den2 = den1;

  return { seed: G.seed, yard, tiles, index, den1, den2, threshold: last, onRuins, via };
}

// The trail for the current seed, built once and kept on G.
export function trail(){
  if (!G.trail || G.trail.seed !== G.seed) G.trail = buildTrail();
  return G.trail;
}

// Position of a world tile on the trail, or -1.
export function trailIndexAt(x,y){
  if (x<0||y<0||x>=WORLD_SIZE||y>=WORLD_SIZE) return -1;
  return trail().index[at(x,y)];
}

// Where the dog is, as a trail position: den 1; den 2 once the war has started; the threshold once the capital has fallen.
export function dogIndex(){
  const t = trail();
  if (G.worldEvents.has("capital_fallen")) return t.threshold;
  if (G.worldEvents.has("war_started")) return t.den2;
  return t.den1;
}

export function dogTile(){ return trail().tiles[dogIndex()]; }

export function isThreshold(x,y){
  const t = trail();
  return trailIndexAt(x,y) === t.threshold;
}

// v13's two questions, now with one true answer each.
// "Near": the dog has been here. The tile carries sign.
export function dogIsNear(x,y){
  const i = trailIndexAt(x,y);
  return i >= 0 && i <= dogIndex();
}

// "Very near": the dog is here.
export function dogIsVeryNear(x,y){ return trailIndexAt(x,y) === dogIndex(); }

// What a call from this tile gets back: "here" on the dog's tile, "near" within a
// few trail positions of it on either side, otherwise null.
export function callAnswer(x,y){
  const i = trailIndexAt(x,y);
  if (i < 0) return null;
  const d = Math.abs(i - dogIndex());
  return d === 0 ? "here" : d <= TUNE.callNearPositions ? "near" : null;
}

// The gesture a person makes when asked about the dog: the first step of the
// shortest way from their tile to the dog's. It is offered only where sign lies
// within a few tiles of them: people point at what passed close by.
// v13's 12% error stays: now it points another open way.
export function dogDirectionHint(x,y){
  const t = trail(), dogAt = dogIndex();
  let signNearby = false;
  for (let i = 0; i <= dogAt && !signNearby; i++){
    if (Math.abs(t.tiles[i].x - x) + Math.abs(t.tiles[i].y - y) <= TUNE.gestureSignWithin) signNearby = true;
  }
  if (!signNearby) return null;

  const dog = t.tiles[dogAt];
  const toDog = stepsFrom(dog.x, dog.y, passable);
  const here = toDog[at(x,y)];
  if (here <= 0) return null; // on the dog's tile, or cut off from it

  const NAMES = [["east",1,0],["west",-1,0],["south",0,1],["north",0,-1]];
  let best = null, bestRoll = -1;
  const others = [];
  for (const [name,dx,dy] of NAMES){
    const nx = x+dx, ny = y+dy;
    if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE || toDog[at(nx,ny)] < 0) continue;
    const roll = noise01(nx, ny, G.seed ^ SALT_GESTURE);
    if (toDog[at(nx,ny)] === here - 1 && roll > bestRoll){
      if (best) others.push(best);
      best = name; bestRoll = roll;
    } else others.push(name);
  }
  if (!best) return null;

  // Rarely mislead a little to keep it mystical.
  if (others.length && noise01(G.steps, (x<<8)^y, G.seed^0xD066) < TUNE.gestureMisleadChance){
    return others[Math.min(others.length - 1, (noise01(G.steps, x*31+y, G.seed ^ SALT_GESTURE) * others.length) | 0)];
  }
  return best;
}
