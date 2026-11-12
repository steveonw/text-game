# M0 exit report

Step: M0 · Baseline. Branch `m0-baseline`. Written 2026-11-12.

The prototype is in the repo untouched and under test. No gameplay code was written or changed.

## 1. What changed, by file

Everything is new except `LICENSE`.

| File | What it is |
| --- | --- |
| `legacy/quiet-roads-v13.html` | The v13 prototype, byte for byte. SHA-256 `85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c` |
| `.gitattributes` | Stops git converting line endings in the legacy file and the goldens |
| `package.json` | `"type": "module"`, scripts `test`, `sweep`, `bots`, `record`, `build`; no dependencies |
| `README.md` | What the game is, how to play the legacy file, how to test, the SHA-256 |
| `tools/harness/load.mjs` | Runs a single-file build in `node:vm` with a stub page. `load()`, `play()`, `SNAPSHOT_EXPR` |
| `tools/harness/golden.mjs` | Reads the golden files; `replay()` a transcript against any build; `worldSignature()` |
| `tools/harness/helpers.mjs` | Read-only route and world helpers that tools inject into a loaded game |
| `tools/sweep.mjs` | The 2,000-seed sweep. `sweepCore()` for tests, `sweepFull()` for `npm run sweep` |
| `tools/bot.mjs` | Scripted players: `explorer` and `homecoming`, 500 seeds each |
| `tools/record-goldens.mjs` | Plans and records everything in `test/golden/` from the legacy file |
| `test/legacy.test.mjs` | The baseline tests |
| `test/golden/transcripts/*.json` | 27 recorded games |
| `test/golden/world-hashes.json` | Terrain, towns, capital and start tile for 2,000 seeds |
| `test/golden/legacy-codes.json` | 19 save codes in 4 formats, each with the state it restores |
| `.github/workflows/ci.yml` | Node 20: checks the legacy file's hash, then `npm test` |
| `docs/SPEC.md` | The spec |
| `docs/handoff/*.md` | The standing brief and the eight handoff sheets |
| `docs/handoff/exits/M0-exit.md` | This report |

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 54
# pass 54
# fail 0
```

`npm run sweep`:

```
winnable: 1992 of 2000
fresh-trail truth: 40.1% (20494 of 51152)
```

Every other number in spec section 3 is reproduced by `npm run sweep` and `npm run bots`: explorer endings 369, 94, 35 and 2 with none; homecoming bot 248, 180, 70 and 2 with none.

The tests were checked against two altered copies of the legacy file. Changing one line of text made 7 of the 27 transcripts fail. Changing one terrain constant changed the world hash on 200 of 200 seeds tried.

Recording is repeatable: running `npm run record` again rewrites `test/golden/` byte for byte.

## 3. Goldens

None changed, since none existed. 27 were recorded.

| Transcript | Seed | Commands | Lines | Ending |
| --- | --- | --- | --- | --- |
| 01-world-walk | walk-1 | 26 | 61 | |
| 02-enter-town | town-1 | 59 | 102 | |
| 03-enter-wilderness | wild-1 | 29 | 54 | |
| 04-enter-natural-ruins | ruins-1 | 16 | 37 | |
| 05-talk-six-times | talk-1 | 17 | 43 | |
| 06-ask-every-topic | ask-2 | 23 | 54 | |
| 07-ask-routes-and-gesture | routes-1 | 19 | 51 | |
| 08-wait-and-rest | rest-1 | 26 | 57 | |
| 09-ride | ride-1 | 27 | 74 | |
| 10-wagon-outstays-merchant | wagon-1 | 13 | 33 | |
| 11-save-and-load | save-1 | 28 | 69 | |
| 12-load-old-formats | old-formats-1 | 10 | 31 | |
| 13-ending-reunion | reunion-2 | 16 | 59 | Reunion |
| 14-ending-homecoming | homecoming-16 | 29 | 85 | Homecoming |
| 15-ending-found-in-time | war-2 | 37 | 98 | Found in Time |
| 16-ending-long-way-back | fall-2 | 70 | 175 | The Long Way Back |
| 17-after-an-ending | after-1 | 13 | 51 | Reunion |
| 18-talk-to-nobody | nobody-1 | 7 | 29 | |
| 19-call-hot-and-cold | call-1 | 28 | 80 | |
| 20-fatigue-cap | tired-1 | 21 | 48 | |
| 21-debug-and-block | debug-1 | 11 | 36 | |
| 22-new-and-aliases | new-1 | 14 | 50 | |
| 23-long-clock | clock-1 | 161 | 354 | |
| 24-fallen-capital | capital-3 | 74 | 158 | |
| 25-burned-town | burned-2 | 101 | 219 | |
| 26-sick-town | plague-4 | 37 | 76 | |
| 27-new-inside-a-town | newlocal-1 | 17 | 51 | |

**Seeds for the ending transcripts:** Reunion `reunion-2`; Homecoming `homecoming-16`; Found in Time `war-2`; The Long Way Back `fall-2`.

Between them the transcripts use every word the parser answers to, including the aliases, and ask about every topic. Eleven of them pin a defect from spec section 3: D1 (17), D3 (18), D4 (05 and 06), D5 (06), D6 (04), D7 (24), D8 (09), D9 (10), D11 (20), D12 and D17 (21), D19 (27). In 06 the two combine: TOWN, WAR, SICKNESS and WORK draw on the ROAD lines, which ASK ROAD has just used, so each prints a bare name tag.

## 4. Left undone

- **Tag `m0`.** The owner tags on merge.
- **CI.** Nothing undone: the workflow ran on pull request 1 and passed (Node 20, `npm test`, 54 of 54).

## 5. Decisions the sheet did not cover

1. **Transcripts carry more than the sheet's four fields.** Each has `name`, `covers`, `source`, `seed`, `commands`, `log`, `finalScreen`, `finalMap`, `finalMapHash`, `finalStatus`, `finalMode`, `finalPos`. A `log` entry is `[cls, text]`, where `cls` is `"m"` for the narrator's muted voice and `""` for speech, because v13 styles the two differently and M1 must keep that. `finalScreen` is what is left in the log element, which differs from `log` when the game clears it (defect D8).
2. **Transcripts live in `test/golden/transcripts/`**, beside the two other golden files, not loose in `test/golden/`.
3. **A seeded load opens the page as `?seed=<seed>`** instead of setting `SEED` and calling `startNewGame()`. The world is the same, it is how a player gets a seeded game, and it lets the harness replace `Math.random` and `Date.now` with functions that throw. A seeded run cannot be anything but deterministic.
4. **`cmd(text)` does what the input box does**: `pushHistory`, `runCommand`, `render`.
5. **`tools/bot.mjs` exists already.** The plan had it arrive in M3. It is here so that every number in spec section 3 can be reproduced from the repo. M3 adds `tracker` to it; the M3 sheet now says so.
6. **`world-hashes.json` also records each seed's start tile.** M3 must show that start tiles move on at most 10 seeds, and needs the M0 values to compare.
7. **Save codes cover four formats, not two.** v13 reads packed version 4, packed version 3, base32 version 2 and an older base32 form, but only writes the first and third. A version 3 code and an oldest-form code were built from real game states so that all four readers are pinned before M6 touches them.
8. **`npm run record`** re-records the goldens. It plans each game on one loaded copy, replays the commands on a fresh copy with nothing injected, and records only the replay.
9. **`docs/SPEC.md` and the handoff sheets are in this branch.** The standing brief names them as the sources of truth, so they have to be in the repo before M1 starts.

## 6. Found along the way

- **A nineteenth defect, D19.** `NEW <seed>` typed inside a town or wilderness map starts the new world but leaves the old local map on screen, because `startNewGame` resets neither `mode` nor `local`. The player stands in a town that is not in the new world, and TALK is answered by "Someone". It needs no design decision, so it is added to the spec's defect table and to the M2 sheet, and transcript 27 pins it.
- **The Long Way Back does not need a war.** The capital can fall while the war roll has still not come up, and v13 checks the capital first. One explorer run in 500 ended that way. M4's fixed stage order removes the case.
- **A packed version 3 code is 35 characters** where version 4 is 90 or more for the same state. The whole difference is the 50-byte hint map. That supports the save v5 target of 40 characters at step 0.
- **`render()` runs twice per command**, once inside most commands and once in the input handler. The harness keeps both. M1 should too.

## 7. Questions for the owner

1. D19 was added to the spec and to M2 without asking, since it is a plain bug. Say if you would rather it were left alone.
2. The build decision (spec section 8) is the only one M1 waits on. The default is a short build script of our own with no dependencies.
3. Is `main` protected? CI runs on pull requests and on pushes to `main`; nothing else is assumed.
