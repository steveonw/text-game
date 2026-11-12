// Bots: scripted players that drive a build through its own commands.
//
//   node tools/bot.mjs [htmlPath] [nSeeds]
//
// Seeds are "bot-1" .. "bot-N", N = 500 by default. The numbers this prints for
// legacy/quiet-roads-v13.html are the bot rows of docs/SPEC.md section 3.
//
// Policies
//   explorer    walks to the nearest unvisited tile, ENTERs every tile that
//               reports a fresh trail, walks to the dog and CALLs. Never talks.
//   homecoming  the same walk, but first earns reputation 3 by asking, and does
//               not ENTER a fresh trail until 5 hint tiles are recorded.
//
// The explorer plans with the game's own passable() and reads only what LOOK
// would tell a player standing on the tile.

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './harness/load.mjs';
import { HELPERS } from './harness/helpers.mjs';
import { LEGACY, quantile } from './sweep.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const BOT_RUNS = 500;
export const botSeed = (i) => `bot-${i}`;

const POLICY = `
var __visited, __tried, __enters, __routesAt, __repDone;
function __botReset(){ __visited = new Set([keyForXY(player.x,player.y)]); __tried = new Set(); __enters = 0; __routesAt = -1; __repDone = false; }
function __say(c){ pushHistory(c); runCommand(c); render(); }
function __walkToDogAndCall(){
  while (local.px !== local.dog.x) __say(local.px < local.dog.x ? "E" : "W");
  while (local.py !== local.dog.y) __say(local.py < local.dog.y ? "S" : "N");
  __say("CALL");
}
function __earnRep(){
  if (__repDone || !__enterableWild(player.x, player.y)) return;
  __say("ENTER");
  if (mode === "LOCAL"){ __say("ASK DOG"); __say("ASK ROAD"); __say("ASK TOWN"); __say("EXIT"); __repDone = true; }
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
  const minHints = policy === "homecoming" ? 5 : 0;
  const before = function(){ if (policy === "homecoming") __earnRep(); };
  before();
  if (__tryHere(minHints)) return;
  let guard = 0;
  while (mode !== "END" && guard++ < 2000){
    const t = __find(function(x,y){ return !__visited.has(keyForXY(x,y)); });
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
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : LEGACY;
  const n = parseInt(process.argv[3] || String(BOT_RUNS), 10);
  console.log(`Bots on ${path.relative(ROOT, htmlPath)} over ${n} seeds`);
  for (const policy of ['explorer', 'homecoming']) console.log(JSON.stringify(runPolicy(htmlPath, policy, n), null, 2));
}
