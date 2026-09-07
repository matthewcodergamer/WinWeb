const screen = document.getElementById('screen_container');
const boot = document.getElementById('vm-boot');
const setup = document.getElementById('vm-setup');
const loading = document.getElementById('vm-loading');
const bootTitle = document.getElementById('vm-boot-title');
const bootCopy = document.getElementById('vm-boot-copy');
const progress = document.getElementById('vm-progress');
const logNode = document.getElementById('vm-log');
const pill = document.getElementById('vm-pill');
const pillText = document.getElementById('vm-pill-text');
const subtitle = document.getElementById('vm-subtitle');
const osInput = document.getElementById('vm-os-file');
const exeInput = document.getElementById('vm-exe-file');
const osName = document.getElementById('vm-os-name');
const exeName = document.getElementById('vm-exe-name');
const memorySelect = document.getElementById('vm-memory');
const startButton = document.getElementById('vm-start');
const setupStatus = document.getElementById('vm-setup-status');
const retryButton = document.getElementById('vm-retry');

const BUILD = '20260907-vm3';
const STANDALONE = window.parent === window;
let emulator = null;
let V86Ctor = null;
let generateIso = null;
let rows = [];
let startupTimer = 0;
let failed = false;
let selectedOs = null;
let selectedExe = null;

function send(type, detail = {}) {
  if (STANDALONE) return;
  try { parent.postMessage({ type, ...detail }, location.origin); } catch (_) {}
}

function setPill(text, kind = '') {
  pillText.textContent = text;
  pill.classList.remove('ready', 'error');
  if (kind) pill.classList.add(kind);
}

function setProgress(value, title, copy) {
  progress.style.width = `${Math.max(4, Math.min(100, Number(value) || 4))}%`;
  if (title) bootTitle.textContent = title;
  if (copy) bootCopy.textContent = copy;
}

function log(message, level = 'info') {
  const stamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  rows.push(`[${stamp}] ${level.toUpperCase()}  ${message}`);
  if (rows.length > 140) rows.splice(0, rows.length - 140);
  logNode.textContent = rows.join('\n');
  logNode.scrollTop = logNode.scrollHeight;
  send('winweb-v86-log', { level, message });
}

function clearStartupTimer() {
  if (startupTimer) clearTimeout(startupTimer);
  startupTimer = 0;
}

function showSetup(message = '') {
  boot.classList.remove('done');
  setup.hidden = false;
  loading.hidden = true;
  retryButton.hidden = true;
  if (message) setupStatus.textContent = message;
  setPill('Ready', 'ready');
  refreshStartButton();
}

function showLoading() {
  boot.classList.remove('done');
  setup.hidden = true;
  loading.hidden = false;
  retryButton.hidden = true;
}

function fail(message) {
  if (failed) return;
  failed = true;
  clearStartupTimer();
  showLoading();
  setPill('Error', 'error');
  setProgress(100, 'PC runtime error', message);
  retryButton.hidden = false;
  log(message, 'error');
  send('winweb-v86-error', { message });
}

function refreshStartButton() {
  if (!startButton) return;
  startButton.disabled = !(selectedOs instanceof File);
}

function fileKind(file) {
  const name = String(file?.name || '').toLowerCase();
  if (/\.(iso|cdr)$/.test(name)) return 'cdrom';
  if (/\.(img|vhd|vdi|bin|raw|hdd)$/.test(name)) return 'hda';
  return 'hda';
}

function fitScreen(width, height) {
  if (!emulator || !width || !height) return;
  const stage = document.querySelector('.stage');
  const rect = stage.getBoundingClientRect();
  const sx = Math.max(.25, Math.min(1.5, (rect.width - 12) / width));
  const sy = Math.max(.25, Math.min(1.5, (rect.height - 12) / height));
  const scale = Math.min(sx, sy);
  try { emulator.screen_set_scale(scale, scale); } catch (_) {}
}

async function ensureEngine() {
  if (V86Ctor) return;
  setProgress(8, 'Loading WinWeb v86', 'Loading the WinWeb-owned Safari-safe x86-to-Wasm engine.');
  log('Loading custom WinWeb v86 module');
  const engine = await import(`./engines/v86-vm/winweb-v86.mjs?v=${BUILD}`);
  V86Ctor = engine.V86 || engine.default;
  if (typeof V86Ctor !== 'function') throw new Error('The packaged WinWeb v86 module did not export V86.');
  const iso = await import(`./engines/v86-vm/iso9660.mjs?v=${BUILD}`);
  generateIso = iso.generate;
  if (typeof generateIso !== 'function') throw new Error('The v86 ISO generator is missing.');
  const profile = engine.WINWEB_V86_BUILD?.profile || 'custom';
  log(`Custom v86 JavaScript engine loaded (${profile})`);
}

async function ensureStandaloneRuntime() {
  if (!STANDALONE) return true;
  setupStatus.textContent = 'Preparing the secure local runtime…';
  setPill('Preparing');

  // v86 itself can run without SharedArrayBuffer, but enabling WinWeb's isolation
  // service worker gives the same predictable browser environment as the direct HLE
  // path. Do this before the user picks large local files so a reload never loses them.
  if (!window.crossOriginIsolated && 'serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register(`./coi-serviceworker.js?v=${BUILD}`, { scope: './' });
      await navigator.serviceWorker.ready;
      if (reg.waiting) {
        try { reg.waiting.postMessage({ type: 'SKIP_WAITING' }); } catch (_) {}
      }
      const key = `winweb.v86.isolation.${BUILD}`;
      const attempt = Number(sessionStorage.getItem(key) || '0');
      if (!window.crossOriginIsolated && attempt < 1) {
        sessionStorage.setItem(key, String(attempt + 1));
        setupStatus.textContent = 'Enabling the local x86 runtime…';
        const url = new URL(location.href);
        url.searchParams.set('wwvm', BUILD);
        setTimeout(() => location.replace(url.href), 120);
        return false;
      }
      if (!window.crossOriginIsolated) {
        log('Cross-origin isolation did not activate; continuing because native v86 does not require SharedArrayBuffer for this PC path.', 'warn');
      }
    } catch (error) {
      log(`Isolation setup warning: ${error?.message || error}`, 'warn');
    }
  }

  setupStatus.textContent = window.crossOriginIsolated ? 'Secure runtime ready · files stay local' : 'Local runtime ready · files stay on this device';
  setPill('Ready', 'ready');
  refreshStartButton();
  return true;
}

async function buildApplicationCd(exeFile) {
  if (!exeFile) return null;
  const MAX_EXE = 48 * 1024 * 1024;
  if (exeFile.size > MAX_EXE) {
    log(`EXE is ${(exeFile.size / 1048576).toFixed(1)} MB; automatic VM CD injection is capped at 48 MB on mobile.`, 'warn');
    return null;
  }
  setProgress(18, 'Preparing application CD', `Mounting ${exeFile.name} without uploading it.`);
  const exe = new Uint8Array(await exeFile.arrayBuffer());
  const autorun = new TextEncoder().encode('[autorun]\r\nopen=WINWEB.EXE\r\nicon=WINWEB.EXE\r\nlabel=WinWeb Application\r\n');
  const readme = new TextEncoder().encode(`WinWeb virtual application disc\r\nOriginal file: ${exeFile.name}\r\nRun WINWEB.EXE if AutoRun does not start it automatically.\r\n`);
  const image = generateIso([
    { name: 'WINWEB.EXE', contents: exe },
    { name: 'AUTORUN.INF', contents: autorun },
    { name: 'README.TXT', contents: readme },
  ]);
  log(`Application CD created (${(image.byteLength / 1048576).toFixed(1)} MB)`);
  return image.buffer.slice(image.byteOffset, image.byteOffset + image.byteLength);
}

async function bootPc({ osFile, exeFile, memoryMB }) {
  if (!(osFile instanceof File)) throw new Error('Choose a Windows, ReactOS, or other x86 PC disk image first.');
  failed = false;
  clearStartupTimer();
  showLoading();
  setProgress(5, 'Preparing PC', 'Starting the custom WinWeb v86 runtime.');
  if (emulator) {
    try { await emulator.stop(); } catch (_) {}
    emulator = null;
  }

  await ensureEngine();
  const ram = Math.max(32, Math.min(256, Number(memoryMB) || 96));
  const kind = fileKind(osFile);
  let appCd = null;
  if (exeFile && kind === 'hda') appCd = await buildApplicationCd(exeFile);
  else if (exeFile && kind === 'cdrom') log('The selected OS image already occupies the CD drive; EXE auto-mount is skipped for this boot. Use a preinstalled disk image to mount an EXE automatically.', 'warn');

  setProgress(24, 'Creating x86 PC', `Using ${ram} MB RAM and ${osFile.name}.`);
  setPill('Starting');
  subtitle.textContent = `${osFile.name} · ${ram} MB RAM · WinWeb v86`;
  log(`Boot media: ${osFile.name} (${(osFile.size / 1048576).toFixed(1)} MB)`);
  log(`Memory profile: ${ram} MB`);
  log('Disk access is lazy: large local images are read in slices instead of copied into iPhone RAM.');

  const options = {
    wasm_path: `./engines/v86-vm/v86.wasm?v=${BUILD}`,
    winweb_wasm_timeout_ms: 20000,
    memory_size: ram * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    screen_container: screen,
    bios: { url: `./engines/v86-vm/bios/seabios.bin?v=${BUILD}` },
    vga_bios: { url: `./engines/v86-vm/bios/vgabios.bin?v=${BUILD}` },
    disable_speaker: false,
    autostart: true,
  };

  // Passing File with async:true uses v86's AsyncFileBuffer. That is critical on
  // iPhone: a 500 MB/1 GB Windows disk is not eagerly copied into JavaScript RAM.
  options[kind] = { buffer: osFile, async: true };
  if (appCd) options.cdrom = { buffer: appCd };

  emulator = new V86Ctor(options);
  window.emulator = emulator;

  emulator.add_listener('winweb-wasm-progress', info => {
    if (!info) return;
    const total = Number(info.total || 0);
    const loaded = Number(info.loaded || 0);
    const ratio = total > 0 ? loaded / total : 0;
    const p = 8 + Math.round(Math.max(0, Math.min(1, ratio)) * 14);
    const amount = total > 0 ? `${(loaded / 1048576).toFixed(1)} / ${(total / 1048576).toFixed(1)} MB` : `${(loaded / 1048576).toFixed(1)} MB`;
    setProgress(p, 'Loading WinWeb v86', `Downloading x86 core… ${amount}`);
  });
  emulator.add_listener('winweb-wasm-phase', info => {
    const phase = String(info?.phase || 'unknown');
    const mode = String(info?.mode || 'primary');
    log(`WASM ${phase} (${mode})${info?.bytes ? ` · ${(Number(info.bytes) / 1048576).toFixed(1)} MB` : ''}`);
    if (phase === 'compile') setProgress(22, 'Compiling x86 core', 'Safari is instantiating the v86 WebAssembly engine.');
    if (phase === 'ready') setProgress(25, 'x86 core ready', 'Loading PC firmware and local boot media.');
  });
  emulator.add_listener('emulator-error', info => {
    fail(info?.message || String(info || 'WinWeb v86 failed to start.'));
  });
  emulator.add_listener('download-progress', info => {
    if (!info || !info.total || String(info.file_name || '').includes('v86.wasm')) return;
    const p = 25 + Math.round((info.loaded / info.total) * 20);
    setProgress(p, 'Loading PC firmware', info.file_name || 'Loading v86 asset…');
  });
  emulator.add_listener('emulator-loaded', () => {
    setProgress(52, 'PC initialized', 'Starting the virtual x86 CPU and devices.');
    log('Emulator loaded');
  });
  emulator.add_listener('emulator-ready', () => {
    clearStartupTimer();
    setProgress(72, 'Booting PC', 'SeaBIOS has control. Waiting for the guest operating system.');
    setPill('Booting');
    log('Emulator ready; guest boot started');
    screen.focus();
    send('winweb-v86-booting', { osName: osFile.name });
  });
  emulator.add_listener('emulator-started', () => {
    clearStartupTimer();
    setPill('Running', 'ready');
    setProgress(100, 'PC running', appCd ? 'Windows can open WINWEB.EXE from the virtual CD drive.' : 'The x86 guest is running.');
    setTimeout(() => boot.classList.add('done'), 650);
    log('Virtual CPU running');
    send('winweb-v86-running', { osName: osFile.name });
  });
  emulator.add_listener('emulator-stopped', () => {
    setPill('Stopped');
    log('Virtual CPU stopped', 'warn');
  });
  emulator.add_listener('screen-set-size', args => {
    const width = Array.isArray(args) ? args[0] : 0;
    const height = Array.isArray(args) ? args[1] : 0;
    log(`Guest display ${width}×${height}`);
    setTimeout(() => fitScreen(width, height), 0);
  });

  // A bad core/BIOS path must never leave the iPhone staring at a spinner. The
  // custom WASM loader has its own 20s deadline; this wider watchdog also covers
  // firmware/device initialization before emulator-ready.
  startupTimer = setTimeout(() => {
    try { emulator?.stop(); } catch (_) {}
    fail('WinWeb v86 did not reach emulator-ready within 30 seconds. The runtime log below shows the last completed startup phase.');
  }, 30000);
}

if (osInput) {
  osInput.addEventListener('change', () => {
    selectedOs = osInput.files?.[0] || null;
    osName.textContent = selectedOs ? `${selectedOs.name} · ${(selectedOs.size / 1048576).toFixed(1)} MB` : 'Choose .img, .vhd, .raw, .iso or compatible disk';
    refreshStartButton();
  });
}
if (exeInput) {
  exeInput.addEventListener('change', () => {
    selectedExe = exeInput.files?.[0] || null;
    exeName.textContent = selectedExe ? `${selectedExe.name} · ${(selectedExe.size / 1048576).toFixed(1)} MB` : 'Optional · mounted locally as WINWEB.EXE';
  });
}
if (startButton) {
  startButton.addEventListener('click', () => {
    bootPc({ osFile: selectedOs, exeFile: selectedExe, memoryMB: memorySelect?.value || 96 }).catch(error => fail(error?.message || String(error)));
  });
}
if (retryButton) {
  retryButton.addEventListener('click', async () => {
    clearStartupTimer();
    if (emulator) {
      try { await emulator.stop(); } catch (_) {}
      emulator = null;
    }
    failed = false;
    subtitle.textContent = 'Custom v86 · local x86 machine';
    showSetup('Runtime reset. Choose a boot image and try again.');
  });
}

addEventListener('message', event => {
  if (event.origin !== location.origin || !event.data || event.data.type !== 'winweb-v86-boot') return;
  bootPc(event.data).catch(error => fail(error?.message || String(error)));
});

addEventListener('error', event => fail(event.message || 'Unexpected v86 page error.'));
addEventListener('unhandledrejection', event => fail(event.reason?.message || String(event.reason || 'Unhandled v86 error.')));
addEventListener('resize', () => {
  const canvas = screen.querySelector('canvas');
  if (canvas && canvas.width && canvas.height) fitScreen(canvas.width, canvas.height);
});

if (STANDALONE) {
  showSetup('Preparing the secure local runtime…');
  ensureStandaloneRuntime().catch(error => {
    log(`Runtime preparation warning: ${error?.message || error}`, 'warn');
    setupStatus.textContent = 'Local runtime ready with reduced browser isolation';
    setPill('Ready', 'ready');
    refreshStartButton();
  });
} else {
  setup.hidden = true;
  loading.hidden = false;
  setProgress(4, 'Preparing PC', 'Waiting for a Windows disk image from WinWeb.');
  setPill('Waiting');
  log('Embedded WinWeb custom v86 host ready');
  send('winweb-v86-ready');
}
