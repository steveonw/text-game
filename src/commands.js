// The parser and every command, and starting a new game.

import { G } from './state.js';
import { advanceWorldPressure, cabbageIndex, cabbageIsHereWorld, initCabbageRoute } from './clock.js';
import { BUILDING_POOLS, CABBAGE } from './content/pools.js';
import { triggerEnding } from './endings.js';
import { generateTown, generateWilderness } from './local.js';
import { getNPC, maybeInternal, sayNPC, setNPC } from './people.js';
import { clearLogSoft, freshSeed, log, render, renderLegend } from './io.js';
import { clamp, fnv1a32, noise01 } from './rng.js';
import { loadPasswordAny, savePasswordPacked } from './save.js';
import { TUNE, WORLD_SIZE } from './tuning.js';
import { addDogHint, computeTowns, dogDirectionHint, dogIsNear, dogIsVeryNear, finalTileAt, keyForXY, placePlayer, resetDogHints, tileAt } from './world.js';

// ---------- Command system ----------
export function cmdHelp(){
  log("Commands: N S E W, ENTER, EXIT, LOOK, TALK, ASK <topic>, CALL, WAIT, REST, RIDE, STATUS, SAVE, LOAD <CODE>, NEW <seed>, HELP", "m");
  log("Topics: DOG, ROAD, TOWN, ROUTES, WAR, SICKNESS, WORK", "m");
}

export function cmdStatus(){
  const fatWord = ["fresh","worn","tired","heavy","spent","near-done"][clamp(G.player.fatigue,0,5)];
  const repWord = ["unknown","noticed","recognized","remembered","expected","spoken-of"][clamp(G.player.rep,0,5)];
  const tone = G.worldEvents.has("capital_fallen") ? "The kingdom feels hollow."
            : G.worldEvents.has("routes_stirring") ? "The roads feel unsettled."
            : "The day feels ordinary.";
  log("You are "+fatWord+". People are "+repWord+".", "m");
  log(tone, "m");
}

export function travelEventCheck(){
  const r = noise01(G.player.x + G.steps, G.player.y - G.steps, G.seed ^ 0x7A7A);
  if (r < 0.06) log("You notice old tracks crossing the land.", "m");
  else if (r < 0.10) log("A distant tower is visible from here.", "m");
  else if (r < 0.13) log("A traveler passes without speaking.", "m");
  else if (r < 0.15) log("You feel like you are being watched.", "m");
}

export function moveWorld(dx,dy){
  if (G.mode!=="WORLD"){ log("Not here.", "m"); return; }
  const nx = G.player.x + dx, ny = G.player.y + dy;
  if (nx<0||ny<0||nx>=WORLD_SIZE||ny>=WORLD_SIZE){ log("You cannot go that way.", "m"); return; }
  const t = finalTileAt(nx,ny);
  if (t==="~"){ log("Deep water blocks your path.", "m"); return; }
  if (t==="^"){ log("The mountains resist passage.", "m"); return; }
  if (t==="#"){ log("The road is blocked.", "m"); return; }

  G.player.x=nx; G.player.y=ny;
  G.steps++;
  G.player.fatigue = clamp(G.player.fatigue + (t==="F" ? TUNE.forestFatigue : TUNE.moveFatigue), 0, 5);

  if (dogIsNear(G.player.x, G.player.y)){
    maybeInternal("nearDog");
    if (addDogHint(G.player.x, G.player.y)){
      if (G.dogHintCount >= TUNE.hintsToStir && !G.worldEvents.has("routes_stirring")){
        G.worldEvents.add("routes_stirring");
        log("Animals have been restless. You feel it in the roads.", "m");
      }
    }
  } else maybeInternal("travel");

  travelEventCheck();
  advanceWorldPressure();
  render();
}

export function cmdEnter(){
  if (G.mode!=="WORLD"){ log("You are already inside.", "m"); return; }
  const tile = finalTileAt(G.player.x, G.player.y);
  if (tile==="T" || tile==="C" || tile==="!" || tile==="R"){
    G.local = generateTown(G.player.x, G.player.y, false);
    G.mode="LOCAL";
    log("Buildings gather. The road narrows.", "m");
    render(); return;
  }
  if (tile==="." || tile==="F"){
    G.local = generateWilderness(G.player.x, G.player.y);
    G.mode="LOCAL";
    log("The land closes around you.", "m");
    if (G.local.dog) log("You sense movement nearby.", "m");
    render(); return;
  }
  log("There is nothing to enter here.", "m");
}

export function cmdExit(){
  if (G.mode!=="LOCAL"){ log("Not here.", "m"); return; }
  G.mode="WORLD"; G.local=null;
  log("You return to the open road.", "m");
  render();
}

export function moveLocal(dx,dy){
  if (G.mode!=="LOCAL" || !G.local){ log("Not here.", "m"); return; }
  const nx = G.local.px + dx, ny = G.local.py + dy;

  // walking off edge exits back to world
  if (nx<0||ny<0||nx>=G.local.size||ny>=G.local.size){
    cmdExit(); return;
  }

  if (!G.local.map[ny] || G.local.map[ny][nx]===undefined){
    log("The ground is strange here.", "m");
    return;
  }
  const cell = G.local.map[ny][nx];
  if (cell==="#"){ log("A wall blocks your way.", "m"); return; }

  G.local.px=nx; G.local.py=ny;
  G.steps++;
  G.player.fatigue = clamp(G.player.fatigue + TUNE.moveFatigue, 0, 5);

  if (G.local.kind==="WILD" && G.worldEvents.has("routes_stirring")) maybeInternal("routes");
  else if (G.player.fatigue>=4) maybeInternal("fatigue3");
  else if (G.player.fatigue>=2) maybeInternal("fatigue2");
  else if (G.player.fatigue>=1) maybeInternal("fatigue1");

  advanceWorldPressure();
  render();
}

export function cmdLook(){
  if (G.mode==="END") return;
  if (G.mode==="WORLD"){
    const tile = finalTileAt(G.player.x, G.player.y);
    const desc = ({".":"Open land stretches out.","F":"Trees crowd closer.","~":"Water, cold and absolute.","^":"High stone. Thin air.","T":"A town sits where roads gather.","C":"The capital's shadow reaches far.","R":"Old stones. A place avoided.","!":"A town under strain.","#":"A blockage. Deliberate."})[tile] || "You see nothing special.";
    log(desc, "m");
    if (dogIsNear(G.player.x, G.player.y)) log("Something moved through here recently.", "m");
    if (dogIsVeryNear(G.player.x, G.player.y)) log("The trail is fresh. ENTER to search.", "m");
    return;
  }
  const cell = G.local.map[G.local.py][G.local.px];

  // Check if there's an NPC here
  const hasNPC = G.local.npcs && G.local.npcs.some(n => n.x === G.local.px && n.y === G.local.py);

  const d = (cell==="w") ? "A battered wagon. Cabbages stacked unevenly."
          : (cell==="I") ? "An inn. Warmth behind a door." + (hasNPC ? " Someone moves inside." : "")
          : (cell==="M") ? "A market space. Trade leaves traces." + (hasNPC ? " A merchant watches." : "")
          : (cell==="S") ? "A smithy. Heat and hammer-sound." + (hasNPC ? " The smith is working." : "")
          : (cell==="T") ? "A temple. Quiet held in stone." + (hasNPC ? " A figure kneels in shadow." : "")
          : (cell==="G") ? "A guard post. Eyes on the road." + (hasNPC ? " A guard stands ready." : "")
          : (cell==="r") ? "Burned timbers. A place that won't return."
          : (cell==="t") ? "Brush and shadow."
          : (cell==="^") ? "Rock, rough underfoot."
          : (cell==="|") ? "A worn street line." + (hasNPC ? " Someone lingers nearby." : "")
          : (cell==="+") ? "A crossing of streets." + (hasNPC ? " A local is passing through." : "")
          : (hasNPC ? "Someone is here." : "Nothing calls out.");
  log(d, "m");

  if (G.local.dog && G.local.px===G.local.dog.x && G.local.py===G.local.dog.y){
    log("Your dog. It's here.", "m");
    log("(CALL to reunite.)", "m");
  } else if (G.local.dog) {
    const dist = Math.abs(G.local.px - G.local.dog.x) + Math.abs(G.local.py - G.local.dog.y);
    if (dist <= 2) log("Movement in the brush nearby.", "m");
  }
}

// Helper: standardize local NPC IDs so TALK and ASK refer to the same "person".
export function speakerName(cell){
  if (cell==="w") return "Cabbage Merchant";
  if (cell==="I") return "Innkeeper";
  if (cell==="M") return "Merchant";
  if (cell==="S") return "Smith";
  if (cell==="T") return "Priest";
  if (cell==="G") return "Guard";
  if (cell==="r") return "Survivor";
  if (cell===".") return (G.local && G.local.kind==="TOWN") ? "Local" : "Wanderer";
  if (cell==="t") return "Wanderer";
  return "Someone";
}

export function logSpeaker(cell, topic){
  const who = speakerName(cell);
  const tag = topic ? (who + " (" + topic + "):") : (who + ":");
  log(tag, "m");
}

export function getLocalNPCId(cell, tx, ty){
  if (cell === "w") return CABBAGE.id;
  // Generic / ambient speakers share an ID per local map area.
  if (cell === "." || cell === "F" || cell === "t" || cell === "^" || cell === "|" || cell === "+" ){
    return "npc_ambient_" + G.local.kind + "_" + tx + "_" + ty;
  }
  return "npc_" + cell + "_" + tx + "_" + ty;
}

export function cmdTalk(){
  if (G.mode==="END") return;
  if (G.mode==="WORLD"){ log("No one to speak with here.", "m"); return; }

  const cell = G.local.map[G.local.py][G.local.px];

  // wagon / cabbage merchant
  if (cell==="w" && G.local.kind==="TOWN" && (cabbageIsHereWorld(G.local.tx, G.local.ty) || G.local.wagonForced)){
    const st = getNPC(CABBAGE.id);
    st.familiarity = clamp(st.familiarity+1,0,99);
    const opener = CABBAGE.openers[Math.floor(noise01(G.steps, 1, G.seed^0xCAB)*CABBAGE.openers.length)];
    const idx = clamp(st.familiarity-1, 0, CABBAGE.complaint.length-1);
    log(opener);
    log(CABBAGE.complaint[idx], "m");
    setNPC(CABBAGE.id, st);
    if (G.player.fatigue>=TUNE.rideMinFatigue && st.familiarity>=TUNE.rideMinFamiliarity){
      log(CABBAGE.rideOffer.join(" "), "m");
      log("(Type RIDE.)", "m");
    }
    G.player.rep = clamp(G.player.rep + 1, 0, 5);
    return;
  }

  const id = getLocalNPCId(cell, G.local.tx, G.local.ty);
  const st = getNPC(id);
  st.familiarity = clamp(st.familiarity+1,0,99);
  setNPC(id, st);

  // Talking is a small bid for trust; high fatigue can sour it.
  if (G.player.rep>=TUNE.trustAtReputation) st.trust = clamp((st.trust|0) + 1, -5, 5);
  if (G.player.fatigue>=TUNE.hostilityAtFatigue) st.hostility = clamp((st.hostility|0) + 1, 0, 5);
  setNPC(id, st);

  let building = BUILDING_POOLS[cell] ? cell : ".";
  const topic = (dogIsNear(G.local.tx, G.local.ty) && noise01(G.steps, 2, G.seed^0xD06) < TUNE.talkDogTopicChance) ? "DOG" : "ROAD";
  const lines = sayNPC(building, topic, {bodyLines:1, overlayCap:1, npc: st});
  logSpeaker(cell, topic);
  for (const ln of lines) log(ln);
  G.player.rep = clamp(G.player.rep + (st.familiarity>=2 ? 1:0), 0, 5);
}

export function cmdAsk(topic){
  if (G.mode==="END") return;
  topic = (topic||"").toUpperCase().trim();
  if (!topic){ log("Ask about what?", "m"); return; }
  const KNOWN = new Set(["DOG","ROAD","TOWN","ROUTES","WORK","WAR","SICKNESS"]);
  if (!KNOWN.has(topic)) { log("No one understands that word.", "m"); return; }
  if (topic==="ROUTES" && !G.worldEvents.has("routes_stirring")){
    log("No one here understands the word the way you mean it.", "m");
    return;
  }
  if (G.mode==="WORLD"){
    if (topic==="DOG"){
      log("You call softly. The wind answers.", "m");
      if (dogIsNear(G.player.x, G.player.y)) log("But the ground suggests you are close.", "m");
    } else log("There is no one to ask.", "m");
    return;
  }
  const cell = G.local.map[G.local.py][G.local.px];

  const id = getLocalNPCId(cell, G.local.tx, G.local.ty);
  const st = getNPC(id);
  st.familiarity = clamp(st.familiarity + 1, 0, 99);
  setNPC(id, st);

  // Tiny memory bridge: repeated probing makes some people bristle.
  st.flags = st.flags || [];
  const keyFlag = "asked_"+topic.toLowerCase();
  if (st.flags.includes(keyFlag)) st.hostility = clamp((st.hostility|0) + 1, 0, 5);
  else st.flags.push(keyFlag);
  // Reputation and familiarity can build trust.
  if (G.player.rep>=TUNE.trustAtReputation) st.trust = clamp((st.trust|0) + 1, -5, 5);
  setNPC(id, st);

  // If the wagon symbol appears but the schedule says the merchant isn't here,
  // fall back to market-style talk instead of feeling "broken".
  let building = BUILDING_POOLS[cell] ? cell : ".";
  if (cell === "w" && !cabbageIsHereWorld(G.local.tx, G.local.ty)) building = "M";

  const lines = sayNPC(building, topic, {bodyLines:2, overlayCap:1, npc: st, frame:false});
  logSpeaker(cell, topic);
  for (const ln of lines) log(ln);
  if (topic==="DOG" && (st.familiarity>=TUNE.gestureAtFamiliarity || (st.trust|0)>=TUNE.gestureAtTrust)){
    const dir = dogDirectionHint(G.local.tx, G.local.ty);
    if (dir) log("(A gesture: " + dir + ".)", "m");
  }
  if (topic==="DOG" && dogIsNear(G.local.tx, G.local.ty)) maybeInternal("nearDog");
  if (topic==="ROUTES") maybeInternal("routes");
  G.player.rep = clamp(G.player.rep + 1, 0, 5);
}

export function cmdWait(){
  G.steps++;
  G.player.fatigue = clamp(G.player.fatigue - TUNE.waitRecovers, 0, 5);
  log("You wait.", "m");
  advanceWorldPressure();
  maybeInternal(G.player.fatigue>=3 ? "fatigue2" : "travel");
  render();
}

export function cmdRest(){
  if (G.mode!=="LOCAL"){ log("Not here.", "m"); return; }
  if (G.local.kind==="TOWN"){
    G.steps += TUNE.restSteps;
    G.player.fatigue = clamp(G.player.fatigue - TUNE.restTownRecovers, 0, 5);
    log("You rest for a while.", "m");
    advanceWorldPressure();
    render(); return;
  }
  G.steps += TUNE.restSteps;
  G.player.fatigue = clamp(G.player.fatigue - TUNE.restWildRecovers, 0, 5);
  if (noise01(G.steps, 404, G.seed^0xA357) < TUNE.shallowSleepChance) log("Sleep comes shallow. You wake too quickly.", "m");
  else log("You rest. The world does not.", "m");
  advanceWorldPressure();
  render();
}

export function cmdRide(){
  if (G.mode!=="LOCAL" || !G.local || G.local.kind!=="TOWN"){ log("Not here.", "m"); return; }
  const cell = G.local.map[G.local.py][G.local.px];
  if (!(cell==="w" && (cabbageIsHereWorld(G.local.tx, G.local.ty) || G.local.wagonForced))){ log("No ride is offered.", "m"); return; }
  if (!G.cabbageRoute.length){ log("The merchant has nowhere to go.", "m"); return; }
  const st = getNPC(CABBAGE.id);
  if (G.player.fatigue < TUNE.rideMinFatigue || st.familiarity < TUNE.rideMinFamiliarity){ log("Not today.", "m"); return; }

  const idx = cabbageIndex();
  const next = G.cabbageRoute[(idx+1) % G.cabbageRoute.length];
  if (!next){ log("The route is unclear.", "m"); return; }

  log("You climb onto the wagon.", "m");
  log("Cabbages shift beneath the weight.", "m");
  log("The road becomes a rhythm.", "m");
  log("He complains the whole way.", "m");
  log("You rest.", "m");

  G.steps += TUNE.rideSteps;
  G.player.fatigue = clamp(G.player.fatigue - TUNE.rideRecovers, 0, 5);
  advanceWorldPressure();

  clearLogSoft();
  log("The wagon stops.", "m");
  log(CABBAGE.afterRide[0], "m");

  G.player.x = next.x; G.player.y = next.y;
  G.local = generateTown(G.player.x, G.player.y, true);
  G.mode = "LOCAL";
  render();
}

export function cmdNew(seedStr){
  const s = (seedStr||"").trim();
  G.seed = s ? fnv1a32(s) : freshSeed();
  startNewGame();
  log("World seeded: "+(s? s : (G.seed|0)), "m");
}

export function cmdDebug(){
  log("Seed: "+(G.seed|0), "m");
  log("Pos: ("+G.player.x+","+G.player.y+") mode "+G.mode, "m");
  log("Towns: "+G.towns.length+" Capital: ("+G.capital.x+","+G.capital.y+")", "m");
  log("Events: "+G.worldEvents.size+" NPCs: "+Object.keys(G.npcMemory).length, "m");
  log("Cabbage route: "+G.cabbageRoute.length, "m");
}

export function cmdBlock(){
  if (G.mode!=="WORLD"){ log("Try it on the open road.", "m"); return; }
  const t = tileAt(G.player.x, G.player.y);
  if (t==="~" || t==="^"){ log("You can't block water or mountains.", "m"); return; }
  const k = keyForXY(G.player.x, G.player.y);
  const key = "road_blocked_"+k;
  if (G.worldEvents.has(key)){
    G.worldEvents.delete(key);
    log("The blockage is cleared.", "m");
  } else {
    G.worldEvents.add(key);
    log("Someone sets a barricade on the road.", "m");
  }
  render();
}

// ---------- Dog calling and endings ----------
export function cmdCall(){
  if (G.mode==="END") return;

  if (G.mode==="WORLD"){
    log("You call out.", "m");
    if (dogIsVeryNear(G.player.x, G.player.y)){
      log("Something stirs in the distance.", "m");
      log("You should search here.", "m");
    } else if (dogIsNear(G.player.x, G.player.y)){
      log("The wind carries it. Maybe.", "m");
    } else {
      log("Your voice falls flat against the land.", "m");
    }
    return;
  }

  // In LOCAL mode
  if (!G.local) return;

  // Check if dog is here and we're near it
  if (G.local.dog){
    const dist = Math.abs(G.local.px - G.local.dog.x) + Math.abs(G.local.py - G.local.dog.y);

    if (dist === 0){
      // Standing on the dog's tile - reunion!
      triggerEnding("reunion");
      return;
    } else if (dist <= 2){
      log("You call softly.", "m");
      log("A shape in the brush. Ears up.", "m");
      log("It doesn't run.", "m");
      log("(Move closer.)", "m");
      return;
    } else {
      log("You call out.", "m");
      log("Something moves at the edge of sight.", "m");
      return;
    }
  }

  log("You call out.", "m");
  if (dogIsNear(G.local.tx, G.local.ty)){
    log("The air feels close. Keep looking.", "m");
  } else {
    log("Nothing answers.", "m");
  }
}

export function runCommand(raw){
  const input = (raw||"").trim();
  if (!input) return;

  log("> "+input, "m");

  const parts = input.split(/\s+/);
  const cmd = parts[0].toUpperCase();
  const arg = parts.slice(1).join(" ");

  if (G.mode==="END"){
    // D1: after an ending NEW and HELP work, and LOAD takes a code in any format.
    if (cmd==="LOAD") loadPasswordAny(arg);
    else if (cmd==="NEW") cmdNew(arg);
    else if (cmd==="HELP") cmdHelp();
    else log("The story is done. (LOAD <password> to continue elsewhere.)", "m");
    return;
  }

  if (cmd==="N"||cmd==="NORTH") return (G.mode==="WORLD"?moveWorld(0,-1):moveLocal(0,-1));
  if (cmd==="S"||cmd==="SOUTH") return (G.mode==="WORLD"?moveWorld(0, 1):moveLocal(0, 1));
  if (cmd==="E"||cmd==="EAST")  return (G.mode==="WORLD"?moveWorld(1, 0):moveLocal(1, 0));
  if (cmd==="W"||cmd==="WEST")  return (G.mode==="WORLD"?moveWorld(-1,0):moveLocal(-1,0));

  // Common aliases / typos
  if (cmd==="HI" || cmd==="HELLO") return cmdTalk();
  if (cmd==="EX" || cmd==="EXT") return cmdExit();

  switch(cmd){
    case "HELP": return cmdHelp();
    case "STATUS": return cmdStatus();
    case "ENTER": return cmdEnter();
    case "EXIT": return cmdExit();
    case "LOOK": return cmdLook();
    case "TALK": return cmdTalk();
    case "ASK": return cmdAsk(arg);
    case "CALL": return cmdCall();
    case "WAIT": return cmdWait();
    case "REST": return cmdRest();
    case "RIDE": return cmdRide();
    case "SAVE": { const pw = savePasswordPacked(); log("Password:", "m"); log(pw, "m"); return; }
    case "LOAD": { loadPasswordAny(arg); return; }
    case "NEW": return cmdNew(arg);
    case "CLEAR": clearLogSoft(); return;
    case "DEBUG": return cmdDebug();
    case "BLOCK": return cmdBlock();
    default: log("Nothing comes of that.", "m"); return;
  }
}

// ---------- Boot ----------
export function startNewGame(){
  // D19: a new game always opens on the world map, wherever NEW was typed.
  G.mode = "WORLD";
  G.local = null;

  G.worldEvents = new Set();
    resetDogHints();
G.npcMemory = Object.create(null);
  G.recentFragments = [];
  G.recentInternal = [];
  G.lastInternalStep = -999;
  G.lastPressureStep = -999;
  G.steps = 0;
  G.player.fatigue = 0;
  G.player.rep = 0;

  computeTowns();
  initCabbageRoute();
  placePlayer();

  clearLogSoft();
  log("The yard gate is open.", "m");
  log("Your dog is gone.", "m");
  log("", "m");
  log("Find it before the roads change.", "m");
  log("", "m");
  log("LOOK around. TALK to people (p). ASK about your DOG.", "m");
  log("CALL when you're close.", "m");

  renderLegend();
  render();
}
