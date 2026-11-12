# M0 · Baseline

**Goal.** v13 sits in the repo untouched, with a headless harness, golden transcripts and CI that lock its current behavior, defects included.

**Entry state.** The owner has settled where the game sits in the repo (spec section 8); this sheet assumes the root. The repo has one commit holding only `LICENSE`. You are given `quiet-roads-v13-better-ask-towns.html`, SHA-256 `85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c`.

**Branch and tag.** `m0-baseline`, tagged `m0` on merge.

**Read first.** The v13 file end to end. Spec sections 2 and 3.

## Tasks

1. Add `legacy/quiet-roads-v13.html`, byte for byte. Put its SHA-256 in the README.
2. Add `README.md`: what the game is, how to open the legacy file, how to run the tests.
3. Add `package.json` with `"type": "module"`, scripts `test`, `sweep` and `build`, and no dependencies. For now `build` only prints that there is nothing to build.
4. Add `tools/harness/load.mjs`. It extracts the `<script>` block from an HTML file and runs it in `node:vm` with stubs for `document`, `location`, `btoa` and `atob`. It records every line appended to the log and exposes `run(code)` and `cmd(text)`.
5. Add `tools/sweep.mjs`. For each seed `fnv1a32("sweep-1")` to `fnv1a32("sweep-2000")` it sets `SEED`, calls `startNewGame()`, and prints the measures in spec section 3. Two definitions matter:
    - A **dog tile** is a plains or forest tile where `dogIsVeryNear(x, y)` holds and `generateWilderness(x, y).dog` is not null. A seed is **winnable** if a dog tile can be reached from the start over tiles that are not water, mountain or blocked.
    - **Fresh-trail truth** is dog tiles divided by very-near plains and forest tiles, summed over all seeds. v13 gives 20,494 of 51,152.
6. Add at least 20 golden transcripts in `test/golden/`, each `{seed, commands, log, finalMap}`, recorded from v13. Between them they cover: a world walk; ENTER on a town, on wilderness and on a natural ruins tile; TALK six times at one speaker; ASK on every topic; WAIT; REST; RIDE; SAVE then LOAD; and a full game to each of the four endings.
7. Add `test/golden/world-hashes.json`: for each sweep seed, a hash of the 400 `tileAt` glyphs, the town list and the capital.
8. Add `test/golden/legacy-codes.json`: at least 10 SAVE codes from different states and one base32 code from `savePasswordLegacy()`, each with the state it should restore.
9. Add `test/legacy.test.mjs`. It replays every transcript against the legacy file, checks the world hashes, loads every legacy code, and asserts the two sweep numbers in the acceptance list.
10. Add `.github/workflows/ci.yml`: Node 20, `npm test`.

## Invariants

- No gameplay code is written or changed in this step.
- The legacy file's hash never changes.

## Acceptance

- [ ] `sha256sum legacy/quiet-roads-v13.html` matches the README.
- [ ] `npm test` passes locally and in CI.
- [ ] `npm run sweep` reports 1,992 of 2,000 seeds winnable and 40.1% fresh-trail truth.
- [ ] The transcripts contain all four ending names: Reunion, Homecoming, Found in Time, The Long Way Back.
- [ ] `package.json` lists no dependencies.

## Traps

- Top-level `let` and `const` in the v13 script are not properties of the vm global. Reach them by running code in the same context.
- `initialSeed()` uses `Date.now()` and `Math.random()`. Set `SEED` and call `startNewGame()` before recording anything.
- `clearLogSoft()` empties the log by setting `innerHTML = ""`. Record lines as they are appended, or RIDE's erased narration is lost. The stub must also empty its child list on that assignment.
- War and the capital's fall are pure functions of seed and step. To script an ending, scan `noise01(s, 9001, SEED ^ 0xBEEF) < 0.08` for `s > 28`, and `noise01(s, 1337, SEED ^ 0xC0DE) < 0.06` for `s > 60`, then WAIT to that step. The fall also needs `routes_stirring`, which needs three near tiles walked.
- Homecoming needs reputation 3 and 5 hint tiles before war. Choose a seed whose war step is late.
- After an ending v13 refuses NEW (defect D1). Start each transcript from a fresh load of the file.

## Out of scope

Fixing any defect. Splitting the file. New text.

## Exit report

The standard report, plus the seed used for each ending transcript.
