// M1: the build script's rules. Each rule the modules must keep is broken once,
// in a throwaway copy, and the build must refuse it with a message naming the rule.

import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { bundle, SRC, tokenize } from '../tools/build.mjs';

const made = [];
after(() => { for (const d of made) fs.rmSync(d, { recursive: true, force: true }); });

function fixture(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'quiet-roads-build-'));
  made.push(dir);
  for (const [name, text] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), text);
  return path.join(dir, 'main.js');
}
const refuses = (files, pattern) => assert.throws(() => bundle(fixture(files)), pattern);

test('build: a well-formed set of modules bundles in import order', () => {
  const r = bundle(fixture({
    'main.js': "import { greet } from './a.js';\nimport { NAME } from './b.js';\ngreet(NAME);\n",
    'a.js': "import { NAME } from './b.js';\nexport function greet(who){ return 'hello ' + who + NAME; }\n",
    'b.js': "export const NAME = 'x';\n",
  }));
  assert.deepEqual(r.order.map((f) => path.posix.basename(f)), ['b.js', 'a.js', 'main.js']);
  const script = r.html.slice(r.html.indexOf('<script>'), r.html.indexOf('</script>'));
  assert.ok(script.indexOf("const NAME = 'x';") < script.indexOf('function greet(who)'), 'b.js comes before a.js');
  assert.ok(script.indexOf('function greet(who)') < script.indexOf('greet(NAME);'), 'main.js comes last');
  assert.ok(!/^\s*(import|export)\b/m.test(script));
});

test('build: the words import and export are left alone inside strings and comments', () => {
  const r = bundle(fixture({
    'main.js': "import { A } from './a.js';\nconst note = \"export default nothing; import { x } from 'y'\"; // export const z = 1\nconst re = /import|export/g;\nA(note, re);\n",
    'a.js': "export function A(){ return `export ${1 + 1} import`; }\n",
  }));
  assert.ok(r.html.includes("\"export default nothing; import { x } from 'y'\"; // export const z = 1"));
  assert.ok(r.html.includes('const re = /import|export/g;'));
  assert.ok(r.html.includes('return `export ${1 + 1} import`;'));
});

test('build rule 1: only named, relative imports', () => {
  refuses({ 'main.js': "import a from './a.js';\n", 'a.js': 'export const a = 1;\n' }, /rule 1/);
  refuses({ 'main.js': "import * as a from './a.js';\n", 'a.js': 'export const a = 1;\n' }, /rule 1/);
  refuses({ 'main.js': "import { a as b } from './a.js';\n", 'a.js': 'export const a = 1;\n' }, /rule 1/);
  refuses({ 'main.js': "import { readFileSync } from 'node:fs';\n" }, /rule 1/);
  refuses({ 'main.js': "function f(){ return import('./a.js'); }\n", 'a.js': 'export const a = 1;\n' }, /rule 1/);
});

test('build rule 2: exports are declarations', () => {
  refuses({ 'main.js': 'export default function(){}\n' }, /rule 2/);
  refuses({ 'main.js': 'const a = 1;\nexport { a };\n' }, /rule 2/);
  refuses({ 'main.js': "export * from './a.js';\n", 'a.js': 'export const a = 1;\n' }, /rule 2/);
});

test('build rule 3: a name is imported from the module that exports it', () => {
  refuses({ 'main.js': "import { missing } from './a.js';\n", 'a.js': 'export const a = 1;\nconst missing = 2;\n' }, /rule 3/);
});

test('build rule 4: no top-level name in two modules', () => {
  refuses({ 'main.js': "import { a } from './a.js';\nfunction helper(){}\n", 'a.js': 'export const a = 1;\nfunction helper(){}\n' }, /"helper".*rule 4/);
});

test('build rule 5: top-level let only in main.js', () => {
  refuses({ 'main.js': "import { a } from './a.js';\nlet fine = 1;\n", 'a.js': 'export const a = 1;\nlet counter = 0;\n' }, /"let counter".*rule 5/);
  bundle(fixture({ 'main.js': 'let fine = 1;\nfunction f(){ let alsoFine = 2; return alsoFine + fine; }\n' }));
});

test('build rule 6: no import cycles', () => {
  refuses({ 'main.js': "import { a } from './a.js';\n", 'a.js': "import { b } from './b.js';\nexport const a = 1;\n", 'b.js': "import { a } from './a.js';\nexport const b = 2;\n" }, /import cycle.*rule 6/);
});

test('build rule 7: the page, the clock and the dice stay out of logic', () => {
  refuses({ 'main.js': "import { a } from './logic.js';\n", 'logic.js': "export function a(){ return document.title; }\n" }, /rule 7/);
  refuses({ 'main.js': "import { a } from './logic.js';\n", 'logic.js': "export function a(){ return Math.random(); }\n" }, /rule 7/);
  refuses({ 'main.js': "import { a } from './logic.js';\n", 'logic.js': "export function a(){ return Date.now(); }\n" }, /rule 7/);
  // comments and strings may mention them
  bundle(fixture({ 'main.js': "import { a } from './logic.js';\n", 'logic.js': "// never touches document or Math.random\nexport function a(){ return 'Date'; }\n" }));
});

test('build: the real source keeps the M1 sheet\'s two greps', () => {
  const files = fs.readdirSync(SRC, { recursive: true }).filter((f) => String(f).endsWith('.js')).map(String);
  assert.ok(files.length >= 14);
  for (const f of files) {
    const text = fs.readFileSync(path.join(SRC, f), 'utf8');
    const base = path.basename(f);
    if (base !== 'render.js' && base !== 'main.js') assert.ok(!/document\./.test(text), `${f} mentions "document."`);
    if (base !== 'main.js') assert.ok(!/Math\.random|Date\./.test(text), `${f} mentions Math.random or Date.`);
  }
});

test('build: the scanner tells code from strings, comments and regular expressions', () => {
  const kinds = (s) => tokenize(s).filter((t) => t.t !== 'ws').map((t) => t.t + ':' + t.v);
  assert.deepEqual(kinds('a / b'), ['id:a', 'punc:/', 'id:b']);
  assert.deepEqual(kinds('x.replace(/\\//g, "/")'), ['id:x', 'punc:.', 'id:replace', 'punc:(', 're:/\\//g', 'punc:,', 'str:"/"', 'punc:)']);
  assert.deepEqual(kinds("s = '//not a comment'; // a comment"), ['id:s', 'punc:=', "str:'//not a comment'", 'punc:;', 'com:// a comment']);
  assert.deepEqual(kinds('/[/"]/.test(s)'), ['re:/[/"]/', 'punc:.', 'id:test', 'punc:(', 'id:s', 'punc:)']);
});
