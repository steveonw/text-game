// M1: the source modules, imported directly, behave exactly as v13 did.
// Every golden recorded from the legacy file in M0 must pass here unchanged.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { COMPARED_FIELDS, readTranscripts, readWorldHashes, readLegacyCodes } from '../tools/harness/golden.mjs';
import { bootModules, playModules, sendModules, snapshotModules, worldSignatureModules } from '../tools/harness/modules.mjs';
import { sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import { G, resetState } from '../src/state.js';
import { HOST } from '../src/io.js';
import { cmdNew } from '../src/commands.js';

test('modules: golden transcripts replay unchanged', async (t) => {
  const transcripts = readTranscripts();
  assert.ok(transcripts.length >= 27);
  for (const g of transcripts) {
    await t.test(g.name, () => {
      const r = playModules(g.seed, g.commands);
      for (const f of COMPARED_FIELDS) assert.deepEqual(r[f], g[f], `${g.name}: ${f} differs`);
    });
  }
});

test('modules: world hashes and start tiles unchanged for every sweep seed', () => {
  const golden = readWorldHashes();
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    assert.deepEqual(worldSignatureModules(s), golden[s], `world for seed "${s}" changed`);
  }
});

test('modules: legacy save codes load to their recorded state', async (t) => {
  const { codes } = readLegacyCodes();
  for (const [i, c] of codes.entries()) {
    await t.test(`${i + 1}: ${c.format}, ${c.label}`, () => {
      const { log } = bootModules('codes-host');
      const before = log.length;
      sendModules(['LOAD ' + c.code]);
      assert.deepEqual(log.slice(before).map(([, text]) => text).slice(1), c.reply);
      assert.deepEqual(snapshotModules(), c.restores);
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
