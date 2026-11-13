# Balance

The bots' results on the 2,000-seed sweep, against the targets for 1.0 (spec 4.8). Reproduce any table here with:

```
npm run balance                                   # the build in src/, every bot, the targets, exit 1 on a miss
node tools/tune.mjs key=value ... --seeds 300     # a trial: the same, with TUNE values changed, src/ untouched
```

Seeds are the sweep's, `sweep-1` to `sweep-2000`. M3 to M6 measured on 500 seeds named `bot-N`; those numbers are close but not the same.

## The bots

| Bot | Plays |
| --- | --- |
| explorer | Walks to the nearest tile it has not stood on, ENTERs wherever the trail is fresh. Ignores sign. The walk behind spec section 3 |
| tracker | Follows sign from the yard, never talks, never rests |
| resting | The tracker, resting whenever it is spent |
| asker | Walks to the nearest town, asks one person about the dog until they gesture, rides the wagon when offered, follows the gesture to sign, then tracks. Rests when spent |
| waiter | Only WAITs |
| homecoming | Earns reputation 3 in the nearest town, then goes back to the yard and tracks |

**Which bot the targets read.** The spec's sign target is for "a bot that follows sign and never talks". Both tracker and resting fit. The gate reads **resting**: since M5, resting outside a town restores all fatigue for two steps, so a bot that never rests plays a tired game on purpose. tracker is reported beside it. The ask target reads **asker**.

## Baseline: M6, the starting values

`tuning.js` as at tag `m6`. 2,000 seeds.

| Bot | On den 1 before the war | Reunion | Homecoming | Found in Time | The Long Way Back | The Open Gate | None | Ends before step 12 | Steps at the ending: p10, median, p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| explorer | 0 (0%) | 122 | 0 | 48 | 56 | 1774 | 0 | 23 | 83, 104, 116 |
| tracker | 534 (27%) | 432 | 0 | 175 | 82 | 1311 | 0 | 21 | 32, 97, 113 |
| resting | 965 (48%) | 794 | 0 | 325 | 153 | 728 | 0 | 20 | 27, 58, 108 |
| asker | 542 (27%) | 75 | 233 | 168 | 78 | 1446 | 0 | 2 | 33, 100, 115 |
| waiter | 0 (0%) | 0 | 0 | 0 | 0 | 2000 | 0 | 0 | 93, 105, 116 |
| homecoming | 60 (3%) | 5 | 40 | 42 | 21 | 1892 | 0 | 1 | 91, 104, 116 |

| Target | Result | |
| --- | --- | --- |
| Every seed can be won at every stage | 2,000 of 2,000 | holds (the sweep gates in `npm test`) |
| resting on den 1 before the war, 40% to 60% | 48.3% | holds |
| asker on den 1 before the war, 70% to 85% | 27.1% | **misses** |
| No bot ends before step 12 on more than 5% | 1.1% at most (explorer, tracker) | holds |
| Each ending reached by some bot on 5% or more | Reunion 39.7%, Homecoming 11.7% (asker), Found in Time 16.3%, The Long Way Back 7.6%, The Open Gate 100% | holds |
| The roads change between step 80 and step 130 | 82 to 130 | holds |

Five of six hold at the starting values. Only the asker misses, by more than 40 points.

## Trials

One constant at a time, 300 seeds, against the baseline on the same 300 seeds (resting 47%, asker 25%, tracker 23%). None was kept.

| Change | resting | asker | tracker | Notes |
| --- | --- | --- | --- | --- |
| baseline | 47% | 25% | 23% | |
| `gestureAtFamiliarity` 3 → 1 (a gesture on the first ask) | 47% | 25% | | Homecoming falls to 0: the asker no longer stays to earn reputation |
| `gestureSignWithin` 4 → 12 (gestures from far more towns) | 47% | 25% | | |
| `viaTownWithin` 10 → 20 (the trail passes a town more often) | 43% | 30% | | Moves the trail, so the sign bots lose a little |
| `gestureMisleadChance` 0.12 → 0 | | 25% | | |
| `warFrom` 30 → 40 (a later war; change dates stay in 80 to 130) | 64% | 29% | 34% | Lifts the sign bot past its target before the asker moves |
| All six asking levers at once, each at its most generous: the four above, `rideMinFatigue` 0, `rideMinFamiliarity` 0 | 43% | 33% | | An upper bound, not a candidate |

## Why the ask target cannot be met by tuning

Every number that touches asking, set as generously as it goes, takes the asker from 25% to 33%. The one number that moves it more, the war date, moves the sign bot faster, past 60% while the asker is under 30%.

The reason is in the design, not the numbers. The trail starts at the yard, under the player's feet, so every trip to a town is a detour from it. And a gesture tells you one step: the first step from that town toward the dog. It saves the asker a little of the probing that slows the tracker, but costs it the walk to the town and back. Asking is worth it to a player who has lost the trail, not to one standing on it.

To make the asker reach den 1 before the war on 70% to 85% of seeds while the sign bot stays at 40% to 60%, asking has to tell the player more than tuning can make it tell. That is a change of logic or text, which M7 may not make (its invariants). It is the owner's decision; see the M7 stop report.

## Final

Unchanged from the baseline: no value in `tuning.js` was changed. The CI job `balance` runs `npm run balance` and fails if any target but the ask target misses. The ask target is reported as `open` until the owner decides.
