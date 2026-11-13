// M6: save v5.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { load } from '../tools/harness/load.mjs';
import { HELPERS } from '../tools/harness/helpers.mjs';
import { ROOT, GOLDEN, SAVE_SNAPSHOT_EXPR, readSaveCodes } from '../tools/harness/golden.mjs';
import { bootModules, say } from '../tools/harness/modules.mjs';
import { sweepSeed, SWEEP_SIZE } from '../tools/sweep.mjs';
import path from 'node:path';

const DIST = path.join(ROOT, 'dist', 'index.html');
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

test('save: SAVE at step 0 is 40 characters or fewer on every sweep seed', () => {
  let longest = 0;
  for (let i = 1; i <= SWEEP_SIZE; i++) {
    bootModules(sweepSeed(i));
    const code = say('SAVE').at(-1);
    assert.match(code, /^[A-Za-z0-9_-]+$/);
    longest = Math.max(longest, code.length);
  }
  assert.ok(longest <= 40, `${longest} characters`);
});

test('save: a code with any one character changed is refused, with v13\'s line', () => {
  for (const { code } of readSaveCodes(GOLDEN).codes) {
    for (let i = 0; i < code.length; i++) {
      for (const ch of [B64[(B64.indexOf(code[i]) + 1) % 64], B64[(B64.indexOf(code[i]) + 37) % 64]]) {
        const changed = code.slice(0, i) + ch + code.slice(i + 1);
        bootModules('tamper');
        assert.deepEqual(say('LOAD ' + changed).slice(1), ['The password refuses to settle.'], `position ${i} of ${code}`);
      }
    }
  }
});

test('save: a code cut short, or with a character added, is refused', () => {
  const { code } = readSaveCodes(GOLDEN).codes.at(-1);
  for (const bad of [code.slice(0, -1), code.slice(1), code + 'A', 'A' + code]) {
    bootModules('tamper');
    const out = say('LOAD ' + bad).slice(1);
    assert.ok(['The password refuses to settle.', 'Invalid password.'].includes(out[0]) && out.length === 1, bad);
  }
});

// 200 mid-game states from the asker bot: at a point in each game, SAVE, and remember
// what the game held. LOAD of the code, in a fresh game, must restore every saved field.
test('save: round trip of 200 mid-game states from the asker bot', () => {
  const src = fs.readFileSync(path.join(ROOT, 'tools', 'bot.mjs'), 'utf8');
  const start = src.indexOf('const POLICY = `') + 'const POLICY = `'.length;
  const POLICY = src.slice(start, src.indexOf('`;', start));
  const FIELDS = ['seed', 'x', 'y', 'fatigue', 'rep', 'steps', 'events', 'dogHintCount', 'hintTiles', 'npc', 'townsEntered'];
  let checked = 0, inTown = 0, late = 0;
  for (let i = 1; checked < 200 && i <= 400; i++) {
    const game = load(DIST, { seed: `bot-${i}` });
    game.run(HELPERS);
    game.run(POLICY);
    const at = 3 + (i * 7) % 90; // the step to save at
    game.run(`var __saved = null; (function(){ const draw = HOST.render;
      HOST.render = function(){ draw(); if (!__saved && steps >= ${at} && mode !== "END") __saved = { code: savePassword(), state: ${SAVE_SNAPSHOT_EXPR}, local: mode === "LOCAL" }; };
    })();`);
    game.run('__botReset(); __runBot("asker")');
    const saved = game.get('__saved');
    if (!saved) continue;
    if (saved.local) inTown++;
    if (saved.state.steps > 40) late++;
    const fresh = load(DIST, { seed: 'round-trip-host' });
    assert.deepEqual(fresh.cmd('LOAD ' + saved.code).map(([, t]) => t).slice(1), ['The password takes.'], `bot-${i}`);
    const got = fresh.get(SAVE_SNAPSHOT_EXPR);
    for (const f of FIELDS) assert.deepEqual(got[f], saved.state[f], `bot-${i}: ${f}`);
    assert.equal(got.mode, 'WORLD', 'a code always loads onto the world map');
    checked++;
  }
  assert.ok(checked === 200 && inTown >= 20 && late >= 40, `${checked} states, ${inTown} saved inside a map, ${late} after step 40`);
});
