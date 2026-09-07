import { access, readFile } from 'node:fs/promises';
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
]) {
  await access(path.join(nested, required));
}

console.log(`WinWeb v86 core ready: ${spec.repo} @ ${actual}`);
