# Handoff sheets

One sheet per major step, M0 to M7, each written to be pasted into a fresh AI coding session that has `steveonw/text-game` checked out. The sheets are the other files in this folder.

## How to use them

1. Start a new session for each step. Paste the standing brief below, then that step's sheet.
2. Attach the previous step's exit report. M0 needs none.
3. The session works on the step's branch, opens a pull request and writes its exit report.
4. You check the pull request against the sheet's acceptance list and merge it, with a merge commit. A workflow then tags the step: `mN`, on that merge commit, because `docs/handoff/exits/MN-exit.md` has reached `main`.

A sheet assumes the step before it is merged and tagged. Do not run two steps at once.

## Standing brief

Paste this first, every time.

**Project.** The Quiet Roads is a single-file browser text game. Your dog is gone. You search a seeded 20×20 world with typed commands while the world slowly comes apart. Repo: `steveonw/text-game`, MIT.

**Sources of truth, in order**

1. `docs/SPEC.md`.
2. The handoff sheet for the current step.
3. `legacy/quiet-roads-v13.html`, for any behavior the spec does not mention.

If two of them conflict, stop and ask the owner.

**Rules that hold at every step**

1. The shipped game is one HTML file. It makes no network requests and has no dependencies. Tooling uses Node 20 built-ins only.
2. Logic is deterministic. It does not call `Math.random` or `Date`; everything derives from the seed and the step counter.
3. Terrain, towns and capital for a seed never change. The golden world hashes must pass.
4. `legacy/quiet-roads-v13.html` is never edited.
5. Logic modules do not touch `document`.
6. Player-facing text lives in `src/content/`. Tunable numbers live in `src/tuning.js`.
7. Every behavior change comes with a test. Every golden transcript that changes is explained in the exit report.
8. Do the step on the sheet. Leave later steps alone, even when the fix looks small.
9. The palette, the glyphs and v13's existing text are locked. Changing any of them needs the owner's yes.

**Voice, for any player-facing line**

- Narrator: second person, present tense, usually 3 to 8 words. "The land closes around you."
- People: fragments of 2 to 7 words. "Left before dawn."
- No names, no numbers, no place names, no exclamation marks.
- The cabbage merchant is the only comic voice.
- Directions appear only as a gesture: "(A gesture: east.)"
- Interface hints sit in parentheses with the verb in capitals: "(CALL to reunite.)"
- The routes are hinted at and never explained. People notice; nobody knows.

**Commands**

```
npm test
npm run sweep
npm run build
npm run record
```

**Goldens.** `test/golden/` is what the game does now. `npm run record` rewrites it from the build; do that only for a change the sheet asks for, and review every file it moves. `test/golden-v13/` is what v13 did. It is frozen: never re-record it. Its world hashes and save codes still bind the current game.

**Exit report.** Before finishing, write `docs/handoff/exits/MN-exit.md` with:

1. What changed, by file.
2. The summary lines of `npm test` and `npm run sweep`.
3. Each golden transcript that changed, and why.
4. Anything on the sheet left undone, and why.
5. Decisions made that the sheet did not cover.
6. Questions for the owner.

The step is tagged on the merge that first carries this file. Finish the report, the CI result included, before asking for the merge.
