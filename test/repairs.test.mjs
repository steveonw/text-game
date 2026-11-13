// M2: one test per repaired defect, named for its ID in docs/SPEC.md section 3.
// Each plays the modules directly and checks the behaviour the repair promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, screenText, nearest, walkTo, localTo } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { isTownAt, tileAt, finalTileAt, keyForXY } from '../src/world.js';
import { dogIsVeryNear } from '../src/trail.js';
import { dates } from '../src/clock.js';
import { generateTown, generateWilderness } from '../src/local.js';
import { mapHtml } from '../src/render.js';
import { noise01 } from '../src/rng.js';
import { TUNE } from '../src/tuning.js';
import { pickMany, sayNPC } from '../src/people.js';
import { BUILDING_POOLS, CABBAGE, EVENT_OVERLAYS, PEOPLE, TOPIC_FALLBACKS } from '../src/content/pools.js';
import { cabbageIsHereWorld } from '../src/clock.js';

const mapRows = () => mapHtml().replace(/<[^>]*>/g, '').replace(/\n$/, '').split('\n');
const STORY_DONE = 'The story is done. (LOAD <password> to continue elsewhere.)';
const isNaturalRuin = (x, y) => tileAt(x, y) === 'R' && !isTownAt(x, y);
const isDogTile = (x, y) => ['.', 'F'].includes(finalTileAt(x, y)) && dogIsVeryNear(x, y) && !!generateWilderness(x, y).dog;

// Walk to the nearest dog tile, enter, and stand on the dog. Returns nothing; G.local.dog is under the player.
function standOnDog() {
  const t = nearest((x, y) => isDogTile(x, y));
  assert.ok(t, 'a dog tile is reachable');
  walkTo(t.x, t.y); say('ENTER');
  assert.ok(localTo(G.local.dog.x, G.local.dog.y));
}

test('D19: NEW typed inside a town opens the new world on the world map', () => {
  bootModules('newlocal-1');
  const t = nearest((x, y) => isTownAt(x, y));
  walkTo(t.x, t.y); say('ENTER');
  assert.equal(G.mode, 'LOCAL');
  const out = say('NEW other');
  assert.ok(out.includes('World seeded: other'));
  assert.equal(G.mode, 'WORLD');
  assert.equal(G.local, null);
  assert.equal(mapRows().length, 20, 'the world map is drawn');
  assert.deepEqual(say('EXIT'), ['> EXIT', 'Not here.']);
  // from a wilderness map too
  const w = nearest((x, y) => ['.', 'F'].includes(finalTileAt(x, y)));
  walkTo(w.x, w.y); say('ENTER'); assert.equal(G.mode, 'LOCAL');
  say('NEW third'); assert.equal(G.mode, 'WORLD'); assert.equal(G.local, null);
});

test('D1: after an ending, NEW starts a game, HELP answers, and LOAD takes the code SAVE printed', () => {
  bootModules('reunion-2');
  standOnDog();
  const code = say('SAVE').at(-1);
  const saved = { x: G.player.x, y: G.player.y, steps: G.steps, seed: G.seed };
  assert.ok(say('CALL').some((l) => l.startsWith('Ending: ')));
  assert.equal(G.mode, 'END');

  // everything else is still refused
  for (const c of ['LOOK', 'N', 'SAVE', 'TALK', 'WAIT']) assert.deepEqual(say(c), ['> ' + c, STORY_DONE]);
  assert.equal(G.mode, 'END');
  // HELP answers
  assert.ok(say('HELP').includes('Commands:'));
  assert.equal(G.mode, 'END');
  // LOAD of the packed code SAVE just printed
  assert.deepEqual(say('LOAD ' + code).slice(1), ['The password takes.']);
  assert.equal(G.mode, 'WORLD');
  assert.deepEqual({ x: G.player.x, y: G.player.y, steps: G.steps, seed: G.seed }, saved);

  // end the game again, then NEW
  say('ENTER'); localTo(G.local.dog.x, G.local.dog.y); say('CALL');
  assert.equal(G.mode, 'END');
  const out = say('NEW abc');
  assert.ok(out.includes('World seeded: abc'));
  assert.equal(G.mode, 'WORLD');
  assert.equal(G.steps, 0);
  assert.ok(say('LOOK').length >= 2);

  // a refused code leaves the ending in place
  bootModules('reunion-2'); standOnDog(); say('CALL');
  assert.deepEqual(say('LOAD not-a-code').slice(1), ['The password refuses to settle.']); // M6: a well-formed code that does not check out
  assert.deepEqual(say('LOAD not a code!').slice(1), ['Invalid password.']);
  assert.equal(G.mode, 'END');
});

test('D17: DEBUG and BLOCK answer only when the page was opened with ?debug=1', () => {
  bootModules('debug-1');
  assert.deepEqual(say('DEBUG'), ['> DEBUG', 'Nothing comes of that.']);
  assert.deepEqual(say('BLOCK'), ['> BLOCK', 'Nothing comes of that.']);
  assert.equal([...G.worldEvents].filter((e) => e.startsWith('road_blocked_')).length, 0, 'no road was blocked');
  assert.deepEqual(say('xyzzy'), ['> xyzzy', 'Nothing comes of that.'], 'the same answer as any unknown word');

  bootModules('debug-1', { debug: true });
  assert.ok(say('DEBUG').some((l) => l.startsWith('Seed: ')));
  assert.deepEqual(say('BLOCK'), ['> BLOCK', 'Someone sets a barricade on the road.']);
  assert.ok(G.worldEvents.has('road_blocked_' + keyForXY(G.player.x, G.player.y)));
});

test('D6: natural ruins open as open ground, not a walled town; a burned town and the fallen capital still open as towns', () => {
  bootModules('ruins-1');
  const r = nearest((x, y) => isNaturalRuin(x, y));
  assert.ok(r, 'a natural ruins tile is reachable');
  walkTo(r.x, r.y);
  assert.ok(say('LOOK').includes('Old stones. A place avoided.'));
  const out = say('ENTER');
  assert.ok(out.includes('The land closes around you.'));
  assert.ok(!out.includes('Buildings gather. The road narrows.'));
  assert.equal(G.local.kind, 'RUIN'); // M2 opened them as wilderness; M4 gave them a map of their own
  assert.ok(!mapRows().join('').includes('#'), 'no walls');
  assert.ok(!/[IMSTGw]/.test(mapRows().join('')), 'no buildings and no wagon');
  say('EXIT');

  // the other two kinds of R are towns
  const town = G.towns.find((t) => !(t.x === G.capital.x && t.y === G.capital.y));
  G.worldEvents.add('burned_' + keyForXY(town.x, town.y));
  G.worldEvents.add('capital_fallen');
  for (const t of [town, G.capital]) {
    G.player.x = t.x; G.player.y = t.y;
    assert.equal(finalTileAt(t.x, t.y), 'R');
    assert.ok(say('ENTER').includes('Buildings gather. The road narrows.'));
    assert.equal(G.local.kind, 'TOWN');
    say('EXIT');
  }
});

test('D2: every town building has its own slot; the guard post no longer overwrites the smithy', () => {
  const SLOT = { I: [2, 2], M: [6, 2], S: [2, 6], T: [6, 6], G: [7, 4] };
  const rolled = (t) => 'IMSTG'.split('').filter((b, i) => noise01(t.x * 10 + i, t.y * 10 + i, G.seed ^ 0x0B11D) > TUNE.buildingAbove);
  let towns = 0, both = 0;
  for (let n = 1; n <= 300; n++) {
    bootModules('sweep-' + n);
    for (const t of G.towns) {
      towns++;
      const here = rolled(t), map = generateTown(t.x, t.y, false).map;
      for (const b of 'IMSTG') {
        const [x, y] = SLOT[b];
        assert.equal(map[y][x], here.includes(b) ? b : (b === 'G' ? '|' : '.'), `sweep-${n} town ${t.x},${t.y}: slot of ${b}`);
      }
      assert.equal(map.flat().filter((c) => 'IMSTG'.includes(c)).length, here.length, 'no building anywhere else');
      if (here.includes('S') && here.includes('G')) both++;
      // sickness removes the market and moves nothing
      G.worldEvents.add('plague_' + keyForXY(t.x, t.y));
      const sick = generateTown(t.x, t.y, false).map;
      for (const b of 'ISTG') { const [x, y] = SLOT[b]; assert.equal(sick[y][x], map[y][x], `sweep-${n}: ${b} stays put in a sick town`); }
      assert.equal(sick[2][6], '.', 'no market in a sick town');
      G.worldEvents.delete('plague_' + keyForXY(t.x, t.y));
    }
  }
  assert.ok(towns > 900 && both > 300, `checked ${towns} towns, ${both} with both smith and guard`);
});

test('D7: the fallen capital is burned inside, like any burned town', () => {
  let checked = 0;
  for (let n = 1; n <= 60; n++) {
    bootModules('sweep-' + n);
    const c = G.capital;
    const before = generateTown(c.x, c.y, false).map.flat();
    const stood = before.filter((b) => 'MSTG'.includes(b)).length; // the inn is not drawn in a burned town (v13)
    G.worldEvents.add('capital_fallen');
    const town = generateTown(c.x, c.y, false);
    const cells = town.map.flat();
    assert.ok(!cells.some((b) => 'IMSTG'.includes(b)), `sweep-${n}: no building stands`);
    assert.equal(cells.filter((b) => b === 'r').length, stood, `sweep-${n}: each building that stood is burned timbers`);
    assert.ok(!town.npcs.some((p) => 'IMSTG'.includes(p.type)), 'no staff');
    // another town is untouched by the capital's fall
    const other = G.towns.find((t) => !(t.x === c.x && t.y === c.y));
    assert.ok(!generateTown(other.x, other.y, false).map.flat().includes('r'));
    checked++;
  }
  assert.equal(checked, 60);
});

test('D3: TALK and ASK need someone on the tile', () => {
  bootModules('nobody-1');
  const empty = nearest((x, y) => { if (!['.', 'F'].includes(finalTileAt(x, y))) return false; const w = generateWilderness(x, y); return !w.dog && w.npcs.length === 0; });
  walkTo(empty.x, empty.y); say('ENTER');
  assert.deepEqual(say('TALK'), ['> TALK', 'No one to speak with here.']);
  assert.deepEqual(say('ASK DOG'), ['> ASK DOG', 'There is no one to ask.']);
  assert.deepEqual(say('ASK ROAD'), ['> ASK ROAD', 'There is no one to ask.']);
  assert.equal(Object.keys(G.npcMemory).length, 0, 'nobody is remembered');
  assert.equal(G.player.rep, 0, 'no reputation is earned');
  // the topic is still checked first
  assert.deepEqual(say('ASK'), ['> ASK', 'Ask about what?']);
  assert.deepEqual(say('ASK CABBAGE'), ['> ASK CABBAGE', 'No one understands that word.']);
  say('EXIT');
  // on the world map ASK DOG keeps its v13 answer
  assert.equal(say('ASK DOG')[1], 'You call softly. The wind answers.');

  // a wanderer who is there answers
  const met = nearest((x, y) => { if (!['.', 'F'].includes(finalTileAt(x, y))) return false; const w = generateWilderness(x, y); return !w.dog && w.npcs.length === 1; });
  walkTo(met.x, met.y); say('ENTER');
  assert.deepEqual(say('TALK'), ['> TALK', 'No one to speak with here.'], 'not from across the field');
  const who = G.local.npcs[0]; localTo(who.x, who.y);
  assert.match(say('TALK')[1], /^Wanderer \((ROAD|DOG)\):$/);
  assert.equal(Object.keys(G.npcMemory).length, 1);
  say('EXIT');

  // in a town: nobody at the crossing unless the townsperson stands there; staff at their buildings
  const t = nearest((x, y) => { if (!isTownAt(x, y)) return false; const town = generateTown(x, y, false); return town.map[2][2] === 'I' && !town.npcs.some((p) => p.x === 4 && p.y === 4); });
  walkTo(t.x, t.y); say('ENTER');
  assert.deepEqual(say('TALK'), ['> TALK', 'No one to speak with here.']);
  localTo(2, 2);
  assert.match(say('TALK')[1], /^Innkeeper \((ROAD|DOG)\):$/);
  assert.match(say('ASK ROAD')[1], /^Innkeeper \(ROAD\):$/);
});

test('D3: a burned town keeps one Survivor, standing at its first burned building', () => {
  let withSurvivor = 0;
  for (let n = 1; n <= 80; n++) {
    bootModules('sweep-' + n);
    const town = G.towns.find((t) => !(t.x === G.capital.x && t.y === G.capital.y));
    G.worldEvents.add('burned_' + keyForXY(town.x, town.y));
    const map = generateTown(town.x, town.y, false);
    const onTimbers = map.npcs.filter((p) => map.map[p.y][p.x] === 'r');
    const timbers = map.map.flat().filter((c) => c === 'r').length;
    assert.equal(onTimbers.length, timbers > 0 ? 1 : 0, `sweep-${n}: one Survivor when anything burned`);
    if (!timbers) continue;
    withSurvivor++;
    G.player.x = town.x; G.player.y = town.y; say('ENTER');
    const s = G.local.npcs.find((p) => G.local.map[p.y][p.x] === 'r');
    localTo(s.x, s.y);
    assert.match(say('TALK')[1], /^Survivor \((ROAD|DOG)\):$/);
    assert.ok(mapRows()[s.y] !== undefined);
    // another burned building, if there is one, is empty
    for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) {
      if (G.local.map[y][x] === 'r' && !(x === s.x && y === s.y)) { localTo(x, y); assert.deepEqual(say('TALK'), ['> TALK', 'No one to speak with here.']); }
    }
    say('EXIT');
  }
  assert.ok(withSurvivor > 60);
});

// Split what a command logged into replies: each starts at a "Name (TOPIC):" tag.
const afterTag = (lines) => { const i = lines.findIndex((l) => /^[A-Z][A-Za-z ]* \([A-Z]+\):$/.test(l)); assert.ok(i >= 0, 'a name tag was logged'); return lines.slice(i + 1).filter((l) => !l.startsWith('(A gesture: ')); };

test('D4: a speaker never falls silent, and never says one line twice in a reply', () => {
  bootModules('talk-1');
  const t = nearest((x, y) => isTownAt(x, y) && generateTown(x, y, false).map[2][2] === 'I');
  walkTo(t.x, t.y); say('ENTER'); localTo(2, 2);
  for (let i = 1; i <= 6; i++) {
    const said = afterTag(say('TALK'));
    assert.ok(said.length >= 3, `TALK ${i}: an opener, a line and a close (got ${said.length})`);
    assert.equal(new Set(said).size, said.length, `TALK ${i}: no line twice`);
  }
  for (const topic of ['ROAD', 'ROAD', 'DOG', 'DOG', 'ROAD', 'DOG']) {
    const said = afterTag(say('ASK ' + topic));
    assert.ok(said.length >= 1, `ASK ${topic}: at least one line`);
    assert.equal(new Set(said).size, said.length, `ASK ${topic}: no line twice`);
  }

  // the picker itself: a pool smaller than the window still answers, oldest line first
  const pool = [{ t: 'one', v: [0, 0, 0, 0, 0] }, { t: 'two', v: [0, 0, 0, 0, 0] }];
  G.recentFragments = ['two', 'x', 'one', 'y'];
  assert.deepEqual(pickMany(pool, [0, 0, 0, 0, 0], 1), ['two'], 'the line shown longest ago');
  G.recentFragments = ['one', 'two'];
  assert.deepEqual(pickMany(pool, [0, 0, 0, 0, 0], 3), ['one', 'two'], 'a pool of two gives two lines, not a repeat');
  assert.deepEqual(pickMany([], [0, 0, 0, 0, 0], 2), []);
});

test('D5: every topic is answered from its own lines, never from ROAD', () => {
  const texts = (list) => list.map((f) => f.t);
  for (const role of ['I', 'M', 'S', 'T', 'G', '.']) {
    const road = texts(BUILDING_POOLS[role].road);
    for (const topic of ['TOWN', 'WAR', 'SICKNESS', 'WORK']) {
      bootModules('ask-2');
      const said = sayNPC(role, topic, { bodyLines: 2, overlayCap: 0, frame: false });
      // M5 gave every role its own lines for these topics; TOPIC_FALLBACKS lies beneath them.
      const own = texts(PEOPLE[role][topic.toLowerCase()]);
      assert.ok(said.length >= 1, `${role} ${topic}: something is said`);
      for (const line of said) {
        assert.ok(own.includes(line), `${role} ${topic}: "${line}" is a ${topic} line`);
        assert.ok(!road.includes(line), `${role} ${topic}: "${line}" is not a ROAD line`);
      }
    }
    for (const topic of ['DOG', 'ROAD', 'ROUTES']) {
      bootModules('ask-2');
      const own = texts([...BUILDING_POOLS[role][topic.toLowerCase()], ...PEOPLE[role].earned[topic.toLowerCase()]]);
      for (const line of sayNPC(role, topic, { bodyLines: 2, overlayCap: 0, frame: false })) assert.ok(own.includes(line), `${role} ${topic}: "${line}" is the role's own`);
    }
  }
  // and through the command, at an inn
  bootModules('talk-1');
  const t = nearest((x, y) => isTownAt(x, y) && generateTown(x, y, false).map[2][2] === 'I');
  walkTo(t.x, t.y); say('ENTER'); localTo(2, 2);
  const out = say('ASK TOWN');
  assert.equal(out[1], 'Innkeeper (TOWN):');
  const innRoad = texts(BUILDING_POOLS.I.road), townLines = texts(PEOPLE.I.town);
  // The walk to town crosses sign, so the routes may be stirring and one overlay line may ride along.
  const overlays = Object.values(EVENT_OVERLAYS).flatMap((o) => o.inject.map((f) => f.t));
  const body = afterTag(out).filter((line) => !overlays.includes(line));
  assert.ok(body.length >= 1);
  for (const line of body) { assert.ok(townLines.includes(line), line); assert.ok(!innRoad.includes(line), line); }
});

// The first step at which v13's war roll comes up for the current seed.
test('D10: REST does not skip the clock for the steps it passes', () => {
  // The war starts on its date even when that step is the first of the two a REST takes.
  for (const seed of ['d10-1', 'd10-2', 'd10-3', 'd10-4', 'd10-5']) {
    bootModules(seed);
    const s = dates().war;
    say('ENTER');
    while (G.steps < s - 1) say('WAIT');
    assert.ok(!G.worldEvents.has('war_started'));
    const out = say('REST');
    assert.equal(G.steps, s + 1, 'REST still costs two steps');
    assert.ok(G.worldEvents.has('war_started'), `${seed}: war started on step ${s}, inside the rest`);
    assert.equal(out.filter((l) => l === 'Soldiers begin to appear on the roads.').length, 1);
  }
});

// Stand at the wagon in the merchant's first stop, having talked to him twice, tired enough to be offered a ride.
// waits: steps to idle inside the town first, so that his timetable can move on without him.
function atTheWagon(seed, waits = 0) {
  bootModules(seed);
  const stop = G.cabbageRoute[0];
  G.player.x = stop.x; G.player.y = stop.y;     // at step 0 the timetable has him at his first stop
  say('ENTER');
  assert.ok(G.local.wagon, 'the wagon is here');
  for (let i = 0; i < waits; i++) say('WAIT');
  G.player.fatigue = 3;
  assert.ok(localTo(1, 4));
  return stop;
}

test('D8: the ride is told on the page, not erased as it is written', () => {
  atTheWagon('ride-1');
  say('TALK'); say('TALK');
  const out = say('RIDE');
  const told = ['You climb onto the wagon.', 'Cabbages shift beneath the weight.', 'The road becomes a rhythm.', 'He complains the whole way.', 'You rest.'];
  assert.ok(out.includes('The wagon stops.'), 'the ride happened');
  const page = screenText();
  assert.deepEqual(page.slice(0, 5), told, 'the five lines of the ride are on the page');
  assert.deepEqual(page.slice(-2), ['The wagon stops.', 'Right. Here we are.']);
  assert.ok(!page.includes('> RIDE'), 'the page was cleared first');
});

test('D9: the merchant stays with his wagon while the player is in town, and rides on to his next stop', () => {
  let checked = 0, shortRoutes = 0;
  for (const seed of ['wagon-1', 'ride-1', 'sweep-3', 'sweep-11', 'sweep-17', 'sweep-29']) {
    const stop = atTheWagon(seed, 6);            // six idle steps and three to walk: his 7-step stop is over
    assert.ok(!cabbageIsHereWorld(stop.x, stop.y), `${seed}: by the timetable he has moved on`);
    assert.equal(G.local.map[4][1], 'w');
    const first = say('TALK');
    assert.ok(CABBAGE.openers.includes(first[1]), `${seed}: the merchant himself answers (got "${first[1]}")`);
    assert.ok(say('TALK').includes('(Type RIDE.)'), `${seed}: the ride is offered`);
    assert.ok(say('RIDE').includes('The wagon stops.'), `${seed}: and given`);
    const route = G.cabbageRoute, next = route[1 % route.length];
    assert.deepEqual([G.player.x, G.player.y], [next.x, next.y], `${seed}: to the stop after this one`);
    assert.ok(!(G.player.x === stop.x && G.player.y === stop.y), `${seed}: never back to the same town`);
    assert.equal(G.mode, 'LOCAL');
    assert.ok(G.local.wagon);
    if (route.length === 2) shortRoutes++;
    checked++;
  }
  assert.equal(checked, 6);
  assert.ok(shortRoutes >= 1, 'covers a two-town route, where v13 could ride from a town to itself');
});
