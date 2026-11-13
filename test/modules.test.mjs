// The source modules, imported directly.
//
//   test/golden/       what the game does now. Every transcript must replay unchanged.
//   test/golden-v13/   what v13 did. Two things there still bind the current game:
//                      the worlds (terrain, towns, capital; the start tile on all but
//                      ten sweep seeds, see MOVED_YARDS) and the save codes.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARED_FIELDS, GOLDEN, GOLDEN_V13, expectedWorld, readTranscripts, readWorldHashes, readLegacyCodes, readSaveCodes } from '../tools/harness/golden.mjs';
import { fnv1a32 } from '../src/rng.js';
import { bootModules, playModules, sendModules, snapshotModules, worldSignatureModules } from '../tools/harness/modules.mjs';
import { sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import { G, resetState } from '../src/state.js';
import { HOST } from '../src/io.js';
import { cmdNew } from '../src/commands.js';

test('modules: golden transcripts replay unchanged', async (t) => {
  const transcripts = readTranscripts(GOLDEN);
  assert.ok(transcripts.length >= 34);
  for (const g of transcripts) {
    await t.test(g.name, () => {
      const r = playModules(g.seed, g.commands, { debug: !!g.debug });
      for (const f of COMPARED_FIELDS) assert.deepEqual(r[f], g[f], `${g.name}: ${f} differs`);
    });
  }
});

test('modules: every sweep seed still makes the world v13 made, and starts where v13 did on all but ten', () => {
  const v13 = readWorldHashes(GOLDEN_V13);
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    assert.deepEqual(worldSignatureModules(s), expectedWorld(v13[s], s), `world for seed "${s}" changed`);
  }
});

// M6: the owner decided old codes need not load. v13's are refused with v13's lines.
test('modules: codes made by v13 are refused, with v13\'s refusal line', () => {
  const { codes } = readLegacyCodes(GOLDEN_V13);
  assert.equal(codes.length, 19);
  for (const c of codes) {
    const { log } = bootModules('codes-host');
    const before = log.length;
    sendModules(['LOAD ' + c.code]);
    assert.deepEqual(log.slice(before).map(([, text]) => text).slice(1), ['The password refuses to settle.'], `${c.format}: ${c.label}`);
    assert.equal(G.seed, fnv1a32('codes-host'), 'nothing changed');
  }
});

test('modules: codes made by the current game load to their recorded state', async (t) => {
  const { codes } = readSaveCodes(GOLDEN);
  assert.ok(codes.length >= 15);
  for (const [i, c] of codes.entries()) {
    await t.test(`${i + 1}: ${c.label}`, () => {
      const { log } = bootModules('codes-host');
      const before = log.length;
      sendModules(['LOAD ' + c.code]);
      assert.deepEqual(log.slice(before).map(([, text]) => text).slice(1), c.reply);
      assert.deepEqual({ ...snapshotModules(), townsEntered: G.townsEntered }, c.restores);
    });
  }
});

test('modules: resetState restores every field of G', () => {
  resetState();
  const fresh = JSON.stringify(G, (k, v) => (v instanceof Set ? ['Set', ...v] : v instanceof Uint8Array ? ['bits', ...v] : v));
  const keys = Object.keys(G);
  playModules('walk-1', ['N', 'E', 'ENTER', 'TALK', 'ASK DOG', 'EXIT', 'WAIT', 'BLOCK']);
  resetState();
  assert.deepEqual(Object.keys(G), keys, 'no field was added to G during play');
  assert.equal(JSON.stringify(G, (k, v) => (v instanceof Set ? ['Set', ...v] : v instanceof Uint8Array ? ['bits', ...v] : v)), fresh);
});

test('modules: a world with no seed is only ever made by the host', () => {
  bootModules('walk-1');
  assert.throws(() => cmdNew(''), /unseeded world/);
  let asked = 0;
  HOST.freshSeed = () => { asked++; return 12345; };
  cmdNew('');
  assert.equal(asked, 1);
  assert.equal(G.seed, 12345);
});
