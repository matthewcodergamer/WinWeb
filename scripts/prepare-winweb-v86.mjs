import { access, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import path from 'node:path';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

function capture(command, args, options = {}) {
  const result = spawnSync(command, args, {
    encoding: 'utf8',
    shell: process.platform === 'win32',
    ...options,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    process.stderr.write(result.stderr || '');
    process.exit(result.status ?? 1);
  }
  return String(result.stdout || '').trim();
}

const lock = JSON.parse(await readFile(new URL('../upstreams.lock.json', import.meta.url), 'utf8'));
const spec = lock.projects.find((project) => project.id === 'v86-winweb');
if (!spec) throw new Error('upstreams.lock.json is missing v86-winweb.');

const bottleShip = path.resolve('vendor/bottleship');
const nested = path.join(bottleShip, 'vendor/v86');
await access(path.join(bottleShip, 'package.json'));

// BottleShip declares its own v86 fork as a nested submodule. Keep BottleShip itself
// pinned, but replace only that nested checkout with Matthew's WinWeb-owned fork.
// The exact commit remains locked, so builds are reproducible and BottleShip-specific
// hypercall/JIT changes cannot accidentally drift to normal v86 master.
run('git', ['-C', bottleShip, 'submodule', 'sync', '--', 'vendor/v86']);
run('git', ['-C', bottleShip, 'config', 'submodule.vendor/v86.url', spec.repo]);
run('git', ['-C', bottleShip, 'submodule', 'update', '--init', '--depth', '1', '--', 'vendor/v86']);

if (spec.branch) {
  run('git', ['-C', nested, 'fetch', 'origin', `refs/heads/${spec.branch}:refs/remotes/origin/${spec.branch}`, '--depth', '1']);
}

let haveRef = false;
try {
  haveRef = capture('git', ['-C', nested, 'cat-file', '-t', spec.ref]) === 'commit';
} catch (_) {
  haveRef = false;
}
if (!haveRef) run('git', ['-C', nested, 'fetch', 'origin', spec.ref, '--depth', '1']);
run('git', ['-C', nested, 'checkout', '--detach', spec.ref]);

const actual = capture('git', ['-C', nested, 'rev-parse', 'HEAD']);
if (actual !== spec.ref) throw new Error(`v86 checkout mismatch: expected ${spec.ref}, got ${actual}`);

for (const required of [
  'build/libv86.mjs',
  'build/v86.wasm',
  'bios/seabios.bin',
  'bios/vgabios.bin',
  'src/iso9660.js',
  'winweb/winweb-v86.mjs',
]) {
  await access(path.join(nested, required));
}

const wrapper = await readFile(path.join(nested, 'winweb/winweb-v86.mjs'), 'utf8');
for (const marker of ['createWinWebWasmLoader', 'emulator-error', 'winweb-wasm-progress']) {
  if (!wrapper.includes(marker)) throw new Error(`WinWeb v86 wrapper is missing ${marker}.`);
}

// Patch the pinned BottleShip checkout only in the ephemeral build workspace. This is
// intentionally done after the upstream proof can build BottleShip unchanged. Vite's
// worker pipeline may decorate module ids and bypass ordinary transform hooks, so the
// runtime bridge must exist in source before the worker bundle is created.
const workerPath = path.join(bottleShip, 'src/worker/emulator.worker.ts');
let workerSource = await readFile(workerPath, 'utf8');

if (!workerSource.includes('winweb_wasm_timeout_ms')) {
  const before = workerSource;
  workerSource = workerSource.replace(
    /(\s+wasm_path:[^\n]+\n)/,
    '$1    winweb_wasm_timeout_ms: 20000,\n'
  );
  if (workerSource === before) throw new Error('Could not inject WinWeb v86 WASM timeout into BottleShip worker.');
}

if (!workerSource.includes('[WINWEB-V86] startup error')) {
  const marker = 'const v86 = new V86(settings);';
  if (!workerSource.includes(marker)) throw new Error('Could not find BottleShip v86 constructor marker.');
  const bridge = [
    marker,
    '    v86.add_listener("winweb-wasm-progress", (info: any) => {',
    '      const loaded = Number(info?.loaded ?? 0);',
    '      const total = Number(info?.total ?? 0);',
    '      const percent = total > 0 ? Math.max(1, Math.min(99, Math.round((loaded / total) * 100))) : 5;',
    '      try { (self as unknown as Worker).postMessage({ type: "loading_progress", phase: "v86-wasm", percent, label: "Loading WinWeb x86 core…" }); } catch { /* host may already be gone */ }',
    '    });',
    '    v86.add_listener("winweb-wasm-phase", (info: any) => {',
    '      const phase = String(info?.phase ?? "unknown");',
    '      const mode = String(info?.mode ?? "primary");',
    '      Logger.log(LogCategory.SYSTEM, "[WINWEB-V86] " + phase + " (" + mode + ")");',
    '    });',
    '    v86.add_listener("emulator-error", (info: any) => {',
    '      const message = info?.message ?? String(info ?? "v86 startup failed");',
    '      Logger.error(LogCategory.SYSTEM, "[WINWEB-V86] startup error: " + message);',
    '      try { (self as unknown as Worker).postMessage({ type: "error", message: "WinWeb v86 startup failed: " + message }); } catch { /* host may already be gone */ }',
    '    });',
  ].join('\n');
  workerSource = workerSource.replace(marker, bridge);
}

await writeFile(workerPath, workerSource, 'utf8');

const memoryPath = path.join(bottleShip, 'src/worker/core/cpu/emulator-config.ts');
let memorySource = await readFile(memoryPath, 'utf8');
memorySource = memorySource.replace(
  /export const EMU_MEMORY_SIZE\s*=\s*1024\s*\*\s*1024\s*\*\s*1024\s*;/,
  'export const EMU_MEMORY_SIZE = 256 * 1024 * 1024;'
);
await writeFile(memoryPath, memorySource, 'utf8');

const verifiedWorker = await readFile(workerPath, 'utf8');
for (const marker of ['winweb_wasm_timeout_ms: 20000', '[WINWEB-V86] startup error', 'winweb-wasm-progress']) {
  if (!verifiedWorker.includes(marker)) throw new Error(`BottleShip WinWeb runtime patch is missing ${marker}.`);
}
const verifiedMemory = await readFile(memoryPath, 'utf8');
if (!verifiedMemory.includes('EMU_MEMORY_SIZE = 256 * 1024 * 1024')) {
  throw new Error('BottleShip iPhone memory patch did not apply.');
}

console.log(`WinWeb custom v86 core ready: ${spec.repo} @ ${actual}`);
console.log('BottleShip worker patched for bounded v86 startup + live WinWeb diagnostics.');
