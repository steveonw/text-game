// M5: people. Each test plays the modules directly and checks one thing the M5
// sheet promises.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, walkTo, localTo, nearest } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { TUNE, WORLD_SIZE } from '../src/tuning.js';
import { isTownAt, keyForXY, passable, stepsFrom } from '../src/world.js';
import { dogTile, signNear, trail } from '../src/trail.js';
import { generateTown } from '../src/local.js';
import { TOWN_ROLES, sayNPC, townSeesTrail } from '../src/people.js';
import { gestureFor, gestureTargets, trueGesture } from '../src/gesture.js';
import { BUILDING_POOLS, PEOPLE, TOPIC_FALLBACKS } from '../src/content/pools.js';

const N = WORLD_SIZE;
const at = (x, y) => y * N + x;
const texts = (list) => (list || []).map((f) => f.t);
const SLOT = { I: [2, 2], M: [6, 2], S: [2, 6], T: [6, 6], G: [7, 4] };
// A townsperson stands on the street, which v13 labels "Someone".
const NAME = { I: 'Innkeeper', M: 'Merchant', S: 'Smith', T: 'Priest', G: 'Guard', '.': 'Someone' };
const STEP = { east: [1, 0], west: [-1, 0], south: [0, 1], north: [0, -1] };
const TOPICS = ['DOG', 'ROAD', 'ROUTES', 'TOWN', 'WAR', 'SICKNESS', 'WORK'];

// The lines a role may say on a topic: the role's own, earned, not-seen and the layer beneath.
function allowed(role, topic) {
  const k = topic.toLowerCase(), add = PEOPLE[role] || {};
  return new Set([...texts((BUILDING_POOLS[role] || {})[k]), ...texts(add[k]), ...texts(add.earned && add.earned[k]), ...texts(k === 'dog' ? add.unseen : []), ...texts(TOPIC_FALLBACKS[k])]);
}

// Find a seed and town where every building stands, then stand at `role`'s door.
function atRole(role, { seen } = {}) {
  for (let i = 1; i < 400; i++) {
    bootModules(`people-${i}`);
    G.worldEvents.add('routes_stirring');
    const t = nearest((x, y) => {
      if (!isTownAt(x, y) || (G.capital && G.capital.x === x && G.capital.y === y)) return false;
      const town = generateTown(x, y, false);
      const has = role === '.' ? town.npcs.some((n) => n.type === 'n') : town.map[SLOT[role][1]][SLOT[role][0]] === role;
      return has && (seen === undefined || townSeesTrail(x, y) === seen);
    });
    if (!t || !walkTo(t.x, t.y)) continue;
    say('ENTER');
    const spot = role === '.' ? G.local.npcs.find((n) => n.type === 'n') : { x: SLOT[role][0], y: SLOT[role][1] };
    localTo(spot.x, spot.y);
    if (G.mode === 'LOCAL') return { town: t };
  }
  throw new Error(`no town with ${role}`);
}

test('people: for every role and topic, ASK returns lines written for that topic', () => {
  for (const role of TOWN_ROLES) {
    for (const topic of TOPICS) {
      atRole(role);
      const out = say('ASK ' + topic);
      assert.equal(out[1], `${NAME[role]} (${topic}):`, `${role} ${topic}`);
      const body = out.slice(2).filter((l) => !l.startsWith('(A gesture: '));
      const ok = allowed(role, topic);
      const overlays = ["People aren't well.", 'Best keep distance.', 'Paths overlap.', 'Directions feel unreliable.', 'Keep your head down.'];
      const said = body.filter((l) => !overlays.includes(l));
      assert.ok(said.length >= 1, `${role} ${topic}: something is said`);
      for (const l of said) assert.ok(ok.has(l), `${role} ${topic}: "${l}" is not a ${topic} line for ${role}`);
    }
  }
  // the wanderer and the survivor draw on their own pools
  for (const [role, cell] of [['wanderer', '.'], ['survivor', 'r']]) {
    bootModules('people-1');
    G.local = { kind: role === 'wanderer' ? 'WILD' : 'TOWN', tx: 0, ty: 0, map: [[cell]], px: 0, py: 0, npcs: [] };
    G.mode = 'LOCAL';
    const said = sayNPC(role, 'ROAD', { bodyLines: 1, overlayCap: 0 });
    assert.ok(texts(PEOPLE[role].openers).includes(said[0]), `${role}: its own opener`);
    assert.ok(texts(PEOPLE[role].road).includes(said[1]), `${role}: its own ROAD line`);
    assert.ok(texts(PEOPLE[role].close).includes(said[2]), `${role}: its own close`);
    const town = sayNPC(role, 'TOWN', { bodyLines: 1, overlayCap: 0, frame: false });
    assert.ok(texts(TOPIC_FALLBACKS.town).includes(town[0]), `${role}: TOWN from the generic layer`);
  }
});

test('people: TALK ten times and ASK ten times at one speaker: never empty, never one line twice in a reply', () => {
  for (const role of TOWN_ROLES) {
    atRole(role);
    for (let i = 0; i < 10; i++) {
      for (const cmd of ['TALK', 'ASK DOG', 'ASK ROAD', 'ASK TOWN']) {
        const out = say(cmd).slice(1);
        const body = out.slice(1).filter((l) => !l.startsWith('(A gesture: ') && l !== '');
        assert.ok(out[0].endsWith(':'), `${role} ${cmd}: a name tag`);
        assert.ok(body.length >= 1, `${role} ${cmd} #${i + 1}: empty reply`);
        assert.equal(new Set(body).size, body.length, `${role} ${cmd} #${i + 1}: a line twice in one reply`);
      }
    }
  }
});

test('people: earned lines are said only once their familiarity is reached', () => {
  for (const role of TOWN_ROLES) {
    const earned = PEOPLE[role].earned;
    for (const topic of ['road', 'routes']) {
      atRole(role);
      const two = earned[topic][0].t, four = earned[topic][1].t;
      const heard = [];
      for (let i = 1; i <= 6; i++) {
        const out = say('ASK ' + topic.toUpperCase());
        const fam = G.npcMemory[Object.keys(G.npcMemory).find((k) => k.includes(role === '.' ? 'ambient' : `npc_${role}_`))].familiarity;
        if (fam < 2) assert.ok(!out.includes(two), `${role} ${topic}: a familiarity-2 line at ${fam}`);
        if (fam < 4) assert.ok(!out.includes(four), `${role} ${topic}: a familiarity-4 line at ${fam}`);
        heard.push(...out);
      }
      assert.ok(heard.includes(two) && heard.includes(four), `${role} ${topic}: both earned lines are heard by the sixth ask`);
    }
  }
});

test('people: in a town more than two tiles from every sign tile, no v13 sighting is spoken', () => {
  for (const role of TOWN_ROLES) {
    const { town } = atRole(role, { seen: false });
    assert.ok(!signNear(town.x, town.y, 2));
    const sightings = new Set([...texts(BUILDING_POOLS[role].dog), ...texts(PEOPLE[role].earned.dog)]);
    const unseen = new Set(texts(PEOPLE[role].unseen));
    for (let i = 0; i < 6; i++) {
      for (const l of say('ASK DOG').slice(2)) {
        assert.ok(!sightings.has(l), `${role}: "${l}" is a sighting`);
        if (!l.startsWith('(') && !["People aren't well.", 'Best keep distance.', 'Paths overlap.', 'Directions feel unreliable.', 'Keep your head down.'].includes(l)) assert.ok(unseen.has(l), `${role}: "${l}"`);
      }
    }
  }
  // and in a town on the trail, the sightings are what is said
  for (const role of TOWN_ROLES) {
    atRole(role, { seen: true });
    const sightings = new Set([...texts(BUILDING_POOLS[role].dog), ...texts(PEOPLE[role].earned.dog)]);
    assert.ok(say('ASK DOG').slice(2).some((l) => sightings.has(l)), `${role}: a sighting on the trail`);
  }
});

test('gestures: none below familiarity 3 and trust 2; DOG, SICKNESS, WAR and TOWN point; ROAD only from a guard', () => {
  bootModules('gesture-1');
  const t = trail();
  const from = t.tiles[2];
  const stranger = { familiarity: 2, trust: 1 }, trusted = { familiarity: 0, trust: 2 };
  assert.equal(gestureFor('DOG', from.x, from.y, stranger, 'I'), null);
  assert.ok(gestureFor('DOG', from.x, from.y, trusted, 'I'));
  assert.ok(gestureFor('TOWN', from.x, from.y, trusted, 'I'), 'TOWN points to the nearest town');
  assert.equal(gestureFor('SICKNESS', from.x, from.y, trusted, 'I'), null, 'no sickness, no gesture');
  assert.equal(gestureFor('WAR', from.x, from.y, trusted, 'I'), null, 'no war damage, no gesture');
  const sick = G.towns.find((w) => !(w.x === from.x && w.y === from.y));
  G.worldEvents.add('plague_' + keyForXY(sick.x, sick.y));
  assert.ok(gestureFor('SICKNESS', from.x, from.y, trusted, 'I'));
  assert.equal(gestureFor('ROAD', from.x, from.y, trusted, 'G'), null, 'no closed road');
  G.worldEvents.add(`road_blocked_${t.tiles[8].x}_${t.tiles[8].y}`);
  assert.ok(gestureFor('ROAD', from.x, from.y, trusted, 'G'));
  assert.equal(gestureFor('ROAD', from.x, from.y, trusted, 'I'), null, 'ROAD points only for a guard');
  assert.ok(gestureFor('WAR', from.x, from.y, trusted, 'I'), 'a closed road is war damage');
  for (const topic of ['WORK', 'ROUTES']) assert.equal(gestureFor(topic, from.x, from.y, trusted, 'I'), null, topic);
});

test('gestures: each points the first step of the shortest walk to the nearest place it means', () => {
  for (const seed of ['gesture-1', 'gesture-2', 'gesture-3', 'sweep-1', 'sweep-99']) {
    bootModules(seed);
    const t = trail();
    G.worldEvents.add('war_started');
    G.worldEvents.add('plague_' + keyForXY(G.towns[0].x, G.towns[0].y));
    G.worldEvents.add(`road_blocked_${t.tiles[6].x}_${t.tiles[6].y}`);
    if (G.towns[1]) G.worldEvents.add('burned_' + keyForXY(G.towns[1].x, G.towns[1].y));
    for (const topic of ['SICKNESS', 'WAR', 'TOWN', 'ROAD']) {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (!passable(x, y)) continue;
        const dir = trueGesture(topic, x, y, 'G');
        const targets = gestureTargets(topic, x, y, 'G');
        const dists = targets.map((p) => { const d = stepsFrom(p.x, p.y, (a, b) => passable(a, b) || (a === p.x && b === p.y)); return d; });
        const near = (px, py) => Math.min(...dists.map((d) => (d[at(px, py)] < 0 ? 999 : d[at(px, py)])));
        const here = targets.length ? near(x, y) : 999;
        if (here === 999 || here === 0) { assert.equal(dir, null, `${seed} ${topic} (${x},${y})`); continue; }
        assert.ok(dir, `${seed} ${topic} (${x},${y}): a gesture`);
        const [dx, dy] = STEP[dir];
        assert.equal(near(x + dx, y + dy), here - 1, `${seed} ${topic} (${x},${y}) ${dir}`);
      }
    }
  }
});

test('gestures: always true at trust 2; at familiarity 3 without it, wrong about 12% of the time', () => {
  let trustedRight = 0, trustedAll = 0, familiarRight = 0, familiarAll = 0;
  for (let s = 1; s <= 40; s++) {
    bootModules(`sweep-${s}`);
    const dog = dogTile();
    const toDog = stepsFrom(dog.x, dog.y, passable);
    for (const town of G.towns) {
      for (let step = 0; step < 60; step++) {
        G.steps = step;
        const a = gestureFor('DOG', town.x, town.y, { familiarity: 0, trust: 2 }, 'I');
        const b = gestureFor('DOG', town.x, town.y, { familiarity: 3, trust: 0 }, 'I');
        const right = (d) => { const [dx, dy] = STEP[d]; return toDog[at(town.x + dx, town.y + dy)] === toDog[at(town.x, town.y)] - 1; };
        if (a) { trustedAll++; if (right(a)) trustedRight++; }
        if (b) { familiarAll++; if (right(b)) familiarRight++; }
      }
    }
  }
  assert.ok(trustedAll > 500 && familiarAll > 500, `${trustedAll} and ${familiarAll} gestures`);
  assert.equal(trustedRight, trustedAll, 'trusted: every gesture is true');
  const rate = familiarRight / familiarAll;
  assert.ok(rate >= 0.85 && rate <= 0.91, `familiar: ${(100 * rate).toFixed(1)}% true`);
});

test('gestures: ASK shows the gesture as v13 did', () => {
  const { town } = atRole('I', { seen: true });
  let shown = null;
  for (let i = 0; i < 4 && !shown; i++) shown = say('ASK DOG').find((l) => l.startsWith('(A gesture: '));
  assert.match(shown, /^\(A gesture: (north|south|east|west)\.\)$/);
  assert.ok(townSeesTrail(town.x, town.y));
});

test('rest: outside a town REST restores all fatigue, or 3 when sleep comes shallow; in a town, all of it; in a sick town, 1', () => {
  let deep = 0, shallow = 0;
  for (let i = 0; i < 40; i++) {
    bootModules(`rest-${i}`);
    G.player.fatigue = 5;
    const out = say('REST');
    assert.equal(G.mode, 'WORLD', 'REST works on the world map');
    if (out.includes('Sleep comes shallow. You wake too quickly.')) { shallow++; assert.equal(G.player.fatigue, 2); }
    else { deep++; assert.ok(out.includes('You rest. The world does not.')); assert.equal(G.player.fatigue, 0); }
    assert.equal(G.steps, TUNE.restSteps);
  }
  assert.ok(deep > 20 && shallow > 2, `${deep} deep, ${shallow} shallow`);
  // a town
  atRole('I');
  G.player.fatigue = 5; say('REST');
  assert.equal(G.player.fatigue, 0);
  G.worldEvents.add('plague_' + keyForXY(G.local.tx, G.local.ty));
  G.player.fatigue = 5; say('REST');
  assert.equal(G.player.fatigue, 4);
});

test('people: ASK of the cabbage merchant answers from the generic pool, as in v13', () => {
  for (let i = 1; i < 60; i++) {
    bootModules(`wagon-${i}`);
    const stop = G.cabbageRoute[0];
    if (!stop || !walkTo(stop.x, stop.y)) continue;
    say('ENTER');
    if (!G.local.wagon) { say('EXIT'); continue; }
    localTo(1, 4);
    const out = say('ASK ROAD');
    assert.equal(out[1], 'Cabbage Merchant (ROAD):');
    const generic = new Set(texts(BUILDING_POOLS['.'].road));
    const said = out.slice(2).filter((l) => !l.startsWith('(') && !["People aren't well.", 'Best keep distance.', 'Paths overlap.', 'Directions feel unreliable.', 'Keep your head down.'].includes(l));
    assert.ok(said.length >= 1 && said.every((l) => generic.has(l)), JSON.stringify(said));
    return;
  }
  throw new Error('no wagon found');
});
