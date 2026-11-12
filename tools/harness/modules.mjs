// Plays the game straight from src/, with no page and no bundle.
//
// It installs a host that records what the logic writes, resets the one state
// object, seeds it the way the page's ?seed= does, and sends commands to the
// game's own runCommand(). playModules() returns the same fields play() returns
// for a single-file build, so one golden transcript checks both.

import crypto from 'node:crypto';
import { G, resetState } from '../../src/state.js';
import { setHost } from '../../src/io.js';
import { fnv1a32 } from '../../src/rng.js';
import { runCommand, startNewGame } from '../../src/commands.js';
import { mapHtml, posText, statusText } from '../../src/render.js';
import { tileAt } from '../../src/world.js';
import { WORLD_SIZE } from '../../src/tuning.js';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const stripTags = (s) => String(s).replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

// Start a clean game from a seed string. Returns the two line records the host keeps.
export function bootModules(seed) {
  const log = [];      // every line ever written, in order
  const screen = [];   // what a page would still show: cleared by clear(), capped at 300 lines
  setHost({
    out(text, cls) {
      const line = [cls === 'm' ? 'm' : '', String(text)];
      log.push(line); screen.push(line);
      while (screen.length > 300) screen.shift();
    },
    clear() { screen.length = 0; },
    render() {},
    legend() {},
    freshSeed() { throw new Error('an unseeded world was asked for in a seeded run'); },
  });
  resetState();
  G.seed = fnv1a32(seed);
  startNewGame();
  return { log, screen };
}

// Send commands to the running game. The old base32 loader reports a failed
// load on console.error; that is kept off the test output and returned instead.
export function sendModules(commands) {
  const consoleLines = [];
  const realError = console.error;
  console.error = (...a) => consoleLines.push(a.map(String).join(' '));
  try { for (const c of commands) runCommand(c); } finally { console.error = realError; }
  return consoleLines;
}

export function playModules(seed, commands) {
  const { log, screen } = bootModules(seed);
  sendModules(commands);
  const html = mapHtml();
  return {
    log: log.slice(),
    finalScreen: screen.slice(),
    finalMap: stripTags(html).replace(/\n$/, '').split('\n'),
    finalMapHash: crypto.createHash('sha256').update(html).digest('hex').slice(0, 16),
    finalStatus: statusText(),
    finalMode: G.mode,
    finalPos: posText(),
  };
}

// The same world signature tools/harness/golden.mjs takes from a single-file
// build: [16 hex digits of SHA-256(glyphs|towns|capital), start x, start y].
export function worldSignatureModules(seedStr) {
  bootModules(seedStr);
  let g = '';
  for (let y = 0; y < WORLD_SIZE; y++) for (let x = 0; x < WORLD_SIZE; x++) g += tileAt(x, y);
  const hash = crypto.createHash('sha256').update(g + '|' + JSON.stringify(G.towns) + '|' + JSON.stringify(G.capital)).digest('hex').slice(0, 16);
  return [hash, G.player.x, G.player.y];
}

// The same state copy as SNAPSHOT_EXPR in load.mjs, read straight from G.
export function snapshotModules() {
  const hintTiles = [];
  for (let i = 0; i < WORLD_SIZE * WORLD_SIZE; i++) if (G.hintBits[i >> 3] & (1 << (i & 7))) hintTiles.push(i);
  const npc = {};
  for (const id of Object.keys(G.npcMemory).sort()) {
    const n = G.npcMemory[id];
    npc[id] = { familiarity: n.familiarity | 0, trust: n.trust | 0, hostility: n.hostility | 0, flags: (n.flags || []).slice().sort() };
  }
  return {
    seed: G.seed | 0, mode: G.mode, x: G.player.x, y: G.player.y, fatigue: G.player.fatigue, rep: G.player.rep, steps: G.steps,
    events: Array.from(G.worldEvents).sort(), dogHintCount: G.dogHintCount, hintTiles, npc,
  };
}
