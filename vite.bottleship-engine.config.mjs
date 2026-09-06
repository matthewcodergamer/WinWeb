import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(fileURLToPath(import.meta.url));
const bs = path.resolve(root, 'vendor/bottleship');

/**
 * Build BottleShip's worker as a self-contained engine module without importing its React shell.
 * Runtime asset URL rebasing is intentionally a separate launch-proof milestone; this build first
 * proves that WinWeb can compile the pinned worker graph itself.
 */
export default defineConfig({
  base: './',
  publicDir: false,
  resolve: {
    alias: {
      v86: path.resolve(bs, 'vendor/v86/build/libv86.mjs'),
      '@bottleship/formats': path.resolve(bs, 'packages/formats/src'),
      '@bottleship/repack': path.resolve(bs, 'packages/repack/src')
    }
  },
  worker: {
    format: 'es',
    rollupOptions: {
      output: {
        codeSplitting: false,
        entryFileNames: 'emulator-worker.js',
        chunkFileNames: 'worker-[name]-[hash].js',
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
