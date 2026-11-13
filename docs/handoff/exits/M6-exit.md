# M6 exit report

Step: M6 · Endings, saves, interface. Branch `m6-endings`. Written 2026-11-13.

The owner's decision: old save codes are dropped. The owner found the old saving "a bit much" and left the call to Claude; the rest of the sheet stands as written. Codes from v13, and from the builds up to M5, are refused with v13's refusal line. The sheet assumed they would keep loading, so its task 4 (the readers) and one invariant are replaced; see section 7.

All five endings now end the same way, with four true numbers. A fresh game saves in 23 to 26 characters, where v13 took 90 to 92. The legend follows the map you are on, LOOK names the four neighbours in words, HELP and the side panel list every command, and the map says where you are to a screen reader.

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/save.js` | Rewritten. Save v5 is the only format: `packState()`, `tryLoad()`, `savePassword()`, `loadPassword()`. v13's base32 writer, its packed reader and the legacy reader are gone |
| `src/endings.js` | The Open Gate's lines; the stats block shared by all five endings; `townsEntered()`, `signFound()` |
| `src/content/pools.js` | `OPEN_GATE` (6 lines, each `// REVIEW`), `LEGEND` by mode, `COMMANDS`. M4's placeholder `ROADS_CHANGED` is gone |
| `src/render.js` | `legendItems()`, `legendHtml()`, `mapLabel()`, `commandsHtml()`. The page sets the map's `aria-label` and fills the side panel from `COMMANDS` |
| `src/commands.js` | HELP reads `COMMANDS`. World LOOK adds `neighbourLine()`. ENTER on a town, and the wagon stopping in one, sets its bit in `G.townsEntered` |
| `src/state.js` | `townsEntered`, reset by NEW |
| `src/index.template.html` | The side panel's fixed command list is replaced by an empty `#commands`, filled at start |
| `test/save.test.mjs` | New. 4 tests |
| `test/interface.test.mjs` | New. 8 tests |
| `test/modules.test.mjs`, `test/bundle.test.mjs` | v13's codes are refused with v13's line; the current game's codes load to their recorded state; the markup test allows the side panel's change and nothing else |
| `test/repairs.test.mjs`, `clock.test.mjs`, `content.test.mjs` | HELP's new first line; the refusal lines; `OPEN_GATE`; legend names in the lint |
| `test/golden/` | Re-recorded. `legacy-codes.json` is replaced by `save-codes.json`. See section 3 |
| `tools/record-goldens.mjs` | Records 15 v5 codes from the ends of 14 transcripts and a fresh game. Transcript 12 now shows old codes refused |
| `tools/harness/` | `readSaveCodes()`, `SAVE_SNAPSHOT_EXPR`; the stub DOM has `setAttribute` |
| `tools/browser-check.mjs` | The legend count follows the mode; checks the side panel and the map label |
| `tools/sweep.mjs` | Measures code length with the new writer |
| `README.md`, `docs/SPEC.md`, M7 sheet | The decision; 4.7's save bullet; an M6 block under "Since v13"; notes carried forward |

Seven source files changed, by 282 lines added and 560 removed. `src/save.js` went from 631 lines to 263.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 275
# pass 275
# fail 0
```

The count is lower than M5's 309. M5 checked each of v13's 19 codes as its own subtest in more than one file; those went with the codes. The tests this step adds are listed in section 4.

`npm run sweep` on `dist/index.html`: 2,000 of 2,000 seeds winnable, the fresh-trail line true on all of them, every gate passes. World hashes, trails and clock dates are unchanged from M5.

`npm run browser-check`, Chrome 153: 34 of 34 transcripts in `test/golden` match on the built page, and 27 of 27 in `test/golden-v13` match on the legacy page. The legend has the right number of items for the mode, the side panel lists the commands and the map has its label. No errors, no request beyond the page itself.

CI on pull request 9 passed both jobs on commit `948490c`: `test` on Node 20 (build, 275 tests, the built file uploaded) and `browser` on Node 22 with GitHub's Chrome. The only commit after that one adds this paragraph.

### Code lengths

SAVE at step 0, every sweep seed:

| | Characters |
| --- | --- |
| v13 | 90 to 92 |
| M6 | 23 to 26 |

SAVE at step 40, mid-game, from two bots on 500 seeds (only games still running at step 40):

| Bot | Games | Shortest | Median | 90th percentile | Longest |
| --- | --- | --- | --- | --- | --- |
| asker: talks in towns, so carries people | 177 | 28 | 43 | 55 | 68 |
| resting: follows sign, speaks to no one | 130 | 27 | 32 | 36 | 42 |

People cost most: each takes 5 to 7 bytes, about 8 characters. A code with all 22 people and the longest tile lists would be about 260 characters; no bot came near it.

## 3. Goldens

`test/golden-v13/` is untouched. `test/golden/` was re-recorded: 34 transcripts. Twelve replay exactly as at `m5`: 05 to 10, 18, 20 and 31 to 34.

Same commands, different lines:

- **LOOK on the world map** now ends with the neighbour line, for example "North: forest. East: forest. South: forest. West: forest." That is the only change in 02, 03, 04, 19, 21, 22, 24 to 27 and 30.
- **HELP** now opens "Commands:" and lists each command with what it does: 01 and 23.
- **The five endings** end with the new stats block: 13, 14, 15, 16, 28, 29 and 23 (which ends as The Open Gate and so shows its lines).

Changed commands:

- **11-save-and-load.** Loads a v5 code where it loaded a base32 one, and plays on from it.
- **12-old-codes-refused** replaces 12-load-old-formats. It LOADs a code in each of v13's four formats and a v5 code with one character changed: each is refused, "The password refuses to settle." "LOAD ABC" is "Invalid password.", as in v13. Then the game's own code takes.
- **17-after-an-ending.** After the ending, loads a v5 code from another game where it loaded a base32 one.

`save-codes.json` holds 15 codes, 26 to 55 characters long, each with the state it must load to. Both the module and bundle tests load every one.

## 4. Acceptance

- [x] One scripted transcript reaches each of the five endings. After each, NEW and LOAD work. (13, 14, 15, 16 or 28, and 23; the test plays NEW and LOAD after each)
- [x] SAVE at step 0 is 40 characters or fewer on all 2,000 sweep seeds: 23 to 26.
- [x] Round trip: for 200 mid-game states from the asker bot, saved at steps 3 to 92, LOAD of SAVE restores seed, position, fatigue, reputation, steps, events, found sign, people and towns entered.
- [x] A one-character change to a v5 code is refused with v13's refusal line. The test changes every character of a recorded code to every other base64url character. A code cut short or with a character added is refused too.
- [x] "Towns entered" equals the distinct town tiles ENTERed, counted by replaying each ending transcript. A second test replays the wagon transcript and checks the town it stops in is counted.
- [x] For 1,000 random walkable tiles, LOOK's neighbour line matches the four neighbouring tiles as the map draws them.
- [x] The legend shows local glyphs on a local map and world glyphs on the world map.

Invariants:

- [x] The text and conditions of the four v13 endings. The test checks their lines against v13's, word for word; only the stats under them changed, as task 2 asks.
- [ ] ~~Every code in `legacy-codes.json` loads to its recorded state.~~ Replaced by the owner's decision: every v13 code is refused, and every code in `save-codes.json` loads to its recorded state.
- [x] The world, trail and clock for a seed are unchanged.

Defects closed: D15 (the ending counted remembered staff as towns), D16 (the legend ignored the mode) and the last of D18 (no ending for a dog not found).

## 5. The drafted lines, for the owner to edit

### The Open Gate

Shown when the roads change before the dog is found. Each line carries `// REVIEW` in `OPEN_GATE`, `src/content/pools.js`.

```
The roads have changed.
The one you walked is gone.
Somewhere past the stones, it waits.

You go back the way you remember.
The gate stands open.
Nothing comes through it.

THE QUIET ROADS
Ending: The Open Gate

Steps taken: 112
Towns entered: 1 of 4
People spoken to: 3
Sign found: 7 of 31

(NEW <seed> to begin again)
```

The numbers are an example. The last five lines are shared with the other four endings.

### Interface labels

New words, not tagged, since they name things rather than speak:

- **Stats:** "Steps taken", "Towns entered: a of b", "People spoken to", "Sign found: a of b".
- **Legend, world:** v13's list, Player, Person, Plains, Forest, Water, Mountains, Town, Capital, Ruins, Blocked, Distress, with Sign in place of Dog. No dog is ever drawn on the world map; v13 listed one there.
- **Legend, town:** Player, Person, Street, Wall, Inn, Market, Smithy, Temple, Guard post, Wagon, Burned.
- **Legend, wild:** Player, Person, Ground, Brush, Rock, Dog. **Ruins:** Player, Ground, Fallen stone, Standing stone, Dog.
- **HELP and the side panel,** one row each: N S E W, move (also NORTH SOUTH EAST WEST) · LOOK, look around · ENTER, go into a town, the wild or ruins · EXIT, back to the road (also EX, EXT) · TALK, speak to someone here (also HI, HELLO) · ASK <topic>, DOG ROAD TOWN ROUTES WAR SICKNESS WORK · CALL, call your dog · WAIT, let a moment pass · REST, rest a while · RIDE, ride the wagon, when offered · STATUS, how you are, how the roads are · SAVE, get a password · LOAD <password>, go back to a saved game · NEW <seed>, a new world · CLEAR, clear the log · HELP, this list.
- **Map label:** "World map. You are at x, y." or "Town map, at tx, ty. You are at px, py." (Wild and Ruins the same).
- **The neighbour line** uses the world legend's names in lower case, and "the edge" past the map.

## 6. The v5 byte layout, as implemented

Then base64url without padding. A code must be spelled exactly as SAVE writes it.

| Field | Bytes |
| --- | --- |
| version | 1 byte, 5 |
| seed | zigzag varint |
| x, y | 1 byte each |
| fatigue, reputation | 1 byte: fatigue in the low 4 bits, reputation in the high 4 |
| steps | varint |
| flags | 1 byte: bit 0 routes stirring, bit 1 war, bit 2 capital fallen |
| found sign | varint length n, then n bytes. Bit i is trail position i. Trailing zero bytes trimmed |
| towns entered | 1 byte: bit i is `G.towns[i]` |
| sick towns | varint count, then a varint tile index (y × 20 + x) each, 50 at most |
| burned towns | the same |
| closed roads | the same |
| people | varint count, 22 at most, then each as in v13: identity (0 the cabbage merchant; 1, or 1 \| 4 in the wild, an ambient speaker, then tx, ty; 2, a cell id, tx, ty); familiarity 1 byte, 0 to 99; trust + 5 in the low nibble and hostility in the next 3 bits; the asked-topic mask, 1 byte |
| check | CRC-16-CCITT of everything above, 2 bytes, little-endian |

A fresh game is 17 to 19 bytes: 14 fixed (version, x, y, fatigue and reputation, steps, flags, an empty sign mask, towns, three empty lists, no people, and the 2-byte check) and 3 to 5 for the seed.

## 7. Decisions the sheet did not cover

1. **Old codes are refused, not converted.** The owner's call. Task 4's readers were not written and v13's were removed, so `save.js` is under half its old size. A v13 code described a world with no trail and no fixed dates; a converted one would have started a game that was neither.
2. **The refusal lines are v13's.** "Invalid password." for anything under 10 characters or with a character outside base64url; "The password refuses to settle." for everything else that does not load; "The password takes." on success. (In the M6 plan I wrote that the refusal would read "The password doesn't take." That was wrong; these are the lines.)
3. **A code must be spelled exactly as SAVE writes it.** The last base64url character can carry spare bits, so two spellings could decode to the same bytes. LOAD re-encodes and compares, so a changed character is always refused, as the acceptance asks.
4. **LOAD is case-sensitive,** as base64url must be. v13 upper-cased its input.
5. **LOAD parses the whole code before it changes anything,** so a refused code leaves the game as it was.
6. **"People spoken to"** counts the people the game remembers, as v13 did for its count. It is true now, since M2 stopped empty tiles answering.
7. **"Towns entered"** counts ENTER on a town tile, the capital included, burned or not, and a town the wagon stops in, since the ride leaves you inside it. The sheet said ENTER only; a player who rode in has entered the town all the same.
8. **"Sign found" is out of the whole trail,** yard to threshold, so it is rarely all of it: the trail past the dog's den is not sign until the dog moves on.
9. **The world legend swaps Dog for Sign.** The sheet said v13's list plus `?`; v13's list includes `d Dog`, which only a local map draws, so it moved to the wild and ruins lists.
10. **The legend is split by local map:** town, wild and ruins each have their own list, so `T` and `^` mean one thing on each. The sheet's single local list would have put temple and rock side by side.
11. **The side panel is the one change to v13's markup,** and the bundle test allows exactly that. It is filled from `COMMANDS` when the page starts, so HELP and the panel cannot drift apart.
12. **DEBUG and BLOCK** are listed by HELP only on a page opened with `?debug=1`, as their own row, and never in the panel.
13. **After loading,** the clock counts the loaded step as already read, so a load never replays that step's warning or road closure.

## 8. For M7

- **The Open Gate's 6 lines** carry `// REVIEW`, with M5's 118 and M4's 15.
- **Code length** grows with people spoken to, about 8 characters each. If a shorter mid-game code matters, people are where to look; nothing in the spec asks for it.
- **`v1.0.0`** still has to be pushed by the owner, or the publish job needs a trigger the owner can run by hand. Spec section 8 has the open decision.

## 9. Questions for the owner

1. **Six Open Gate lines need your edit,** in section 5, before their `// REVIEW` tags come off. The 118 from M5 and 15 from M4 are still waiting too.
2. **The labels in section 5** (legend names, HELP's descriptions, the stats) are mine. Say if any should read differently.
3. **Still open from M5:** asking does not pay yet (M5 report, question 2), and whether a townsperson should be labelled "Local" rather than "Someone".
4. **M7 needs one decision before it starts** (spec section 8): how 1.0 is published. The default is GitHub Pages, built by CI on a version tag, with `dist/` not committed.
