# Third-party notices

WinWeb is intentionally designed around upstream reuse. This file is a living engineering notice and does not replace the full license texts required by each dependency.

## Included UI assets

### Microsoft Fluent UI System Icons
Selected Home, Apps, Settings, Folder Open, Document, Info and Search SVG icons are vendored under `public/fluent/` from `microsoft/fluentui-system-icons`.

MIT License. Copyright (c) 2020 Microsoft Corporation.

The upstream license permits use, modification and redistribution provided the copyright notice and permission notice are retained. Source: https://github.com/microsoft/fluentui-system-icons

## Included package dependency

### coi-serviceworker
MIT License. Retained as a build dependency for future cross-origin-isolated runtime experiments. It is **not** part of WinWeb's critical iPhone boot path; the lightweight app shell starts without registering it.

## Tracked/integration upstreams

BottleShip, v86, BoxedWine, Boxedwine64, Wine, FEX, Box64, Hangover, Zydis, Binaryen, Dawn/Tint, wgpu/Naga, DXVK, ZenFS, innoextract, LIEF, websockify, code-server and OpenVSCode Server are tracked as integration or research upstreams. See `DEPENDENCY_LICENSES.json` and `docs/upstream-projects.md`.

Do not copy or combine upstream source into a distributable WinWeb build until its exact revision and license obligations are recorded here.
