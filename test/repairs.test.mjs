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
