import type { AppCompatibilityProfile, EngineCandidate, RuntimeCapabilities, RuntimeRoute } from './types';

function candidate(engineId: EngineCandidate['engineId'], name: string, priority: number, reason: string, availableNow = false): EngineCandidate {
  return { engineId, name, priority, reason, availableNow, status: availableNow ? 'Analyzed' : 'Untested' };
}

export function routeApplication(profile: AppCompatibilityProfile, caps: RuntimeCapabilities): RuntimeRoute {
  const candidates: EngineCandidate[] = [];

  if (profile.blockers.length > 0 || profile.architecture === 'arm' || profile.architecture === 'arm64' || profile.architecture === 'unknown') {
    return { recommended: null, candidates };
  }

  if (profile.isVsCodeLike) {
    candidates.push(candidate(
      'code-oss-adapter',
      'Code-OSS optimized adapter',
      100,
      'VS Code-like application detected. A browser-native Code-OSS path avoids emulating Electron + Chromium.'
    ));
  }

  if (profile.architecture === 'x86' && !profile.isDotNet) {
    const graphicsNote = profile.graphicsApis.length ? ` Graphics: ${profile.graphicsApis.join(', ')}.` : '';
    candidates.push(candidate(
      'bottleship-hle',
      'BottleShip/v86 HLE',
      90,
      `32-bit Win32 is the preferred HLE path.${graphicsNote} WebGPU ${caps.webGpu ? 'is available' : 'is not available'} on this browser.`
    ));
  }

  if (profile.architecture === 'x86') {
    candidates.push(candidate(
      'wine32',
      'Wine32 compatibility engine',
      profile.isDotNet ? 88 : 70,
      profile.isDotNet ? '.NET/CLR metadata favors the broader Wine compatibility path.' : 'Fallback for Win32 APIs not implemented by the HLE engine.'
    ));
  }

  if (profile.architecture === 'x64') {
    candidates.push(candidate(
      'wine64-experimental',
      'Boxedwine64 / Wine64 experimental',
      75,
      caps.memory64 === 'supported'
        ? '64-bit PE detected and this browser reports a Memory64-capable path.'
        : '64-bit PE detected. Use the software-addressing/wasm32 research path when Memory64 is unavailable.'
    ));
  }

  candidates.sort((a, b) => b.priority - a.priority);
  return { recommended: candidates[0] ?? null, candidates };
}
