# WinWeb Roadmap

## Current focus

WinWeb is moving from local executable inspection into verified browser execution.

- [x] iPhone-first Windows-style shell
- [x] Local bounded PE inspection
- [x] x86/x64/ARM/ARM64 detection
- [x] Runtime recommendation router
- [x] BottleShip/v86 upstream pin and reproducible worker build
- [x] Fullscreen runtime host UI with touch pointer and basic Windows keys
- [x] On-demand cross-origin isolation flow for SharedArrayBuffer
- [x] Lazy x86 engine deployment in GitHub Pages
- [x] Mobile BottleShip build profile reduced from 1 GB to 256 MB guest RAM
- [ ] Real-device proof for a lightweight x86 EXE on iPhone Safari
- [ ] Persistent executable/app containers after a successful run
- [ ] Expanded touch keyboard and clipboard bridge
- [ ] Wine32 fallback engine
- [ ] Experimental x64/Wine64 engine
- [ ] Safari-compatible x64 research path
- [ ] Code-OSS optimized development adapter

## Compatibility rule

WinWeb must never label an application as working without a real execution result. Unsupported or not-yet-wired runtime families remain clearly marked as experimental or unavailable.
