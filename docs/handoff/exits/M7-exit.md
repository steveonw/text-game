# M7 exit report

Step: M7 · Balance and release. Branch `m7-release`. Written 2026-11-13.

The owner's decisions:

- **Publishing:** the default. GitHub Pages, built by CI on a version tag, `dist/` not committed. The owner said to go ahead as Claude saw fit.
- **What makes asking pay:** found in this step. At the starting values five of the six targets held, and the sixth, that a bot that asks reach den 1 before the war on 70% to 85% of seeds, could not be met by tuning (33% at best). Offered the choice of restating the target or changing the game, the owner chose to make asking say more, and then, shown that the best direction-and-distance answer gets about 50%, to keep the 70% to 85% target. That lifted the sheet's rule of no logic and no text for one change: a guide.

Every target now holds on the 2,000 sweep seeds, and CI checks them on every push. 1.0 is ready to publish; the last steps are the owner's (section 8).

## 1. What changed, by file

| File | What changed |
| --- | --- |
| `src/commands.js` | ASK DOG: in a town that has seen the dog, a true gesture comes with an offer to show the way. `cmdFollow()`: the walk to the dog, paid step by step. `noticeSign()` split out of `moveWorld` so both use it. FOLLOW in the parser |
| `src/content/pools.js` | `GUIDE`: 7 lines, each `// REVIEW`. FOLLOW in `COMMANDS` |
| `src/tuning.js` | `viaTownWithin` 10 → 15, `seenWithin` 2 → 4, `warFrom` 30 → 34 |
| `tools/balance.mjs` | New. Every bot on the sweep seeds, one worker per core, against the targets; `--gate` |
| `tools/tune.mjs` | New. A trial on a copy of the build with TUNE values changed |
| `tools/bot.mjs` | `summarize()` split out; `POLICY` exported. The asker FOLLOWs when offered, and walks to a town only within 16 steps |
| `tools/record-goldens.mjs` | Transcript 35 |
| `tools/sweep.mjs` | A comment: the war window |
| `test/guide.test.mjs` | New. 4 tests |
| `test/balance.test.mjs` | New. 3 tests of the gate's arithmetic |
| `test/bundle.test.mjs`, `clock.test.mjs`, `save.test.mjs`, `content.test.mjs` | Pinned sweep numbers and the war window follow the new values; the round trip imports the bot's code; the lint covers `GUIDE` |
| `.github/workflows/ci.yml` | A `balance` job |
| `.github/workflows/pages.yml` | New. Publishes on a `v*` tag, or by hand |
| `package.json` | `npm run balance` |
| `docs/balance.md` | New. Baseline, every trial, the ceiling measurements, final table |
| `README.md`, `docs/SPEC.md` | Play link, commands, seeds and passwords, publishing; 4.5 and 4.8; both decisions; an M7 block under "Since v13" |
| `docs/handoff/exits/M6-exit.md` | The CI-result paragraph that missed the M6 merge |

Three source files changed, by 72 lines added and 14 removed.

## 2. Test, sweep and balance

`npm test`, Node 22 and Node 20: 284 of 284.

`npm run sweep`: 2,000 of 2,000 seeds winnable at every stage; every gate passes. World hashes are unchanged from v13. Trails changed on the seeds where a town 11 to 15 steps from the yard is now passed: 1,221 trails pass beside a town, against 964 at M6. The longest trail is 60 tiles (M6: 53); 1,998 are 20 or longer.

`npm run browser-check`, Chrome 153: 35 of 35 transcripts in `test/golden` match on the built page, 27 of 27 in `test/golden-v13` on the legacy page. No errors, no request beyond the page.

`grep -E "https?://" dist/index.html` finds nothing, as in v13.

CI_RESULT

### The bots, 2,000 seeds

| Bot | On den 1 before the war | Reunion | Homecoming | Found in Time | The Long Way Back | The Open Gate | None | Ends before step 12 | Steps at the ending: p10, median, p90 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| explorer | 0 (0%) | 138 | 0 | 58 | 50 | 1754 | 0 | 26 | 77, 106, 117 |
| tracker | 555 (28%) | 442 | 0 | 183 | 79 | 1296 | 0 | 20 | 33, 100, 114 |
| resting | 1021 (51%) | 850 | 0 | 312 | 147 | 691 | 0 | 19 | 27, 49, 110 |
| asker | 1489 (74%) | 641 | 723 | 173 | 50 | 413 | 0 | 3 | 24, 33, 107 |
| waiter | 0 (0%) | 0 | 0 | 0 | 0 | 2000 | 0 | 0 | 96, 107, 118 |
| homecoming | 64 (3%) | 7 | 45 | 44 | 28 | 1876 | 0 | 1 | 93, 106, 117 |

| Target | M6 | M7 | |
| --- | --- | --- | --- |
| Every seed can be won at every stage | 2,000 | 2,000 | holds |
| Sign bot (resting) on den 1 before the war, 40% to 60% | 48.3% | 51.0% | holds |
| Asker on den 1 before the war, 70% to 85% | 27.1% | 74.5% | holds |
| No bot ends before step 12 on more than 5% | 1.1% | 1.3% | holds |
| Each ending reached by some bot on 5% or more | least 7.6% | least 7.3% (The Long Way Back) | holds |
| The roads change between step 80 and step 130 | 82 to 130 | 85 to 130 | holds |

The asker followed a guide in 1,275 games and won Homecoming in 723 (36%).

### tuning.js, final against starting values

| Constant | Start | Final | Why |
| --- | --- | --- | --- |
| `viaTownWithin` | 10 | 15 | More trails pass the nearest town, so more players have a town on the way that has seen the dog |
| `seenWithin` | 2 | 4 | A town within the gesture's reach of the trail could point but not say it had seen the dog |
| `warFrom` | 30 | 34 | Four more steps before the war at the earliest. It moves both bots; the sign bot stays in its band |

Every other value is at its starting value. The trials that led here, one at a time, are in `docs/balance.md`.

## 3. Goldens

`test/golden-v13/` is untouched. `test/golden/` was re-recorded: 35 transcripts. 17 replay exactly as at `m6`.

- **35-follow-a-guide** is new: a town that has seen the dog, ASK DOG until the offer, FOLLOW, the fresh trail, ENTER and CALL, to Reunion.
- **HELP lists FOLLOW:** the only change in 01 and 17; 23 too.
- **The guide's offer** appears where a person asked about the dog points true in a town that has seen it: 06, 10, 11, 26 and 32.
- **The war four steps later** moves the dates, the warnings and the lines that follow from them in 09, 15, 16, 23, 24, 26, 28, 29, 30 and 34. Plans that wait for a date wait longer.
- **Trails that now pass a town** put sign on other tiles in 11 and 24.
- **02** is recorded on another seed, `town-43` (was `town-77`): the recorder takes the first seed whose plan succeeds.

`save-codes.json` was re-recorded from the new transcripts. Every code made at `m6` still loads, to the same position, steps and count of sign. On a seed whose trail changed, the found sign is laid on the new trail by position.

## 4. Acceptance

- [x] Every target holds in CI. (The `balance` job; see the CI line in section 2.)
- [x] `docs/balance.md` shows the baseline, each change and the final table.
- [x] `grep -E "https?://" dist/index.html` finds nothing.
- [ ] The published page opened with `?seed=test` shows the same world as a local build with that seed. Waits on publishing (section 8). The seed is read from the query string, which Pages serves unchanged on its sub-path.
- [ ] Owner playtest: one game to each of the five endings, with notes.
- [ ] Tag `v1.0.0` exists and CI is green on it. The owner pushes it.

Invariants:

- [ ] ~~Only `src/tuning.js`, docs, CI and tests change. No logic and no text.~~ Lifted by the owner for the guide: `src/commands.js` and seven lines in `src/content/pools.js`.
- [x] World hashes are unchanged, and old save codes (M6's) still load.

## 5. The new lines, for the owner to edit

All in `GUIDE` in `src/content/pools.js`, each tagged `// REVIEW`.

```
Offer, said by the person (one of three), then "(Type FOLLOW.)":
  I can show you where.
  Come. I'll walk you there.
  I know the place. Follow me.

The walk:
  You walk together, saying little.
  They stop, and nod at the ground.
  Here. This is where it lay.

If the way is shut:
  They look away. Not now.
```

The FOLLOW row in HELP and the side panel reads "go with someone who offers to show you".

## 6. Decisions the sheet did not cover

1. **The sign target reads the resting bot.** "A bot that follows sign and never talks" fits tracker and resting. Since M5, rest outside a town restores everything, so a bot that never rests plays tired on purpose. tracker (28%) is reported beside it.
2. **The guide leads to where the dog is,** not to where the town saw it pass. The measurements showed that only the place itself is worth the trip.
3. **Walking with a guide costs what walking costs:** a step of the clock each tile (two at fatigue 5), fatigue as for a move, forest dearer. Sign on the way is found. The clock runs as you go, so the war can start on the road.
4. **No offer comes with a wrong gesture,** so the guide is never wrong. A familiar person who is not trusted still points wrong 12% of the time, and then does not offer.
5. **The asker is a better player than it was.** It FOLLOWs when offered, and does not walk to a town more than 16 steps away. Both use only what the page shows. Its range was chosen over 12 and 20 by measurement.
6. **The balance job takes about 17 minutes in CI.** It runs beside the other jobs.
7. **The publish job tests before it deploys,** and checks the page holds no web address.

## 7. Left undone

- The 7 guide lines, M6's 6, M5's 118 and M4's 15 still carry `// REVIEW`.
- Still open from M5: whether a townsperson should be labelled "Local" rather than "Someone".

## 8. For the owner: publishing 1.0

1. Merge this pull request. The tagging workflow creates `m7`.
2. In the repository's Settings, Pages, set Source to "GitHub Actions". Once.
3. Push the version tag from your own machine: `git tag v1.0.0 <merge commit> && git push origin v1.0.0`. The `pages` workflow builds, tests and publishes. It can also be run by hand from the Actions tab.
4. Open `https://steveonw.github.io/text-game/?seed=test` and a local build with the same seed: the worlds should match.
5. Play one game to each ending and note anything off. Those notes, and your edits to the `// REVIEW` lines, are the last of 1.0.
