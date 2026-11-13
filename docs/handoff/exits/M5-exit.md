# M5 exit report

Step: M5 · People. Branch `m5-people`. Written 2026-11-13.

The owner's decisions: Claude drafts the new lines under the voice rules and the owner edits every one before merge (the default); and resting outside a town should be allowed.

People now answer every topic, say more as they come to know you, and point true when they trust you. REST pays for itself outside a town. All 118 new lines are drafts, listed in section 5 for your edit.

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/content/pools.js` | `PEOPLE`: 118 new lines, each tagged `// REVIEW`. v13's pools are untouched |
| `src/people.js` | `topicLines()`: a role's v13 lines, then its new and earned lines, then `TOPIC_FALLBACKS`. `townSeesTrail()`. In a town off the trail, ASK DOG draws only on the not-seen lines |
| `src/gesture.js` | New. `gestureFor()`, `trueGesture()`, `gestureTargets()` |
| `src/commands.js` | `speakerRole()`: Wanderer and Survivor get their own pools. ASK gestures for DOG, SICKNESS, WAR, TOWN, and ROAD asked of a guard. REST works on the world map; a shallow sleep restores less |
| `src/trail.js` | `signNear()`. `dogDirectionHint()` can give the true step with no error |
| `src/tuning.js` | Rest restores all fatigue outside a town and in a well town; `restShallowRecovers`, `seenWithin` |
| `test/content.test.mjs` | New. The lint, and v13's lines checked word for word against the legacy file |
| `test/people.test.mjs` | New. 10 tests |
| `test/repairs.test.mjs` | The D5 test reads each role's own topic lines |
| `test/bundle.test.mjs` | Gesture accuracy over the sweep; 34 transcripts |
| `test/golden/` | Re-recorded. See section 3 |
| `tools/bot.mjs` | `asker` and `resting`. A tracker can carry on from sign it already knows |
| `tools/sweep.mjs` | `sweepGestures()` |
| `tools/record-goldens.mjs` | Transcripts 31 to 34 |
| `README.md`, `docs/SPEC.md`, M6 and M7 sheets | What M5 changed; the decision; 4.3's rest rule; an M5 block under "Since v13"; notes carried forward |

Six source files changed, by 448 lines added and 25 removed; 278 of the added lines are the new pool.

## 2. Test and sweep

`npm test`, Node 22 and Node 20:

```
# tests 309
# pass 309
# fail 0
```

`npm run sweep` on `dist/index.html`: all 2,000 seeds pass the gates. World hashes, trails and clock dates are unchanged from M4.

`npm run browser-check`, Chrome 153: 34 of 34 transcripts in `test/golden` match on the built page, and 27 of 27 in `test/golden-v13` match on the legacy page. No errors, no request beyond the page itself.

CI_RESULT

### Gestures over the sweep

ASK DOG from every town on 2,000 seeds, at ten moments of the quiet stage:

| Speaker | Gestures | Point a step nearer the dog |
| --- | --- | --- |
| Trust 2 or more | 21,790 | 21,790 (100%) |
| Familiarity 3, trust 0 | 21,790 | 19,477 (89.4%) |
| v13, any | | 58.9% |

### Rest outside a town

The owner asked for it. v13 allowed REST only inside a map, and outside a town it restored 2 fatigue for its 2 steps: at fatigue 5, where a move costs 2 steps, that bought nothing. A bot that follows sign and rests whenever it is spent, over 300 seeds, at each amount REST could restore:

| REST outside a town restores | On den 1 before the war | Lost to The Open Gate |
| --- | --- | --- |
| 2 (v13, M4) | 23% | 71% |
| 3 | 33% | 57% |
| 4 | 40% | 45% |
| 5, all of it | 49% | 35% |

The target is 40% to 60%. I chose all of it. REST in a town without sickness was raised from 3 to all of it too, so a town is never a worse place to rest than a field. A sick town still restores 1. The line "Sleep comes shallow. You wake too quickly.", shown on 18% of rests outside a town, is now true: that rest restores 3.

### Bots, 500 seeds

| Bot | On den 1 before the war | Reunion | Homecoming | Found in Time | The Long Way Back | The Open Gate |
| --- | --- | --- | --- | --- | --- | --- |
| tracker: follows sign, never rests | 131 (26%) | 98 | 0 | 45 | 16 | 341 |
| resting: the tracker, resting when spent | 232 (46%) | 185 | 0 | 78 | 46 | 191 |
| asker: asks in towns, follows gestures, rests | 125 (25%) | 14 | 52 | 33 | 17 | 384 |
| waiter | 0 | 0 | 0 | 0 | 0 | 500 |
| homecoming (never rests) | 11 | 0 | 9 | 7 | 5 | 479 |
| explorer (ignores sign) | 0 | 22 | 0 | 12 | 17 | 449 |

**The asker does worse than the resting tracker,** 25% against 46%. It follows a gesture in 302 games and rides the wagon in 135, and it wins Homecoming 52 times, which no other bot that rests can. But the trail starts at the yard, under the player's feet, so every trip to a town is a detour, and the nearest town is often far from the trail. With these numbers, asking is worth it to a player who has lost the trail, not to one who has it. See question 2.

## 3. Goldens

`test/golden-v13/` is untouched. `test/golden/` was re-recorded: 34 transcripts. Nineteen replay as at `m4`.

Same commands as M4, different lines, because people now have their own lines for every topic, earned lines and pools for the Wanderer and the Survivor:

- **03-enter-wilderness, 05, 06, 07, 10, 14, 24, 25, 26.** Different replies. 06 asks every topic and now hears each role's own lines. 24 and 25 speak to the Survivor in its own voice. 26 asks about sickness.
- **08-wait-and-rest, 11-save-and-load.** REST restores all fatigue, so STATUS and the saved state differ.

New:

- **31-earned-lines.** ASK ROAD six times of one innkeeper: the familiarity-2 line from the second ask, the familiarity-4 line from the fourth.
- **32-seen-and-not-seen.** A town the trail does not pass: only not-seen lines, no gesture. Then a town beside the trail: sightings and a gesture.
- **33-rest-in-the-open.** REST on the world map, deep and shallow.
- **34-gestures-for-every-topic.** During the war, with a road closed and a town sick: a guard gestures for TOWN, WAR, SICKNESS and ROAD; a priest asked about ROAD does not.

All 19 codes made by v13 still load to the state v13 recorded.

## 4. Acceptance

- [x] The lint test passes: every line 10 words or fewer, no `!`, no digit, no direction word, once each; every role 2 or more lines for every topic; every line a five-number vector.
- [x] A table-driven test shows that for every role and topic, ASK returns lines written for that topic.
- [x] TALK ten times and ASK ten times at one speaker, for every town role: never an empty reply, never one line twice in a reply.
- [x] Gesture accuracy on the sweep: 100% at trust 2 or more; 89.4% at familiarity 3 without it.
- [x] In a town more than 2 tiles from every sign tile, no v13 sighting is spoken. Tested for every role, six asks each.
- [x] Every new line carries `// REVIEW`. A test checks each one in the source.

Invariants:

- [x] v13's lines are unchanged, word for word and vector for vector. The content test compares them against the legacy file itself.
- [x] Directions appear only as gestures. The lint rejects north, south, east and west in any line.
- [x] World hashes, trails and clock dates are unchanged.

## 5. The 118 new lines, for the owner to edit

All are in `PEOPLE` in `src/content/pools.js`, each tagged `// REVIEW`. Familiarity lines are said once a person has been spoken to that many times. Not-seen lines are said, in place of sightings, in towns the trail does not pass.

### Innkeeper

| Topic | Line |
| --- | --- |
| TOWN | Rooms fill, then empty. |
|  | Same faces at the table. |
| WAR | Soldiers drink and don't pay. |
|  | No one sings here now. |
| SICKNESS | I boil the cups twice. |
|  | Empty beds. Not from travel. |
| WORK | Fires, beds, floors. Then again. |
|  | Nobody sleeps past dawn here. |
| DOG, familiarity 2 | Drank from the trough. Then gone. |
| DOG, familiarity 4 | Looked back once. At the road. |
| ROAD, familiarity 2 | The road's emptier at night now. |
| ROAD, familiarity 4 | Travelers whisper here. Not before. |
| ROUTES, familiarity 2 | Guests arrive tired from short walks. |
| ROUTES, familiarity 4 | Some roads end where they began. |
| DOG, not seen | No dog here. Not lately. |
|  | Strays don't stop at this inn. |

### Merchant

| Topic | Line |
| --- | --- |
| TOWN | Coin moves slower here. |
|  | Everyone haggles. No one buys. |
| WAR | Soldiers take first. Pay later. |
|  | Iron sells. Bread sells. Little else. |
| SICKNESS | Nobody wants what others touched. |
|  | I sell at arm's length now. |
| WORK | Count, weigh, argue. Every day. |
|  | Stock doesn't move itself. |
| DOG, familiarity 2 | Stole nothing. Odd, for a stray. |
| DOG, familiarity 4 | Sat by my cart. Then went. |
| ROAD, familiarity 2 | I send goods. Half arrive. |
| ROAD, familiarity 4 | I don't travel after dark. Anymore. |
| ROUTES, familiarity 2 | My ledgers don't match the miles. |
| ROUTES, familiarity 4 | Distances shift. Prices follow. |
| DOG, not seen | Haven't seen a dog. Ask elsewhere. |
|  | Dogs don't buy. I don't watch. |

### Smith

| Topic | Line |
| --- | --- |
| TOWN | Hinges and nails. That's this town. |
|  | They bring me what breaks. |
| WAR | Blades now. Not plows. |
|  | They want edges. Fast. |
| SICKNESS | Fire cleans what water won't. |
|  | Fewer hands to hold the tongs. |
| WORK | Heat, strike, wait. |
|  | The anvil doesn't rest. |
| DOG, familiarity 2 | Wouldn't come near the anvil. |
| DOG, familiarity 4 | It knew where it was going. |
| ROAD, familiarity 2 | Broken wheels. Many of them. |
| ROAD, familiarity 4 | Horseshoes wear wrong on these roads. |
| ROUTES, familiarity 2 | Compass needles drift here. |
| ROUTES, familiarity 4 | Old iron hums near the stones. |
| DOG, not seen | No dogs by my fire. |
|  | Not here. Not that I know. |

### Priest

| Topic | Line |
| --- | --- |
| TOWN | Fewer come. More stay late. |
|  | Every roof here has a story. |
| WAR | Both sides pray to me. |
|  | We bury, and say little. |
| SICKNESS | I sit with those who cough. |
|  | Prayers are shorter now. |
| WORK | Candles, words, waiting. |
|  | Someone must keep watch. |
| DOG, familiarity 2 | Waited at the door. Patient. |
| DOG, familiarity 4 | It was looking for someone. |
| ROAD, familiarity 2 | The road takes more than it gives. |
| ROAD, familiarity 4 | Walk with care. Not with haste. |
| ROUTES, familiarity 2 | Old paths remember feet. |
| ROUTES, familiarity 4 | What was bound is coming loose. |
| DOG, not seen | No such visitor here. |
|  | Lost things find other doors. |

### Guard

| Topic | Line |
| --- | --- |
| TOWN | Quiet town. Keep it quiet. |
|  | Everyone here is accounted for. |
| WAR | Orders change by the hour. |
|  | Not my war. My post. |
| SICKNESS | No one sick passes this gate. |
|  | Cover your mouth. Keep moving. |
| WORK | Stand. Watch. Report. |
|  | Long shifts. Short sleep. |
| DOG, familiarity 2 | Too quick to stop. We tried. |
| DOG, familiarity 4 | Not wild. Someone's. You could tell. |
| ROAD, familiarity 2 | Patrols come back short. |
| ROAD, familiarity 4 | Between us: don't trust the markers. |
| ROUTES, familiarity 2 | Maps were changed. Not by us. |
| ROUTES, familiarity 4 | Some posts guard nothing now. |
| DOG, not seen | No dogs reported. |
|  | Nothing like that at my post. |

### Local ("Someone" on the page)

| Topic | Line |
| --- | --- |
| TOWN | Not much happens here. |
|  | We know each other. Mostly. |
| WAR | Sons left. Some came back. |
|  | We hide the good grain. |
| SICKNESS | We keep the shutters closed. |
|  | Don't drink from the well. |
| WORK | Fields don't wait for news. |
|  | Same chores. Fewer hands. |
| DOG, familiarity 2 | Kids tried to catch it. |
| DOG, familiarity 4 | Slept in our barn once. |
| ROAD, familiarity 2 | We don't go far anymore. |
| ROAD, familiarity 4 | Grandmother says the roads moved before. |
| ROUTES, familiarity 2 | Fences don't end where they did. |
| ROUTES, familiarity 4 | We count steps home now. |
| DOG, not seen | A dog? Not around here. |
|  | Only our own dogs here. |

### Wanderer

| Topic | Line |
| --- | --- |
| Opener | Hm. |
|  | Passing through too? |
|  | Keep your distance. Please. |
| DOG | Tracks everywhere out here. |
|  | Animals keep to their own roads. |
| ROAD | I sleep where it's dry. |
|  | Towns are worse than this. |
| ROUTES | I walk in circles some days. |
|  | The land folds. I don't ask. |
| Close | Go on, then. |
|  | Don't follow me. |

### Survivor

| Topic | Line |
| --- | --- |
| Opener | You came too late. |
|  | Nothing left to take. |
|  | Sit. Mind the ash. |
| DOG | Animals don't come near ash. |
|  | I wasn't watching for dogs. |
| ROAD | They came in by the road. |
|  | Nobody comes back here. |
| ROUTES | The smoke went odd ways. |
|  | Even the paths burned wrong. |
| Close | Leave me with it. |
|  | Go. Before they return. |

## 6. Left undone

- **Tuning.** The asker's numbers say asking does not pay yet. Section 2 and question 2.
- **The townsperson's label.** A person on a town's street is labelled "Someone", as in v13: `speakerName` gives "Local" only to the `.` cell, and townspeople stand on the street, `|`. I kept the label; it is v13's text. Question 3.

## 7. Decisions the sheet did not cover

1. **Rest.** Section 2. Outside a town and in a well town, REST restores all fatigue; a shallow sleep restores 3; a sick town 1. REST works on the world map.
2. **The new lines sit beside v13's, not inside them.** `PEOPLE` is a separate table and `topicLines()` joins the two. That keeps v13's pools identical to the legacy file, which a test checks.
3. **A role's own lines come first; `TOPIC_FALLBACKS` lies beneath them** and is now read only by the Wanderer and the Survivor for TOWN, WAR, SICKNESS and WORK.
4. **Earned DOG lines are sightings,** so in a town off the trail they are not said either. The sheet's 12 not-seen lines are what such a town says, at any familiarity.
5. **"Seen" counts the sign as it is now.** A sign tile is a trail tile from the yard to the dog, so a town can come to have seen the dog when it moves on.
6. **"Within 2 tiles" is counted across the map,** as the gesture's 4 tiles are.
7. **A wrong gesture is always wrong.** M3's error could pick another direction that also led nearer. Now it picks an open direction that does not; that is what brings the measured rate to 89.4%.
8. **A town does not point at itself.** Asked about SICKNESS in a sick town, or TOWN, a person points to the nearest other one.
9. **WAR points to closed roads and burned towns alike,** whichever is nearer.
10. **ASK at the wagon keeps v13's behavior:** the generic pool with the merchant there, the market's without him.
11. **The asker asks one person a town and leaves at once on a not-seen answer.** Asking everyone, as a first draft did, spent the whole game in towns.

## 8. For M6

- **The legend** still shows neither `?` nor the stones.
- **The Open Gate** is still one placeholder line.
- **Old codes past the last date** end on their first step (M4, question 2).

## 9. Questions for the owner

1. **118 lines need your edit** before their `// REVIEW` tags come off. They are in section 5.
2. **Asking does not pay yet.** A bot that asks in towns and follows gestures reaches den 1 before the war on 25% of seeds, against 46% for one that only follows sign and rests. The spec's goal for this step was that asking be worth the steps. Two ways to get there, for M7 or now: let a gesture be offered farther from the trail (today, only where sign lies within 4 tiles), or have the trail pass through a town more often. Say if you want me to measure either.
3. **Should a townsperson be labelled "Local"?** v13 labels them "Someone". It is a one-line change and changes no text.
4. M6 needs one decision before it starts (spec section 8): what happens to old save codes. The default is that v13 codes keep loading.
