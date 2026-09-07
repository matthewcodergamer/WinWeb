import { access, copyFile, mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const source = path.resolve('vendor/bottleship/vendor/v86');
const destination = path.resolve('dist/engines/v86-vm');
await mkdir(destination, { recursive: true });
await mkdir(path.join(destination, 'bios'), { recursive: true });

const copies = [
  ['build/libv86.mjs', 'libv86.mjs'],
  ['build/v86.wasm', 'v86.wasm'],
  ['bios/seabios.bin', 'bios/seabios.bin'],
  ['bios/vgabios.bin', 'bios/vgabios.bin'],
];

for (const [from, to] of copies) {
  const input = path.join(source, from);
  await access(input);
  await copyFile(input, path.join(destination, to));
}

// The fork keeps this wrapper next to the source tree and imports ../build/libv86.mjs.
// In the deployable v86-vm directory libv86.mjs sits beside the wrapper, so rebase
// that one import while packaging. This gives both BottleShip HLE and the full-PC
// fallback the same bounded, Safari-safe WinWeb v86 startup behavior.
const wrapperSource = path.join(source, 'winweb/winweb-v86.mjs');
let wrapper = await readFile(wrapperSource, 'utf8');
wrapper = wrapper.replaceAll('../build/libv86.mjs', './libv86.mjs');
if (!wrapper.includes('createWinWebWasmLoader') || !wrapper.includes('emulator-error')) {
  throw new Error('The pinned v86 fork is missing the WinWeb runtime wrapper contract.');
}
await writeFile(path.join(destination, 'winweb-v86.mjs'), wrapper, 'utf8');

// v86 already contains a small ISO9660 generator. Package that implementation for
// WinWeb so a selected EXE can be exposed to an already-installed Windows guest as
// a virtual CD without uploading the application anywhere. The source only imports
// dbg_assert, so replace that development helper with a tiny standalone assertion.
const isoSource = path.join(source, 'src/iso9660.js');
let iso = await readFile(isoSource, 'utf8');
iso = iso.replace(
  /import\s*\{\s*dbg_assert\s*\}\s*from\s*["']\.\/log\.js["'];?\s*/,
  'const dbg_assert=(value,message)=>{if(!value)throw new Error(message||"ISO9660 assertion failed");};\n'
);
await writeFile(path.join(destination, 'iso9660.mjs'), iso, 'utf8');

const lock = JSON.parse(await readFile(path.resolve('upstreams.lock.json'), 'utf8'));
const v86 = lock.projects.find((project) => project.id === 'v86-winweb');
if (!v86) throw new Error('upstreams.lock.json is missing v86-winweb.');
const manifest = {
  engine: 'v86',
  runtime: 'WinWeb custom v86',
  role: 'x86-core-hle-and-full-pc',
  source: v86.repo,
  branch: v86.branch,
  revision: v86.ref,
  wasmTimeoutMs: 20000,
  generatedAt: new Date().toISOString(),
};
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Packaged WinWeb custom v86 runtime in ${destination} @ ${v86.ref}`);
