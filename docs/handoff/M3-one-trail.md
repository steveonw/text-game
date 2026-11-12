# M3 · One trail

**Goal.** One dog on one seeded trail replaces the signal field, so every clue is true and every seed can be won.

**Entry state.** Tag `m2`. The owner has accepted the trail and the `?` glyph for found sign (spec section 8). If either is still open, stop and ask.

**Branch and tag.** `m3-trail`, tagged `m3` on merge.

**Read first.** Spec 4.1 and 4.8. The M2 exit report. `src/world.js`.

## Tasks

1. **Start.** `placePlayer` keeps its seeded candidate order but accepts only tiles in the largest walkable region that contains a town. The start tile is the yard.
2. **Trail.** Create `src/trail.js` with `buildTrail(G)` returning `{tiles, den1, den2, threshold}`:
    - Threshold: among reachable natural-ruins tiles 20 or more steps from the yard, the one whose distance is closest to 30. If there is none, the reachable plains or forest tile whose distance is closest to 30.
    - Via point: if a town lies within 10 steps of the yard, the walkable tile beside that town nearest the yard.
    - Tiles: the shortest walkable path from the yard through the via point to the threshold. Ties between equally short steps are broken by `noise01` on a fixed salt. No tile appears twice.
    - Dens: the plains or forest tiles nearest 40% and 70% along the list. Neither is a town, the yard or the threshold.
3. **Where the dog is.** `dogTile(G)` returns den 1 before war, den 2 once `war_started` is set, and the threshold once `capital_fallen` is set. The clock itself is still v13's.
4. **Sign.** Trail tiles from index 0 up to the dog's index carry sign. Moving onto one sets its hint bit, as v13 does for near tiles. The third still sets `routes_stirring`.
5. **Predicates.** `dogIsNear` becomes "this tile has sign". `dogIsVeryNear` becomes "this is the dog's tile". LOOK, CALL and the inner lines keep v13's wording.
6. **CALL on the world map.** On the dog's tile, the very-near answer. Within 3 trail positions of it, the near answer. Otherwise the flat answer.
7. **Wilderness.** `generateWilderness` places the dog on the dog's tile, always, at a seeded cell, and nowhere else. Once a local map shows the dog, it stays for that visit.
8. **Map.** The world map draws `?` on plains and forest tiles whose hint bit is set. Towns, the capital and the player take precedence.
9. **Gesture.** The direction is the first step of the shortest walkable path from the speaker's tile to the dog's tile. It is offered only where some sign tile lies within 4 tiles of the speaker. Familiarity, trust and the 12% error stay as v13 has them.
10. **Gates.** Extend `tools/sweep.mjs` so CI fails on: a seed without a trail; a seed where the yard cannot reach den 1, den 2 and the threshold; a fresh-trail message not followed by a dog on ENTER.
11. **Bot.** Add `tracker` to `tools/bot.mjs`: it follows sign by trying unvisited neighbours and never talks. Report its median steps to den 1.

## Invariants

- World hashes unchanged.
- The start tile moves only on seeds whose v13 start lay outside the largest region, at most 10 of the 2,000 sweep seeds. List them.
- No new player-facing text. Every LOOK and CALL string is v13's.
- The save format is unchanged. Hint bits stay indexed by world tile.

## Acceptance

- [ ] Sweep: 2,000 of 2,000 seeds winnable. v13: 1,992.
- [ ] Sweep: "The trail is fresh. ENTER to search." is followed by a dog on ENTER every time. v13: 40.1%. At `m2`: 40.2%.
- [ ] Exactly one dog tile per seed in each of the three clock states.
- [ ] Trail length is 20 or more on at least 95% of seeds. The distribution is in the exit report.
- [ ] The tracker bot reaches den 1 on every seed.
- [ ] Start tiles differ from M0's only on the listed seeds. M0 recorded every start tile in `test/golden/world-hashes.json`.

## Traps

- On most seeds the threshold is an `R` tile. Until M4 adds ruin maps, ENTER there uses the wilderness map from M2's D6 fix, and that is what makes the dog reachable after the capital falls. Test it.
- The yard is sign tile 0, so stirring now begins within the first few moves on every seed. That is intended.
- v13's seeded candidate order for the start must not change, or every seed's start moves. Only the test a candidate must pass changes.
- "Largest region" means the largest connected set of walkable tiles that contains at least one town, which may not be the largest set overall.
- Build the path ignoring `road_blocked_` tiles. M4 handles closures.
- Homecoming still asks for 5 hint tiles. They are now sign tiles, so that rule's code does not change.
- Wanderers are rolled independently of the dog. Keep their roll and its salt, or every wilderness map drifts.
- Measured on v13: the farthest walkable tile is a median 31 steps from the start, and 1,394 of 2,000 seeds have a natural-ruins tile 20 or more steps away. Expect the plains fallback on about 30% of seeds.
- From M2: `enterKind(x, y)` in `commands.js` says what ENTER opens on a tile, `"TOWN"`, `"WILD"` or nothing. Ask it wherever the trail needs to know whether a tile can be searched. Natural ruins answer `"WILD"`.
- From M2: under v13's signal field the dog can now be found in natural ruins (3,440 dog tiles over the sweep). This step replaces that field, so those tiles go with it. The sweep pins in `test/bundle.test.mjs` record M2's numbers and are meant to change here.
- From M2: the goldens to re-record are in `test/golden/`. Transcripts 13 to 17, 19 and 28 find the dog through the signal field. Their plans in `tools/record-goldens.mjs` use `__openDogTile` and `__ruinDogTile`, which need new definitions. `test/golden-v13/` is frozen.
- From M2: the bot policy `homecoming` earns reputation from a person in a town. `homecoming-v13` works only on the legacy file.

## Out of scope

Clock rules, closures, fatigue, ruin maps, new lines, save v5.

## Exit report

The standard report, plus the trail-length distribution, the seeds whose start moved, how many seeds used the plains fallback, and the tracker bot's results.
