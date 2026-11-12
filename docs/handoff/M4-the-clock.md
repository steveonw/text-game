# M4 · The clock

**Goal.** The clock has bounded stages and an end, and fatigue, road closures, ruins and sickness do what the game's text says they do.

**Entry state.** Tag `m3`. The owner has settled three decisions in spec section 8: the ending without the dog, fatigue as time, and the status word "guarded". If any is open, stop and ask.

**Branch and tag.** `m4-clock`, tagged `m4` on merge.

**Read first.** Spec 4.2, 4.3, 4.4 and 4.8. The M3 exit report. `src/clock.js`, `src/trail.js`, `src/local.js`.

## Tasks

1. **Dates.** In `clock.js`, derive three steps from the seed with `noise01` on fixed salts: `warStep` from 30 to 50; `fallStep`, 25 to 40 after it; `changeStep`, 25 to 40 after that. They are computed, never stored.
2. **Stages.** `stage(G)` returns 0 to 4. Stirring begins at the third sign tile or at step 24, whichever comes first. War, the fall and the change begin on their steps. Remove v13's per-step rolls for war and the fall.
3. **Announcements.** Keep v13's lines for stirring, war and the fall. In the 8 steps before each change, show at most one foreshadow line, through `maybeInternal`.
4. **Fatigue.** On the world map, a move made at fatigue 5 advances the clock by 2.
5. **Closures.** From the war on, every 18th step close one road by setting `road_blocked_` on one tile, 6 at most. Candidates are tiles on shortest paths between towns, ranked by seeded noise. Skip a candidate that is a town, the player's tile, a den or the threshold, or whose closing would leave any tile the player can now reach unreachable.
6. **Burning.** Keep v13's rule. On a step where both fall due, burning runs before the closure.
7. **Sickness.** Keep v13's rule. Add two effects: the wagon's route skips a sick town, and REST in a sick town restores 1.
8. **Ruin maps.** Add `generateRuin(tx, ty)` to `local.js`: 9×9, no walls, 5 to 9 stones drawn with `r` and `^`, nobody in `local.npcs`. ENTER on a natural ruins tile or on the threshold opens it.
9. **The threshold.** In stage 3 the dog stands at a seeded stone in the threshold's ruin map. CALL on its cell ends as The Long Way Back, by v13's rule.
10. **The end.** When the clock reaches `changeStep`, call `triggerEnding("changed")`. Its text is a marked placeholder until M6.
11. **Status.** The status bar and STATUS use four words: quiet, unsettled, guarded, hollow.
12. **Gates.** Extend the sweep: the three dates fall in their windows on every seed; with closures simulated to `changeStep`, the dog's tile can be reached from the yard at every stage.
13. **Bot.** Add `waiter`, which only WAITs. It must end at exactly `changeStep` on every seed.

This step needs 14 new lines: three foreshadow lines for each of the three changes, one rumor of a closed road, three LOOK lines for stones, and one line for the roads changing. Draft them under the voice rules, tag each `// REVIEW`, and list them in the exit report for the owner to edit.

## Invariants

- World hashes unchanged. The trail and dens for a seed are unchanged from M3.
- v13's existing lines are unchanged.
- Old save codes still load. Their flags set a floor on the stage: routes 1, war 2, capital 3.
- The wagon ignores closures.

## Acceptance

- [ ] On 2,000 seeds: `warStep` is 30 to 50, and `fallStep - warStep` and `changeStep - fallStep` are each 25 to 40.
- [ ] REST or RIDE across a date fires the change on the right step.
- [ ] With closures simulated to the end, the dog can be reached at every stage on 2,000 of 2,000 seeds.
- [ ] At fatigue 5 one world move raises the step counter by 2. At fatigue 4, by 1.
- [ ] ENTER on a natural ruins tile shows no walls and no buildings, and TALK answers "No one to speak with here."
- [ ] The waiter bot ends at `changeStep` on every seed.
- [ ] A sick town is never the wagon's next stop.

## Traps

- The closure check must use the map as the player walks it. Water, mountains and earlier closures all block.
- Closures may cover sign tiles. The player detours and picks the trail up again. Exempt only the dens and the threshold.
- All step-keyed noise shifts when fatigue adds steps. Transcripts that walk at fatigue 5 will change; say so in the report.
- The dates come from seeded noise, not from play, so SAVE needs no new field.
- If every town on the wagon's route is sick, the merchant stays where he is. Never let the route become empty.
- `routes_stirring` is still a stored event. Reaching stage 1 at step 24 must add it, so v13-format saves stay truthful.
- v13 lets the capital fall only while stirring. Stirring is now certain by step 24 and war comes no earlier than 30, so the order is fixed. Delete the old condition; do not keep two rules.
- The fallen capital and burned towns already show burned timbers and a Survivor after M2. Ruin maps are for natural ruins and the threshold only.

## Out of scope

Dialogue beyond the 14 lines, gestures, the fifth ending's text, save v5, the legend.

## Exit report

The standard report, plus the 14 drafted lines in one block, and the distribution of the three dates over the sweep.
