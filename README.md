# The Quiet Roads

A single-file browser text game. The yard gate is open and your dog is gone. You search a seeded 20×20 world by typing commands while the world slowly comes apart.

One HTML file, no dependencies, nothing fetched from the network.

## Play

Once 1.0 is published: **https://steveonw.github.io/text-game/**

Or build it yourself. It needs Node 20 or later and nothing else:

```
npm run build
```

Then open `dist/index.html` in a browser.

### Commands

| Command | What it does |
| --- | --- |
| `N` `S` `E` `W` | move (also `NORTH` `SOUTH` `EAST` `WEST`) |
| `LOOK` | look around; on the world map it also names the four neighbouring tiles |
| `ENTER` | go into a town, the wild or ruins |
| `EXIT` | back to the road (also `EX`, `EXT`) |
| `TALK` | speak to someone here (also `HI`, `HELLO`) |
| `ASK <topic>` | `DOG` `ROAD` `TOWN` `ROUTES` `WAR` `SICKNESS` `WORK` |
| `CALL` | call your dog |
| `WAIT` | let a moment pass |
| `REST` | rest a while |
| `RIDE` | ride the wagon, when offered |
| `FOLLOW` | go with someone who offers to show you |
| `STATUS` | how you are, how the roads are |
| `SAVE` | get a password |
| `LOAD <password>` | go back to a saved game |
| `NEW <seed>` | a new world |
| `CLEAR` | clear the log |
| `HELP` | this list |

### Seeds and passwords

- **A seed is a world.** Add `?seed=anything` to the address, or type `NEW anything`, and you get the same world, the same trail and the same dates every time. With no seed the page picks one.
- **SAVE prints a password** of about 25 characters at the start, longer the more people you have spoken to. `LOAD <password>` puts you back where you were. Passwords are case-sensitive; one changed character and LOAD refuses it.
- **Passwords from v13 and from builds before M6 do not load.** They described a game with no trail and no fixed dates.

The file it builds is the v13 prototype grown into 1.0: the same worlds, with twelve defects repaired, the dog put on a trail, a clock with an end and a fifth ending. The prototype itself is kept, byte for byte and never edited, and can be opened the same way:

```
SHA-256  85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c  legacy/quiet-roads-v13.html
```

## Where this is going

`docs/SPEC.md` describes v13 as built, how it measures when played by script across 2,000 seeds, and the design for a finished 1.0. The work is split into eight steps, M0 to M7, each with a handoff sheet in `docs/handoff/` and an exit report in `docs/handoff/exits/`.

This repository is at **M7**: the numbers are tuned against scripted players and every target for 1.0 holds on 2,000 seeds. 1.0 is published when the owner pushes the `v1.0.0` tag.

What changed in M7:

- **Someone can show you the way.** In a town that has seen your dog, a person who points true when you ask about it offers to walk you there. Type `FOLLOW`. The walk costs what walking costs.
- **Asking now pays.** A scripted player who asks in a nearby town stands on the dog's first den before the war about three times in four; one who only follows sign, about half the time.
- **Three numbers changed:** the trail passes a nearby town more often, a town counts as having seen the dog a little farther from the trail, and the war comes four steps later at the earliest.
- **Every target is checked on every push,** by six scripted players over 2,000 worlds (`docs/balance.md`).

Seven lines are new in M7, tagged `// REVIEW`.

What changed in M6:

- **The Open Gate is written.** If the roads change before the dog is found, the game ends with a few lines of its own, in the shape of the other four.
- **True numbers at every ending:** steps taken, towns entered of the towns there are, people spoken to, and sign found of the whole trail. v13's "Towns visited" counted the people you remembered.
- **Short passwords.** A fresh game saves in 23 to 26 characters (v13: 90 to 92), a game at step 40 in 27 to 68, most of it the people you have spoken to. Codes are case-sensitive. Codes made by v13 and by the builds before M6 no longer load: LOAD refuses them with "The password refuses to settle."
- **The legend follows the map.** The world map shows `?` for sign; a town, the wild and old stones each list their own glyphs, so `T` and `^` mean one thing at a time.
- **LOOK names the neighbours.** On the world map it adds a line such as "North: forest. East: plains. South: blocked. West: water." The game can be played without seeing the map.
- **HELP lists every command,** with its aliases, and the side panel shows the same list. The map tells a screen reader where you are.

Six lines are new in M6, also tagged `// REVIEW`.

What changed in M5:

- **Every topic gets an answer.** Innkeeper, merchant, smith, priest, guard and local each have lines for TOWN, WAR, SICKNESS and WORK. The wanderer and the survivor have voices of their own.
- **Familiar people say more.** A line for DOG, ROAD and ROUTES opens up at the second conversation, and another at the fourth.
- **Only towns the dog passed have seen it.** Elsewhere people say they haven't.
- **Gestures for more than the dog.** Asked about the dog, sickness, the war, other towns, or (of a guard) the road, a person may point the first step of the way. Someone who trusts you always points true; someone who only knows you is wrong about one time in eight; a stranger does not point.
- **Rest outside a town.** REST works anywhere, the world map included, and restores all your fatigue for two steps, or less when sleep comes shallow.

118 lines are new in M5, drafts tagged `// REVIEW` in `src/content/pools.js` for the owner to edit.

What changed in M4:

- **Three dates, read from the seed.** The war starts between step 30 and step 50, the capital falls 25 to 40 steps later, and 25 to 40 steps after that the roads change and the story ends. v13 rolled for the war and the fall on every step, so neither had a latest step and the game had no end.
- **A fifth ending.** If the roads change before the dog is found, the game ends as The Open Gate. M6 wrote its text.
- **Warnings.** Each change is foreshadowed by one line in the eight steps before it, and announced when it comes.
- **Tiredness costs time.** A move made at fatigue 5 takes two steps of the clock.
- **Roads close.** During the war a road closes every 18th step: about four in a game, six at most. A closure never cuts off anything you could reach.
- **Old stones.** Natural ruins have a map of their own: open ground and stones. The trail ends at one, and that is where the dog waits after the capital falls.
- **Sickness matters.** The cabbage wagon skips a sick town, and REST there restores little.
- **Four status words:** quiet, unsettled, guarded, hollow.

Fifteen lines are new in M4, also tagged `// REVIEW`.

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


## Test

```
npm test                # goldens, the trail, the clock, people, the content lint, repairs, worlds, save codes, sweep gates and build rules
npm run browser-check   # play the goldens in headless Chrome (Node 22 or later, and Chrome)
npm run sweep           # measure the built game across 2,000 seeds, and run the gates
npm run bots            # scripted players over 500 seeds (takes a few minutes)
npm run balance         # every bot on 2,000 seeds against the 1.0 targets; fails on a miss (about 8 minutes on two cores)
npm run record          # build, then re-record test/golden/ from the build
```

`npm test` takes about two minutes. It fails if the legacy file changes by a byte, if any recorded game plays out differently, if any of 2,000 worlds is generated differently from v13's, if a code made by the current game stops loading or one made by v13 loads, if a repaired defect comes back, if a module breaks one of the build's rules, or if any of 2,000 seeds fails a gate: no trail, a den or the threshold out of reach, a fresh trail with no dog behind it, a date outside its window, or a closed road that cuts the dog off.

There are two sets of recorded games:

- `test/golden/` is what the game does now: 34 transcripts, replayed against the modules, the built file and, in the browser check, the real page. Re-record it only when a change is meant, and say why in the step's exit report.
- `test/golden-v13/` is what v13 did: 27 transcripts, frozen, replayed against the legacy file. It is never re-recorded.

## Publishing

Pushing a version tag, `v1.0.0` or later, runs `.github/workflows/pages.yml`: it builds and tests the game and publishes `dist/index.html` to GitHub Pages. The owner can also run it by hand from the Actions tab. Pages must be set once to deploy from GitHub Actions (Settings, Pages, Source). `dist/` is never committed.

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
  gesture.js                  every gesture anyone makes
  rng.js  world.js  clock.js  local.js  people.js  commands.js  endings.js  save.js
  content/pools.js            every pooled line
dist/index.html               the built game (not committed)
legacy/quiet-roads-v13.html   the prototype
tools/build.mjs               the build
tools/browser-check.mjs       plays the goldens in a real browser
tools/harness/                runs a single-file build, or the modules, headlessly
tools/sweep.mjs  tools/bot.mjs  tools/record-goldens.mjs
tools/balance.mjs             the bots on 2,000 seeds against the 1.0 targets
tools/tune.mjs                a tuning trial, on a copy of the build
tools/tag-milestones.mjs      tags a step, mN, when its exit report reaches main
test/                         legacy, modules, bundle, build-rule, repair, trail, clock, people, content and tagging tests
test/golden/                  transcripts, world hashes, save codes: the current game
test/golden-v13/              the same, recorded from v13 and frozen
docs/SPEC.md                  the spec
docs/balance.md               the bots' results, and every tuning trial
docs/handoff/                 standing brief, one sheet per step, exit reports
```

## Licence

MIT. See `LICENSE`.
