import type { AppCompatibilityProfile, EngineCandidate, RuntimeCapabilities, StoredAppRecord } from '../core/types';
import { inspectPortableExecutable } from '../core/pe';
import { routeApplication } from '../core/router';
import { AppStorage } from '../core/storage';

function escapeHtml(value: string) {
  return value.replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '\"': '&quot;' }[char] ?? char));
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit++; }
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[unit]}`;
}

function capPill(label: string, value: boolean | string) {
  const on = value === true || value === 'supported';
  const unknown = value === 'unknown';
  return `<span class="cap-pill ${on ? 'on' : unknown ? 'unknown' : 'off'}"><i></i>${escapeHtml(label)}<b>${typeof value === 'string' ? value : on ? 'Ready' : 'Off'}</b></span>`;
}

function engineCard(engine: EngineCandidate, recommended: boolean) {
  return `<article class="engine-card ${recommended ? 'recommended' : ''}">
    <div class="engine-card-top"><span class="engine-dot"></span><strong>${escapeHtml(engine.name)}</strong>${recommended ? '<em>Recommended</em>' : ''}</div>
    <p>${escapeHtml(engine.reason)}</p>
    <div class="engine-meta"><span>Priority ${engine.priority}</span><span>${engine.availableNow ? 'Integrated' : 'Adapter only'}</span></div>
  </article>`;
}

export class WinWebApp {
  private readonly storage = new AppStorage();
  private selectedProfile: AppCompatibilityProfile | null = null;
  private selectedFile: File | null = null;
  private busy = false;

  constructor(private readonly root: HTMLElement, private readonly caps: RuntimeCapabilities) {}

  mount() { this.renderHome(); }

  private shell(content: string, active: 'home' | 'apps' | 'runtime' = 'home') {
    return `<div class="app-shell">
      <header class="topbar">
        <a class="brand" href="#" data-action="home" aria-label="WinWeb home"><span class="brand-mark">W</span><span><strong>WinWeb</strong><small>XRun runtime lab</small></span></a>
        <div class="top-actions"><span class="privacy-chip">Local-first</span><button class="icon-button" data-action="runtime" aria-label="Runtime status">⋯</button></div>
      </header>
      <main>${content}</main>
      <nav class="bottom-nav" aria-label="Primary">
        <button class="${active === 'home' ? 'active' : ''}" data-action="home"><span>⌂</span>Home</button>
        <button class="${active === 'apps' ? 'active' : ''}" data-action="apps"><span>▦</span>Apps</button>
        <button class="add-orb" data-action="pick"><span>＋</span></button>
        <button class="${active === 'runtime' ? 'active' : ''}" data-action="runtime"><span>◫</span>Runtime</button>
        <button data-action="about"><span>◇</span>About</button>
      </nav>
      <input id="exe-picker" type="file" accept=".exe,.com,.scr" hidden />
    </div>`;
  }

  private bindCommon() {
    this.root.querySelectorAll<HTMLElement>('[data-action]').forEach((el) => {
      el.addEventListener('click', (event) => {
        event.preventDefault();
        const action = el.dataset.action;
        if (action === 'home') this.renderHome();
        if (action === 'apps') this.renderApps();
        if (action === 'runtime') this.renderRuntime();
        if (action === 'about') this.renderAbout();
        if (action === 'pick') this.openPicker();
      });
    });
    const picker = this.root.querySelector<HTMLInputElement>('#exe-picker');
    picker?.addEventListener('change', () => {
      const file = picker.files?.[0];
      if (file) void this.analyzeFile(file);
    });
  }

  private openPicker() { this.root.querySelector<HTMLInputElement>('#exe-picker')?.click(); }

  private renderHome() {
    const apps = this.storage.list().slice(0, 4);
    const readyCount = [this.caps.webAssembly, this.caps.webGpu, this.caps.opfs, this.caps.audioWorklet].filter(Boolean).length;
    const content = `<section class="hero">
      <div class="eyebrow"><span></span>Windows apps, routed intelligently</div>
      <h1>Your Windows apps.<br><span>Without the Windows desktop.</span></h1>
      <p>Inspect an EXE locally, choose the best runtime path, and keep its app container on your device. WinWeb is building HLE, Wine, and optimized web adapters behind one mobile shell.</p>
      <div class="hero-actions"><button class="primary" data-action="pick">Add Windows App <b>＋</b></button><button class="secondary" data-action="runtime">Check runtime</button></div>
      <div class="trust-row"><span><i class="green"></i>File stays local</span><span><i></i>No Windows VM</span><span><i></i>Evidence-based compatibility</span></div>
    </section>

    <section class="status-ribbon">
      <div><small>Browser readiness</small><strong>${readyCount}/4 core layers</strong></div>
      <div class="mini-caps">${capPill('WebGPU', this.caps.webGpu)}${capPill('Threads', this.caps.wasmThreads)}${capPill('OPFS', this.caps.opfs)}</div>
    </section>

    <section class="section-block">
      <div class="section-heading"><div><span>Runtime paths</span><h2>One app, best engine.</h2></div><button data-action="runtime">View all</button></div>
      <div class="path-grid">
        <article class="path-card accent-green"><span class="path-icon">⚡</span><div><small>HLE FAST</small><h3>BottleShip + v86</h3><p>Win32 calls escape guest execution into browser-native implementations. Best first route for compatible x86 apps.</p></div><b>32-bit</b></article>
        <article class="path-card accent-blue"><span class="path-icon">◈</span><div><small>COMPATIBILITY</small><h3>Wine engines</h3><p>Broader API fallback using isolated Wine32 and experimental Wine64 adapters.</p></div><b>x86 / x64</b></article>
        <article class="path-card accent-violet"><span class="path-icon">⌁</span><div><small>OPTIMIZED</small><h3>Web adapters</h3><p>Known applications such as VS Code can bypass expensive Electron emulation when a native web route is better.</p></div><b>Smart route</b></article>
      </div>
    </section>

    <section class="section-block recent-section">
      <div class="section-heading"><div><span>Library</span><h2>${apps.length ? 'Recent apps' : 'Ready for your first EXE'}</h2></div>${apps.length ? '<button data-action="apps">See library</button>' : ''}</div>
      ${apps.length ? `<div class="app-row">${apps.map((app) => this.appTile(app)).join('')}</div>` : `<button class="drop-card" data-action="pick"><span class="drop-icon">＋</span><strong>Choose a Windows executable</strong><small>.exe files are inspected in your browser before any runtime is selected.</small></button>`}
    </section>`;
    this.root.innerHTML = this.shell(content, 'home');
    this.bindCommon();
  }

  private appTile(app: StoredAppRecord) {
    const arch = app.profile.architecture.toUpperCase();
    return `<button class="app-tile" data-app-id="${escapeHtml(app.id)}"><span class="file-icon">${escapeHtml(app.name.slice(0, 1).toUpperCase())}</span><strong>${escapeHtml(app.name)}</strong><small>${arch} · ${escapeHtml(app.status)}</small></button>`;
  }

  private async analyzeFile(file: File) {
    if (this.busy) return;
    this.busy = true;
    this.selectedFile = file;
    this.root.innerHTML = this.shell(`<section class="loading-state"><div class="loader-ring"></div><span>Inspecting locally</span><h2>${escapeHtml(file.name)}</h2><p>Reading PE headers and runtime signals without uploading your file.</p></section>`);
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
    const flags = [profile.isDotNet && '.NET', profile.isElectronLike && 'Electron-like', profile.installer !== 'portable-or-unknown' && profile.installer.toUpperCase()].filter(Boolean);
    const content = `<section class="analysis-page">
      <button class="back-link" data-action="home">← Home</button>
      <div class="file-summary">
        <span class="file-icon large">${escapeHtml(file.name.slice(0, 1).toUpperCase())}</span>
        <div><span class="overline">LOCAL PE ANALYSIS</span><h1>${escapeHtml(file.name)}</h1><p>${formatBytes(file.size)} · ${escapeHtml(profile.peKind)} · ${escapeHtml(profile.subsystem)}</p></div>
        <span class="arch-badge">${escapeHtml(profile.architecture.toUpperCase())}</span>
      </div>
      <div class="analysis-grid">
        <article class="panel"><span>Executable</span><dl><div><dt>Architecture</dt><dd>${escapeHtml(profile.architecture)}</dd></div><div><dt>Image base</dt><dd>${escapeHtml(profile.imageBase)}</dd></div><div><dt>Entry point</dt><dd>0x${profile.entryPoint.toString(16)}</dd></div><div><dt>Sections</dt><dd>${profile.numberOfSections}</dd></div></dl></article>
        <article class="panel"><span>Signals</span><div class="tag-cloud">${flags.length ? flags.map((f) => `<b>${escapeHtml(String(f))}</b>`).join('') : '<b>Native Win32</b>'}${profile.graphicsApis.map((g) => `<b>${escapeHtml(g)}</b>`).join('')}${profile.audioApis.map((a) => `<b>${escapeHtml(a)}</b>`).join('')}</div><p class="muted">${profile.importDlls.length} imported DLL${profile.importDlls.length === 1 ? '' : 's'} detected in the bounded probe.</p></article>
      </div>
      ${profile.blockers.length ? `<div class="warning-panel"><strong>Runtime blocker</strong>${profile.blockers.map((b) => `<p>${escapeHtml(b)}</p>`).join('')}</div>` : ''}
      ${profile.notes.length ? `<div class="note-strip">${profile.notes.map((n) => `<span>${escapeHtml(n)}</span>`).join('')}</div>` : ''}
      <section class="section-block route-section"><div class="section-heading"><div><span>Runtime router</span><h2>${route.recommended ? `Recommended: ${escapeHtml(route.recommended.name)}` : 'No compatible route yet'}</h2></div></div>
        <div class="engine-list">${route.candidates.length ? route.candidates.map((engine) => engineCard(engine, engine === route.recommended)).join('') : '<p class="empty-copy">This executable does not currently match a safe runtime path.</p>'}</div>
      </section>
      <div class="analysis-actions"><button class="secondary" data-action="home">Cancel</button><button class="primary" id="save-app" ${route.recommended ? '' : 'disabled'}>Save to WinWeb <b>→</b></button></div>
    </section>`;
    this.root.innerHTML = this.shell(content);
    this.bindCommon();
    this.root.querySelector('#save-app')?.addEventListener('click', () => void this.saveCurrentApp(route.recommended?.engineId ?? null));
  }

  private async saveCurrentApp(engineId: StoredAppRecord['selectedEngine']) {
    if (!this.selectedProfile || !this.selectedFile) return;
    const now = new Date().toISOString();
    const name = this.selectedFile.name.replace(/\.exe$/i, '');
    const record: StoredAppRecord = {
      id: this.selectedProfile.id,
      name,
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
    const stored = await this.storage.importSource(record, this.selectedFile);
    this.renderSaved(stored);
  }

  private renderSaved(record: StoredAppRecord) {
    const content = `<section class="success-page"><div class="success-mark">✓</div><span>APP CONTAINER CREATED</span><h1>${escapeHtml(record.name)} is in WinWeb.</h1><p>${record.sourceStored ? 'The original executable was persisted in OPFS on this device.' : 'App metadata was saved, but this browser did not expose OPFS for binary persistence.'}</p><div class="success-card"><div><small>Engine</small><strong>${escapeHtml(record.selectedEngine ?? 'Unassigned')}</strong></div><div><small>Status</small><strong>${record.status}</strong></div><div><small>Architecture</small><strong>${record.profile.architecture.toUpperCase()}</strong></div></div><div class="hero-actions"><button class="primary" data-action="apps">Open library</button><button class="secondary" data-action="pick">Add another</button></div><p class="honesty-note">Guest execution is not claimed yet: this foundation commit wires real inspection, routing and persistence while upstream runtime assets remain the next integration milestone.</p></section>`;
    this.root.innerHTML = this.shell(content, 'apps');
    this.bindCommon();
  }

  private renderApps() {
    const apps = this.storage.list();
    const content = `<section class="page-head"><span>APP LIBRARY</span><h1>Installed containers</h1><p>App records and, when OPFS is available, the original local binaries stay on this device.</p></section>
    <section class="library-grid">${apps.length ? apps.map((app) => `<article class="library-card"><span class="file-icon">${escapeHtml(app.name.slice(0, 1).toUpperCase())}</span><div><strong>${escapeHtml(app.name)}</strong><small>${escapeHtml(app.profile.architecture.toUpperCase())} · ${escapeHtml(app.selectedEngine ?? 'No engine')}</small></div><em>${app.sourceStored ? 'Binary saved' : 'Metadata only'}</em><button data-remove="${escapeHtml(app.id)}">Remove</button></article>`).join('') : '<div class="empty-library"><span>▦</span><h2>No app containers yet</h2><p>Add an EXE to create your first local WinWeb container.</p><button class="primary" data-action="pick">Add Windows App</button></div>'}</section>`;
    this.root.innerHTML = this.shell(content, 'apps');
    this.bindCommon();
    this.root.querySelectorAll<HTMLButtonElement>('[data-remove]').forEach((button) => button.addEventListener('click', async () => { await this.storage.remove(button.dataset.remove!); this.renderApps(); }));
  }

  private renderRuntime() {
    const caps = this.caps;
    const content = `<section class="page-head"><span>RUNTIME LAB</span><h1>Browser capability probe</h1><p>WinWeb routes engines from measured capabilities, not user-agent promises.</p></section>
      <section class="capability-grid">
        ${capPill('WebAssembly', caps.webAssembly)}${capPill('Wasm SIMD', caps.wasmSimd)}${capPill('Wasm threads', caps.wasmThreads)}${capPill('SharedArrayBuffer', caps.sharedArrayBuffer)}${capPill('Cross-origin isolated', caps.crossOriginIsolated)}${capPill('WebGPU', caps.webGpu)}${capPill('WebGL2', caps.webGl2)}${capPill('OffscreenCanvas', caps.offscreenCanvas)}${capPill('AudioWorklet', caps.audioWorklet)}${capPill('OPFS', caps.opfs)}${capPill('File System Access', caps.fileSystemAccess)}${capPill('WebTransport', caps.webTransport)}${capPill('WebRTC', caps.webRtc)}${capPill('Memory64', caps.memory64)}
      </section>
      <section class="section-block"><div class="section-heading"><div><span>Engines</span><h2>Integration state</h2></div></div><div class="engine-list">
        ${engineCard({ engineId:'bottleship-hle', name:'BottleShip/v86 HLE', priority:90, status:'Untested', reason:'Primary x86 HLE upstream. Adapter contract exists; runtime vendoring/build integration is next.', availableNow:false }, false)}
        ${engineCard({ engineId:'wine32', name:'Wine32 compatibility', priority:70, status:'Untested', reason:'Fallback compatibility engine kept isolated behind the same runtime API.', availableNow:false }, false)}
        ${engineCard({ engineId:'wine64-experimental', name:'Boxedwine64 / Wine64', priority:60, status:'Untested', reason:`Experimental x64 research path. Memory64 probe: ${caps.memory64}.`, availableNow:false }, false)}
      </div></section>`;
    this.root.innerHTML = this.shell(content, 'runtime');
    this.bindCommon();
  }

  private renderAbout() {
    const content = `<section class="page-head"><span>WINWEB V0.1</span><h1>Reuse first. Proof before claims.</h1><p>WinWeb is designed as a runtime router rather than one monolithic emulator. The repository tracks BottleShip/v86, Wine/BoxedWine, Boxedwine64 and browser-native adapters as interchangeable engines.</p></section><section class="about-copy"><article><h2>What works in this commit</h2><p>Mobile shell, real PE32/PE32+ inspection, architecture/runtime signal detection, local engine routing, OPFS app persistence, capability probing, licensing/upstream registry and CI/deployment scaffolding.</p></article><article><h2>What does not work yet</h2><p>WinWeb does not yet claim guest Windows execution. The HLE and Wine adapters deliberately report that upstream runtime assets are not integrated until we can reproduce execution and tests.</p></article></section>`;
    this.root.innerHTML = this.shell(content);
    this.bindCommon();
  }

  private renderError(message: string) {
    this.root.innerHTML = this.shell(`<section class="error-page"><span>!</span><h1>WinWeb couldn't inspect that file.</h1><p>${escapeHtml(message)}</p><button class="primary" data-action="pick">Choose another EXE</button></section>`);
    this.bindCommon();
  }
}
