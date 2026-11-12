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
//   homecoming      first walks to the nearest town, finds someone and asks until
//                   reputation is 3; then the explorer's walk, but it does not
//                   ENTER a fresh trail until 5 hint tiles are recorded.
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

const POLICY = `
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
function __runBot(policy){
  __botReset();
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
    repAt: game.get('__repAt'),
    rep: game.get('player.rep'),
    war: game.get('worldEvents.has("war_started")'),
  };
}

export function runPolicy(htmlPath, policy, n = BOT_RUNS) {
  const runs = [];
  for (let i = 1; i <= n; i++) runs.push(runBot(htmlPath, botSeed(i), policy));
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
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : LEGACY;
  const n = parseInt(process.argv[3] || String(BOT_RUNS), 10);
  console.log(`Bots on ${path.relative(ROOT, htmlPath)} over ${n} seeds`);
  const policies = htmlPath === LEGACY ? ['explorer', 'homecoming-v13', 'homecoming'] : ['explorer', 'homecoming'];
  for (const policy of policies) console.log(JSON.stringify(runPolicy(htmlPath, policy, n)));
}
