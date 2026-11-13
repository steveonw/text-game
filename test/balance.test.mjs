// M7: the balance targets, checked on made-up rows so the gate's arithmetic is tested
// without running the bots. CI runs the bots themselves: `npm run balance`.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { check, OPEN, TARGETS } from '../tools/balance.mjs';

const row = (den1, endings, early = 0) => ({ den1: { beforeTheWar: den1 }, endings, endedBeforeStep12: early });
const ok = (checks) => checks.filter((c) => !c.ok && !c.open).map((c) => c.target);

test('balance: rows that meet every target pass the gate', () => {
  const rows = {
    resting: row(500, { Reunion: 300, 'Found in Time': 100, 'The Long Way Back': 60 }),
    asker: row(780, { Homecoming: 80 }),
    waiter: row(0, { 'The Open Gate': 1000 }),
  };
  const checks = check(rows, [80, 100, 130], 1000);
  assert.deepEqual(ok(checks), []);
  assert.ok(checks.every((c) => c.ok));
});

test('balance: each target misses where it should', () => {
  const rows = {
    resting: row(399, { Reunion: 300, 'Found in Time': 100, 'The Long Way Back': 49 }, 51),
    waiter: row(0, { 'The Open Gate': 1000, Homecoming: 50 }),
  };
  const missed = ok(check(rows, [79, 131], 1000));
  assert.ok(missed.some((t) => t.startsWith('resting on den 1')));
  assert.ok(missed.some((t) => t.startsWith('resting ends before step 12')));
  assert.ok(missed.some((t) => t.startsWith('The Long Way Back')));
  assert.ok(missed.some((t) => t.startsWith('the roads change')));
  assert.ok(!missed.some((t) => t.startsWith('Homecoming')), '50 of 1,000 is 5%, which is enough');
});

test('balance: no target is open, so a miss on the ask target fails the gate', () => {
  assert.equal(OPEN.size, 0);
  const rows = { [TARGETS.askBot]: row(270, {}) };
  const c = check(rows, [100], 1000).find((x) => x.target.startsWith(TARGETS.askBot + ' on den 1'));
  assert.equal(c.ok, false);
  assert.ok(!c.open);
});
