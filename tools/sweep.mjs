// Seed sweep: measures how a build plays across many worlds.
//
//   node tools/sweep.mjs [htmlPath] [nSeeds]
//
// Seeds are fnv1a32("sweep-1") .. fnv1a32("sweep-N"), N = 2000 by default.
// The numbers this prints for legacy/quiet-roads-v13.html are the ones quoted
// in docs/SPEC.md section 3.
//
// Definitions
//   dog tile          a plains or forest tile where dogIsVeryNear(x, y) holds and
//                     generateWilderness(x, y).dog is not null
//   winnable          some dog tile can be reached from the start over tiles that
//                     are not water, mountain or blocked
//   fresh-trail truth dog tiles / very-near plains and forest tiles, summed over seeds

import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { load } from './harness/load.mjs';
import { HELPERS } from './harness/helpers.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LEGACY = path.join(ROOT, 'legacy', 'quiet-roads-v13.html');
export const SWEEP_SIZE = 2000;
export const sweepSeed = (i) => `sweep-${i}`;

const MEASURE = `
function __measure(seedStr, full){
  SEED = fnv1a32(seedStr); mode = "WORLD"; local = null; startNewGame();
  const N = WORLD_SIZE;
  const dist = __bfsFrom(player.x, player.y).dist;
  const out = { nTowns: towns.length, startX: player.x, startY: player.y };
  let reach = 0, nearReach = 0, veryNearWild = 0, dogTiles = 0, dogTilesReach = 0, bestDog = -1, ruins = 0, ecc = 0, ruinFar = -1;
  const dogs = [];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const d = dist[y*N+x], r = d >= 0;
    if (r){ reach++; if (d > ecc) ecc = d; }
    if (__isNaturalRuin(x,y)){ ruins++; if (r && d > ruinFar) ruinFar = d; }
    if (r && dogIsNear(x,y)) nearReach++;
    if (dogIsVeryNear(x,y) && __enterableWild(x,y)){
      veryNearWild++;
      if (generateWilderness(x,y).dog){
        dogTiles++;
        if (r){ dogTilesReach++; dogs.push({x:x,y:y}); if (bestDog < 0 || d < bestDog) bestDog = d; }
      }
    }
  }
  out.reach = reach; out.nearReach = nearReach; out.veryNearWild = veryNearWild;
  out.dogTiles = dogTiles; out.dogTilesReach = dogTilesReach; out.bestDog = bestDog;
  out.ruins = ruins; out.ecc = ecc; out.ruinFar = ruinFar;
  if (!full) return JSON.stringify(out);

  // towns: reachability, nearest, and which buildings are drawn
  let townsReach = 0, nearestTown = -1, bothRolled = 0, smithShownWhenBoth = 0;
  for (const t of towns){
    const d = dist[t.y*N+t.x];
    if (d >= 0){ townsReach++; if (nearestTown < 0 || d < nearestTown) nearestTown = d; }
    const rolled = ["I","M","S","T","G"].filter(function(b,i){ return noise01(t.x*10+i, t.y*10+i, SEED ^ 0x0B11D) > 0.38; });
    if (rolled.includes("S") && rolled.includes("G")){
      bothRolled++;
      const m = generateTown(t.x, t.y, false).map;
      if (m.some(function(row){ return row.includes("S"); })) smithShownWhenBoth++;
    }
  }
  out.townsReach = townsReach; out.nearestTown = nearestTown; out.bothRolled = bothRolled; out.smithShownWhenBoth = smithShownWhenBoth;

  // gesture: does ASK DOG's direction lead toward the nearest reachable dog tile?
  // Sampled at steps 0..19 because the gesture's mislead roll is keyed on the step count.
  let given = 0, none = 0, toward = 0, base = 0, baseN = 0;
  if (dogs.length){
    for (const t of towns){
      if (dist[t.y*N+t.x] < 0) continue;
      const dT = __bfsFrom(t.x, t.y).dist; let target = null, bd = 1e9;
      for (const g of dogs){ const dd = dT[g.y*N+g.x]; if (dd >= 0 && dd < bd){ bd = dd; target = g; } }
      if (!target) continue;
      const dG = __bfsFrom(target.x, target.y).dist, here = dG[t.y*N+t.x];
      const V = {north:[0,-1], south:[0,1], west:[-1,0], east:[1,0]};
      for (const k of Object.keys(V)){
        const nx = t.x+V[k][0], ny = t.y+V[k][1];
        if (nx<0||ny<0||nx>=N||ny>=N) continue;
        const ft = finalTileAt(nx,ny); if (ft === "~" || ft === "^") continue;
        baseN++; if (dG[ny*N+nx] >= 0 && dG[ny*N+nx] < here) base++;
      }
      const saved = steps;
      for (let s=0;s<20;s++){
        steps = s;
        const dir = dogDirectionHint(t.x, t.y);
        if (!dir){ none++; continue; }
        given++;
        const nx = t.x+V[dir][0], ny = t.y+V[dir][1];
        if (nx>=0&&ny>=0&&nx<N&&ny<N && dG[ny*N+nx] >= 0 && dG[ny*N+nx] < here) toward++;
      }
      steps = saved;
    }
  }
  out.gestureGiven = given; out.gestureNone = none; out.gestureToward = toward; out.base = base; out.baseN = baseN;
  out.warStep = __warStep(400); out.fallStep = __fallStep(400);
  out.saveLen = savePasswordPacked().length;
  return JSON.stringify(out);
}`;

export function openForSweep(htmlPath = LEGACY) {
  const game = load(htmlPath, { seed: 'sweep-host' });
  game.run(HELPERS);
  game.run(MEASURE);
  return game;
}

export function measureSeed(game, seedStr, full = false) {
  return JSON.parse(game.run(`__measure(${JSON.stringify(seedStr)}, ${full ? 'true' : 'false'})`));
}

// The two numbers the test suite pins, plus what they are made of.
export function sweepCore(htmlPath = LEGACY, n = SWEEP_SIZE) {
  const game = openForSweep(htmlPath);
  let winnable = 0, dogTiles = 0, veryNearWild = 0;
  const unwinnable = [];
  for (let i = 1; i <= n; i++) {
    const r = measureSeed(game, sweepSeed(i), false);
    if (r.dogTilesReach > 0) winnable++; else unwinnable.push(sweepSeed(i));
    dogTiles += r.dogTiles; veryNearWild += r.veryNearWild;
  }
  return { n, winnable, unwinnable, dogTiles, veryNearWild, freshTrailTruth: dogTiles / veryNearWild };
}

const sorted = (xs) => xs.slice().sort((a, b) => a - b);
export const quantile = (xs, p) => { const s = sorted(xs); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : null; };
const mean = (xs) => xs.reduce((a, b) => a + b, 0) / (xs.length || 1);
const pct = (a, b) => (b ? (100 * a / b).toFixed(1) + '%' : 'n/a');

export function sweepFull(htmlPath = LEGACY, n = SWEEP_SIZE) {
  const game = openForSweep(htmlPath);
  const rows = [];
  for (let i = 1; i <= n; i++) rows.push(measureSeed(game, sweepSeed(i), true));
  const col = (k) => rows.map((r) => r[k]);
  const sum = (k) => col(k).reduce((a, b) => a + b, 0);
  const win = rows.filter((r) => r.dogTilesReach > 0);
  const townsDist = {};
  for (const r of rows) townsDist[r.nTowns] = (townsDist[r.nTowns] || 0) + 1;
  const war = col('warStep').filter((x) => x > 0), fall = col('fallStep').filter((x) => x > 0);
  return {
    seeds: n,
    winnable: win.length,
    dogTilesReachablePerSeed: { median: quantile(col('dogTilesReach'), 0.5) },
    stepsToNearestDogTile: { median: quantile(win.map((r) => r.bestDog), 0.5), p90: quantile(win.map((r) => r.bestDog), 0.9) },
    nearTilesReachable: { median: quantile(col('nearReach'), 0.5) },
    reachableTiles: { median: quantile(col('reach'), 0.5) },
    freshTrail: { dogTiles: sum('dogTiles'), veryNearWildTiles: sum('veryNearWild'), truth: pct(sum('dogTiles'), sum('veryNearWild')) },
    gesture: { towardNearestDog: pct(sum('gestureToward'), sum('gestureGiven')), randomOpenDirection: pct(sum('base'), sum('baseN')), offered: pct(sum('gestureGiven'), sum('gestureGiven') + sum('gestureNone')) },
    warStep: { p10: quantile(war, 0.1), median: quantile(war, 0.5), p90: quantile(war, 0.9) },
    capitalFallStep: { p10: quantile(fall, 0.1), median: quantile(fall, 0.5), p90: quantile(fall, 0.9) },
    townsPerSeed: townsDist,
    seedsWithATownNotWalkable: rows.filter((r) => r.townsReach < r.nTowns).length,
    naturalRuinsPerSeed: { mean: Number(mean(col('ruins')).toFixed(1)) },
    startToNearestTown: { median: quantile(col('nearestTown').filter((x) => x >= 0), 0.5) },
    smithAndGuardBothRolled: { towns: sum('bothRolled'), smithDrawn: sum('smithShownWhenBoth') },
    farthestWalkableTile: { p05: quantile(col('ecc'), 0.05), median: quantile(col('ecc'), 0.5) },
    seedsWithNaturalRuin20StepsAway: rows.filter((r) => r.ruinFar >= 20).length,
    saveCodeLengthAtStep0: { min: quantile(col('saveLen'), 0), max: quantile(col('saveLen'), 0.9999) },
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const htmlPath = process.argv[2] ? path.resolve(process.argv[2]) : LEGACY;
  const n = parseInt(process.argv[3] || String(SWEEP_SIZE), 10);
  const t0 = performance.now();
  const r = sweepFull(htmlPath, n);
  console.log(`Sweep of ${path.relative(ROOT, htmlPath)} over ${n} seeds`);
  console.log(JSON.stringify(r, null, 2));
  console.log(`winnable: ${r.winnable} of ${n}`);
  console.log(`fresh-trail truth: ${r.freshTrail.truth} (${r.freshTrail.dogTiles} of ${r.freshTrail.veryNearWildTiles})`);
  console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
