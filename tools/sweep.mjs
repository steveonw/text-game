// Seed sweep: measures how a build plays across many worlds.
//
//   node tools/sweep.mjs [htmlPath] [nSeeds]
//
// Seeds are fnv1a32("sweep-1") .. fnv1a32("sweep-N"), N = 2000 by default.
// The numbers this prints for legacy/quiet-roads-v13.html are the ones quoted
// in docs/SPEC.md section 3.
//
// Definitions
//   searchable tile   a tile where ENTER opens wilderness. In v13: plains and forest.
//                     From M2 (D6): natural ruins too. The game answers this itself
//                     from M2 on, through enterKind().
//   dog tile          a searchable tile where dogIsVeryNear(x, y) holds and
//                     generateWilderness(x, y).dog is not null
//   winnable          some dog tile can be reached from the start over tiles that
//                     are not water, mountain or blocked
//   fresh-trail truth dog tiles / very-near searchable tiles, summed over seeds
//
// From M3 the dog is on a trail, and these definitions still hold: "very near" is
// the dog's own tile, so there is one dog tile per seed and the truth is 100%.
//
// Gates (M3). On a build with a trail, sweepGates() checks every seed, and the
// test suite fails if any seed fails one:
//   1. there is a trail: an unbroken walk from the yard, no tile twice, with two
//      dens in order strictly between the yard and the threshold
//   2. the yard can reach den 1, den 2 and the threshold
//   3. in each state of the clock (quiet, war, fallen) the fresh-trail line holds
//      on exactly one tile, that tile can be reached, and ENTER there shows the dog
//   4. (M4) the war starts on step 30 to 50, the capital falls 25 to 40 steps
//      later, and the roads change 25 to 40 after that
//   5. (M4) waiting at the yard from the first step to the last, with every road
//      the clock closes: the dog can be walked to at every step, and the story
//      ends on the change date

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
  let ruinsSearchable = 0, ruinsVeryNear = 0, ruinDogTiles = 0;
  const dogs = [];
  for (let y=0;y<N;y++) for (let x=0;x<N;x++){
    const d = dist[y*N+x], r = d >= 0;
    if (r){ reach++; if (d > ecc) ecc = d; }
    const ruin = __isNaturalRuin(x,y);
    if (ruin){ ruins++; if (r && d > ruinFar) ruinFar = d; if (__enterableWild(x,y)) ruinsSearchable++; }
    if (r && dogIsNear(x,y)) nearReach++;
    if (dogIsVeryNear(x,y) && __enterableWild(x,y)){
      veryNearWild++; if (ruin) ruinsVeryNear++;
      if (__localAt(x,y).dog){
        dogTiles++; if (ruin) ruinDogTiles++;
        if (r){ dogTilesReach++; dogs.push({x:x,y:y}); if (bestDog < 0 || d < bestDog) bestDog = d; }
      }
    }
  }
  out.reach = reach; out.nearReach = nearReach; out.veryNearWild = veryNearWild;
  out.dogTiles = dogTiles; out.dogTilesReach = dogTilesReach; out.bestDog = bestDog;
  out.ruins = ruins; out.ecc = ecc; out.ruinFar = ruinFar;
  out.ruinsSearchable = ruinsSearchable; out.ruinsVeryNear = ruinsVeryNear; out.ruinDogTiles = ruinDogTiles;
  if (!full) return JSON.stringify(out);

  // towns: reachability, nearest, and which buildings are drawn
  let townsReach = 0, nearestTown = -1, bothRolled = 0, smithShownWhenBoth = 0, bothShownWhenBoth = 0, guardAtStreetEnd = 0;
  for (const t of towns){
    const d = dist[t.y*N+t.x];
    if (d >= 0){ townsReach++; if (nearestTown < 0 || d < nearestTown) nearestTown = d; }
    const rolled = ["I","M","S","T","G"].filter(function(b,i){ return noise01(t.x*10+i, t.y*10+i, SEED ^ 0x0B11D) > 0.38; });
    if (rolled.includes("S") && rolled.includes("G")){
      bothRolled++;
      const m = generateTown(t.x, t.y, false).map;
      const cells = m.join("");
      if (cells.includes("S")) smithShownWhenBoth++;
      if (cells.includes("S") && cells.includes("G")) bothShownWhenBoth++;
      if (m[4][7] === "G") guardAtStreetEnd++;
    }
  }
  out.townsReach = townsReach; out.nearestTown = nearestTown; out.bothRolled = bothRolled; out.smithShownWhenBoth = smithShownWhenBoth;
  out.bothShownWhenBoth = bothShownWhenBoth; out.guardAtStreetEnd = guardAtStreetEnd;

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
  // v13 and builds to M5 named the writer savePasswordPacked; from M6 it is savePassword.
  out.saveLen = (typeof savePassword === "function" ? savePassword() : savePasswordPacked()).length;
  return JSON.stringify(out);
}`;

const GATES = `
function __gates(seedStr){
  SEED = fnv1a32(seedStr); mode = "WORLD"; local = null; startNewGame();
  const N = WORLD_SIZE, fails = [];
  const t = trail(), L = t.tiles.length;
  // 1. a trail
  let whole = L >= 2 && t.tiles[0].x === player.x && t.tiles[0].y === player.y;
  const seen = {};
  for (let i=0;i<L;i++){
    const p = t.tiles[i], k = p.x+"_"+p.y;
    if (seen[k] || !passable(p.x,p.y)) whole = false;
    seen[k] = 1;
    if (i > 0 && Math.abs(p.x-t.tiles[i-1].x) + Math.abs(p.y-t.tiles[i-1].y) !== 1) whole = false;
  }
  if (!whole) fails.push("no trail");
  if (!(0 < t.den1 && t.den1 < t.den2 && t.den2 < t.threshold)) fails.push("dens out of place: " + [t.den1, t.den2, t.threshold].join(", "));
  // 2. the yard reaches den 1, den 2 and the threshold
  const dist = __bfsFrom(player.x, player.y).dist;
  const places = [["den 1", t.den1], ["den 2", t.den2], ["the threshold", t.threshold]];
  for (const pl of places){ const p = t.tiles[pl[1]]; if (!p || dist[p.y*N+p.x] < 0) fails.push("the yard cannot reach " + pl[0]); }
  // 3. the fresh-trail line, in each state of the clock
  const states = [["quiet", []], ["war", ["war_started"]], ["fallen", ["war_started", "capital_fallen"]]];
  // In the quiet every tile's map is opened. A map changes with the clock only where
  // the dog arrives or leaves, so in the later states only the dens, the threshold and
  // any tile that claims the dog are opened again.
  const dogPlaces = new Set([t.den1, t.den2, t.threshold].map(function(i){ return t.tiles[i].y*N + t.tiles[i].x; }));
  for (const st of states){
    worldEvents = new Set(st[1]);
    let fresh = 0, dogs = 0;
    for (let y=0;y<N;y++) for (let x=0;x<N;x++){
      const very = dogIsVeryNear(x,y);
      if (st[0] !== "quiet" && !very && !dogPlaces.has(y*N+x)) continue;
      const dog = __enterableWild(x,y) && !!__localAt(x,y).dog;
      if (very){
        fresh++;
        if (!dog) fails.push(st[0] + ": a fresh trail at (" + x + "," + y + ") and no dog on ENTER");
        if (dist[y*N+x] < 0) fails.push(st[0] + ": the dog's tile cannot be reached");
      }
      if (dog){ dogs++; if (!very) fails.push(st[0] + ": a dog at (" + x + "," + y + ") and no fresh trail"); }
    }
    if (fresh !== 1 || dogs !== 1) fails.push(st[0] + ": " + fresh + " fresh-trail tiles, " + dogs + " dog tiles");
  }
  worldEvents = new Set();
  const out = { fails: fails, length: L, den1: t.den1, den2: t.den2, onRuins: t.onRuins, via: !!t.via, startX: player.x, startY: player.y };
  if (typeof dates !== "function") return JSON.stringify(out);

  // 4. (M4) the three dates fall in their windows
  const d = dates();
  if (d.war < 30 || d.war > 50) fails.push("war on step " + d.war);
  if (d.fall - d.war < 25 || d.fall - d.war > 40) fails.push("the fall " + (d.fall - d.war) + " steps after the war");
  if (d.change - d.fall < 25 || d.change - d.fall > 40) fails.push("the change " + (d.change - d.fall) + " steps after the fall");
  // 5. (M4) wait at the yard from the first step to the last, with every closure the
  //    clock makes: at every step the dog's tile can be walked to from the yard, and
  //    ENTER there would show the dog. The story ends on the change date.
  //    The page is not drawn while waiting, and the walk is checked whenever the
  //    world has changed: a road closed, or the dog moved on.
  const yard = { x: player.x, y: player.y };
  const draw = HOST.render; HOST.render = function(){};
  let guard = 0, lost = -1, closures = 0, seenState = "";
  try {
    while (mode !== "END" && guard++ < 400){
      runCommand("WAIT");
      if (mode === "END") break;
      const state = worldEvents.size + "|" + dogIndex();
      if (state === seenState) continue;
      seenState = state;
      const dog = dogTile();
      const reach = __bfsFrom(yard.x, yard.y).dist;
      if (lost < 0 && (reach[dog.y*N+dog.x] < 0 || !__isDogTile(dog.x, dog.y))) lost = steps;
    }
  } finally { HOST.render = draw; }
  closures = 0;
  for (const e of worldEvents) if (e.startsWith("road_blocked_")) closures++;
  if (lost >= 0) fails.push("with closures, the dog could not be reached at step " + lost);
  if (mode !== "END" || steps !== d.change) fails.push("waiting ended at step " + steps + ", not on the change date " + d.change);
  if (closures > 6) fails.push(closures + " roads closed");
  out.war = d.war; out.fall = d.fall; out.change = d.change; out.closures = closures;
  return JSON.stringify(out);
}`;

export function openForSweep(htmlPath = LEGACY) {
  const game = load(htmlPath, { seed: 'sweep-host' });
  game.run(HELPERS);
  game.run(MEASURE);
  return game;
}

// M5: gesture accuracy. On every sweep seed, from every town, at ten steps of the
// quiet stage, ASK DOG of a trusted speaker (trust 2) and of a familiar one
// (familiarity 3, trust 0). A gesture is right when it points a step nearer the dog.
const GESTURES = `
function __gestureSweep(seedStr){
  SEED = fnv1a32(seedStr); mode = "WORLD"; local = null; startNewGame();
  const N = WORLD_SIZE, dog = dogTile();
  const toDog = __bfsFrom(dog.x, dog.y).dist;
  const STEP = {east:[1,0], west:[-1,0], south:[0,1], north:[0,-1]};
  const r = { trusted: 0, trustedRight: 0, familiar: 0, familiarRight: 0 };
  for (const t of towns){
    for (let s = 0; s < 10; s++){
      steps = s * 3;
      const right = function(d){ const v = STEP[d]; return toDog[(t.y+v[1])*N + t.x+v[0]] === toDog[t.y*N+t.x] - 1; };
      const a = gestureFor("DOG", t.x, t.y, {familiarity: 0, trust: 2}, "I");
      const b = gestureFor("DOG", t.x, t.y, {familiarity: 3, trust: 0}, "I");
      if (a){ r.trusted++; if (right(a)) r.trustedRight++; }
      if (b){ r.familiar++; if (right(b)) r.familiarRight++; }
    }
  }
  steps = 0;
  return JSON.stringify(r);
}`;

export function sweepGestures(htmlPath, n = SWEEP_SIZE) {
  const game = openForSweep(htmlPath);
  game.run(GESTURES);
  const total = { trusted: 0, trustedRight: 0, familiar: 0, familiarRight: 0 };
  for (let i = 1; i <= n; i++) {
    const r = JSON.parse(game.run(`__gestureSweep(${JSON.stringify(sweepSeed(i))})`));
    for (const k of Object.keys(total)) total[k] += r[k];
  }
  return { ...total, trustedRate: total.trustedRight / total.trusted, familiarRate: total.familiarRight / total.familiar };
}

// Does this build have a trail? v13 and M2 do not.
export const hasTrail = (game) => game.get('typeof trail === "function"');

// Runs the M3 gates on every sweep seed. `failures` is empty when every seed passes.
export function sweepGates(htmlPath, n = SWEEP_SIZE) {
  const game = openForSweep(htmlPath);
  if (!hasTrail(game)) throw new Error(`${htmlPath} has no trail to gate`);
  game.run(GATES);
  const rows = [], failures = [];
  for (let i = 1; i <= n; i++) {
    const r = JSON.parse(game.run(`__gates(${JSON.stringify(sweepSeed(i))})`));
    r.seed = sweepSeed(i);
    rows.push(r);
    for (const f of r.fails) failures.push(`${r.seed}: ${f}`);
  }
  const lengths = rows.map((r) => r.length);
  return {
    n, failures, rows,
    trail: {
      length: { min: quantile(lengths, 0), p05: quantile(lengths, 0.05), p25: quantile(lengths, 0.25), median: quantile(lengths, 0.5), p75: quantile(lengths, 0.75), p95: quantile(lengths, 0.95), max: quantile(lengths, 0.9999) },
      atLeast20: lengths.filter((x) => x >= 20).length,
      thresholdOnRuins: rows.filter((r) => r.onRuins).length,
      thresholdOnOpenGround: rows.filter((r) => !r.onRuins).length,
      passesBesideATown: rows.filter((r) => r.via).length,
      den1Position: { p05: quantile(rows.map((r) => r.den1), 0.05), median: quantile(rows.map((r) => r.den1), 0.5), p95: quantile(rows.map((r) => r.den1), 0.95) },
      den2Position: { p05: quantile(rows.map((r) => r.den2), 0.05), median: quantile(rows.map((r) => r.den2), 0.5), p95: quantile(rows.map((r) => r.den2), 0.95) },
    },
    clock: rows[0].change === undefined ? null : {
      war: { min: quantile(rows.map((r) => r.war), 0), median: quantile(rows.map((r) => r.war), 0.5), max: quantile(rows.map((r) => r.war), 0.9999) },
      fall: { min: quantile(rows.map((r) => r.fall), 0), median: quantile(rows.map((r) => r.fall), 0.5), max: quantile(rows.map((r) => r.fall), 0.9999) },
      change: { min: quantile(rows.map((r) => r.change), 0), median: quantile(rows.map((r) => r.change), 0.5), max: quantile(rows.map((r) => r.change), 0.9999) },
      closures: { none: rows.filter((r) => r.closures === 0).length, median: quantile(rows.map((r) => r.closures), 0.5), max: quantile(rows.map((r) => r.closures), 0.9999) },
    },
  };
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
    smithAndGuardBothRolled: { towns: sum('bothRolled'), smithDrawn: sum('smithShownWhenBoth'), bothDrawn: sum('bothShownWhenBoth'), guardAtStreetEnd: sum('guardAtStreetEnd') },
    naturalRuins: { tiles: sum('ruins'), searchable: sum('ruinsSearchable'), veryNear: sum('ruinsVeryNear'), dogTiles: sum('ruinDogTiles') },
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
  if (hasTrail(openForSweep(htmlPath))) {
    const g = sweepGates(htmlPath, n);
    console.log(JSON.stringify(g.trail, null, 2));
    if (g.clock) console.log(JSON.stringify(g.clock, null, 2));
    if (openForSweep(htmlPath).get('typeof gestureFor === "function"')) console.log('gestures: ' + JSON.stringify(sweepGestures(htmlPath, n)));
    console.log(`trail length 20 or more: ${g.trail.atLeast20} of ${n}`);
    console.log(`gates: ${g.failures.length ? g.failures.length + ' FAILED' : 'all ' + n + ' seeds pass'}`);
    for (const f of g.failures.slice(0, 40)) console.log('  ' + f);
    if (g.failures.length) process.exitCode = 1;
  }
  console.log(`(${((performance.now() - t0) / 1000).toFixed(1)} s)`);
}
