import type { AppCompatibilityProfile, EngineId, RuntimeCapabilities, StoredAppRecord } from '../core/types';

export interface EngineProbeResult {
  engineId: EngineId;
  available: boolean;
  reason: string;
}

export interface XRunRuntimeEngine {
  readonly id: EngineId;
  readonly name: string;
  probe(profile: AppCompatibilityProfile, capabilities: RuntimeCapabilities): Promise<EngineProbeResult>;
  install(record: StoredAppRecord): Promise<void>;
  launch(record: StoredAppRecord, surface: HTMLElement): Promise<void>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  terminate(): Promise<void>;
  snapshot(): Promise<Uint8Array | null>;
  restore(snapshot: Uint8Array): Promise<void>;
  sendPointerEvent(event: PointerEvent): void;
  sendKeyboardEvent(event: KeyboardEvent): void;
  getMetrics(): Readonly<Record<string, number | string | boolean>>;
  getLogs(): readonly string[];
}

export abstract class UpstreamEngineBase implements XRunRuntimeEngine {
  abstract readonly id: EngineId;
  abstract readonly name: string;
  protected logs: string[] = [];

  abstract probe(profile: AppCompatibilityProfile, capabilities: RuntimeCapabilities): Promise<EngineProbeResult>;
  abstract launch(record: StoredAppRecord, surface: HTMLElement): Promise<void>;

  async install(_record: StoredAppRecord) { this.logs.push(`${this.name}: install requested`); }
  async pause() { this.logs.push(`${this.name}: pause requested`); }
  async resume() { this.logs.push(`${this.name}: resume requested`); }
  async terminate() { this.logs.push(`${this.name}: terminate requested`); }
  async snapshot() { return null; }
  async restore(_snapshot: Uint8Array) { this.logs.push(`${this.name}: restore requested`); }
  sendPointerEvent(_event: PointerEvent) {}
  sendKeyboardEvent(_event: KeyboardEvent) {}
  getMetrics() { return { integrated: false }; }
  getLogs() { return this.logs; }
}
