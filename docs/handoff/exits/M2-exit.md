# M2 exit report

Step: M2 · Repairs. Branch `m2-repairs`. Written 2026-11-12.

Twelve v13 defects are repaired, each with a test named for its ID. The worlds, the save format and every line of text are unchanged. Fifteen recorded games changed because the game now behaves differently in them; each is listed below beside the repair that changed it.

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/commands.js` | D1, D3, D6, D8, D9, D10, D17, D19. New: `enterKind(x, y)` and `someoneHere()` |
| `src/local.js` | D2, D3, D7, D9. New: `TOWN_BUILDINGS` and `TOWN_SLOTS` |
| `src/people.js` | D4 in the line picker, D5 in the topic lookup |
| `src/clock.js` | D10. New: `advanceWorldPressureFrom(firstStep)` |
| `src/io.js`, `src/main.js` | D17. The page tells the game once, at boot, whether it was opened with `?debug=1` |
| `test/repairs.test.mjs` | New. 13 tests: one per defect, two for D3 |
| `test/golden-v13/` | New. v13's goldens, copied before any repair and never re-recorded |
| `test/golden/` | Re-recorded from the build. See section 3 |
| `test/legacy.test.mjs` | Reads `test/golden-v13/` |
| `test/modules.test.mjs`, `test/bundle.test.mjs` | Transcripts from `test/golden/`; worlds against v13's hashes; save codes from both sets; sweep pins re-measured; the smith-and-guard sweep check |
| `tools/record-goldens.mjs` | Plans describe the repaired game. Records from `dist/index.html` by default and refuses to write v13 over `test/golden/` |
| `tools/bot.mjs` | `homecoming` asks a person in a town. The v13 trick is kept as `homecoming-v13` |
| `tools/sweep.mjs` | Counts guard posts at the street's end, and natural ruins that are searchable, very near, and dog tiles |
| `tools/browser-check.mjs` | The build against `test/golden/`, the legacy file against `test/golden-v13/`, `?debug=1` where a transcript needs it |
| `tools/harness/` | A transcript can ask for a debug page. `__enterableWild` asks the game's own `enterKind` when it exists |
| `package.json` | `npm run record` builds, then records from the build |
| `README.md`, `docs/SPEC.md` | What M2 changed for a player; a "Since v13" table of the measures that moved |
| `docs/handoff/STANDING-BRIEF.md`, `M3-one-trail.md` | The two golden sets; four notes for M3 |

Six source files changed, by 116 lines added and 33 removed. `content/pools.js`, `save.js`, `world.js`, `rng.js`, `tuning.js`, `render.js` and the page template did not change.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 227
# pass 227
# fail 0
```

`npm run sweep`, on `dist/index.html`:

```
winnable: 1992 of 2000
fresh-trail truth: 40.2% (23934 of 59544)
```

`npm run browser-check`, Chrome 153: 28 of 28 transcripts in `test/golden` match on the built page, and 27 of 27 in `test/golden-v13` match on the legacy page. No errors, no request beyond the page itself.

CI on pull request 3: see the note at the end of this section, added once it had run.

### What moved in the sweep, and why

Only D2 and D6 move any sweep measure. Everything else in the full sweep is identical to v13's, including the 8 unwinnable seeds.

| Measure | v13 | M2 | Repair |
| --- | --- | --- | --- |
| Towns where smith and guard both rolled: both drawn | 0 of 2,717 | 2,717 of 2,717 | D2 |
| Natural ruins tiles that can be searched | 0 of 67,766 | 67,766 | D6 |
| Very-near tiles that can be searched | 51,152 | 59,544 | D6: 8,392 are ruins |
| Dog tiles | 20,494 | 23,934 | D6: 3,440 are ruins |
| Reachable dog tiles per seed | median 10 | median 12 | D6 |
| Steps from start to the nearest dog tile | median 4; 90th percentile 9 | median 3; 90th percentile 7 | D6 |

### Bots, 500 seeds

| Bot | File | Reunion | Homecoming | Found in Time | The Long Way Back | No ending | Median step at ending |
| --- | --- | --- | --- | --- | --- | --- | --- |
| explorer | v13 | 369 | 0 | 94 | 35 | 2 | 21 |
| explorer | M2 | 393 | 0 | 85 | 20 | 2 | 18 |
| homecoming-v13 | v13 | 0 | 248 | 180 | 70 | 2 | 38 |
| homecoming | v13 | 33 | 181 | 205 | 78 | 3 | 42 |
| homecoming | M2 | 39 | 197 | 199 | 63 | 2 | 40 |

The explorer finishes sooner on M2 because D6 put the dog in more places. `homecoming-v13` asks an empty field three times; on M2 that earns nothing, so it is only run on v13. The new `homecoming` walks to the nearest town and asks someone who is there. It reaches reputation 3 in 461 of 500 runs on M2.

## 3. Goldens

`test/golden-v13/` is M0's recording, untouched: it is the same git tree as `test/golden/` at tag `m1`, and `test/legacy.test.mjs` replays it against the legacy file.

`test/golden/` was re-recorded from the build. World hashes are identical to v13's for all 2,000 seeds. Of the 19 save codes, 16 are identical to v13's; the other 3 are taken from the end of transcripts 02, 24 and 25, which now end elsewhere. Every transcript's `source` line now reads `dist/index.html`.

### Defect, test, goldens

| Defect | Test in `test/repairs.test.mjs` | Goldens it changed |
| --- | --- | --- |
| D1 | D1: after an ending, NEW starts a game, HELP answers, and LOAD takes the code SAVE printed | 17 |
| D2 | D2: every town building has its own slot; the guard post no longer overwrites the smithy | 02, 05, 09, 25 |
| D3 | D3: TALK and ASK need someone on the tile. D3: a burned town keeps one Survivor, standing at its first burned building | 04, 18, 24, 25 |
| D4 | D4: a speaker never falls silent, and never says one line twice in a reply | 05, 06, 07, 10, 14, 26 |
| D5 | D5: every topic is answered from its own lines, never from ROAD | 06, 14, 26 |
| D6 | D6: natural ruins open as wilderness; a burned town and the fallen capital still open as towns | 04, 28 (new) |
| D7 | D7: the fallen capital is burned inside, like any burned town | 24 |
| D8 | D8: the ride is told on the page, not erased as it is written | 09 |
| D9 | D9: the merchant stays with his wagon while the player is in town, and rides on to his next stop | 10 |
| D10 | D10: REST does not skip the clock for the steps it passes | none |
| D17 | D17: DEBUG and BLOCK answer only when the page was opened with ?debug=1 | 21, 22 |
| D19 | D19: NEW typed inside a town opens the new world on the world map | 27 |

The middle column was found by replaying v13's 27 command lists against the source after each repair and noting which played differently.

### Each transcript

Unchanged, line for line, from v13: 01, 03, 08, 11, 12, 13, 15, 16, 19, 23.

Unchanged in play; only the description or a flag moved:

- **20-fatigue-cap.** Description only. D11 is still open.
- **21-debug-and-block.** Now marked `"debug": true`, so it is replayed on a page opened with `?debug=1`. Its lines are v13's.

Same commands as v13, different result:

- **05-talk-six-times.** D4: talks four to six now have an opener, a line and a close. v13 printed a bare name tag. D2: the guard post is at the east end of the street on the final map.
- **06-ask-every-topic.** D5 and D4: TOWN, WAR, SICKNESS and WORK each get two lines of their own. v13 answered each with a bare name tag, having spent the ROAD lines it borrowed. The repeated DOG question is answered too.
- **07-ask-routes-and-gesture.** D4: two replies that were "..." are now lines.
- **09-ride.** D8: the five lines of the ride are on the final screen. D2: the destination town draws its buildings where their own rolls put them.
- **14-ending-homecoming.** D4 and D5: three more lines in the inn. Same ending.
- **18-talk-to-nobody.** D3: "No one to speak with here.", "There is no one to ask.", and reputation stays at "unknown". v13 had a Wanderer answer and reputation rise.
- **26-sick-town.** D4 and D5: two replies that were "..." are now lines.
- **27-new-inside-a-town.** D19: after NEW the player is on the world map. LOOK reads the land, TALK finds no one, EXIT says "Not here."

New commands, because the old ones recorded the defect or no longer reach the case:

- **02-enter-town.** D2. The plan now asks for a town with all five buildings and walks to the guard post at (7,4). That moved the seed from `town-1` to `town-77`. The visit is also kept quiet on purpose: no world event fires during it.
- **04-enter-natural-ruins.** D6 and D3. The ruins open as wilderness: no walls, "Nothing calls out.", no one to speak with or ask.
- **10-merchant-stays-with-wagon.** D9. Renamed from `10-wagon-outstays-merchant`. Same seed and the same walk; now he answers, offers the ride and gives it, to the stop after this one.
- **17-after-an-ending.** D1. After the ending: three commands refused, HELP answered, LOAD of the code SAVE printed, a second ending, LOAD of an old base32 code, a third ending, then `NEW abc`.
- **22-new-and-aliases.** D17. Two commands added: DEBUG and BLOCK on an ordinary page, both answered "Nothing comes of that."
- **24-fallen-capital.** D7 and D3. Inside the fallen capital there are only burned timbers. The plan walks to the Survivor and speaks to them.
- **25-burned-town.** D3 and D2. The plan visits one burned building with nobody at it, then the one where the Survivor stands.
- **28-dog-in-the-old-stones.** New, for D6. The trail leads into natural ruins and the dog is found there, which v13 could not do.

## 4. Acceptance

- [x] `test/repairs.test.mjs` has one passing test per defect: D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D17, D19.
- [x] Sweep: in every town where smith and guard both roll, both appear. 2,717 of 2,717; v13 had 0. Pinned in `test/bundle.test.mjs`.
- [x] TALK six times and ASK six times at one inn: each reply has at least one line after the name tag, and no line appears twice in one reply. In the D4 test; also transcript 05.
- [x] After any ending, `NEW x` starts a game and `LOAD` of a code from SAVE loads it. In the D1 test; also transcript 17.
- [x] ASK TOWN at an inn returns no line from the inn's ROAD pool. The D5 test checks every role and all four topics.
- [x] ENTER on a natural ruins tile shows no walls. ENTER on the fallen capital shows only burned timbers. The D6 and D7 tests; also transcripts 04 and 24.
- [x] The exit report lists each re-recorded golden beside the defect ID that changed it. Section 3.

Invariants:

- [x] World hashes unchanged, for all 2,000 sweep seeds.
- [x] The dog is still v13's signal field. No line of it changed. See decision 5 for what D6 did around it.
- [x] The save format is unchanged. All 19 codes made by v13 load to the state v13 recorded for them.
- [x] No new player-facing text. Every line the repairs print is one v13 already had.

## 5. Left undone

- **Tag `m2`.** This session cannot push tags. The owner creates it on the merge commit.
- **D5 and D6 are closed only as far as v13's material goes,** as the defect table says ("M2, M5" and "M2, M4"). A Wanderer and a Survivor still speak from the generic pool. Natural ruins have no map of their own.
- **LOOK on the Survivor's tile does not mention them.** It reads "Burned timbers. A place that won't return." The map draws them as `p`. A line for it would be new text, which M2 may not add. M5 writes the Survivor's lines.

## 6. Decisions the sheet did not cover

1. **D3: ASK with no one there says "There is no one to ask."** The sheet gave "No one to speak with here." for both verbs. v13 already has a line for each on the world map, so TALK and ASK each keep their own. No new text either way.
2. **D3: the Survivor is an ordinary person entry on the first burned building.** They are drawn as `p`, the cell under them stays `r`, and the name tag reads "Survivor" because of the cell. One per burned town, including the fallen capital.
3. **D2: a building's roll goes by which building it is, as well as its slot.** v13 rolled by position in a list that sickness and fire shorten, so a town's surviving buildings changed when the market or the inn was removed. Now each of the five has its own roll and its own slot. A town with no sickness or fire has exactly the buildings v13 gave it, with the guard post moved to (7,4) and the smithy no longer overwritten.
4. **D9: the ride goes to the stop after the town the player is in.** v13 took the timetable's current stop plus one. Once the merchant is allowed to outstay his timetable, that could name the town he is standing in.
5. **D6: `enterKind(x, y)` decides what ENTER opens, and natural ruins get the ordinary wilderness roll.** So the dog can now be found in natural ruins: 3,440 more dog tiles over the sweep, and the nearest one is a step closer at the median. The sheet says ruins open "as wilderness" and says not to touch the signal field, and this is both. It does make an already short search slightly shorter until M3. See question 2.
6. **D6 in the goldens: the three ending transcripts keep v13's routes.** The recorder's dog-tile search is limited to plains and forest for transcripts 13 to 17 and 19, so they did not move to a nearer ruins tile. Transcript 28 covers the dog in ruins.
7. **D17: the flag is read once, by the page.** `main.js` reads `?debug=1` at boot and hands the game a `debug()` function through the same host object as `out` and `render`. Logic still never looks at the address.
8. **D10: `advanceWorldPressureFrom(firstStep)`.** REST and RIDE add their steps, then the clock is evaluated once for each step passed, in order, with the step counter set to that step. No recorded game happened to rest across an event, so no golden moved. The test rests across the step where war starts.
9. **D4: the oldest line is chosen by where it last appears in the recent list.** A line never shown counts as oldest. Lines already used in the same reply are still excluded first, which keeps `pickMany`'s guarantee.
10. **The recorder now refuses to record v13 into `test/golden/`.** Its plans describe the repaired game. v13's plans are in this file's history at tag `m1`.
11. **A second Homecoming bot.** The old one depended on D3. Both are kept, under different names, so the v13 row of the spec can still be reproduced.
12. **`test/bundle.test.mjs` pins the sweep at M2's numbers,** and checks that the unwinnable seeds are the same 8 as v13's.

## 7. For M3

- **Decisions needed first.** Trail or signal field; the `?` glyph; the word "guarded". Spec section 8.
- **`enterKind(x, y)`** is the one place that says whether a tile opens as a town, as wilderness, or not at all.
- **The sweep pins are meant to change in M3.** They are in `test/bundle.test.mjs`, with a comment saying where each number came from.
- **Plans that find the dog** (13 to 17, 19, 28) use `__openDogTile` and `__ruinDogTile` in `tools/record-goldens.mjs`. Both are defined on the signal field.
- **Transcript 02 shows "The trail is fresh. ENTER to search." on a town tile.** That is v13's field reporting on a tile that cannot be searched. It is the kind of line M3's truth check should remove.
- **`npm run bots` takes about three minutes** for the two policies on the build.

## 8. Questions for the owner

1. Please create the tag `m2` after merging.
2. Under v13's signal field, the dog can now be in natural ruins, because ruins open as ordinary wilderness. M3 replaces the field, so this lasts one step. If you would rather ruins never hold the dog in the meantime, that is a one-line change and one transcript. I left it as the sheet describes.
3. M3 cannot start without the trail decision in spec section 8: one dog on a walkable trail (the default the sheets assume), or v13's signal field centred on a single dog. The same step needs a yes or no on the `?` glyph and the status word "guarded".
