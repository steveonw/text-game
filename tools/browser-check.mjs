// Plays the golden transcripts in a real browser.
//
//   node tools/browser-check.mjs [htmlPath ...]
//
// The headless harness runs the game's script in node:vm with a stub page. This
// tool is the other half: it opens the file itself from file:// in headless
// Chrome, types each transcript's commands into the page's own input box, and
// compares what the page shows at the end with what the golden recorded. It
// also fails on any uncaught error, and on any request other than the page.
//
// Needs Node 22 or later (for the built-in WebSocket) and Chrome or Chromium on
// the path, or CHROME_PATH set. With no arguments it checks dist/index.html
// against test/golden/ and the legacy file against test/golden-v13/. A file
// named on the command line is checked against test/golden/, unless it is the
// legacy file. A transcript marked "debug" is opened with ?debug=1. No dependencies.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn, spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { ROOT, LEGACY, GOLDEN, GOLDEN_V13, readTranscripts } from './harness/golden.mjs';

function findChrome() {
  const names = [process.env.CHROME_PATH, 'google-chrome', 'google-chrome-stable', 'chromium', 'chromium-browser'].filter(Boolean);
  for (const n of names) {
    if (path.isAbsolute(n)) { if (fs.existsSync(n)) return n; continue; }
    const r = spawnSync('which', [n], { encoding: 'utf8' });
    if (r.status === 0 && r.stdout.trim()) return r.stdout.trim();
  }
  return null;
}

async function launch(chromePath) {
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-roads-chrome-'));
  const child = spawn(chromePath, ['--headless=new', '--no-sandbox', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
    '--disable-background-networking', '--disable-component-update', '--disable-sync', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'],
  { stdio: ['ignore', 'ignore', 'pipe'] });
  const wsUrl = await new Promise((resolve, reject) => {
    let buf = '';
    const timer = setTimeout(() => reject(new Error('Chrome did not report a DevTools address within 30 s')), 30000);
    child.stderr.on('data', (d) => { buf += d; const m = /DevTools listening on (ws:\/\/\S+)/.exec(buf); if (m) { clearTimeout(timer); resolve(m[1]); } });
    child.on('exit', (code) => { clearTimeout(timer); reject(new Error('Chrome exited early with code ' + code + '\n' + buf.slice(-800))); });
  });
  const close = () => { try { child.kill('SIGKILL'); } catch {} try { fs.rmSync(profile, { recursive: true, force: true }); } catch {} };
  return { wsUrl, close };
}

// A minimal Chrome DevTools Protocol client over the built-in WebSocket.
async function connect(wsUrl) {
  const ws = new WebSocket(wsUrl);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', () => reject(new Error('could not connect to Chrome')), { once: true }); });
  let nextId = 1; const pending = new Map(); const listeners = [];
  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) { const { resolve, reject } = pending.get(msg.id); pending.delete(msg.id); if (msg.error) reject(new Error(msg.error.message)); else resolve(msg.result); return; }
    for (const l of listeners) l(msg);
  });
  return {
    send(method, params = {}, sessionId) { const id = nextId++; ws.send(JSON.stringify({ id, method, params, sessionId })); return new Promise((resolve, reject) => pending.set(id, { resolve, reject })); },
    on(fn) { listeners.push(fn); },
    once(method, sessionId, ms = 15000) {
      return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error('timed out waiting for ' + method)), ms);
        const fn = (msg) => { if (msg.method === method && msg.sessionId === sessionId) { clearTimeout(timer); listeners.splice(listeners.indexOf(fn), 1); resolve(msg.params); } };
        listeners.push(fn);
      });
    },
    close() { ws.close(); },
  };
}

// Runs in the page: type each command into the input box and press Enter, then read the page.
const IN_PAGE = `(function(cmds){
  const el = document.getElementById('cmd');
  for (const c of cmds) { el.value = c; el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); }
  const text = (id) => document.getElementById(id).textContent;
  return JSON.stringify({
    screen: Array.from(document.getElementById('log').children).map(function(p){ const s = p.firstElementChild; return [s && s.className === 'm' ? 'm' : '', p.textContent]; }),
    map: text('mapOut'), mapHtml: document.getElementById('mapOut').innerHTML,
    status: text('statusLine'), mode: text('modeLabel'), pos: text('posLabel'), legendItems: document.getElementById('legend').children.length,
    // M6: the legend follows the mode; v13's was always the same 12 entries.
    legendWanted: (typeof legendItems === 'function') ? legendItems().length : 12, panel: (document.getElementById('commands') || {children: []}).children.length,
    label: document.getElementById('mapOut').getAttribute('aria-label'),
  });
})`;

export async function checkFile(cdp, htmlPath, transcripts) {
  const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
  const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
  const problems = [], requests = new Set(), gameConsole = [];
  cdp.on((msg) => {
    if (msg.sessionId !== sessionId) return;
    if (msg.method === 'Runtime.exceptionThrown') problems.push('uncaught: ' + (msg.params.exceptionDetails.exception?.description || msg.params.exceptionDetails.text));
    if (msg.method === 'Log.entryAdded' && msg.params.entry.level === 'error') problems.push('browser error: ' + msg.params.entry.text);
    if (msg.method === 'Network.requestWillBeSent') requests.add(msg.params.request.url);
    if (msg.method === 'Runtime.consoleAPICalled') {
      const first = msg.params.args[0]?.value;
      // v13's old loader reports a refused code with console.error("Load error:", e). That is the game's own message, not a fault.
      if (typeof first === 'string' && first === 'Load error:') gameConsole.push(first);
      else if (['error', 'warning', 'assert'].includes(msg.params.type)) problems.push(`console.${msg.params.type}: ${msg.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    }
  });
  for (const d of ['Page', 'Runtime', 'Log', 'Network']) await cdp.send(d + '.enable', {}, sessionId);
  const base = pathToFileURL(htmlPath).href;
  let matched = 0; const mismatches = [];
  for (const g of transcripts) {
    const url = `${base}?seed=${encodeURIComponent(g.seed)}${g.debug ? '&debug=1' : ''}`;
    const loaded = cdp.once('Page.loadEventFired', sessionId);
    await cdp.send('Page.navigate', { url }, sessionId);
    await loaded;
    const r = await cdp.send('Runtime.evaluate', { expression: `${IN_PAGE}(${JSON.stringify(g.commands)})`, returnByValue: true }, sessionId);
    if (r.exceptionDetails) { problems.push(`${g.name}: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}`); continue; }
    const page = JSON.parse(r.result.value);
    const diffs = [];
    if (JSON.stringify(page.screen) !== JSON.stringify(g.finalScreen)) diffs.push('log on screen');
    if (page.map.replace(/\n$/, '') !== g.finalMap.join('\n')) diffs.push('map');
    if (crypto.createHash('sha256').update(page.mapHtml).digest('hex').slice(0, 16) !== g.finalMapHash) diffs.push('map colours');
    if (page.status !== g.finalStatus) diffs.push('status line');
    if (page.mode !== g.finalMode) diffs.push('mode label');
    if (page.pos !== g.finalPos) diffs.push('position label');
    if (page.legendItems !== page.legendWanted) diffs.push('legend');
    if (page.legendWanted !== 12 && (page.panel < 10 || !/map/.test(page.label || ''))) diffs.push('side panel or map label');
    if (diffs.length) mismatches.push(`${g.name}: ${diffs.join(', ')}`); else matched++;
  }
  await cdp.send('Target.closeTarget', { targetId });
  const strays = [...requests].filter((u) => !u.startsWith(base) && u !== 'about:blank');
  return { file: path.relative(ROOT, htmlPath), transcripts: transcripts.length, matched, mismatches, problems, strays, gameConsole: gameConsole.length };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (typeof WebSocket === 'undefined') { console.error('browser-check needs Node 22 or later (built-in WebSocket).'); process.exit(2); }
  const chrome = findChrome();
  if (!chrome) { console.error('browser-check needs Chrome or Chromium. Set CHROME_PATH to its binary.'); process.exit(2); }
  const files = process.argv.slice(2).map((f) => path.resolve(f));
  if (!files.length) files.push(path.join(ROOT, 'dist', 'index.html'), LEGACY);
  for (const f of files) if (!fs.existsSync(f)) { console.error(`${path.relative(ROOT, f)} does not exist. Run "npm run build" first.`); process.exit(2); }
  const goldenFor = (f) => (f === LEGACY ? GOLDEN_V13 : GOLDEN);
  const browser = await launch(chrome);
  let failed = false;
  try {
    const cdp = await connect(browser.wsUrl);
    const version = await cdp.send('Browser.getVersion');
    console.log(`Browser: ${version.product}`);
    for (const f of files) {
      const golden = goldenFor(f);
      const r = await checkFile(cdp, f, readTranscripts(golden));
      const ok = r.matched === r.transcripts && !r.problems.length && !r.strays.length;
      failed = failed || !ok;
      console.log(`${ok ? 'ok  ' : 'FAIL'} ${r.file}: ${r.matched} of ${r.transcripts} transcripts in ${path.relative(ROOT, golden)} match on the page; ${r.problems.length} errors; ${r.strays.length} requests beyond the page itself`);
      for (const m of r.mismatches) console.log('     differs  ' + m);
      for (const p of [...new Set(r.problems)]) console.log('     error    ' + p);
      for (const s of r.strays) console.log('     request  ' + s);
    }
    cdp.close();
  } finally { browser.close(); }
  process.exit(failed ? 1 : 0);
}
