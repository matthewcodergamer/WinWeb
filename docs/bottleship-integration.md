# BottleShip integration

WinWeb pins BottleShip at `a7c8543d75569d48890d48744897a0ffe3fb02f7` as a Git submodule under `vendor/bottleship`.

The first integration rule is **reproduce upstream unchanged before editing it**. The `HLE Upstream Proof` workflow checks out BottleShip recursively (including its `vendor/v86` fork), installs its Bun workspace dependencies, runs its typecheck, builds the production app, and keeps the resulting `dist/` as an artifact. That proof currently passes.

## Verified worker boundary

The pinned BottleShip host creates `src/worker/emulator.worker.ts` as a module worker. The verified host contract includes:

- `init` with an `OffscreenCanvas`, a 1024-byte `SharedArrayBuffer`, width and height;
- worker `ready`, `error`, `loading_progress`, `first_present`, `process_exit` and window-title events;
- `load_bundle` with a URL, one local Blob, or multiple local Blobs;
- `resize`, pause/resume and runtime-settings messages;
- a shared Int32 input layout with pointer state and a 256-key Windows virtual-key bitfield.

WinWeb now encodes that seam in `src/engines/bottleship/bridge.ts` and `protocol.ts`. The bridge owns initialization, readiness, bundle loading, pointer deltas, wheel state, Windows key state, resize and normalized lifecycle events.

```text
WinWeb AppStorage / selected EXE
        |
        v
BottleShipEngine adapter
        |
        v
BottleShipBridge
        |
        +-- OffscreenCanvas transfer
        +-- SharedArrayBuffer input
        +-- load_bundle { blob | blobs | url }
        +-- progress / ready / first_present / crash events
        v
BottleShip emulator.worker.ts
        |
        v
v86 + Win32/COM/DirectX HLE
```

## Next stage

The missing piece is no longer the host protocol. R7 is to make BottleShip's worker and its runtime assets (`v86.wasm`, worker chunks/assets, audio/unpack assets) a build product that WinWeb's Vite application can instantiate without importing BottleShip's React/game-library shell.

The integration must preserve BottleShip's Safari rule that the emulator worker has no dynamic chunk loading.

Do not mark the HLE adapter as integrated merely because the upstream project builds or the bridge compiles. A redistributable x86 sample must actually reach `first_present` through WinWeb first.
