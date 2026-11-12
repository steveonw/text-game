# The Quiet Roads — Spec Sheet

Written 2026-11-11 against `legacy/quiet-roads-v13.html`. This file is the first source of truth for every step. The handoff sheets that go with it are in `docs/handoff/`.

## 1. How to read this

This sheet specifies The Quiet Roads as it stands in v13, carries the design through to a finished 1.0 in `steveonw/text-game`, and gives one AI handoff sheet per milestone.

Every statement carries one of three labels:

- **As-built**: read from the v13 source, `quiet-roads-v13-better-ask-towns.html` (2,185 lines, one file, no dependencies). In this repo it is `legacy/quiet-roads-v13.html`.
- **Measured**: produced by running v13's own code headlessly in Node across a seed sweep. Numbers are in section 3. `npm run sweep` and `npm run bots` reproduce them.
- **Proposed**: a design decision for 1.0. Each one extends a thread that v13 already contains; none is in the code today.

**Repo state.** When this spec was written, `steveonw/text-game` held one commit (`0aadd0b`, "Initial commit") containing only an MIT `LICENSE`. The repo layout in section 5 was therefore a proposal, not a description. M0 is the first step to put anything in it.

## 2. As-built: what v13 is

v13 is a complete, playable loop: a seeded 20×20 world, towns to talk in, a dog to find, and four reunion endings. Everything in this section is as-built.

### Pillars

- One HTML file, no dependencies, runs offline (header comment: "Single-file, deterministic, no dependencies").
- Deterministic. All generation flows from one 32-bit seed, set by `?seed=` or `NEW <seed>`. The map is never stored; it is recomputed from position and seed.
- Terse voice. The 103 pooled lines average 4 words; none runs past 10. No exclamation marks, no digits, no proper nouns.
- No combat, inventory or death. Pressure comes from the world changing as steps accumulate.
- A muted ASCII map (palette marked LOCKED in the source) beside a typed-command log.
- Password saves.

### World and player

| System | Rule in v13 |
| --- | --- |
| Terrain | Four seeded fields (elevation, moisture, civilization, danger) set each tile: water `~`, mountains `^`, forest `F`, ruins `R`, plains `.`. Water, mountains and blocked tiles `#` stop movement. |
| Towns | Up to 4 (`T`), at least 6 tiles apart, on the highest-civilization land. The best-scoring town is the capital `C`. |
| Start | A seeded passable tile from which some town can be reached. |
| Local maps | ENTER opens a 9×9 map built from the tile. A town has walls, cross streets, up to 4 buildings drawn from 5 kinds, sometimes a townsperson and the wagon. Wilderness has brush and rock, sometimes a wanderer, sometimes the dog. |
| Dog | A noise field, `dogSignal`. Above 0.78 a tile is "near" and counts as a hint. Above 0.90 it is "very near", and 40% of very-near wilderness tiles hold the dog. |
| Steps | Every move, wait, rest and ride advances one counter. All world change keys off it. |
| Fatigue | 0 to 5. Plus 1 per move, plus 2 into forest. WAIT restores 1, REST 3 in town or 2 in the wild, RIDE 3. |
| Reputation | 0 to 5. Plus 1 per ASK, plus 1 per TALK with someone already met. At 3 or more, each conversation raises that person's trust. |

### The clock

| Event | Trigger | Effect |
| --- | --- | --- |
| Routes stirring | The player has stood on 3 different "near" tiles | Unlocks ASK ROUTES; status reads "unsettled"; enables sickness and the capital's fall |
| Sickness | While stirring, every 12th step: one random town, 55% chance | Town shows `!`, loses its market and townsperson; people add sickness lines |
| War | Each step after 28: 8% chance | People add war lines; enables burning |
| Town burned | During war, every 18th step: the most dangerous non-capital town, if its danger score passes 0.9 | Town shows `R`; buildings become burned timbers; no staff |
| Capital fallen | While stirring, each step after 60: 6% chance | Capital shows `R`; status reads "hollow" |

### Commands

| Command | Where | Effect | Steps |
| --- | --- | --- | --- |
| N S E W (or full words) | World, local | Move one tile; walking off a wilderness map exits it | 1 |
| ENTER, EXIT | World, local | Open or leave the local map | 0 |
| LOOK | Anywhere | Describe the tile; in the world, report dog sign | 0 |
| TALK (HI, HELLO) | Local | Opener, one line, close | 0 |
| ASK topic | Local; DOG also in the world | Two lines on DOG, ROAD, TOWN, ROUTES, WAR, SICKNESS or WORK; DOG may add a direction gesture | 0 |
| CALL | Anywhere | Hot or cold in the world; on the dog's tile it ends the game | 0 |
| WAIT | Anywhere | Fatigue down 1 | 1 |
| REST | Local | Fatigue down 3 in town, 2 in the wild | 2 |
| RIDE | On the wagon tile | Travel to the merchant's next town; fatigue down 3; needs fatigue 2 or more and two earlier talks | 3 |
| STATUS, HELP, CLEAR | Anywhere | Information | 0 |
| SAVE, LOAD code | Anywhere | Password out, password in | 0 |
| NEW seed | Anywhere | New world | reset |
| DEBUG, BLOCK | Anywhere | Undocumented: state dump; toggle a road block on the current tile | 0 |

### People and talk

Each speaker is a role tied to a tile: Innkeeper, Merchant, Smith, Priest, Guard, Local, Wanderer, Survivor, Cabbage Merchant. Each remembers familiarity, trust, hostility and which topics you have asked.

Every line carries a five-number mood vector: warmth, fear, authority, fatigue, instability. The game builds the same vector from the place, the world state and the speaker's memory of you, then picks the closest line that is not among the last 10 shown.

The cabbage merchant circulates among up to 3 towns, one stop per 7 steps. He has six complaint lines that advance with familiarity, and he offers the only fast travel.

### Endings

All four are reunions, reached by CALL on the dog's tile. The first matching row wins.

| Order | Condition | Ending |
| --- | --- | --- |
| 1 | The capital has fallen | The Long Way Back |
| 2 | War has started | Found in Time |
| 3 | 5 or more hint tiles and reputation 3 or more | Homecoming |
| 4 | Otherwise | Reunion |

### Saves

SAVE emits a base64url code: version byte 4, seed, position, fatigue, reputation, steps, three world flags, a 400-bit map of hint tiles, lists of sick, burned and blocked tiles, up to 22 remembered people, and a CRC-16. LOAD also accepts two older base32 formats. The local-map position is not saved; a loaded game always opens on the world map.

## 3. Measured: how v13 actually plays

v13 can be won on 1,992 of 2,000 seeds, but an attentive player reaches the dog in a median of 21 steps without speaking to anyone. Most of the game's systems never come into play.

**Method.** The v13 script was loaded unmodified into Node with a stubbed page and driven through its own `runCommand`. Sweep seeds are `fnv1a32("sweep-1")` to `("sweep-2000")`; bot runs use `"bot-1"` to `"bot-500"`. The explorer bot walks to the nearest unvisited tile, ENTERs every tile that reports a fresh trail, walks to the dog and CALLs. It never talks.

| Measure | Result | What it means |
| --- | --- | --- |
| Seeds with a reachable dog | 1,992 of 2,000 | 8 seeds cannot be won: the start is walled off from every dog tile |
| Reachable dog tiles per seed | median 10 | The dog is in about ten places at once |
| Steps from start to the nearest dog tile | median 4; 90th percentile 9 | The search is short by construction |
| "Near" tiles the player can reach | median 67, of a median 237 reachable tiles | "Something moved through here" fires on more than a quarter of the map |
| "The trail is fresh. ENTER to search." is true | 40.1% | The strongest clue is wrong three times in five |
| Direction gesture points toward the nearest dog | 58.9%, against 47.7% for a random open direction | An earned hint is 11 points better than chance |
| Explorer bot: step count at the ending | median 21; 10th percentile 5; 90th percentile 64 | A game is over before the clock matters |
| Explorer bot: endings over 500 seeds | Reunion 369, Found in Time 94, The Long Way Back 35, Homecoming 0, no ending 2 | Homecoming needs reputation, which only talking gives |
| Bot that plays for Homecoming (earns reputation 3, waits for 5 hints) | Homecoming 248, Found in Time 180, The Long Way Back 70, no ending 2 | The war roll decides the best ending half the time |
| Routes begin stirring | median step 10 (fired in 355 of 500 explorer runs) | The first stage starts almost at once |
| War starts | median step 37; 10th percentile 30; 90th percentile 57 | A hidden roll, unrelated to play |
| Capital falls, once stirring | median step 72; 10th percentile 63; 90th percentile 97 | Nothing follows it |
| Towns per seed | 4 in 71% of seeds, 3 in 11%, 2 in 18% | |
| Seeds with a town that cannot be walked to | 235 of 2,000 | Only the wagon reaches it |
| Natural ruins tiles per seed | mean 34 | Each opens as a walled town (D6 below) |
| Start to the nearest reachable town | median 8 steps | |
| Save code length at step 0 | 90 to 92 characters | The hint map alone is 50 bytes |

### Defects

Each was reproduced in the headless run unless marked "read", which means found by reading the source only. The last column is the milestone that closes it.

| ID | What happens | Cause in v13 | Closed in |
| --- | --- | --- | --- |
| D1 | After any ending, NEW is refused although the ending screen says "(NEW <seed> to begin again)", and LOAD rejects every code SAVE produces | END mode in `runCommand` (lines 2025 to 2029) accepts only LOAD and sends it to the old base32 loader | M2 |
| D2 | The guard post overwrites the smithy. In 2,717 towns where both rolled, the smith appeared 0 times | Five buildings share four slots in `generateTown` (lines 477 to 488) | M2 |
| D3 | TALK and ASK work on any local tile with nobody there. An empty field answers "Yes?" as a Wanderer and raises reputation | `cmdTalk` and `cmdAsk` never check `local.npcs` | M2 |
| D4 | Replies go silent. A second ASK that draws on the same lines, or a fourth TALK, prints only the speaker's name tag | Pools of 1 to 3 lines sit entirely inside the 10-line no-repeat window; `pickFragmentFrom` then returns nothing (line 674) | M2 |
| D5 | ASK TOWN, WAR, SICKNESS and WORK return the speaker's ROAD lines | The table written for them, `TOPIC_FALLBACKS` (line 645, 9 lines), is never read | M2, M5 |
| D6 | Natural ruins ("Old stones. A place avoided.") ENTER as intact walled towns with staff | `cmdEnter` (line 1587) sends every `R` tile to `generateTown` | M2, M4 |
| D7 | The fallen capital is unchanged inside: market, temple, guard and wagon as before | `generateTown` reads `burned_` but not `capital_fallen` | M2 |
| D8 | RIDE's five narration lines are erased in the tick they are written; only "The wagon stops." survives | `clearLogSoft()` runs after them (line 1846) | M2 |
| D9 | The wagon outstays the merchant. If his 7-step stop ends during the 3-step walk to him, the wagon stays drawn, TALK gives generic lines under his name, and RIDE says "No ride is offered." | The wagon is placed at ENTER; presence is re-checked against the schedule on every command | M2 |
| D10 | REST and RIDE skip clock checks for the steps they jump. Resting across the step where war would start leaves it unstarted | `advanceWorldPressure` evaluates only the final step number | M2 |
| D11 | Fatigue has no cost. It caps at 5 and movement continues, though the game says "Pushing further will cost something." | No rule reads fatigue for movement | M4 |
| D12 | Road blocks are drawn, enforced, saved and spoken of by guards, yet nothing in play creates one (read) | Only the undocumented BLOCK command sets `road_blocked_` | M4 |
| D13 | The line picker supports familiarity-gated lines, but no line uses the gate (read) | No pool entry has a `fam` field | M5 |
| D14 | 8 of 2,000 seeds are unwinnable | `placePlayer` checks for a reachable town, not a reachable dog | M3 |
| D15 | "Towns visited" on the ending screen counts remembered building staff, not towns. One town with three staff spoken to reports 3 | `countVisitedTowns` (lines 2007 to 2013) | M6 |
| D16 | The legend never shows local glyphs, and `T` and `^` mean different things on the two maps (read) | `renderLegend` is fixed | M6 |
| D17 | DEBUG and BLOCK are live for every player (read) | Parser cases at lines 2056 and 2057 | M2 |
| D18 | The opening sets a deadline, "Find it before the roads change", that the clock never reaches. No ending exists for a dog not found | Nothing follows `capital_fallen` | M4, M6 |
| D19 | NEW typed inside a town or wilderness map starts the new world but leaves the old local map on screen; TALK there is answered by "Someone". Found while recording M0 | `startNewGame` resets neither `mode` nor `local` | M2 |

## 4. The logical end: 1.0

1.0 makes the opening line true: one dog on one trail, a clock that ends, and people whose answers are worth the walk. Everything in this section is proposed.

No system here is new. Each finishes something v13 already says, stores or draws.

| Thread already in v13 | Where it leads in 1.0 | Step |
| --- | --- | --- |
| "Paw prints. Fading." "The trail is fresh." A hint map that is saved but never shown | One dog on one seeded trail; found sign drawn on the map; the fresh-trail line always true | M3 |
| "Find it before the roads change." Status words quiet, unsettled, hollow | A clock with bounded stages and a last one; the dog moves on as stages pass | M4 |
| "Pushing further will cost something." | At full fatigue a move costs two steps of clock | M4 |
| "Routes are closed. For your safety." Blocked tiles `#` | Guards close roads during the war, never the last way through | M4 |
| "Old stones. A place avoided." "Growled at old stones." "It lingered at the threshold." | Ruins get their own map; one is the threshold the dog is heading for | M4 |
| Trust, familiarity, reputation; an unused `fam` gate; an unused topic table | Topics answer the question asked; familiar people say more; trusted people point true | M5 |
| Wanderer and Survivor exist as names with no lines of their own | Each gets a pool | M5 |
| Four endings keyed to the clock; stats on the ending screen | A fifth ending for the dog not found; stats that count what they claim | M6 |
| "Short 1970-style passwords" that run to 92 characters | Save v5: about 40 characters at the start of a game | M6 |

### 4.1 The dog and the trail

The dog is in exactly one place, on a trail that is a pure function of the seed.

- **Trail.** An ordered list of world tiles from the yard (the start tile) to the threshold, a reachable natural-ruins tile about 30 steps away. Where the nearest town is close, the trail passes beside it.
- **Dens.** Two plains or forest tiles on the trail, at about 40% and 70% of its length.
- **Where the dog is.** Den 1 until the war; den 2 during the war; the threshold after the capital falls; gone once the roads change.
- **Sign.** Every trail tile from the yard up to the dog carries sign. Standing on one records it, as v13's hint map does, and draws it on the world map.
- **Reading sign.** LOOK reports sign but not its direction; the next tile is found by walking. "The trail is fresh. ENTER to search." prints only on the dog's own tile, and ENTER there always shows the dog.
- **Start.** The start tile lies in the largest walkable region that holds a town, so the whole trail can be walked on every seed.

This fits the map v13 already generates. The farthest tile a player can walk to is a median 31 steps from the start (5th percentile 21), and 1,394 of 2,000 seeds have a natural-ruins tile 20 or more steps away. On the rest, a plains or forest tile serves as the threshold and opens as a ruin map.

### 4.2 The clock

The clock has five stages in a fixed order, and its three dates are drawn once from the seed, so a seed always tells the same time.

| Stage | Status word | Begins | The world | The dog |
| --- | --- | --- | --- | --- |
| 0 Quiet | quiet | Step 0 | Nothing yet | Den 1 |
| 1 Stirring | unsettled | The third sign tile found, or step 24 at the latest | Sickness may reach a town every 12th step; ROUTES can be asked about | Den 1 |
| 2 War | guarded | A seeded step from 30 to 50 | Every 18th step a road closes and a town may burn | Den 2 |
| 3 Hollow | hollow | 25 to 40 steps after the war starts | The capital is in ruins | The threshold |
| 4 Changed | none | 25 to 40 steps after the fall | The story ends | Gone |

- The game therefore ends between step 80 and step 130. v13's medians, war at 37 and the fall at 72, sit inside these windows.
- Each change is announced when it happens, as in v13, and foreshadowed by one line during the 8 steps before it.
- The clock is evaluated on every step, including the steps inside REST and RIDE.
- A road closure is never placed on a town, the player's tile, a den or the threshold, and never where it would cut off any tile the player can currently reach. At most 6 roads close.
- Sickness keeps v13's rule and gains two consequences: the wagon skips a sick town, and REST there restores 1 instead of 3.

### 4.3 Fatigue becomes time

At fatigue 5, a world move advances the clock by 2 steps instead of 1. Recovery stays as in v13. Time is the only currency this game has, so tiredness is priced in it, and resting, towns and the wagon become choices.

### 4.4 Places

| Place | v13 | 1.0 |
| --- | --- | --- |
| Town | Five buildings in four slots | The guard post moves to the east end of the street; inn, market, smithy and temple keep the corners |
| Sick town | No market, no townsperson | Also: the wagon skips it; REST restores 1 |
| Burned town, fallen capital | Burned timbers and no one; the capital unchanged | Both burned; one Survivor to speak with |
| Ruins (old stones) | Opens as a town | Its own 9×9 map: stones, no walls, no one. On the threshold the dog waits among the stones during stage 3 |
| Wilderness | Dog on about 10 tiles | Unchanged, except the dog appears only on its den |

Ruin maps use only glyphs already in the locked palette.

### 4.5 People

- TALK and ASK need someone on the tile.
- Every role has lines for every topic. A speaker with nothing new repeats its least recent line; it never prints an empty reply.
- Each role gains one line at familiarity 2 and one at familiarity 4 for DOG, ROAD and ROUTES.
- Directions stay gestures, as in v13: "(A gesture: east.)". ASK DOG points along the walkable path to the dog. SICKNESS points to the nearest sick town, WAR to the nearest closed road or burned town, TOWN to the nearest other town.
- A gesture is always true at trust 2 or more. At familiarity 3 without that trust it is wrong 12% of the time, v13's rate. Below both there is no gesture.
- v13's sighting lines ("Ran past the gate.") are spoken only in towns the trail passes. Other towns get new lines for not having seen it.
- Wanderers and Survivors get their own pools.
- The cabbage merchant waits while you are in his town. His six complaints and the ride are unchanged, and the ride's narration is shown.

This needs about 140 new lines beside the 103 in v13, all under the voice rules in the standing brief.

### 4.6 Endings

| Ending | Condition in 1.0 | Change from v13 |
| --- | --- | --- |
| Homecoming | Dog found before the war, with 5 or more sign tiles found and reputation 3 or more | Same rule; now reachable by skill because the war date is bounded |
| Reunion | Dog found before the war, otherwise | None |
| Found in Time | Dog found at den 2 during the war | Place is now fixed |
| The Long Way Back | Dog found at the threshold after the capital falls | Place is now fixed |
| The Open Gate | The roads change first | New: the only ending without the dog |

After every ending NEW and LOAD work. The ending screen reports steps, towns entered of towns total, people spoken to, and sign found of trail length.

### 4.7 Interface and saves

- LOOK in the world names the four neighbouring tiles in words, so the game can be played without seeing the map.
- The legend follows the mode. Found sign is drawn with `?`, a glyph already in the palette and unused.
- HELP lists every live command. DEBUG and BLOCK need `?debug=1`.
- Save v5 stores found sign as a mask over trail positions (8 bytes, down from 50). Target: 40 characters or fewer at step 0.
- Every v13 code still loads. Seed, position, steps, stage and people carry over; hint tiles carry over where they lie on the trail.

### 4.8 Starting values and balance targets

All numbers live in one file and are tuned in M7 against bots, not by feel.

| Constant | Starting value | Basis |
| --- | --- | --- |
| War begins | Step 30 to 50 | v13 median 37 |
| Capital falls | 25 to 40 steps after war | v13 medians: war 37, fall 72 |
| Roads change | 25 to 40 steps after the fall | New |
| Stirring at the latest | Step 24 | v13 median 10 |
| Trail length | About 30 tiles, 20 at least | Measured reach, median 31 |
| Den positions | 40% and 70% of the trail | New |
| Slow walking | At fatigue 5 | New |
| Road closures | One per 18 steps, 6 at most | v13 burn cadence |
| Gesture error | 12% below trust 2 | v13 |

Targets for 1.0, each measured on the 2,000-seed sweep:

- Every seed can be won at every stage.
- A bot that follows sign and never talks reaches den 1 before the war on 40% to 60% of seeds.
- A bot that asks, follows gestures and rides does so on 70% to 85%.
- No bot finishes before step 12 on more than 5% of seeds. In v13 the 10th percentile is step 5.
- Each of the five endings is reached by some bot on at least 5% of seeds.

### 4.9 Not in 1.0

Combat, inventory, named characters, a larger world, sound, touch controls and translation.

## 5. Repo plan for steveonw/text-game

The repo keeps v13's promise of one dependency-free HTML file by building that file from small modules that Node can test directly.

```
text-game/
  LICENSE                     MIT
  README.md                   what it is, play link, how to test and build
  package.json                scripts only, no dependencies
  docs/
    SPEC.md                   this spec
    balance.md                bot results per release (M7)
    handoff/
      STANDING-BRIEF.md
      M0-baseline.md ... M7-release.md
      exits/M0-exit.md ...    written by the AI at the end of each step
  legacy/
    quiet-roads-v13.html      the prototype, byte for byte, never edited
  src/
    index.template.html       markup and CSS from v13
    main.js                   boot, input, history, initial seed
    state.js                  G, the one state object (M1)
    io.js                     the seam between logic and the page (M1)
    render.js                 the only module that draws
    rng.js                    fnv1a32, mix32, noise01
    world.js                  terrain fields, tiles, towns, capital, start
    trail.js                  trail, dens, sign (M3)
    local.js                  wilderness, town and ruin maps
    clock.js                  stages and world events
    people.js                 memory, mood vector, line picker
    commands.js               parser and every command
    endings.js
    save.js                   v5 writer, all readers
    tuning.js                 every tunable number
    content/pools.js          every player-facing line
  tools/
    build.mjs                 src -> dist/index.html
    browser-check.mjs         plays the goldens in headless Chrome (M1)
    harness/load.mjs          headless loader with a stub page
    harness/modules.mjs       plays the modules directly, with no page (M1)
    harness/golden.mjs        reads and replays the golden files
    record-goldens.mjs        records test/golden/ from a build
    sweep.mjs                 seed sweep and CI gates
    bot.mjs                   explorer, tracker, asker, waiter
  test/
    golden/                   transcripts, world hashes, legacy save codes
    *.test.mjs                run by node --test
  .github/workflows/ci.yml    test, sweep, build; publish on tag
```

### Conventions

- **No dependencies, shipped or dev.** Node 20 built-ins only: `node --test`, `node:vm`, `node:fs`.
- **One file ships.** `tools/build.mjs` orders modules by their imports, strips `import` and `export`, and inlines the result into the template. That works as a short script because modules use named exports only, with no default exports, no re-exports and no top-level name used twice.
- **Logic never touches the page.** Only `render.js` and `main.js` use `document`.
- **One state object.** Seed, mode, steps, player, events, memory and found sign live together, so save, load and tests see the same thing.
- **No clock or dice in logic.** `Math.random` and `Date` appear only in `main.js`, for the initial seed.
- **The world is frozen.** A golden hash of terrain, towns and capital per sweep seed fails CI if generation drifts.
- **One branch per step.** `m0-baseline` through `m7-release`, merged by pull request and tagged `m0` through `m7`; `v1.0.0` at the end.

### Commands

```
npm test          # node --test test/
npm run sweep     # seed sweep: winnability, clue truth, balance
npm run build     # writes dist/index.html
```

## 6. Roadmap

Eight steps take v13 to 1.0, and each ends at a gate that CI or a checklist can verify.

| Phase | Step | What it delivers | Gate |
| --- | --- | --- | --- |
| Secure the prototype | M0 · Baseline | v13 committed as is, harness, goldens, CI | Goldens pass |
| Secure the prototype | M1 · Modules | Modules and a build that match v13 | No golden moved |
| Secure the prototype | M2 · Repairs | 12 defects closed, a test for each | 12 tests pass |
| Finish the design | M3 · One trail | One dog, one trail, sign you can follow | 2,000 seeds winnable |
| Finish the design | M4 · The clock | Bounded stages, road closures, ruin maps | The clock ends |
| Finish the design | M5 · People | Every topic answered, true gestures | No empty reply |
| Finish the design | M6 · Endings | Five endings, short saves, full legend | v13 codes load |
| Ship | M7 · Release | Bot-tuned numbers, published on Pages | Targets in CI |

M0 to M2 change no design: they put v13 under test and repair what is broken. The first game-design decision is needed before M3. No step has a date; none was given.

## 7. AI handoff sheets

Each major step has its own sheet in `docs/handoff/`, written to be pasted into a fresh AI coding session. The standing brief that goes in front of every sheet, and the routine for using them, are in `docs/handoff/STANDING-BRIEF.md`.

Every sheet has the same parts: goal, entry state, tasks, invariants, acceptance checks, traps specific to this code, what is out of scope, and the exit report the session must write. The exit report is what the next session starts from.

| Step | Sheet | Needs before it starts | Hands back |
| --- | --- | --- | --- |
| M0 | `M0-baseline.md` | The empty repo and the v13 file; the repo-location decision | v13 committed untouched, a headless harness, golden transcripts, CI |
| M1 | `M1-modules.md` | Tag `m0`; the build decision | Source modules and a one-file build that match v13 exactly |
| M2 | `M2-repairs.md` | Tag `m1` | 12 defects closed, a test for each |
| M3 | `M3-one-trail.md` | Tag `m2`; the trail decision | One dog on one trail; every seed winnable; every clue true |
| M4 | `M4-the-clock.md` | Tag `m3`; the ending and fatigue decisions | A bounded clock that ends, road closures, ruin maps |
| M5 | `M5-people.md` | Tag `m4`; who writes the lines | 118 new lines, every topic answered, true gestures |
| M6 | `M6-endings-saves-interface.md` | Tag `m5`; the old-codes decision | Five endings, save v5, legend by mode, LOOK without the map |
| M7 | `M7-balance-and-release.md` | Tag `m6`; the publishing decision | Tuned numbers, `v1.0.0` published |

## 8. Open decisions

Nine choices are the owner's; each has a default that the handoff sheets assume, and the step it must be settled before.

- [x] **Where the game sits in the repo (before M0)**

    Decided 2026-11-11: at the root. The owner confirmed `text-game` is the repository for this project.

- [x] **A build with no dependencies (before M1)**

    Decided 2026-11-11: a short script of our own, `tools/build.mjs`. The owner said to go on to M1 with the default. The alternative was esbuild as a development-only dependency.

- [ ] **Trail, or a signal field (before M3)**

    Default: one dog on a walkable trail, as in 4.1. The lighter alternative keeps v13's signal field and centres it on a single dog. This is the largest design choice in the spec.

- [ ] **Two additions to locked things (before M3)**

    Default: `?` marks found sign on the world map, and "guarded" is the status word for the war stage. Both add to a palette and vocabulary the source treats as fixed.

- [ ] **An ending without the dog (before M4)**

    Default: The Open Gate ends the game when the roads change. The alternative is no deadline: the dog waits at the threshold for as long as it takes.

- [ ] **Fatigue as time (before M4)**

    Default: on, at fatigue 5. Without it fatigue stays a number that only gates the ride.

- [ ] **Who writes about 140 new lines (before M5)**

    Default: the AI drafts under the voice rules and the owner edits every line before merge. The alternative is that the owner writes them and M5 only wires them in.

- [ ] **Old save codes (before M6)**

    Default: every v13 code keeps loading. Dropping them removes two readers and their tests.

- [ ] **How 1.0 is published (before M7)**

    Default: GitHub Pages, built by CI on a version tag, with `dist/` not committed.
