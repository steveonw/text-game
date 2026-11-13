# M6 · Endings, saves, interface

**Goal.** All five endings exist and report true numbers, save codes are short, and the page shows what the game knows.

**Entry state.** Tag `m5`. The owner has decided on old save codes (spec section 8). This sheet assumes they keep loading.

**Branch and tag.** `m6-endings`, tagged `m6` on merge.

**Read first.** Spec 4.6 and 4.7. The M5 exit report. `src/endings.js`, `src/save.js`, `src/render.js`. `test/golden/legacy-codes.json`.

## Tasks

1. **The Open Gate.** Replace M4's placeholder with about 8 lines in the shape of v13's endings: a few short lines, the title, "Ending: The Open Gate", then the stats. Tag them `// REVIEW`. The four v13 endings stay word for word.
2. **Stats.** Every ending reports: steps taken; towns entered of towns total; people spoken to; sign found of trail length. Track towns entered with a 4-bit mask set on ENTER.
3. **Save v5.** Bytes, in order: version 5; seed as a zigzag varint; x; y; fatigue and reputation in one byte; steps as a varint; flags; found sign as a mask over trail positions, length-prefixed, trailing zero bytes trimmed; the towns-entered mask; sick, burned and closed tile lists as in v13; up to 22 people as in v13; CRC-16. Encode as base64url.
4. **Readers.** Try in this order: v5; v13 packed, version bytes 3 and 4; base32 version 2; the older base32 form. From an old code keep seed, position, fatigue, reputation, steps and people. Turn its flags into a stage floor. Keep hint bits that lie on the trail. Drop the rest.
5. **Legend.** It follows the mode. World: v13's list plus `?` for sign. Local: inn, market, smithy, temple, guard post, wagon, burned or stone, brush, rock, person, dog.
6. **LOOK.** On the world map it adds one line naming the four neighbours, in the order north, east, south, west.
7. **HELP.** It lists every live command and alias. The side panel matches it.
8. **Label.** The map's `aria-label` states the mode and the position.

## Invariants

- The text and conditions of the four v13 endings.
- Every code in `legacy-codes.json` loads to its recorded state, less the fields task 4 says to drop.
- The world, trail and clock for a seed are unchanged.

## Acceptance

- [ ] One scripted transcript reaches each of the five endings. After each, NEW and LOAD work.
- [ ] SAVE at step 0 is 40 characters or fewer on all 2,000 sweep seeds. v13: 90 to 92.
- [ ] Round trip: for 200 mid-game states from the asker bot, LOAD of SAVE restores every saved field.
- [ ] A one-character change to a v5 code is refused with v13's refusal line.
- [ ] "Towns entered" equals the distinct town tiles ENTERed in the transcript.
- [ ] For 1,000 random walkable tiles, LOOK's neighbour line matches the four neighbouring tiles.
- [ ] The legend shows local glyphs on a local map and world glyphs on the world map.

## Traps

- v13's writer is named `packStateV3` but writes version byte 4. Its reader accepts 3 and 4. The next number is 5.
- The base32 reader upper-cases its input and base64url is case-sensitive. Decide the format before normalizing anything.
- v13 stores trust in a nibble offset by 5, hostility in 3 bits, and familiarity in a byte capped at 99. Keep those encodings for people.
- Found sign is indexed by trail position in v5 and by world tile in v13 codes. Convert on load.
- An ending is not saved. A code made before the last CALL reloads to the world map, as in v13.
- Local `T` is a temple and world `T` is a town. Local `^` is rock and world `^` is mountains. The legend must show the right meaning for the mode.
- The neighbour words must come from the same function that draws the map, so closures, sickness and ruins read the same in both.
- v13's "Towns visited" counted remembered building staff (defect D15). Replace the count; do not adjust it.
- From M3: found sign is drawn as `?`, but the legend does not show it yet. M3 could add no text. The legend by mode is where it belongs.
- From M3: a hint bit on a tile off the trail can only come from a v13 code. `worldGlyph` in `render.js` keeps it and does not draw it, and it still counts toward the five that Homecoming asks for. Save v5 drops such bits when it converts.
- From M3: `trail().index` maps a world tile to its trail position, and `trail().tiles` the other way. That is the conversion the v5 mask needs.
- From M4: The Open Gate is `triggerEnding("changed")` in `endings.js`. Its body is one placeholder line, `ROADS_CHANGED`. Write the ending there.
- From M4: the dates are computed from the seed (`dates()` in `clock.js`) and are not saved. A code saved by v13 after one of its dates catches up on the first step after loading: the war, the fall and, if it is past the change date, the end, all at once. Decide whether an old code that late should end at once.
- From M4: the mode label reads `RUIN` inside a ruin map. The legend by mode needs an entry for stones: `r` fallen, `^` standing.
- From M4: a tired world move adds 2 to the step counter, so "Steps taken" on the ending screen counts clock steps, not moves.
- From M5: REST now works on the world map. The legend by mode should say so if it lists commands.
- From M5: a townsperson is labelled "Someone" (v13). If the owner wants "Local", it is `speakerName` in `commands.js`.
- From M5: the 118 new lines and the 15 from M4 carry `// REVIEW` until the owner has edited them. A test checks the tag on the M5 lines; when the owner approves them, change that test to check the tag is gone.

## Out of scope

Tuning numbers. New dialogue. Touch controls.

## Exit report

The standard report, plus the v5 byte layout as implemented, code lengths at step 0 and at step 40, and the drafted ending lines in one block.
