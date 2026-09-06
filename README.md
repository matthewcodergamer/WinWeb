# WinWeb / XRun

WinWeb is an experimental browser-native Windows application runtime focused on running compatible Windows applications directly inside a custom web interface, with iPhone Safari as the primary mobile target.

## Current implementation

- Windows 11-inspired lightweight shell that renders before any emulator code loads.
- iPhone-first responsive layout with full-size controls to avoid Safari form zoom and tiny desktop-scale text.
- Local EXE/PE inspection with a bounded 64 KB first pass (up to 256 KB only when the PE header requires it).
- Detects PE32/PE32+, x86, x64, ARM/ARM64, GUI/console, DLL, CLR/.NET, installer-name and VS Code signals.
- Runtime router recommendations for BottleShip/v86 HLE, Wine32/Wine64 research paths, and optimized web adapters.
- **Direct Run flow for compatible x86/32-bit applications:** after inspection, press **Run application**. WinWeb lazily enables the shared-memory runtime, restores the uploaded EXE after the one-time isolation reload when necessary, and launches the BottleShip worker in a fullscreen app canvas.
- The x86 web engine is built with a **256 MB mobile memory profile** instead of BottleShip upstream's 1 GB default. This is a WinWeb-only build patch and does not modify the upstream submodule.
- Home never initializes WebGPU, Wine, v86, OPFS runtime containers, or emulator WASM.
- GitHub Pages builds and deploys the pinned BottleShip engine separately from the shell.

## Important compatibility boundary

Direct execution is currently wired only for compatible **x86/32-bit** PE applications through the BottleShip/v86 HLE engine. x64/Wine64 and other runtime families remain experimental/incomplete and are not presented as working when they are not.

The project goal is not to claim that every EXE works. Compatibility must be demonstrated with real runtime proof.

## Architecture

See:

- `docs/architecture.md`
- `docs/bottleship-integration.md`
- `docs/upstream-projects.md`
- `THIRD_PARTY_NOTICES.md`
- `DEPENDENCY_LICENSES.json`

## Upstream baseline

The pinned BottleShip revision is tracked as the `vendor/bottleship` Git submodule. The HLE proof workflow builds the upstream project and the isolated WinWeb worker bundle so runtime integration is based on a reproducible upstream baseline.

## Development

```bash
npm install
npm run typecheck
npm run build
```

For the BottleShip engine build:

```bash
git submodule update --init --recursive
cd vendor/bottleship && bun install --frozen-lockfile && cd ../..
npm run engine:hle:bundle
```

## Product statement

> Run compatible Windows applications directly in your browser. No Windows installation and no remote PC required.

WinWeb is an independent project and is not affiliated with or endorsed by Microsoft. Windows and related marks belong to Microsoft.