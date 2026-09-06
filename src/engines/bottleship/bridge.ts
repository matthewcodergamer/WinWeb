import {
  BOTTLESHIP_INPUT_BUFFER_BYTES,
  BOTTLESHIP_INPUT_INDEX as I,
  type BottleShipBridgeEvent,
  type BottleShipHostToWorkerMessage,
  type BottleShipWorkerMessage
} from './protocol';
import { keyboardEventToVirtualKey } from './windows-keys';

export interface BottleShipBridgeOptions {
  createWorker: () => Worker;
  onEvent?: (event: BottleShipBridgeEvent) => void;
  readyTimeoutMs?: number;
}

export class BottleShipBridge {
  private worker: Worker | null = null;
  private inputBuffer: SharedArrayBuffer | null = null;
  private input: Int32Array | null = null;
  private canvas: HTMLCanvasElement | null = null;
  private ready = false;
  private readyPromise: Promise<void> | null = null;
  private resolveReady: (() => void) | null = null;
  private rejectReady: ((error: Error) => void) | null = null;
  private readonly listeners = new Set<(event: BottleShipBridgeEvent) => void>();

  constructor(private readonly options: BottleShipBridgeOptions) {
    if (options.onEvent) this.listeners.add(options.onEvent);
  }

  get isReady() { return this.ready; }
  get sharedInputBuffer() { return this.inputBuffer; }

  onEvent(listener: (event: BottleShipBridgeEvent) => void) {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async attach(canvas: HTMLCanvasElement, width: number, height: number): Promise<void> {
    if (this.worker) throw new Error('BottleShip bridge is already attached.');
    if (typeof SharedArrayBuffer !== 'function' || !globalThis.crossOriginIsolated) {
      throw new Error('BottleShip requires cross-origin isolation and SharedArrayBuffer.');
    }
    if (typeof canvas.transferControlToOffscreen !== 'function') {
      throw new Error('This browser cannot transfer the application canvas to an OffscreenCanvas.');
    }

    this.canvas = canvas;
    this.inputBuffer = new SharedArrayBuffer(BOTTLESHIP_INPUT_BUFFER_BYTES);
    this.input = new Int32Array(this.inputBuffer);
    this.worker = this.options.createWorker();
    this.worker.addEventListener('message', this.handleMessage);
    this.worker.addEventListener('error', this.handleWorkerError);

    this.readyPromise = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve;
      this.rejectReady = reject;
    });

    const offscreen = canvas.transferControlToOffscreen();
    this.post({ type: 'init', canvas: offscreen, inputBuffer: this.inputBuffer, width, height }, [offscreen]);
    this.markInside(true);

    const timeoutMs = this.options.readyTimeoutMs ?? 30_000;
    const timeout = window.setTimeout(() => {
      if (!this.ready) this.rejectReady?.(new Error(`BottleShip worker did not become ready within ${timeoutMs} ms.`));
    }, timeoutMs);
    try {
      await this.readyPromise;
    } finally {
      window.clearTimeout(timeout);
    }
  }

  async loadBlob(blob: Blob): Promise<void> {
    this.requireWorker();
    this.post({ type: 'load_bundle', blob });
  }

  async loadFiles(files: Blob[]): Promise<void> {
    this.requireWorker();
    if (files.length === 1) return this.loadBlob(files[0]!);
    this.post({ type: 'load_bundle', blobs: files });
  }

  async loadUrl(url: string): Promise<void> {
    this.requireWorker();
    this.post({ type: 'load_bundle', url });
  }

  resize(width: number, height: number) {
    this.post({ type: 'resize', width: Math.max(1, Math.floor(width)), height: Math.max(1, Math.floor(height)) });
  }

  pause() { this.post({ type: 'pause' }); }
  resume() { this.post({ type: 'resume' }); }

  setPointer(x: number, y: number, buttons: number) {
    const input = this.requireInput();
    Atomics.store(input, I.mouseX, Math.round(x));
    Atomics.store(input, I.mouseY, Math.round(y));
    Atomics.store(input, I.buttons, buttons | 0);
    this.bumpSequence();
  }

  addRelativePointer(dx: number, dy: number) {
    const input = this.requireInput();
    Atomics.add(input, I.dinputDX, Math.round(dx));
    Atomics.add(input, I.dinputDY, Math.round(dy));
    this.bumpSequence();
  }

  addWheel(delta: number) {
    const input = this.requireInput();
    Atomics.add(input, I.mouseWheel, Math.round(delta));
    this.bumpSequence();
  }

  markInside(inside: boolean) {
    const input = this.requireInput();
    Atomics.store(input, I.mouseInside, inside ? 1 : 0);
    this.bumpSequence();
  }

  key(vk: number, down: boolean) {
    if (vk < 0 || vk > 255) return;
    const input = this.requireInput();
    const word = I.keyBitfieldBase + (vk >>> 5);
    const mask = 1 << (vk & 31);
    if (down) Atomics.or(input, word, mask);
    else Atomics.and(input, word, ~mask);
    Atomics.store(input, I.keyCode, vk);
    Atomics.store(input, I.keyState, down ? 1 : 0);
    this.bumpSequence();
  }

  keyboardEvent(event: KeyboardEvent, down: boolean) {
    const vk = keyboardEventToVirtualKey(event);
    if (vk == null) return false;
    this.key(vk, down);
    return true;
  }

  terminate() {
    if (!this.worker) return;
    this.worker.removeEventListener('message', this.handleMessage);
    this.worker.removeEventListener('error', this.handleWorkerError);
    this.worker.terminate();
    this.worker = null;
    this.input = null;
    this.inputBuffer = null;
    this.canvas = null;
    this.ready = false;
    this.readyPromise = null;
    this.resolveReady = null;
    this.rejectReady = null;
  }

  private post(message: BottleShipHostToWorkerMessage, transfer: Transferable[] = []) {
    this.requireWorker().postMessage(message, transfer);
  }

  private requireWorker() {
    if (!this.worker) throw new Error('BottleShip bridge is not attached.');
    return this.worker;
  }

  private requireInput() {
    if (!this.input) throw new Error('BottleShip shared input is not initialized.');
    return this.input;
  }

  private bumpSequence() {
    Atomics.add(this.requireInput(), I.seq, 1);
  }

  private emit(event: BottleShipBridgeEvent) {
    for (const listener of this.listeners) listener(event);
  }

  private readonly handleWorkerError = (event: ErrorEvent) => {
    const error = new Error(event.message || 'BottleShip worker failed.');
    this.rejectReady?.(error);
    this.emit({ type: 'error', message: error.message });
  };

  private readonly handleMessage = (event: MessageEvent<BottleShipWorkerMessage>) => {
    const message = event.data ?? {};
    switch (message.type) {
      case 'ready':
        this.ready = true;
        this.resolveReady?.();
        this.emit({ type: 'ready' });
        break;
      case 'loading_progress':
        this.emit({
          type: 'progress',
          phase: typeof message.phase === 'string' ? message.phase : 'loading',
          percent: typeof message.percent === 'number' ? message.percent : 0,
          label: typeof message.label === 'string' ? message.label : undefined
        });
        break;
      case 'first_present':
        this.emit({ type: 'first-present' });
        break;
      case 'window_title':
        this.emit({ type: 'window-title', title: typeof message.title === 'string' ? message.title : '' });
        break;
      case 'process_exit':
        this.emit({
          type: 'exit',
          code: typeof message.exitCode === 'number' ? message.exitCode : 0,
          crashed: message.crashed === true,
          fault: message.fault
        });
        break;
      case 'error':
        this.emit({ type: 'error', message: typeof message.message === 'string' ? message.message : 'BottleShip runtime error.' });
        break;
      default:
        this.emit({ type: 'raw', message });
    }
  };
}
