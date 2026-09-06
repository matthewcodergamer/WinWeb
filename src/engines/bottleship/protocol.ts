export const BOTTLESHIP_INPUT_BUFFER_BYTES = 1024;

export const BOTTLESHIP_INPUT_INDEX = {
  seq: 0,
  mouseX: 1,
  mouseY: 2,
  buttons: 3,
  keyCode: 4,
  keyState: 5,
  gamepadConnected: 6,
  gamepadButtons: 7,
  gamepadAxis0: 8,
  gamepadAxis1: 9,
  gamepadAxis2: 10,
  gamepadAxis3: 11,
  mouseWheel: 12,
  mouseInside: 13,
  dinputDX: 14,
  dinputDY: 15,
  keyBitfieldBase: 16,
  guestGamepadSeq: 24
} as const;

export type BottleShipHostToWorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; inputBuffer: SharedArrayBuffer; width: number; height: number }
  | { type: 'load_bundle'; blob: Blob }
  | { type: 'load_bundle'; blobs: Blob[] }
  | { type: 'load_bundle'; url: string }
  | { type: 'resize'; width: number; height: number }
  | { type: 'pause' }
  | { type: 'resume' }
  | { type: 'set_present_mode'; mode: string }
  | { type: 'set_quality'; quality: Record<string, unknown> }
  | { type: 'dbg'; cmd: string; args: unknown[] };

export interface BottleShipWorkerMessage {
  type?: string;
  message?: string;
  title?: string;
  phase?: string;
  percent?: number;
  label?: string;
  exitCode?: number;
  crashed?: boolean;
  fault?: unknown;
  [key: string]: unknown;
}

export type BottleShipBridgeEvent =
  | { type: 'ready' }
  | { type: 'progress'; phase: string; percent: number; label?: string }
  | { type: 'first-present' }
  | { type: 'window-title'; title: string }
  | { type: 'exit'; code: number; crashed: boolean; fault?: unknown }
  | { type: 'error'; message: string }
  | { type: 'raw'; message: BottleShipWorkerMessage };
