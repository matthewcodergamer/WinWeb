import type {
  AppCompatibilityProfile,
  CpuArchitecture,
  EngineCandidate,
  EngineId,
  RuntimeCapabilities,
  StoredAppRecord
} from '../core/types';
import { inspectPortableExecutable } from '../core/pe';
import { routeApplication } from '../core/router';
import { AppStorage } from '../core/storage';

type ArchitecturePreference = 'auto' | Exclude<CpuArchitecture, 'unknown'>;
type RuntimePreference = 'auto' | EngineId;
type ImportMode = 'auto' | 'portable' | 'installer';

const PREF_KEY = 'winweb.import-preferences.v1';

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;'
  }[char] ?? char));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function windowMark(extra = '') {
  return `<span class="window-mark ${extra}" aria-hidden="true"><i></i><i></i><i></i><i></i><b></b></span>`;
}

function capPill(label: string, value: boolean | string) {
  const on = value === true || value === 'supported';
  const unknown = value === 'unknown';
  return `<span class="cap-pill ${on ? 'on' : unknown ? 'unknown' : 'off'}"><i></i><span>${escapeHtml(label)}</span><b>${typeof value === 'string' ? value : on ? 'Ready' : 'Off'}</b></span>`;
}

function engineCard(engine: EngineCandidate, recommended: boolean, selected = false) {
  return `<article class="engine-card ${recommended ? 'recommended' : ''} ${selected ? 'selected' : ''}">
    <div class="engine-card-top"><span class="engine-dot"></span><strong>${escapeHtml(engine.name)}</strong>${selected ? '<em>Selected</em>' : recommended ? '<em>Recommended</em>' : ''}</div>
    <p>${escapeHtml(engine.reason)}</p>
    <div class="engine-meta"><span>Priority ${engine.priority}</span><span>${engine.availableNow ? 'Integrated' : 'Compatibility route'}</span></div>
  </article>`;
}

export class WinWebApp {
  private readonly storage = new AppStorage();
  private selectedProfile: AppCompatibilityProfile | null = null;
  private selectedFile: File | null = null;
  private busy = false;
  private architecturePreference: ArchitecturePreference = 'auto';
  private runtimePreference: RuntimePreference = 'auto';
  private importMode: ImportMode = 'auto';

  constructor(private readonly root: HTMLElement, private readonly caps: RuntimeCapabilities) {
    this.loadPreferences();
  }

  mount() { this.renderHome(); }

  private loadPreferences() {
    try {
      const value = localStorage.getItem(PREF_KEY);
      if (!value) return;
      const parsed = JSON.parse(value) as Partial<{ architecture: ArchitecturePreference; runtime: RuntimePreference; mode: ImportMode }>;
      if (parsed.architecture) this.architecturePreference = parsed.architecture;
      if (parsed.runtime) this.runtimePreference = parsed.runtime;
      if (parsed.mode) this.importMode = parsed.mode;
    } catch { /* preferences are optional */ }
  }

  private savePreferences() {
    try {
      localStorage.setItem(PREF_KEY, JSON.stringify({
        architecture: this.architecturePreference,
        runtime: this.runtimePreference,
        mode: this.importMode
      }));
    } catch { /* preferences are optional */ }
  }

  private shell(content: string, active: 'home' | 'apps' | 'runtime' | 'about' = 'home') {
    return `<div class="desktop-backdrop"><div class="app-window">
      <header class="titlebar">
        <a class="brand" href="#" data-action="home">${windowMark('small')}<span><strong>WinWeb</strong><small>Windows runtime for the web</small></span></a>
        <div class="titlebar-actions"><span class="privacy-chip"><i></i>Local-first</span><button class="title-button" data-action="runtime" aria-label="Runtime status">•••</button></div>
      </header>
      <div class="window-body">
        <aside class="side-nav">
          <div class="nav-group">
            <button class="${active === 'home' ? 'active' : ''}" data-action="home"><span>⌂</span><b>Home</b></button>
            <button class="${active === 'apps' ? 'active' : ''}" data-action="apps"><span>▦</span><b>My apps</b></button>
            <button class="${active === 'runtime' ? 'active' : ''}" data-action="runtime"><span>◫</span><b>Runtime</b></button>
            <button class="${active === 'about' ? 'active' : ''}" data-action="about"><span>ⓘ</span><b>About</b></button>
          </div>
          <div class="nav-foot"><small>WinWeb V0.1</small><span>${this.caps.webGpu ? 'WebGPU ready' : 'WebGPU unavailable'}</span></div>
        </aside>
        <main>${content}</main>
      </div>
      <nav class="bottom-nav">
        <button class="${active === 'home' ? 'active' : ''}" data-action="home"><span>⌂</span>Home</button>
        <button class="${active === 'apps' ? 'active' : ''}" data-action="apps"><span>▦</span>Apps</button>
        <button class="add-orb" data-action="pick" aria-label="Add Windows app"><span>＋</span></button>
        <button class="${active === 'runtime' ? 'active' : ''}" data-action="runtime"><span>◫</span>Runtime</button>
        <button class="${active === 'about' ? 'active' : ''}" data-action="about"><span>ⓘ</span>About</button>
      </nav>
      <input id="exe-picker" type="file" accept=".exe,.com,.scr" hidden />
    </div></div>`;
  }

  private bindCommon() {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((element) => {
      element.addEventListener('click', (event) => {
        event.preventDefault();
        switch (element.dataset.action) {
          case 'home': this.renderHome(); break;
          case 'apps': this.renderApps(); break;
          case 'runtime': this.renderRuntime(); break;
          case 'about': this.renderAbout(); break;
          case 'pick': this.openPicker(); break;
        }
      });
    });

    this.root.querySelector<HTMLInputElement>('#exe-picker')?.addEventListener('change', (event) => {
      const file = (event.currentTarget as HTMLInputElement).files?.[0];
      if (file) void this.analyzeFile(file);
    });

    const arch = this.root.querySelector<HTMLSelectElement>('#architecture-select');
    arch?.addEventListener('change', () => {
      this.architecturePreference = arch.value as ArchitecturePreference;
      this.savePreferences();
    });
    const runtime = this.root.querySelector<HTMLSelectElement>('#runtime-select');
    runtime?.addEventListener('change', () => {
      this.runtimePreference = runtime.value as RuntimePreference;
      this.savePreferences();
    });
    const mode = this.root.querySelector<HTMLSelectElement>('#mode-select');
    mode?.addEventListener('change', () => {
      this.importMode = mode.value as ImportMode;
      this.savePreferences();
    });

    const zone = this.root.querySelector<HTMLElement>('.upload-zone');
    if (zone) {
      const over = (event: DragEvent) => { event.preventDefault(); zone.classList.add('dragging'); };
      zone.addEventListener('dragenter', over);
      zone.addEventListener('dragover', over);
      zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
      zone.addEventListener('drop', (event) => {
        event.preventDefault();
        zone.classList.remove('dragging');
        const file = event.dataTransfer?.files?.[0];
        if (file) void this.analyzeFile(file);
      });
    }
  }

  private openPicker() { this.root.querySelector<HTMLInputElement>('#exe-picker')?.click(); }

  private option(value: string, current: string, label: string) {
    return `<option value="${value}" ${value === current ? 'selected' : ''}>${label}</option>`;
  }

  private importControls() {
    return `<div class="import-options">
      <label><span>Architecture</span><div class="select-wrap"><select id="architecture-select">
        ${this.option('auto', this.architecturePreference, 'Auto-detect (recommended)')}
        ${this.option('x86', this.architecturePreference, 'x86 · 32-bit')}
        ${this.option('x64', this.architecturePreference, 'x64 · 64-bit')}
        ${this.option('arm', this.architecturePreference, 'ARM · 32-bit')}
        ${this.option('arm64', this.architecturePreference, 'ARM64 · 64-bit')}
      </select></div></label>
      <label><span>Runtime engine</span><div class="select-wrap"><select id="runtime-select">
        ${this.option('auto', this.runtimePreference, 'Auto-route (recommended)')}
        ${this.option('bottleship-hle', this.runtimePreference, 'HLE Fast · BottleShip/v86')}
        ${this.option('wine32', this.runtimePreference, 'Wine32 compatibility')}
        ${this.option('wine64-experimental', this.runtimePreference, 'Wine64 experimental')}
        ${this.option('code-oss-adapter', this.runtimePreference, 'Optimized web adapter')}
      </select></div></label>
      <label><span>App type</span><div class="select-wrap"><select id="mode-select">
        ${this.option('auto', this.importMode, 'Auto-detect')}
        ${this.option('portable', this.importMode, 'Portable executable')}
        ${this.option('installer', this.importMode, 'Installer / setup')}
      </select></div></label>
    </div>`;
  }

  private renderHome() {
    const apps = this.storage.list().slice(0, 6);
    const ready = [this.caps.webAssembly, this.caps.webGpu, this.caps.opfs, this.caps.audioWorklet].filter(Boolean).length;
    const content = `<section class="home-head">
      <div><span class="overline">WINWEB</span><h1>Open a Windows app.</h1><p>Select an EXE and WinWeb will inspect it locally, detect whether it is 32-bit or 64-bit, then route it toward the best browser runtime.</p></div>
      <div class="readiness"><span>${ready}/4</span><small>core browser layers ready</small></div>
    </section>
    <section class="open-panel">
      <button class="upload-zone" data-action="pick">
        <span class="upload-icon">${windowMark('hero-mark')}<b>＋</b></span>
        <span class="upload-copy"><strong>Select a Windows executable</strong><small>Tap to browse, or drag and drop an .exe file on desktop.</small></span>
        <span class="browse-button">Browse EXE</span>
      </button>
      ${this.importControls()}
      <div class="import-foot"><span><i></i>Your file stays on this device</span><button data-action="runtime">View browser capabilities</button></div>
    </section>
    <section class="section-block">
      <div class="section-heading"><div><span>System</span><h2>Runtime readiness</h2></div><button data-action="runtime">Details</button></div>
      <div class="mini-caps">${capPill('WebAssembly', this.caps.webAssembly)}${capPill('WebGPU', this.caps.webGpu)}${capPill('Threads', this.caps.wasmThreads)}${capPill('OPFS', this.caps.opfs)}</div>
    </section>
    <section class="section-block">
      <div class="section-heading"><div><span>Library</span><h2>${apps.length ? 'Recent apps' : 'No apps yet'}</h2></div>${apps.length ? '<button data-action="apps">See all</button>' : ''}</div>
      ${apps.length ? `<div class="app-row">${apps.map((app) => this.appTile(app)).join('')}</div>` : `<div class="empty-recent"><span>▦</span><div><strong>Your app library is empty</strong><small>Imported executables will appear here for quick access.</small></div><button class="quiet-button" data-action="pick">Add app</button></div>`}
    </section>`;
    this.root.innerHTML = this.shell(content, 'home');
    this.bindCommon();
  }

  private appTile(app: StoredAppRecord) {
    return `<button class="app-tile"><span class="file-icon">${escapeHtml(app.name.slice(0, 1).toUpperCase())}</span><span><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.profile.architecture.toUpperCase())} · ${escapeHtml(app.status)}</small></span><b>›</b></button>`;
  }

  private async analyzeFile(file: File) {
    if (this.busy) return;
    if (!/\.(exe|com|scr)$/i.test(file.name)) {
      this.renderError('Choose a Windows .exe, .com, or .scr file.');
      return;
    }
    this.busy = true;
    this.selectedFile = file;
    this.root.innerHTML = this.shell(`<section class="loading-state"><div class="loader-ring"></div><span>Inspecting locally</span><h2>${escapeHtml(file.name)}</h2><p>Reading PE headers, imports, architecture and runtime signals without uploading your file.</p></section>`);
    this.bindCommon();
    try {
      this.selectedProfile = await inspectPortableExecutable(file);
      this.renderAnalysis();
    } catch (error) {
      this.renderError(error instanceof Error ? error.message : String(error));
    } finally {
      this.busy = false;
    }
  }

  private renderAnalysis() {
    const profile = this.selectedProfile;
    const file = this.selectedFile;
    if (!profile || !file) return this.renderHome();
    const route = routeApplication(profile, this.caps);
    const archMismatch = this.architecturePreference !== 'auto' && this.architecturePreference !== profile.architecture;
    const forced = this.runtimePreference === 'auto' ? null : route.candidates.find((item) => item.engineId === this.runtimePreference) ?? null;
    const runtimeMismatch = this.runtimePreference !== 'auto' && !forced;
    const chosen = forced ?? route.recommended;
    const flags = [profile.isDotNet && '.NET', profile.isElectronLike && 'Electron-like', profile.isVsCodeLike && 'VS Code', profile.installer !== 'portable-or-unknown' && profile.installer.toUpperCase()].filter(Boolean);

    const content = `<section class="analysis-page">
      <button class="back-link" data-action="home">← Back</button>
      <div class="file-summary"><span class="file-icon large">${escapeHtml(file.name.slice(0, 1).toUpperCase())}</span><div><span class="overline">LOCAL PE ANALYSIS</span><h1>${escapeHtml(file.name)}</h1><p>${formatBytes(file.size)} · ${escapeHtml(profile.peKind)} · ${escapeHtml(profile.subsystem)}</p></div><span class="arch-badge">${escapeHtml(profile.architecture.toUpperCase())}</span></div>
      <div class="preference-summary"><div><small>Architecture preference</small><strong>${this.architecturePreference === 'auto' ? 'Auto-detect' : escapeHtml(this.architecturePreference.toUpperCase())}</strong></div><div><small>Runtime preference</small><strong>${this.runtimePreference === 'auto' ? 'Auto-route' : escapeHtml(this.runtimePreference)}</strong></div><div><small>App type</small><strong>${escapeHtml(this.importMode)}</strong></div></div>
      ${archMismatch ? `<div class="warning-panel"><strong>Architecture mismatch</strong><p>This executable is ${escapeHtml(profile.architecture.toUpperCase())}, but the override is ${escapeHtml(this.architecturePreference.toUpperCase())}. Use Auto or the detected architecture.</p></div>` : ''}
      ${runtimeMismatch ? `<div class="warning-panel"><strong>Runtime mismatch</strong><p>The selected runtime is not a valid candidate for this executable. Auto-route is recommended.</p></div>` : ''}
      <div class="analysis-grid">
        <article class="panel"><span>Executable</span><dl><div><dt>Architecture</dt><dd>${escapeHtml(profile.architecture)}</dd></div><div><dt>Image base</dt><dd>${escapeHtml(profile.imageBase)}</dd></div><div><dt>Entry point</dt><dd>0x${profile.entryPoint.toString(16)}</dd></div><div><dt>Sections</dt><dd>${profile.numberOfSections}</dd></div></dl></article>
        <article class="panel"><span>Signals</span><div class="tag-cloud">${flags.length ? flags.map((flag) => `<b>${escapeHtml(String(flag))}</b>`).join('') : '<b>Native Win32</b>'}${profile.graphicsApis.map((api) => `<b>${escapeHtml(api)}</b>`).join('')}${profile.audioApis.map((api) => `<b>${escapeHtml(api)}</b>`).join('')}</div><p class="muted">${profile.importDlls.length} imported DLL${profile.importDlls.length === 1 ? '' : 's'} detected.</p></article>
      </div>
      ${profile.blockers.length ? `<div class="warning-panel"><strong>Runtime blocker</strong>${profile.blockers.map((blocker) => `<p>${escapeHtml(blocker)}</p>`).join('')}</div>` : ''}
      ${profile.notes.length ? `<div class="note-strip">${profile.notes.map((note) => `<span>${escapeHtml(note)}</span>`).join('')}</div>` : ''}
      <section class="section-block route-section"><div class="section-heading"><div><span>Runtime router</span><h2>${chosen ? `${forced ? 'Selected' : 'Recommended'}: ${escapeHtml(chosen.name)}` : 'No compatible route yet'}</h2></div></div><div class="engine-list">${route.candidates.length ? route.candidates.map((engine) => engineCard(engine, engine === route.recommended, forced?.engineId === engine.engineId)).join('') : '<p class="empty-copy">This executable does not currently match a safe runtime path.</p>'}</div></section>
      <div class="analysis-actions"><button class="secondary" data-action="home">Cancel</button><button class="primary" id="save-app" ${chosen && !archMismatch && !runtimeMismatch ? '' : 'disabled'}>Save to WinWeb <b>→</b></button></div>
    </section>`;
    this.root.innerHTML = this.shell(content);
    this.bindCommon();
    this.root.querySelector('#save-app')?.addEventListener('click', () => void this.saveCurrentApp(chosen?.engineId ?? null));
  }

  private async saveCurrentApp(engineId: StoredAppRecord['selectedEngine']) {
    if (!this.selectedProfile || !this.selectedFile) return;
    const now = new Date().toISOString();
    const record: StoredAppRecord = {
      id: this.selectedProfile.id,
      name: this.selectedFile.name.replace(/\.exe$/i, ''),
      originalFileName: this.selectedFile.name,
      fileSize: this.selectedFile.size,
      importedAt: now,
      updatedAt: now,
      profile: this.selectedProfile,
      selectedEngine: engineId,
      status: 'Analyzed',
      sourceStored: false
    };
    const button = this.root.querySelector<HTMLButtonElement>('#save-app');
    if (button) { button.disabled = true; button.textContent = 'Saving locally…'; }
    this.renderSaved(await this.storage.importSource(record, this.selectedFile));
  }

  private renderSaved(record: StoredAppRecord) {
    this.root.innerHTML = this.shell(`<section class="success-page"><div class="success-mark">✓</div><span>APP CONTAINER CREATED</span><h1>${escapeHtml(record.name)} is in WinWeb.</h1><p>${record.sourceStored ? 'The executable was saved in OPFS on this device.' : 'The app record was saved, but this browser did not expose OPFS for binary persistence.'}</p><div class="success-card"><div><small>Engine</small><strong>${escapeHtml(record.selectedEngine ?? 'Unassigned')}</strong></div><div><small>Status</small><strong>${record.status}</strong></div><div><small>Architecture</small><strong>${record.profile.architecture.toUpperCase()}</strong></div></div><div class="hero-actions"><button class="primary" data-action="apps">Open library</button><button class="secondary" data-action="pick">Add another</button></div></section>`, 'apps');
    this.bindCommon();
  }

  private renderApps() {
    const apps = this.storage.list();
    const content = `<section class="page-head"><span>MY APPS</span><h1>Windows app library</h1><p>Imported app records and, where OPFS is available, their executable files remain stored locally on this device.</p></section><section class="library-grid">${apps.length ? apps.map((app) => `<article class="library-card"><span class="file-icon">${escapeHtml(app.name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.profile.architecture.toUpperCase())} · ${escapeHtml(app.selectedEngine ?? 'No engine')}</small></div><em>${app.sourceStored ? 'Binary saved' : 'Metadata only'}</em><button data-remove="${escapeHtml(app.id)}">Remove</button></article>`).join('') : '<div class="empty-library"><span>▦</span><h2>No app containers yet</h2><p>Add an EXE to create your first local WinWeb container.</p><button class="primary" data-action="pick">Add Windows App</button></div>'}</section>`;
    this.root.innerHTML = this.shell(content, 'apps');
    this.bindCommon();
    this.root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => button.addEventListener('click', async () => {
      await this.storage.remove(button.dataset.remove!);
      this.renderApps();
    }));
  }

  private renderRuntime() {
    const caps = this.caps;
    const content = `<section class="page-head"><span>RUNTIME</span><h1>Browser capability probe</h1><p>WinWeb chooses execution paths from measured browser capabilities, not browser-name promises.</p></section><section class="capability-grid">${capPill('WebAssembly', caps.webAssembly)}${capPill('Wasm SIMD', caps.wasmSimd)}${capPill('Wasm threads', caps.wasmThreads)}${capPill('SharedArrayBuffer', caps.sharedArrayBuffer)}${capPill('Cross-origin isolated', caps.crossOriginIsolated)}${capPill('WebGPU', caps.webGpu)}${capPill('WebGL2', caps.webGl2)}${capPill('OffscreenCanvas', caps.offscreenCanvas)}${capPill('AudioWorklet', caps.audioWorklet)}${capPill('OPFS', caps.opfs)}${capPill('File System Access', caps.fileSystemAccess)}${capPill('WebTransport', caps.webTransport)}${capPill('WebRTC', caps.webRtc)}${capPill('Memory64', caps.memory64)}</section><section class="section-block"><div class="section-heading"><div><span>Engines</span><h2>Execution paths</h2></div></div><div class="engine-list">${engineCard({ engineId:'bottleship-hle', name:'BottleShip/v86 HLE', priority:90, status:'Untested', reason:'Primary 32-bit HLE path. Worker-only upstream bundle is reproducibly built in WinWeb; runtime device proof is still required before launch is claimed.', availableNow:false }, false)}${engineCard({ engineId:'wine32', name:'Wine32 compatibility', priority:70, status:'Untested', reason:'Broader Win32 compatibility fallback behind the same runtime boundary.', availableNow:false }, false)}${engineCard({ engineId:'wine64-experimental', name:'Boxedwine64 / Wine64', priority:60, status:'Untested', reason:`Experimental x64 path. Memory64 probe: ${caps.memory64}.`, availableNow:false }, false)}</div></section>`;
    this.root.innerHTML = this.shell(content, 'runtime');
    this.bindCommon();
  }

  private renderAbout() {
    this.root.innerHTML = this.shell(`<section class="page-head"><span>ABOUT</span><h1>WinWeb</h1><p>A browser-native Windows application runtime built around interchangeable execution engines instead of one monolithic emulator.</p></section><section class="about-copy"><article><h2>Local-first importer</h2><p>PE inspection, architecture detection, runtime routing and app persistence happen locally in your browser.</p></article><article><h2>Reuse-first runtime</h2><p>BottleShip/v86 is pinned as the fast x86 HLE base, with separate Wine32, Wine64 research and optimized web-adapter paths.</p></article></section>`, 'about');
    this.bindCommon();
  }

  private renderError(message: string) {
    this.root.innerHTML = this.shell(`<section class="error-page"><span>!</span><h1>WinWeb couldn't inspect that file.</h1><p>${escapeHtml(message)}</p><button class="primary" data-action="pick">Choose another EXE</button></section>`);
    this.bindCommon();
  }
}
