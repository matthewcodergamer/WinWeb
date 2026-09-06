import { spawnSync } from 'node:child_process';
import { access, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
run(npx, ['vite', 'build', '--config', 'vite.bottleship-engine.config.mjs']);
run(process.execPath, ['scripts/copy-bottleship-runtime-assets.mjs']);

const outDir = path.resolve('dist/engines/bottleship');
const mainWorker = path.join(outDir, 'emulator-worker.js');
await access(mainWorker);
const files = await readdir(outDir);
const nestedWorkers = files.filter((name) => /^worker-.*\.js$/.test(name));
const mainCode = await readFile(mainWorker, 'utf8');

// The iPhone shell creates this worker directly. It must therefore be a bundled
// classic/IIFE worker, not an unbundled ES-module entry that Safari rejects.
if (/^\s*import\s/m.test(mainCode)) throw new Error('emulator-worker.js still contains static ES module imports.');
if (/new URL\(["'`]emulator-worker\.js/.test(mainCode)) throw new Error('Main worker contains a self-referencing nested-worker URL.');

const forbidden = ['/v86.wasm','/bios/seabios.bin','/bios/vgabios.bin','/unpack-streaming.wasm','/unpack-buffered.wasm','/video-decoder.wasm'];
const jsFiles = ['emulator-worker.js', ...nestedWorkers];
let combined = '';
for (const name of jsFiles) {
  const code = await readFile(path.join(outDir, name), 'utf8');
  combined += code;
  for (const bad of forbidden) {
    if ([`"${bad}"`,`'${bad}'`,'`'+bad+'`'].some((needle) => code.includes(needle))) {
      throw new Error(`${name} still contains root-relative runtime URL ${bad}`);
    }
  }
}
if (!combined.includes('./runtime/v86.wasm')) throw new Error('Built worker does not reference ./runtime/v86.wasm.');
if (!combined.includes('./runtime/bios/seabios.bin')) throw new Error('Built worker does not reference relative SeaBIOS.');

console.log(`WinWeb BottleShip engine verified. Main: emulator-worker.js; nested: ${nestedWorkers.join(', ') || 'none'}`);
