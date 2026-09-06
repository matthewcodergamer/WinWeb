# BottleShip integration

WinWeb keeps BottleShip as a pinned upstream engine rather than copying its React/game-library shell.

## Current host boundary

WinWeb uses BottleShip's worker protocol directly:

```text
WinWeb shell
  -> select/inspect x86 PE
  -> user presses Run application
  -> enable cross-origin isolation only when needed
  -> restore selected EXE locally after the one-time reload
  -> dynamically import engines/bottleship/engine-loader.js
  -> create BottleShip worker
  -> transfer OffscreenCanvas
  -> allocate 1 KB SharedArrayBuffer input block
  -> post { type: "init", canvas, inputBuffer, width, height }
  -> wait for ready
  -> post { type: "load_bundle", blob }
  -> first_present => application visible
```

The shell never imports BottleShip at startup.

## iPhone memory profile

BottleShip upstream currently defaults to 1 GB guest RAM. WinWeb patches only its own generated BottleShip bundle to use a 256 MB mobile profile so an iPhone 11 Safari tab is less likely to be terminated by memory pressure. The upstream Git submodule remains unchanged and mergeable.

## Runtime asset rebasing

The WinWeb engine build rewrites BottleShip's site-root runtime asset references into engine-relative paths, for example:

```text
/v86.wasm -> ./runtime/v86.wasm
/bios/seabios.bin -> ./runtime/bios/seabios.bin
/bios/vgabios.bin -> ./runtime/bios/vgabios.bin
/unpack-streaming.wasm -> ./runtime/unpack-streaming.wasm
/unpack-buffered.wasm -> ./runtime/unpack-buffered.wasm
/video-decoder.wasm -> ./runtime/video-decoder.wasm
```

This is required for a GitHub Pages project site under `/WinWeb/`.

## Browser requirements for direct HLE launch

The current BottleShip worker requires:

- WebAssembly
- Worker
- SharedArrayBuffer
- cross-origin isolation
- OffscreenCanvas transfer support

GitHub Pages does not supply COOP/COEP response headers directly, so WinWeb registers a small isolation service worker only after the user presses **Run application**. The Home screen does not depend on that worker.

## Compatibility rule

A Run button is offered only for compatible x86/32-bit PE applications routed to BottleShip HLE. x64/Wine64 and other engines remain marked unavailable/experimental until their launch paths have real runtime proof.
