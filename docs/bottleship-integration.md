# BottleShip integration plan

WinWeb pins BottleShip at `a7c8543d75569d48890d48744897a0ffe3fb02f7` as a Git submodule under `vendor/bottleship`.

The first integration rule is **reproduce upstream unchanged before editing it**. The `HLE Upstream Proof` workflow checks out BottleShip recursively (including its `vendor/v86` fork), installs its Bun workspace dependencies, runs its typecheck, and builds the production app. The resulting `dist/` is retained as a workflow artifact.

## Worker boundary discovered upstream

BottleShip's host creates `src/worker/emulator.worker.ts` as a module worker. Its worker already supports the `load_bundle` command and accepts both a URL and local Blob-based load paths. This is the seam WinWeb should integrate against rather than importing BottleShip's game-library UI.

Target bridge:

```text
WinWeb AppStorage / selected EXE
        |
        v
BottleShipEngine adapter
        |
        +-- OffscreenCanvas transfer
        +-- keyboard / mouse messages
        +-- load_bundle { blob | url }
        +-- progress / ready / crash events
        v
BottleShip emulator.worker.ts
        |
        v
v86 + Win32/COM/DirectX HLE
```

## Integration stages

1. **Upstream proof** — current workflow; no WinWeb-specific patches.
2. **Bridge package** — create a tiny WinWeb-owned host adapter that initializes the BottleShip worker and forwards canvas/input/runtime events.
3. **Bundle ingestion** — use BottleShip's own WGB/installer ingest code rather than inventing a second format.
4. **Raw PE path** — for truly portable x86 PE files, construct the minimum manifest/filesystem expected by the worker.
5. **UI removal by composition** — WinWeb owns all launcher/application chrome; BottleShip remains an engine worker, not a visible nested app.
6. **Regression proof** — one redistributable x86 sample must launch through WinWeb before `BottleShipEngine.available` becomes true.

Do not mark the HLE adapter as integrated merely because the upstream project builds.
