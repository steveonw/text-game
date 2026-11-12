// The 9x9 maps that ENTER opens: wilderness and towns.

import { G } from './state.js';
import { cabbageIsHereWorld } from './clock.js';
import { fnv1a32, mix32, noise01 } from './rng.js';
import { LOCAL_SIZE, TUNE } from './tuning.js';
import { dogIsVeryNear, keyForXY } from './world.js';

// ---------- Local map gen ----------
export function generateWilderness(tx,ty){
  const size = LOCAL_SIZE;
  const map = Array.from({length:size}, ()=>Array(size).fill("."));
  for (let y=0;y<size;y++){
    for (let x=0;x<size;x++){
      const r = noise01(tx*31 + x, ty*31 + y, G.seed ^ 0x0A11D);
      map[y][x] = (r>TUNE.brushAbove) ? "t" : (r>TUNE.rockAbove ? "^" : ".");
    }
  }
  // simple smoothing
  const copy = map.map(r=>r.slice());
  const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
  for (let y=1;y<size-1;y++){
    for (let x=1;x<size-1;x++){
      let trees=0, rocks=0;
      for (const [dx,dy] of dirs){
        const v = copy[y+dy][x+dx];
        if (v==="t") trees++;
        if (v==="^") rocks++;
      }
      if (trees>=3) map[y][x]="t";
      else if (rocks>=3) map[y][x]="^";
    }
  }

  const npcs = [];

  // Occasional wanderer in wilderness
  if (noise01(tx*13, ty*13, G.seed ^ 0xEAD1) > TUNE.wandererAbove){
    let wx, wy, tries = 0;
    do {
      wx = 1 + ((mix32(fnv1a32("wand"+tx+","+ty+","+tries+","+G.seed))>>>0)%(size-2));
      wy = 1 + ((mix32(fnv1a32("wand2"+tx+","+ty+","+tries+","+G.seed))>>>0)%(size-2));
      tries++;
    } while (map[wy][wx] !== "." && tries < 10);
    if (map[wy][wx] === ".") {
      npcs.push({x:wx, y:wy, type:"n"});
    }
  }

  let dog = null;
  if (dogIsVeryNear(tx,ty) && noise01(tx,ty,G.seed^0x0D06) > TUNE.dogRollAbove){
    const hx = (mix32(fnv1a32("dog"+tx+","+ty+","+G.seed))>>>0)%(size-2);
    const hy = (mix32(fnv1a32("dog2"+tx+","+ty+","+G.seed))>>>0)%(size-2);
    dog = {x:1+hx, y:1+hy};
  }
  return { kind:"WILD", tx, ty, size, map, px:4, py:4, dog, npcs };
}

// D2: every building has its own slot and its own roll, whatever else is missing.
// In v13 both went by position in the list, so the guard post, fifth, landed on the
// smithy's corner, and a town rearranged itself when sickness or fire removed a building.
export const TOWN_BUILDINGS = ["I","M","S","T","G"];

export const TOWN_SLOTS = { "I":[2,2], "M":[6,2], "S":[2,6], "T":[6,6], "G":[7,4] }; // G: the east end of the street

export function generateTown(tx,ty, forceWagon=false){
  const size = LOCAL_SIZE;
  const map = Array.from({length:size}, ()=>Array(size).fill("."));
  for (let i=0;i<size;i++){
    map[0][i]="#"; map[size-1][i]="#";
    map[i][0]="#"; map[i][size-1]="#";
  }
  for (let i=1;i<size-1;i++){
    map[4][i]="|";
    map[i][4]="|";
  }
  map[4][4]="+";

  const k = keyForXY(tx,ty);
  const plagued = G.worldEvents.has("plague_"+k);
  // D7: once the capital has fallen it is a burned town like any other.
  const fallen = G.worldEvents.has("capital_fallen") && !!G.capital && tx===G.capital.x && ty===G.capital.y;
  const burned = G.worldEvents.has("burned_"+k) || fallen;

  let buildings = TOWN_BUILDINGS.slice();
  if (plagued) buildings = buildings.filter(b=>b!=="M");
  if (burned) buildings = buildings.filter(b=>b!=="I");

  // Track NPC positions for rendering
  const npcs = [];
  let survivor = false;

  buildings.forEach((b)=>{
    const i = TOWN_BUILDINGS.indexOf(b);
    const r = noise01(tx*10+i, ty*10+i, G.seed ^ 0x0B11D);
    if (r > TUNE.buildingAbove){
      const x = TOWN_SLOTS[b][0];
      const y = TOWN_SLOTS[b][1];
      map[y][x] = burned ? "r" : b;
      // NPCs present in non-burned buildings
      if (!burned && b !== "r") {
        npcs.push({x, y, type: b});
      }
      // D3: one Survivor stands at the first burned building, drawn as a person (p).
      // In v13 a Survivor could be spoken to only because any cell answered.
      if (burned && !survivor) {
        npcs.push({x, y, type:"n"});
        survivor = true;
      }
    }
  });

  // Add ambient townsperson on a street tile sometimes
  if (noise01(tx*7, ty*7, G.seed ^ 0xABCD) > TUNE.townspersonAbove && !plagued){
    const spots = [[3,4],[5,4],[4,3],[4,5]];
    const spot = spots[Math.floor(noise01(tx,ty,G.seed^0x1234)*spots.length)];
    npcs.push({x:spot[0], y:spot[1], type:"n"}); // n = townsperson
  }

  const wagon = (forceWagon || cabbageIsHereWorld(tx,ty)) ? {x:1,y:4} : null;
  if (wagon && map[wagon.y][wagon.x] !== "#") {
    map[wagon.y][wagon.x] = "w";
    npcs.push({x:wagon.x, y:wagon.y, type:"w"});
  }

  return { kind:"TOWN", tx, ty, size, map, px:4, py:4, wagon, wagonForced: !!forceWagon, npcs };
}
