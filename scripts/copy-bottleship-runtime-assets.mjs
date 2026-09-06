import { access, cp, copyFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('vendor/bottleship/public');
const destination = path.resolve('dist/engines/bottleship/runtime');
await mkdir(destination, { recursive: true });

const entries = [
  'v86.wasm',
  'unpack-streaming.wasm',
  'unpack-buffered.wasm',
  'video-decoder.wasm',
  'bios',
  'fonts'
];

for (const entry of entries) {
  const from = path.join(source, entry);
  try { await access(from); } catch { console.warn(`BottleShip runtime asset missing: ${entry}`); continue; }
  const to = path.join(destination, entry);
  if (entry === 'bios' || entry === 'fonts') await cp(from, to, { recursive: true });
  else await copyFile(from, to);
}

console.log(`Copied BottleShip runtime assets to ${destination}`);
