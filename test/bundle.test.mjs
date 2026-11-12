// The built single file, dist/index.html, loaded in the same headless harness as
// the legacy file.
//
//   test/golden/       what the game does now. Every transcript must replay unchanged.
//   test/golden-v13/   what v13 did. The worlds and the save codes there still bind
//                      the current game; the transcripts do not (M2 repaired 12 defects).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, SNAPSHOT_EXPR } from '../tools/harness/load.mjs';
import { ROOT, LEGACY, GOLDEN, GOLDEN_V13, COMPARED_FIELDS, readTranscripts, readWorldHashes, readLegacyCodes, replay, worldSignature } from '../tools/harness/golden.mjs';
import { sweepCore, sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import { build, DIST, MARKER } from '../tools/build.mjs';

const built = build();
const SWEEP_PINS = { winnable: 1992, dogTiles: 23934, veryNearWild: 59544 };
const html = fs.readFileSync(DIST, 'utf8');

test('bundle: one file, one script, nothing from outside', () => {
  assert.equal(html.match(/<script/g).length, 1);
  assert.equal(html.match(/<\/script>/g).length, 1);
  assert.ok(!html.includes(MARKER));
  assert.ok(!/https?:\/\//.test(html), 'no URL anywhere in the file');
  assert.ok(!/<link|<img|<iframe|\bsrc=|@import|\bfetch\(|XMLHttpRequest|\bimport\(/.test(html), 'nothing that loads a resource');
  const script = html.slice(html.indexOf('<script>') + 8, html.indexOf('</script>'));
  assert.ok(script.includes("'use strict';"));
  assert.ok(!/^\s*(import|export)\b/m.test(script), 'no import or export left in the script');
});

test('bundle: markup and CSS are v13\'s, byte for byte', () => {
  const legacy = fs.readFileSync(LEGACY, 'utf8');
  const head = legacy.slice(0, legacy.indexOf('<script>') + 8);
  const tail = legacy.slice(legacy.indexOf('</script>'));
  assert.ok(html.startsWith(head));
  assert.ok(html.endsWith(tail));
});

test('bundle: the build is a pure function of src/', () => {
  const again = build(undefined, path.join(ROOT, 'dist', 'index.again.html'));
  assert.equal(fs.readFileSync(again.out, 'utf8'), html);
  fs.unlinkSync(again.out);
  assert.equal(built.order.at(-1), 'main.js');
});

test('bundle: loads cleanly and keeps its state in G', () => {
  const game = load(DIST, { seed: 'walk-1' });
  assert.equal(game.flavor, 'modules');
  assert.deepEqual(game.consoleLines, []);
  assert.equal(game.get('G.steps'), 0);
  assert.equal(game.get('G.seed'), game.get('fnv1a32("walk-1")'));
});

test('bundle: golden transcripts replay unchanged', async (t) => {
  for (const g of readTranscripts(GOLDEN)) {
    await t.test(g.name, () => {
      const r = replay(DIST, g);
      for (const f of COMPARED_FIELDS) assert.deepEqual(r[f], g[f], `${g.name}: ${f} differs`);
    });
  }
});

test('bundle: every sweep seed still makes the world v13 made', () => {
  const v13 = readWorldHashes(GOLDEN_V13);
  const game = load(DIST, { seed: 'hash-host' });
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    assert.deepEqual(worldSignature(game, s), v13[s], `world for seed "${s}" changed`);
  }
});

test('goldens: the current world hashes are v13\'s, entry for entry', () => {
  const now = readWorldHashes(GOLDEN), v13 = readWorldHashes(GOLDEN_V13);
  delete now._source; delete v13._source;
  assert.deepEqual(now, v13);
});

for (const [who, golden] of [['codes made by v13', GOLDEN_V13], ['codes made by the current game', GOLDEN]]) {
  test(`bundle: ${who} load to their recorded state`, async (t) => {
    const { codes } = readLegacyCodes(golden);
    assert.equal(codes.length, 19);
    for (const [i, c] of codes.entries()) {
      await t.test(`${i + 1}: ${c.format}, ${c.label}`, () => {
        const game = load(DIST, { seed: 'codes-host' });
        const reply = game.cmd('LOAD ' + c.code).map(([, text]) => text).slice(1);
        assert.deepEqual(reply, c.reply);
        assert.deepEqual(game.get(SNAPSHOT_EXPR), c.restores);
      });
    }
  });
}

// The sweep is pinned so that a change to the numbers is a decision, not an accident.
// v13 measured 1,992 winnable and 20,494 dog tiles on 51,152 very-near searchable
// tiles (40.1%). D6 made natural ruins searchable: 8,392 more very-near tiles, 3,440
// of them dog tiles. Nothing else in M2 moves these numbers, and the same 8 seeds
// stay unwinnable.
test('bundle: sweep numbers are the ones recorded for M2: 1,992 winnable; fresh-trail truth 40.2%', () => {
  const now = sweepCore(DIST, SWEEP_SIZE);
  assert.deepEqual({ winnable: now.winnable, dogTiles: now.dogTiles, veryNearWild: now.veryNearWild }, SWEEP_PINS);
  assert.equal((100 * now.freshTrailTruth).toFixed(1), '40.2');
  assert.deepEqual(now.unwinnable, sweepCore(LEGACY, SWEEP_SIZE).unwinnable, 'the unwinnable seeds are v13\'s');
});

// M2 acceptance: in every town where smith and guard both roll, both appear. v13: 0 of 2,717.
test('bundle: sweep: where smith and guard both roll, both are drawn, the guard at the end of the street', () => {
  const game = load(DIST, { seed: 'sweep-host' });
  game.run(`function __smithAndGuard(seedStr){
    SEED = fnv1a32(seedStr); mode = "WORLD"; local = null; startNewGame();
    let both = 0, drawn = 0;
    for (const t of towns){
      const rolled = TOWN_BUILDINGS.filter(function(b, i){ return noise01(t.x*10+i, t.y*10+i, SEED ^ 0x0B11D) > TUNE.buildingAbove; });
      if (!(rolled.includes("S") && rolled.includes("G"))) continue;
      both++;
      const m = generateTown(t.x, t.y, false).map;
      if (m[6][2] === "S" && m[4][7] === "G") drawn++;
    }
    return [both, drawn];
  }`);
  let both = 0, drawn = 0;
  for (let i = 1; i <= SWEEP_SIZE; i++) { const r = game.get(`__smithAndGuard(${JSON.stringify(sweepSeed(i))})`); both += r[0]; drawn += r[1]; }
  assert.equal(both, 2717);
  assert.equal(drawn, 2717);
});
