import { spawnSync } from 'node:child_process';
import { access, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
run(npx, ['vite', 'build', '--config', 'vite.bottleship-engine.config.mjs']);

const outDir = path.resolve('dist/engines/bottleship');
const mainWorker = path.join(outDir, 'emulator-worker.js');
await access(mainWorker);

// Vite/Rolldown can re-materialize BottleShip's root-relative public URLs after
// plugin transforms. GitHub Pages serves WinWeb from /WinWeb/, so rewrite the
// actual emitted worker files after bundling. Restrict replacements to complete
// quoted URL literals so an already-correct ./runtime/... path is never doubled.
const runtimeUrls = new Map([
  ['/v86.wasm', './runtime/v86.wasm'],
  ['/bios/seabios.bin', './runtime/bios/seabios.bin'],
  ['/bios/vgabios.bin', './runtime/bios/vgabios.bin'],
  ['/unpack-streaming.wasm', './runtime/unpack-streaming.wasm'],
  ['/unpack-buffered.wasm', './runtime/unpack-buffered.wasm'],
  ['/video-decoder.wasm', './runtime/video-decoder.wasm']
]);

const emitted = (await readdir(outDir)).filter((name) => name.endsWith('.js'));
for (const name of emitted) {
  const file = path.join(outDir, name);
  let code = await readFile(file, 'utf8');
  let changed = false;
  for (const [from, to] of runtimeUrls) {
    for (const quote of ['"', "'", '`']) {
      const before = `${quote}${from}${quote}`;
      const after = `${quote}${to}${quote}`;
      if (code.includes(before)) {
        code = code.split(before).join(after);
        changed = true;
      }
    }
  }
  if (changed) {
    await writeFile(file, code, 'utf8');
    console.log(`Rebased BottleShip runtime URLs in ${name}`);
  }
}

run(process.execPath, ['scripts/copy-bottleship-runtime-assets.mjs']);
run(process.execPath, ['scripts/copy-v86-vm-assets.mjs']);

const files = await readdir(outDir);
const nestedWorkers = files.filter((name) => /^worker-.*\.js$/.test(name));
const mainCode = await readFile(mainWorker, 'utf8');

// The iPhone shell creates this worker directly. It must therefore be a bundled
// classic/IIFE worker, not an unbundled ES-module entry that Safari rejects.
if (/^\s*import\s/m.test(mainCode)) throw new Error('emulator-worker.js still contains static ES module imports.');
if (/new URL\(["'`]emulator-worker\.js/.test(mainCode)) throw new Error('Main worker contains a self-referencing nested-worker URL.');

const forbidden = [...runtimeUrls.keys()];
const jsFiles = ['emulator-worker.js', ...nestedWorkers];
let combined = '';
for (const name of jsFiles) {
  const code = await readFile(path.join(outDir, name), 'utf8');
  combined += code;
  for (const bad of forbidden) {
    if ([`"${bad}"`, `'${bad}'`, '`' + bad + '`'].some((needle) => code.includes(needle))) {
      throw new Error(`${name} still contains root-relative runtime URL ${bad}`);
    }
  }
}
if (!combined.includes('./runtime/v86.wasm')) throw new Error('Built worker does not reference ./runtime/v86.wasm.');
if (!combined.includes('./runtime/bios/seabios.bin')) throw new Error('Built worker does not reference relative SeaBIOS.');

for (const required of [
  'dist/engines/v86-vm/libv86.mjs',
  'dist/engines/v86-vm/v86.wasm',
  'dist/engines/v86-vm/bios/seabios.bin',
  'dist/engines/v86-vm/bios/vgabios.bin',
  'dist/engines/v86-vm/iso9660.mjs',
]) await access(path.resolve(required));

console.log(`WinWeb BottleShip engine verified. Main: emulator-worker.js; nested: ${nestedWorkers.join(', ') || 'none'}`);
console.log('WinWeb native v86 full-PC fallback verified.');
