# M4 exit report

Step: M4 · The clock. Branch `m4-clock`. Written 2026-11-12.

The owner's decisions (spec section 8): a tired move costs an extra step, and the other defaults stand, so the game ends as The Open Gate when the roads change. "Guarded" was settled before M3.

The clock now has three dates read from the seed, five stages and an end. Every gate passes on all 2,000 seeds. The game is not balanced: see section 2 and question 1.

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/clock.js` | `dates()`, `stage()`, `STAGE_WORDS`, foreshadow lines, road closures, `wagonStops()`, `nextWagonStop()`, the end. v13's per-step rolls for the war and the fall are removed |
| `src/commands.js` | A world move at fatigue 5 takes two steps. `enterKind()` can answer `"RUIN"`. LOOK inside a ruin map. REST in a sick town. RIDE goes to `nextWagonStop()` and stops if the story ends on the way. STATUS has four lines |
| `src/local.js` | `generateRuin()` |
| `src/endings.js` | `triggerEnding("changed")`: The Open Gate, one placeholder line |
| `src/content/pools.js` | Fifteen new lines, each tagged `// REVIEW` |
| `src/render.js` | Status bar words from `stage()`. The dog is drawn in a ruin map as in the wild |
| `src/trail.js` | `isThreshold()` |
| `src/world.js`, `src/state.js` | `tileAt()` remembers each seed's terrain on `G.terrain` |
| `src/tuning.js` | Four roll thresholds removed; twelve clock numbers added |
| `test/clock.test.mjs` | New. 16 tests |
| `test/trail.test.mjs`, `test/repairs.test.mjs` | Ruins and the threshold open as ruin maps; D10 uses the war date |
| `test/bundle.test.mjs`, `test/modules.test.mjs` | Gates 4 and 5; clock pins; 30 transcripts |
| `test/golden/` | Re-recorded from the build. See section 3 |
| `tools/sweep.mjs` | Gates 4 and 5; clock statistics |
| `tools/bot.mjs` | `waiter` |
| `tools/harness/` | `walkTo` plans again after each step. `__isWild`, `__localAt`; `__warStep` and `__fallStep` read the dates |
| `tools/record-goldens.mjs` | Plans fit inside the dates |
| `README.md`, `docs/SPEC.md`, M5 to M7 sheets | What M4 changed; the two decisions; an M4 block under "Since v13"; notes carried forward |

Ten source files changed, by 314 lines added and 39 removed. `save.js`, `people.js`, `rng.js` and the page template did not change.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 282
# pass 282
# fail 0
```

`npm run sweep`, gates on `dist/index.html`: all 2,000 seeds pass.

`npm run browser-check`, Chrome 153: 30 of 30 transcripts in `test/golden` match on the built page, and 27 of 27 in `test/golden-v13` match on the legacy page. No errors, no request beyond the page itself.

CI on pull request 7 passed both jobs on commit `01b2daf`: `test` on Node 20 (build, 282 tests, the built file uploaded) and `browser` on Node 22 with GitHub's Chrome. The only commit after that one adds this paragraph.

### The clock over 2,000 seeds

| | Earliest | Median | Latest |
| --- | --- | --- | --- |
| War starts | step 30 | 40 | 50 |
| Capital falls | 55 | 73 | 90 |
| Roads change, the story ends | 82 | 105 | 130 |

Roads closed while a player waits the whole game out: a median 4, 5 at most, none on 63 seeds. On every seed, at every point where a road closed or the dog moved, the dog's tile could be walked to from the yard and ENTER there showed the dog.

### Bots, 500 seeds

| Bot | Reunion | Homecoming | Found in Time | The Long Way Back | The Open Gate | Median step at ending |
| --- | --- | --- | --- | --- | --- | --- |
| waiter | 0 | 0 | 0 | 0 | 500 | 104 |
| tracker | 98 | 0 | 45 | 16 | 341 | 99 |
| homecoming | 0 | 9 | 7 | 5 | 479 | 104 |
| explorer | 22 | 0 | 12 | 17 | 449 | 103 |

- **Waiter.** Ends on the change date on 500 of 500 seeds.
- **Tracker.** At `m3` it found the dog on every seed and stood on den 1 before the war on 82%. Now it loses 341 games of 500 to The Open Gate and reaches den 1 before the war on 131 (26%), after a median 51 steps where it took 28.

### Why the tracker loses

One rule does it. With `exhaustedMoveSteps` set to 1, and nothing else changed, the same bot over the same seeds:

| | Tired moves cost 2 (M4) | Tired moves cost 1 |
| --- | --- | --- |
| On den 1 before the war | 131 (26%) | 425 (85%) |
| Lost to The Open Gate | 341 (68%) | 17 (3%) |
| Median steps to den 1 | 51 | 28 |

The 1.0 target is 40% to 60%, between the two.

Two things make the rule bite this hard:

- Fatigue reaches 5 after five moves, or three through forest, and following sign means stepping onto a tile and back whenever a guess is wrong. So nearly every move after the first few costs double.
- Resting does not pay. A tired move costs 2 steps. WAIT, then a fresh move, costs 2. REST in the wild costs 2 and restores 2. Only REST in a town (3 for 2) and the wagon come out ahead. Spec 4.3 says tiredness should make resting, towns and the wagon into choices; at the starting numbers it makes two of them choices and the first one pointless.

I left the numbers as the spec gives them. Tuning is M7's job, and the sheet for it now has these figures.

## 3. Goldens

`test/golden-v13/` is untouched. `test/golden/` was re-recorded from the build: 30 transcripts. Seven replay as at `m3`: 03, 05, 06, 10, 11, 18, 22.

Same commands as M3, different lines:

- **01, 02, 07, 08, 13, 27.** A tired move takes two steps, so step-keyed lines shift; or the routes stir at step 24 where they had not.
- **15-ending-found-in-time.** The war now starts on its date for this seed.
- **21-debug-and-block.** Only its description changed.

Plans changed to fit the dates:

- **09-ride, 14, 16, 19, 24, 25, 26.** Each needed the war, the fall, sickness or a burning by a certain step, or needed them not to happen. Several moved to another seed. 26 now also RESTs in the sick town and shows fatigue fall by one.
- **12-load-old-formats, 17-after-an-ending.** Their save codes come from other transcripts, which changed.
- **28-dog-at-the-threshold.** After the fall there is no longer time to walk the whole trail, tired. The player now walks to den 2 early and waits there: the war brings the dog to that tile, the fall takes it on, and the threshold is at most ten tiles away. The threshold opens as a ruin map and the dog is at a stone.
- **29-dog-moves-on.** The player waits one tile short of den 1 until the war starts.

Rewritten or new:

- **04-enter-natural-ruins.** A ruin map: LOOK at the ground, a fallen stone and a standing stone; no one to speak with.
- **20-tired-walking.** Replaces `20-fatigue-cap`. Twelve moves; STATUS shows the step counter pull ahead once fatigue is 5; two WAITs; the next move takes one step.
- **23-long-clock.** Waits from the first step to "Ending: The Open Gate" on step 107, with STATUS and LOOK at each stage. Every announcement, all three foreshadow lines, a burning and three closures are in it.
- **30-a-road-closes.** New. The rumor arrives, the player walks up to the closed tile and is refused, and the status word is "guarded".

Save codes: 4 of 19 are identical to M3's; the rest come from transcripts that changed. All 19 codes made by v13 still load to the state v13 recorded.

World hashes: unchanged from M3 on all 2,000 seeds.

## 4. Acceptance

- [x] On 2,000 seeds: `warStep` is 30 to 50, and `fallStep - warStep` and `changeStep - fallStep` are each 25 to 40. Gate 4.
- [x] REST or RIDE across a date fires the change on the right step. `test/clock.test.mjs`: REST across the last date ends on it; RIDE across the war date announces the war during the ride; RIDE across the last date ends on the way.
- [x] With closures simulated to the end, the dog can be reached at every stage on 2,000 of 2,000 seeds. Gate 5.
- [x] At fatigue 5 one world move raises the step counter by 2. At fatigue 4, by 1.
- [x] ENTER on a natural ruins tile shows no walls and no buildings, and TALK answers "No one to speak with here."
- [x] The waiter bot ends at `changeStep` on every seed: 500 of 500, and gate 5 does the same on all 2,000.
- [x] A sick town is never the wagon's next stop. Tested over 200 steps from every stop.

Invariants:

- [x] World hashes unchanged. The trail and dens for a seed are unchanged from M3: `trail.js` gained one function and lost none, and the sweep's trail pins are the same.
- [x] v13's existing lines are unchanged.
- [x] Old save codes still load. Their flags set a floor on the stage: routes 1, war 2, capital 3.
- [x] The wagon ignores closures: a town is never closed, and RIDE does not walk.

## 5. The new lines, for the owner to edit

All are in `src/content/pools.js`, tagged `// REVIEW`. The sheet asked for 14; there are 15, because STATUS needed a line for the fourth status word.

| Where it is shown | Line |
| --- | --- |
| Before the war, one of | "Smoke on the horizon, thin and straight." |
| | "Dust rises where no wind is." |
| | "The birds have gone quiet." |
| Before the fall, one of | "Riders pass. None look back." |
| | "Bells, somewhere. Then nothing." |
| | "Fewer people on the road now." |
| Before the roads change, one of | "The road feels less certain underfoot." |
| | "The milestones lean. The count is off." |
| | "The way behind looks unfamiliar." |
| A road closes | "Word arrives: a road has been closed." |
| LOOK in a ruin map, open ground | "Old stones stand in the grass." |
| LOOK at a fallen stone | "A fallen stone. Moss in the cuts." |
| LOOK at a standing stone | "A standing stone. It leans." |
| The Open Gate, placeholder until M6 | "The roads have changed. The one you walked is gone." |
| STATUS during the war | "The roads feel guarded." |

Two labels are also new on the page: the mode label `RUIN` inside a ruin map, and "Ending: The Open Gate".

## 6. Left undone

- **Balance.** Section 2. M7.
- **The Open Gate's text.** One placeholder line. M6.
- **The legend** shows neither `?` nor the stones. M6.
- **Foreshadowing "through `maybeInternal`".** The sheet asked for that. `maybeInternal` rolls and rate-limits, so it could not promise exactly one line per change. The clock picks one seeded step in the eight before each date and prints the line there itself, taking the inner voice's turn for that step.

## 7. Decisions the sheet did not cover

1. **The stored truth is still v13's three events.** The clock adds `routes_stirring`, `war_started` and `capital_fallen` on their dates, and `stage()` reads them. So every old code means what it meant, and `dogIndex()` did not change.
2. **Catching up.** A code saved by v13 can be past a date with nothing having happened. On the first step after loading, the clock adds what is due, in order; if the code is past the change date the story ends at once. Question 2.
3. **Closures protect the yard's reach as well as the player's.** The sheet says a closure may not cut off anything the player can reach. A player who rode the wagon into another region would leave the home region unprotected, so the same test is made from the yard.
4. **Closures can be fewer than six, or none.** Candidates are tiles on shortest walks between towns. On 63 sweep seeds no such tile can be closed without cutting something off, or no two towns are joined.
5. **The threshold opens as a ruin map on every seed,** as the sheet says, including the 599 where it is plains or forest. On the world map such a tile still reads "Open land stretches out."
6. **The dog waits at a stone only at the threshold.** The dens are plains or forest and still open as wilderness.
7. **When sickness reaches every stop, the merchant keeps his whole route.** The sheet says he stays where he is; with no memory of where that was, the timetable carries on as if nothing were skipped. The route is never empty.
8. **A ride from a town that has just fallen sick** goes to the stop after the timetable's, and never back to the town it starts from.
9. **A tired move is charged on the world map only,** as the sheet says. Inside a town, the wild or a ruin every move is one step.
10. **The clock is read on each of a tired move's two steps,** by the same loop REST and RIDE use.
11. **RIDE stops if the story ends on the way.** The wagon's arrival lines are not printed after an ending.
12. **`tileAt()` remembers its answers.** Terrain is a pure function of the seed. The clock's closures and the gates walk the map many times a game; without this the test suite took eleven minutes, with it a minute and a half. All 2,000 world hashes are unchanged.
13. **`walkTo` in the test harness plans again after each step,** since a road can close on the way.

## 8. For M5

- **The lines above** are drafts. M5 writes about 140 more under the same rules and the same tag.
- **`gestureFor`** should be built on `dogDirectionHint()`. It already walks the map as it stands, so it routes around closed roads.
- **A ruin map has no one in it,** by rule.
- **The asker bot** should be reported beside the tracker's 26%, not M3's 82%.
- **`npm run bots`** takes about six minutes for four policies.

## 9. Questions for the owner

1. **The fatigue rule makes the game hard to win as it stands.** A bot that follows sign and never talks loses two games in three. The plan was always to tune numbers in M7, but that is three steps away and you may be playing in between. If you would like it playable sooner, the smallest change that lands in the target range is one for M7's sheet to test, for example charging the extra step only at fatigue 5 in forest, or letting REST in the wild restore 4. I have not tried these; say if you want me to measure a few now.
2. **Old codes past the last date end on their first step.** A v13 save from step 150 loads, and the story ends when the player moves. The alternative is to let such a code run on with the dog at the threshold. M6 owns old codes; I chose the rule that keeps one clock.
3. **Fifteen lines need your edit** before they can lose their `// REVIEW` tag. They are listed in section 5.
4. M5 needs one decision before it starts (spec section 8): who writes the roughly 140 new lines. The default is that I draft them under the voice rules and you edit every line before merge.
