import './styles.css';
import { probeRuntimeCapabilities } from './core/capabilities';
import type { RuntimeCapabilities } from './core/types';
import { WinWebApp } from './ui/app';

function fallbackCapabilities(): RuntimeCapabilities {
  return {
    webAssembly: typeof WebAssembly === 'object',
    wasmSimd: false,
    wasmThreads: false,
    sharedArrayBuffer: typeof SharedArrayBuffer === 'function',
    crossOriginIsolated: globalThis.crossOriginIsolated === true,
    webGpu: typeof navigator !== 'undefined' && 'gpu' in navigator,
    webGl2: false,
    offscreenCanvas: 'OffscreenCanvas' in globalThis,
    audioWorklet: 'AudioWorkletNode' in globalThis,
    opfs: Boolean((navigator.storage as StorageManager & { getDirectory?: unknown } | undefined)?.getDirectory),
    fileSystemAccess: 'showOpenFilePicker' in globalThis,
    webTransport: 'WebTransport' in globalThis,
    webRtc: 'RTCPeerConnection' in globalThis,
    memory64: 'unknown',
    userAgent: navigator.userAgent
  };
}

function renderFatal(root: HTMLElement, error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  root.innerHTML = `<section class="error-page"><span>!</span><h1>WinWeb could not start</h1><p>${message.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character] ?? character)}</p><button class="primary" onclick="location.reload()">Reload WinWeb</button></section>`;
}

async function boot() {
  const root = document.querySelector<HTMLElement>('#app');
  if (!root) throw new Error('Missing #app root');

  root.innerHTML = '<div class="boot"><span class="window-mark hero-mark"><i></i><i></i><i></i><i></i><b></b></span><strong>WinWeb</strong><small>Preparing Windows runtime…</small></div>';

  let capabilities: RuntimeCapabilities;
  try {
    capabilities = await probeRuntimeCapabilities();
  } catch (error) {
    console.warn('WinWeb capability probe failed; continuing with conservative defaults.', error);
    capabilities = fallbackCapabilities();
  }

  new WinWebApp(root, capabilities).mount();
  root.dataset.winwebReady = 'true';
}

void boot().catch((error) => {
  const root = document.querySelector<HTMLElement>('#app');
  if (root) renderFatal(root, error);
  console.error('WinWeb boot failed', error);
});
