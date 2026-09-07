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
      if (id.endsWith('/src/worker/emulator.worker.ts')) {
        // The WinWeb v86 fork consumes this option and hard-fails startup rather than
        // letting Safari's asset loader retry forever. Keep it near wasm_path so this
        // patch remains easy to audit against upstream BottleShip.
        if (!next.includes('winweb_wasm_timeout_ms')) {
          next = next.replace(
            /(wasm_path:\s*[^,\n]+,\s*\n)/,
            '$1    winweb_wasm_timeout_ms: 20000,\n'
          );
        }

        // Bridge the custom v86 loader's progress/errors into BottleShip's existing
        // host protocol. The WinWeb shell already understands loading_progress/error,
        // so the direct-EXE path becomes observable without forking BottleShip itself.
        const marker = 'const v86 = new V86(settings);';
        if (next.includes(marker) && !next.includes('[WINWEB-V86] startup error')) {
          next = next.replace(marker, `${marker}
    v86.add_listener("winweb-wasm-progress", (info: any) => {
      const loaded = Number(info?.loaded ?? 0);
      const total = Number(info?.total ?? 0);
      const percent = total > 0 ? Math.max(1, Math.min(99, Math.round((loaded / total) * 100))) : 5;
      try { (self as unknown as Worker).postMessage({ type: "loading_progress", phase: "v86-wasm", percent, label: "Loading WinWeb x86 core…" }); } catch { /* host may already be gone */ }
    });
    v86.add_listener("winweb-wasm-phase", (info: any) => {
      const phase = String(info?.phase ?? "unknown");
      const mode = String(info?.mode ?? "primary");
      Logger.log(LogCategory.SYSTEM, "[WINWEB-V86] " + phase + " (" + mode + ")");
    });
    v86.add_listener("emulator-error", (info: any) => {
      const message = info?.message ?? String(info ?? "v86 startup failed");
      Logger.error(LogCategory.SYSTEM, "[WINWEB-V86] startup error: " + message);
      try { (self as unknown as Worker).postMessage({ type: "error", message: "WinWeb v86 startup failed: " + message }); } catch { /* host may already be gone */ }
    });`);
        }
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
      v86: path.resolve(bs, 'vendor/v86/winweb/winweb-v86.mjs'),
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
