import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const bs = path.resolve(root, 'vendor/bottleship');

const runtimeAssetMap = [
  ['/v86.wasm', './runtime/v86.wasm'],
  ['/bios/seabios.bin', './runtime/bios/seabios.bin'],
  ['/bios/vgabios.bin', './runtime/bios/vgabios.bin'],
  ['/unpack-streaming.wasm', './runtime/unpack-streaming.wasm'],
  ['/unpack-buffered.wasm', './runtime/unpack-buffered.wasm'],
  ['/video-decoder.wasm', './runtime/video-decoder.wasm']
];

function rewriteBuiltRuntimeUrls(code) {
  let next = code;
  for (const [from, to] of runtimeAssetMap) {
    next = next.split(`"${from}"`).join(`"${to}"`);
    next = next.split(`'${from}'`).join(`'${to}'`);
    next = next.split('`' + from + '`').join('`' + to + '`');
  }
  return next;
}

function winWebBottleShipPatch() {
  return {
    name: 'winweb-bottleship-mobile-patch',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/vendor/bottleship/')) return null;
      let next = code;
      if (id.endsWith('/src/worker/core/cpu/emulator-config.ts')) {
        next = next.replace(
          /export const EMU_MEMORY_SIZE\s*=\s*1024\s*\*\s*1024\s*\*\s*1024\s*;/,
          'export const EMU_MEMORY_SIZE = 256 * 1024 * 1024;'
        );
      }
      return next === code ? null : { code: next, map: null };
    },
    renderChunk(code, chunk) {
      if (!chunk.fileName.endsWith('.js')) return null;
      const next = rewriteBuiltRuntimeUrls(code);
      return next === code ? null : { code: next, map: null };
    }
  };
}

export default defineConfig({
  base: './',
  publicDir: false,
  plugins: [winWebBottleShipPatch()],
  resolve: {
    alias: {
      v86: path.resolve(bs, 'vendor/v86/build/libv86.mjs'),
      '@bottleship/formats': path.resolve(bs, 'packages/formats/src'),
      '@bottleship/repack': path.resolve(bs, 'packages/repack/src')
    }
  },
  worker: {
    format: 'iife',
    rollupOptions: {
      output: {
        entryFileNames: (chunk) => chunk.facadeModuleId?.endsWith('/src/worker/emulator.worker.ts') ? 'emulator-worker.js' : 'worker-[name]-[hash].js',
        chunkFileNames: 'worker-chunk-[name]-[hash].js',
        assetFileNames: 'worker-[name]-[hash][extname]'
      }
    }
  },
  build: {
    outDir: path.resolve(root, 'dist/engines/bottleship'),
    emptyOutDir: true,
    copyPublicDir: false,
    lib: {
      entry: path.resolve(root, 'engines/bottleship/entry.ts'),
      formats: ['es'],
      fileName: () => 'engine-loader.js'
    },
    rollupOptions: {
      output: {
        entryFileNames: 'engine-loader.js',
        chunkFileNames: 'engine-[name]-[hash].js',
        assetFileNames: 'engine-[name]-[hash][extname]'
      }
    }
  }
});
