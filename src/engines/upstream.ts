import type { AppCompatibilityProfile, RuntimeCapabilities, StoredAppRecord } from '../core/types';
import { UpstreamEngineBase, type EngineProbeResult } from './runtime-engine';

export class BottleShipEngine extends UpstreamEngineBase {
  readonly id = 'bottleship-hle' as const;
  readonly name = 'BottleShip/v86 HLE';
  async probe(profile: AppCompatibilityProfile, caps: RuntimeCapabilities): Promise<EngineProbeResult> {
    const eligible = profile.architecture === 'x86' && !profile.isDotNet;
    return {
      engineId: this.id,
      available: false,
      reason: eligible
        ? `Eligible. Upstream runtime assets are not vendored into this first foundation commit yet; WebGPU=${caps.webGpu}.`
        : 'Profile is not an HLE-first x86 target.'
    };
  }
  async launch(_record: StoredAppRecord, surface: HTMLElement) {
    surface.innerHTML = '<div class="engine-notice"><strong>HLE engine adapter ready.</strong><span>BottleShip/v86 runtime assets still need to be synced and wired before guest execution is claimed.</span></div>';
  }
}

export class Wine32Engine extends UpstreamEngineBase {
  readonly id = 'wine32' as const;
  readonly name = 'Wine32 compatibility';
  async probe(profile: AppCompatibilityProfile): Promise<EngineProbeResult> {
    return { engineId: this.id, available: false, reason: profile.architecture === 'x86' ? 'Eligible fallback; BoxedWine/Wine32 assets not integrated yet.' : 'Requires x86 PE.' };
  }
  async launch(_record: StoredAppRecord, surface: HTMLElement) {
    surface.innerHTML = '<div class="engine-notice"><strong>Wine32 adapter ready.</strong><span>The isolated compatibility engine remains intentionally separate for upstream/license compliance.</span></div>';
  }
}

export class Wine64Engine extends UpstreamEngineBase {
  readonly id = 'wine64-experimental' as const;
  readonly name = 'Wine64 experimental';
  async probe(profile: AppCompatibilityProfile, caps: RuntimeCapabilities): Promise<EngineProbeResult> {
    return { engineId: this.id, available: false, reason: profile.architecture === 'x64' ? `Eligible research path. Memory64 probe: ${caps.memory64}.` : 'Requires x64 PE.' };
  }
  async launch(_record: StoredAppRecord, surface: HTMLElement) {
    surface.innerHTML = '<div class="engine-notice"><strong>Wine64 research adapter ready.</strong><span>Boxedwine64 is tracked as an upstream engine; Safari must retain a wasm32-compatible path.</span></div>';
  }
}

export class CodeOssEngine extends UpstreamEngineBase {
  readonly id = 'code-oss-adapter' as const;
  readonly name = 'Code-OSS optimized adapter';
  async probe(profile: AppCompatibilityProfile): Promise<EngineProbeResult> {
    return { engineId: this.id, available: false, reason: profile.isVsCodeLike ? 'VS Code signature detected; optimized adapter is preferred once integrated.' : 'Not a VS Code-like binary.' };
  }
  async launch(_record: StoredAppRecord, surface: HTMLElement) {
    surface.innerHTML = '<div class="engine-notice"><strong>Code-OSS adapter planned.</strong><span>WinWeb will share project storage with the Windows runtime rather than emulating Electron when a web-native path is available.</span></div>';
  }
}
