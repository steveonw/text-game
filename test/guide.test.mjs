// M7: the guide. Someone who has seen the dog, and points true, offers to show you
// where it rests; FOLLOW walks you there, paying for each step as a move does.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bootModules, say, walkTo, localTo, nearest } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { TUNE, WORLD_SIZE } from '../src/tuning.js';
import { isTownAt, passable, stepsFrom } from '../src/world.js';
import { dogTile, dogIsVeryNear } from '../src/trail.js';
import { townSeesTrail } from '../src/people.js';
import { trueGesture } from '../src/gesture.js';
import { GUIDE } from '../src/content/pools.js';

const OFFER = '(Type FOLLOW.)';

// A seed and a town that has (or has not) seen the dog, reachable from the yard; the
// player stands on the innkeeper's door, with someone there.
function inTown(seen, from = 1) {
  for (let i = from; i < from + 300; i++) {
    bootModules(`guide-${i}`);
    const t = nearest((x, y) => isTownAt(x, y) && townSeesTrail(x, y) === seen && !(G.capital && G.capital.x === x && G.capital.y === y));
    if (!t || !walkTo(t.x, t.y)) continue;
    say('REST');
    say('ENTER');
    if (G.mode !== 'LOCAL') continue;
    const p = G.local.npcs.find((n) => n.type !== 'w');
    if (!p || !localTo(p.x, p.y)) { say('EXIT'); continue; }
    return { seed: `guide-${i}`, town: t, i };
  }
  throw new Error('no town found');
}

function askUntil(times) {
  const heard = [];
  for (let i = 0; i < times; i++) heard.push(...say('ASK DOG'));
  return heard;
}

test('guide: a town that has seen the dog offers, once its person points true', () => {
  let offered = 0;
  for (let k = 0, from = 1; k < 30 && !offered; k++) {
    from = inTown(true, from).i + 1;
    const heard = askUntil(4);
    const gesture = heard.find((l) => l.startsWith('(A gesture: '));
    if (!heard.includes(OFFER)) continue;
    offered++;
    assert.ok(gesture, 'an offer comes with a gesture');
    assert.equal(gesture, `(A gesture: ${trueGesture('DOG', G.local.tx, G.local.ty)}.)`, 'and the gesture is true');
    const at = heard.indexOf(OFFER);
    assert.ok(GUIDE.offer.includes(heard[at - 1]), `the line before the offer is the guide's: "${heard[at - 1]}"`);
    assert.ok(!heard.includes('undefined'));
    break;
  }
  assert.ok(offered > 0, 'some town offered');
});

test('guide: a town that has not seen the dog never offers', () => {
  // Whether a town has seen the dog can change as the dog moves on, so it is read at each ask.
  for (let k = 0, from = 1; k < 6; k++) {
    from = inTown(false, from).i + 1;
    for (let a = 0; a < 6; a++) {
      const seen = townSeesTrail(G.local.tx, G.local.ty);
      const heard = say('ASK DOG');
      if (!seen) assert.ok(!heard.includes(OFFER), `guide-${from - 1}: an offer from a town that has not seen the dog`);
    }
  }
});

test('guide: FOLLOW walks to the dog by the shortest way, and costs a move for every step', () => {
  let done = 0;
  for (let i = 1; i < 300 && done < 5; i++) {
    bootModules(`guide-walk-${i}`);
    const t = nearest((x, y) => isTownAt(x, y) && townSeesTrail(x, y));
    if (!t || !walkTo(t.x, t.y)) continue;
    say('REST');
    say('ENTER');
    const p = G.local && G.local.npcs.find((n) => n.type !== 'w');
    if (!p || !localTo(p.x, p.y)) continue;
    if (!askUntil(4).includes(OFFER)) continue;
    const dog = dogTile();
    const far = stepsFrom(dog.x, dog.y, passable)[t.y * WORLD_SIZE + t.x];
    const before = G.steps, fatigue = G.player.fatigue;
    const lines = say('FOLLOW');
    if (G.mode === 'END') continue; // the clock ran out on the way
    assert.equal(G.mode, 'WORLD');
    assert.ok(dogIsVeryNear(G.player.x, G.player.y), 'it ends on the dog\'s tile');
    assert.ok(lines.includes('The trail is fresh. ENTER to search.'), 'and LOOK says so');
    assert.ok(G.steps - before >= far, `${G.steps - before} steps for a walk of ${far}`);
    assert.ok(G.steps - before <= far * TUNE.exhaustedMoveSteps);
    assert.ok(G.player.fatigue >= Math.min(5, fatigue + far * TUNE.moveFatigue) || G.player.fatigue === 5);
    for (const l of GUIDE.walk) assert.ok(lines.includes(l), `"${l}"`);
    assert.ok(!lines.includes('undefined'));
    done++;
  }
  assert.ok(done >= 3, `${done} walks checked`);
});

test('guide: FOLLOW with no offer goes nowhere', () => {
  bootModules('guide-none');
  const x = G.player.x, y = G.player.y, steps = G.steps;
  assert.ok(say('FOLLOW').includes('No one is leading.'));
  assert.equal(G.player.x, x); assert.equal(G.player.y, y); assert.equal(G.steps, steps);
});
