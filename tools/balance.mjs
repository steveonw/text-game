// Balance: the bots on the 2,000-seed sweep, checked against the 1.0 targets
// (spec 4.8, M7 sheet).
//
//   node tools/balance.mjs [htmlPath] [nSeeds] [--json out.json] [--policies a,b] [--gate]
//
// --gate exits 1 if a target misses, except a target listed in OPEN: one the
// owner has yet to decide (see docs/balance.md). CI runs it on every push.
//
// Seeds are the sweep's, "sweep-1" .. "sweep-N" (N = 2000 by default). Each
// policy's seeds are split across worker processes, one per core.

import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { fork } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { runBot, summarize } from './bot.mjs';
import { load } from './harness/load.mjs';
import { SWEEP_SIZE, sweepSeed } from './sweep.mjs';

const HERE = fileURLToPath(import.meta.url);
const ROOT = path.resolve(path.dirname(HERE), '..');

export const POLICIES = ['explorer', 'tracker', 'resting', 'asker', 'waiter', 'homecoming'];
export const ENDINGS = ['Reunion', 'Homecoming', 'Found in Time', 'The Long Way Back', 'The Open Gate'];

// The targets. `signBot` is the bot that follows sign and never talks; `askBot`
// the one that asks, follows gestures and rides.
export const TARGETS = {
  signBot: 'resting', signDen1: [0.40, 0.60],
  askBot: 'asker', askDen1: [0.70, 0.85],
  earlyBefore: 12, earlyMax: 0.05,
  endingMin: 0.05,
  change: [80, 130],
};

// Targets reported but not gated: tuning alone cannot meet them (docs/balance.md).
export const OPEN = new Set(['askDen1']);

function runChunk(htmlPath, policy, from, to) {
  const runs = [];
  for (let i = from; i <= to; i++) runs.push(runBot(htmlPath, sweepSeed(i), policy));
  return runs;
}

function chunked(htmlPath, policy, n, jobs) {
  const size = Math.ceil(n / jobs);
  const parts = [];
  for (let j = 0; j < jobs; j++) {
    const from = j * size + 1, to = Math.min(n, (j + 1) * size);
    if (from > to) continue;
    parts.push(new Promise((resolve, reject) => {
      const child = fork(HERE, ['--worker', htmlPath, policy, String(from), String(to)], { silent: true });
      let out = '';
      child.stdout.on('data', (d) => { out += d; });
      child.stderr.on('data', (d) => process.stderr.write(d));
      child.on('exit', (code) => code === 0 ? resolve(JSON.parse(out)) : reject(new Error(`${policy} ${from}-${to}: exit ${code}`)));
    }));
  }
  return Promise.all(parts).then((xs) => xs.flat());
}

// The step the roads change on, for every sweep seed.
export function changeSteps(htmlPath, n = SWEEP_SIZE) {
  const out = [];
  for (let i = 1; i <= n; i++) out.push(load(htmlPath, { seed: sweepSeed(i) }).get('dates().change'));
  return out;
}

export async function balance(htmlPath, n = SWEEP_SIZE, policies = POLICIES, jobs = os.cpus().length) {
  const rows = {};
  for (const p of policies) rows[p] = summarize(p, await chunked(htmlPath, p, n, jobs));
  const change = changeSteps(htmlPath, n);
  return { runs: n, rows, change: { min: Math.min(...change), max: Math.max(...change) }, checks: check(rows, change, n) };
}

export function check(rows, change, n) {
  const T = TARGETS, out = [];
  const pct = (x) => x / n;
  const inRange = (x, [a, b]) => x >= a && x <= b;
  if (rows[T.signBot]) { const v = pct(rows[T.signBot].den1.beforeTheWar); out.push({ target: `${T.signBot} on den 1 before the war, 40% to 60%`, value: v, ok: inRange(v, T.signDen1) }); }
  if (rows[T.askBot]) { const v = pct(rows[T.askBot].den1.beforeTheWar); out.push({ target: `${T.askBot} on den 1 before the war, 70% to 85%`, value: v, ok: inRange(v, T.askDen1), open: OPEN.has('askDen1') }); }
  for (const [p, r] of Object.entries(rows)) { const v = pct(r.endedBeforeStep12); out.push({ target: `${p} ends before step 12 on 5% or fewer`, value: v, ok: v <= T.earlyMax }); }
  for (const e of ENDINGS) {
    const best = Math.max(...Object.values(rows).map((r) => r.endings[e] || 0));
    const by = Object.entries(rows).find(([, r]) => (r.endings[e] || 0) === best)?.[0];
    out.push({ target: `${e} reached by some bot on 5% or more`, value: pct(best), by, ok: pct(best) >= T.endingMin });
  }
  const lo = Math.min(...change), hi = Math.max(...change);
  out.push({ target: 'the roads change between step 80 and step 130', value: `${lo} to ${hi}`, ok: lo >= T.change[0] && hi <= T.change[1] });
  return out;
}

export function table(result) {
  const n = result.runs, pc = (x) => `${Math.round(100 * x / n)}%`;
  const lines = [];
  lines.push(`| Bot | On den 1 before the war | ${ENDINGS.join(' | ')} | None | Ends before step 12 | Steps at the ending: p10, median, p90 |`);
  lines.push(`| --- | --- | ${ENDINGS.map(() => '---').join(' | ')} | --- | --- | --- |`);
  for (const [p, r] of Object.entries(result.rows)) {
    const s = r.stepsAtEnding;
    lines.push(`| ${p} | ${r.den1.beforeTheWar} (${pc(r.den1.beforeTheWar)}) | ${ENDINGS.map((e) => r.endings[e] || 0).join(' | ')} | ${r.endings.none || 0} | ${r.endedBeforeStep12} | ${s.p10}, ${s.median}, ${s.p90} |`);
  }
  return lines.join('\n');
}

if (process.argv[2] === '--worker') {
  const [, , , htmlPath, policy, from, to] = process.argv;
  process.stdout.write(JSON.stringify(runChunk(htmlPath, policy, +from, +to)));
} else if (process.argv[1] && path.resolve(process.argv[1]) === HERE) {
  const args = process.argv.slice(2);
  const flag = (k) => { const i = args.indexOf(k); if (i < 0) return null; const v = args[i + 1]; args.splice(i, 2); return v; };
  const gate = args.includes('--gate'); if (gate) args.splice(args.indexOf('--gate'), 1);
  const jsonOut = flag('--json');
  const pol = flag('--policies');
  const htmlPath = path.resolve(args[0] || path.join(ROOT, 'dist', 'index.html'));
  const n = parseInt(args[1] || String(SWEEP_SIZE), 10);
  const t0 = Date.now();
  const result = await balance(htmlPath, n, pol ? pol.split(',') : POLICIES);
  console.log(`Bots on ${path.relative(ROOT, htmlPath)}, sweep seeds 1 to ${n}, ${Math.round((Date.now() - t0) / 1000)} s\n`);
  console.log(table(result));
  console.log('');
  for (const c of result.checks) console.log(`${c.ok ? 'ok  ' : c.open ? 'open' : 'MISS'} ${c.target}: ${typeof c.value === 'number' ? (100 * c.value).toFixed(1) + '%' : c.value}${c.by ? ' (' + c.by + ')' : ''}`);
  if (jsonOut) fs.writeFileSync(jsonOut, JSON.stringify(result, null, 1));
  const missed = result.checks.filter((c) => !c.ok && !c.open);
  if (gate && missed.length) { console.error(`\n${missed.length} target(s) missed.`); process.exit(1); }
}
