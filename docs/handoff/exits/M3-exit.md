# M3 exit report

Step: M3 · One trail. Branch `m3-trail`. Written 2026-11-12.

The owner chose the defaults in spec section 8: one dog on a walkable trail, `?` for found sign, and "guarded" as the war-stage word (used from M4). The signal field is gone. Every seed can be won, and the fresh-trail line is true every time it is printed.

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/trail.js` | New. `buildTrail()`, `trail()`, `dogIndex()`, `dogTile()`, `trailIndexAt()`, `dogIsNear()`, `dogIsVeryNear()`, `callAnswer()`, `dogDirectionHint()` |
| `src/world.js` | The signal field and its gesture are removed. New: `walkable()`, `stepsFrom()`, `homeRegion()`, `startTile()`. `placePlayer()` uses `startTile()`. `computeTowns()` clears the cached trail |
| `src/local.js` | A wilderness map holds the dog on the dog's tile, always, and on no other |
| `src/commands.js` | CALL answers by trail position. ASK DOG on the world map and CALL in a map with no dog use the same rule. LOOK is unchanged; it reads the new predicates |
| `src/render.js` | `worldGlyph()`: found sign is drawn as `?` on plains and forest |
| `src/state.js` | `G.trail`, the trail for the current seed, built on first use and not saved |
| `src/tuning.js` | Five signal thresholds removed. Eight trail numbers added under "The trail and the dog" |
| `test/trail.test.mjs` | New. 24 tests, one or more for each task on the sheet |
| `test/repairs.test.mjs` | The D5 test allows a routes overlay line: the walk to town now crosses sign |
| `test/modules.test.mjs`, `test/bundle.test.mjs` | Worlds checked against v13 with the ten moved yards named; sweep pins for M3; the gates |
| `test/golden/` | Re-recorded from the build. See section 3 |
| `tools/sweep.mjs` | `sweepGates()`; trail-length distribution; the command exits non-zero when a gate fails |
| `tools/bot.mjs` | `tracker`. `homecoming` tracks on a build with a trail |
| `tools/record-goldens.mjs` | Plans follow the trail: `trail()`, `followTrail()`, `stir()`, `enterAndReachDog()` |
| `tools/harness/golden.mjs` | `MOVED_YARDS`, `expectedWorld()` |
| `README.md`, `docs/SPEC.md` | What M3 changed for a player; the three decisions recorded; an M3 block under "Since v13" |
| `docs/handoff/M4` to `M7` sheets | Notes carried forward from M3 |

Seven source files changed, by 334 lines added and 102 removed. `clock.js`, `people.js`, `endings.js`, `save.js`, `rng.js`, `content/pools.js` and the page template did not change.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 264
# pass 264
# fail 0
```

`npm run sweep`, on `dist/index.html`:

```
winnable: 2000 of 2000
fresh-trail truth: 100.0% (2000 of 2000)
trail length 20 or more: 1997 of 2000
gates: all 2000 seeds pass
```

`npm run browser-check`, Chrome 153: 29 of 29 transcripts in `test/golden` match on the built page, and 27 of 27 in `test/golden-v13` match on the legacy page. No errors, no request beyond the page itself.

CI on pull request 6 passed both jobs on commit `6fe304a`: `test` on Node 20 (build, 264 tests, the built file uploaded) and `browser` on Node 22 with GitHub's Chrome. The only commit after that one adds this paragraph.

### The sweep, against v13 and M2

| Measure | v13 | M2 | M3 |
| --- | --- | --- | --- |
| Seeds with a reachable dog | 1,992 | 1,992 | 2,000 |
| Places the dog is at once | median 10 | median 12 | 1 |
| The fresh-trail line is true | 40.1% | 40.2% | 100% |
| Tiles in reach that say something moved through | median 67 | median 67 | median 13 |
| Steps from the start to the dog, by the shortest way | median 4 | median 3 | median 10; 90th percentile 12 |
| Gesture points a step nearer the dog | 58.9% | 59.0% | 92.1% |
| A random open direction does | 47.7% | 47.6% | 54.1% |
| Gesture offered, of ASK DOG in towns | 69.5% | 69.5% | 32.0% |

### Trail length over 2,000 seeds

| | Tiles |
| --- | --- |
| Shortest | 19 |
| 5th percentile | 22 |
| 25th percentile | 27 |
| Median | 31 |
| 75th percentile | 32 |
| 95th percentile | 39 |
| Longest | 53 |

20 or more on 1,997 seeds (99.9%); the sheet asks for 95%. The threshold is a natural ruin on 1,401 seeds and plains or forest on 599. The trail passes beside a town on 964. Den 1 sits at trail position 8 to 15 (5th to 95th percentile, median 12) and den 2 at 14 to 27 (median 20).

### Bots, 500 seeds

| Bot | Reunion | Homecoming | Found in Time | The Long Way Back | No ending | Median step at ending |
| --- | --- | --- | --- | --- | --- | --- |
| tracker | 354 | 0 | 117 | 29 | 0 | 31 |
| explorer | 39 | 0 | 138 | 295 | 28 | 140 |
| homecoming | 1 | 106 | 146 | 247 | 0 | 81 |

- **Tracker.** It stands on den 1 on 500 of 500 seeds, after a median 28 steps (90th percentile 41), and before the war on 408 (82%). It finds the dog on every seed. It ends before step 12 on 10 seeds (2%).
- **Explorer.** It ignores sign and walks to the nearest unvisited tile. On v13 it ended in a median 21 steps; now it takes 140, and on 28 seeds it crosses each of the dog's places while the dog is somewhere else. Sign is now worth reading.
- **Homecoming.** It walks to a town, asks three times, walks back to the yard and tracks. The round trip costs it the quiet stage on most seeds.

## 3. Goldens

`test/golden-v13/` is untouched. `test/golden/` was re-recorded from the build: 29 transcripts.

Sign used to lie on a quarter of the map and now lies on the trail, so almost every recorded walk reads differently: a "Something moved through here recently." gained or lost, an inner line changed with it, the routes stirring on a different step. Of M2's 28 transcripts, 4 replay line for line (04, 18, 21, 22) and 24 changed. Two are new.

Same commands as M2; lines differ only because sign is elsewhere: 01, 02, 03, 05, 06, 08, 09, 10, 20, 25, 27.

Same plan, a different route or seed, because the plan walks to sign or to the dog:

- **07-ask-routes-and-gesture.** The routes are stirred by walking the trail's first three tiles.
- **11-save-and-load, 12-load-old-formats.** Their codes are taken from other transcripts, which changed.
- **13-ending-reunion.** The trail is followed from the yard to den 1, with LOOK and CALL on the way. Seed `reunion-1`.
- **14-ending-homecoming.** Reputation in a town, then the trail to den 1 with five sign tiles found. Seed `homecoming-62`.
- **15-ending-found-in-time, 16-ending-long-way-back.** The player reaches den 1 and waits beside the dog while the war starts, or the capital falls. The dog stays for a visit that began before it moved on.
- **17-after-an-ending.** Reaches the dog by the trail. Seed `after-6`.
- **23-long-clock, 24-fallen-capital, 26-sick-town.** They begin with `stir()`, which now walks the trail.

Rewritten:

- **19-call-hot-and-cold.** LOOK, CALL and ASK DOG at the yard, off the trail, two tiles short of the dog, one tile past it and on its tile; CALL inside maps with no dog, far and close; CALL two cells from the dog. Seed `call-117`.
- **28-dog-at-the-threshold.** Replaces `28-dog-in-the-old-stones`. After the capital falls, den 1 and den 2 show sign and nothing fresh. The threshold, a natural ruin, reads as old stones with a fresh trail and opens as wilderness with the dog in it.
- **29-dog-moves-on.** New. The war starts first. Den 1 has sign and no dog; the trail goes on to den 2, where the dog is found.

Save codes: 5 of 19 are identical to M2's; the rest are taken from the ends of transcripts that changed. All 19 codes made by v13 still load to the state v13 recorded.

World hashes: terrain, towns and capital are v13's on all 2,000 seeds. The start tile is v13's on 1,990.

### The ten start tiles that moved

| Seed | v13 | M3 | Why |
| --- | --- | --- | --- |
| `sweep-245` | (0,0) | (2,14) | v13's start was in a pocket cut off from the largest region with a town |
| `sweep-322` | (19,19) | (4,4) | the same |
| `sweep-473` | (1,0) | (12,11) | the same |
| `sweep-1360` | (0,0) | (12,3) | the same |
| `sweep-1610` | (19,10) | (14,19) | the same |
| `sweep-1686` | (17,17) | (4,12) | the same |
| `sweep-1924` | (19,19) | (10,0) | the same |
| `sweep-560` | (18,17) | (14,1) | every town is in a pocket (the largest has 11 tiles); the mainland of 223 has none |
| `sweep-762` | (0,1) | (8,8) | every town is in a pocket of 2 tiles; the mainland of 233 has none |
| `sweep-1471` | (1,1) | (1,8) | every town is in a pocket (the largest has 6 tiles); the mainland of 232 has none |

They are named in `MOVED_YARDS` in `tools/harness/golden.mjs` and checked one by one.

## 4. Acceptance

- [x] Sweep: 2,000 of 2,000 seeds winnable. v13: 1,992.
- [x] Sweep: the fresh-trail line is followed by a dog on ENTER every time. Gate 3, on every seed in three states of the clock; played for real by the tracker on 500 seeds and by 14 seeds in `test/trail.test.mjs`.
- [x] Exactly one dog tile per seed in each of the three clock states. Gate 3.
- [x] Trail length is 20 or more on at least 95% of seeds: 1,997 of 2,000. Distribution above.
- [x] The tracker bot reaches den 1 on every seed: 500 of 500.
- [x] Start tiles differ from M0's only on the listed seeds: ten, listed above.

Invariants:

- [x] World hashes unchanged, apart from the start tile on those ten seeds.
- [x] The start moves on at most 10 of the 2,000 sweep seeds: exactly 10. Three of them moved for a reason the sheet did not foresee. See decision 1.
- [x] No new player-facing text. Every LOOK and CALL string is v13's; `content/pools.js` is untouched.
- [x] The save format is unchanged. Hint bits are indexed by world tile. `save.js` is untouched.

## 5. Left undone

- **The legend does not show `?`.** A legend entry is new text, which M3 may not add. M6 does the legend by mode. Until then the glyph is drawn and not explained.
- **The gesture's trust rule.** The gesture is now true, less v13's 12% error, but the error applies at any trust. The sheet kept it so; M5 makes it "always true at trust 2".
- **"Gone once the roads change."** There is no fourth clock stage yet. M4.
- **Balance.** The tracker reaches den 1 before the war on 82% of seeds; the 1.0 target is 40% to 60%. M4's dates and M7's tuning move that.

## 6. Decisions the sheet did not cover

1. **Three worlds are played on their mainland, with no town in reach.** On `sweep-560`, `sweep-762` and `sweep-1471` every town sits in a pocket of 2 to 11 tiles. By the sheet's rule the yard goes in the largest region that holds a town, which on `sweep-762` is two tiles: the trail would be the yard itself, with no den and no threshold, and the sheet's own gates would fail. So where that region has fewer than 100 tiles (`homeRegionMinTiles`) the largest region of all is used. On the other 1,997 seeds the two rules pick the same region. Those three games have wanderers to talk to but no town, no wagon and no inn. See question 2.
2. **Dens stay apart.** On 12 seeds the far end of the trail is a long run of ruins, and the tile nearest 40% is also the last plains or forest tile. Den 2 takes that tile and den 1 moves back to the next one before it, so the dog still moves when the war starts. Every sweep seed has two different dens, in order, strictly between the yard and the threshold; gate 1 checks it.
3. **The trail goes around towns where it can.** "Passes beside it" is taken to hold for every town. Paths are first sought over tiles that are not towns; only where that fails does the trail cross one (31 seeds). A town on the trail carries sign in LOOK and keeps its own glyph on the map.
4. **No tile twice.** Yard to via and via to threshold are each shortest walks, and the second avoids the tiles of the first. Where it cannot, the via point is dropped and the trail goes straight to the threshold.
5. **Ties are broken by seeded noise, on fixed salts.** For the threshold, the via town, the tile beside it, and each step of a path. Changing a salt in `trail.js` moves every trail.
6. **The trail is built on terrain alone.** `walkable()` ignores every world event, so the trail is the same after a load, a war or a closed road. The gesture, by contrast, walks the map as it is now.
7. **CALL's "within 3 trail positions" counts both ways.** One tile past the dog there is no sign, and CALL still says "The wind carries it. Maybe." That is true, and it catches an overshoot.
8. **ASK DOG on the world map and CALL inside a map with no dog use CALL's rule.** v13 used "near" for both. On a trail, "near" would make "the ground suggests you are close" true at the yard, 12 tiles from the dog. Both lines now mean within three trail positions.
9. **`?` is drawn only for a hint bit on the trail.** In play the two are the same thing. A v13 save code can carry hint bits from the old field; they are kept, they still count toward Homecoming's five, and they are not drawn.
10. **The yard is not marked as found at the start.** A hint is recorded by walking onto a tile, as in v13. LOOK at the start reports sign; the `?` appears if the player steps back onto it.
11. **The gesture's error picks another open direction by seeded roll.** v13 took its second-strongest gradient, which no longer exists.
12. **`tracker` re-tries bare tiles after the world changes.** When the war starts or the capital falls, sign spreads along the trail, so tiles the bot found bare are worth another look. It learns of the change from the page, as a player does.
13. **Tuning names.** `dogNearAbove`, `dogVeryNearAbove`, `dogRollAbove`, `gestureMinGradient` and `gestureMinSignal` are gone with the field. New: `homeRegionMinTiles`, `trailLength`, `thresholdMinSteps`, `viaTownWithin`, `den1At`, `den2At`, `callNearPositions`, `gestureSignWithin`.

## 7. For M4

- **Decisions needed first** (spec section 8): the ending without the dog, and fatigue as time. "Guarded" is settled.
- **`dogIndex()` in `trail.js`** is the one place that reads the clock for the dog.
- **`generateRuin` must place the dog on the threshold**, as `generateWilderness` does now, or gate 3 fails. On 599 sweep seeds the threshold is plains or forest.
- **Gates** are in `sweepGates()`. They reach the three clock states by setting events.
- **An open visit keeps its dog.** Transcripts 15 and 16 depend on it.
- **Three sweep seeds have no town in the yard's region.**
- **`npm run bots` now takes about ten minutes** for three policies; the explorer is the slow one.

## 8. Questions for the owner

1. The tag `m3` is created by the workflow when this is merged. Nothing to do.
2. Three worlds in 2,000 have every town in a pocket too small for a trail, and I put the game on the mainland there, with no town in reach. The alternatives are to leave them as tiny games, or to have such seeds place a town on the mainland, which would change those worlds. I chose the one that changes least. Say if you want another.
3. The legend has no entry for `?` until M6. If you would rather have one now, give me the word for it: the default in the spec's vocabulary would be "Sign".
4. M4 needs two decisions before it starts: what the ending without the dog is, and whether fatigue costs time.
