const screen = document.getElementById('screen_container');
const boot = document.getElementById('vm-boot');
const bootTitle = document.getElementById('vm-boot-title');
const bootCopy = document.getElementById('vm-boot-copy');
const progress = document.getElementById('vm-progress');
const logNode = document.getElementById('vm-log');
const pill = document.getElementById('vm-pill');
const pillText = document.getElementById('vm-pill-text');
const subtitle = document.getElementById('vm-subtitle');

let emulator = null;
let V86Ctor = null;
let generateIso = null;
let rows = [];

function send(type, detail = {}) {
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
  if (rows.length > 80) rows.splice(0, rows.length - 80);
  logNode.textContent = rows.join('\n');
  logNode.scrollTop = logNode.scrollHeight;
  send('winweb-v86-log', { level, message });
}

function fail(message) {
  setPill('Error', 'error');
  setProgress(100, 'PC runtime error', message);
  log(message, 'error');
  send('winweb-v86-error', { message });
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
  setProgress(8, 'Loading v86', 'Loading the WinWeb-owned x86-to-Wasm engine.');
  log('Loading native v86 module');
  const engine = await import('./engines/v86-vm/libv86.mjs?v=20260906-vm1');
  V86Ctor = engine.V86 || engine.default;
  if (typeof V86Ctor !== 'function') throw new Error('The packaged v86 module did not export V86.');
  const iso = await import('./engines/v86-vm/iso9660.mjs?v=20260906-vm1');
  generateIso = iso.generate;
  if (typeof generateIso !== 'function') throw new Error('The v86 ISO generator is missing.');
  log('v86 JavaScript engine loaded');
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
  if (emulator) {
    try { emulator.stop(); } catch (_) {}
    emulator = null;
  }

  await ensureEngine();
  const ram = Math.max(32, Math.min(256, Number(memoryMB) || 96));
  const kind = fileKind(osFile);
  let appCd = null;
  if (exeFile && kind === 'hda') appCd = await buildApplicationCd(exeFile);
  else if (exeFile && kind === 'cdrom') log('The selected OS image already occupies the CD drive; EXE auto-mount is skipped for this boot.', 'warn');

  setProgress(24, 'Creating x86 PC', `Using ${ram} MB RAM and ${osFile.name}.`);
  setPill('Starting');
  subtitle.textContent = `${osFile.name} · ${ram} MB RAM`;
  log(`Boot media: ${osFile.name} (${(osFile.size / 1048576).toFixed(1)} MB)`);
  log(`Memory profile: ${ram} MB`);
  log('Disk access is lazy: large local images are read in slices instead of copied into iPhone RAM.');

  const options = {
    wasm_path: './engines/v86-vm/v86.wasm?v=20260906-vm1',
    memory_size: ram * 1024 * 1024,
    vga_memory_size: 8 * 1024 * 1024,
    screen_container: screen,
    bios: { url: './engines/v86-vm/bios/seabios.bin?v=20260906-vm1' },
    vga_bios: { url: './engines/v86-vm/bios/vgabios.bin?v=20260906-vm1' },
    disable_speaker: false,
    autostart: true,
  };

  // Passing File with async:true uses v86's AsyncFileBuffer. That is critical on
  // iPhone: a 500 MB/1 GB Windows disk is not eagerly copied into JavaScript RAM.
  options[kind] = { buffer: osFile, async: true };
  if (appCd) options.cdrom = { buffer: appCd };

  emulator = new V86Ctor(options);
  window.emulator = emulator;

  emulator.add_listener('download-progress', info => {
    if (!info || !info.total) return;
    const p = 25 + Math.round((info.loaded / info.total) * 20);
    setProgress(p, 'Loading PC firmware', info.file_name || 'Loading v86 asset…');
  });
  emulator.add_listener('emulator-loaded', () => {
    setProgress(52, 'PC initialized', 'Starting the virtual x86 CPU and devices.');
    log('Emulator loaded');
  });
  emulator.add_listener('emulator-ready', () => {
    setProgress(72, 'Booting PC', 'SeaBIOS has control. Waiting for the guest operating system.');
    setPill('Booting');
    log('Emulator ready; guest boot started');
    screen.focus();
    send('winweb-v86-booting', { osName: osFile.name });
  });
  emulator.add_listener('emulator-started', () => {
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

setPill('Ready', 'ready');
log('Native v86 host page ready');
send('winweb-v86-ready');
