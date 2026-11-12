# M1 exit report

Step: M1 · Modules. Branch `m1-modules`. Written 2026-11-12.

The game is now built from 14 source modules into one HTML file, and it plays exactly as v13 does. No golden changed, no defect was fixed, and no player-facing text changed.

## 1. What changed, by file

| File | What it is |
| --- | --- |
| `src/*.js`, `src/content/pools.js` | v13's script, moved into modules. See the list below |
| `src/index.template.html` | v13's markup and CSS, byte for byte, with one marker where the script goes |
| `tools/build.mjs` | The build: `src/` to `dist/index.html`, with seven rules it enforces |
| `tools/browser-check.mjs` | New. Plays the golden transcripts in headless Chrome, on the real page |
| `tools/harness/modules.mjs` | New. Plays the modules directly, with no page and no bundle |
| `tools/harness/load.mjs` | Detects a `G` build and gives tools v13's variable names as accessors onto `G` |
| `tools/record-goldens.mjs` | Takes the build to record from and the folder to write to as arguments |
| `test/modules.test.mjs` | New. Every golden against the modules |
| `test/bundle.test.mjs` | New. Every golden against `dist/index.html`, plus checks on the file itself |
| `test/build.test.mjs` | New. Each build rule broken once and refused |
| `package.json` | `build` now builds; `sweep` and `bots` run on the build; `browser-check` added |
| `.gitignore` | `dist/` |
| `.github/workflows/ci.yml` | Builds, tests, uploads `dist/index.html`; a second job runs the browser check |
| `README.md` | How to build and play; how the build works |
| `docs/SPEC.md` | Build decision recorded; repo tree gains what M1 added |
| `docs/handoff/M2-repairs.md` | A first task added: freeze the v13 goldens before changing any |

### Modules

Bundle order, which is import order: each module comes after everything it imports.

| Module | Lines | Holds |
| --- | --- | --- |
| `tuning.js` | 80 | `WORLD_SIZE`, `LOCAL_SIZE`, and `TUNE`: 56 thresholds |
| `state.js` | 54 | `G`, the one state object; `resetState()` for tests |
| `io.js` | 25 | `log`, `clearLogSoft`, `render`, `renderLegend`, `freshSeed`: forwarders to the installed host |
| `rng.js` | 33 | `fnv1a32`, `mix32`, `noise01`, `nCentered`, `clamp` |
| `world.js` | 257 | Terrain, tiles, towns, capital, start tile, dog signal, hint bits, direction gesture |
| `render.js` | 127 | Palette, map and status strings, and the functions that write to the page |
| `clock.js` | 83 | The wagon's timetable; sickness, war, burning, the capital's fall |
| `content/pools.js` | 96 | Every pooled line and its mood vector |
| `endings.js` | 84 | The four endings |
| `local.js` | 110 | Wilderness and town maps |
| `people.js` | 201 | Memory, mood vector, line picker, the inner voice |
| `save.js` | 631 | The packed writer and all four readers |
| `commands.js` | 493 | The parser, every command, `startNewGame` |
| `main.js` | 68 | Boot, input, history, the unseeded seed |

### The build's rules, as implemented

1. Imports are named and relative. No default imports, no namespace imports, no renaming, no `import()`.
2. Exports are declarations. No `export default`, no `export { }`, no re-exports.
3. A name is imported only from the module that exports it.
4. No top-level name is declared in two modules.
5. Top-level `let` appears only in `main.js`.
6. No import cycles.
7. Only `render.js` and `main.js` use `document`. Only `main.js` uses `Math.random` or `Date`.

The script reads code with its own small scanner, so the words `import` and `export` inside strings, comments and regular expressions are left alone. The output is strict-mode and is a pure function of `src/`: building twice gives the same bytes.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 170
# pass 170
# fail 0
```

`npm run sweep`, on `dist/index.html`:

```
winnable: 1992 of 2000
fresh-trail truth: 40.1% (20494 of 51152)
```

Beyond the tests, four comparisons between the built file and the legacy file all came out identical:

- Every measure of the full sweep, over 2,000 seeds.
- Both bots over 500 seeds each: explorer 369, 94, 35 and 2 with no ending; homecoming 248, 180, 70 and 2.
- The goldens recorded afresh from the built file, seed search included. They differ from M0's only in the line that names the source.
- `npm run browser-check` in Chrome 153: 27 of 27 transcripts match on the page for both files, with no errors and no request beyond the page itself.

## 3. Goldens

None changed. `git diff m0 -- test/golden` is empty.

## 4. Acceptance

- [x] `git diff m0 -- test/golden` is empty.
- [x] `dist/index.html` opens from `file://` with no console errors and no network requests. Checked in headless Chrome by `npm run browser-check`, not only in the stub harness.
- [x] `grep -R "document\." src --include=*.js` matches only `render.js` and `main.js`.
- [x] `grep -RE "Math\.random|Date\." src` matches only `main.js`.
- [x] `legacy/quiet-roads-v13.html` still has its recorded SHA-256.

## 5. Left undone

- **Tags.** This session is not allowed to push tags: `git push origin m0` was refused with HTTP 403. The owner needs to create `m0` on the M0 merge commit, `5699ee4`, and `m1` when this merges.

## 6. Decisions the sheet did not cover

1. **Two modules beyond the sheet's list: `state.js` and `io.js`.** `G` needed a home that everything can import without a cycle. `io.js` is the injected `out(text, cls)` the sheet asks for, under the names v13's code already calls (`log`, `clearLogSoft`, `render`, `renderLegend`), so the moved code did not have to change.
2. **The code was moved by a script, not retyped.** A one-off tool cut the v13 script into its top-level declarations, renamed 501 references to the 17 state variables as `G.<field>`, and worked out each module's imports. It is not in the repo. The hand edits after it were: `io.js`, `state.js`, `main.js`, splitting `render()` in `render.js`, `cmdNew` asking the host for an unseeded seed, and one renamed local.
3. **`render()` became three string functions and one page function.** `mapHtml()`, `posText()` and `statusText()` build what v13's `render()` wrote, and `renderPage()` writes them. The module tests compare those strings without a page.
4. **An unseeded world comes from the host.** `initialSeed()` stays in `main.js`. `NEW` with no argument asks the host through `freshSeed()`, which keeps `Math.random` and `Date` out of logic.
5. **The bundle is strict-mode.** Modules are strict when imported, so the bundle is too. v13 was not. No golden, sweep measure or browser run shows a difference.
6. **`TUNE` holds 56 thresholds.** Each literal was cut out of the source by script and became the value in `tuning.js`, so none could change in transit. Left in place on purpose: noise salts, mood vectors, the 0-to-5 ranges that match word lists and the save format, the save format's own caps, and the cut-offs that only choose flavor text.
7. **`resetState()` in `state.js`.** The game never calls it. Module tests use it to start each replay from a clean page, since modules are loaded once per process.
8. **Tools keep v13's names.** The harness installs `SEED`, `steps`, `player` and the rest as accessors onto `G` when it loads a `G` build, so the sweep, bots and recorder run unchanged on either kind of file. Nothing in the game uses those names; the module tests would fail if it did.
9. **A real-browser check, and a CI job for it.** The sheet's "opens from `file://` with no console errors and no network requests" cannot be shown in a stub page. `tools/browser-check.mjs` shows it in Chrome. It needs Node 22 and Chrome, so it is a second CI job and not part of `npm test`.
10. **The input history stays in `main.js`,** outside `G`. It is the page's state, not the game's, and it is the one top-level `let` the build allows.

## 7. For M2

- **Freeze the v13 baseline first.** `test/legacy.test.mjs` replays `test/golden/` against the legacy file. The first repair changes a golden and would fail that test. The M2 sheet now starts with copying the goldens to `test/golden-v13/` and pointing the legacy test there.
- **Record from the build:** `node tools/record-goldens.mjs dist/index.html`. With no arguments it still records from the legacy file.
- **The recorder searches for seeds.** A repair can change which seed shows a case, which rewrites a whole transcript.
- **`local.wagonForced`, `pickMany`'s early return, the END branch in `runCommand`:** all moved untouched. They are where D9, D4 and D1 live.
- **`packStateV3`'s local `V` is now `VER`.** That was the one line of game code renamed.

## 8. Questions for the owner

1. Please create the tags `m0` (on `5699ee4`) and, after merging, `m1`. I cannot push tags from here.
2. The browser check runs in CI as its own job. If it ever proves flaky on GitHub's runners it can be dropped from CI without losing anything from `npm test`. Say if you would rather it were not there.
