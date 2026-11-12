# The Quiet Roads

A single-file browser text game. The yard gate is open and your dog is gone. You search a seeded 20×20 world by typing commands while the world slowly comes apart.

One HTML file, no dependencies, nothing fetched from the network.

## Play

Needs Node 20 or later to build. There is nothing to install.

```
npm run build
```

Then open `dist/index.html` in a browser. Type `HELP` for the commands.

- Add `?seed=anything` to the address to get the same world every time.
- `SAVE` prints a password; `LOAD <password>` restores it.

The file it builds is the v13 prototype with twelve of its defects repaired: same worlds, same lines, same save codes. The prototype itself is kept, byte for byte and never edited, and can be opened the same way:

```
SHA-256  85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c  legacy/quiet-roads-v13.html
```

## Where this is going

`docs/SPEC.md` describes v13 as built, how it measures when played by script across 2,000 seeds, and the design for a finished 1.0. The work is split into eight steps, M0 to M7, each with a handoff sheet in `docs/handoff/` and an exit report in `docs/handoff/exits/`.

This repository is at **M2**: the game is built from source modules in `src/`, and the twelve v13 defects that needed no design decision are repaired, each with its own test. The design itself has not changed yet. That starts at M3.

What a v13 player would notice:

- After an ending, `NEW` and `LOAD` work.
- Nobody answers on a tile with nobody on it, and asking an empty field no longer earns reputation.
- People no longer fall silent after a few questions, and each topic gets its own lines.
- The smithy and the guard post both appear. The guard stands at the east end of the street.
- Natural ruins open as wilderness, not as a walled town. The dog can be there.
- A burned town and the fallen capital are burned inside, with one survivor.
- The ride on the cabbage wagon is told, and the merchant does not vanish from his wagon.
- `DEBUG` and `BLOCK` answer only on a page opened with `?debug=1`.

## Test

```
npm test                # goldens, repairs, worlds, save codes and build rules
npm run browser-check   # play the goldens in headless Chrome (Node 22 or later, and Chrome)
npm run sweep           # measure the built game across 2,000 seeds
npm run bots            # scripted players over 500 seeds (takes a few minutes)
npm run record          # build, then re-record test/golden/ from the build
```

`npm test` takes about two minutes. It fails if the legacy file changes by a byte, if any recorded game plays out differently, if any of 2,000 worlds is generated differently from v13's, if a save code made by v13 or by the current game stops loading, if a repaired defect comes back, or if a module breaks one of the build's rules.

There are two sets of recorded games:

- `test/golden/` is what the game does now: 28 transcripts, replayed against the modules, the built file and, in the browser check, the real page. Re-record it only when a change is meant, and say why in the step's exit report.
- `test/golden-v13/` is what v13 did: 27 transcripts, frozen, replayed against the legacy file. It is never re-recorded.

## How the build works

`tools/build.mjs` starts at `src/main.js`, follows the imports, puts each module after the ones it imports, drops the import statements and the word `export`, and inlines the result into `src/index.template.html` as one script. There is no bundler. That works because the modules keep to seven rules, listed at the top of the build script, and the build fails with a message if one is broken.

The rules that matter day to day:

- All game state lives in one object, `G`, in `src/state.js`.
- Only `src/render.js` and `src/main.js` touch the page. Logic writes through `src/io.js`.
- Only `src/main.js` may use the clock or `Math.random`, and only to make a world when no seed is given.
- Every tunable number is in `src/tuning.js`; every pooled line is in `src/content/pools.js`.

## Layout

```
src/                          the game
  index.template.html         markup and CSS, v13's, with a marker where the script goes
  main.js                     boot, input, history, the unseeded seed
  state.js                    G, the one state object
  io.js                       the seam between logic and the page
  render.js                   everything that draws
  tuning.js                   every tunable number
  rng.js  world.js  clock.js  local.js  people.js  commands.js  endings.js  save.js
  content/pools.js            every pooled line
dist/index.html               the built game (not committed)
legacy/quiet-roads-v13.html   the prototype
tools/build.mjs               the build
tools/browser-check.mjs       plays the goldens in a real browser
tools/harness/                runs a single-file build, or the modules, headlessly
tools/sweep.mjs  tools/bot.mjs  tools/record-goldens.mjs
tools/tag-milestones.mjs      tags a step, mN, when its exit report reaches main
test/                         legacy, modules, bundle, build-rule, repair and tagging tests
test/golden/                  transcripts, world hashes, save codes: the current game
test/golden-v13/              the same, recorded from v13 and frozen
docs/SPEC.md                  the spec
docs/handoff/                 standing brief, one sheet per step, exit reports
```

## Licence

MIT. See `LICENSE`.
