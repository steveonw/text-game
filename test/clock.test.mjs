// M4: the clock. Each test plays the modules directly and checks one thing the M4
// sheet promises. The sweep-wide gates are in test/bundle.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, walkTo, localTo, nearest } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { TUNE, WORLD_SIZE } from '../src/tuning.js';
import { finalTileAt, isTownAt, keyForXY, passable, stepsFrom, tileAt } from '../src/world.js';
import { dogTile, trail } from '../src/trail.js';
import { cabbageTown, closedRoads, dates, nextWagonStop, stage, wagonStops } from '../src/clock.js';
import { generateRuin } from '../src/local.js';
import { enterKind } from '../src/commands.js';
import { mapHtml, statusText } from '../src/render.js';
import { OMENS, OPEN_GATE, ROAD_CLOSED_RUMOR, STATUS_GUARDED, STONES } from '../src/content/pools.js';

const SEEDS = ['clock-1', 'clock-2', 'clock-3', 'clock-4', 'clock-5', 'clock-6', 'sweep-1', 'sweep-99', 'sweep-762'];
const N = WORLD_SIZE;
const at = (x, y) => y * N + x;
const mapRows = () => mapHtml().replace(/<[^>]*>/g, '').replace(/\n$/, '').split('\n');
const isNaturalRuin = (x, y) => tileAt(x, y) === 'R' && !isTownAt(x, y);
const WAR = 'Soldiers begin to appear on the roads.';
const FALL = 'Word arrives late, like bad weather: the capital has fallen.';
const STIR = 'Animals have been restless. You feel it in the roads.';

// WAIT until the step counter reads `step`. Returns every line logged on the way, with the step it came on.
function waitUntil(step) {
  const lines = [];
  while (G.steps < step && G.mode !== 'END') for (const l of say('WAIT').slice(1)) lines.push([G.steps, l]);
  return lines;
}

test('dates: war from step 30 to 50, the fall 25 to 40 after it, the change 25 to 40 after that; the same every time', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const d = dates();
    assert.ok(d.war >= 30 && d.war <= 50, `${seed}: war on ${d.war}`);
    assert.ok(d.fall - d.war >= 25 && d.fall - d.war <= 40, `${seed}: fall ${d.fall - d.war} after`);
    assert.ok(d.change - d.fall >= 25 && d.change - d.fall <= 40, `${seed}: change ${d.change - d.fall} after`);
    G.steps = 77; G.worldEvents.add('war_started'); G.player.fatigue = 5;
    assert.deepEqual(dates(), d, 'nothing in a game moves a date');
  }
});

test('stages: each change comes on its date, announced with v13\'s line, and the status word follows', () => {
  for (const seed of ['clock-1', 'clock-2', 'sweep-99']) {
    bootModules(seed);
    const d = dates();
    assert.equal(stage(), 0);
    assert.ok(statusText().includes('Roads: quiet'));
    assert.deepEqual(say('STATUS').slice(2), ['The day feels ordinary.']);

    let lines = waitUntil(TUNE.stirByStep);
    assert.deepEqual(lines.filter(([, l]) => l === STIR).map(([s]) => s), [TUNE.stirByStep], `${seed}: stirring by step 24 with no sign found`);
    assert.equal(stage(), 1);
    assert.ok(statusText().includes('Roads: unsettled'));
    assert.deepEqual(say('STATUS').slice(2), ['The roads feel unsettled.']);

    lines = waitUntil(d.war);
    assert.deepEqual(lines.filter(([, l]) => l === WAR).map(([s]) => s), [d.war], seed);
    assert.equal(stage(), 2);
    assert.ok(statusText().includes('Roads: guarded'));
    assert.deepEqual(say('STATUS').slice(2), [STATUS_GUARDED]);

    lines = waitUntil(d.fall);
    assert.deepEqual(lines.filter(([, l]) => l === FALL).map(([s]) => s), [d.fall], seed);
    assert.equal(stage(), 3);
    assert.ok(statusText().includes('Roads: hollow'));
    assert.deepEqual(say('STATUS').slice(2), ['The kingdom feels hollow.']);

    lines = waitUntil(d.change + 5);
    assert.equal(G.mode, 'END');
    assert.equal(G.steps, d.change, `${seed}: the story ends on the change date`);
    assert.ok(lines.some(([s, l]) => s === d.change && l === 'Ending: The Open Gate'));
    assert.ok(OPEN_GATE.filter(Boolean).every((g) => lines.some(([, l]) => l === g)));
    assert.ok(lines.some(([, l]) => l === 'Steps taken: ' + d.change));
    assert.equal(stage(), 4);
  }
});

test('stirring still comes with the third sign tile when that is sooner', () => {
  bootModules('trail-1');
  const t = trail();
  for (let i = 1; i <= 3; i++) {
    const a = t.tiles[i - 1], b = t.tiles[i];
    say(b.x > a.x ? 'E' : b.x < a.x ? 'W' : b.y > a.y ? 'S' : 'N');
  }
  assert.ok(G.steps < TUNE.stirByStep && G.worldEvents.has('routes_stirring'));
  const lines = waitUntil(TUNE.stirByStep + 1);
  assert.ok(!lines.some(([, l]) => l === STIR), 'not announced a second time');
});

test('foreshadowing: one line in the eight steps before each change, and no other', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const d = dates();
    const lines = waitUntil(d.change + 1);
    for (const [kind, date] of [['war', d.war], ['fall', d.fall], ['change', d.change]]) {
      const seen = lines.filter(([, l]) => OMENS[kind].includes(l));
      assert.equal(seen.length, 1, `${seed}: one ${kind} omen`);
      assert.ok(seen[0][0] >= date - TUNE.omenWithin && seen[0][0] < date, `${seed}: ${kind} omen on step ${seen[0][0]}, date ${date}`);
    }
  }
});

test('fatigue is time: a world move at fatigue 5 takes two steps; at fatigue 4, one', () => {
  bootModules('clock-1');
  const step = () => { const n = [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'S'], [0, -1, 'N']].find(([dx, dy]) => passable(G.player.x + dx, G.player.y + dy)); return say(n[2]); };
  G.player.fatigue = 4;
  let before = G.steps; step();
  assert.equal(G.steps - before, 1, 'at fatigue 4');
  assert.equal(G.player.fatigue, 5);
  before = G.steps; step();
  assert.equal(G.steps - before, 2, 'at fatigue 5');
  // inside a local map a move is always one step
  say('ENTER');
  if (G.mode === 'LOCAL') { G.player.fatigue = 5; before = G.steps; say('N'); assert.equal(G.steps - before, 1, 'local moves are not charged'); }
});

test('fatigue is time: the clock is read on both steps of a tired move', () => {
  bootModules('clock-1');
  const d = dates();
  waitUntil(d.war - 1);
  G.player.fatigue = 5;
  const n = [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'S'], [0, -1, 'N']].find(([dx, dy]) => passable(G.player.x + dx, G.player.y + dy));
  const out = say(n[2]);
  assert.equal(G.steps, d.war + 1);
  assert.ok(out.includes(WAR), 'the war started on the first of the two steps');
});

test('REST and RIDE across a date fire the change on the right step', () => {
  // REST across the last date: the story ends on the date, not a step later.
  bootModules('clock-2');
  const d = dates();
  say('ENTER');
  waitUntil(d.change - 1);
  assert.equal(G.mode, 'LOCAL');
  const out = say('REST');
  assert.equal(G.mode, 'END');
  assert.equal(G.steps, d.change);
  assert.ok(out.includes('Steps taken: ' + d.change));

  // RIDE across the war date: three steps, and the war starts on its own step, in the middle.
  bootModules('ride-1');
  const w = dates().war;
  const stop = G.cabbageRoute[0];
  G.player.x = stop.x; G.player.y = stop.y;
  say('ENTER');
  assert.ok(G.local.wagon, 'the wagon is here');
  localTo(1, 4);
  say('TALK'); say('TALK');
  waitUntil(w - 2);
  G.player.fatigue = 3;
  const ride = say('RIDE');
  assert.ok(ride.includes('The wagon stops.'), 'the ride happened');
  assert.equal(G.steps, w + 1);
  assert.equal(ride.filter((l) => l === WAR).length, 1);
  assert.ok(ride.indexOf(WAR) > ride.indexOf('You rest.') && ride.indexOf(WAR) < ride.indexOf('The wagon stops.'), 'announced during the ride');

  // RIDE across the last date: the story ends on the way and the wagon never stops.
  bootModules('ride-1');
  const c = dates().change;
  G.player.x = stop.x; G.player.y = stop.y;
  say('ENTER'); localTo(1, 4); say('TALK'); say('TALK');
  waitUntil(c - 2);
  G.player.fatigue = 3;
  const last = say('RIDE');
  assert.equal(G.mode, 'END');
  assert.equal(G.steps, c);
  assert.ok(last.includes('Ending: The Open Gate') && !last.includes('The wagon stops.'));
});

test('closures: from the war on, one road every 18th step, six at most, each announced', () => {
  for (const seed of ['clock-1', 'clock-3', 'sweep-1']) {
    bootModules(seed);
    const d = dates();
    const lines = waitUntil(d.change - 1);
    const rumors = lines.filter(([, l]) => l === ROAD_CLOSED_RUMOR);
    assert.equal(rumors.length, closedRoads(), `${seed}: one rumor for each closed road`);
    assert.ok(closedRoads() >= 1 && closedRoads() <= TUNE.maxClosures, `${seed}: ${closedRoads()} roads closed`);
    for (const [s] of rumors) assert.ok(s >= d.war && s % TUNE.closeEverySteps === 0, `${seed}: a road closed on step ${s}`);
    // a closed road is drawn as # and cannot be walked
    const closed = [...G.worldEvents].filter((e) => e.startsWith('road_blocked_')).map((e) => e.slice(13).split('_').map(Number));
    for (const [x, y] of closed) { assert.equal(finalTileAt(x, y), '#'); assert.ok(!passable(x, y)); assert.equal(mapRows()[y][x], '#'); }
  }
});

test('closures: never a town, the player\'s tile, a den or the threshold, and nothing in reach is cut off', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail(), d = dates();
    const reachBefore = stepsFrom(G.player.x, G.player.y, passable);
    waitUntil(d.change - 1);
    const closed = new Set([...G.worldEvents].filter((e) => e.startsWith('road_blocked_')).map((e) => { const [x, y] = e.slice(13).split('_').map(Number); return at(x, y); }));
    for (const i of closed) {
      const x = i % N, y = (i / N) | 0;
      assert.ok(!isTownAt(x, y), `${seed}: a town was closed`);
      assert.ok(!(x === G.player.x && y === G.player.y), `${seed}: the player's tile was closed`);
      for (const k of [t.den1, t.den2, t.threshold]) assert.ok(!(t.tiles[k].x === x && t.tiles[k].y === y), `${seed}: a den or the threshold was closed`);
    }
    const reachAfter = stepsFrom(G.player.x, G.player.y, passable);
    for (let i = 0; i < reachBefore.length; i++) if (reachBefore[i] >= 0 && !closed.has(i)) assert.ok(reachAfter[i] >= 0, `${seed}: (${i % N},${(i / N) | 0}) was cut off`);
    assert.ok(reachAfter[at(dogTile().x, dogTile().y)] >= 0, `${seed}: the dog can still be reached`);
  }
});

test('closures: the trail does not move', () => {
  bootModules('clock-1');
  const before = trail().tiles.map((p) => [p.x, p.y]);
  waitUntil(dates().change - 1);
  assert.ok(closedRoads() >= 1);
  assert.deepEqual(trail().tiles.map((p) => [p.x, p.y]), before);
});

test('sickness: the wagon skips a sick town, and the route is never empty', () => {
  bootModules('clock-1');
  assert.ok(G.cabbageRoute.length >= 2, 'a route of two towns or more');
  const sick = G.cabbageRoute[1];
  G.worldEvents.add('plague_' + keyForXY(sick.x, sick.y));
  assert.ok(!wagonStops().some((t) => t.x === sick.x && t.y === sick.y));
  for (let s = 0; s < 200; s++) {
    G.steps = s;
    const stop = cabbageTown();
    assert.ok(!(stop.x === sick.x && stop.y === sick.y), `step ${s}: the wagon is in the sick town`);
    for (const from of G.cabbageRoute) {
      const next = nextWagonStop(from.x, from.y);
      assert.ok(!(next.x === sick.x && next.y === sick.y), `step ${s}: the next stop is the sick town`);
    }
  }
  // sickness everywhere: he keeps his whole route
  for (const t of G.cabbageRoute) G.worldEvents.add('plague_' + keyForXY(t.x, t.y));
  assert.equal(wagonStops().length, G.cabbageRoute.length);
  assert.ok(cabbageTown());
});

test('sickness: REST in a sick town restores 1, in a well town 3', () => {
  bootModules('clock-1');
  const town = G.towns[0];
  assert.ok(walkTo(town.x, town.y));
  say('ENTER');
  G.player.fatigue = 5;
  say('REST');
  assert.equal(G.player.fatigue, 5 - TUNE.restTownRecovers);
  say('EXIT');
  G.worldEvents.add('plague_' + keyForXY(town.x, town.y));
  say('ENTER');
  G.player.fatigue = 5;
  say('REST');
  assert.equal(G.player.fatigue, 5 - TUNE.restSickTownRecovers);
  assert.equal(TUNE.restSickTownRecovers, 1);
});

test('ruin maps: natural ruins open with no walls, no buildings and no one; five to nine stones', () => {
  let seen = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const r = nearest((x, y) => isNaturalRuin(x, y) && !(trail().tiles[trail().threshold].x === x && trail().tiles[trail().threshold].y === y));
    if (!r) continue;
    seen++;
    assert.equal(enterKind(r.x, r.y), 'RUIN');
    assert.ok(walkTo(r.x, r.y));
    assert.deepEqual(say('ENTER').slice(1), ['The land closes around you.']);
    assert.equal(G.local.kind, 'RUIN');
    const cells = mapRows().join('');
    assert.ok(!cells.includes('#') && !/[IMSTGwpd]/.test(cells), `${seed}: no walls, buildings, people or dog`);
    const stones = G.local.map.flat().filter((c) => c === 'r' || c === '^').length;
    assert.ok(stones >= TUNE.ruinStonesFrom && stones <= TUNE.ruinStonesTo, `${seed}: ${stones} stones`);
    assert.equal(G.local.map.flat().filter((c) => !['.', 'r', '^'].includes(c)).length, 0, 'only ground and stones');
    assert.deepEqual(say('TALK').slice(1), ['No one to speak with here.']);
    assert.deepEqual(say('LOOK').slice(1), [STONES['.']]);
    const stone = (() => { for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (G.local.map[y][x] !== '.') return { x, y, c: G.local.map[y][x] }; })();
    localTo(stone.x, stone.y);
    assert.deepEqual(say('LOOK').slice(1), [STONES[stone.c]]);
    assert.deepEqual(generateRuin(r.x, r.y).map, G.local.map, 'the same stones every visit');
  }
  assert.ok(seen >= 4, `${seen} seeds with a natural ruin in reach`);
});

test('the threshold: a ruin map whatever its ground, empty until the capital falls, then the dog at a stone', () => {
  let open = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail(), end = t.tiles[t.threshold];
    if (!t.onRuins) open++;
    assert.equal(enterKind(end.x, end.y), 'RUIN', seed);
    assert.equal(generateRuin(end.x, end.y).dog, null, `${seed}: no dog there in the quiet`);
    G.worldEvents.add('war_started');
    assert.equal(generateRuin(end.x, end.y).dog, null, `${seed}: none during the war`);
    G.worldEvents.add('capital_fallen');
    const m = generateRuin(end.x, end.y);
    assert.ok(m.dog, `${seed}: the dog is there once the capital has fallen`);
    assert.ok(['r', '^'].includes(m.map[m.dog.y][m.dog.x]), `${seed}: at a stone`);
    assert.deepEqual(generateRuin(end.x, end.y).dog, m.dog, 'the same stone every visit');
  }
  assert.ok(open >= 1, 'a threshold on plains or forest is covered');
});

test('the end: after the roads change, NEW and LOAD still work', () => {
  bootModules('clock-3');
  const code = say('SAVE').at(-1);
  waitUntil(dates().change + 1);
  assert.equal(G.mode, 'END');
  assert.deepEqual(say('LOOK').slice(1), ['The story is done. (LOAD <password> to continue elsewhere.)']);
  assert.ok(say('LOAD ' + code).includes('The password takes.'));
  assert.equal(G.mode, 'WORLD');
  assert.equal(G.steps, 0);
  say('WAIT');
  assert.equal(G.mode, 'WORLD', 'the loaded game goes on');
});

test('old codes: a v13 save past a date catches up on the next step, in order', () => {
  bootModules('clock-4');
  const d = dates();
  G.steps = d.fall + 3; G.lastPressureStep = G.steps; // as a v13 code might load: late, and nothing has happened
  assert.equal(stage(), 0);
  const out = say('WAIT');
  assert.ok(out.indexOf(STIR) >= 0 && out.indexOf(WAR) > out.indexOf(STIR) && out.indexOf(FALL) > out.indexOf(WAR));
  assert.equal(stage(), 3);
  assert.equal(G.mode, 'WORLD');
});
