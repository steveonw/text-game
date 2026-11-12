// What changes as steps pass: the cabbage merchant's timetable and the world's
// slow collapse (sickness, war, burning, the capital's fall).

import { G } from './state.js';
import { log } from './io.js';
import { fnv1a32, mix32, noise01 } from './rng.js';
import { TUNE } from './tuning.js';
import { civ, danger, keyForXY } from './world.js';

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

export function cabbageIndex(){
  if (!G.cabbageRoute.length) return 0;
  return Math.floor(G.steps/TUNE.wagonStopSteps) % G.cabbageRoute.length;
}

export function cabbageTown(){
  if (!G.cabbageRoute.length) return null;
  return G.cabbageRoute[cabbageIndex()];
}

export function cabbageIsHereWorld(x,y){
  const ct = cabbageTown();
  return !!(ct && ct.x===x && ct.y===y);
}

// ---------- World pressure ----------
export function advanceWorldPressure(){
  if (G.lastPressureStep === G.steps) return;
  G.lastPressureStep = G.steps;

  if (G.worldEvents.has("routes_stirring") && G.towns.length && G.steps % TUNE.sicknessEverySteps === 0){
    const idx = (mix32(fnv1a32("plg"+G.seed+","+G.steps))>>>0) % G.towns.length;
    const t = G.towns[idx];
    const k = keyForXY(t.x,t.y);
    if (!G.worldEvents.has("plague_"+k) && noise01(t.x, t.y, G.seed^G.steps) < TUNE.sicknessChance){
      G.worldEvents.add("plague_"+k);
      log("A rumor spreads: sickness in a town you haven't seen.", "m");
    }
  }

  if (!G.worldEvents.has("war_started") && G.steps > TUNE.warAfterStep && noise01(G.steps, 9001, G.seed^0xBEEF) < TUNE.warChancePerStep){
    G.worldEvents.add("war_started");
    log("Soldiers begin to appear on the roads.", "m");
  }

  if (!G.worldEvents.has("capital_fallen") && G.steps > TUNE.fallAfterStep && G.worldEvents.has("routes_stirring") && noise01(G.steps, 1337, G.seed^0xC0DE) < TUNE.fallChancePerStep){
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

}

// D10: an action that costs several steps is evaluated on each of them, not only on
// the last. G.steps already holds the final count; firstStep is the first step passed.
// In v13 REST and RIDE jumped the counter, and the checks for the steps between never ran.
export function advanceWorldPressureFrom(firstStep){
  const last = G.steps;
  for (let s = firstStep; s <= last; s++){
    G.steps = s;
    advanceWorldPressure();
  }
  G.steps = last;
}
