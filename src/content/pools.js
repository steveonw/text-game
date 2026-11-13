// Every pooled line in the game, each with its mood vector
// [warmth, fear, authority, fatigue, instability]. Text only: no logic lives here.

// ---------- Vectors ----------
export function V(w=0,f=0,a=0,fa=0,i=0){ return [w,f,a,fa,i]; }

// ---------- Dialogue pools ----------
export const BUILDING_POOLS = {
  "I": {
    openers: [{t:"Sit, if you like.", v:V(0.7,0.1,0.1,0.2,0.1)},{t:"You look road-worn.", v:V(0.5,0.2,0.0,0.4,0.2)},{t:"Ale or answers?", v:V(0.6,0.1,0.0,0.2,0.1)}],
    dog: [{t:"That dog? Always underfoot.", v:V(0.5,0.2,0.0,0.1,0.2)},{t:"Left before dawn.", v:V(0.3,0.3,0.0,0.1,0.3)},{t:"Wouldn't sleep inside.", v:V(0.2,0.4,0.0,0.1,0.3)}],
    road: [{t:"Roads aren't quiet lately.", v:V(0.2,0.5,0.0,0.2,0.4)},{t:"People don't linger.", v:V(0.2,0.4,0.0,0.1,0.3)}],
    routes:[{t:"Some paths aren't drawn anymore.", v:V(0.1,0.4,0.0,0.1,0.6)},{t:"Travelers come from odd directions.", v:V(0.1,0.5,0.0,0.2,0.7)}],
    close: [{t:"Best keep moving.", v:V(0.1,0.4,0.0,0.2,0.4)},{t:"Don't stay out late.", v:V(0.2,0.4,0.1,0.2,0.3)}],
  },
  "M": {
    openers:[{t:"Buy or move.", v:V(0.1,0.2,0.5,0.1,0.1)},{t:"What do you need?", v:V(0.2,0.2,0.3,0.1,0.1)},{t:"Prices are fair. Today.", v:V(0.0,0.3,0.3,0.1,0.2)}],
    dog:[{t:"Chased carts. Watched everything.", v:V(0.1,0.3,0.2,0.1,0.2)},{t:"Didn't look lost.", v:V(0.1,0.3,0.2,0.1,0.2)}],
    road:[{t:"Supply's thin. Routes don't hold.", v:V(0.0,0.4,0.3,0.1,0.5)},{t:"Caravans stopped coming.", v:V(0.0,0.5,0.3,0.1,0.5)}],
    routes:[{t:"Maps say one thing. Goods say another.", v:V(0.0,0.5,0.2,0.1,0.7)}],
    close:[{t:"I've said enough.", v:V(0.0,0.2,0.4,0.1,0.2)}],
  },
  "S": {
    openers:[{t:"What’s broken?", v:V(0.1,0.1,0.4,0.1,0.1)},{t:"Make it quick.", v:V(0.0,0.2,0.5,0.1,0.2)},{t:"I don't chat.", v:V(0.0,0.2,0.6,0.1,0.1)}],
    dog:[{t:"Kept away from the fire.", v:V(0.1,0.2,0.3,0.1,0.2)},{t:"Growled at old stones.", v:V(0.0,0.4,0.3,0.1,0.6)}],
    road:[{t:"Too much fixing lately.", v:V(0.0,0.4,0.3,0.1,0.4)},{t:"Steel chips wrong.", v:V(0.0,0.5,0.3,0.1,0.6)}],
    routes:[{t:"Metal feels stressed. Ground too.", v:V(0.0,0.5,0.2,0.1,0.7)}],
    close:[{t:"Leave me to work.", v:V(0.0,0.2,0.5,0.1,0.1)}],
  },
  "T": {
    openers:[{t:"Speak softly.", v:V(0.4,0.2,0.2,0.1,0.1)},{t:"What burdens you?", v:V(0.5,0.2,0.1,0.1,0.1)},{t:"All things pass.", v:V(0.4,0.2,0.0,0.1,0.2)}],
    dog:[{t:"Animals are attentive.", v:V(0.4,0.3,0.1,0.1,0.3)},{t:"It lingered at the threshold.", v:V(0.2,0.4,0.1,0.1,0.5)}],
    road:[{t:"Not all silence is peace.", v:V(0.3,0.4,0.1,0.1,0.6)}],
    routes:[{t:"Some ways were closed deliberately.", v:V(0.2,0.4,0.2,0.1,0.8)},{t:"The old bindings weaken.", v:V(0.1,0.5,0.2,0.1,0.9)}],
    close:[{t:"Go gently.", v:V(0.4,0.2,0.0,0.1,0.1)}],
  },
  "G": {
    openers:[{t:"State your business.", v:V(0.0,0.2,0.8,0.1,0.1)},{t:"Move along.", v:V(0.0,0.3,0.7,0.1,0.2)},{t:"No loitering.", v:V(0.0,0.3,0.7,0.1,0.2)}],
    dog:[{t:"Ran past the gate.", v:V(0.0,0.2,0.7,0.1,0.2)},{t:"Didn't obey.", v:V(0.0,0.3,0.7,0.1,0.3)}],
    road:[{t:"Routes are closed. For your safety.", v:V(0.0,0.4,0.8,0.1,0.4)}],
    routes:[{t:"Orders don't fit anymore.", v:V(0.0,0.5,0.6,0.1,0.7)}],
    close:[{t:"That's all.", v:V(0.0,0.2,0.8,0.1,0.1)}],
  },
  ".": {
    openers:[{t:"Yes?", v:V(0.2,0.2,0.1,0.1,0.1)},{t:"Oh.", v:V(0.1,0.2,0.0,0.1,0.1)},{t:"Can I help?", v:V(0.3,0.2,0.0,0.1,0.1)}],
    dog:[{t:"It ran like it knew.", v:V(0.2,0.3,0.0,0.1,0.3)},{t:"Didn't bark much.", v:V(0.2,0.2,0.0,0.1,0.2)}],
    road:[{t:"Things feel off.", v:V(0.1,0.4,0.0,0.1,0.3)}],
    routes:[{t:"Some paths don't feel right.", v:V(0.1,0.4,0.0,0.1,0.6)}],
    close:[{t:"Safe travels.", v:V(0.3,0.2,0.0,0.1,0.1)}],
  }
};

export const EVENT_OVERLAYS = {
  plague: { inject:[{t:"People aren't well.", v:V(0.1,0.6,0.0,0.1,0.4)},{t:"Best keep distance.", v:V(0.1,0.5,0.2,0.1,0.4)}], instabilityBias:0.3 },
  routes: { inject:[{t:"Paths overlap.", v:V(0.1,0.5,0.0,0.1,0.8)},{t:"Directions feel unreliable.", v:V(0.1,0.5,0.0,0.1,0.7)}], instabilityBias:0.4 },
  war:    { inject:[{t:"Keep your head down.", v:V(0.0,0.5,0.4,0.1,0.4)}], instabilityBias:0.3 }
};

// Cabbage merchant
export const CABBAGE = {
  id:"npc_cabbage_merchant",
  openers:["Don't step there— oh. Too late.","Mind the cabbages.","They bruise easily. Like me."],
  complaint:["A boy knocked the whole stand over.","Just ran straight through it. Cabbages everywhere.","Same boy. Different town.","I don't know how he keeps finding me.","I set it up anyway. What else would I do?","People expect cabbages."],
  rideOffer:["I'm heading on.","You can ride, if you don't mind the smell.","Cabbages keep you steady."],
  afterRide:["Right. Here we are.","New place. Same problem.","I'll set up here. Watch for the boy."]
};

export const TOPIC_FALLBACKS = {
  town: [
    {t:"It's smaller than it used to be.", v:V(0.2,0.3,0.0,0.2,0.2)},
    {t:"People here survive by habit.", v:V(0.1,0.4,0.0,0.2,0.3)},
    {t:"Every town has its quiet corners.", v:V(0.3,0.2,0.0,0.2,0.2)}
  ],
  war: [
    {t:"War arrives before the banners.", v:V(0.0,0.6,0.4,0.2,0.4)},
    {t:"Nobody wins on the road.", v:V(0.0,0.6,0.3,0.2,0.3)}
  ],
  sickness: [
    {t:"Coughs carry further than news.", v:V(0.1,0.7,0.0,0.2,0.4)},
    {t:"People stop touching doorknobs.", v:V(0.1,0.6,0.0,0.2,0.3)}
  ],
  work: [
    {t:"Work never ends. Only hands do.", v:V(0.2,0.3,0.2,0.3,0.2)},
    {t:"Everyone is busy pretending things are normal.", v:V(0.1,0.4,0.1,0.3,0.3)}
  ]
};

// ---------- Internal text ----------
export const INTERNAL = {
  travel:["The road continues.","The ground is uneven here.","Not many footprints.","The air shifts.","This place doesn't invite stopping."],
  fatigue1:["Your steps slow.","You could rest.","The pack sits heavier."],
  fatigue2:["Every mile adds weight.","The road asks more now.","You've been walking a long time."],
  fatigue3:["Stopping sounds reasonable.","Pushing further will cost something."],
  nearDog:["Paw prints. Fading.","Something moved through here.","You're not alone."],
  routes:["The land feels thin here.","Directions feel unreliable.","Paths overlap."],
};

// ---------- M4: the clock's new lines ----------
// Fourteen lines the clock needs and v13 does not have, and one status line.
// Every one is a draft under the voice rules, for the owner to edit: // REVIEW

// One of these is shown once, in the eight steps before a change.
export const OMENS = {
  war: [
    "Smoke on the horizon, thin and straight.",   // REVIEW
    "Dust rises where no wind is.",               // REVIEW
    "The birds have gone quiet.",                 // REVIEW
  ],
  fall: [
    "Riders pass. None look back.",               // REVIEW
    "Bells, somewhere. Then nothing.",            // REVIEW
    "Fewer people on the road now.",              // REVIEW
  ],
  change: [
    "The road feels less certain underfoot.",     // REVIEW
    "The milestones lean. The count is off.",     // REVIEW
    "The way behind looks unfamiliar.",           // REVIEW
  ],
};

export const ROAD_CLOSED_RUMOR = "Word arrives: a road has been closed.";       // REVIEW

// LOOK inside a ruin map: open ground, a fallen stone (r), a standing stone (^).
export const STONES = {
  ".": "Old stones stand in the grass.",          // REVIEW
  "r": "A fallen stone. Moss in the cuts.",       // REVIEW
  "^": "A standing stone. It leans.",             // REVIEW
};

// The fifth ending, The Open Gate (M6): the roads change before the dog is found.
// Shaped like v13's four. "" is a blank line.
export const OPEN_GATE = [
  "The roads have changed.",                       // REVIEW
  "The one you walked is gone.",                   // REVIEW
  "Somewhere past the stones, it waits.",          // REVIEW
  "",
  "You go back the way you remember.",             // REVIEW
  "The gate stands open.",                         // REVIEW
  "Nothing comes through it.",                     // REVIEW
];

// STATUS in the war stage, beside v13's "The roads feel unsettled."
export const STATUS_GUARDED = "The roads feel guarded.";                              // REVIEW

// ---------- M5: what people say ----------
// 118 lines v13 does not have. Every one is a draft under the voice rules, for the
// owner to edit: // REVIEW. v13's pools above are unchanged; sayNPC() reads these
// beside them.
//
//   PEOPLE[role].town, .war, .sickness, .work   two lines a topic          48
//   PEOPLE[role].earned.dog, .road, .routes      one at fam 2, one at fam 4 36
//   PEOPLE[role].unseen                          DOG, in a town off the trail 12
//   PEOPLE.wanderer, PEOPLE.survivor             a pool each                22
//
// Roles: I innkeeper, M merchant, S smith, T priest, G guard, "." a local.
export const PEOPLE = {
  "I": {
    town: [
      {t:"Rooms fill, then empty.", v:V(0.5,0.2,0.0,0.2,0.2)},                 // REVIEW
      {t:"Same faces at the table.", v:V(0.6,0.1,0.0,0.2,0.1)},                // REVIEW
    ],
    war: [
      {t:"Soldiers drink and don't pay.", v:V(0.2,0.5,0.2,0.2,0.4)},           // REVIEW
      {t:"No one sings here now.", v:V(0.3,0.5,0.0,0.2,0.4)},                  // REVIEW
    ],
    sickness: [
      {t:"I boil the cups twice.", v:V(0.3,0.6,0.0,0.2,0.3)},                  // REVIEW
      {t:"Empty beds. Not from travel.", v:V(0.2,0.6,0.0,0.2,0.4)},            // REVIEW
    ],
    work: [
      {t:"Fires, beds, floors. Then again.", v:V(0.4,0.2,0.0,0.4,0.1)},        // REVIEW
      {t:"Nobody sleeps past dawn here.", v:V(0.4,0.2,0.0,0.4,0.1)},           // REVIEW
    ],
    earned: {
      dog: [
        {t:"Drank from the trough. Then gone.", v:V(0.4,0.3,0.0,0.1,0.3), fam:2},  // REVIEW
        {t:"Looked back once. At the road.", v:V(0.4,0.3,0.0,0.1,0.4), fam:4},     // REVIEW
      ],
      road: [
        {t:"The road's emptier at night now.", v:V(0.3,0.4,0.0,0.2,0.4), fam:2},   // REVIEW
        {t:"Travelers whisper here. Not before.", v:V(0.3,0.5,0.0,0.2,0.4), fam:4},// REVIEW
      ],
      routes: [
        {t:"Guests arrive tired from short walks.", v:V(0.2,0.5,0.0,0.3,0.7), fam:2}, // REVIEW
        {t:"Some roads end where they began.", v:V(0.2,0.5,0.0,0.2,0.8), fam:4},     // REVIEW
      ],
    },
    unseen: [
      {t:"No dog here. Not lately.", v:V(0.4,0.2,0.0,0.1,0.2)},                // REVIEW
      {t:"Strays don't stop at this inn.", v:V(0.4,0.2,0.0,0.1,0.2)},          // REVIEW
    ],
  },
  "M": {
    town: [
      {t:"Coin moves slower here.", v:V(0.1,0.3,0.3,0.1,0.2)},                 // REVIEW
      {t:"Everyone haggles. No one buys.", v:V(0.0,0.3,0.3,0.1,0.2)},          // REVIEW
    ],
    war: [
      {t:"Soldiers take first. Pay later.", v:V(0.0,0.5,0.4,0.1,0.4)},         // REVIEW
      {t:"Iron sells. Bread sells. Little else.", v:V(0.0,0.5,0.3,0.1,0.4)},   // REVIEW
    ],
    sickness: [
      {t:"Nobody wants what others touched.", v:V(0.0,0.6,0.2,0.1,0.4)},      // REVIEW
      {t:"I sell at arm's length now.", v:V(0.1,0.6,0.3,0.1,0.3)},             // REVIEW
    ],
    work: [
      {t:"Count, weigh, argue. Every day.", v:V(0.1,0.2,0.4,0.3,0.1)},         // REVIEW
      {t:"Stock doesn't move itself.", v:V(0.0,0.2,0.4,0.3,0.1)},              // REVIEW
    ],
    earned: {
      dog: [
        {t:"Stole nothing. Odd, for a stray.", v:V(0.1,0.3,0.2,0.1,0.2), fam:2},   // REVIEW
        {t:"Sat by my cart. Then went.", v:V(0.2,0.3,0.2,0.1,0.3), fam:4},         // REVIEW
      ],
      road: [
        {t:"I send goods. Half arrive.", v:V(0.0,0.4,0.3,0.1,0.5), fam:2},         // REVIEW
        {t:"I don't travel after dark. Anymore.", v:V(0.1,0.5,0.3,0.1,0.5), fam:4},// REVIEW
      ],
      routes: [
        {t:"My ledgers don't match the miles.", v:V(0.0,0.5,0.3,0.1,0.7), fam:2},  // REVIEW
        {t:"Distances shift. Prices follow.", v:V(0.0,0.5,0.2,0.1,0.8), fam:4},    // REVIEW
      ],
    },
    unseen: [
      {t:"Haven't seen a dog. Ask elsewhere.", v:V(0.1,0.2,0.3,0.1,0.2)},      // REVIEW
      {t:"Dogs don't buy. I don't watch.", v:V(0.0,0.2,0.4,0.1,0.2)},          // REVIEW
    ],
  },
  "S": {
    town: [
      {t:"Hinges and nails. That's this town.", v:V(0.1,0.2,0.4,0.2,0.1)},     // REVIEW
      {t:"They bring me what breaks.", v:V(0.0,0.2,0.4,0.2,0.2)},              // REVIEW
    ],
    war: [
      {t:"Blades now. Not plows.", v:V(0.0,0.5,0.4,0.2,0.4)},                  // REVIEW
      {t:"They want edges. Fast.", v:V(0.0,0.5,0.5,0.2,0.4)},                  // REVIEW
    ],
    sickness: [
      {t:"Fire cleans what water won't.", v:V(0.0,0.5,0.4,0.2,0.3)},           // REVIEW
      {t:"Fewer hands to hold the tongs.", v:V(0.0,0.6,0.3,0.2,0.4)},          // REVIEW
    ],
    work: [
      {t:"Heat, strike, wait.", v:V(0.0,0.1,0.5,0.3,0.1)},                     // REVIEW
      {t:"The anvil doesn't rest.", v:V(0.0,0.2,0.5,0.4,0.1)},                 // REVIEW
    ],
    earned: {
      dog: [
        {t:"Wouldn't come near the anvil.", v:V(0.0,0.3,0.3,0.1,0.3), fam:2},      // REVIEW
        {t:"It knew where it was going.", v:V(0.1,0.3,0.3,0.1,0.4), fam:4},        // REVIEW
      ],
      road: [
        {t:"Broken wheels. Many of them.", v:V(0.0,0.4,0.3,0.1,0.4), fam:2},       // REVIEW
        {t:"Horseshoes wear wrong on these roads.", v:V(0.0,0.4,0.3,0.1,0.6), fam:4}, // REVIEW
      ],
      routes: [
        {t:"Compass needles drift here.", v:V(0.0,0.5,0.2,0.1,0.8), fam:2},        // REVIEW
        {t:"Old iron hums near the stones.", v:V(0.0,0.5,0.2,0.1,0.8), fam:4},     // REVIEW
      ],
    },
    unseen: [
      {t:"No dogs by my fire.", v:V(0.0,0.2,0.4,0.1,0.2)},                     // REVIEW
      {t:"Not here. Not that I know.", v:V(0.0,0.2,0.4,0.1,0.2)},              // REVIEW
    ],
  },
  "T": {
    town: [
      {t:"Fewer come. More stay late.", v:V(0.4,0.3,0.1,0.1,0.2)},             // REVIEW
      {t:"Every roof here has a story.", v:V(0.5,0.2,0.0,0.1,0.1)},            // REVIEW
    ],
    war: [
      {t:"Both sides pray to me.", v:V(0.3,0.5,0.1,0.1,0.4)},                  // REVIEW
      {t:"We bury, and say little.", v:V(0.2,0.6,0.1,0.1,0.4)},                // REVIEW
    ],
    sickness: [
      {t:"I sit with those who cough.", v:V(0.4,0.6,0.0,0.1,0.3)},             // REVIEW
      {t:"Prayers are shorter now.", v:V(0.2,0.6,0.1,0.1,0.4)},                // REVIEW
    ],
    work: [
      {t:"Candles, words, waiting.", v:V(0.4,0.2,0.0,0.2,0.1)},                // REVIEW
      {t:"Someone must keep watch.", v:V(0.4,0.3,0.1,0.2,0.2)},                // REVIEW
    ],
    earned: {
      dog: [
        {t:"Waited at the door. Patient.", v:V(0.4,0.3,0.1,0.1,0.3), fam:2},       // REVIEW
        {t:"It was looking for someone.", v:V(0.4,0.3,0.1,0.1,0.4), fam:4},        // REVIEW
      ],
      road: [
        {t:"The road takes more than it gives.", v:V(0.3,0.4,0.1,0.1,0.5), fam:2}, // REVIEW
        {t:"Walk with care. Not with haste.", v:V(0.4,0.4,0.1,0.1,0.4), fam:4},    // REVIEW
      ],
      routes: [
        {t:"Old paths remember feet.", v:V(0.2,0.4,0.1,0.1,0.8), fam:2},           // REVIEW
        {t:"What was bound is coming loose.", v:V(0.1,0.5,0.2,0.1,0.9), fam:4},    // REVIEW
      ],
    },
    unseen: [
      {t:"No such visitor here.", v:V(0.4,0.2,0.1,0.1,0.2)},                   // REVIEW
      {t:"Lost things find other doors.", v:V(0.4,0.3,0.1,0.1,0.3)},           // REVIEW
    ],
  },
  "G": {
    town: [
      {t:"Quiet town. Keep it quiet.", v:V(0.0,0.2,0.8,0.1,0.1)},              // REVIEW
      {t:"Everyone here is accounted for.", v:V(0.0,0.2,0.8,0.1,0.1)},         // REVIEW
    ],
    war: [
      {t:"Orders change by the hour.", v:V(0.0,0.5,0.7,0.1,0.5)},              // REVIEW
      {t:"Not my war. My post.", v:V(0.0,0.5,0.7,0.1,0.4)},                    // REVIEW
    ],
    sickness: [
      {t:"No one sick passes this gate.", v:V(0.0,0.5,0.8,0.1,0.3)},           // REVIEW
      {t:"Cover your mouth. Keep moving.", v:V(0.0,0.5,0.7,0.1,0.3)},          // REVIEW
    ],
    work: [
      {t:"Stand. Watch. Report.", v:V(0.0,0.2,0.8,0.2,0.1)},                   // REVIEW
      {t:"Long shifts. Short sleep.", v:V(0.0,0.3,0.7,0.4,0.1)},               // REVIEW
    ],
    earned: {
      dog: [
        {t:"Too quick to stop. We tried.", v:V(0.0,0.3,0.7,0.1,0.3), fam:2},       // REVIEW
        {t:"Not wild. Someone's. You could tell.", v:V(0.1,0.3,0.6,0.1,0.3), fam:4}, // REVIEW
      ],
      road: [
        {t:"Patrols come back short.", v:V(0.0,0.5,0.7,0.1,0.5), fam:2},           // REVIEW
        {t:"Between us: don't trust the markers.", v:V(0.1,0.5,0.6,0.1,0.6), fam:4}, // REVIEW
      ],
      routes: [
        {t:"Maps were changed. Not by us.", v:V(0.0,0.5,0.7,0.1,0.7), fam:2},      // REVIEW
        {t:"Some posts guard nothing now.", v:V(0.0,0.5,0.6,0.1,0.8), fam:4},      // REVIEW
      ],
    },
    unseen: [
      {t:"No dogs reported.", v:V(0.0,0.2,0.8,0.1,0.2)},                       // REVIEW
      {t:"Nothing like that at my post.", v:V(0.0,0.2,0.8,0.1,0.2)},           // REVIEW
    ],
  },
  ".": {
    town: [
      {t:"Not much happens here.", v:V(0.3,0.2,0.0,0.1,0.1)},                  // REVIEW
      {t:"We know each other. Mostly.", v:V(0.3,0.2,0.0,0.1,0.2)},             // REVIEW
    ],
    war: [
      {t:"Sons left. Some came back.", v:V(0.1,0.6,0.0,0.1,0.4)},              // REVIEW
      {t:"We hide the good grain.", v:V(0.1,0.5,0.0,0.1,0.4)},                 // REVIEW
    ],
    sickness: [
      {t:"We keep the shutters closed.", v:V(0.1,0.6,0.0,0.1,0.3)},            // REVIEW
      {t:"Don't drink from the well.", v:V(0.1,0.7,0.0,0.1,0.3)},              // REVIEW
    ],
    work: [
      {t:"Fields don't wait for news.", v:V(0.2,0.2,0.0,0.3,0.1)},             // REVIEW
      {t:"Same chores. Fewer hands.", v:V(0.2,0.3,0.0,0.3,0.2)},               // REVIEW
    ],
    earned: {
      dog: [
        {t:"Kids tried to catch it.", v:V(0.3,0.2,0.0,0.1,0.2), fam:2},            // REVIEW
        {t:"Slept in our barn once.", v:V(0.4,0.2,0.0,0.1,0.3), fam:4},            // REVIEW
      ],
      road: [
        {t:"We don't go far anymore.", v:V(0.2,0.4,0.0,0.1,0.4), fam:2},           // REVIEW
        {t:"Grandmother says the roads moved before.", v:V(0.2,0.4,0.0,0.1,0.6), fam:4}, // REVIEW
      ],
      routes: [
        {t:"Fences don't end where they did.", v:V(0.1,0.4,0.0,0.1,0.7), fam:2},   // REVIEW
        {t:"We count steps home now.", v:V(0.2,0.5,0.0,0.1,0.7), fam:4},           // REVIEW
      ],
    },
    unseen: [
      {t:"A dog? Not around here.", v:V(0.3,0.2,0.0,0.1,0.2)},                 // REVIEW
      {t:"Only our own dogs here.", v:V(0.3,0.2,0.0,0.1,0.1)},                 // REVIEW
    ],
  },
  // Someone met in the wild. Other topics come from TOPIC_FALLBACKS.
  wanderer: {
    openers: [
      {t:"Hm.", v:V(0.1,0.3,0.0,0.2,0.2)},                                     // REVIEW
      {t:"Passing through too?", v:V(0.3,0.2,0.0,0.3,0.2)},                    // REVIEW
      {t:"Keep your distance. Please.", v:V(0.0,0.4,0.1,0.2,0.3)},             // REVIEW
    ],
    dog: [
      {t:"Tracks everywhere out here.", v:V(0.1,0.3,0.0,0.2,0.3)},             // REVIEW
      {t:"Animals keep to their own roads.", v:V(0.1,0.3,0.0,0.2,0.4)},        // REVIEW
    ],
    road: [
      {t:"I sleep where it's dry.", v:V(0.2,0.3,0.0,0.4,0.2)},                 // REVIEW
      {t:"Towns are worse than this.", v:V(0.1,0.4,0.0,0.3,0.3)},              // REVIEW
    ],
    routes: [
      {t:"I walk in circles some days.", v:V(0.1,0.4,0.0,0.3,0.7)},            // REVIEW
      {t:"The land folds. I don't ask.", v:V(0.1,0.5,0.0,0.2,0.8)},            // REVIEW
    ],
    close: [
      {t:"Go on, then.", v:V(0.1,0.3,0.0,0.2,0.2)},                            // REVIEW
      {t:"Don't follow me.", v:V(0.0,0.4,0.1,0.2,0.2)},                        // REVIEW
    ],
  },
  // The one left in a burned town. Other topics come from TOPIC_FALLBACKS.
  survivor: {
    openers: [
      {t:"You came too late.", v:V(0.1,0.6,0.0,0.3,0.4)},                      // REVIEW
      {t:"Nothing left to take.", v:V(0.0,0.6,0.0,0.3,0.4)},                   // REVIEW
      {t:"Sit. Mind the ash.", v:V(0.2,0.5,0.0,0.3,0.4)},                      // REVIEW
    ],
    dog: [
      {t:"Animals don't come near ash.", v:V(0.1,0.6,0.0,0.3,0.4)},            // REVIEW
      {t:"I wasn't watching for dogs.", v:V(0.0,0.6,0.0,0.3,0.3)},             // REVIEW
    ],
    road: [
      {t:"They came in by the road.", v:V(0.0,0.7,0.1,0.3,0.4)},               // REVIEW
      {t:"Nobody comes back here.", v:V(0.1,0.6,0.0,0.3,0.4)},                 // REVIEW
    ],
    routes: [
      {t:"The smoke went odd ways.", v:V(0.0,0.6,0.0,0.3,0.7)},                // REVIEW
      {t:"Even the paths burned wrong.", v:V(0.0,0.6,0.0,0.3,0.8)},            // REVIEW
    ],
    close: [
      {t:"Leave me with it.", v:V(0.1,0.5,0.0,0.3,0.3)},                       // REVIEW
      {t:"Go. Before they return.", v:V(0.0,0.7,0.1,0.3,0.4)},                 // REVIEW
    ],
  },
};

// ---------- M6: the interface ----------
// The legend for each mode: [glyph, name]. Local T is a temple and local ^ a rock;
// on the world map they are a town and mountains.
export const LEGEND = {
  WORLD: [["@","You"],["p","Person"],[".","Plains"],["F","Forest"],["~","Water"],["^","Mountains"],["T","Town"],["C","Capital"],["R","Ruins"],["#","Blocked"],["!","Distress"],["?","Sign"]],
  TOWN:  [["@","You"],["p","Person"],["|","Street"],["#","Wall"],["I","Inn"],["M","Market"],["S","Smithy"],["T","Temple"],["G","Guard post"],["w","Wagon"],["r","Burned"]],
  WILD:  [["@","You"],["p","Person"],[".","Ground"],["t","Brush"],["^","Rock"],["d","Dog"]],
  RUIN:  [["@","You"],[".","Ground"],["r","Fallen stone"],["^","Standing stone"],["d","Dog"]],
};

// Every live command, as HELP lists it and the side panel shows it.
export const COMMANDS = [
  ["N S E W", "move (also NORTH SOUTH EAST WEST)"],
  ["LOOK", "look around"],
  ["ENTER", "go into a town, the wild or ruins"],
  ["EXIT", "back to the road (also EX, EXT)"],
  ["TALK", "speak to someone here (also HI, HELLO)"],
  ["ASK <topic>", "DOG ROAD TOWN ROUTES WAR SICKNESS WORK"],
  ["CALL", "call your dog"],
  ["WAIT", "let a moment pass"],
  ["REST", "rest a while"],
  ["RIDE", "ride the wagon, when offered"],
  ["STATUS", "how you are, how the roads are"],
  ["SAVE", "get a password"],
  ["LOAD <password>", "go back to a saved game"],
  ["NEW <seed>", "a new world"],
  ["CLEAR", "clear the log"],
  ["HELP", "this list"],
];
