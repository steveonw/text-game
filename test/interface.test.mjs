// M6: the five endings and their numbers, the legend, LOOK's neighbour line, HELP and the map's label.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GOLDEN, readTranscripts, readSaveCodes } from '../tools/harness/golden.mjs';
import { bootModules, say, sendModules } from '../tools/harness/modules.mjs';
import { G } from '../src/state.js';
import { WORLD_SIZE } from '../src/tuning.js';
import { noise01 } from '../src/rng.js';
import { passable } from '../src/world.js';
import { trail } from '../src/trail.js';
import { enterKind, cmdHelp } from '../src/commands.js';
import { commandsHtml, legendHtml, legendItems, mapHtml, mapLabel } from '../src/render.js';
import { COMMANDS, LEGEND, OPEN_GATE } from '../src/content/pools.js';

const ENDINGS = ['Reunion', 'Homecoming', 'Found in Time', 'The Long Way Back', 'The Open Gate'];
const mapRows = () => mapHtml().replace(/<[^>]*>/g, '').replace(/&amp;/g, '&').replace(/\n$/, '').split('\n');
const transcriptsEnding = (name) => readTranscripts(GOLDEN).filter((t) => t.log.some(([, l]) => l === 'Ending: ' + name));

// Replay a transcript's commands on the modules, keeping the town tiles ENTERed (or reached by wagon) since the last LOAD or NEW.
function replayCounting(t) {
  bootModules(t.seed, { debug: !!t.debug });
  let entered = new Set();
  for (const c of t.commands) {
    const up = c.toUpperCase();
    if (up === 'ENTER' && G.mode === 'WORLD' && enterKind(G.player.x, G.player.y) === 'TOWN') entered.add(G.player.x + ',' + G.player.y);
    const steps = G.steps, seed = G.seed;
    sendModules([c]);
    if (up.startsWith('NEW')) entered = new Set();
    // the wagon stops inside a town: that town is entered too
    if (up === 'RIDE' && G.mode === 'LOCAL' && G.local.kind === 'TOWN' && G.steps !== steps) entered.add(G.player.x + ',' + G.player.y);
    // a LOAD that took: the towns entered are the code's
    if (up.startsWith('LOAD') && (G.seed !== seed || G.steps !== steps)) entered = new Set(G.towns.filter((_, i) => G.townsEntered & (1 << i)).map((t) => t.x + ',' + t.y));
  }
  return entered;
}

test('endings: a recorded game reaches each of the five, and after each NEW and LOAD work', () => {
  const code = readSaveCodes(GOLDEN).codes.at(-1).code;
  for (const name of ENDINGS) {
    const games = transcriptsEnding(name);
    assert.ok(games.length >= 1, `no recorded game ends as ${name}`);
    const ends = games.filter((t) => { bootModules(t.seed, { debug: !!t.debug }); sendModules(t.commands); return G.mode === 'END'; });
    assert.ok(ends.length >= 1, `${name}: a recorded game that stops at the ending`);
    for (const t of ends.slice(0, 1)) {
      for (const after of ['NEW abc', 'LOAD ' + code]) {
        bootModules(t.seed, { debug: !!t.debug });
        sendModules(t.commands);
        const out = say(after);
        assert.equal(G.mode, 'WORLD', `${name}: ${after} after the ending`);
        if (after.startsWith('LOAD')) assert.ok(out.includes('The password takes.'));
      }
    }
  }
});

test('endings: the four v13 endings keep their words; The Open Gate is new', () => {
  const said = (name) => { const t = transcriptsEnding(name)[0]; const i = t.log.findIndex(([, l]) => l === 'Ending: ' + name); return t.log.slice(0, i + 1).map(([, l]) => l); };
  assert.ok(said('Reunion').includes('It approaches slowly. Sniffs your hand.'));
  assert.ok(said('Homecoming').includes('The gate is still open.'));
  assert.ok(said('Found in Time').includes('Dust on its coat. Burrs in its fur.'));
  assert.ok(said('The Long Way Back').includes("It's thinner than you remember."));
  const gate = said('The Open Gate');
  for (const l of OPEN_GATE.filter(Boolean)) assert.ok(gate.includes(l), l);
});

test('endings: the numbers are true: steps, towns entered of towns, people spoken to, sign found of trail length', () => {
  let checked = 0;
  for (const t of readTranscripts(GOLDEN)) {
    const at = t.log.findIndex(([, l]) => l.startsWith('Ending: '));
    if (at < 0) continue;
    // the first ending in the transcript; replay up to the command that caused it
    const cmdIndex = t.log.slice(0, at).filter(([, l]) => l.startsWith('> ')).length - 1;
    const entered = replayCounting({ ...t, commands: t.commands.slice(0, cmdIndex + 1) });
    assert.equal(G.mode, 'END', t.name);
    const lines = t.log.slice(at).map(([, l]) => l);
    assert.ok(lines.includes('Steps taken: ' + G.steps), `${t.name}: steps`);
    assert.ok(lines.includes(`Towns entered: ${entered.size} of ${G.towns.length}`), `${t.name}: towns entered ${entered.size}, ${lines.find((l) => l.startsWith('Towns'))}`);
    assert.ok(lines.includes('People spoken to: ' + Object.keys(G.npcMemory).length), `${t.name}: people`);
    const found = trail().tiles.filter((p) => G.hintBits[(p.y * WORLD_SIZE + p.x) >> 3] & (1 << ((p.y * WORLD_SIZE + p.x) & 7))).length;
    assert.ok(lines.includes(`Sign found: ${found} of ${trail().tiles.length}`), `${t.name}: sign`);
    checked++;
  }
  assert.ok(checked >= 8, `${checked} endings checked`);
});

test('endings: a town reached by wagon counts as entered, as ENTER does', () => {
  const t = readTranscripts(GOLDEN).find((x) => x.name.startsWith('09-ride'));
  const entered = replayCounting(t);
  assert.ok(t.commands.some((c) => c.toUpperCase() === 'RIDE'));
  assert.equal(G.mode, 'LOCAL');
  assert.ok(entered.has(G.player.x + ',' + G.player.y), 'the wagon\'s town is counted by the replay');
  const marked = new Set(G.towns.filter((_, i) => G.townsEntered & (1 << i)).map((p) => p.x + ',' + p.y));
  assert.deepEqual([...marked].sort(), [...entered].sort());
  assert.ok(entered.size >= 2, 'the town ridden from and the town ridden to');
});

test('LOOK: on the world map it names the four neighbours, as the map draws them, for 1,000 tiles', () => {
  const NAME = Object.fromEntries(LEGEND.WORLD.map(([g, n]) => [g, n.toLowerCase()]));
  let n = 0;
  for (let s = 1; n < 1000; s++) {
    bootModules(`look-${s}`);
    G.worldEvents.add('war_started');
    G.worldEvents.add(`road_blocked_${trail().tiles[4].x}_${trail().tiles[4].y}`);
    for (let k = 0; k < 40 && n < 1000; k++) {
      const x = Math.floor(noise01(s, k, 7) * WORLD_SIZE), y = Math.floor(noise01(k, s, 9) * WORLD_SIZE);
      if (!passable(x, y)) continue;
      G.player.x = x; G.player.y = y;
      const rows = mapRows();
      const word = (nx, ny) => (nx < 0 || ny < 0 || nx >= WORLD_SIZE || ny >= WORLD_SIZE) ? 'the edge' : NAME[rows[ny][nx]];
      const want = `North: ${word(x, y - 1)}. East: ${word(x + 1, y)}. South: ${word(x, y + 1)}. West: ${word(x - 1, y)}.`;
      assert.ok(!want.includes('undefined'), want);
      assert.ok(say('LOOK').includes(want), `(${x},${y}): ${want}`);
      n++;
    }
  }
});

test('legend: world glyphs on the world map, local glyphs on a local map', () => {
  bootModules('legend-1');
  assert.deepEqual(legendItems(), LEGEND.WORLD);
  assert.ok(legendHtml().includes('T Town') && legendHtml().includes('? Sign') && !legendHtml().includes('Temple'));
  const town = G.towns[0];
  G.player.x = town.x; G.player.y = town.y;
  say('ENTER');
  assert.equal(G.local.kind, 'TOWN');
  assert.deepEqual(legendItems(), LEGEND.TOWN);
  assert.ok(legendHtml().includes('T Temple') && !legendHtml().includes('T Town'));
  say('EXIT');
  G.player.x = trail().tiles[1].x; G.player.y = trail().tiles[1].y;
  if (enterKind(G.player.x, G.player.y) === 'WILD') { say('ENTER'); assert.deepEqual(legendItems(), LEGEND.WILD); assert.ok(legendHtml().includes('^ Rock')); say('EXIT'); }
  const end = trail().tiles[trail().threshold];
  G.player.x = end.x; G.player.y = end.y;
  say('ENTER');
  assert.equal(G.local.kind, 'RUIN');
  assert.ok(legendHtml().includes('^ Standing stone') && legendHtml().includes('r Fallen stone'));
  // every glyph a local map draws is in its legend
  for (const kind of ['TOWN', 'WILD', 'RUIN']) for (const g of new Set(mapRows().join(''))) if (G.local.kind === kind) assert.ok(LEGEND[kind].some(([s]) => s === g), `${kind} draws ${g}`);
});

test('HELP lists every live command and alias, and the side panel shows the same', () => {
  bootModules('help-1');
  const out = say('HELP').slice(1);
  assert.equal(out[0], 'Commands:');
  for (const [cmd, what] of COMMANDS) {
    assert.ok(out.includes(`${cmd}: ${what}`), cmd);
    assert.ok(commandsHtml().includes(`<span class="kbd">${cmd.replace('<', '&lt;').replace('>', '&gt;')}</span> ${what}`), `panel: ${cmd}`);
  }
  // every command HELP names is understood
  const words = COMMANDS.flatMap(([cmd, what]) => [...cmd.split(' ').filter((w) => /^[A-Z]+$/.test(w)), ...(what.match(/\b[A-Z]{2,}\b/g) || [])]);
  for (const w of new Set(words)) {
    if (['DOG', 'ROAD', 'TOWN', 'ROUTES', 'WAR', 'SICKNESS', 'WORK', 'NEW', 'LOAD'].includes(w)) continue;
    bootModules('help-1');
    assert.ok(!say(w).includes('Nothing comes of that.'), `${w} is not understood`);
  }
  // DEBUG and BLOCK only on a debug page
  assert.ok(!out.some((l) => l.startsWith('DEBUG')));
  bootModules('help-1', { debug: true });
  assert.ok(say('HELP').some((l) => l.startsWith('DEBUG, BLOCK')));
});

test('the map\'s label states the mode and the position', () => {
  bootModules('label-1');
  assert.equal(mapLabel(), `World map. You are at ${G.player.x}, ${G.player.y}.`);
  const { x, y } = G.player;
  say('ENTER');
  assert.equal(mapLabel(), `${{ TOWN: 'Town', WILD: 'Wild', RUIN: 'Ruins' }[G.local.kind]} map, at ${x}, ${y}. You are at ${G.local.px}, ${G.local.py}.`);
});
