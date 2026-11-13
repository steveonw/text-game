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
| asker | If a town lies within 16 steps, walks to the nearest, asks one person about the dog until they gesture, FOLLOWs when they offer to show the way (M7), rides the wagon when offered, follows a gesture to sign, then tracks. With no town that near it tracks from the yard. Rests when spent |
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

## Trials, before the guide

One constant at a time, 300 seeds, against the baseline on the same 300 seeds (resting 47%, asker 25%, tracker 23%). None was kept at this point.

| Change | resting | asker | tracker | Notes |
| --- | --- | --- | --- | --- |
| baseline | 47% | 25% | 23% | |
| `gestureAtFamiliarity` 3 → 1 (a gesture on the first ask) | 47% | 25% | | Homecoming falls to 0: the asker no longer stays to earn reputation |
| `gestureSignWithin` 4 → 12 (gestures from far more towns) | 47% | 25% | | |
| `viaTownWithin` 10 → 20 (the trail passes a town more often) | 43% | 30% | | Moves the trail, so the sign bots lose a little |
| `gestureMisleadChance` 0.12 → 0 | | 25% | | |
| `warFrom` 30 → 40 (a later war; change dates stay in 80 to 130) | 64% | 29% | 34% | Lifts the sign bot past its target before the asker moves |
| All six asking levers at once, each at its most generous: the four above, `rideMinFatigue` 0, `rideMinFamiliarity` 0 | 43% | 33% | | An upper bound, not a candidate |

## Why the ask target could not be met by tuning

Every number that touches asking, set as generously as it goes, takes the asker from 25% to 33%. The one number that moves it more, the war date, moves the sign bot faster, past 60% while the asker is under 30%.

The reason was in the design, not the numbers. The trail starts at the yard, under the player's feet, so every trip to a town is a detour from it. And a gesture told you one step: the first step from that town toward the dog. It saved the asker a little of the probing that slows the tracker, but cost it the walk to the town and back.

The owner chose to keep the target and make asking say more.

## How much asking would have to say

Before changing the game, three bots measured what a town's answer is worth, on 300 seeds. Each uses the real game up to the answer; after it, the bot is handed what the answer would say.

| What the answer gives | Asker on den 1 before the war |
| --- | --- |
| Nothing new (the M6 asker) | 25% |
| A direction toward the dog in eight ways, and roughly how far | 49% |
| The same, and how far exactly | 50% |
| The dog's exact place | 64% |
| The dog's exact place, and the trail passing a town within 20 steps of the yard | 73% |
| A bot that knows the place from the start, walks to the nearest town, asks, and walks straight to den 1 | 75% |

Only an answer that gets you to the place reaches the band. A direction and a distance leave too much ground to search. So the change is a guide: someone who has seen the dog walks you there.

## The change: a guide (logic and text, by the owner's decision)

In a town that has seen the dog, a person who points true when asked about it offers to show the way: one of three lines, then "(Type FOLLOW.)". FOLLOW walks you by the shortest open way to the tile where the dog rests. Every step costs what a move costs, in steps of the clock and in fatigue; sign on the way is found; the clock runs as you walk. A wrong gesture (familiar, not trusted, 12% of the time) comes with no offer, and a town that has not seen the dog never offers. Seven new lines, tagged `// REVIEW`. With the guide and nothing else changed, 300 seeds: asker 61%, resting 47%.

The asker was taught two things a player can see: FOLLOW when offered, and do not walk to a town more than 16 steps away; track from the yard instead.

## Trials with the guide

300 seeds, one change at a time. The asker's range is the bot's; the rest are `tuning.js`.

| Change | resting | asker |
| --- | --- | --- |
| The guide, asker range 12 (no other change) | 47% | 67% |
| asker range 16 | 47% | 62% |
| range 12, `viaTownWithin` 10 → 15 | 45% | 68% |
| range 12, `viaTownWithin` 10 → 20 | 43% | 66% |
| range 16, `viaTownWithin` 15 | 45% | 69% |
| range 16, `viaTownWithin` 20 | 43% | 69% |
| range 16, `viaTownWithin` 15, then `seenWithin` 2 → 4 | | 70% |
| range 16, `viaTownWithin` 15, then `warFrom` 30 → 34 | 50% | 71% |
| range 16, `viaTownWithin` 15, `warFrom` 34, `seenWithin` 4 | 50% | 73% |

`viaTownWithin` lets the trail pass the nearest town when that town is up to 15 steps from the yard, not 10, so more players have a town on the way that has seen the dog. `seenWithin` counts a town as having seen the dog when sign lies within 4 tiles, the distance at which people already gesture; before, a town between 2 and 4 tiles from the trail could point but not say it had seen anything. `warFrom` gives everyone four more steps before the war; it moves both bots, and the sign bot stays in its band.

## Final

`tuning.js`, against the starting values:

| Constant | Start | Final |
| --- | --- | --- |
| `viaTownWithin` | 10 | 15 |
| `seenWithin` | 2 | 4 |
| `warFrom` | 30 | 34 |

Every other value is unchanged. 2,000 seeds:

| Bot | On den 1 before the war | Reunion | Homecoming | Found in Time | The Long Way Back | The Open Gate | None | Ends before step 12 | Steps at the ending: p10, median, p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| explorer | 0 (0%) | 138 | 0 | 58 | 50 | 1754 | 0 | 26 | 77, 106, 117 |
| tracker | 555 (28%) | 442 | 0 | 183 | 79 | 1296 | 0 | 20 | 33, 100, 114 |
| resting | 1021 (51%) | 850 | 0 | 312 | 147 | 691 | 0 | 19 | 27, 49, 110 |
| asker | 1489 (74%) | 641 | 723 | 173 | 50 | 413 | 0 | 3 | 24, 33, 107 |
| waiter | 0 (0%) | 0 | 0 | 0 | 0 | 2000 | 0 | 0 | 96, 107, 118 |
| homecoming | 64 (3%) | 7 | 45 | 44 | 28 | 1876 | 0 | 1 | 93, 106, 117 |

| Target | Result | |
| --- | --- | --- |
| Every seed can be won at every stage | 2,000 of 2,000 | holds |
| resting on den 1 before the war, 40% to 60% | 51.0% | holds |
| asker on den 1 before the war, 70% to 85% | 74.5% | holds |
| No bot ends before step 12 on more than 5% | 1.3% at most (explorer) | holds |
| Each ending reached by some bot on 5% or more | Reunion 42.5%, Homecoming 36.1% (asker), Found in Time 15.6%, The Long Way Back 7.3%, The Open Gate 100% | holds |
| The roads change between step 80 and step 130 | 85 to 130 | holds |

The asker followed a guide in 1,275 games of 2,000 and a gesture in 1,396. The CI job `balance` runs `npm run balance` and fails on any miss. About 17 minutes on GitHub's runner.
