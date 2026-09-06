import { access } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const root = 'vendor/bottleship';
try {
  await access(`${root}/package.json`);
} catch {
  throw new Error('BottleShip submodule is missing. Run: git submodule update --init --recursive');
}

const command = process.platform === 'win32' ? 'bun.exe' : 'bun';
for (const args of [['install', '--frozen-lockfile'], ['run', 'typecheck'], ['run', 'build']]) {
  const result = spawnSync(command, args, { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log('BottleShip upstream build reproduced successfully.');
