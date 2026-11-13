// What changes as steps pass: the cabbage merchant's timetable and the world's
// slow collapse.
//
// M4: the clock has five stages in a fixed order, and its three dates are drawn
// from the seed, so a seed always tells the same time. v13 rolled for the war and
// for the fall on every step, so neither had a latest step and the game no end.
//
//   0 quiet      from step 0
//   1 unsettled  from the third sign tile found, or step 24 at the latest
//   2 guarded    from the war date
//   3 hollow     from the fall date
//   4 changed    from the change date: the story ends
//
// The stored truth is still v13's three events (routes_stirring, war_started,
// capital_fallen), so every old save code reads as it always did; the dates only
// decide when the clock adds them.

import { G } from './state.js';
import { OMENS, ROAD_CLOSED_RUMOR } from './content/pools.js';
import { triggerEnding } from './endings.js';
import { log } from './io.js';
import { fnv1a32, mix32, noise01 } from './rng.js';
import { trail } from './trail.js';
import { TUNE, WORLD_SIZE } from './tuning.js';
import { civ, danger, isTownAt, keyForXY, passable, stepsFrom } from './world.js';

export function initCabbageRoute(){
  G.cabbageRoute = [];
  const t = G.towns.slice();
  if (!t.length) return;
  t.sort((a,b)=>{
    const ha = mix32(fnv1a32(a.x+","+a.y+","+G.seed));
    const hb = mix32(fnv1a32(b.x+","+b.y+","+G.seed));
    return (ha>>>0) - (hb>>>0);
  });
  if (t.length<=3){
    G.cabbageRoute = t;
  } else {
    G.cabbageRoute = [t[0], t[Math.floor(t.length/2)], t[t.length-1]];
  }
}

// The stops the merchant keeps: his route without the towns that have sickness.
// If sickness has reached every stop he keeps the whole route; it is never empty.
export function wagonStops(){
  const well = G.cabbageRoute.filter(t => !G.worldEvents.has("plague_"+keyForXY(t.x,t.y)));
  return well.length ? well : G.cabbageRoute;
}

export function cabbageIndex(){
  const stops = wagonStops();
  if (!stops.length) return 0;
  return Math.floor(G.steps/TUNE.wagonStopSteps) % stops.length;
}

export function cabbageTown(){
  const stops = wagonStops();
  if (!stops.length) return null;
  return stops[cabbageIndex()];
}

// Where a ride from the town at (tx,ty) goes: the stop after it. From a town that is
// no longer a stop (sickness came while the wagon stood there), the stop after the
// timetable's. Never the town the wagon is standing in, unless it is the only stop.
export function nextWagonStop(tx,ty){
  const stops = wagonStops();
  if (!stops.length) return null;
  const here = stops.findIndex(t => t.x === tx && t.y === ty);
  let next = stops[((here >= 0 ? here : cabbageIndex()) + 1) % stops.length];
  if (next.x === tx && next.y === ty && stops.length > 1) next = stops[(stops.indexOf(next) + 1) % stops.length];
  return next;
}

export function cabbageIsHereWorld(x,y){
  const ct = cabbageTown();
  return !!(ct && ct.x===x && ct.y===y);
}

// ---------- The dates ----------
const SALT_WAR    = 0xC10C01;
const SALT_FALL   = 0xC10C02;
const SALT_CHANGE = 0xC10C03;
const SALT_OMEN   = 0xC10C04;
const SALT_CLOSE  = 0xC10C05;

const span = (from, to, roll) => from + Math.min(to - from, Math.floor(roll * (to - from + 1)));

// The three dates for this seed: the step the war starts, the step the capital
// falls, and the step the roads change. Computed, never stored.
export function dates(){
  const war    = span(TUNE.warFrom, TUNE.warTo, noise01(1, 1, G.seed ^ SALT_WAR));
  const fall   = war  + span(TUNE.stageGapFrom, TUNE.stageGapTo, noise01(2, 2, G.seed ^ SALT_FALL));
  const change = fall + span(TUNE.stageGapFrom, TUNE.stageGapTo, noise01(3, 3, G.seed ^ SALT_CHANGE));
  return { war, fall, change };
}

// 0 quiet, 1 unsettled, 2 guarded, 3 hollow, 4 changed. Read from the stored events,
// so a code saved by v13 sets a floor: routes 1, war 2, capital 3.
export function stage(){
  if (G.worldEvents.has("capital_fallen")) return (G.mode === "END" && G.steps >= dates().change) ? 4 : 3;
  if (G.worldEvents.has("war_started")) return 2;
  if (G.worldEvents.has("routes_stirring")) return 1;
  return 0;
}

export const STAGE_WORDS = ["quiet", "unsettled", "guarded", "hollow", "hollow"];

// The step, in the eight before a date, on which its one foreshadow line is shown.
function omenStep(date, n){
  return date - 1 - Math.min(TUNE.omenWithin - 1, Math.floor(noise01(date, n, G.seed ^ SALT_OMEN) * TUNE.omenWithin));
}

function omen(kind, date, n){
  if (G.steps !== omenStep(date, n)) return;
  const lines = OMENS[kind];
  const line = lines[Math.min(lines.length - 1, Math.floor(noise01(n, date, G.seed ^ SALT_OMEN) * lines.length))];
  log(line, "m");
  // It takes the inner voice's turn, so nothing else is thought on this step.
  G.recentInternal.push(line);
  G.lastInternalStep = G.steps;
}

// ---------- Road closures ----------
const blockedKey = (x,y) => "road_blocked_"+x+"_"+y;

export function closedRoads(){
  let n = 0;
  for (const e of G.worldEvents) if (e.startsWith("road_blocked_")) n++;
  return n;
}

// Tiles on the shortest walks between towns, as the map stands now.
function roadTiles(){
  const out = new Map();
  for (let i = 0; i < G.towns.length; i++){
    const to = stepsFrom(G.towns[i].x, G.towns[i].y, passable);
    for (let j = i + 1; j < G.towns.length; j++){
      let x = G.towns[j].x, y = G.towns[j].y;
      if (to[y*WORLD_SIZE+x] < 0) continue;
      while (to[y*WORLD_SIZE+x] > 0){
        const want = to[y*WORLD_SIZE+x] - 1;
        let nx = x, ny = y, best = -1;
        for (const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
          const ax = x+dx, ay = y+dy;
          if (ax<0||ay<0||ax>=WORLD_SIZE||ay>=WORLD_SIZE || to[ay*WORLD_SIZE+ax] !== want) continue;
          const roll = noise01(ax, ay, G.seed ^ SALT_CLOSE);
          if (roll > best){ best = roll; nx = ax; ny = ay; }
        }
        x = nx; y = ny;
        out.set(y*WORLD_SIZE+x, {x, y});
      }
    }
  }
  return [...out.values()];
}

// Would closing (cx,cy) leave anything that can be walked to now, from the player's
// tile or from the yard, out of reach?
function cutsSomethingOff(cx, cy, froms){
  const open = (x,y) => passable(x,y) && !(x === cx && y === cy);
  for (const f of froms){
    const after = stepsFrom(f.x, f.y, open);
    for (let i = 0; i < f.before.length; i++){
      if (f.before[i] >= 0 && after[i] < 0 && i !== cy*WORLD_SIZE+cx) return true;
    }
  }
  return false;
}

// Close one road. Never a town, the player's tile, a den or the threshold, and
// never a tile whose closing would cut anything off. At most maxClosures in a game.
function closeARoad(){
  if (closedRoads() >= TUNE.maxClosures) return;
  const t = trail();
  const kept = new Set([t.den1, t.den2, t.threshold].map(i => t.tiles[i].y*WORLD_SIZE + t.tiles[i].x));
  kept.add(G.player.y*WORLD_SIZE + G.player.x);
  const cands = roadTiles()
    .filter(c => !isTownAt(c.x,c.y) && !kept.has(c.y*WORLD_SIZE+c.x))
    .map(c => ({x:c.x, y:c.y, roll: noise01(c.x, c.y, G.seed ^ SALT_CLOSE ^ G.steps)}))
    .sort((a,b) => b.roll - a.roll || (a.y*WORLD_SIZE+a.x) - (b.y*WORLD_SIZE+b.x));
  if (!cands.length) return;
  const froms = [G.player, t.yard].map(p => ({x:p.x, y:p.y, before: stepsFrom(p.x, p.y, passable)}));
  for (const c of cands){
    if (cutsSomethingOff(c.x, c.y, froms)) continue;
    G.worldEvents.add(blockedKey(c.x,c.y));
    log(ROAD_CLOSED_RUMOR, "m");
    return;
  }
}

// ---------- World pressure ----------
// Evaluated once for each step that passes. Order: a foreshadow line; stirring;
// sickness; the war; the fall; burning; a closure; the end.
export function advanceWorldPressure(){
  if (G.mode === "END") return;
  if (G.lastPressureStep === G.steps) return;
  G.lastPressureStep = G.steps;
  const d = dates();

  if (!G.worldEvents.has("war_started")) omen("war", d.war, 1);
  else if (!G.worldEvents.has("capital_fallen")) omen("fall", d.fall, 2);
  else omen("change", d.change, 3);

  // Stirring comes with the third sign tile (commands.js) or by step 24, whichever is first.
  if (!G.worldEvents.has("routes_stirring") && G.steps >= TUNE.stirByStep){
    G.worldEvents.add("routes_stirring");
    log("Animals have been restless. You feel it in the roads.", "m");
  }

  if (G.worldEvents.has("routes_stirring") && G.towns.length && G.steps % TUNE.sicknessEverySteps === 0){
    const idx = (mix32(fnv1a32("plg"+G.seed+","+G.steps))>>>0) % G.towns.length;
    const t = G.towns[idx];
    const k = keyForXY(t.x,t.y);
    if (!G.worldEvents.has("plague_"+k) && noise01(t.x, t.y, G.seed^G.steps) < TUNE.sicknessChance){
      G.worldEvents.add("plague_"+k);
      log("A rumor spreads: sickness in a town you haven't seen.", "m");
    }
  }

  // The war and the fall come on their dates. A code saved by v13 may be past a date
  // without its event; the clock catches up on the next step.
  if (!G.worldEvents.has("war_started") && G.steps >= d.war){
    G.worldEvents.add("war_started");
    log("Soldiers begin to appear on the roads.", "m");
  }

  if (!G.worldEvents.has("capital_fallen") && G.steps >= d.fall){
    G.worldEvents.add("capital_fallen");
    log("Word arrives late, like bad weather: the capital has fallen.", "m");
  }

  // War can scorch a town (finally wiring the burned_ overlay into causality).
  if (G.worldEvents.has("war_started") && G.steps % TUNE.burnEverySteps === 0 && G.towns.length){
    // pick a non-capital town biased by danger
    let best = null;
    for (let i=0;i<G.towns.length;i++){
      const t = G.towns[(i + (mix32(G.seed^G.steps)>>>0)) % G.towns.length];
      if (G.capital && t.x===G.capital.x && t.y===G.capital.y) continue;
      const k = keyForXY(t.x,t.y);
      if (G.worldEvents.has("burned_"+k)) continue;
      const score = danger(t.x,t.y) - civ(t.x,t.y)*0.25 + noise01(t.x,t.y,G.seed^0xB00D)*0.2;
      if (!best || score > best.score) best = {t, k, score};
    }
    if (best && best.score > TUNE.burnAboveScore){
      G.worldEvents.add("burned_"+best.k);
      log("Word arrives: a town burned in the night.", "m");
    }
  }

  // From the war on, a road may close. Burning, above, runs first on a shared step.
  if (G.worldEvents.has("war_started") && G.steps % TUNE.closeEverySteps === 0) closeARoad();

  // The roads change: the story ends without the dog.
  if (G.steps >= d.change) triggerEnding("changed");
}

// D10: an action that costs several steps is evaluated on each of them, not only on
// the last. G.steps already holds the final count; firstStep is the first step passed.
// In v13 REST and RIDE jumped the counter, and the checks for the steps between never ran.
export function advanceWorldPressureFrom(firstStep){
  const last = G.steps;
  for (let s = firstStep; s <= last; s++){
    G.steps = s;
    advanceWorldPressure();
    if (G.mode === "END") return; // the story ended on step s; the counter stays there
  }
  G.steps = last;
}
