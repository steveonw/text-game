// Tags finished milestones.
//
//   node tools/tag-milestones.mjs                   say what would be tagged, change nothing
//   node tools/tag-milestones.mjs --create          create the missing tags in this clone
//   node tools/tag-milestones.mjs --create --push   and push them to origin
//
// A milestone is finished when its exit report, docs/handoff/exits/M<n>-exit.md,
// is on the checked-out branch. Its tag is m<n>, on the commit that first brought
// that report onto the branch: the merge commit of the milestone's pull request.
//
// Rules
//   - A tag that exists is never moved, re-created or deleted.
//   - Only files named M<digits>-exit.md count. Nothing else in the repo can name a tag.
//   - "First brought onto the branch" follows first parents, so a milestone merged
//     with a merge commit or a squash is tagged as a whole. Do not rebase-merge a
//     milestone: its tag would land on the commit that added the report, which may
//     not be its last.
//
// Run by .github/workflows/tag-milestones.yml on main. No dependencies.

import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const EXITS_DIR = 'docs/handoff/exits';
const EXIT_REPORT = /^M(0|[1-9][0-9]*)-exit\.md$/;

function git(repo, args, opts = {}) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], ...opts }).trim();
}

function tagExists(repo, tag) {
  try { git(repo, ['rev-parse', '-q', '--verify', `refs/tags/${tag}`]); return true; } catch { return false; }
}

// Every exit report at HEAD, with the tag it calls for and the commit that tag belongs on.
export function plan(repo) {
  let names = [];
  try { names = git(repo, ['ls-tree', '--name-only', 'HEAD', `${EXITS_DIR}/`]).split('\n').filter(Boolean); } catch { names = []; }
  const out = [];
  for (const file of names) {
    const m = EXIT_REPORT.exec(path.posix.basename(file));
    if (!m) continue;
    const tag = `m${m[1]}`;
    // Oldest first-parent commit in which the report appears where its first parent had none.
    const added = git(repo, ['log', '--first-parent', '-m', '--diff-filter=A', '--format=%H', 'HEAD', '--', file]).split('\n').filter(Boolean);
    out.push({ n: Number(m[1]), tag, file, commit: added.at(-1) || null, exists: tagExists(repo, tag) });
  }
  return out.sort((a, b) => a.n - b.n);
}

// Creates what is missing. Returns the tags it created.
export function tagMilestones(repo, { create = false, push = false, say = () => {} } = {}) {
  if (push) git(repo, ['fetch', '--quiet', '--tags', 'origin']);
  const made = [];
  for (const p of plan(repo)) {
    if (p.exists) { say(`${p.tag}: exists, left alone`); continue; }
    if (!p.commit) { say(`${p.tag}: ${p.file} is here but no commit on this branch added it; skipped`); continue; }
    if (!create) { say(`${p.tag}: would be created on ${p.commit.slice(0, 7)}`); continue; }
    git(repo, ['tag', '-a', p.tag, p.commit, '-m', `M${p.n}: exit report merged (${p.file})`]);
    if (push) git(repo, ['push', '--quiet', 'origin', `refs/tags/${p.tag}`]);
    say(`${p.tag}: created on ${p.commit.slice(0, 7)}${push ? ' and pushed' : ''}`);
    made.push(p.tag);
  }
  return made;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = new Set(process.argv.slice(2));
  const unknown = [...args].filter((a) => a !== '--create' && a !== '--push');
  if (unknown.length || (args.has('--push') && !args.has('--create'))) {
    console.error('usage: node tools/tag-milestones.mjs [--create [--push]]');
    process.exit(2);
  }
  const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  tagMilestones(repo, { create: args.has('--create'), push: args.has('--push'), say: (line) => console.log(line) });
}
