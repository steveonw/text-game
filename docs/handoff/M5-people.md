# M5 · People

**Goal.** Asking people is worth the steps: every topic gets an answer, familiar people say more, and trusted people point true.

**Entry state.** Tag `m4`. The owner has decided who writes the new lines (spec section 8). This sheet assumes the AI drafts and the owner edits every line before merge.

**Branch and tag.** `m5-people`, tagged `m5` on merge.

**Read first.** Spec 4.5. The M4 exit report. `src/people.js` and `src/content/pools.js`. The voice rules in the standing brief, and every v13 line, before writing any new one.

## Tasks

1. **Topic lines.** For each of Innkeeper, Merchant, Smith, Priest, Guard and Local, write 2 lines each for TOWN, WAR, SICKNESS and WORK: 48 lines. `TOPIC_FALLBACKS` stays as the generic layer beneath them.
2. **Earned lines.** For each of those six roles, write one line gated at familiarity 2 and one at familiarity 4, for each of DOG, ROAD and ROUTES: 36 lines, each carrying a `fam` field.
3. **Seen and not seen.** A town is on the trail if a sign tile lies within 2 tiles of it. v13's DOG lines are spoken only there. Elsewhere use new not-seen lines, 2 per role: 12 lines.
4. **Wanderer and Survivor.** Give each its own pool: 3 openers, 2 lines each for DOG, ROAD and ROUTES, and 2 closes. 22 lines.
5. **Gestures.** One function, `gestureFor(topic, x, y)`, returns a direction or nothing.

    | Topic | Points to |
    | --- | --- |
    | DOG | The dog, by the M3 rule |
    | SICKNESS | The nearest sick town |
    | WAR | The nearest closed road or burned town |
    | TOWN | The nearest other town |
    | ROAD, asked of a Guard | The nearest closed road |

    A gesture is always true at trust 2 or more. At familiarity 3 without that trust, 12% of the time it is another open direction. Below both, there is none.
6. **Lint.** Add `test/content.test.mjs`: every line is 10 words or fewer, has no `!` and no digit, and appears once; every role has at least 2 lines per topic; every line has a five-number vector.
7. **Bot.** Add `asker`: it walks to the nearest town, ASKs DOG until it gets a gesture, follows gestures and sign, and RIDEs when offered. Report its rate of reaching den 1 before the war beside the tracker's.

That is 118 new lines. Tag each `// REVIEW` and list them all in the exit report in one block for the owner to edit.

## Invariants

- v13's lines are unchanged, word for word and vector for vector.
- Directions appear only as gestures.
- World hashes, trails and clock dates are unchanged.

## Acceptance

- [ ] The lint test passes.
- [ ] A table-driven test shows that for every role and topic, ASK returns lines written for that topic.
- [ ] TALK ten times and ASK ten times at one speaker: never an empty reply, never one line twice in a reply.
- [ ] Gesture accuracy on the sweep: 100% at trust 2 or more; 85% to 91% at familiarity 3 without it. v13: 58.9%.
- [ ] In a town more than 2 tiles from every sign tile, no v13 sighting line is spoken.
- [ ] Every new line carries `// REVIEW` until the owner approves it.

## Traps

- The picker chooses the line whose vector lies nearest the moment's mood. A new line with a careless vector is never chosen, or always. Copy the vector of a v13 line of the same mood and adjust.
- An earned line gets a 0.15 score bonus once its gate is met, so it tends to be the first thing said at that familiarity. Write it to bear that weight.
- Asking one person the same topic twice raises hostility, which lowers warmth and shifts the choice. That is v13 behavior. Test with it on.
- A not-seen line must not read as a sighting: no "it", no motion in the past tense.
- Reputation still gates trust: at reputation 3 or more, each conversation adds 1.
- "Nearest" for a gesture means by walkable path. A place that cannot be walked to gives no gesture.
- ASK at the wagon keeps v13's behavior and uses the generic pool. The merchant gets no topic lines of his own.
- v13 has 103 pooled lines averaging 4 words. If a draft line needs 9 words, it is probably two lines.
- From M3: `dogDirectionHint(x, y)` in `trail.js` already returns the first step of the shortest way to the dog, offers it only where sign lies within 4 tiles (`gestureSignWithin`), and applies v13's 12% error whatever the trust. On the sweep it points a step nearer the dog 92.1% of the time. Build `gestureFor` on it; the trust rule is what is missing.
- From M3: the tracker bot stands on den 1 before the war on 82% of 500 seeds. Report the asker beside that number.
- From M4: that number is 26% at `m4`, because a tired move now costs two steps. Report the asker beside the `m4` number.
- From M4: fifteen draft lines are in `src/content/pools.js`, tagged `// REVIEW`: `OMENS`, `ROAD_CLOSED_RUMOR`, `STONES`, `ROADS_CHANGED`, `STATUS_GUARDED`. They follow the voice rules and wait for the owner's edit. Keep the tag on any line of yours the owner has not seen.
- From M4: a ruin map has no one in it, by rule. Do not add people there. `local.kind` is `"RUIN"`.
- From M4: the wagon skips sick towns (`wagonStops()` in `clock.js`), so a ride can now pass over a town. The asker bot rides.

## Out of scope

Ending text, save v5, the legend, tuning numbers, new roles, new topics.

## Exit report

The standard report, plus all 118 lines in one block grouped by role and topic, and the asker and tracker results side by side.
