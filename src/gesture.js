// Gestures (M5): the one way anyone in the game gives a direction.
//
// gestureFor(topic, x, y, npc, role) returns "north", "south", "east", "west" or
// null for a person on world tile (x,y) asked about a topic:
//
//   DOG        the first step toward the dog, by the M3 rule: only where sign lies
//              within 4 tiles
//   SICKNESS   toward the nearest town with sickness
//   WAR        toward the nearest closed road or burned town
//   TOWN       toward the nearest other town
//   ROAD       asked of a guard: toward the nearest closed road
//
// "Nearest" is by walkable path; a place that cannot be walked to gives none.
// Trust 2 or more: always true. Familiarity 3 without that trust: v13's 12% of
// the time, another open direction. Below both: no gesture.

import { G } from './state.js';
import { noise01 } from './rng.js';
import { dogDirectionHint, dogTile } from './trail.js';
import { TUNE, WORLD_SIZE } from './tuning.js';
import { isTownAt, keyForXY, passable } from './world.js';

const NAMES = [["east",1,0],["west",-1,0],["south",0,1],["north",0,-1]];
const GESTURE_TIE_SALT = 0x7E5D04; // the trail's gesture salt, so DOG and the rest break ties alike
const cellAt = (x,y) => y*WORLD_SIZE + x;

// Steps from every tile to the nearest target, over passable tiles. A target
// need not be passable itself (a closed road is reached by standing beside it).
function stepsToNearest(targets){
  const dist = new Int16Array(WORLD_SIZE*WORLD_SIZE).fill(-1);
  const q = [];
  for (const t of targets){ if (dist[cellAt(t.x,t.y)] < 0){ dist[cellAt(t.x,t.y)] = 0; q.push(t); } }
  for (let h = 0; h < q.length; h++){
    const {x, y} = q[h];
    for (const [, dx, dy] of NAMES){
      const nx = x+dx, ny = y+dy;
      if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE || dist[cellAt(nx,ny)] >= 0 || !passable(nx,ny)) continue;
      dist[cellAt(nx,ny)] = dist[cellAt(x,y)] + 1;
      q.push({x:nx, y:ny});
    }
  }
  return dist;
}

function eventTiles(prefix){
  const out = [];
  for (const e of G.worldEvents){
    if (!e.startsWith(prefix)) continue;
    const [x, y] = e.slice(prefix.length).split("_").map(Number);
    if (Number.isFinite(x) && Number.isFinite(y)) out.push({x, y});
  }
  return out;
}

// What a topic points at, as world tiles; null where the topic points nowhere.
export function gestureTargets(topic, x, y, role){
  const others = (list) => list.filter(t => !(t.x === x && t.y === y));
  switch (topic){
    case "SICKNESS": return others(G.towns.filter(t => G.worldEvents.has("plague_"+keyForXY(t.x,t.y))));
    case "WAR":      return others([...eventTiles("road_blocked_"), ...eventTiles("burned_")]);
    case "TOWN":     return others(G.towns.filter(t => isTownAt(t.x,t.y)));
    case "ROAD":     return role === "G" ? others(eventTiles("road_blocked_")) : null;
    default:         return null;
  }
}

// Steps from every tile to what the topic means, or null.
function distanceMap(topic, x, y, role){
  if (topic === "DOG") return stepsToNearest([dogTile()]);
  const targets = gestureTargets(topic, x, y, role);
  return (targets && targets.length) ? stepsToNearest(targets) : null;
}

// The true first step, or null. Also used by the tests and the sweep.
export function trueGesture(topic, x, y, role){
  if (topic === "DOG") return dogDirectionHint(x, y, true);
  const dist = distanceMap(topic, x, y, role);
  if (!dist) return null;
  const here = dist[cellAt(x,y)];
  if (here <= 0) return null;
  let best = null, bestRoll = -1;
  for (const [name, dx, dy] of NAMES){
    const nx = x+dx, ny = y+dy;
    if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE || dist[cellAt(nx,ny)] !== here - 1) continue;
    const roll = noise01(nx, ny, G.seed ^ GESTURE_TIE_SALT);
    if (roll > bestRoll){ best = name; bestRoll = roll; }
  }
  return best;
}

export function gestureFor(topic, x, y, npc, role){
  const trusted = ((npc && npc.trust) | 0) >= TUNE.gestureAtTrust;
  const familiar = ((npc && npc.familiarity) | 0) >= TUNE.gestureAtFamiliarity;
  if (!trusted && !familiar) return null;
  const dir = trueGesture(topic, x, y, role);
  if (!dir || trusted) return dir;

  // Familiar but not trusted: v13's error, now always a wrong way: an open direction
  // that does not lead nearer.
  if (noise01(G.steps, (x<<8)^y, G.seed^0xD066) < TUNE.gestureMisleadChance){
    const dist = distanceMap(topic, x, y, role), here = dist[cellAt(x,y)];
    const wrong = NAMES.filter(([, dx, dy]) => passable(x+dx, y+dy) && dist[cellAt(x+dx, y+dy)] !== here - 1).map(([name]) => name);
    if (wrong.length) return wrong[Math.min(wrong.length - 1, (noise01(G.steps, x*31+y, G.seed ^ GESTURE_TIE_SALT) * wrong.length) | 0)];
  }
  return dir;
}
