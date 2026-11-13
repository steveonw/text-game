// M3: one dog on one trail. Each test plays the modules directly and checks one
// thing the M3 sheet promises. The sweep-wide gates are in test/bundle.test.mjs.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, walkTo, localTo } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { TUNE, WORLD_SIZE } from '../src/tuning.js';
import { noise01 } from '../src/rng.js';
import { addDogHint, finalTileAt, hasDogHint, homeRegion, isTownAt, passable, startTile, stepsFrom, tileAt, walkable } from '../src/world.js';
import { buildTrail, callAnswer, dogDirectionHint, dogIndex, dogIsNear, dogIsVeryNear, dogTile, trail, trailIndexAt } from '../src/trail.js';
import { generateRuin, generateWilderness } from '../src/local.js';
import { enterKind } from '../src/commands.js';
import { mapHtml } from '../src/render.js';

const SEEDS = ['trail-1', 'trail-2', 'trail-3', 'trail-4', 'trail-5', 'trail-6', 'trail-7', 'trail-8', 'sweep-1', 'sweep-2', 'sweep-99', 'sweep-181', 'sweep-762', 'sweep-1702'];
const N = WORLD_SIZE;
const at = (x, y) => y * N + x;
const mapRows = () => mapHtml().replace(/<[^>]*>/g, '').replace(/\n$/, '').split('\n');
const isNaturalRuin = (x, y) => tileAt(x, y) === 'R' && !isTownAt(x, y);
const same = (a, b) => a.x === b.x && a.y === b.y;
const allTiles = () => { const out = []; for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) out.push({ x, y }); return out; };
// The map ENTER would open on a world tile that can be searched, or null.
const localMap = (p) => { const k = enterKind(p.x, p.y); return k === 'WILD' ? generateWilderness(p.x, p.y) : k === 'RUIN' ? generateRuin(p.x, p.y) : null; };
const FRESH = 'The trail is fresh. ENTER to search.';
const MOVED = 'Something moved through here recently.';

// Walk the trail from where the player stands to trail position `to`, one tile at a time.
function walkTrail(to) {
  const t = trail();
  const from = trailIndexAt(G.player.x, G.player.y);
  assert.ok(from >= 0, 'the player is on the trail');
  const out = [];
  for (let i = from + 1; i <= to; i++) {
    const a = t.tiles[i - 1], b = t.tiles[i];
    out.push(...say(b.x > a.x ? 'E' : b.x < a.x ? 'W' : b.y > a.y ? 'S' : 'N'));
    assert.ok(same(G.player, b), 'the trail can be walked');
  }
  return out;
}

test('start: the yard is in the home region, and the player starts there', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const yard = startTile();
    assert.ok(same(G.player, yard), seed);
    assert.equal(homeRegion()[at(yard.x, yard.y)], 1, seed);
    assert.ok(same(trail().tiles[0], yard), `${seed}: the trail starts at the yard`);
  }
});

test('start: a world whose towns sit in pockets is played on its mainland', () => {
  // sweep-762: both towns are in two-tile pockets; 233 walkable tiles have no town.
  bootModules('sweep-762');
  const reach = stepsFrom(G.player.x, G.player.y, walkable).filter((d) => d >= 0).length;
  assert.ok(reach >= TUNE.homeRegionMinTiles, `the yard reaches ${reach} tiles`);
  assert.ok(trail().tiles.length >= 20);
});

test('trail: an unbroken walk from the yard to the threshold, no tile twice, the same every time', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    assert.ok(t.tiles.length >= 15, `${seed}: ${t.tiles.length} tiles`);
    const seen = new Set();
    t.tiles.forEach((p, i) => {
      assert.ok(walkable(p.x, p.y), `${seed}: tile ${i} is walkable`);
      assert.ok(!seen.has(at(p.x, p.y)), `${seed}: tile ${i} appears once`);
      seen.add(at(p.x, p.y));
      if (i > 0) assert.equal(Math.abs(p.x - t.tiles[i - 1].x) + Math.abs(p.y - t.tiles[i - 1].y), 1, `${seed}: tile ${i} touches tile ${i - 1}`);
      assert.equal(trailIndexAt(p.x, p.y), i);
    });
    assert.equal(t.threshold, t.tiles.length - 1);
    assert.deepEqual(buildTrail().tiles, t.tiles, `${seed}: built twice, the same`);
  }
});

test('trail: nothing that happens in a game moves it', () => {
  bootModules('trail-1');
  const before = trail().tiles.map((p) => [p.x, p.y]);
  const mid = trail().tiles[5];
  for (const e of ['routes_stirring', 'war_started', 'capital_fallen', `road_blocked_${mid.x}_${mid.y}`, `burned_${G.towns[0].x}_${G.towns[0].y}`]) G.worldEvents.add(e);
  G.steps = 90; G.player.x = mid.x; G.player.y = mid.y;
  assert.deepEqual(buildTrail().tiles.map((p) => [p.x, p.y]), before);
});

test('trail: the threshold is the natural ruin nearest 30 steps out, or open ground where there is none', () => {
  let onRuins = 0, onOpen = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail(), end = t.tiles[t.threshold];
    const d = stepsFrom(t.yard.x, t.yard.y, walkable);
    const off = (p) => Math.abs(d[at(p.x, p.y)] - TUNE.trailLength);
    const ruins = allTiles().filter((p) => isNaturalRuin(p.x, p.y) && d[at(p.x, p.y)] >= TUNE.thresholdMinSteps);
    assert.ok(!isTownAt(end.x, end.y));
    if (ruins.length) {
      onRuins++;
      assert.ok(t.onRuins && isNaturalRuin(end.x, end.y), `${seed}: the threshold is a natural ruin`);
      assert.ok(d[at(end.x, end.y)] >= TUNE.thresholdMinSteps);
      for (const r of ruins) assert.ok(off(end) <= off(r), `${seed}: no ruin is nearer 30 steps`);
    } else {
      onOpen++;
      assert.ok(!t.onRuins && ['.', 'F'].includes(tileAt(end.x, end.y)), `${seed}: the threshold is plains or forest`);
      for (const p of allTiles().filter((p) => ['.', 'F'].includes(tileAt(p.x, p.y)) && !isTownAt(p.x, p.y) && d[at(p.x, p.y)] >= 1)) assert.ok(off(end) <= off(p), `${seed}: no open tile is nearer 30 steps`);
    }
  }
  assert.ok(onRuins >= 3 && onOpen >= 1, `both kinds are covered (${onRuins} ruins, ${onOpen} open)`);
});

test('trail: where a town is close to the yard, the trail passes beside it', () => {
  let checked = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    const d = stepsFrom(t.yard.x, t.yard.y, walkable);
    const close = G.towns.filter((w) => d[at(w.x, w.y)] >= 1 && d[at(w.x, w.y)] <= TUNE.viaTownWithin);
    if (!close.length || !t.via) continue;
    checked++;
    assert.ok(trailIndexAt(t.via.x, t.via.y) >= 0, `${seed}: the via point is on the trail`);
    assert.ok(close.some((w) => Math.abs(w.x - t.via.x) + Math.abs(w.y - t.via.y) === 1), `${seed}: the via point touches a close town`);
  }
  assert.ok(checked >= 3, `${checked} seeds with a close town`);
});

test('dens: two different plains or forest tiles, in order, never a town, the yard or the threshold', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    assert.ok(0 < t.den1 && t.den1 < t.den2 && t.den2 < t.threshold, `${seed}: 0 < ${t.den1} < ${t.den2} < ${t.threshold}`);
    for (const i of [t.den1, t.den2]) {
      const p = t.tiles[i];
      assert.ok(['.', 'F'].includes(tileAt(p.x, p.y)) && !isTownAt(p.x, p.y), `${seed}: den at ${i} is open ground`);
    }
  }
  // an ordinary trail: the dens sit near 40% and 70%
  bootModules('trail-1');
  const t = trail(), last = t.threshold;
  assert.ok(Math.abs(t.den1 - 0.4 * last) <= 3 && Math.abs(t.den2 - 0.7 * last) <= 3, `dens at ${t.den1} and ${t.den2} of ${last}`);
});

test('the dog: den 1, then den 2 once the war starts, then the threshold once the capital falls', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    assert.equal(dogIndex(), t.den1);
    assert.ok(same(dogTile(), t.tiles[t.den1]));
    G.worldEvents.add('war_started');
    assert.equal(dogIndex(), t.den2);
    G.worldEvents.add('capital_fallen');
    assert.equal(dogIndex(), t.threshold);
  }
});

test('the dog: exactly one tile holds it, in every state of the clock, and ENTER there shows it', () => {
  for (const seed of SEEDS) {
    for (const events of [[], ['war_started'], ['war_started', 'capital_fallen']]) {
      bootModules(seed);
      for (const e of events) G.worldEvents.add(e);
      const holding = allTiles().filter((p) => { const m = localMap(p); return m && m.dog; });
      assert.equal(holding.length, 1, `${seed} ${events.join('+') || 'quiet'}`);
      assert.ok(same(holding[0], dogTile()));
      const dog = localMap(holding[0]).dog;
      assert.ok(dog.x >= 1 && dog.x <= 7 && dog.y >= 1 && dog.y <= 7, 'at a cell inside the map');
      assert.deepEqual(localMap(holding[0]).dog, dog, 'at the same cell every time');
    }
  }
});

test('sign: every trail tile from the yard to the dog carries it, and no other tile does', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    for (const p of allTiles()) {
      const i = trailIndexAt(p.x, p.y);
      assert.equal(dogIsNear(p.x, p.y), i >= 0 && i <= t.den1, `${seed} (${p.x},${p.y})`);
      assert.equal(dogIsVeryNear(p.x, p.y), i === t.den1);
    }
    G.worldEvents.add('war_started');
    assert.ok(dogIsNear(t.tiles[t.den2].x, t.tiles[t.den2].y), 'sign follows the dog to den 2');
    assert.ok(t.den2 + 1 > t.threshold || !dogIsNear(t.tiles[t.den2 + 1].x, t.tiles[t.den2 + 1].y), 'and stops there');
  }
});

test('sign: walking onto it records it, and the third tile sets the routes stirring', () => {
  bootModules('trail-1');
  assert.equal(G.dogHintCount, 0, 'the yard is not recorded until it is walked onto');
  let out = walkTrail(2);
  assert.equal(G.dogHintCount, 2);
  assert.ok(!G.worldEvents.has('routes_stirring'));
  assert.ok(!out.includes('Animals have been restless. You feel it in the roads.'));
  out = walkTrail(3);
  assert.equal(G.dogHintCount, 3);
  assert.ok(G.worldEvents.has('routes_stirring'));
  assert.ok(out.includes('Animals have been restless. You feel it in the roads.'));
  for (let i = 1; i <= 3; i++) assert.ok(hasDogHint(trail().tiles[i].x, trail().tiles[i].y));

  // a tile off the trail records nothing
  bootModules('trail-1');
  const t = trail();
  const off = [[1, 0, 'E'], [-1, 0, 'W'], [0, 1, 'S'], [0, -1, 'N']].map(([dx, dy, c]) => ({ x: t.yard.x + dx, y: t.yard.y + dy, c })).find((p) => passable(p.x, p.y) && trailIndexAt(p.x, p.y) < 0);
  assert.ok(off, 'the yard has a neighbour off the trail');
  say(off.c);
  assert.equal(G.dogHintCount, 0);
});

test('LOOK: sign is reported on sign tiles, and the fresh trail only on the dog\'s own tile', () => {
  for (const seed of ['trail-1', 'trail-2', 'sweep-99']) {
    bootModules(seed);
    const t = trail();
    let out = say('LOOK');
    assert.ok(out.includes(MOVED) && !out.includes(FRESH), `${seed}: the yard has sign`);
    walkTrail(t.den1 - 1);
    out = say('LOOK');
    assert.ok(out.includes(MOVED) && !out.includes(FRESH), `${seed}: one tile short of the dog`);
    walkTrail(t.den1);
    out = say('LOOK');
    assert.ok(out.includes(MOVED) && out.includes(FRESH), `${seed}: the dog's tile`);
    walkTrail(t.den1 + 1);
    out = say('LOOK');
    assert.ok(!out.includes(MOVED) && !out.includes(FRESH), `${seed}: one tile past the dog`);
  }
});

test('ENTER: the fresh trail is always followed by the dog, and CALL beside it ends the search', () => {
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail();
    walkTrail(t.den1);
    assert.ok(say('LOOK').includes(FRESH), seed);
    const out = say('ENTER');
    assert.deepEqual(out.slice(1), ['The land closes around you.', 'You sense movement nearby.'], seed);
    assert.ok(G.local.dog, seed);
    assert.ok(localTo(G.local.dog.x, G.local.dog.y));
    assert.ok(say('LOOK').includes('Your dog. It\'s here.'));
    assert.ok(say('CALL').some((l) => l.startsWith('Ending: ')), seed);
  }
});

test('ENTER: a tile with sign but no dog is empty, and so is every tile off the trail', () => {
  bootModules('trail-1');
  const t = trail();
  walkTrail(t.den1 - 1);
  assert.deepEqual(say('ENTER').slice(1), ['The land closes around you.']);
  assert.equal(G.local.dog, null);
  say('EXIT');
  for (const p of allTiles()) if (localMap(p) && !same(p, dogTile())) assert.equal(localMap(p).dog, null);
});

test('the dog stays for a visit that began before it moved on', () => {
  bootModules('trail-1');
  const t = trail();
  walkTrail(t.den1);
  say('ENTER');
  const dog = { ...G.local.dog };
  G.worldEvents.add('war_started'); // the dog's place is now den 2
  assert.equal(dogIndex(), t.den2);
  assert.deepEqual(G.local.dog, dog, 'this map still shows it');
  say('EXIT');
  assert.deepEqual(say('ENTER').slice(1), ['The land closes around you.'], 'a new visit finds den 1 empty');
  say('EXIT');
  walkTrail(t.den2);
  assert.ok(say('LOOK').includes(FRESH));
  assert.ok(say('ENTER').includes('You sense movement nearby.'));
});

test('after the capital falls the dog is at the threshold, among the stones', () => {
  let ruins = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail(), end = t.tiles[t.threshold];
    G.worldEvents.add('war_started'); G.worldEvents.add('capital_fallen');
    assert.ok(walkTo(end.x, end.y), `${seed}: the threshold can be walked to`);
    if (isNaturalRuin(end.x, end.y)) { ruins++; assert.ok(say('LOOK').includes('Old stones. A place avoided.')); }
    assert.ok(say('LOOK').includes(FRESH), seed);
    say('ENTER');
    assert.equal(G.local.kind, 'RUIN', seed);
    assert.ok(G.local.dog, seed);
    assert.ok(['r', '^'].includes(G.local.map[G.local.dog.y][G.local.dog.x]), `${seed}: the dog waits at a stone`);
    localTo(G.local.dog.x, G.local.dog.y);
    assert.ok(say('CALL').includes('Ending: The Long Way Back'), seed);
  }
  assert.ok(ruins >= 3, `${ruins} thresholds on ruins`);
});

test('CALL on the world map: the dog\'s tile, then three trail positions either side, then nothing', () => {
  const HERE = ['You call out.', 'Something stirs in the distance.', 'You should search here.'];
  const NEAR = ['You call out.', 'The wind carries it. Maybe.'];
  const FLAT = ['You call out.', 'Your voice falls flat against the land.'];
  bootModules('trail-1');
  const t = trail();
  assert.ok(t.den1 >= 5 && t.den1 + 4 <= t.threshold, 'the trail is long enough for this test');
  assert.deepEqual(say('CALL').slice(1), FLAT, 'the yard');
  for (let i = 1; i <= t.den1 + 4; i++) {
    walkTrail(i);
    const d = Math.abs(i - t.den1);
    assert.deepEqual(say('CALL').slice(1), d === 0 ? HERE : d <= 3 ? NEAR : FLAT, `position ${i}, ${d} from the dog`);
    assert.equal(callAnswer(G.player.x, G.player.y), d === 0 ? 'here' : d <= 3 ? 'near' : null);
    const soft = say('ASK DOG').slice(1);
    assert.deepEqual(soft, d <= 3 ? ['You call softly. The wind answers.', 'But the ground suggests you are close.'] : ['You call softly. The wind answers.'], `ASK DOG at position ${i}`);
  }
  // off the trail it is always flat
  bootModules('trail-1');
  const off = allTiles().find((p) => passable(p.x, p.y) && trailIndexAt(p.x, p.y) < 0 && stepsFrom(G.player.x, G.player.y, passable)[at(p.x, p.y)] > 0);
  walkTo(off.x, off.y);
  assert.deepEqual(say('CALL').slice(1), FLAT);
});

test('CALL inside a map with no dog: close only near the dog\'s place on the trail', () => {
  bootModules('trail-1');
  const t = trail();
  say('ENTER');
  assert.deepEqual(say('CALL').slice(1), ['You call out.', 'Nothing answers.'], 'the yard is far from the dog');
  say('EXIT');
  walkTrail(t.den1 - 1);
  say('ENTER');
  assert.deepEqual(say('CALL').slice(1), ['You call out.', 'The air feels close. Keep looking.']);
});

test('the map: found sign is drawn as ? on plains and forest, and nothing else is', () => {
  bootModules('trail-1');
  const t = trail();
  assert.ok(!mapRows().join('').includes('?'), 'no sign is drawn before any is found');
  walkTrail(t.den1);
  const rows = mapRows();
  for (const p of allTiles()) {
    const i = trailIndexAt(p.x, p.y);
    const found = i >= 1 && i < t.den1 && ['.', 'F'].includes(finalTileAt(p.x, p.y));
    if (same(p, G.player)) assert.equal(rows[p.y][p.x], '@');
    else assert.equal(rows[p.y][p.x] === '?', found, `(${p.x},${p.y}) trail position ${i}`);
  }
  assert.ok(rows.join('').includes('?'));
  // a hint bit off the trail, as a v13 code can carry, is kept but not drawn
  const off = allTiles().find((p) => trailIndexAt(p.x, p.y) < 0 && finalTileAt(p.x, p.y) === '.');
  addDogHint(off.x, off.y);
  assert.notEqual(mapRows()[off.y][off.x], '?');
});

test('the map: a town on the trail keeps its glyph', () => {
  // sweep-1663 starts on a town tile; the yard is trail position 0.
  bootModules('sweep-1663');
  const t = trail();
  assert.ok(isTownAt(t.yard.x, t.yard.y));
  walkTrail(1); say(t.tiles[0].x > t.tiles[1].x ? 'E' : t.tiles[0].x < t.tiles[1].x ? 'W' : t.tiles[0].y > t.tiles[1].y ? 'S' : 'N');
  assert.ok(hasDogHint(t.yard.x, t.yard.y));
  walkTrail(1);
  assert.notEqual(mapRows()[t.yard.y][t.yard.x], '?');
});

test('gesture: the first step of the shortest way to the dog, offered only where sign is close', () => {
  const STEP = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
  let pointed = 0, silent = 0, misled = 0;
  for (const seed of SEEDS) {
    bootModules(seed);
    const t = trail(), dog = dogTile();
    const toDog = stepsFrom(dog.x, dog.y, passable);
    for (const p of allTiles()) {
      if (!passable(p.x, p.y)) continue;
      const close = t.tiles.slice(0, t.den1 + 1).some((s) => Math.abs(s.x - p.x) + Math.abs(s.y - p.y) <= TUNE.gestureSignWithin);
      for (const step of [0, 7, 19]) {
        G.steps = step;
        const dir = dogDirectionHint(p.x, p.y);
        if (!close || same(p, dog) || toDog[at(p.x, p.y)] < 0) { assert.equal(dir, null, `${seed} (${p.x},${p.y}): no gesture`); silent++; continue; }
        assert.ok(dir in STEP, `${seed} (${p.x},${p.y}): a direction`);
        const [dx, dy] = STEP[dir], nx = p.x + dx, ny = p.y + dy;
        assert.ok(passable(nx, ny), `${seed} (${p.x},${p.y}): it points at open ground`);
        const error = noise01(step, (p.x << 8) ^ p.y, G.seed ^ 0xD066) < TUNE.gestureMisleadChance;
        if (!error) { assert.equal(toDog[at(nx, ny)], toDog[at(p.x, p.y)] - 1, `${seed} (${p.x},${p.y}): one step nearer the dog`); pointed++; }
        else { misled++; }
      }
    }
  }
  assert.ok(pointed > 500 && silent > 500 && misled > 20, `${pointed} true, ${silent} silent, ${misled} with the error roll`);
});

test('gesture: follows the dog when it moves on', () => {
  bootModules('trail-1');
  const t = trail(), den2 = t.tiles[t.den2];
  G.worldEvents.add('war_started');
  G.steps = 1;
  const from = t.tiles[t.den1];
  const toDen2 = stepsFrom(den2.x, den2.y, passable);
  let step = 1; while (noise01(step, (from.x << 8) ^ from.y, G.seed ^ 0xD066) < TUNE.gestureMisleadChance) step++;
  G.steps = step;
  const dir = dogDirectionHint(from.x, from.y);
  const [dx, dy] = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] }[dir];
  assert.equal(toDen2[at(from.x + dx, from.y + dy)], toDen2[at(from.x, from.y)] - 1);
});

test('saves: found sign and the trail come back with a code loaded into another world', () => {
  bootModules('trail-1');
  const t = trail();
  walkTrail(4);
  const tiles = t.tiles.map((p) => [p.x, p.y]);
  const code = say('SAVE').at(-1);
  const rows = mapRows();
  bootModules('some-other-world');
  assert.notDeepEqual(trail().tiles.map((p) => [p.x, p.y]), tiles);
  assert.ok(say('LOAD ' + code).includes('The password takes.'));
  assert.deepEqual(trail().tiles.map((p) => [p.x, p.y]), tiles, 'the trail is the seed\'s');
  assert.equal(G.dogHintCount, 4);
  assert.deepEqual(mapRows(), rows, 'the same map, sign included');
});

test('Homecoming still asks for five sign tiles and a reputation of three', () => {
  bootModules('trail-1');
  const t = trail();
  assert.ok(t.den1 >= TUNE.homecomingHints, 'den 1 is far enough along');
  walkTrail(t.den1);
  assert.ok(G.dogHintCount >= TUNE.homecomingHints);
  G.player.rep = TUNE.homecomingReputation;
  say('ENTER'); localTo(G.local.dog.x, G.local.dog.y);
  assert.ok(say('CALL').includes('Ending: Homecoming'));
});
