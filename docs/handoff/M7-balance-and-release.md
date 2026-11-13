# M7 · Balance and release

**Goal.** The numbers are tuned against bots until the targets hold, and 1.0 is published.

**Entry state.** Tag `m6`. The owner has decided how 1.0 is published (spec section 8). This sheet assumes GitHub Pages, built by CI.

**Branch and tag.** `m7-release`, tagged `m7` on merge, then `v1.0.0`.

**Read first.** Spec 4.8. Every exit report so far. `src/tuning.js`, `tools/bot.mjs`, `tools/sweep.mjs`.

## Tasks

1. **Bots.** Complete `tools/bot.mjs` with four policies: `explorer` (the walk used for the measurements in spec section 3), `tracker`, `asker` and `waiter`. Each runs on the 2,000-seed sweep and reports endings and step percentiles.
2. **Baseline.** Before changing anything, record every bot's results in `docs/balance.md`.
3. **Tune.** Change values in `src/tuning.js` only, one constant at a time, re-running the sweep after each, until every target holds. Log each change and its effect in `docs/balance.md`.
4. **Gate.** Add the targets to CI as sweep assertions.
5. **README.** The play link, the command list, how seeds and save codes work, how to test and build.
6. **Publish.** On a tag matching `v*`, CI builds `dist/index.html` and deploys it to GitHub Pages.
7. **Freeze.** Re-record the golden transcripts, confirm the world hashes, and tag `v1.0.0`.

## Targets

- Every seed can be won at every stage: 2,000 of 2,000.
- `tracker` reaches den 1 before the war on 40% to 60% of seeds.
- `asker` does so on 70% to 85% of seeds.
- No bot finishes before step 12 on more than 5% of seeds.
- Each of the five endings is reached by some bot on at least 5% of seeds.
- The roads change between step 80 and step 130 on every seed.

## Invariants

- Only `src/tuning.js`, docs, CI and tests change. No logic and no text.
- World hashes are unchanged and old save codes still load.

## Acceptance

- [ ] Every target holds in CI.
- [ ] `docs/balance.md` shows the baseline, each change and the final table.
- [ ] `grep -E "https?://" dist/index.html` finds nothing. The v13 file has none.
- [ ] The published page opened with `?seed=test` shows the same world as a local build with that seed.
- [ ] Owner playtest: one game to each of the five endings, with notes in the exit report.
- [ ] Tag `v1.0.0` exists and CI is green on it.

## Traps

- Constants interact through the step counter. Changing two at once hides which one moved a number.
- If a target cannot be met by tuning alone, stop and report. Do not change logic to hit a number.
- Trail length and den positions decide where the dog is, so changing them can break M3's gates. Re-run every gate, not only the balance targets.
- A bot must know nothing a player could not learn from the page. A bot that reads the trail from memory will flatter the numbers.
- Pages serves the game from a sub-path. The seed in the URL must survive it.
- From M3: at `m3` the tracker bot stands on den 1 before the war on 82% of 500 seeds, against a target of 40% to 60%, and ends before step 12 on 2%. The numbers that move it are in `tuning.js` under "The trail and the dog".
- From M4: at `m4` the tracker stands on den 1 before the war on 26% of 500 seeds and loses 68% of its games to The Open Gate. With `exhaustedMoveSteps` set to 1 it is 85% and 3%. The target, 40% to 60%, lies between, so that number alone cannot be the answer.
- From M4: at the starting numbers rest buys nothing in the wild. A tired move costs 2 steps; WAIT and a fresh move cost 2; REST costs 2 and restores 2. Only a town's REST (3 for 2) and the wagon come out ahead. If resting is meant to be a choice, `restWildRecovers` and `waitRecovers` are where to look.
- From M4: the sweep gates take about 40 seconds for 2,000 seeds. Keep any new gate from drawing the page or opening every tile's map on every step.
- The tagging workflow creates `m7`, and a tag pushed by a workflow does not start other workflows. `v1.0.0` has to be pushed by the owner, or the publish job needs a trigger the owner can run by hand.
- The clock windows in spec 4.8 bound the roads changing to steps 80 to 130. If tuning moves a window, that target moves with it; record the new bounds.

## Out of scope

New features, and everything listed in spec 4.9.

## Exit report

The standard report, plus the final `tuning.js` values beside their starting values, and the final bot table.
