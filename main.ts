// Little Elsewhere — the entrypoint that hands the game to the judge.
//
// The game itself is plain static files under game/ (index.html plus its
// ES modules, no libraries, no network). This program gathers those files
// and the screenshots/ pictures into the output directory and writes the
// dossier.json summary the judge reads, using the vendored make.fun
// library. It also checks its own work before finishing: the game folder
// must be present, the screenshots must fit the scorer's caps, and the
// dossier it just wrote must parse and describe exactly what was copied.
// A stale file left in the output from an earlier run is cleared first,
// so the entry never ships a picture or script it no longer contains.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR standing in for
// /output:  mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const sourceDir = fileURLToPath(new URL('.', import.meta.url));
const destination = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const MAX_SHOTS = 4;
const MAX_SHOT_BYTES = 262144;

function fail(message) {
  throw new Error(`main.ts: ${message}`);
}

function mustExist(path, what) {
  if (!existsSync(path)) fail(`${what} is missing (${path})`);
}

// The game folder is the entry: without it there is nothing to judge.
mustExist(join(sourceDir, 'game'), 'game/');
mustExist(join(sourceDir, 'game', 'index.html'), 'game/index.html');

// Clear anything a previous run left behind, then copy fresh.
mkdirSync(destination, { recursive: true });
for (const sub of ['game', 'screenshots']) rmSync(join(destination, sub), { recursive: true, force: true });
cpSync(join(sourceDir, 'game'), join(destination, 'game'), { recursive: true });

// Screenshots are optional, but when present they must fit the caps the
// scorer enforces (at most four, each no bigger than 256 KiB).
const shotDir = join(sourceDir, 'screenshots');
const shotNames = existsSync(shotDir)
  ? readdirSync(shotDir).filter(name => /\.(png|jpe?g)$/i.test(name)).sort()
  : [];
if (shotNames.length > MAX_SHOTS) fail(`found ${shotNames.length} screenshots, the cap is ${MAX_SHOTS}`);
for (const name of shotNames) {
  const size = statSync(join(shotDir, name)).size;
  if (size > MAX_SHOT_BYTES) fail(`screenshots/${name} is ${size} bytes, over the ${MAX_SHOT_BYTES} cap`);
}
mkdirSync(join(destination, 'screenshots'), { recursive: true });
if (shotNames.length) cpSync(shotDir, join(destination, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes
// the bytes; the rest refuse an entry the scorer would refuse (more than
// four screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossierPath = join(destination, 'dossier.json');
writeFileSync(
  dossierPath,
  buildDossier(destination, {
    text_max_bytes: 163840,
    screenshots: { max: MAX_SHOTS, max_bytes: MAX_SHOT_BYTES },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

// Read the dossier back and confirm it describes what was actually copied.
let dossier;
try {
  dossier = JSON.parse(readFileSync(dossierPath, 'utf8'));
} catch {
  fail('dossier.json did not parse after writing');
}
for (const key of ['cover', 'images', 'schema', 'text']) {
  if (!(key in dossier)) fail(`dossier.json is missing its "${key}" field`);
}
if (!Array.isArray(dossier.images) || dossier.images.length !== shotNames.length) {
  fail(`dossier.json lists ${dossier.images?.length ?? 0} images but ${shotNames.length} screenshots were copied`);
}
const gameFiles = readdirSync(join(destination, 'game'), { recursive: true });
console.log(`entry ready: ${gameFiles.length} game entries, ${shotNames.length} screenshots, dossier ${statSync(dossierPath).size} bytes -> ${destination}`);
