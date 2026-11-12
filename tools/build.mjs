// Builds the one file that ships: src/ modules -> dist/index.html.
//
//   node tools/build.mjs
//
// No bundler and no dependencies. Starting from src/main.js it follows the
// imports, puts the modules in an order where each comes after what it imports,
// drops the import statements and the word "export", and inlines the result
// into src/index.template.html as one strict-mode script.
//
// That only works because the modules keep to a few rules, and the build fails
// with a message if one is broken:
//
//   1. Imports are named and relative:  import { a, b } from './x.js';
//      No default imports, no namespace imports, no import().
//   2. Exports are declarations:  export function / const / class.
//      No "export default", no "export { }", no re-exports.
//   3. A name is imported only from the module that exports it.
//   4. No top-level name is declared in two modules: after bundling they share one scope.
//   5. Top-level "let" appears only in main.js. Game state lives in G (state.js).
//   6. No import cycles.
//   7. Only render.js and main.js use "document". Only main.js uses Math.random or Date.
//
// The output is a pure function of src/: no timestamps, no version stamps.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'src');
export const ENTRY = path.join(SRC, 'main.js');
export const TEMPLATE = path.join(SRC, 'index.template.html');
export const DIST = path.join(ROOT, 'dist', 'index.html');
export const MARKER = '/*__GAME_SCRIPT__*/';

const BANNER = `/* =========================================================
   The Quiet Roads
   Single-file, deterministic, no dependencies.
   Built from src/ by tools/build.mjs. Edit src/, not this file.
   ========================================================= */`;

class BuildError extends Error {}
const fail = (file, msg) => { throw new BuildError(`${path.relative(ROOT, file)}: ${msg}`); };

// A small JavaScript scanner: enough to tell code from strings, comments and
// regular expressions, so that keywords are only acted on where they are code.
export function tokenize(s, file = '<source>') {
  const toks = []; const n = s.length; let i = 0; let prev = null;
  const push = (t, v) => { const tok = { t, v }; toks.push(tok); if (t !== 'ws' && t !== 'com') prev = tok; };
  while (i < n) {
    const c = s[i];
    if (/\s/.test(c)) { let j = i; while (j < n && /\s/.test(s[j])) j++; push('ws', s.slice(i, j)); i = j; continue; }
    if (c === '/' && s[i + 1] === '/') { let j = s.indexOf('\n', i); if (j < 0) j = n; push('com', s.slice(i, j)); i = j; continue; }
    if (c === '/' && s[i + 1] === '*') { const e = s.indexOf('*/', i + 2); if (e < 0) fail(file, 'unterminated comment'); push('com', s.slice(i, e + 2)); i = e + 2; continue; }
    if (c === '"' || c === "'") {
      let j = i + 1;
      while (j < n && s[j] !== c) { if (s[j] === '\\') j++; if (s[j] === '\n') fail(file, 'unterminated string'); j++; }
      push('str', s.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '`') {
      let j = i + 1, depth = 0;
      while (j < n) {
        if (s[j] === '\\') { j += 2; continue; }
        if (depth === 0 && s[j] === '`') break;
        if (s[j] === '$' && s[j + 1] === '{') { depth++; j += 2; continue; }
        if (depth > 0 && s[j] === '{') depth++;
        if (depth > 0 && s[j] === '}') depth--;
        j++;
      }
      if (j >= n) fail(file, 'unterminated template literal');
      push('str', s.slice(i, j + 1)); i = j + 1; continue;
    }
    if (c === '/') {
      const p = prev;
      const regexOk = !p || (p.t === 'punc' && '(,=:[!&|?{};+-*%<>~^'.includes(p.v)) || (p.t === 'id' && ['return', 'typeof', 'case', 'in', 'of', 'do', 'else'].includes(p.v));
      if (regexOk) {
        let j = i + 1, inClass = false;
        while (j < n) { const ch = s[j]; if (ch === '\\') { j += 2; continue; } if (ch === '\n') fail(file, 'unterminated regular expression'); if (ch === '[') inClass = true; else if (ch === ']') inClass = false; else if (ch === '/' && !inClass) break; j++; }
        j++; while (j < n && /[a-z]/.test(s[j])) j++;
        push('re', s.slice(i, j)); i = j; continue;
      }
    }
    if (/[A-Za-z_$]/.test(c)) { let j = i; while (j < n && /[\w$]/.test(s[j])) j++; push('id', s.slice(i, j)); i = j; continue; }
    if (/[0-9]/.test(c) || (c === '.' && /[0-9]/.test(s[i + 1] || ''))) {
      const m = /^(0[xX][0-9a-fA-F_]+|0[bB][01_]+|0[oO][0-7_]+|\d[\d_]*\.?[\d_]*(?:[eE][+-]?\d+)?|\.\d[\d_]*(?:[eE][+-]?\d+)?)n?/.exec(s.slice(i, i + 64));
      push('num', m[0]); i += m[0].length; continue;
    }
    push('punc', c); i++;
  }
  return toks;
}

const DECL = new Set(['function', 'const', 'let', 'class', 'var']);

// Reads one module: its imports, its exports, its top-level names, and its code
// with the import statements and the word "export" removed.
function readModule(file) {
  const code = fs.readFileSync(file, 'utf8');
  const toks = tokenize(code, file);
  const sig = [];
  toks.forEach((t, k) => { if (t.t !== 'ws' && t.t !== 'com') sig.push(k); });
  const imports = [], exports = new Set(), tops = new Map(); // tops: name -> keyword
  const drop = new Set();
  let depth = 0;
  for (let q = 0; q < sig.length; q++) {
    const k = sig[q], tok = toks[k];
    const at = (d) => (q + d < sig.length ? toks[sig[q + d]] : { t: 'eof', v: '' });
    if (tok.t === 'punc') { if ('([{'.includes(tok.v)) depth++; else if (')]}'.includes(tok.v)) depth--; continue; }
    if (tok.t !== 'id') continue;
    if (tok.v === 'import' && at(1).v === '(') fail(file, 'import() is not allowed (rule 1)');
    if (depth !== 0) {
      if (tok.v === 'import' || tok.v === 'export') { const p = q > 0 ? toks[sig[q - 1]] : null; if (!(p && p.v === '.')) fail(file, `"${tok.v}" below the top level`); }
      continue;
    }
    if (tok.v === 'import') {
      if (at(1).v !== '{') fail(file, 'only named imports are allowed: import { a } from \'./x.js\' (rule 1)');
      const names = []; let d = 2;
      for (; at(d).v !== '}'; d++) { const x = at(d); if (x.t === 'eof') fail(file, 'unterminated import'); if (x.v === ',') continue; if (x.t !== 'id' || x.v === 'as') fail(file, 'imports may not be renamed (rule 1)'); names.push(x.v); }
      if (at(d + 1).v !== 'from' || at(d + 2).t !== 'str') fail(file, 'malformed import');
      const spec = at(d + 2).v.slice(1, -1);
      if (!spec.startsWith('.')) fail(file, `import from "${spec}": only relative imports are allowed (rule 1)`);
      let endQ = q + d + 2; if (at(d + 3).v === ';') endQ++;
      for (let z = k; z <= sig[endQ]; z++) drop.add(z);
      // also drop the rest of the line
      for (let z = sig[endQ] + 1; z < toks.length && toks[z].t === 'ws'; z++) { const nl = toks[z].v.indexOf('\n'); if (nl >= 0) { toks[z] = { t: 'ws', v: toks[z].v.slice(nl + 1) }; break; } drop.add(z); }
      imports.push({ names, from: path.resolve(path.dirname(file), spec) });
      q = endQ; continue;
    }
    if (tok.v === 'export') {
      let d = 1; if (at(d).v === 'async') d++;
      if (at(1).v === 'default') fail(file, '"export default" is not allowed (rule 2)');
      if (!DECL.has(at(d).v)) fail(file, `"export ${at(1).v}": only exported declarations are allowed (rule 2)`);
      let nameTok = at(d + 1); if (nameTok.v === '*') nameTok = at(d + 2);
      exports.add(nameTok.v);
      drop.add(k); if (toks[k + 1] && toks[k + 1].t === 'ws') drop.add(k + 1);
      continue;
    }
    if (DECL.has(tok.v)) {
      const p = q > 0 ? toks[sig[q - 1]] : null;
      if (p && p.v === '.') continue;
      let nameTok = at(1); if (nameTok.v === '*') nameTok = at(2);
      if (nameTok.t !== 'id') fail(file, `destructuring at the top level is not supported: "${tok.v} ${nameTok.v}"`);
      if (tops.has(nameTok.v)) fail(file, `"${nameTok.v}" is declared twice`);
      tops.set(nameTok.v, tok.v);
    }
  }
  if (depth !== 0) fail(file, 'unbalanced brackets');
  const body = toks.filter((_, k) => !drop.has(k)).map((t) => t.v).join('');
  const codeOnly = toks.filter((t) => t.t !== 'com' && t.t !== 'str').map((t) => t.v).join('');
  return { file, imports, exports, tops, body: body.replace(/^\s*\n/, '').replace(/\s+$/, '') + '\n', codeOnly };
}

// Returns { html, order } without writing anything.
export function bundle(entry = ENTRY) {
  const mods = new Map();
  const order = [];
  const state = new Map(); // file -> 'open' | 'done'
  const visit = (file, trail) => {
    if (state.get(file) === 'done') return;
    if (state.get(file) === 'open') fail(file, `import cycle: ${[...trail, file].map((f) => path.relative(SRC, f)).join(' -> ')} (rule 6)`);
    if (!fs.existsSync(file)) fail(trail.at(-1) || file, `imports a file that does not exist: ${path.relative(ROOT, file)}`);
    state.set(file, 'open');
    const m = readModule(file);
    mods.set(file, m);
    for (const imp of m.imports) visit(imp.from, [...trail, file]);
    state.set(file, 'done');
    order.push(file);
  };
  visit(entry, []);

  const owner = new Map();
  for (const file of order) {
    const m = mods.get(file), name = path.relative(SRC, file);
    for (const imp of m.imports) for (const n of imp.names) {
      if (!mods.get(imp.from).exports.has(n)) fail(file, `imports "${n}" from ${path.relative(SRC, imp.from)}, which does not export it (rule 3)`);
    }
    for (const [n, kw] of m.tops) {
      if (owner.has(n)) fail(file, `top-level name "${n}" is also declared in ${owner.get(n)} (rule 4)`);
      owner.set(n, name);
      if (kw === 'let' && file !== entry) fail(file, `top-level "let ${n}": state belongs in G, in state.js (rule 5)`);
    }
    const base = path.basename(file);
    if (/\bdocument\b/.test(m.codeOnly) && base !== 'render.js' && base !== 'main.js') fail(file, 'uses "document"; only render.js and main.js may (rule 7)');
    if (/\bMath\s*\.\s*random\b|\bDate\b/.test(m.codeOnly) && base !== 'main.js') fail(file, 'uses Math.random or Date; only main.js may (rule 7)');
  }

  const parts = [BANNER, "'use strict';"];
  for (const file of order) parts.push(`// ---------- src/${path.relative(SRC, file).split(path.sep).join('/')} ----------\n${mods.get(file).body.trimEnd()}`);
  const script = '\n' + parts.join('\n\n') + '\n';
  if (/<\/script/i.test(script)) throw new BuildError('the script contains "</script", which would end the script block early');

  const template = fs.readFileSync(TEMPLATE, 'utf8');
  if (template.split(MARKER).length !== 2) throw new BuildError(`src/index.template.html must contain ${MARKER} exactly once`);
  return { html: template.replace(MARKER, () => script.trim()), order: order.map((f) => path.relative(SRC, f).split(path.sep).join('/')), names: owner };
}

export function build(entry = ENTRY, out = DIST) {
  const r = bundle(entry);
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, r.html);
  return { ...r, out };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const r = build();
    console.log(`Built ${path.relative(ROOT, r.out)}: ${r.order.length} modules, ${r.names.size} top-level names, ${Buffer.byteLength(r.html)} bytes`);
    console.log(`Order: ${r.order.join(', ')}`);
  } catch (e) {
    if (e instanceof BuildError) { console.error('Build failed. ' + e.message); process.exit(1); }
    throw e;
  }
}
