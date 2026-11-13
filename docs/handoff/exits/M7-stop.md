# M7 stop report

Step: M7 · Balance and release. Branch `m7-release`. Written 2026-11-13.

This is not an exit report: M7 is not finished, so this file is named so that the tagging workflow does not tag `m7`. The M7 sheet says, "If a target cannot be met by tuning alone, stop and report. Do not change logic to hit a number." One target cannot. Everything else in M7 that does not depend on it is done on this branch.

The owner's decision on publishing: the owner said to go ahead as Claude saw fit, so the default stands. GitHub Pages, built by CI on a version tag, `dist/` not committed.

## 1. Where M7 stands

| Task | State |
| --- | --- |
| 1. Bots | Done. `tools/balance.mjs` runs every bot on the 2,000 sweep seeds, split across one worker per core, and reports endings and step percentiles. The four policies the sheet names (explorer, tracker, asker, waiter) were already in `tools/bot.mjs`, with resting and homecoming |
| 2. Baseline | Done. `docs/balance.md` |
| 3. Tune | **Stopped.** Five of six targets hold at the starting values. The sixth cannot be met by tuning; section 2 |
| 4. Gate | Done for the five. CI job `balance` runs `npm run balance` and fails on a miss. The ask target is reported as `open`, not gated |
| 5. README | Done: play link, command list, seeds and passwords, tests, publishing |
| 6. Publish | Done: `.github/workflows/pages.yml`, on a `v*` tag or by hand. Not yet run |
| 7. Freeze | Not started. It waits on section 2 |

## 2. The target that misses

**asker on den 1 before the war on 70% to 85% of seeds.** At the starting values: 27.1%.

| Target, 2,000 seeds, starting values | Result |
| --- | --- |
| Every seed can be won at every stage | 2,000 of 2,000 |
| resting on den 1 before the war, 40% to 60% | 48.3% |
| **asker on den 1 before the war, 70% to 85%** | **27.1%** |
| No bot ends before step 12 on more than 5% | 1.1% at most |
| Each ending reached by some bot on 5% or more | the least is The Long Way Back, 7.6% |
| The roads change between step 80 and step 130 | 82 to 130 |

Trials, 300 seeds, one constant at a time (full table in `docs/balance.md`):

- The asking levers (gestures on the first ask, gestures from three times as far, the trail passing towns twice as often, no wrong gestures, the wagon always offered) move the asker from 25% to 30% at most. All of them at once: 33%.
- A later war moves the sign bot from 47% to 64%, out of its band, and the asker only to 29%.

So no setting puts the sign bot at 40% to 60% and the asker at 70% to 85% together. The trail starts under the player's feet, so a town is a detour, and a gesture says only which way to take the first step from that town. Asking helps a player who has lost the trail; it cannot carry one past a player who never lost it.

## 3. Options for the owner

1. **Restate the target for 1.0.** Asking is a way back to a lost trail, not a faster road. Replace "70% to 85%" with what it does now, for example "asker reaches den 1 before the war on 20% or more, and wins Homecoming on 5% or more" (it does 27% and 11.7%). No code changes. M7 can then freeze and 1.0 can ship.
2. **Make asking say more, in M7 or a step before it.** A change of logic, and new lines for the owner to edit, for example:
   - a person who has seen the dog says how far it was, not only which way;
   - wanderers met in the wild beside the trail gesture too, so asking need not be a detour;
   - a trusted person points the way to the den, not the first step from the town.
   Each would be measured against the asker before it is kept. This reopens M5's ground, so it needs the owner's word.
3. **Start the trail away from the yard,** so every player must first learn where to look. A larger change to the opening and the trail, and to M3's gates.

My recommendation is option 1 for 1.0, and option 2 as the first thing after it if asking should matter more. The game plays well at these numbers: the sign bot is in its band, every ending is reached, and the bots never finish trivially early.

## 4. What changed on this branch

| File | What changed |
| --- | --- |
| `tools/balance.mjs` | New. The bots on the sweep seeds, in parallel; the targets; `--gate` |
| `tools/tune.mjs` | New. A trial: a copy of the build with TUNE values changed, `src/` untouched |
| `tools/bot.mjs` | `summarize()` split out of `runPolicy()`, so the balance runner can merge workers' runs |
| `test/balance.test.mjs` | New. 3 tests of the gate's arithmetic |
| `.github/workflows/ci.yml` | A `balance` job |
| `.github/workflows/pages.yml` | New. Publishes to Pages |
| `package.json` | `npm run balance` |
| `docs/balance.md` | New. Baseline, trials, why the ask target misses |
| `docs/SPEC.md` | Section 8: publishing decided; a new open decision on what makes asking pay |
| `README.md` | Play link, commands, seeds and passwords, publishing, status |
| `docs/handoff/exits/M6-exit.md` | The CI-result paragraph that missed the M6 merge |

No file in `src/` changed. `tuning.js` is at its starting values.

## 5. Checks

`npm test`, Node 22: 278 of 278. `grep -E "https?://" dist/index.html` finds nothing, as in v13.

## 6. When M7 resumes

- Write the decision into spec 4.8 and `TARGETS` in `tools/balance.mjs`, and take `askDen1` out of `OPEN`.
- Re-record the goldens and confirm the world hashes (task 7). Nothing in `src/` has changed, so neither should.
- Write `M7-exit.md`, with the final `tuning.js` values beside the starting ones and the final bot table.
- The owner sets Pages to deploy from GitHub Actions, then pushes `v1.0.0`. The tagging workflow creates `m7` but cannot push a version tag that starts the publish job.
- Owner playtest: one game to each of the five endings, with notes for the exit report.
- Check the published page with `?seed=test` against a local build.
- The six Open Gate lines, the 118 from M5 and the 15 from M4 still carry `// REVIEW`.
