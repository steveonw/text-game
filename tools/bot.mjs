// Bots: scripted players that drive a build through its own commands.
//
//   node tools/bot.mjs [htmlPath] [nSeeds]
//
// Seeds are "bot-1" .. "bot-N", N = 500 by default. The explorer and homecoming-v13
// numbers this prints for legacy/quiet-roads-v13.html are the bot rows of
// docs/SPEC.md section 3.
//
// Policies
//   explorer        walks to the nearest unvisited tile, ENTERs every tile that
//                   reports a fresh trail, walks to the dog and CALLs. Never talks.
//   tracker         M3 on. Follows sign: from a tile with sign it steps onto each
//                   unvisited neighbour in turn and stays on the first that has
//                   sign too. ENTERs where the trail is fresh, walks to the dog
//                   and CALLs. Never talks.
//   resting         M5 on. The tracker, but it RESTs wherever it stands whenever its
//                   fatigue is 5, before it moves again.
//   asker           M5 on. Walks to the nearest town and asks the first person
//                   there about the dog, up to four times, until they gesture. It
//                   leaves at once if the answer says the town has not seen the
//                   dog. With no gesture it RIDEs if offered, and tries the town it
//                   arrives in. It follows a gesture until it finds sign, then
//                   tracks. It rests when spent. After two towns with no gesture
//                   it goes back to the yard and tracks. M7 on: when someone
//                   offers to show the way, it FOLLOWs, then tracks from there.
//                   It sets out for a town only if one lies within 16 steps;
//                   otherwise it tracks from the yard, as resting does.
//   waiter          M4 on. Only WAITs. It must end on the change date, as The Open Gate.
//   homecoming      first walks to the nearest town, finds someone and asks until
//                   reputation is 3. Then, on a build with a trail, it walks back
//                   to the yard and tracks; on v13 and M2 it takes the explorer's
//                   walk and does not ENTER a fresh trail until 5 hint tiles are
//                   recorded.
//   homecoming-v13  v13 only. Earns its reputation by asking an empty field three
//                   times (defect D3). The repaired game answers "There is no one
//                   to ask.", so on a current build this policy never earns any.
//                   It is kept so the v13 row of docs/SPEC.md section 3 can be
//                   reproduced from legacy/quiet-roads-v13.html.
//
// The bots plan with the game's own passable() and read only what LOOK would
// tell a player standing on the tile.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './harness/load.mjs';
import { HELPERS } from './harness/helpers.mjs';
import { LEGACY, quantile } from './sweep.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BOT_RUNS = 500;
export const botSeed = (i) => `bot-${i}`;

// How far the asker will walk to a town, in steps. QR_ASK_RANGE overrides it for trials.
const ASK_RANGE = parseInt(process.env.QR_ASK_RANGE || "16", 10);

export const POLICY = `
var __visited, __tried, __enters, __routesAt, __repDone, __townsTried, __repAt;
function __botReset(){ __visited = new Set([keyForXY(player.x,player.y)]); __tried = new Set(); __townsTried = new Set(); __enters = 0; __routesAt = -1; __repAt = -1; __repDone = false; }
function __say(c){ pushHistory(c); runCommand(c); render(); }
function __localWalk(x, y){
  let guard = 0;
  while (local.px !== x && guard++ < 20) __say(local.px < x ? "E" : "W");
  while (local.py !== y && guard++ < 40) __say(local.py < y ? "S" : "N");
  return local.px === x && local.py === y;
}
function __walkToDogAndCall(){
  __localWalk(local.dog.x, local.dog.y);
  __say("CALL");
}
// v13 only: ask the empty field (D3).
function __earnRepFromNobody(){
  if (__repDone || !__enterableWild(player.x, player.y)) return;
  __say("ENTER");
  if (mode === "LOCAL"){ __say("ASK DOG"); __say("ASK ROAD"); __say("ASK TOWN"); __say("EXIT"); __repDone = true; }
}
// Ask someone who is there: in a town, walk to the first person and ask until reputation is 3.
function __earnRepInTown(){
  const k = keyForXY(player.x, player.y);
  if (__repDone || !isTownAt(player.x, player.y) || __townsTried.has(k)) return;
  __townsTried.add(k);
  __say("ENTER");
  if (mode !== "LOCAL") return;
  const who = local.npcs && local.npcs[0];
  if (who && __localWalk(who.x, who.y)){
    const topics = ["DOG","ROAD","TOWN","WORK","ROAD"];
    for (let i = 0; i < topics.length && player.rep < 3; i++) __say("ASK " + topics[i]);
  }
  __say("EXIT");
  if (player.rep >= 3){ __repDone = true; __repAt = steps; }
}
function __tryHere(minHints){
  const k = keyForXY(player.x, player.y);
  if (dogHintCount >= minHints && dogIsVeryNear(player.x, player.y) && __enterableWild(player.x, player.y) && !__tried.has(k)){
    __tried.add(k); __enters++;
    __say("ENTER");
    if (local && local.dog){ __walkToDogAndCall(); return true; }
    __say("EXIT");
  }
  return false;
}
// ---- tracking (M3) ----
// What the bot knows: which tiles it has stood on, and for each whether LOOK
// reported sign there. It learns a tile by stepping onto it.
var __sign, __noSign, __clockSeen, __den1Step, __den1BeforeWar;
function __clockState(){ return (worldEvents.has("war_started") ? 1 : 0) + (worldEvents.has("capital_fallen") ? 2 : 0); }
function __note(){
  const k = keyForXY(player.x, player.y);
  __visited.add(k);
  if (__routesAt < 0 && worldEvents.has("routes_stirring")) __routesAt = steps;
  // The world moved on (the game says so on the page): sign may have spread, so tiles found bare are worth another look.
  if (__clockState() !== __clockSeen){ __clockSeen = __clockState(); __noSign = new Set(); }
  if (dogIsNear(player.x, player.y)){ __sign.add(k); __noSign.delete(k); } else { __noSign.add(k); }
  // Bookkeeping for the report, not something the bot acts on.
  if (__den1Step < 0 && mode === "WORLD" && typeof trail === "function"){
    const d = trail().tiles[trail().den1];
    if (d.x === player.x && d.y === player.y){ __den1Step = steps; __den1BeforeWar = !worldEvents.has("war_started"); }
  }
}
var __rests = false;
function __restIfSpent(){ if (__rests && player.fatigue >= 5 && mode === "WORLD"){ __say("REST"); __note(); } }
function __untried(x, y){ return passable(x, y) && !__sign.has(keyForXY(x, y)) && !__noSign.has(keyForXY(x, y)); }
// keep: carry on with what the bot already knows (the asker knows the yard has sign).
function __track(keep){
  if (!keep){ __sign = new Set(); __noSign = new Set(); __clockSeen = __clockState(); }
  __note();
  let guard = 0;
  while (mode !== "END" && guard++ < 1500){
    if (dogIsVeryNear(player.x, player.y) && __enterableWild(player.x, player.y)){
      __enters++;
      __say("ENTER");
      if (local && local.dog){ __walkToDogAndCall(); return; }
      __say("EXIT");
    }
    // Try each neighbour this bot has not stood on. Stay on the first with sign.
    let found = false;
    for (const n of __neighbours(player.x, player.y)){
      if (!__untried(n.x, n.y)) continue;
      const back = {N:"S", S:"N", E:"W", W:"E"}[n.dir];
      __restIfSpent(); if (mode === "END") return;
      __say(n.dir); __note();
      if (mode === "END") return;
      if (__sign.has(keyForXY(player.x, player.y))){ found = true; break; }
      __restIfSpent(); if (mode === "END") return;
      __say(back); __note();
    }
    if (found) continue;
    // Nothing new beside this tile. Go to the nearest known sign tile that still has an untried neighbour.
    const t = __find(function(x, y){
      if (!__sign.has(keyForXY(x, y))) return false;
      return __neighbours(x, y).some(function(n){ return __untried(n.x, n.y); });
    });
    if (!t || (t.x === player.x && t.y === player.y)){ __say("WAIT"); __note(); continue; }
    for (const c of __pathTo(player.x, player.y, t.x, t.y)){ __restIfSpent(); if (mode === "END") return; __say(c); __note(); if (mode === "END") return; }
  }
}
// ---- asking (M5) ----
var __heard = [];
function __listen(){
  if (HOST.__botListening) return;
  const out = HOST.out;
  HOST.out = function(t, c){ __heard.push(String(t)); return out(t, c); };
  HOST.__botListening = true;
}
function __sayHear(c){ const n = __heard.length; __say(c); return __heard.slice(n); }
function __walkWorld(x, y){
  const path = __pathTo(player.x, player.y, x, y);
  if (!path) return false;
  for (const c of path){ __restIfSpent(); if (mode !== "WORLD") return false; __say(c); __note(); if (mode !== "WORLD") return false; }
  return player.x === x && player.y === y;
}
// In a town: ask each person about the dog until one gestures. Returns the direction, or
// null; rides the wagon when offered and no one gestured, and says so.
function __askTown(){
  __say("ENTER");
  if (mode !== "LOCAL" || local.kind !== "TOWN"){ if (mode === "LOCAL") __say("EXIT"); return {dir: null, rode: false}; }
  // One question tells it whether this town has seen the dog: the not-seen lines say so.
  let dir = null, unseen = false, follow = false;
  const UNSEEN = [];
  for (const k in PEOPLE) if (PEOPLE[k].unseen) for (const f of PEOPLE[k].unseen) UNSEEN.push(f.t);
  for (const n of local.npcs.filter(function(n){ return n.type !== "w"; })){
    if (!__localWalk(n.x, n.y)) continue;
    for (let i = 0; i < 4 && !dir && !unseen && mode === "LOCAL"; i++){
      for (const l of __sayHear("ASK DOG")){
        // A plain string test: this code sits in a template string, which would eat a regex's backslashes.
        if (l.indexOf("(A gesture: ") === 0) dir = l.slice(12, -2);
        if (UNSEEN.includes(l)) unseen = true;
        if (l === "(Type FOLLOW.)") follow = true;
      }
    }
    break; // one person a town
  }
  // M7: someone offered to show the way. Go with them.
  if (follow && mode === "LOCAL"){ __say("FOLLOW"); if (mode === "WORLD"){ __follows++; return {dir: dir, rode: false, followed: true}; } }
  let rode = false;
  if (!dir && mode === "LOCAL" && local.wagon){
    __localWalk(1, 4);
    for (let i = 0; i < 3 && !rode && mode === "LOCAL"; i++){
      if (__sayHear("TALK").includes("(Type RIDE.)")) rode = __sayHear("RIDE").includes("The wagon stops.");
    }
  }
  if (mode === "LOCAL") __say("EXIT");
  return {dir: dir, rode: rode};
}
var __gestures = 0, __rides = 0, __follows = 0, __askRange = ${ASK_RANGE};
function __ask(){
  __listen(); __rests = true;
  __sign = new Set(); __noSign = new Set(); __clockSeen = __clockState();
  __note(); // it looks around the yard before it sets out
  const asked = new Set();
  const STEP = {north:[0,-1,"N"], south:[0,1,"S"], east:[1,0,"E"], west:[-1,0,"W"]};
  for (let towns = 0; towns < 2 && mode !== "END"; towns++){
    const t = __find(function(x,y){ return isTownAt(x,y) && !asked.has(keyForXY(x,y)); });
    // A town farther than this is not worth the walk: track instead, as the map shows.
    const way = t && __pathTo(player.x, player.y, t.x, t.y);
    if (!way || way.length > __askRange) break;
    if (!__walkWorld(t.x, t.y)) break;
    let r = {dir: null, rode: true};
    while (!r.dir && r.rode && mode === "WORLD" && !asked.has(keyForXY(player.x, player.y))){
      asked.add(keyForXY(player.x, player.y));
      r = __askTown();
      if (r.rode) __rides++;
    }
    if (mode === "END") return;
    if (r.followed){ __gestures++; __note(); __track(true); return; }
    if (!r.dir) continue;
    __gestures++;
    // Follow the gesture until sign is found, for as long as the way is open.
    for (let i = 0; i < 6 && mode === "WORLD"; i++){
      const d = STEP[r.dir], nx = player.x + d[0], ny = player.y + d[1];
      if (!passable(nx, ny)) break;
      __restIfSpent(); if (mode !== "WORLD") return;
      __say(d[2]); __note();
      if (dogIsNear(player.x, player.y)){ __track(true); return; }
    }
  }
  if (mode === "END") return;
  // No gesture led to sign: go back to the nearest sign it knows of, and track from there.
  __track(true);
}

function __neighbours(x, y){
  const out = [];
  for (const d of [["N",0,-1],["E",1,0],["S",0,1],["W",-1,0]]){
    const nx = x + d[1], ny = y + d[2];
    if (nx < 0 || ny < 0 || nx >= WORLD_SIZE || ny >= WORLD_SIZE) continue;
    out.push({dir: d[0], x: nx, y: ny});
  }
  return out;
}

function __runBot(policy){
  __botReset();
  __den1Step = -1; __den1BeforeWar = false;
  const tracking = typeof trail === "function";
  __rests = (policy === "resting");
  if (policy === "tracker" || policy === "resting"){ __track(); return; }
  if (policy === "waiter"){ let g = 0; while (mode !== "END" && g++ < 400) __say("WAIT"); return; }
  if (policy === "asker"){ __gestures = 0; __rides = 0; __follows = 0; __ask(); return; }
  if (policy === "homecoming" && tracking){
    // Reputation first, from someone in the nearest town; then back to the yard to follow the sign.
    const yard = {x: player.x, y: player.y};
    let tries = 0;
    while (!__repDone && tries++ < 4){
      const t = __find(function(x,y){ return isTownAt(x,y) && !__townsTried.has(keyForXY(x,y)); });
      if (!t) break;
      for (const c of __pathTo(player.x, player.y, t.x, t.y)){ __say(c); if (__routesAt < 0 && worldEvents.has("routes_stirring")) __routesAt = steps; }
      __earnRepInTown();
    }
    for (const c of (__pathTo(player.x, player.y, yard.x, yard.y) || [])) __say(c);
    __track();
    return;
  }
  const minHints = policy === "explorer" ? 0 : 5;
  const before = function(){
    if (policy === "homecoming-v13") __earnRepFromNobody();
    if (policy === "homecoming") __earnRepInTown();
  };
  before();
  if (__tryHere(minHints)) return;
  let guard = 0;
  while (mode !== "END" && guard++ < 2000){
    let t = null;
    if (policy === "homecoming" && !__repDone) t = __find(function(x,y){ return isTownAt(x,y) && !__townsTried.has(keyForXY(x,y)); });
    if (!t) t = __find(function(x,y){ return !__visited.has(keyForXY(x,y)); });
    if (!t) break;
    for (const c of __pathTo(player.x, player.y, t.x, t.y)){
      __say(c);
      __visited.add(keyForXY(player.x, player.y));
      if (__routesAt < 0 && worldEvents.has("routes_stirring")) __routesAt = steps;
      before();
      if (__tryHere(minHints)) break;
      if (mode === "END") break;
    }
  }
}`;

export function runBot(htmlPath, seedStr, policy) {
  const game = load(htmlPath, { seed: seedStr });
  game.run(HELPERS);
  game.run(POLICY);
  game.run(`__runBot(${JSON.stringify(policy)})`);
  const endLine = game.logs.find(([, t]) => t.startsWith('Ending: '));
  return {
    ending: endLine ? endLine[1].slice('Ending: '.length) : 'none',
    steps: game.get('steps'),
    enters: game.get('__enters'),
    routesAt: game.get('__routesAt'),
    den1Step: game.get('__den1Step'),
    den1BeforeWar: game.get('__den1BeforeWar'),
    hints: game.get('dogHintCount'),
    changeStep: game.get('typeof dates === "function" ? dates().change : -1'),
    gestures: game.get('typeof __gestures === "number" ? __gestures : 0'),
    rides: game.get('typeof __rides === "number" ? __rides : 0'),
    follows: game.get('typeof __follows === "number" ? __follows : 0'),
    repAt: game.get('__repAt'),
    rep: game.get('player.rep'),
    war: game.get('worldEvents.has("war_started")'),
  };
}

export function runPolicy(htmlPath, policy, n = BOT_RUNS, seedOf = botSeed) {
  const runs = [];
  for (let i = 1; i <= n; i++) runs.push(runBot(htmlPath, seedOf(i), policy));
  return summarize(policy, runs);
}

// The table row for one policy, from its runs.
export function summarize(policy, runs) {
  const n = runs.length;
  const endings = {};
  for (const r of runs) endings[r.ending] = (endings[r.ending] || 0) + 1;
  const done = runs.filter((r) => r.ending !== 'none');
  const stirred = runs.map((r) => r.routesAt).filter((x) => x >= 0);
  return {
    policy, runs: n, endings,
    stepsAtEnding: { p10: quantile(done.map((r) => r.steps), 0.1), median: quantile(done.map((r) => r.steps), 0.5), p90: quantile(done.map((r) => r.steps), 0.9) },
    entersBeforeSuccess: { median: quantile(done.map((r) => r.enters), 0.5), p90: quantile(done.map((r) => r.enters), 0.9) },
    routesStirring: { firedBeforeEnding: stirred.length, medianStep: quantile(stirred, 0.5) },
    endedBeforeWar: done.filter((r) => !r.war).length,
    reputationThree: runs.filter((r) => r.rep >= 3).length,
    den1: { reached: runs.filter((r) => r.den1Step >= 0).length, beforeTheWar: runs.filter((r) => r.den1Step >= 0 && r.den1BeforeWar).length, stepsMedian: quantile(runs.map((r) => r.den1Step).filter((x) => x >= 0), 0.5), stepsP90: quantile(runs.map((r) => r.den1Step).filter((x) => x >= 0), 0.9) },
    endedBeforeStep12: done.filter((r) => r.steps < 12).length,
    endedOnTheChangeDate: runs.filter((r) => r.ending === 'The Open Gate' && r.steps === r.changeStep).length,
    followedAGesture: runs.filter((r) => r.gestures > 0).length,
    rodeTheWagon: runs.filter((r) => r.rides > 0).length,
    followedAGuide: runs.filter((r) => r.follows > 0).length,
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : LEGACY;
  const n = parseInt(process.argv[3] || String(BOT_RUNS), 10);
  console.log(`Bots on ${path.relative(ROOT, htmlPath)} over ${n} seeds`);
  const trailBuild = load(htmlPath, { seed: 'bot-host' }).get('typeof trail === "function"');
  const policies = htmlPath === LEGACY ? ['explorer', 'homecoming-v13', 'homecoming'] : trailBuild ? ['waiter', 'tracker', 'resting', 'asker', 'homecoming', 'explorer'] : ['explorer', 'homecoming'];
  for (const policy of policies) console.log(JSON.stringify(runPolicy(htmlPath, policy, n)));
}
