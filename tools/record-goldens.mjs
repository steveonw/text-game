// Records golden files from a game file.
//
//   node tools/record-goldens.mjs [htmlPath] [outDir]
//
//   node tools/record-goldens.mjs dist/index.html                              the current build -> test/golden/
//   node tools/record-goldens.mjs legacy/quiet-roads-v13.html test/golden-v13  (v13's frozen set; do not re-record)
//
// It writes three things:
//   <outDir>/transcripts/*.json   scripted games: seed + commands -> every logged line and the final map
//   <outDir>/world-hashes.json    terrain, towns, capital and start tile for each sweep seed
//   <outDir>/legacy-codes.json    save codes in every format the game reads, with the state each restores
//
// Each transcript is planned on one loaded game (using read-only helpers to find
// routes and seeds), then replayed from a fresh load with nothing injected. Only
// the replay is recorded. Seed search is deterministic, so running this again on
// the same file rewrites identical files.
//
// The plans below describe the repaired game (M2). The plans that recorded v13's
// defects are in the history of this file at tag m1.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load, play, SNAPSHOT_EXPR } from './harness/load.mjs';
import { HELPERS } from './harness/helpers.mjs';
import { LEGACY, SWEEP_SIZE, sweepSeed } from './sweep.mjs';
import { worldSignature } from './harness/golden.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const DIST = path.join(ROOT, 'dist', 'index.html');
const TARGET = process.argv[2] ? path.resolve(process.argv[2]) : DIST;
if (TARGET === LEGACY && !process.argv[3]) {
  console.error('Refusing to record v13 over test/golden/. These plans describe the repaired game; v13\'s recordings are frozen in test/golden-v13/.');
  process.exit(1);
}
const SOURCE_LABEL = path.relative(ROOT, TARGET).split(path.sep).join('/');
const GOLDEN = process.argv[3] ? path.resolve(process.argv[3]) : path.join(ROOT, 'test', 'golden');
const TRANSCRIPTS = path.join(GOLDEN, 'transcripts');

const PLAN_HELPERS = `
function __neighbours(x,y){
  const out = [];
  for (const v of [[0,-1,"N"],[1,0,"E"],[0,1,"S"],[-1,0,"W"]]){
    const nx = x+v[0], ny = y+v[1];
    if (nx>=0&&ny>=0&&nx<WORLD_SIZE&&ny<WORLD_SIZE) out.push({x:nx, y:ny, dir:v[2]});
  }
  return out;
}
// Nearest reachable tile with a neighbour drawn as glyph, and the direction of that neighbour.
function __bump(glyph){
  const t = __find(function(x,y){ return __neighbours(x,y).some(function(n){ return finalTileAt(n.x,n.y) === glyph; }); });
  if (!t) return null;
  t.dir = __neighbours(t.x,t.y).filter(function(n){ return finalTileAt(n.x,n.y) === glyph; })[0].dir;
  return t;
}
function __edge(){
  const M = WORLD_SIZE - 1;
  const t = __find(function(x,y){ return x===0 || y===0 || x===M || y===M; });
  if (!t) return null;
  t.dir = t.y===0 ? "N" : t.x===M ? "E" : t.y===M ? "S" : "W";
  return t;
}
function __cell(ch){
  for (let y=0;y<local.size;y++) for (let x=0;x<local.size;x++) if (local.map[y][x] === ch) return {x:x, y:y};
  return null;
}
function __townAt(x,y){ return isTownAt(x,y) ? generateTown(x,y,false) : null; }
// The dog on plains or in forest, where v13 could place it; and in natural ruins, where only the repaired game can.
function __openDogTile(x,y){ return __isDogTile(x,y) && !__isNaturalRuin(x,y); }
function __ruinDogTile(x,y){ return __isDogTile(x,y) && __isNaturalRuin(x,y); }
`;

class PlanFail extends Error {}
const fail = (why) => { throw new PlanFail(why); };
const OPPOSITE = { N: 'S', S: 'N', E: 'W', W: 'E' };

class Planner {
  constructor(seed, opts = {}) {
    this.seed = seed;
    this.debug = !!opts.debug;
    this.game = load(TARGET, { seed, debug: this.debug });
    this.game.run(HELPERS);
    this.game.run(PLAN_HELPERS);
    this.commands = [];
  }
  get(expr) { return this.game.get(expr); }
  do(c) { this.commands.push(c); return this.game.cmd(c).map(([, t]) => t); }
  need(cond, why) { if (!cond) fail(why || 'need'); }
  has(event) { return this.get(`worldEvents.has(${JSON.stringify(event)})`); }
  snapshot() { return this.get(SNAPSHOT_EXPR); }
  // world map
  walkTo(x, y, maxSteps = 60) {
    this.need(this.get('mode') === 'WORLD', 'walkTo outside the world map');
    const p = this.get(`__pathTo(player.x, player.y, ${x}, ${y})`);
    this.need(p && p.length <= maxSteps, 'no short path');
    for (const c of p) this.do(c);
  }
  find(predSrc, maxDist = 40) {
    const t = this.get(`__find(${predSrc})`);
    this.need(t && t.d <= maxDist, 'nothing near enough: ' + predSrc.slice(0, 60));
    return t;
  }
  walkToFound(predSrc, maxDist = 40) { const t = this.find(predSrc, maxDist); this.walkTo(t.x, t.y); return t; }
  // local map: no obstacles inside the border, so walk the row then the column
  localTo(x, y) {
    let px = this.get('local.px'), py = this.get('local.py');
    while (px !== x) { this.do(px < x ? 'E' : 'W'); px += px < x ? 1 : -1; }
    while (py !== y) { this.do(py < y ? 'S' : 'N'); py += py < y ? 1 : -1; }
    this.need(this.get('local.px') === x && this.get('local.py') === y, 'local walk blocked');
  }
  waitUntil(expr, max) {
    for (let i = 0; i < max; i++) { if (this.get(expr)) return true; this.do('WAIT'); }
    return !!this.get(expr);
  }
  // walk onto near tiles until the routes begin to stir
  stir(maxSteps = 30) {
    const start = this.get('steps');
    while (!this.has('routes_stirring')) {
      this.need(this.get('steps') - start <= maxSteps, 'stirring took too long');
      // d >= 1: a hint is only recorded by moving onto a tile, never by standing on the start
      const t = this.find('function(x,y,d){ return d >= 1 && dogIsNear(x,y) && !hasDogHint(x,y); }', 12);
      this.walkTo(t.x, t.y);
    }
  }
}

function findSeed(prefix, plan, opts = {}, max = opts.max || 600) {
  for (let i = 1; i <= max; i++) {
    const p = new Planner(`${prefix}-${i}`, opts);
    try { plan(p); return p; } catch (e) { if (!(e instanceof PlanFail)) throw e; }
  }
  throw new Error(`no seed found for "${prefix}" in ${max} tries`);
}

const DOG_TILE = 'function(x,y){ return __openDogTile(x,y); }';
const TOWN_WITH = (cells) => `function(x,y){ const t = __townAt(x,y); return !!t && ${cells.map(([cx, cy, ch]) => `t.map[${cy}][${cx}] === ${JSON.stringify(ch)}`).join(' && ')}; }`;
const endingOf = (p) => { const l = p.game.logs.find(([, t]) => t.startsWith('Ending: ')); return l ? l[1].slice(8) : null; };
function goToDogAndCall(p) {
  const dog = p.get('local.dog');
  p.need(dog, 'no dog on this map');
  p.localTo(dog.x, dog.y);
  p.do('LOOK');
  p.do('CALL');
}

// ---------------------------------------------------------------------------
// Transcripts. Each entry: file name, what it covers, a seed prefix, a plan.
// ---------------------------------------------------------------------------
const harvested = {}; // name -> planner, for save codes taken from interesting states

const PLANS = [
  ['01-world-walk', 'Opening text; LOOK, STATUS, HELP; walking; bumping into water, mountains and the map edge; full-word directions.', 'walk', (p) => {
    p.do('LOOK'); p.do('STATUS'); p.do('HELP');
    for (const glyph of ['~', '^']) {
      const t = p.get(`__bump(${JSON.stringify(glyph)})`);
      p.need(t && t.d <= 14, 'no ' + glyph + ' nearby');
      p.walkTo(t.x, t.y); p.do('LOOK'); p.do(t.dir);
    }
    const e = p.get('__edge()');
    p.need(e && e.d <= 16, 'edge too far');
    p.walkTo(e.x, e.y); p.do(e.dir);
    for (const c of ['NORTH', 'EAST', 'SOUTH', 'WEST']) p.do(c);
    p.do('LOOK'); p.do('STATUS');
    p.need(p.get('steps') >= 12 && p.get('steps') <= 45, 'walk length');
  }],

  ['02-enter-town', 'ENTER and EXIT a town with all five buildings; LOOK at each, the smithy in its corner and the guard post at the east end of the street (D2 repaired), the street and a townsperson; walls; ENTER while inside; EXIT while outside.', 'town', (p) => {
    const t = p.find(`function(x,y){ const t = __townAt(x,y); if (!t || (capital && capital.x === x && capital.y === y)) return false; const b = t.npcs.filter(function(n){ return "IMSTG".includes(n.type); }).length; return b === 5 && t.map[4][7] === "G" && t.map[6][2] === "S" && t.npcs.some(function(n){ return n.type === "n"; }); }`, 12);
    p.walkTo(t.x, t.y);
    p.do('LOOK'); p.do('ENTER'); p.do('ENTER'); p.do('LOOK');
    for (const [x, y] of [[2, 2], [6, 2], [6, 6], [2, 6], [7, 4]]) { p.localTo(x, y); p.do('LOOK'); }
    p.do('TALK');
    const person = p.get('local.npcs.filter(function(n){ return n.type === "n"; })[0]');
    p.localTo(person.x, person.y); p.do('LOOK'); p.do('TALK');
    p.localTo(1, 1); p.do('LOOK'); p.do('W'); p.do('N'); p.do('TALK');
    p.do('EXIT'); p.do('EXIT'); p.do('LOOK');
    // a quiet visit: no war, no sickness, and the routes have not stirred
    p.need(p.get('worldEvents.size') === 0, 'the world moved during the visit');
  }, { max: 3000 }],

  ['03-enter-wilderness', 'ENTER wilderness; LOOK at open ground, brush, rock and a wanderer; TALK to the wanderer; REST; walk off the edge to leave.', 'wild', (p) => {
    const t = p.find(`function(x,y){ if (!__enterableWild(x,y)) return false; const w = generateWilderness(x,y); const cells = w.map.join(); return !w.dog && w.npcs.length === 1 && cells.includes("t") && cells.includes("^"); }`, 12);
    p.walkTo(t.x, t.y);
    p.do('LOOK'); p.do('ENTER'); p.do('LOOK');
    const who = p.get('local.npcs[0]');
    p.localTo(who.x, who.y); p.do('LOOK'); p.do('TALK');
    for (const ch of ['t', '^']) { const c = p.get(`__cell(${JSON.stringify(ch)})`); p.localTo(c.x, c.y); p.do('LOOK'); }
    p.do('REST');
    for (let i = 0; i < 10 && p.get('mode') === 'LOCAL'; i++) p.do('N');
    p.need(p.get('mode') === 'WORLD', 'did not walk off the map');
    p.do('LOOK');
  }],

  ['04-enter-natural-ruins', 'A natural ruins tile reads "Old stones. A place avoided." and ENTERs as wilderness, with no walls and no one to speak with (D6 repaired).', 'ruins', (p) => {
    const t = p.find('function(x,y){ if (!__isNaturalRuin(x,y)) return false; const w = generateWilderness(x,y); return !w.dog && w.npcs.length === 0; }', 12);
    p.walkTo(t.x, t.y);
    p.do('LOOK'); p.do('ENTER'); p.do('LOOK'); p.do('TALK'); p.do('N'); p.do('LOOK'); p.do('ASK DOG');
    p.need(p.get('local.kind') === 'WILD', 'ruins did not open as wilderness');
    p.do('EXIT'); p.do('LOOK');
  }],

  ['05-talk-six-times', 'TALK six times at one inn: every reply has an opener, a line and a close (D4 repaired).', 'talk', (p) => {
    const t = p.find(TOWN_WITH([[2, 2, 'I']]), 20);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.localTo(2, 2); p.do('LOOK');
    for (let i = 0; i < 6; i++) p.do('TALK');
    p.do('STATUS');
  }],

  ['06-ask-every-topic', 'ASK with no topic, every known topic, an unknown topic and a repeat; ROUTES refused before the routes stir; ASK on the world map. TOWN, WAR, SICKNESS and WORK are answered from their own lines (D5 repaired).', 'ask', (p) => {
    const t = p.find(TOWN_WITH([[6, 2, 'M']]), 20);
    p.walkTo(t.x, t.y);
    p.need(!p.has('routes_stirring'), 'routes already stirring');
    p.do('ENTER'); p.localTo(6, 2); p.do('LOOK');
    for (const c of ['ASK', 'ASK DOG', 'ASK ROAD', 'ASK TOWN', 'ASK ROUTES', 'ASK WAR', 'ASK SICKNESS', 'ASK WORK', 'ASK CABBAGE', 'ASK DOG']) p.do(c);
    p.do('EXIT'); p.do('ASK DOG'); p.do('ASK ROAD'); p.do('STATUS');
  }],

  ['07-ask-routes-and-gesture', 'Three near tiles set the routes stirring; ASK ROUTES is then answered; repeated ASK DOG earns a direction gesture.', 'routes', (p) => {
    p.stir();
    const t = p.find(TOWN_WITH([[6, 6, 'T']]), 24);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.localTo(6, 6); p.do('LOOK');
    p.do('ASK ROUTES');
    let gesture = false;
    for (let i = 0; i < 3; i++) if (p.do('ASK DOG').some((l) => l.startsWith('(A gesture: '))) gesture = true;
    p.need(gesture, 'no gesture');
    p.do('STATUS');
  }],

  ['08-wait-and-rest', 'WAIT; REST refused on the world map; REST in the wild and in a town; fatigue words in STATUS.', 'rest', (p) => {
    for (let i = 0; i < 3; i++) p.do('WAIT');
    p.do('REST');
    const w = p.find('function(x,y,d){ return d >= 3 && __enterableWild(x,y) && !generateWilderness(x,y).dog; }', 8);
    p.walkTo(w.x, w.y); p.do('STATUS'); p.do('ENTER'); p.do('REST'); p.do('REST'); p.do('STATUS'); p.do('EXIT');
    const t = p.find('function(x,y){ return isTownAt(x,y); }', 20);
    p.walkTo(t.x, t.y); p.do('STATUS'); p.do('ENTER'); p.do('REST'); p.do('STATUS'); p.do('EXIT');
  }],

  ['09-ride', 'The cabbage merchant: two talks, the offer, RIDE to the next town, and a second ride on from there. The ride is told on the page (D8 repaired).', 'ride', (p) => {
    const route = p.get('cabbageRoute');
    p.need(route.length >= 2, 'route too short');
    let done = false;
    for (let i = 0; i < route.length && !done; i++) {
      const town = route[i];
      const path = p.get(`__pathTo(player.x, player.y, ${town.x}, ${town.y})`);
      if (!path || path.length < 3 || path.length > 30) continue;
      // he must be here on arrival and still here after the three steps to the wagon
      if (Math.floor(path.length / 7) % route.length !== i) continue;
      if (Math.floor((path.length + 3) / 7) % route.length !== i) continue;
      p.walkTo(town.x, town.y); p.do('ENTER');
      p.need(p.get('!!local.wagon'), 'no wagon');
      p.localTo(1, 4); p.do('LOOK'); p.do('RIDE'); p.do('TALK'); p.do('TALK');
      const before = p.get('[player.x, player.y]');
      const out = p.do('RIDE');
      p.need(out.includes('The wagon stops.'), 'ride refused');
      const after = p.get('[player.x, player.y]');
      p.need(before[0] !== after[0] || before[1] !== after[1], 'did not travel');
      p.do('LOOK'); p.do('STATUS'); p.do('RIDE'); p.localTo(1, 4); p.do('TALK'); p.do('RIDE');
      done = true;
    }
    p.need(done, 'no usable stop');
  }],

  ['10-merchant-stays-with-wagon', 'The merchant\'s stop ends, by his timetable, during the walk to the wagon. He is still there: he answers, offers the ride and gives it, to the stop after this one (D9 repaired).', 'wagon', (p) => {
    const route = p.get('cabbageRoute');
    p.need(route.length >= 2, 'route too short');
    let done = false;
    for (let i = 0; i < route.length && !done; i++) {
      const town = route[i];
      const path = p.get(`__pathTo(player.x, player.y, ${town.x}, ${town.y})`);
      if (!path || path.length < 3 || path.length > 30) continue;
      if (Math.floor(path.length / 7) % route.length !== i) continue;
      if (Math.floor((path.length + 3) / 7) % route.length === i) continue;
      p.walkTo(town.x, town.y); p.do('ENTER');
      p.need(p.get('!!local.wagon'), 'no wagon');
      p.localTo(1, 4);
      p.need(!p.get('cabbageIsHereWorld(local.tx, local.ty)') && p.get('local.map[4][1]') === 'w', 'timetable did not move on');
      p.do('LOOK'); p.do('TALK'); p.do('TALK'); p.do('ASK DOG');
      const out = p.do('RIDE');
      p.need(out.includes('The wagon stops.'), 'ride refused');
      const next = route[(i + 1) % route.length];
      p.need(p.get('player.x') === next.x && p.get('player.y') === next.y, 'did not ride to the next stop');
      p.do('LOOK'); p.do('STATUS');
      done = true;
    }
    p.need(done, 'no usable stop');
  }],

  ['11-save-and-load', 'SAVE prints a code; LOAD restores it; LOAD refuses an empty, a short and a wrong-checksum code.', 'save', (p) => {
    const t = p.find(TOWN_WITH([[2, 2, 'I']]), 20);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.localTo(2, 2); p.do('TALK'); p.do('TALK'); p.do('ASK DOG'); p.do('EXIT');
    const code = p.do('SAVE').at(-1);
    p.need(/^[A-Za-z0-9_-]{40,}$/.test(code), 'no code');
    const saved = p.snapshot();
    for (let i = 0; i < 3; i++) p.do('WAIT');
    const moved = p.find('function(x,y,d){ return d === 3; }', 3);
    p.walkTo(moved.x, moved.y);
    const out = p.do('LOAD ' + code);
    p.need(out.includes('The password takes.'), 'code refused');
    const back = p.snapshot();
    for (const k of ['seed', 'x', 'y', 'fatigue', 'rep', 'steps']) p.need(back[k] === saved[k], 'load did not restore ' + k);
    p.do('LOOK'); p.do('STATUS');
    p.do('LOAD'); p.do('LOAD abc'); p.do('LOAD ABCDEFGHJKLMNP'); p.do('SAVE');
  }],

  ['13-ending-reunion', 'A full game to "Ending: Reunion": dog found before war, without the hints and reputation Homecoming asks for.', 'reunion', (p) => {
    const t = p.find(`function(x,y,d){ return d >= 3 && __openDogTile(x,y); }`, 10);
    p.walkTo(t.x, t.y); p.do('LOOK'); p.do('CALL'); p.do('ENTER'); p.do('LOOK'); p.do('CALL');
    goToDogAndCall(p);
    p.need(endingOf(p) === 'Reunion', 'wrong ending');
  }],

  ['14-ending-homecoming', 'A full game to "Ending: Homecoming": reputation 3 earned by talking in a town, 5 hint tiles walked, dog found before war.', 'homecoming', (p) => {
    p.need(p.get('__warStep(400)') >= 60, 'war too early');
    const t = p.find(TOWN_WITH([[2, 2, 'I']]), 14);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.localTo(2, 2);
    p.do('TALK'); p.do('ASK DOG'); p.do('ASK ROAD'); p.do('ASK TOWN'); p.do('STATUS'); p.do('EXIT');
    p.need(p.get('player.rep') >= 3, 'reputation');
    for (let guard = 0; p.get('dogHintCount') < 5; guard++) {
      p.need(guard < 12, 'hints took too long');
      const n = p.find('function(x,y,d){ return d >= 1 && dogIsNear(x,y) && !hasDogHint(x,y); }', 10);
      p.walkTo(n.x, n.y);
    }
    const d = p.find(DOG_TILE, 14);
    p.walkTo(d.x, d.y); p.do('LOOK'); p.do('ENTER');
    goToDogAndCall(p);
    p.need(endingOf(p) === 'Homecoming', 'wrong ending: ' + endingOf(p));
  }],

  ['15-ending-found-in-time', 'A full game to "Ending: Found in Time": the player waits beside the dog until war starts, then calls.', 'war', (p) => {
    const ws = p.get('__warStep(400)');
    p.need(ws > 0 && ws <= 45, 'war too late');
    const d = p.find(DOG_TILE, 10);
    p.walkTo(d.x, d.y); p.do('ENTER');
    const dog = p.get('local.dog'); p.localTo(dog.x, dog.y); p.do('LOOK');
    p.need(p.waitUntil('worldEvents.has("war_started")', 60), 'war never came');
    p.need(!p.has('capital_fallen'), 'capital fell first');
    p.do('STATUS'); p.do('CALL');
    p.need(endingOf(p) === 'Found in Time', 'wrong ending');
  }],

  ['16-ending-long-way-back', 'A full game to "Ending: The Long Way Back": the routes stir, the player waits beside the dog until the capital falls, then calls.', 'fall', (p) => {
    const fs_ = p.get('__fallStep(400)');
    p.need(fs_ > 0 && fs_ <= 80, 'fall too late');
    p.stir();
    const d = p.find(DOG_TILE, 14);
    p.walkTo(d.x, d.y); p.do('ENTER');
    const dog = p.get('local.dog'); p.localTo(dog.x, dog.y);
    p.need(p.waitUntil('worldEvents.has("capital_fallen")', 110), 'capital never fell');
    p.do('STATUS'); p.do('CALL');
    p.need(endingOf(p) === 'The Long Way Back', 'wrong ending');
  }],

  ['18-talk-to-nobody', 'TALK and ASK on an empty wilderness tile: no one is there to answer, and no reputation is earned (D3 repaired).', 'nobody', (p) => {
    const t = p.find('function(x,y){ if (!__enterableWild(x,y)) return false; const w = generateWilderness(x,y); return !w.dog && w.npcs.length === 0; }', 6);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.do('LOOK'); p.do('TALK'); p.do('TALK'); p.do('ASK DOG'); p.do('STATUS'); p.do('EXIT');
  }],

  ['19-call-hot-and-cold', 'CALL and LOOK on tiles with no sign, near sign and a fresh trail; a fresh trail with no dog behind it; CALL at range on a map that holds the dog.', 'call', (p) => {
    const cold = p.find('function(x,y){ return !dogIsNear(x,y); }', 6);
    p.walkTo(cold.x, cold.y); p.do('LOOK'); p.do('CALL');
    const near = p.find('function(x,y){ return dogIsNear(x,y) && !dogIsVeryNear(x,y); }', 8);
    p.walkTo(near.x, near.y); p.do('LOOK'); p.do('CALL'); p.do('ASK DOG');
    const empty = p.find('function(x,y){ return __enterableWild(x,y) && dogIsVeryNear(x,y) && !generateWilderness(x,y).dog; }', 10);
    p.walkTo(empty.x, empty.y); p.do('LOOK'); p.do('CALL'); p.do('ENTER'); p.do('LOOK'); p.do('CALL'); p.do('EXIT');
    const plain = p.find('function(x,y){ return __enterableWild(x,y) && !dogIsNear(x,y); }', 10);
    p.walkTo(plain.x, plain.y); p.do('ENTER'); p.do('CALL'); p.do('EXIT');
    const d = p.find(`function(x,y){ if (!__openDogTile(x,y)) return false; const g = generateWilderness(x,y).dog; return Math.abs(g.x-4) + Math.abs(g.y-4) >= 4; }`, 14);
    p.walkTo(d.x, d.y); p.do('LOOK'); p.do('CALL'); p.do('ENTER'); p.do('CALL');
    const dog = p.get('local.dog');
    // stop two cells short of the dog
    const tx = dog.x + (dog.x > 4 ? -2 : dog.x < 4 ? 2 : 0), ty = dog.x === 4 ? dog.y + (dog.y > 4 ? -2 : 2) : dog.y;
    p.localTo(tx, ty);
    p.need(p.get('Math.abs(local.px-local.dog.x) + Math.abs(local.py-local.dog.y)') === 2, 'not two cells away');
    p.do('LOOK'); p.do('CALL'); p.do('EXIT');
    p.need(p.get('steps') <= 70, 'too long');
  }],

  ['20-fatigue-cap', 'Fatigue climbs to its cap of 5 and movement goes on at no cost (D11, open until M4).', 'tired', (p) => {
    p.do('STATUS');
    const far = p.find('function(x,y,d){ return d === 14; }', 14);
    const path = p.get(`__pathTo(player.x, player.y, ${far.x}, ${far.y})`);
    path.forEach((c, i) => { p.do(c); if (i === 2 || i === 5) p.do('STATUS'); });
    p.need(p.get('player.fatigue') === 5 && p.get('steps') === 14, 'not at cap');
    p.do('STATUS'); p.do('WAIT'); p.do('WAIT'); p.do('STATUS');
  }],

  ['21-debug-and-block', 'On a page opened with ?debug=1: the maintenance commands DEBUG and BLOCK; a blocked tile stops movement and is drawn as #. Nothing in play closes a road yet (D12).', 'debug', (p) => {
    p.do('DEBUG');
    p.need(p.get('__enterableWild(player.x, player.y)'), 'start not enterable');
    p.do('BLOCK');
    const n = p.get('__neighbours(player.x, player.y).filter(function(n){ return passable(n.x, n.y); })[0]');
    p.need(n, 'boxed in');
    p.do(n.dir); p.do(OPPOSITE[n.dir]); p.do('LOOK');
    p.need(p.get('__enterableWild(player.x, player.y)'), 'neighbour not enterable');
    p.do('BLOCK'); p.do('BLOCK');
    p.do('ENTER'); p.do('BLOCK'); p.do('EXIT'); p.do('DEBUG');
  }, { debug: true }],

  ['22-new-and-aliases', 'NEW with a seed; the aliases HI, HELLO, EX and EXT; lower-case input; an unknown word; CLEAR. DEBUG and BLOCK are unknown words on an ordinary page (D17 repaired).', 'new', (p) => {
    p.do('NEW alpha'); p.do('LOOK'); p.do('HI'); p.do('EX'); p.do('EXT'); p.do('xyzzy'); p.do('look'); p.do('n'); p.do('north');
    p.do('DEBUG'); p.do('BLOCK');
    p.need(!p.get('Array.from(worldEvents).some(function(e){ return e.startsWith("road_blocked_"); })'), 'a road was blocked');
    p.do('CLEAR'); p.do('LOOK'); p.do('NEW beta'); p.do('STATUS'); p.do('hello');
  }],

  ['23-long-clock', 'The whole clock by waiting: routes stir, sickness spreads, war starts, a town burns, the capital falls. The final map shows the damage.', 'clock', (p) => {
    p.stir();
    for (let i = 0; i < 150; i++) p.do('WAIT');
    const ev = p.get('Array.from(worldEvents)');
    p.need(ev.includes('war_started') && ev.includes('capital_fallen') && ev.some((e) => e.startsWith('plague_')) && ev.some((e) => e.startsWith('burned_')), 'not every event');
    p.do('STATUS');
  }],

  ['24-fallen-capital', 'After the capital falls it is drawn as ruins, reads as old stones, and is burned inside: timbers where its buildings stood and one Survivor to speak with (D7 repaired).', 'capital', (p) => {
    const fs_ = p.get('__fallStep(400)');
    p.need(fs_ > 0 && fs_ <= 80, 'fall too late');
    p.stir();
    const c = p.get('capital');
    p.walkTo(c.x, c.y, 30); p.do('LOOK');
    p.need(p.waitUntil('worldEvents.has("capital_fallen")', 110), 'capital never fell');
    p.do('LOOK'); p.do('ENTER'); p.do('LOOK');
    p.need(p.get('local.map.flat().filter(function(c){ return c === "r"; }).length') >= 2, 'too little burned');
    p.need(!p.get('local.map.flat().some(function(c){ return "IMSTG".includes(c); })'), 'a building stands');
    const s = p.get('local.npcs.filter(function(n){ return local.map[n.y][n.x] === "r"; })[0]');
    p.need(s, 'no survivor');
    p.do('TALK');
    p.localTo(s.x, s.y); p.do('LOOK'); p.do('TALK'); p.do('ASK DOG'); p.do('EXIT'); p.do('STATUS');
  }],

  ['25-burned-town', 'War burns a town: it is drawn as ruins, its buildings are burned timbers, and one Survivor stands at the first of them, drawn as a person.', 'burned', (p) => {
    p.need(p.waitUntil('Array.from(worldEvents).some(function(e){ return e.startsWith("burned_"); })', 120), 'nothing burned');
    const key = p.get('Array.from(worldEvents).filter(function(e){ return e.startsWith("burned_"); })[0]');
    const [x, y] = key.slice(7).split('_').map(Number);
    p.walkTo(x, y, 30); p.do('LOOK'); p.do('ENTER'); p.do('LOOK');
    p.need(p.get('local.map.flat().filter(function(c){ return c === "r"; }).length') >= 2, 'too little burned');
    const s = p.get('local.npcs.filter(function(n){ return local.map[n.y][n.x] === "r"; })[0]');
    p.need(s, 'no survivor');
    const other = p.get(`(function(){ for (let y=0;y<local.size;y++) for (let x=0;x<local.size;x++) if (local.map[y][x] === "r" && !(x === ${s.x} && y === ${s.y})) return {x:x, y:y}; return null; })()`);
    p.localTo(other.x, other.y); p.do('LOOK'); p.do('TALK');
    p.localTo(s.x, s.y); p.do('LOOK'); p.do('TALK'); p.do('ASK DOG'); p.do('EXIT');
  }],

  ['26-sick-town', 'Sickness reaches a town: it is drawn as !, the market and townsperson are gone, and people add sickness lines.', 'plague', (p) => {
    p.stir();
    p.need(p.waitUntil('Array.from(worldEvents).some(function(e){ return e.startsWith("plague_"); })', 60), 'no sickness');
    const key = p.get('Array.from(worldEvents).filter(function(e){ return e.startsWith("plague_"); })[0]');
    const [x, y] = key.slice(7).split('_').map(Number);
    p.need(!(p.get('capital.x') === x && p.get('capital.y') === y), 'capital');
    p.walkTo(x, y, 30); p.do('LOOK'); p.do('ENTER'); p.do('LOOK');
    const b = p.get('local.npcs.filter(function(n){ return "ISTG".includes(n.type); })[0]');
    p.need(b, 'no one home');
    p.localTo(b.x, b.y); p.do('LOOK'); p.do('TALK'); p.do('TALK'); p.do('ASK SICKNESS'); p.do('ASK DOG'); p.do('EXIT'); p.do('STATUS');
    p.need(p.game.logs.some(([, t]) => t === "People aren't well." || t === 'Best keep distance.'), 'no sickness line spoken');
  }],

  ['27-new-inside-a-town', 'NEW typed inside a town opens the new world on the world map (D19 repaired).', 'newlocal', (p) => {
    const t = p.find('function(x,y){ return isTownAt(x,y); }', 20);
    p.walkTo(t.x, t.y); p.do('ENTER'); p.do('LOOK');
    p.do('NEW other');
    p.need(p.get('mode') === 'WORLD' && p.get('local') === null, 'still inside');
    p.do('LOOK'); p.do('TALK'); p.do('STATUS'); p.do('EXIT'); p.do('LOOK');
  }],

  ['28-dog-in-the-old-stones', 'The trail leads into natural ruins: the tile reads as old stones with a fresh trail, opens as wilderness, and the dog is found there. v13 could not hide the dog in ruins, because ruins opened as an empty town (D6 repaired).', 'stones', (p) => {
    const t = p.find('function(x,y,d){ return d >= 2 && __ruinDogTile(x,y); }', 12);
    p.walkTo(t.x, t.y); p.do('LOOK'); p.do('CALL'); p.do('ENTER'); p.do('LOOK');
    p.need(p.get('local.kind') === 'WILD', 'ruins did not open as wilderness');
    goToDogAndCall(p);
    p.need(endingOf(p) === 'Reunion', 'wrong ending');
  }],
];

// ---------------------------------------------------------------------------
// Save codes
// ---------------------------------------------------------------------------
const b64urlToBytes = (s) => Buffer.from(s.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
const bytesToB64url = (b) => Buffer.from(b).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function readVarint(bytes, i) {
  let res = 0, shift = 0, b;
  do { b = bytes[i++]; res |= (b & 127) << shift; shift += 7; } while (b & 128);
  return [res >>> 0, i];
}
// v13 writes packed version 4 but still reads version 3, which has no hint-tile
// bytes. Nothing writes version 3 any more, so one is rebuilt from a version 4 code.
function packedV4toV3(game, code) {
  const bytes = b64urlToBytes(code);
  const payload = bytes.subarray(0, bytes.length - 2);
  if (payload[0] !== 4) throw new Error('not a version 4 code');
  let i = 1;
  [, i] = readVarint(payload, i);   // seed
  i += 4;                            // x, y, fatigue, reputation
  [, i] = readVarint(payload, i);   // steps
  i += 1;                            // flags
  const head = payload.subarray(1, i);
  let hintLen; [hintLen, i] = readVarint(payload, i);
  const rest = payload.subarray(i + hintLen);
  const out = Buffer.concat([Buffer.from([3]), head, rest]);
  const crc = game.run(`crc16ccitt(new Uint8Array(${JSON.stringify([...out])}))`);
  return bytesToB64url(Buffer.concat([out, Buffer.from([crc & 255, (crc >>> 8) & 255])]));
}
// The oldest base32 form: an event-name list and a people object. v13 has a reader for it and no writer.
function oldestBase32(game, snap) {
  const events = snap.events.map((e) => (e === 'war_started' ? 'war_on_roads' : e));
  for (const t of snap.hintTiles) events.push(`doghint_${t % 20}_${Math.floor(t / 20)}`);
  const st = { s: snap.seed, x: snap.x, y: snap.y, f: snap.fatigue, r: snap.rep, st: snap.steps, e: events, n: snap.npc };
  return game.run(`(function(json){ const body = b32enc(new TextEncoder().encode(json)); return body + chk(body); })(${JSON.stringify(JSON.stringify(st))})`);
}
function restore(code) {
  const game = load(TARGET, { seed: 'codes-host' });
  const reply = game.cmd('LOAD ' + code).map(([, t]) => t);
  return { reply: reply.slice(1), state: game.get(SNAPSHOT_EXPR) };
}

function buildCodes() {
  const out = [];
  const add = (label, format, code, source) => {
    const r = restore(code);
    if (!r.reply.includes('The password takes.')) throw new Error(`code "${label}" was refused: ${r.reply.join(' / ')}`);
    if (source) for (const k of ['seed', 'x', 'y', 'fatigue', 'rep', 'steps']) {
      if (r.state[k] !== source[k]) throw new Error(`code "${label}" restored ${k}=${r.state[k]}, source had ${source[k]}`);
    }
    out.push({ label, format, code, reply: r.reply, restores: r.state });
  };
  const fresh = new Planner('codes-fresh');
  add('a new game at step 0', 'packed-v4', fresh.game.run('savePasswordPacked()'), fresh.snapshot());
  const packedFrom = ['02-enter-town', '05-talk-six-times', '06-ask-every-topic', '07-ask-routes-and-gesture', '09-ride', '20-fatigue-cap', '21-debug-and-block', '23-long-clock', '24-fallen-capital', '25-burned-town', '26-sick-town'];
  for (const name of packedFrom) {
    const p = harvested[name];
    add(`end of transcript ${name}`, 'packed-v4', p.game.run('savePasswordPacked()'), p.snapshot());
  }
  for (const name of ['07-ask-routes-and-gesture', '23-long-clock', '26-sick-town']) {
    const p = harvested[name];
    add(`end of transcript ${name}`, 'base32-v2', p.game.run('savePasswordLegacy()'), p.snapshot());
  }
  for (const name of ['07-ask-routes-and-gesture', '23-long-clock']) {
    const p = harvested[name];
    add(`end of transcript ${name}, rebuilt as packed version 3`, 'packed-v3', packedV4toV3(p.game, p.game.run('savePasswordPacked()')), p.snapshot());
    add(`end of transcript ${name}, rebuilt in the oldest base32 form`, 'base32-oldest', oldestBase32(p.game, p.snapshot()), p.snapshot());
  }
  return out;
}

// ---------------------------------------------------------------------------
// Writers
// ---------------------------------------------------------------------------
const J = (v) => JSON.stringify(v);
const lines = (arr, indent = '    ') => arr.map((e) => indent + J(e)).join(',\n');
function transcriptJson(t) {
  return [
    '{',
    `  "name": ${J(t.name)},`,
    `  "covers": ${J(t.covers)},`,
    `  "source": ${J(SOURCE_LABEL)},`,
    `  "seed": ${J(t.seed)},`,
    ...(t.debug ? ['  "debug": true,'] : []),
    `  "commands": [\n${lines(t.commands)}\n  ],`,
    `  "log": [\n${lines(t.log)}\n  ],`,
    `  "finalScreen": [\n${lines(t.finalScreen)}\n  ],`,
    `  "finalMap": [\n${lines(t.finalMap.replace(/\n$/, '').split('\n'))}\n  ],`,
    `  "finalMapHash": ${J(t.finalMapHash)},`,
    `  "finalStatus": ${J(t.finalStatus)},`,
    `  "finalMode": ${J(t.finalMode)},`,
    `  "finalPos": ${J(t.finalPos)}`,
    '}',
    '',
  ].join('\n');
}

function recordTranscript(name, covers, seed, commands, debug = false) {
  const r = play(TARGET, seed, commands, { debug });
  return { name, covers, seed, debug, commands, log: r.log, finalScreen: r.finalScreen, finalMap: r.finalMap, finalMapHash: r.finalMapHash, finalStatus: r.finalStatus, finalMode: r.finalMode, finalPos: r.finalPos, game: r.game };
}

function main() {
  fs.mkdirSync(TRANSCRIPTS, { recursive: true });
  for (const f of fs.readdirSync(TRANSCRIPTS)) if (f.endsWith('.json')) fs.unlinkSync(path.join(TRANSCRIPTS, f));

  const written = [];
  const write = (t) => {
    fs.writeFileSync(path.join(TRANSCRIPTS, t.name + '.json'), transcriptJson(t));
    written.push(t);
    console.log(`  ${t.name}  seed ${t.seed}  ${t.commands.length} commands  ${t.log.length} lines`);
  };

  console.log('Transcripts');
  for (const [name, covers, prefix, plan, opts] of PLANS) {
    const p = findSeed(prefix, plan, opts || {});
    harvested[name] = p;
    const t = recordTranscript(name, covers, p.seed, p.commands, p.debug);
    // the replay must land exactly where the plan did
    if (J(t.game.get(SNAPSHOT_EXPR)) !== J(p.snapshot())) throw new Error(`replay of ${name} diverged from its plan`);
    if (J(t.log) !== J(p.game.logs)) throw new Error(`replay of ${name} logged different lines`);
    write(t);
  }

  console.log('Save codes');
  const codes = buildCodes();
  const byFormat = (f) => codes.find((c) => c.format === f).code;

  // Two transcripts need codes made above.
  {
    const name = '12-load-old-formats';
    const commands = [`LOAD ${byFormat('base32-v2')}`, 'LOOK', 'STATUS', `LOAD ${byFormat('base32-oldest')}`, 'LOOK', 'STATUS', `LOAD ${byFormat('packed-v3')}`, 'LOOK', 'STATUS', 'SAVE'];
    write(recordTranscript(name, 'LOAD accepts the two older base32 forms and packed version 3, each made in a different world from the one loaded into.', 'old-formats-1', commands));
  }
  {
    const name = '17-after-an-ending';
    const p = findSeed('after', (q) => {
      const t = q.find('function(x,y,d){ return d >= 1 && __openDogTile(x,y); }', 6);
      q.walkTo(t.x, t.y); q.do('ENTER');
      const dog = q.get('local.dog'); q.localTo(dog.x, dog.y);
      const code = q.do('SAVE').at(-1);
      q.do('CALL');
      q.need(endingOf(q) === 'Reunion', 'wrong ending');
      for (const c of ['LOOK', 'N', 'SAVE', 'HELP']) q.do(c);
      q.need(q.get('mode') === 'END', 'left the ending');
      // LOAD takes the code SAVE printed a moment before the ending...
      let out = q.do(`LOAD ${code}`);
      q.need(out.includes('The password takes.') && q.get('mode') === 'WORLD', 'own code refused');
      q.do('LOOK'); q.do('STATUS');
      q.do('ENTER'); q.localTo(dog.x, dog.y); q.do('CALL');
      q.need(endingOf(q) === 'Reunion' && q.get('mode') === 'END', 'no second ending');
      // ...an old base32 code...
      out = q.do(`LOAD ${byFormat('base32-v2')}`);
      q.need(out.includes('The password takes.') && q.get('mode') === 'WORLD', 'base32 refused');
      q.do('STATUS');
      // ...and NEW starts again, as the ending says it will.
      q.do(`LOAD ${code}`); q.do('ENTER'); q.localTo(dog.x, dog.y); q.do('CALL');
      q.need(q.get('mode') === 'END', 'no third ending');
      q.do('NEW abc');
      q.need(q.get('mode') === 'WORLD' && q.get('local') === null && q.get('steps') === 0, 'NEW did not start again');
      q.do('LOOK'); q.do('STATUS');
    });
    write(recordTranscript(name, 'After an ending: other commands are refused, HELP answers, LOAD takes the code SAVE just printed and an old base32 code, and NEW starts again (D1 repaired).', p.seed, p.commands));
  }

  fs.writeFileSync(path.join(GOLDEN, 'legacy-codes.json'), JSON.stringify({
    note: 'Save codes in every format the game reads. "restores" is the state held after LOAD of the code in a fresh game with another seed. Recorded by tools/record-goldens.mjs.',
    source: SOURCE_LABEL,
    codes,
  }, null, 1) + '\n');
  console.log(`  ${codes.length} codes: ${[...new Set(codes.map((c) => c.format))].join(', ')}`);

  console.log('World hashes');
  const host = load(TARGET, { seed: 'hash-host' });
  const rows = [];
  for (let i = 1; i <= SWEEP_SIZE; i++) rows.push(`  ${J(sweepSeed(i))}: ${J(worldSignature(host, sweepSeed(i)))}`);
  fs.writeFileSync(path.join(GOLDEN, 'world-hashes.json'), [
    '{',
    '  "_note": "Per sweep seed: [hash of the 400 terrain glyphs + towns + capital, start x, start y]. The hash is the first 16 hex digits of a SHA-256. Recorded by tools/record-goldens.mjs.",',
    `  "_source": ${J(SOURCE_LABEL)},`,
    rows.join(',\n'),
    '}',
    '',
  ].join('\n'));
  console.log(`  ${rows.length} seeds`);

  const endings = written.map((t) => (t.log.find(([, x]) => x.startsWith('Ending: ')) || [])[1]).filter(Boolean);
  console.log(`Done: ${written.length} transcripts; endings recorded: ${[...new Set(endings)].join(', ')}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
