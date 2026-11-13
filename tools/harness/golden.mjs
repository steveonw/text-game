// Reading and replaying the golden files.
//
//   test/golden/       the current build: what the game does now
//   test/golden-v13/   frozen in M2: what v13 did, recorded in M0 and never re-recorded
//
// A transcript is { name, covers, source, seed, debug?, commands, log, finalScreen,
// finalMap, finalMapHash, finalStatus, finalMode, finalPos }:
//   debug        true when the page is opened with ?debug=1 (DEBUG and BLOCK enabled)
//   log          every line the game appended, in order, as [cls, text]
//                (cls "m" = narrator, "" = speech), including lines later erased
//   finalScreen  the lines still in the log element at the end
//   finalMap     the map as rows of glyphs; finalMapHash also covers its colours
//
// replay() runs a transcript's commands against any single-file build, so the
// same goldens can check the legacy file now and the built file from M1 on.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { play, SNAPSHOT_EXPR } from './load.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const GOLDEN = path.join(ROOT, 'test', 'golden');
export const GOLDEN_V13 = path.join(ROOT, 'test', 'golden-v13');
export const LEGACY = path.join(ROOT, 'legacy', 'quiet-roads-v13.html');
export const LEGACY_SHA256 = '85616c65f91ae54598e96c0833a571a30cd8bc9dea3103fba82bd9f1fe7fea7c';

export function readTranscripts(golden = GOLDEN) {
  const dir = path.join(golden, 'transcripts');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
    .map((f) => ({ file: f, ...JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')) }));
}
export const readWorldHashes = (golden = GOLDEN) => JSON.parse(fs.readFileSync(path.join(golden, 'world-hashes.json'), 'utf8'));
export const readLegacyCodes = (golden = GOLDEN) => JSON.parse(fs.readFileSync(path.join(golden, 'legacy-codes.json'), 'utf8'));
// M6: the codes the current game makes (save v5), and the state after loading each.
export const readSaveCodes = (golden = GOLDEN) => JSON.parse(fs.readFileSync(path.join(golden, 'save-codes.json'), 'utf8'));
// What a v5 code restores, read from a loaded game (SNAPSHOT_EXPR plus the towns entered).
export const SAVE_SNAPSHOT_EXPR = `Object.assign(${SNAPSHOT_EXPR}, { townsEntered: G.townsEntered })`;

export function replay(htmlPath, transcript) {
  const r = play(htmlPath, transcript.seed, transcript.commands, { debug: !!transcript.debug });
  return {
    log: r.log,
    finalScreen: r.finalScreen,
    finalMap: r.finalMap.replace(/\n$/, '').split('\n'),
    finalMapHash: r.finalMapHash,
    finalStatus: r.finalStatus,
    finalMode: r.finalMode,
    finalPos: r.finalPos,
  };
}

export const COMPARED_FIELDS = ['log', 'finalScreen', 'finalMap', 'finalMapHash', 'finalStatus', 'finalMode', 'finalPos'];

// Terrain, towns, capital and start tile of the world a seed string makes:
// [first 16 hex digits of SHA-256(glyphs|towns|capital), start x, start y].
export function worldSignature(game, seedStr) {
  const w = game.get(`(function(){
    SEED = fnv1a32(${JSON.stringify(seedStr)}); mode = "WORLD"; local = null; startNewGame();
    let g = ""; for (let y=0;y<WORLD_SIZE;y++) for (let x=0;x<WORLD_SIZE;x++) g += tileAt(x,y);
    return { g: g, towns: towns, capital: capital, start: [player.x, player.y] };
  })()`);
  const hash = crypto.createHash('sha256').update(w.g + '|' + JSON.stringify(w.towns) + '|' + JSON.stringify(w.capital)).digest('hex').slice(0, 16);
  return [hash, w.start[0], w.start[1]];
}

// M3: the ten sweep seeds whose start tile, the yard, is not where v13 put it.
// Seven of v13's starts lay in a pocket cut off from the largest region with a
// town; three more worlds have every town in a pocket and are played on the
// mainland. On every other sweep seed the yard is v13's start. The terrain, towns
// and capital are v13's on all 2,000.
export const MOVED_YARDS = {
  'sweep-245': [2, 14], 'sweep-322': [4, 4], 'sweep-473': [12, 11], 'sweep-560': [14, 1], 'sweep-762': [8, 8],
  'sweep-1360': [12, 3], 'sweep-1471': [1, 8], 'sweep-1610': [14, 19], 'sweep-1686': [4, 12], 'sweep-1924': [10, 0],
};
// What a sweep seed's world signature must be now: v13's, with the yard moved on those ten.
export function expectedWorld(v13Entry, seedStr) {
  const yard = MOVED_YARDS[seedStr];
  return yard ? [v13Entry[0], yard[0], yard[1]] : v13Entry;
}
