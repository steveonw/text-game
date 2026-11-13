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

The file it builds is the v13 prototype with twelve of its defects repaired, its dog put on a trail and its clock given an end: same worlds, the same lines and fifteen new ones, same save codes. The prototype itself is kept, byte for byte and never edited, and can be opened the same way:

```
SHA-256  85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c  legacy/quiet-roads-v13.html
```

## Where this is going

`docs/SPEC.md` describes v13 as built, how it measures when played by script across 2,000 seeds, and the design for a finished 1.0. The work is split into eight steps, M0 to M7, each with a handoff sheet in `docs/handoff/` and an exit report in `docs/handoff/exits/`.

This repository is at **M4**: the game has a clock that ends.

What changed in M4:

- **Three dates, read from the seed.** The war starts between step 30 and step 50, the capital falls 25 to 40 steps later, and 25 to 40 steps after that the roads change and the story ends. v13 rolled for the war and the fall on every step, so neither had a latest step and the game had no end.
- **A fifth ending.** If the roads change before the dog is found, the game ends as The Open Gate. Its text is one placeholder line until M6.
- **Warnings.** Each change is foreshadowed by one line in the eight steps before it, and announced when it comes.
- **Tiredness costs time.** A move made at fatigue 5 takes two steps of the clock.
- **Roads close.** During the war a road closes every 18th step: about four in a game, six at most. A closure never cuts off anything you could reach.
- **Old stones.** Natural ruins have a map of their own: open ground and stones. The trail ends at one, and that is where the dog waits after the capital falls.
- **Sickness matters.** The cabbage wagon skips a sick town, and REST there restores little.
- **Four status words:** quiet, unsettled, guarded, hollow.

Fifteen lines are new in M4. Each is a draft tagged `// REVIEW` in `src/content/pools.js`, for the owner to edit.

What changed in M3:

- **One dog.** v13 had no dog until you searched: a quarter of the map said something had passed, a tenth said the trail was fresh, and two of those five tiles held a dog. Now a trail runs from the yard, where you start, to a threshold about thirty steps away, and the dog waits at a den along it.
- **Sign you can follow.** Every trail tile between the yard and the dog reads "Something moved through here recently." Sign you have found is drawn on the map as `?`. The next tile is found by walking.
- **The fresh trail is true.** "The trail is fresh. ENTER to search." is printed on the dog's own tile and nowhere else, and the dog is always there.
- **The dog moves on.** When the war starts it goes on to a second den. When the capital falls it goes to the threshold.
- **CALL and gestures mean something.** A call is answered on the dog's tile and within three trail tiles of it. A gesture points the first step of the way to the dog.
- **Every world can be won.** v13 could not be won on 8 of 2,000 seeds.

What changed in M2, for a v13 player:

- After an ending, `NEW` and `LOAD` work.
- Nobody answers on a tile with nobody on it, and asking an empty field no longer earns reputation.
- People no longer fall silent after a few questions, and each topic gets its own lines.
- The smithy and the guard post both appear. The guard stands at the east end of the street.
- Natural ruins open as wilderness, not as a walled town.
- A burned town and the fallen capital are burned inside, with one survivor.
- The ride on the cabbage wagon is told, and the merchant does not vanish from his wagon.
- `DEBUG` and `BLOCK` answer only on a page opened with `?debug=1`.

Still v13's: what people say, the text of the endings and the save format. Those are M5 and M6. The numbers are not balanced yet: that is M7.

## Test

```
npm test                # goldens, the trail, the clock, repairs, worlds, save codes, sweep gates and build rules
npm run browser-check   # play the goldens in headless Chrome (Node 22 or later, and Chrome)
npm run sweep           # measure the built game across 2,000 seeds, and run the gates
npm run bots            # scripted players over 500 seeds (takes a few minutes)
npm run record          # build, then re-record test/golden/ from the build
```

`npm test` takes about two minutes. It fails if the legacy file changes by a byte, if any recorded game plays out differently, if any of 2,000 worlds is generated differently from v13's, if a save code made by v13 or by the current game stops loading, if a repaired defect comes back, if a module breaks one of the build's rules, or if any of 2,000 seeds fails a gate: no trail, a den or the threshold out of reach, a fresh trail with no dog behind it, a date outside its window, or a closed road that cuts the dog off.

There are two sets of recorded games:

- `test/golden/` is what the game does now: 30 transcripts, replayed against the modules, the built file and, in the browser check, the real page. Re-record it only when a change is meant, and say why in the step's exit report.
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
  trail.js                    the dog and its trail
  rng.js  world.js  clock.js  local.js  people.js  commands.js  endings.js  save.js
  content/pools.js            every pooled line
dist/index.html               the built game (not committed)
legacy/quiet-roads-v13.html   the prototype
tools/build.mjs               the build
tools/browser-check.mjs       plays the goldens in a real browser
tools/harness/                runs a single-file build, or the modules, headlessly
tools/sweep.mjs  tools/bot.mjs  tools/record-goldens.mjs
tools/tag-milestones.mjs      tags a step, mN, when its exit report reaches main
test/                         legacy, modules, bundle, build-rule, repair, trail, clock and tagging tests
test/golden/                  transcripts, world hashes, save codes: the current game
test/golden-v13/              the same, recorded from v13 and frozen
docs/SPEC.md                  the spec
docs/handoff/                 standing brief, one sheet per step, exit reports
```

## Licence

MIT. See `LICENSE`.
