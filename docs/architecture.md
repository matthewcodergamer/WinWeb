# WinWeb architecture

## Goal

WinWeb is a runtime router for compatible Windows applications in the browser. It does not boot Windows and it does not expose a fake Windows desktop.

```text
EXE / installer
      |
      v
Local PE inspector
      |
      v
Runtime router
  |        |        |
  v        v        v
HLE      Wine     optimized web adapter
  \        |        /
   \       |       /
    browser runtime services
      | WebAssembly
      | WebGPU
      | WebAudio
      | Web Workers / SharedArrayBuffer
      | OPFS
      v
Safari / Chromium / Firefox
```

## Foundation commit

The first build intentionally implements the pieces that can be correct without pretending guest execution already exists:

- iPhone-first shell
- bounded local PE32/PE32+ inspection
- x86/x64/ARM architecture classification
- import/DLL and runtime-signal classification
- DirectX/OpenGL/audio signal detection
- .NET/Electron/VS Code hints
- evidence-based runtime routing
- persistent app metadata and OPFS binary storage
- browser capability probing
- engine adapter API
- upstream pin/sync system
- cross-origin isolation support for local/Cloudflare/GitHub Pages-style hosting

The engine adapters currently report `available: false` until the corresponding upstream runtime is actually built and wired. This is deliberate.

## Engine boundary

All engines implement a common `XRunRuntimeEngine` interface. The shell must never directly depend on BottleShip, BoxedWine, or Code-OSS internals.

This keeps permissive and copyleft upstreams separable and allows the runtime router to choose per-application behavior.

## HLE path

Primary x86 route:

```text
PE32 guest
 -> v86 x86-to-Wasm execution
 -> BottleShip-style imported-function traps/hypercalls
 -> Win32/COM HLE
 -> browser-native filesystem/graphics/audio/input
```

The integration target is the pinned BottleShip revision in `upstreams.lock.json`, including its v86 fork/submodule.

## Wine path

Compatibility engines remain separate:

```text
x86/x64 guest
 -> BoxedWine / Boxedwine64 CPU/kernel layer
 -> Wine / wineserver
 -> browser presentation and storage adapters
```

The Wine64 engine must not make iPhone support dependent on Wasm Memory64. Capability-specific builds should remain possible.

## Storage

The long-term layout is immutable base filesystem + per-app copy-on-write overlay. The foundation stores the imported binary in OPFS at:

```text
/xrun/apps/{app-id}/source/{original-file-name}
```

and keeps small metadata records in localStorage. A later storage migration will move metadata/registry/state into structured OPFS/IndexedDB records without duplicating common Wine roots.

## Security boundary

Imported binaries are untrusted. The shell never evaluates guest code as JavaScript. Networking, clipboard and host file access will be capability-gated per application.

## Hosting

Vite dev/preview sends COOP/COEP headers. `public/_headers` supports hosts such as Cloudflare Pages. `coi-serviceworker` is copied into `dist/` as a fallback for static hosts such as GitHub Pages that cannot configure those headers directly.
