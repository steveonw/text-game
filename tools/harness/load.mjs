// Headless loader for a single-file build of The Quiet Roads.
//
// It pulls the one <script> block out of an HTML file and runs it, unmodified,
// in a node:vm context with a stub page. Nothing in the game is patched:
// commands go through the game's own runCommand(), exactly as the input box
// sends them.
//
//   const game = load('legacy/quiet-roads-v13.html', { seed: 'demo' });
//   game.cmd('LOOK');          // -> lines this command appended
//   game.map();                // -> the map as plain text
//   game.get('player');        // -> a JSON copy of any expression in the game
//
// With a seed the page is opened as ...?seed=<seed>, and Math.random and
// Date.now are replaced by functions that throw, so a run cannot be anything
// but deterministic.

import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s) => String(s).replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);
const stripTags = (s) => decode(String(s).replace(/<[^>]*>/g, ''));

export function extractScript(html) {
  const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  if (blocks.length !== 1) throw new Error(`expected exactly one <script> block, found ${blocks.length}`);
  return blocks[0][1];
}

function makeElement(id, onAppend) {
  let html = '';
  const el = {
    id,
    kids: [],
    textContent: '',
    value: '',
    className: '',
    scrollTop: 0,
    scrollHeight: 0,
    appendChild(child) { this.kids.push(child); if (onAppend) onAppend(child); return child; },
    removeChild(child) { const i = this.kids.indexOf(child); if (i >= 0) this.kids.splice(i, 1); return child; },
    get children() { return this.kids; },
    get firstChild() { return this.kids[0]; },
    addEventListener() {},
    focus() {},
  };
  // The game empties the log with innerHTML = "". Treat that as removing every child.
  Object.defineProperty(el, 'innerHTML', {
    get() { return html; },
    set(v) { html = String(v); if (html === '') el.kids = []; },
    enumerable: true,
  });
  return el;
}

// A logged line is [cls, text]: cls is "m" for the muted narrator voice and "" for speech.
function lineOf(p) {
  const h = p.innerHTML;
  if (h.startsWith('<span class="m">')) return ['m', stripTags(h)];
  return ['', String(p.textContent)];
}

export function load(htmlPath, opts = {}) {
  const { seed = null, search = null } = opts;
  const html = fs.readFileSync(htmlPath, 'utf8');
  const src = extractScript(html);

  const logs = [];           // every line ever appended, in order, erased or not
  const consoleLines = [];   // what the game sent to console.*
  const elements = new Map();
  const document = {
    getElementById(id) {
      if (!elements.has(id)) elements.set(id, makeElement(id, id === 'log' ? (p) => logs.push(lineOf(p)) : null));
      return elements.get(id);
    },
    createElement(tag) { return makeElement(`<${tag}>`, null); },
  };

  let mathObj = Math;
  let dateObj = Date;
  if (seed !== null) {
    mathObj = Object.create(Math);
    mathObj.random = () => { throw new Error('Math.random() called in a seeded run'); };
    dateObj = class GuardedDate { static now() { throw new Error('Date.now() called in a seeded run'); } };
  }
  const query = search !== null ? search : (seed !== null ? `?seed=${encodeURIComponent(seed)}` : '');

  const sandbox = {
    document,
    location: { search: query },
    console: {
      log: (...a) => consoleLines.push(['log', a.map(String).join(' ')]),
      warn: (...a) => consoleLines.push(['warn', a.map(String).join(' ')]),
      error: (...a) => consoleLines.push(['error', a.map(String).join(' ')]),
    },
    URLSearchParams,
    TextEncoder,
    TextDecoder,
    btoa: (s) => Buffer.from(String(s), 'binary').toString('base64'),
    atob: (s) => Buffer.from(String(s), 'base64').toString('binary'),
    Math: mathObj,
    Date: dateObj,
  };
  const context = vm.createContext(sandbox);
  vm.runInContext(src, context, { filename: htmlPath });

  // Top-level let/const in the game are not properties of the context's global,
  // so state is always read by running code in the same context.
  const run = (code) => vm.runInContext(code, context);
  const get = (expr) => {
    const s = run(`JSON.stringify(${expr})`);
    return s === undefined ? undefined : JSON.parse(s);
  };
  const el = (id) => document.getElementById(id);

  return {
    htmlPath,
    logs,
    consoleLines,
    run,
    get,
    // Send one command the way the page's input handler does.
    cmd(text) {
      const before = logs.length;
      run(`(function(v){ pushHistory(v); runCommand(v); render(); })(${JSON.stringify(text)})`);
      return logs.slice(before);
    },
    // Start a fresh game from a seed string without reloading the file.
    newGame(seedStr) {
      run(`SEED = fnv1a32(${JSON.stringify(seedStr)}); mode = "WORLD"; local = null; startNewGame();`);
    },
    map() { return stripTags(el('mapOut').innerHTML); },
    mapHtml() { return el('mapOut').innerHTML; },
    mapHash() { return crypto.createHash('sha256').update(el('mapOut').innerHTML).digest('hex').slice(0, 16); },
    status() { return String(el('statusLine').textContent); },
    modeLabel() { return String(el('modeLabel').textContent); },
    posLabel() { return String(el('posLabel').textContent); },
    legend() { return stripTags(el('legend').innerHTML); },
    // Lines still on screen: the log after any clearing and the 300-line cap.
    screen() { return el('log').kids.map(lineOf); },
  };
}

// Play a list of commands from a fresh load and return everything a test compares.
export function play(htmlPath, seed, commands) {
  const game = load(htmlPath, { seed });
  for (const c of commands) game.cmd(c);
  return {
    log: game.logs.slice(),
    finalScreen: game.screen(),
    finalMap: game.map(),
    finalMapHash: game.mapHash(),
    finalStatus: game.status(),
    finalMode: game.modeLabel(),
    finalPos: game.posLabel(),
    game,
  };
}

// A JSON copy of everything a save code is meant to carry.
export const SNAPSHOT_EXPR = `(function(){
  const hints = [];
  for (let i = 0; i < WORLD_SIZE * WORLD_SIZE; i++) if (DOG_HINT_BITS[i >> 3] & (1 << (i & 7))) hints.push(i);
  const npc = {};
  for (const id of Object.keys(npcMemory).sort()) {
    const n = npcMemory[id];
    npc[id] = { familiarity: n.familiarity | 0, trust: n.trust | 0, hostility: n.hostility | 0, flags: (n.flags || []).slice().sort() };
  }
  return {
    seed: SEED | 0, mode: mode, x: player.x, y: player.y, fatigue: player.fatigue, rep: player.rep, steps: steps,
    events: Array.from(worldEvents).sort(), dogHintCount: dogHintCount, hintTiles: hints, npc: npc
  };
})()`;
