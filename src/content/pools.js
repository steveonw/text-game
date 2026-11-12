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
