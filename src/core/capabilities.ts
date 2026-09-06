import type { RuntimeCapabilities } from './types';

function detectSimd(): boolean {
  try {
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0,
      10, 9, 1, 7, 0, 65, 0, 253, 15, 26, 11
    ]));
  } catch {
    return false;
  }
}

function detectThreads(): boolean {
  try {
    if (typeof SharedArrayBuffer !== 'function') return false;
    const channel = new MessageChannel();
    channel.port1.postMessage(new SharedArrayBuffer(1));
    channel.port1.close();
    channel.port2.close();
    return WebAssembly.validate(new Uint8Array([
      0, 97, 115, 109, 1, 0, 0, 0, 1, 4, 1, 96, 0, 0, 3, 2, 1, 0,
      5, 4, 1, 3, 1, 1, 10, 11, 1, 9, 0, 65, 0, 254, 16, 2, 0, 26, 11
    ]));
  } catch {
    return false;
  }
}

async function detectMemory64(): Promise<RuntimeCapabilities['memory64']> {
  try {
    const descriptor = { initial: 1, maximum: 1, index: 'i64' } as WebAssembly.MemoryDescriptor & { index: string };
    new WebAssembly.Memory(descriptor);
    return 'supported';
  } catch (error) {
    const message = String(error);
    if (/index|i64|memory64/i.test(message)) return 'unsupported';
    return 'unknown';
  }
}

export async function probeRuntimeCapabilities(): Promise<RuntimeCapabilities> {
  const nav = navigator as Navigator & { gpu?: unknown; storage?: StorageManager & { getDirectory?: () => Promise<FileSystemDirectoryHandle> } };
  let webGl2 = false;
  try {
    webGl2 = !!document.createElement('canvas').getContext('webgl2');
  } catch {
    webGl2 = false;
  }

  return {
    webAssembly: typeof WebAssembly === 'object',
    wasmSimd: detectSimd(),
    wasmThreads: detectThreads(),
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    webGpu: 'gpu' in nav,
    webGl2,
    offscreenCanvas: 'OffscreenCanvas' in globalThis,
    audioWorklet: 'AudioWorkletNode' in globalThis,
    opfs: !!nav.storage?.getDirectory,
    fileSystemAccess: 'showOpenFilePicker' in globalThis,
    webTransport: 'WebTransport' in globalThis,
    webRtc: 'RTCPeerConnection' in globalThis,
    memory64: await detectMemory64(),
    userAgent: navigator.userAgent
  };
}
