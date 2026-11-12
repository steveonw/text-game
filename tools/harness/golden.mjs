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
import { play } from './load.mjs';

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
