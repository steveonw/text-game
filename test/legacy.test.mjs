// M0 baseline: pins the behaviour of legacy/quiet-roads-v13.html, defects included.
//
// Nothing here says the behaviour is right. It says the behaviour is known, so
// that later steps change it on purpose and can show exactly what changed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { load, SNAPSHOT_EXPR } from '../tools/harness/load.mjs';
import { ROOT, LEGACY, LEGACY_SHA256, COMPARED_FIELDS, readTranscripts, readWorldHashes, readLegacyCodes, replay, worldSignature } from '../tools/harness/golden.mjs';
import { sweepCore, sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';

const transcripts = readTranscripts();
const texts = (t) => t.log.map(([, text]) => text);

test('the legacy file is v13, byte for byte', () => {
  const sha = crypto.createHash('sha256').update(fs.readFileSync(LEGACY)).digest('hex');
  assert.equal(sha, LEGACY_SHA256);
  assert.ok(fs.readFileSync(path.join(ROOT, 'README.md'), 'utf8').includes(LEGACY_SHA256), 'README records the SHA-256');
});

test('package.json lists no dependencies', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  for (const k of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    assert.equal(Object.keys(pkg[k] || {}).length, 0, `${k} must be empty`);
  }
});

test('golden transcripts replay against the legacy file', async (t) => {
  assert.ok(transcripts.length >= 20, `expected at least 20 transcripts, found ${transcripts.length}`);
  for (const g of transcripts) {
    await t.test(g.name, () => {
      assert.equal(g.file, g.name + '.json');
      const r = replay(LEGACY, g);
      for (const f of COMPARED_FIELDS) assert.deepEqual(r[f], g[f], `${g.name}: ${f} differs`);
    });
  }
});

test('transcripts cover what the M0 sheet lists', () => {
  const allText = transcripts.flatMap(texts);
  for (const ending of ['Reunion', 'Homecoming', 'Found in Time', 'The Long Way Back']) {
    assert.ok(allText.includes('Ending: ' + ending), `no transcript reaches "${ending}"`);
  }
  // every word the parser answers to, and every topic
  const used = new Set(transcripts.flatMap((g) => g.commands.map((c) => c.trim().split(/\s+/)[0].toUpperCase())));
  const words = ['N', 'S', 'E', 'W', 'NORTH', 'SOUTH', 'EAST', 'WEST', 'HI', 'HELLO', 'EX', 'EXT', 'HELP', 'STATUS', 'ENTER', 'EXIT',
    'LOOK', 'TALK', 'ASK', 'CALL', 'WAIT', 'REST', 'RIDE', 'SAVE', 'LOAD', 'NEW', 'CLEAR', 'DEBUG', 'BLOCK'];
  for (const w of words) assert.ok(used.has(w), `no transcript uses ${w}`);
  const asked = new Set(transcripts.flatMap((g) => g.commands.filter((c) => /^ASK\s+\S/i.test(c)).map((c) => c.split(/\s+/)[1].toUpperCase())));
  for (const topic of ['DOG', 'ROAD', 'TOWN', 'ROUTES', 'WAR', 'SICKNESS', 'WORK']) assert.ok(asked.has(topic), `no transcript asks about ${topic}`);
  // the three kinds of place ENTER opens, by the line each prints
  assert.ok(allText.includes('Buildings gather. The road narrows.'));
  assert.ok(allText.includes('The land closes around you.'));
  const ruins = transcripts.find((g) => g.name === '04-enter-natural-ruins');
  const i = texts(ruins).indexOf('Old stones. A place avoided.');
  assert.ok(i >= 0 && texts(ruins).indexOf('Buildings gather. The road narrows.') > i, 'ruins transcript shows defect D6');
  // world events
  for (const line of ['Animals have been restless. You feel it in the roads.', 'A rumor spreads: sickness in a town you haven\'t seen.',
    'Soldiers begin to appear on the roads.', 'Word arrives: a town burned in the night.',
    'Word arrives late, like bad weather: the capital has fallen.', 'The wagon stops.', 'The password takes.']) {
    assert.ok(allText.includes(line), `no transcript logs: ${line}`);
  }
});

test('transcripts pin the defects M2 will fix', () => {
  const by = (name) => transcripts.find((g) => g.name === name);
  // D1: NEW refused after an ending
  const after = texts(by('17-after-an-ending'));
  assert.equal(after[after.indexOf('> NEW abc') + 1], 'The story is done. (LOAD <password> to continue elsewhere.)');
  // D4: the sixth TALK at one inn is a bare name tag
  const talk = by('05-talk-six-times').log.map(([, x]) => x);
  const lastTalk = talk.lastIndexOf('> TALK');
  assert.deepEqual(talk.slice(lastTalk + 1, lastTalk + 3), ['Innkeeper (ROAD):', '> STATUS']);
  // D8: RIDE logs five narration lines that are gone from the screen
  const ride = by('09-ride');
  assert.ok(texts(ride).includes('He complains the whole way.'));
  assert.deepEqual(ride.finalScreen.map(([, x]) => x), ['The wagon stops.', 'Right. Here we are.']);
  // D9: the wagon is drawn but no ride is offered
  assert.equal(texts(by('10-wagon-outstays-merchant')).at(-1), 'No ride is offered.');
  // D3: nobody is there, and a Wanderer answers
  assert.ok(texts(by('18-talk-to-nobody')).includes('Wanderer (ROAD):'));
  // D19: NEW inside a town leaves the player on the old town map of a world that no longer exists
  const stranded = by('27-new-inside-a-town');
  const lines = texts(stranded);
  const seeded = lines.indexOf('World seeded: other');
  assert.deepEqual(lines.slice(seeded + 1, seeded + 3), ['> LOOK', 'A crossing of streets.']);
});

test('world hashes: terrain, towns, capital and start tile for every sweep seed', () => {
  const golden = readWorldHashes();
  const game = load(LEGACY, { seed: 'hash-host' });
  let checked = 0;
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    assert.deepEqual(worldSignature(game, s), golden[s], `world for seed "${s}" changed`);
    checked++;
  }
  assert.equal(checked, 2000);
});

test('legacy save codes load to their recorded state', async (t) => {
  const { codes } = readLegacyCodes();
  const formats = new Set(codes.map((c) => c.format));
  for (const f of ['packed-v4', 'packed-v3', 'base32-v2', 'base32-oldest']) assert.ok(formats.has(f), `no code in format ${f}`);
  assert.ok(codes.filter((c) => c.format === 'packed-v4').length >= 10, 'at least 10 SAVE codes');
  for (const [i, c] of codes.entries()) {
    await t.test(`${i + 1}: ${c.format}, ${c.label}`, () => {
      const game = load(LEGACY, { seed: 'codes-host' });
      const reply = game.cmd('LOAD ' + c.code).map(([, text]) => text).slice(1);
      assert.deepEqual(reply, c.reply);
      assert.deepEqual(game.get(SNAPSHOT_EXPR), c.restores);
    });
  }
});

test('sweep: 1,992 of 2,000 seeds winnable; fresh-trail truth 40.1%', () => {
  const r = sweepCore(LEGACY, SWEEP_SIZE);
  assert.equal(r.winnable, 1992);
  assert.equal(r.dogTiles, 20494);
  assert.equal(r.veryNearWild, 51152);
  assert.equal((100 * r.freshTrailTruth).toFixed(1), '40.1');
});
