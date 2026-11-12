# M1 · Modules

**Goal.** The same game, identical in behavior, built from source modules into one HTML file.

**Entry state.** Tag `m0`. CI is green. Golden transcripts, world hashes and legacy codes exist. The owner has settled the build decision (spec section 8); this sheet assumes the no-dependency build.

**Branch and tag.** `m1-modules`, tagged `m1` on merge.

**Read first.** Spec sections 2 and 5. The M0 exit report. `legacy/quiet-roads-v13.html`.

## Tasks

1. Split the v13 script into the modules in spec section 5: `rng`, `world`, `local`, `clock`, `people`, `content/pools`, `commands`, `endings`, `save`, `render`, `main`, `tuning`. Move code; do not rewrite it. `trail.js` does not exist yet, so the dog functions go in `world.js` for now.
2. Put all mutable state in one exported object, `G`: seed, mode, local map, steps, player, world events, people's memory, the two recent-line lists, the two last-step markers, towns, capital, wagon route, hint bits.
3. Logic writes text through an injected `out(text, cls)`. Only `render.js` and `main.js` touch `document`.
4. Create `src/index.template.html` from v13's markup and CSS, unchanged, with one marker where the script goes.
5. Write `tools/build.mjs`. It orders modules by their imports, strips `import` and `export`, concatenates them into the template and writes `dist/index.html`. It fails on a default export, a re-export, or a top-level name declared in two modules.
6. Tests, two layers:
    - `test/modules.test.mjs` imports `src/` directly and replays every golden transcript.
    - `test/bundle.test.mjs` loads `dist/index.html` in the harness and replays the same transcripts.
7. Move each number named in the spec's table 4.8, and v13's other thresholds, into `src/tuning.js` without changing a value.
8. CI runs `npm run build`, then `npm test`, and uploads `dist/index.html` as an artifact.

## Invariants

- Every golden transcript, world hash and legacy code from M0 passes unchanged, against both the modules and the bundle.
- No defect is fixed here, including the ones that look trivial.
- No player-facing text changes.

## Acceptance

- [ ] `git diff m0 -- test/golden` is empty.
- [ ] `dist/index.html` opens from `file://` with no console errors and no network requests.
- [ ] `grep -R "document\." src --include=*.js` matches only `render.js` and `main.js`.
- [ ] `grep -RE "Math\.random|Date\." src` matches only `main.js`.
- [ ] `legacy/quiet-roads-v13.html` still has its recorded SHA-256.

## Traps

- `packStateV3` declares `const V = 4`, which shadows the vector helper `V()`. Once modules share one scope in the bundle, rename the local.
- The line picker calls `noise01(f.t.length, (bestScore*10)|0, SEED ^ steps)` inside a loop. Its result depends on evaluation order, so moving code must not reorder those calls or transcripts drift.
- `recentFragments`, `recentInternal`, `lastInternalStep` and `lastPressureStep` are state. They belong in `G` and they are not saved.
- `DOG_HINT_BITS` is a typed array mutated in place. Keep exactly one instance.
- `render()` is called both inside commands and again by the input handlers. Keep both calls or the transcripts' final maps can differ.
- The END-mode branch in `runCommand` calls the old loader. That is defect D1. Leave it for M2.
- The legacy base32 loader upper-cases its input and the packed loader does not. Keep v13's order: try packed first.

## Out of scope

Bug fixes. New features. Renaming commands or text. Changing the page's look.

## Exit report

The standard report, plus the final module list with line counts and the build script's rules as implemented.
