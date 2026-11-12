# M2 · Repairs

**Goal.** Every v13 defect that needs no design decision is fixed, each with its own regression test.

**Entry state.** Tag `m1`. Modules and bundle both pass every M0 golden.

**Branch and tag.** `m2-repairs`, tagged `m2` on merge.

**Read first.** Spec section 3, the defect table. The M1 exit report.

## Tasks

Fix each defect below, add a test named for its ID in `test/repairs.test.mjs`, then re-record only the golden transcripts that the fix changes.

| Defect | Fix |
| --- | --- |
| D1 | In END mode accept NEW, HELP and LOAD in any format |
| D2 | The guard post gets its own slot at local (7,4), the east end of the street. Inn, market, smithy and temple keep the four corners |
| D3 | TALK and ASK need an entry in `local.npcs` on the player's tile. Otherwise print v13's "No one to speak with here." and change no memory or reputation. ASK DOG on the world map keeps its v13 behavior |
| D4 | When every candidate line is inside the no-repeat window, return the candidate shown longest ago. A reply always has at least one line after the name tag |
| D5 | Topic lookup order: the role's pool for that topic, then `TOPIC_FALLBACKS`, then the generic pool for that topic. Never another topic's lines |
| D6 | ENTER on an `R` tile opens a town only if `isTownAt` is true. A natural ruins tile opens as wilderness until M4 gives it its own map |
| D7 | `generateTown` treats the capital after `capital_fallen` exactly as a burned town |
| D8 | RIDE clears the log before its first line, not after its fifth |
| D9 | If the wagon was present when the player entered a town, the merchant counts as present until the player leaves |
| D10 | An action that costs several steps advances the clock one step at a time |
| D17 | DEBUG and BLOCK respond only when the page was opened with `?debug=1` |
| D19 | NEW always opens on the world map: `mode` and `local` are reset before the new game starts |

One addition follows from D3: a burned town places one Survivor in `local.npcs` on its first burned building, so that role can still be spoken to.

## Invariants

- World hashes unchanged.
- The dog is still v13's signal field. Do not touch it.
- The save format is unchanged and every legacy code still loads.
- No new player-facing text.

## Acceptance

- [ ] `test/repairs.test.mjs` has one passing test per defect: D1, D2, D3, D4, D5, D6, D7, D8, D9, D10, D17, D19.
- [ ] Sweep: in every town where smith and guard both roll, both appear. v13: 0 of 2,717.
- [ ] TALK six times and ASK six times at one inn: each reply has at least one line after the name tag, and no line appears twice in one reply.
- [ ] After any ending, `NEW x` starts a game and `LOAD` of a code from SAVE loads it.
- [ ] ASK TOWN at an inn returns no line from the inn's ROAD pool.
- [ ] ENTER on a natural ruins tile shows no walls. ENTER on the fallen capital shows only burned timbers.
- [ ] The exit report lists each re-recorded golden beside the defect ID that changed it.

## Traps

- D3 removes the only way a Survivor could be spoken to in v13, which worked by accident. The added Survivor entry keeps the role alive.
- D4's cause is the early return in the picker when `extraAvoid` is set and nothing is left. `pickMany` relies on that return to avoid repeating a line within one reply. Keep that guarantee while removing the silence.
- D9: `local.wagonForced` already marks arrivals by RIDE. Reuse it instead of adding a second flag.
- D10 changes when war, sickness and burning fire on any run that uses REST or RIDE. Only transcripts with those commands should change.
- D2 moves `G` on every town map. Every transcript that draws a town will change; that is expected.
- D6: a burned town and the fallen capital also draw as `R` but are towns. Test all three kinds of `R`.
- D5: `TOPIC_FALLBACKS` has no DOG, ROAD or ROUTES entries. Those topics still come from the role and generic pools.
- D19: M0's transcript `27-new-inside-a-town` pins the broken behavior. It is the one golden this fix should change.

## Out of scope

The trail, the clock's rules, fatigue, road closures, ruin maps, new lines, the save format, the legend.

## Exit report

The standard report, plus a table of defect ID, test name and goldens re-recorded.
