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

const manifest = {
  engine: 'v86',
  role: 'full-x86-pc-fallback',
  source: 'https://github.com/matthewcodergamer/v86',
  branch: 'winweb-bottleship',
  revision: '97704021d3b9f75ef5b1504e9f1f1e7fe95094d4',
  generatedAt: new Date().toISOString(),
};
await writeFile(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');

console.log(`Packaged native v86 PC fallback in ${destination}`);
