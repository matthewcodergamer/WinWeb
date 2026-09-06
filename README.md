# WinWeb / XRun

**WinWeb** is a browser-native Windows application runtime project. The goal is to let a user select a compatible Windows `.exe`, inspect it locally, choose the best execution engine, persist its app container, and eventually launch the application directly inside a mobile-first shell — without booting or exposing a Windows desktop.

The primary UX/performance target is **iPhone Safari**.

## Current build: V0.1 foundation

This repository now contains a real working foundation rather than a compatibility mockup:

- local PE32 / PE32+ inspection
- x86 / x64 / ARM detection
- bounded parsing so large EXEs are not blindly loaded into iPhone memory
- imported DLL/runtime signal detection
- .NET, Electron/VS Code, DirectX/OpenGL and audio hints
- runtime router for BottleShip/v86 HLE, Wine32, experimental Wine64 and Code-OSS adapter paths
- browser capability probe for WebAssembly, SIMD, threads, SharedArrayBuffer, WebGPU, OPFS, AudioWorklet and more
- local app library with OPFS binary persistence when available
- iPhone-first responsive UI
- common `XRunRuntimeEngine` interface
- pinned upstream registry and sync script
- third-party/license registry
- COOP/COEP development headers plus static-host cross-origin-isolation fallback
- CI + GitHub Pages build workflow

**Important:** the foundation does **not** claim that guest Windows execution is integrated yet. Engine adapters deliberately remain unavailable until the pinned upstream engine is actually built, wired, and proven with a reproducible EXE launch.

## Architecture

```text
EXE / installer
      ↓
local PE inspector
      ↓
runtime router
  ┌───┼───────────────┐
  ↓   ↓               ↓
HLE   Wine            optimized web adapter
  ↓   ↓               ↓
WebAssembly / WebGPU / WebAudio / Workers / OPFS
      ↓
Safari / Chromium / Firefox
```

Primary reuse targets include BottleShip + its v86 fork, BoxedWine/Boxedwine64, Wine, Hangover/FEX/Box64 architecture ideas, DXVK semantics, Naga/Tint, ZenFS, innoextract, LIEF and Code-OSS browser implementations. See [`docs/upstream-projects.md`](docs/upstream-projects.md).

## Run locally

```bash
npm install
npm run dev
```

For a production build:

```bash
npm run check
```

## Sync upstream engine source

The permissive default upstream set can be fetched with:

```bash
npm run upstream:sync
```

GPL-family research engines are intentionally not cloned by default:

```bash
XRUN_INCLUDE_GPL=1 npm run upstream:sync
```

Review `DEPENDENCY_LICENSES.json` and each upstream license before distributing combined builds.

## Next engineering milestone

The next milestone is deliberately narrow:

1. fetch the pinned BottleShip revision,
2. reproduce its current build unchanged,
3. wire the guest display/input/runtime into the `BottleShipEngine` adapter,
4. launch one known x86 Win32 executable inside WinWeb,
5. record the runtime trace as a regression fixture.

Only then should WinWeb label the HLE engine as integrated.

See [`ROADMAP.md`](ROADMAP.md) and [`docs/architecture.md`](docs/architecture.md).
