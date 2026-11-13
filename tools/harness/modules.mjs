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
import { passable, tileAt } from '../../src/world.js';
import { WORLD_SIZE } from '../../src/tuning.js';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const stripTags = (s) => String(s).replace(/<[^>]*>/g, '').replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

let current = { log: [], screen: [] };

// Start a clean game from a seed string. Returns the two line records the host keeps.
// opts.debug stands for opening the page with ?debug=1.
export function bootModules(seed, opts = {}) {
  const log = [];      // every line ever written, in order
  const screen = [];   // what a page would still show: cleared by clear(), capped at 300 lines
  current = { log, screen };
  setHost({
    debug() { return !!opts.debug; },
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

// Send commands and return the text of the lines they wrote.
export function say(...commands) {
  const before = current.log.length;
  sendModules(commands);
  return current.log.slice(before).map(([, text]) => text);
}
export const screenText = () => current.screen.map(([, text]) => text);

// Routes on the world map, by the game's own passable().
const STEP = [[0, -1, 'N'], [1, 0, 'E'], [0, 1, 'S'], [-1, 0, 'W']];
function bfs(sx, sy) {
  const N = WORLD_SIZE, dist = new Int16Array(N * N).fill(-1), prev = new Int16Array(N * N).fill(-1);
  const q = [[sx, sy]]; dist[sy * N + sx] = 0;
  for (let h = 0; h < q.length; h++) {
    const [x, y] = q[h];
    for (const [dx, dy] of STEP) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
      const i = ny * N + nx;
      if (dist[i] >= 0 || !passable(nx, ny)) continue;
      dist[i] = dist[y * N + x] + 1; prev[i] = y * N + x; q.push([nx, ny]);
    }
  }
  return { dist, prev };
}
// Nearest reachable world tile satisfying pred(x, y, distance), or null.
export function nearest(pred) {
  const N = WORLD_SIZE, { dist } = bfs(G.player.x, G.player.y); let best = null;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const d = dist[y * N + x];
    if (d >= 0 && pred(x, y, d) && (!best || d < best.d)) best = { x, y, d };
  }
  return best;
}
// Walk the world map to (x, y) by the shortest route. Returns false if there is none.
// A road can close on the way (M4), so the route is planned again after every step.
export function walkTo(x, y) {
  const N = WORLD_SIZE;
  for (let guard = 0; guard < 400 && G.mode === 'WORLD' && !(G.player.x === x && G.player.y === y); guard++) {
    const sx = G.player.x, sy = G.player.y, { dist, prev } = bfs(sx, sy);
    if (dist[y * N + x] < 0) return false;
    let cur = y * N + x;
    while (prev[cur] !== sy * N + sx) cur = prev[cur];
    const cx = cur % N, cy = (cur / N) | 0;
    sendModules([cx > sx ? 'E' : cx < sx ? 'W' : cy > sy ? 'S' : 'N']);
  }
  return G.mode === 'WORLD' && G.player.x === x && G.player.y === y;
}
// Walk a local map to cell (x, y): along the row, then the column.
export function localTo(x, y) {
  const cmds = [];
  for (let px = G.local.px; px !== x; px += px < x ? 1 : -1) cmds.push(px < x ? 'E' : 'W');
  for (let py = G.local.py; py !== y; py += py < y ? 1 : -1) cmds.push(py < y ? 'S' : 'N');
  sendModules(cmds);
  return G.local && G.local.px === x && G.local.py === y;
}

export function playModules(seed, commands, opts = {}) {
  const { log, screen } = bootModules(seed, opts);
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
