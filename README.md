# The Quiet Roads

A single-file browser text game. The yard gate is open and your dog is gone. You search a seeded 20×20 world by typing commands while the world slowly comes apart.

One HTML file, no dependencies, nothing fetched from the network.

## Play

Open `legacy/quiet-roads-v13.html` in a browser. Type `HELP` for the commands.

- Add `?seed=anything` to the address to get the same world every time.
- `SAVE` prints a password; `LOAD <password>` restores it.

That file is the v13 prototype. It is kept byte for byte and is never edited:

```
SHA-256  85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c  legacy/quiet-roads-v13.html
```

## Where this is going

`docs/SPEC.md` describes v13 as built, how it measures when played by script across 2,000 seeds, and the design for a finished 1.0. The work is split into eight steps, M0 to M7, each with a handoff sheet in `docs/handoff/`.

This repository is at **M0**: the prototype is under test and nothing about the game has changed.

## Test

Needs Node 20 or later. There is nothing to install.

```
npm test          # replay the golden transcripts, world hashes and save codes against v13
npm run sweep     # measure v13 across 2,000 seeds
npm run bots      # scripted players over 500 seeds (takes a few minutes)
npm run record    # re-record the goldens from the legacy file
npm run build     # nothing to build until M1
```

`npm test` takes about half a minute. It fails if the legacy file changes by a byte, if any of the 27 recorded games plays out differently, if any of 2,000 worlds is generated differently, or if a save code stops loading.

## Layout

```
legacy/quiet-roads-v13.html   the prototype
tools/harness/load.mjs        runs a single-file build headlessly, through its own command parser
tools/harness/golden.mjs      reads and replays the golden files
tools/harness/helpers.mjs     read-only route and world helpers for tools
tools/sweep.mjs               seed sweep
tools/bot.mjs                 scripted players
tools/record-goldens.mjs      records test/golden/ from the legacy file
test/legacy.test.mjs          the M0 baseline tests
test/golden/                  transcripts, world hashes, save codes
docs/SPEC.md                  the spec
docs/handoff/                 standing brief, one sheet per step, exit reports
```

## Licence

MIT. See `LICENSE`.
