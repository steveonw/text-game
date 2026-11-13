// Tuning trials: builds a variant of the game with some TUNE values changed and
// runs the bots on it, without touching src/.
//
//   node tools/tune.mjs key=value [key=value ...] [--seeds N] [--policies a,b]
//
// The variant is written to /tmp/quiet-roads-tune/<keys>.html. Used for the
// trials logged in docs/balance.md; a value is kept only by editing src/tuning.js.

import fs from 'node:fs';
import path from 'node:path';
import { bundle } from './build.mjs';
import { balance, table } from './balance.mjs';

export function variant(overrides) {
  let { html } = bundle();
  const start = html.indexOf('export const TUNE') >= 0 ? html.indexOf('export const TUNE') : html.indexOf('const TUNE = {');
  if (start < 0) throw new Error('TUNE not found in the bundle');
  const end = html.indexOf('};', start);
  let block = html.slice(start, end);
  for (const [k, v] of Object.entries(overrides)) {
    const re = new RegExp(`(\\n\\s*${k}:\\s*)[^,]+,`);
    if (!re.test(block)) throw new Error(`no TUNE.${k}`);
    block = block.replace(re, `$1${v},`);
  }
  html = html.slice(0, start) + block + html.slice(end);
  const dir = '/tmp/quiet-roads-tune';
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, (Object.entries(overrides).map(([k, v]) => `${k}-${v}`).join('_') || 'base') + '.html');
  fs.writeFileSync(file, html);
  return file;
}

if (process.argv[1] && path.resolve(process.argv[1]) === new URL(import.meta.url).pathname) {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const n = parseInt(flag('--seeds') || '500', 10);
  const pol = flag('--policies');
  const overrides = Object.fromEntries(args.map((a) => a.split('=')));
  const file = variant(overrides);
  const result = await balance(file, n, pol ? pol.split(',') : undefined);
  console.log(`${JSON.stringify(overrides)} on ${n} seeds`);
  console.log(table(result));
  for (const c of result.checks) if (!c.ok) console.log(`MISS ${c.target}: ${typeof c.value === 'number' ? (100 * c.value).toFixed(1) + '%' : c.value}`);
}
