# Upstream reuse map

WinWeb must search upstream implementations before writing a new emulator subsystem. The list below separates integration candidates from research references.

| Project | Role in WinWeb | Policy |
| --- | --- | --- |
| BottleShip | Primary HLE runtime: PE loading, Win32/COM interception, legacy Direct3D→WebGPU, audio, COW storage | Pin and integrate first |
| jenissimo/v86 | BottleShip's x86→Wasm CPU/JIT fork | Consume through BottleShip initially |
| copy/v86 | Upstream CPU/JIT/reference implementation | Track for fixes and tests |
| BoxedWine | Wine32/browser compatibility fallback | Keep in isolated engine boundary |
| Boxedwine64 | Experimental x86-64 + Wine64 browser path | Optional GPL engine/research path |
| Wine | Win32/Win64 compatibility source of truth | Prefer reuse over reimplementing APIs |
| Hangover | Escape emulation at Wine/Win32 API boundaries | Architecture reference |
| FEX | Modern DBT/IR/cache/thunking techniques | Algorithm/reference source where license permits |
| Box64 | x64 emulation and native-library wrapping ideas | Reference |
| Zydis | x86/x64 decoder candidate | Future DBT component |
| Binaryen | Wasm IR/optimization | Future hot-tier/offline optimizer candidate |
| DXVK | D3D8-11 semantics/shader behavior | Reference, not a direct Vulkan-on-web solution |
| Dawn/Tint | WebGPU/WGSL implementation and compiler | Shader/WebGPU reference |
| wgpu/Naga | Shader IR and translations | D3D→WGSL research candidate |
| ZenFS | OPFS/Emscripten filesystem adapters | Evaluate before writing new storage glue |
| innoextract | Inno Setup extraction | Future installer fast path |
| LIEF | Deep PE parsing | Evaluate when browser-native PE inspector reaches limits |
| websockify | WebSocket↔TCP relay | Reference/optional restricted relay component |
| Open Browser Porter | BottleShip-family Winsock/network work | Watch and reuse before writing Winsock HLE blindly |
| Code-OSS / code-server / OpenVSCode Server | VS Code browser-native route | Optimized adapter research |
| CheerpX/WebVM | x86→Wasm JIT benchmark | Research only unless licensing explicitly permits integration |
| WebContainers | Browser Node/process benchmark | Optional provider only; never a mandatory core dependency |
| coi-serviceworker | COOP/COEP service-worker fallback | Included package dependency |

## Upstream update rules

1. Record an exact revision before integration.
2. Record its license and source files reused.
3. Keep generic upstream code mergeable whenever practical.
4. Add a regression before declaring a compatibility bug fixed.
5. Never advertise an upstream feature in WinWeb until WinWeb has reproduced it in its own build and target browser.
