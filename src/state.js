// All mutable game state lives in this one object, so that save, load and tests
// see the same thing. In v13 these were separate top-level variables; the names
// in the comments are the v13 names.

import { WORLD_SIZE } from './tuning.js';

export const G = {
  seed: 0,                                    // SEED: set at boot by main.js, and by NEW and LOAD
  mode: "WORLD",                              // mode: WORLD | LOCAL | END
  local: null,                                // local: the open town or wilderness map, or null
  steps: 0,                                   // steps
  player: { x: 10, y: 10, fatigue: 0, rep: 0 }, // player

  worldEvents: new Set(),                     // worldEvents
  npcMemory: Object.create(null),             // npcMemory
  recentFragments: [],                        // recentFragments: not saved
  recentInternal: [],                         // recentInternal: not saved
  lastInternalStep: -999,                     // lastInternalStep: not saved
  lastPressureStep: -999,                     // lastPressureStep: not saved

  capital: null,                              // capital
  towns: [],                                  // towns
  townSet: new Set(),                         // townSet
  cabbageRoute: [],                           // cabbageRoute
  trail: null,                                // the dog's trail for this seed, built on first use (trail.js); not saved

  // --- Dog hint tracking (bounded, no memory leak) ---
  // We used to store "doghint_x_y" strings inside worldEvents, which grows forever.
  // Now we store a fixed bitset (WORLD_SIZE*WORLD_SIZE bits) and a counter.
  // The bitset is mutated in place and never replaced: there is exactly one.
  hintBits: new Uint8Array(((WORLD_SIZE*WORLD_SIZE) + 7) >> 3), // DOG_HINT_BITS
  dogHintCount: 0,                            // dogHintCount
};

// Puts every field back to its value at page load. The game never calls this;
// tests use it to start each replay from a clean page.
export function resetState(){
  G.seed = 0;
  G.mode = "WORLD";
  G.local = null;
  G.steps = 0;
  G.player = { x: 10, y: 10, fatigue: 0, rep: 0 };
  G.worldEvents = new Set();
  G.npcMemory = Object.create(null);
  G.recentFragments = [];
  G.recentInternal = [];
  G.lastInternalStep = -999;
  G.lastPressureStep = -999;
  G.capital = null;
  G.towns = [];
  G.townSet = new Set();
  G.cabbageRoute = [];
  G.trail = null;
  G.hintBits.fill(0);
  G.dogHintCount = 0;
}
