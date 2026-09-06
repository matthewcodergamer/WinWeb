export type CpuArchitecture = 'x86' | 'x64' | 'arm' | 'arm64' | 'unknown';
export type PeKind = 'PE32' | 'PE32+' | 'unknown';
export type CompatibilityStatus = 'Untested' | 'Analyzed' | 'Boots' | 'Runs' | 'Usable' | 'Good' | 'Excellent' | 'Broken' | 'Unsupported';

export interface RuntimeCapabilities {
  webAssembly: boolean;
  wasmSimd: boolean;
  wasmThreads: boolean;
  sharedArrayBuffer: boolean;
  crossOriginIsolated: boolean;
  webGpu: boolean;
  webGl2: boolean;
  offscreenCanvas: boolean;
  audioWorklet: boolean;
  opfs: boolean;
  fileSystemAccess: boolean;
  webTransport: boolean;
  webRtc: boolean;
  memory64: 'unknown' | 'supported' | 'unsupported';
  userAgent: string;
}

export interface PeSection {
  name: string;
  virtualAddress: number;
  virtualSize: number;
  rawAddress: number;
  rawSize: number;
}

export interface PeImport {
  dll: string;
  symbols: string[];
}

export interface AppCompatibilityProfile {
  id: string;
  fileName: string;
  fileSize: number;
  peKind: PeKind;
  architecture: CpuArchitecture;
  subsystem: string;
  numberOfSections: number;
  entryPoint: number;
  imageBase: string;
  imports: PeImport[];
  importDlls: string[];
  sections: PeSection[];
  isDotNet: boolean;
  isElectronLike: boolean;
  isVsCodeLike: boolean;
  graphicsApis: string[];
  audioApis: string[];
  installer: 'inno' | 'nsis' | 'msi-bootstrapper' | 'portable-or-unknown';
  blockers: string[];
  notes: string[];
  analyzedAt: string;
}

export type EngineId = 'bottleship-hle' | 'wine32' | 'wine64-experimental' | 'code-oss-adapter';

export interface EngineCandidate {
  engineId: EngineId;
  name: string;
  priority: number;
  status: CompatibilityStatus;
  reason: string;
  availableNow: boolean;
}

export interface RuntimeRoute {
  recommended: EngineCandidate | null;
  candidates: EngineCandidate[];
}

export interface StoredAppRecord {
  id: string;
  name: string;
  originalFileName: string;
  fileSize: number;
  importedAt: string;
  updatedAt: string;
  profile: AppCompatibilityProfile;
  selectedEngine: EngineId | null;
  status: CompatibilityStatus;
  sourceStored: boolean;
  lastExitStatus?: string;
}
