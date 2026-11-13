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
import { ROOT, LEGACY, GOLDEN, GOLDEN_V13, COMPARED_FIELDS, MOVED_YARDS, expectedWorld, readTranscripts, readWorldHashes, readLegacyCodes, readSaveCodes, SAVE_SNAPSHOT_EXPR, replay, worldSignature } from '../tools/harness/golden.mjs';
import { sweepCore, sweepGates, sweepGestures, sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import { build, DIST, MARKER } from '../tools/build.mjs';

const built = build();
const SWEEP_PINS = { winnable: 2000, dogTiles: 2000, veryNearWild: 2000 };
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

// M6 changed one thing in the markup: the side panel's six commands became an empty
// list the game fills from the same table HELP reads.
const V13_PANEL = `        <div class="small" style="margin-top:10px; line-height:1.6">
          <div><span class="kbd">N S E W</span> move</div>
          <div><span class="kbd">ENTER</span> town/wild</div>
          <div><span class="kbd">TALK</span> speak</div>
          <div><span class="kbd">CALL</span> call dog</div>
          <div><span class="kbd">ASK DOG</span> ask about</div>
          <div><span class="kbd">SAVE</span> password</div>
        </div>`;
const M6_PANEL = `        <div class="small" id="commands" style="margin-top:10px; line-height:1.6"></div>`;

test('bundle: markup and CSS are v13\'s, byte for byte, but for the side panel\'s command list', () => {
  const legacy = fs.readFileSync(LEGACY, 'utf8');
  assert.ok(legacy.includes(V13_PANEL));
  const head = legacy.slice(0, legacy.indexOf('<script>') + 8).replace(V13_PANEL, M6_PANEL);
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

test('bundle: every sweep seed still makes the world v13 made, and starts where v13 did on all but ten', () => {
  const v13 = readWorldHashes(GOLDEN_V13);
  const game = load(DIST, { seed: 'hash-host' });
  let moved = 0;
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    const s = sweepSeed(i);
    const now = worldSignature(game, s);
    assert.deepEqual(now, expectedWorld(v13[s], s), `world for seed "${s}" changed`);
    if (now[1] !== v13[s][1] || now[2] !== v13[s][2]) moved++;
  }
  assert.equal(moved, Object.keys(MOVED_YARDS).length);
  assert.equal(moved, 10);
});

test('goldens: the current world hashes are v13\'s, entry for entry, but for the ten moved yards', () => {
  const now = readWorldHashes(GOLDEN), v13 = readWorldHashes(GOLDEN_V13);
  delete now._source; delete v13._source;
  assert.deepEqual(Object.keys(now), Object.keys(v13));
  for (const s of Object.keys(v13)) assert.deepEqual(now[s], expectedWorld(v13[s], s), s);
});

// M6: the owner decided old codes need not load. v13's are refused with v13's lines.
test('bundle: codes made by v13 are refused, with v13\'s refusal line', () => {
  const { codes } = readLegacyCodes(GOLDEN_V13);
  assert.equal(codes.length, 19);
  for (const c of codes) {
    const game = load(DIST, { seed: 'codes-host' });
    assert.deepEqual(game.cmd('LOAD ' + c.code).map(([, text]) => text).slice(1), ['The password refuses to settle.'], `${c.format}: ${c.label}`);
  }
});

test('bundle: codes made by the current game load to their recorded state', async (t) => {
  const { codes } = readSaveCodes(GOLDEN);
  for (const [i, c] of codes.entries()) {
    await t.test(`${i + 1}: ${c.label}`, () => {
      const game = load(DIST, { seed: 'codes-host' });
      const reply = game.cmd('LOAD ' + c.code).map(([, text]) => text).slice(1);
      assert.deepEqual(reply, c.reply);
      assert.deepEqual(game.get(SAVE_SNAPSHOT_EXPR), c.restores);
    });
  }
});

// The sweep is pinned so that a change to the numbers is a decision, not an accident.
// v13: 1,992 of 2,000 winnable; the fresh-trail line true on 40.1% of the tiles that showed it.
// M2:  1,992; 40.2%.
// M3:  2,000; 100%. There is one dog tile per seed and the line is printed nowhere else.
test('bundle: sweep: every seed can be won and the fresh-trail line is always true', () => {
  const now = sweepCore(DIST, SWEEP_SIZE);
  assert.deepEqual({ winnable: now.winnable, dogTiles: now.dogTiles, veryNearWild: now.veryNearWild }, SWEEP_PINS);
  assert.deepEqual(now.unwinnable, []);
  assert.equal(now.freshTrailTruth, 1);
});

// M3 gates. Any seed that fails one fails the suite; the message names the seed.
test('bundle: sweep gates: a trail on every seed, one dog in every state of the clock, dates in their windows, and the dog in reach to the last step', () => {
  const g = sweepGates(DIST, SWEEP_SIZE);
  assert.deepEqual(g.failures, []);
  // Pinned with the sweep: the shape of the trails. M3 acceptance asks for 20 tiles or more on 95% of seeds.
  assert.ok(g.trail.atLeast20 >= 0.95 * SWEEP_SIZE);
  assert.deepEqual({ atLeast20: g.trail.atLeast20, min: g.trail.length.min, median: g.trail.length.median, max: g.trail.length.max, onRuins: g.trail.thresholdOnRuins, onOpenGround: g.trail.thresholdOnOpenGround, besideATown: g.trail.passesBesideATown },
    { atLeast20: 1997, min: 19, median: 31, max: 53, onRuins: 1401, onOpenGround: 599, besideATown: 964 });
  // M4: the dates, and the roads the clock closes while a player waits the whole game out.
  assert.deepEqual(g.clock, {
    war: { min: 30, median: 40, max: 50 },
    fall: { min: 55, median: 73, max: 90 },
    change: { min: 82, median: 105, max: 130 },
    closures: { none: 63, median: 4, max: 5 },
  });
});

// M5 acceptance: gesture accuracy on the sweep. 100% at trust 2; 85% to 91% at
// familiarity 3 without it. v13: 58.9%.
test('bundle: sweep: gestures are always true at trust 2, and 89.4% true at familiarity 3 without it', () => {
  const g = sweepGestures(DIST, SWEEP_SIZE);
  assert.equal(g.trustedRight, g.trusted);
  assert.ok(g.familiarRate >= 0.85 && g.familiarRate <= 0.91, `${(100 * g.familiarRate).toFixed(1)}%`);
  assert.deepEqual({ trusted: g.trusted, familiarRight: g.familiarRight }, { trusted: 21790, familiarRight: 19477 });
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
