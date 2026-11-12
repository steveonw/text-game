// M2: one test per repaired defect, named for its ID in docs/SPEC.md section 3.
// Each plays the modules directly and checks the behaviour the repair promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, screenText, nearest, walkTo, localTo } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { isTownAt, tileAt, finalTileAt, dogIsVeryNear, keyForXY } from '../src/world.js';
import { generateTown, generateWilderness } from '../src/local.js';
import { mapHtml } from '../src/render.js';

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
  assert.ok(say('HELP').some((l) => l.startsWith('Commands: ')));
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
  assert.deepEqual(say('LOAD not-a-code').slice(1), ['Invalid password.']);
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

test('D6: natural ruins open as wilderness; a burned town and the fallen capital still open as towns', () => {
  bootModules('ruins-1');
  const r = nearest((x, y) => isNaturalRuin(x, y));
  assert.ok(r, 'a natural ruins tile is reachable');
  walkTo(r.x, r.y);
  assert.ok(say('LOOK').includes('Old stones. A place avoided.'));
  const out = say('ENTER');
  assert.ok(out.includes('The land closes around you.'));
  assert.ok(!out.includes('Buildings gather. The road narrows.'));
  assert.equal(G.local.kind, 'WILD');
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
