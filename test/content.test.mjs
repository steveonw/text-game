// M5: every player-facing line, checked against the voice rules.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { load } from '../tools/harness/load.mjs';
import { LEGACY } from '../tools/harness/golden.mjs';
import * as POOLS from '../src/content/pools.js';
import { TOWN_ROLES, topicLines } from '../src/people.js';
import { G, resetState } from '../src/state.js';

const { BUILDING_POOLS, EVENT_OVERLAYS, TOPIC_FALLBACKS, PEOPLE, CABBAGE, INTERNAL, OMENS } = POOLS;
const ROLES = [...TOWN_ROLES, 'wanderer', 'survivor'];
const TOPICS = ['dog', 'road', 'routes', 'town', 'war', 'sickness', 'work'];

// Every entry {t, v, fam?} in a nested pool, with where it was found.
function entries(obj, where, out = []) {
  if (Array.isArray(obj)) obj.forEach((e, i) => out.push({ ...e, where: `${where}[${i}]` }));
  else for (const k of Object.keys(obj)) if (typeof obj[k] === 'object') entries(obj[k], `${where}.${k}`, out);
  return out;
}
const VECTORED = [
  ...entries(BUILDING_POOLS, 'BUILDING_POOLS'),
  ...entries({ plague: EVENT_OVERLAYS.plague.inject, routes: EVENT_OVERLAYS.routes.inject, war: EVENT_OVERLAYS.war.inject }, 'EVENT_OVERLAYS'),
  ...entries(TOPIC_FALLBACKS, 'TOPIC_FALLBACKS'),
  ...entries(PEOPLE, 'PEOPLE'),
];
const PLAIN = [
  ...Object.entries(CABBAGE).filter(([, v]) => Array.isArray(v)).flatMap(([k, v]) => v.map((t, i) => ({ t, where: `CABBAGE.${k}[${i}]` }))),
  ...Object.entries(INTERNAL).flatMap(([k, v]) => v.map((t, i) => ({ t, where: `INTERNAL.${k}[${i}]` }))),
  ...Object.entries(OMENS).flatMap(([k, v]) => v.map((t, i) => ({ t, where: `OMENS.${k}[${i}]` }))),
  ...Object.entries(POOLS.STONES).map(([k, t]) => ({ t, where: `STONES[${k}]` })),
  { t: POOLS.ROAD_CLOSED_RUMOR, where: 'ROAD_CLOSED_RUMOR' },
  ...POOLS.OPEN_GATE.filter(Boolean).map((t, i) => ({ t, where: `OPEN_GATE[${i}]` })),
  ...[...POOLS.GUIDE.offer, ...POOLS.GUIDE.walk, POOLS.GUIDE.declined].map((t, i) => ({ t, where: `GUIDE[${i}]` })),
  ...Object.entries(POOLS.LEGEND).flatMap(([k, v]) => v.map(([, t], i) => ({ t, where: `LEGEND.${k}[${i}]` }))),
  { t: POOLS.STATUS_GUARDED, where: 'STATUS_GUARDED' },
];
const words = (t) => t.trim().split(/\s+/).length;

test('content: every line is 10 words or fewer, with no exclamation mark and no digit', () => {
  for (const { t, where } of [...VECTORED, ...PLAIN]) {
    assert.equal(typeof t, 'string', where);
    assert.ok(t.length > 0, `${where}: empty`);
    assert.ok(words(t) <= 10, `${where}: ${words(t)} words: "${t}"`);
    assert.ok(!t.includes('!'), `${where}: "${t}"`);
    assert.ok(!/[0-9]/.test(t), `${where}: "${t}"`);
  }
});

test('content: every line that people say appears once, and has a five-number vector', () => {
  const seen = new Map();
  for (const { t, v, fam, where } of VECTORED) {
    assert.ok(!seen.has(t), `"${t}" is at ${seen.get(t)} and ${where}`);
    seen.set(t, where);
    assert.ok(Array.isArray(v) && v.length === 5 && v.every((x) => typeof x === 'number' && x >= 0 && x <= 1), `${where}: vector ${JSON.stringify(v)}`);
    if (fam !== undefined) assert.ok([2, 4].includes(fam), `${where}: fam ${fam}`);
  }
});

test('content: every role has at least two lines for every topic, seen or not', () => {
  for (const role of ROLES) {
    for (const topic of TOPICS) {
      resetState();
      G.local = { kind: role === 'wanderer' ? 'WILD' : 'TOWN', tx: 0, ty: 0 };
      // A trail is needed for the seen rule; any seed makes one.
      G.seed = 12345;
      const lines = topicLines(role, topic, 0, 0);
      assert.ok(lines.length >= 2, `${role} ${topic}: ${lines.length} lines`);
    }
    if (TOWN_ROLES.includes(role)) assert.ok(PEOPLE[role].unseen.length >= 2, `${role}: not-seen lines`);
  }
});

test('content: the earned lines: one at familiarity 2 and one at 4, for DOG, ROAD and ROUTES, for every town role', () => {
  for (const role of TOWN_ROLES) {
    for (const topic of ['dog', 'road', 'routes']) {
      assert.deepEqual(PEOPLE[role].earned[topic].map((e) => e.fam), [2, 4], `${role} ${topic}`);
    }
  }
});

test('content: a not-seen line does not read as a sighting', () => {
  for (const role of TOWN_ROLES) {
    for (const { t } of PEOPLE[role].unseen) {
      assert.ok(!/\bit\b/i.test(t), `${role}: "${t}" says "it"`);
      assert.ok(!/\b(ran|went|left|passed|came|slept|waited|drank|sat|looked)\b/i.test(t), `${role}: "${t}" moves in the past`);
    }
  }
});

test('content: no line gives a direction; directions are gestures', () => {
  for (const { t, where } of [...VECTORED, ...PLAIN]) assert.ok(!/\b(north|south|east|west)\b/i.test(t), `${where}: "${t}"`);
});

test('content: v13\'s lines are unchanged, word for word and vector for vector', () => {
  const v13 = load(LEGACY, { seed: 'content' });
  assert.deepEqual(v13.get('BUILDING_POOLS'), BUILDING_POOLS);
  assert.deepEqual(v13.get('EVENT_OVERLAYS'), EVENT_OVERLAYS);
  assert.deepEqual(v13.get('TOPIC_FALLBACKS'), TOPIC_FALLBACKS);
  assert.deepEqual(v13.get('CABBAGE'), CABBAGE);
  assert.deepEqual(v13.get('INTERNAL'), INTERNAL);
});

test('content: 118 lines are new in M5, and every one is marked for review in the source', async () => {
  assert.equal(entries(PEOPLE, 'PEOPLE').length, 118);
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/content/pools.js', import.meta.url), 'utf8');
  const block = src.slice(src.indexOf('export const PEOPLE'));
  for (const { t } of entries(PEOPLE, 'PEOPLE')) {
    const line = block.split('\n').find((l) => l.includes(JSON.stringify(t)) || l.includes(`t:"${t}"`));
    assert.ok(line && line.includes('// REVIEW'), `"${t}" is not marked // REVIEW`);
  }
});
