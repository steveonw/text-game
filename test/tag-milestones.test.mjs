// tools/tag-milestones.mjs, on throwaway repositories. Nothing here touches this repo's tags.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { plan, tagMilestones, EXITS_DIR } from '../tools/tag-milestones.mjs';

const TOOL = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'tools', 'tag-milestones.mjs');

// The same quiet identity for every git call, the tool's included, and no user or system config.
Object.assign(process.env, {
  GIT_AUTHOR_NAME: 'Test', GIT_AUTHOR_EMAIL: 'test@example.invalid',
  GIT_COMMITTER_NAME: 'Test', GIT_COMMITTER_EMAIL: 'test@example.invalid',
  GIT_CONFIG_GLOBAL: os.devNull, GIT_CONFIG_NOSYSTEM: '1',
});

function tempDir(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'tag-milestones-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
}
const git = (repo, ...args) => execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
function write(repo, file, text) {
  fs.mkdirSync(path.dirname(path.join(repo, file)), { recursive: true });
  fs.writeFileSync(path.join(repo, file), text);
}
function commit(repo, file, text, message) {
  write(repo, file, text);
  git(repo, 'add', '-A');
  git(repo, 'commit', '-q', '-m', message);
  return git(repo, 'rev-parse', 'HEAD');
}
function newRepo(t) {
  const repo = tempDir(t);
  git(repo, 'init', '-q', '-b', 'main');
  commit(repo, 'README.md', 'start\n', 'start');
  return repo;
}
// A milestone as this project merges them: a branch of several commits, the exit report among them, merged with a merge commit.
function mergeMilestone(repo, n, { reportIsLast = true } = {}) {
  git(repo, 'checkout', '-q', '-b', `m${n}-work`);
  commit(repo, `src/step${n}.js`, `// ${n}\n`, `M${n}: work`);
  commit(repo, `${EXITS_DIR}/M${n}-exit.md`, `# M${n} exit report\n`, `M${n}: exit report`);
  if (!reportIsLast) commit(repo, `src/step${n}.js`, `// ${n}, again\n`, `M${n}: one more fix`);
  git(repo, 'checkout', '-q', 'main');
  git(repo, 'merge', '-q', '--no-ff', `m${n}-work`, '-m', `Merge M${n}`);
  return git(repo, 'rev-parse', 'HEAD');
}
const tagTarget = (repo, tag) => git(repo, 'rev-parse', `${tag}^{commit}`);
const tags = (repo) => git(repo, 'tag', '-l').split('\n').filter(Boolean).sort();

test('tags: a milestone is tagged on the merge commit that brought its exit report in', (t) => {
  const repo = newRepo(t);
  const merge0 = mergeMilestone(repo, 0);
  const merge1 = mergeMilestone(repo, 1, { reportIsLast: false });
  commit(repo, 'README.md', 'later\n', 'unrelated work on main');

  assert.deepEqual(tagMilestones(repo, { create: true }), ['m0', 'm1']);
  assert.equal(tagTarget(repo, 'm0'), merge0);
  assert.equal(tagTarget(repo, 'm1'), merge1);
  assert.equal(git(repo, 'cat-file', '-t', 'm1'), 'tag', 'annotated, like the tags made by hand');
});

test('tags: a later edit to an exit report does not move where its tag belongs', (t) => {
  const repo = newRepo(t);
  const merge2 = mergeMilestone(repo, 2);
  commit(repo, `${EXITS_DIR}/M2-exit.md`, '# M2 exit report\n\nCI passed.\n', 'M2 exit report: record the CI result');

  assert.equal(plan(repo).find((p) => p.tag === 'm2').commit, merge2);
  tagMilestones(repo, { create: true });
  assert.equal(tagTarget(repo, 'm2'), merge2);
});

test('tags: a squash-merged milestone is tagged on its one commit', (t) => {
  const repo = newRepo(t);
  write(repo, 'src/step3.js', '// 3\n');
  const squash = commit(repo, `${EXITS_DIR}/M3-exit.md`, '# M3 exit report\n', 'M3 (squashed)');
  commit(repo, 'README.md', 'later\n', 'later');

  tagMilestones(repo, { create: true });
  assert.equal(tagTarget(repo, 'm3'), squash);
});

test('tags: a tag that exists is never moved', (t) => {
  const repo = newRepo(t);
  const byHand = git(repo, 'rev-parse', 'HEAD');
  git(repo, 'tag', 'm4', byHand);
  const merge4 = mergeMilestone(repo, 4);
  assert.notEqual(merge4, byHand);

  const said = [];
  assert.deepEqual(tagMilestones(repo, { create: true, say: (line) => said.push(line) }), []);
  assert.equal(tagTarget(repo, 'm4'), byHand);
  assert.deepEqual(said, ['m4: exists, left alone']);
});

test('tags: running twice creates nothing the second time', (t) => {
  const repo = newRepo(t);
  mergeMilestone(repo, 5);
  assert.deepEqual(tagMilestones(repo, { create: true }), ['m5']);
  assert.deepEqual(tagMilestones(repo, { create: true }), []);
  assert.deepEqual(tags(repo), ['m5']);
});

test('tags: without --create nothing is created', (t) => {
  const repo = newRepo(t);
  const merge6 = mergeMilestone(repo, 6);
  const said = [];
  assert.deepEqual(tagMilestones(repo, { say: (line) => said.push(line) }), []);
  assert.deepEqual(tags(repo), []);
  assert.deepEqual(said, [`m6: would be created on ${merge6.slice(0, 7)}`]);
});

test('tags: only files named M<digits>-exit.md can name a tag', (t) => {
  const repo = newRepo(t);
  for (const name of ['m7-exit.md', 'M7-exit.md.bak', 'M07-exit.md', 'Mx-exit.md', 'M7-exit.txt', 'notes.md', 'M-1-exit.md', 'M7 -exit.md']) {
    commit(repo, `${EXITS_DIR}/${name}`, 'x\n', `add ${name}`);
  }
  commit(repo, 'docs/M8-exit.md', 'x\n', 'an exit report in the wrong folder');
  commit(repo, `${EXITS_DIR}/deeper/M9-exit.md`, 'x\n', 'an exit report one folder too deep');

  assert.deepEqual(plan(repo), []);
  assert.deepEqual(tagMilestones(repo, { create: true }), []);
  assert.deepEqual(tags(repo), []);
});

test('tags: milestones come out in number order, not name order', (t) => {
  const repo = newRepo(t);
  mergeMilestone(repo, 10);
  mergeMilestone(repo, 2);
  assert.deepEqual(plan(repo).map((p) => p.tag), ['m2', 'm10']);
});

test('tags: --push sends new tags to origin and respects tags origin already has', (t) => {
  const origin = tempDir(t);
  git(origin, 'init', '-q', '--bare', '-b', 'main');
  const repo = newRepo(t);
  git(repo, 'remote', 'add', 'origin', origin);
  const merge0 = mergeMilestone(repo, 0);
  const merge1 = mergeMilestone(repo, 1);
  git(repo, 'push', '-q', 'origin', 'main');
  // Someone tagged m0 on origin by hand, somewhere else, and this clone has not heard.
  const elsewhere = git(repo, 'rev-list', '--max-parents=0', 'HEAD');
  git(origin, 'tag', 'm0', elsewhere);
  assert.notEqual(elsewhere, merge0);

  assert.deepEqual(tagMilestones(repo, { create: true, push: true }), ['m1']);
  assert.equal(git(origin, 'rev-parse', 'm0^{commit}'), elsewhere, 'origin\'s m0 was left where it was');
  assert.equal(git(origin, 'rev-parse', 'm1^{commit}'), merge1);
  assert.deepEqual(git(origin, 'for-each-ref', '--format=%(refname)').split('\n').sort(), ['refs/heads/main', 'refs/tags/m0', 'refs/tags/m1'], 'only tags were pushed');
});

test('tags: the command refuses --push without --create, and any other flag', () => {
  for (const args of [['--push'], ['--force'], ['--create', '--delete']]) {
    const r = spawnSync(process.execPath, [TOOL, ...args], { encoding: 'utf8' });
    assert.equal(r.status, 2, args.join(' '));
    assert.match(r.stderr, /usage:/);
  }
});
