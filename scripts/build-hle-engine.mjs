import { spawnSync } from 'node:child_process';

function run(command, args) {
  const result = spawnSync(command, args, { stdio: 'inherit', shell: process.platform === 'win32' });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
run(npx, ['vite', 'build', '--config', 'vite.bottleship-engine.config.mjs']);
run(process.execPath, ['scripts/copy-bottleship-runtime-assets.mjs']);
console.log('WinWeb BottleShip engine bundle built.');
