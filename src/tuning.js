// Every tunable number in one place. M1 moved these here from the v13 source
// without changing a value; M7 tunes them against the bots.

export const WORLD_SIZE = 20;

export const LOCAL_SIZE = 9;

export const TUNE = {
  // Terrain: which glyph a tile gets from its four seeded fields
  waterBelowElevation: -0.85,    // elevation below this is water
  mountainAboveElevation: 1.05,  // elevation above this is mountains
  forestAboveMoisture: 0.75,     // forest needs moisture above this...
  forestBelowElevation: 0.85,    // ...and elevation below this
  ruinsAboveDanger: 1.55,        // ruins need danger above this...
  ruinsBelowCiv: 0.15,           // ...civilization below this...
  ruinsBelowElevation: 0.9,      // ...and elevation below this

  // Towns
  maxTowns: 4,                   // at most this many towns
  townMinDistance: 6,            // towns are at least this far apart (Manhattan)
  townMinScore: 0.62,            // below this score a candidate is dropped...
  townsAlwaysKept: 2,            // ...once this many towns are placed

  // The trail and the dog (M3)
  homeRegionMinTiles: 100,       // the yard goes in the largest region with a town, unless that region is smaller than this
  trailLength: 30,               // the threshold is the candidate whose distance from the yard is closest to this
  thresholdMinSteps: 20,         // a natural ruin serves as the threshold only at this distance or more
  viaTownWithin: 10,             // the trail passes beside the nearest town when it is this close to the yard
  den1At: 0.4,                   // den 1 is the plains or forest tile nearest this fraction of the trail
  den2At: 0.7,                   // den 2, likewise
  callNearPositions: 3,          // CALL gets the near answer within this many trail positions of the dog
  hintsToStir: 3,                // sign tiles that set the routes stirring

  // The direction gesture
  gestureSignWithin: 4,          // a gesture is offered only where sign lies within this many tiles of the speaker
  gestureMisleadChance: 0.12,    // chance a gesture points another open way
  gestureAtFamiliarity: 3,       // ASK DOG earns a gesture at this familiarity...
  gestureAtTrust: 2,             // ...or at this trust

  // The clock
  sicknessEverySteps: 12,        // while stirring, sickness is rolled every this many steps
  sicknessChance: 0.55,          // chance the chosen town falls sick
  warAfterStep: 28,              // war can start once steps exceed this
  warChancePerStep: 0.08,        // chance per step that it does
  fallAfterStep: 60,             // the capital can fall once steps exceed this, while stirring
  fallChancePerStep: 0.06,       // chance per step that it does
  burnEverySteps: 18,            // during war, a town may burn every this many steps
  burnAboveScore: 0.9,           // it burns only if its danger score is above this
  wagonStopSteps: 7,             // the cabbage merchant stays this many steps at each town

  // Local maps: rolls that place things
  brushAbove: 0.82,              // wilderness cell roll above this: brush
  rockAbove: 0.66,               // above this: rock
  wandererAbove: 0.7,            // a wilderness map has a wanderer when its roll is above this
  buildingAbove: 0.38,           // a town building is present when its roll is above this
  townspersonAbove: 0.5,         // a town has a townsperson in the street when its roll is above this

  // Fatigue, rest and the ride
  moveFatigue: 1,                // fatigue per move
  forestFatigue: 2,              // fatigue per move into forest
  waitRecovers: 1,               // fatigue WAIT restores
  restSteps: 2,                  // steps REST costs
  restTownRecovers: 3,           // fatigue REST restores in a town
  restWildRecovers: 2,           // fatigue REST restores in the wild
  shallowSleepChance: 0.18,      // chance of the shallow-sleep line when resting in the wild
  rideSteps: 3,                  // steps RIDE costs
  rideRecovers: 3,               // fatigue RIDE restores
  rideMinFatigue: 2,             // the ride is offered at this fatigue or more...
  rideMinFamiliarity: 2,         // ...and this familiarity with the merchant

  // People and talk
  trustAtReputation: 3,          // at this reputation each conversation raises that person's trust
  hostilityAtFatigue: 4,         // at this fatigue each TALK raises hostility
  talkDogTopicChance: 0.6,       // chance TALK turns to the dog on a tile with sign
  noRepeatWindow: 10,            // a line is not repeated while it is among the last this-many shown
  earnedLineBonus: 0.15,         // score bonus for a familiarity-gated line once earned
  overlayChance: 0.45,           // chance an event overlay adds a line
  innerVoiceMinGap: 3,           // steps between inner-voice lines
  innerVoiceSkipChance: 0.55,    // chance an inner-voice line is skipped
  npcMemoryMax: 140,             // people remembered at once

  // Endings
  homecomingHints: 5,            // Homecoming needs this many sign tiles found...
  homecomingReputation: 3,       // ...and this reputation
};
