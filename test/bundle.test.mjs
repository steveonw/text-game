// M1: the built single file, dist/index.html, behaves exactly as v13 did.
// It is loaded in the same headless harness as the legacy file and must pass
// every golden recorded in M0, unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { load, SNAPSHOT_EXPR } from '../tools/harness/load.mjs';
import { ROOT, LEGACY, COMPARED_FIELDS, readTranscripts, readWorldHashes, readLegacyCodes, replay, worldSignature } from '../tools/harness/golden.mjs';
import { sweepCore, sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import { build, DIST, MARKER } from '../tools/build.mjs';

const built = build();
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
  for (const g of readTranscripts()) {
    await t.test(g.name, () => {
      const r = replay(DIST, g);
      for (const f of COMPARED_FIELDS) assert.deepEqual(r[f], g[f], `${g.name}: ${f} differs`);
    });
  }
});

test('bundle: world hashes and start tiles unchanged for every sweep seed', () => {
  const golden = readWorldHashes();
  const game = load(DIST, { seed: 'hash-host' });
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    assert.deepEqual(worldSignature(game, s), golden[s], `world for seed "${s}" changed`);
  }
});

test('bundle: legacy save codes load to their recorded state', async (t) => {
  const { codes } = readLegacyCodes();
  for (const [i, c] of codes.entries()) {
    await t.test(`${i + 1}: ${c.format}, ${c.label}`, () => {
      const game = load(DIST, { seed: 'codes-host' });
      const reply = game.cmd('LOAD ' + c.code).map(([, text]) => text).slice(1);
      assert.deepEqual(reply, c.reply);
      assert.deepEqual(game.get(SNAPSHOT_EXPR), c.restores);
    });
  }
});

test('bundle: sweep numbers unchanged: 1,992 winnable; fresh-trail truth 40.1%', () => {
  const r = sweepCore(DIST, SWEEP_SIZE);
  assert.equal(r.winnable, 1992);
  assert.equal(r.dogTiles, 20494);
  assert.equal(r.veryNearWild, 51152);
});
