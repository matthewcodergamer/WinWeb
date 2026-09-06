(function () {
  'use strict';

  var app = document.getElementById('app');
  if (!app) return;

  var STORE_KEY = 'winweb.shell.apps.v2';
  var state = {
    page: 'home',
    arch: 'auto',
    runtime: 'auto',
    type: 'auto',
    selectedFile: null,
    analysis: null,
    search: ''
  };

  var ua = navigator.userAgent || '';
  var isIOS = /iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  var isIPhone = /iPhone/i.test(ua);
  document.documentElement.classList.add(isIOS ? 'ww-ios' : 'ww-non-ios');
  if (isIPhone) document.documentElement.classList.add('ww-iphone');
  app.setAttribute('data-winweb-ready', 'true');

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (ch) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch];
    });
  }

  function icon(name, cls) {
    return '<img class="ww-icon ' + (cls || '') + '" src="./fluent/' + name + '.svg" alt="" aria-hidden="true">';
  }

  function logo(size) {
    return '<span class="ww-logo ' + (size || '') + '" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
  }

  function loadApps() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      var rows = raw ? JSON.parse(raw) : [];
      return Array.isArray(rows) ? rows : [];
    } catch (_) {
      return [];
    }
  }

  function saveApps(rows) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(rows)); } catch (_) {}
  }

  function fmtBytes(bytes) {
    var units = ['B','KB','MB','GB'];
    var value = Number(bytes || 0);
    var unit = 0;
    while (value >= 1024 && unit < units.length - 1) { value /= 1024; unit += 1; }
    return (unit === 0 ? value.toFixed(0) : value < 10 ? value.toFixed(2) : value < 100 ? value.toFixed(1) : value.toFixed(0)) + ' ' + units[unit];
  }

  function navButton(page, label, iconName) {
    return '<button type="button" class="ww-nav-item ' + (state.page === page ? 'active' : '') + '" data-page="' + page + '">' + icon(iconName) + '<span>' + label + '</span></button>';
  }

  function shell(content) {
    return '<div class="ww-desktop">' +
      '<section class="ww-window">' +
        '<header class="ww-titlebar">' +
          '<button type="button" class="ww-brand" data-page="home">' + logo('small') + '<span><strong>WinWeb</strong><small>Windows app runtime</small></span></button>' +
          '<div class="ww-title-actions"><span class="ww-local"><i></i>Local first</span><button type="button" class="ww-more" data-page="settings" aria-label="Settings">•••</button></div>' +
        '</header>' +
        '<div class="ww-body">' +
          '<aside class="ww-sidebar">' +
            '<div>' + navButton('home','Home','home') + navButton('apps','Apps','apps') + navButton('settings','Settings','settings') + '</div>' +
            '<div class="ww-sidebar-foot"><span>Smart memory</span><small>' + (isIPhone ? 'iPhone mode' : 'Automatic') + '</small></div>' +
          '</aside>' +
          '<main class="ww-main">' + content + '</main>' +
        '</div>' +
        '<nav class="ww-mobile-nav">' + navButton('home','Home','home') + '<button type="button" class="ww-nav-add" data-pick="1">' + logo('tiny') + '</button>' + navButton('apps','Apps','apps') + navButton('settings','Settings','settings') + '</nav>' +
      '</section>' +
      '<input id="ww-file" type="file" accept=".exe,.com,.scr" hidden>' +
    '</div>';
  }

  function selectBox(id, label, value, options) {
    var html = '<label class="ww-field"><span>' + label + '</span><div class="ww-select-wrap"><select id="' + id + '">';
    for (var i = 0; i < options.length; i++) {
      var row = options[i];
      html += '<option value="' + esc(row[0]) + '"' + (value === row[0] ? ' selected' : '') + '>' + esc(row[1]) + '</option>';
    }
    return html + '</select></div></label>';
  }

  function homePage() {
    var apps = loadApps().slice(0, 4);
    var recent = '';
    if (apps.length) {
      recent = '<div class="ww-recent-grid">' + apps.map(function (row) {
        return '<button type="button" class="ww-app-row" data-app="' + esc(row.id) + '"><span class="ww-file-tile">' + icon('document') + '</span><span><strong>' + esc(row.name) + '</strong><small>' + esc((row.arch || 'unknown').toUpperCase()) + ' · ' + esc(row.runtimeLabel || 'Auto route') + '</small></span><b>›</b></button>';
      }).join('') + '</div>';
    } else {
      recent = '<div class="ww-empty"><span class="ww-empty-icon">' + icon('document') + '</span><div><strong>No apps yet</strong><small>Choose an EXE to inspect it locally.</small></div><button type="button" class="ww-link" data-pick="1">Choose file</button></div>';
    }

    return '<section class="ww-page ww-home">' +
      '<div class="ww-heading"><div><span class="ww-kicker">WinWeb</span><h1>Open a Windows app</h1><p>Select an EXE. WinWeb reads only a small header slice first, then chooses the best runtime path without loading an emulator during startup.</p></div><div class="ww-ready"><strong>Ready</strong><small>Shell loaded</small></div></div>' +
      '<section class="ww-open-card">' +
        '<button type="button" class="ww-upload" data-pick="1"><span class="ww-upload-icon">' + icon('folder-open') + '<b>＋</b></span><span><strong>Select a Windows executable</strong><small>Tap to browse Files · .exe, .com or .scr</small></span><em>Browse</em></button>' +
        '<div class="ww-options">' +
          selectBox('ww-arch','Architecture',state.arch,[['auto','Auto-detect (recommended)'],['x86','x86 · 32-bit'],['x64','x64 · 64-bit'],['arm','ARM · 32-bit'],['arm64','ARM64 · 64-bit']]) +
          selectBox('ww-runtime','Runtime',state.runtime,[['auto','Auto-route'],['hle','BottleShip + v86 (x86)'],['wine32','Wine32 compatibility'],['wine64','Wine64 experimental'],['web','Optimized web adapter']]) +
          selectBox('ww-type','App type',state.type,[['auto','Auto-detect'],['portable','Portable EXE'],['installer','Installer / Setup']]) +
        '</div>' +
        '<div class="ww-open-foot"><span><i></i>Nothing is uploaded to a server</span><span>Smart memory loads runtime only after selection</span></div>' +
      '</section>' +
      '<section class="ww-section"><div class="ww-section-title"><div><span>Runtime paths</span><h2>Choose automatically or override</h2></div></div><div class="ww-runtime-cards">' +
        '<article><span class="ww-card-icon blue">' + icon('apps') + '</span><div><strong>HLE Fast</strong><small>BottleShip + v86 for compatible 32-bit Win32 apps.</small></div><b>x86</b></article>' +
        '<article><span class="ww-card-icon purple">' + icon('settings') + '</span><div><strong>Wine compatibility</strong><small>Broader Windows API fallback; Wine64 stays experimental.</small></div><b>x86 / x64</b></article>' +
        '<article><span class="ww-card-icon cyan">' + icon('search') + '</span><div><strong>Optimized adapter</strong><small>Known apps may use a faster browser-native path.</small></div><b>Smart</b></article>' +
      '</div></section>' +
      '<section class="ww-section"><div class="ww-section-title"><div><span>Library</span><h2>Recent apps</h2></div><button type="button" class="ww-link" data-page="apps">View all</button></div>' + recent + '</section>' +
    '</section>';
  }

  function appsPage() {
    var apps = loadApps();
    var content = apps.length ? apps.map(function (row) {
      return '<article class="ww-library-row"><span class="ww-file-tile">' + icon('document') + '</span><div><strong>' + esc(row.name) + '</strong><small>' + esc(row.fileName || '') + ' · ' + fmtBytes(row.size) + '</small></div><span class="ww-chip">' + esc((row.arch || 'unknown').toUpperCase()) + '</span><button type="button" class="ww-remove" data-remove="' + esc(row.id) + '">Remove</button></article>';
    }).join('') : '<div class="ww-empty big"><span class="ww-empty-icon">' + icon('apps') + '</span><div><strong>Your app library is empty</strong><small>Add an EXE from Home.</small></div><button type="button" class="ww-primary" data-pick="1">Add Windows app</button></div>';
    return '<section class="ww-page"><div class="ww-page-head"><span class="ww-kicker">Apps</span><h1>App library</h1><p>Saved metadata stays on this device. Large executables are not copied during startup.</p></div><div class="ww-library">' + content + '</div></section>';
  }

  function settingsPage() {
    return '<section class="ww-page"><div class="ww-page-head"><span class="ww-kicker">Settings</span><h1>Runtime settings</h1><p>iPhone mode prioritizes stable memory use and fast first paint.</p></div>' +
      '<div class="ww-settings-list">' +
        '<article><span>' + icon('settings') + '</span><div><strong>Smart memory mode</strong><small>Shell first. No WebGPU context, OPFS scan, Wine image, or emulator WASM is loaded until needed.</small></div><b>On</b></article>' +
        '<article><span>' + icon('apps') + '</span><div><strong>Runtime loading</strong><small>Advanced engines are lazy-loaded after EXE analysis.</small></div><b>Lazy</b></article>' +
        '<article><span>' + icon('info') + '</span><div><strong>Device profile</strong><small>' + esc(isIPhone ? 'iPhone / Safari-compatible low-memory shell' : 'Standard browser shell') + '</small></div><b>Auto</b></article>' +
      '</div>' +
      '<div class="ww-note"><strong>Why this is safer on iPhone 11</strong><p>WinWeb reads at most 2 MB for initial PE inspection and avoids creating graphics contexts or loading emulator binaries on the home screen.</p></div>' +
    '</section>';
  }

  function analyzingPage(file) {
    return '<section class="ww-page ww-center"><div class="ww-spinner"></div><span class="ww-kicker">Local inspection</span><h1>Reading ' + esc(file.name) + '</h1><p>Checking a small header slice. The full EXE is not loaded into memory.</p></section>';
  }

  function analysisPage(a) {
    var mismatch = state.arch !== 'auto' && state.arch !== a.arch;
    return '<section class="ww-page">' +
      '<button type="button" class="ww-back" data-page="home">‹ Back</button>' +
      '<div class="ww-analysis-head"><span class="ww-file-big">' + icon('document') + '</span><div><span class="ww-kicker">Local PE analysis</span><h1>' + esc(a.fileName) + '</h1><p>' + fmtBytes(a.size) + ' · ' + esc(a.peKind) + ' · ' + esc(a.subsystem) + '</p></div><span class="ww-arch">' + esc(a.arch.toUpperCase()) + '</span></div>' +
      (mismatch ? '<div class="ww-warning"><strong>Architecture override mismatch</strong><span>You selected ' + esc(state.arch.toUpperCase()) + ', but the executable header reports ' + esc(a.arch.toUpperCase()) + '.</span></div>' : '') +
      '<div class="ww-analysis-grid"><article><span>Executable</span><dl><div><dt>Detected architecture</dt><dd>' + esc(a.arch) + '</dd></div><div><dt>PE type</dt><dd>' + esc(a.peKind) + '</dd></div><div><dt>Sections</dt><dd>' + esc(a.sections) + '</dd></div><div><dt>Entry point</dt><dd>0x' + esc(a.entry.toString(16)) + '</dd></div></dl></article>' +
      '<article><span>Signals</span><div class="ww-tags">' + a.signals.map(function(s){ return '<b>' + esc(s) + '</b>'; }).join('') + '</div><p>Initial scan is intentionally bounded for iPhone memory stability.</p></article></div>' +
      '<div class="ww-route"><div><span>Recommended route</span><strong>' + esc(a.routeLabel) + '</strong><small>' + esc(a.routeReason) + '</small></div><span class="ww-chip">' + esc(a.routeState) + '</span></div>' +
      '<div class="ww-actions"><button type="button" class="ww-secondary" data-page="home">Cancel</button><button type="button" class="ww-primary" id="ww-save">Add to WinWeb</button></div>' +
      '<div class="ww-note compact"><strong>Execution status</strong><p>The shell and EXE analyzer are working. The emulator engine is kept out of memory until its separate runtime integration is ready; WinWeb does not fake a successful Windows launch.</p></div>' +
    '</section>';
  }

  function errorPage(message) {
    return '<section class="ww-page ww-center"><span class="ww-error-mark">!</span><span class="ww-kicker">Could not inspect file</span><h1>That file could not be read</h1><p>' + esc(message) + '</p><button type="button" class="ww-primary" data-pick="1">Choose another file</button></section>';
  }

  function routeFor(a) {
    var requested = state.runtime;
    if (requested !== 'auto') {
      var names = { hle:'BottleShip + v86', wine32:'Wine32 compatibility', wine64:'Wine64 experimental', web:'Optimized web adapter' };
      return { label: names[requested] || 'Manual runtime', reason: 'Manual runtime override selected.', state: 'Override' };
    }
    if (a.isElectron) return { label:'Optimized web adapter', reason:'Electron-like signals detected; an optimized browser route may avoid nested Chromium emulation.', state:'Suggested' };
    if (a.isDotNet) return { label:'Wine compatibility', reason:'.NET/CLR signals detected; use a Wine compatibility path.', state:'Planned' };
    if (a.arch === 'x86') return { label:'BottleShip + v86', reason:'32-bit PE detected; HLE is the preferred fast path when its imported APIs are supported.', state:'Preferred' };
    if (a.arch === 'x64') return { label:'Wine64 experimental', reason:'64-bit PE detected. Safari x64 remains experimental and must not assume Wasm Memory64.', state:'Experimental' };
    return { label:'No safe route yet', reason:'This architecture is not a supported browser execution target yet.', state:'Unsupported' };
  }

  function parsePE(buffer, file) {
    var view = new DataView(buffer);
    if (view.byteLength < 128 || view.getUint16(0, true) !== 0x5A4D) throw new Error('This does not look like a Windows MZ/PE executable.');
    var pe = view.getUint32(0x3c, true);
    if (pe + 96 >= view.byteLength || view.getUint32(pe, true) !== 0x00004550) throw new Error('The PE header is missing or lies outside the safe inspection window.');
    var machine = view.getUint16(pe + 4, true);
    var sections = view.getUint16(pe + 6, true);
    var optional = pe + 24;
    var magic = view.getUint16(optional, true);
    var arch = machine === 0x14c ? 'x86' : machine === 0x8664 ? 'x64' : machine === 0x1c0 || machine === 0x1c4 ? 'arm' : machine === 0xaa64 ? 'arm64' : 'unknown';
    var peKind = magic === 0x10b ? 'PE32' : magic === 0x20b ? 'PE32+' : 'PE';
    var entry = view.getUint32(optional + 16, true);
    var subsystemCode = view.getUint16(optional + 68, true);
    var subsystem = subsystemCode === 2 ? 'Windows GUI' : subsystemCode === 3 ? 'Windows Console' : subsystemCode === 1 ? 'Native' : 'Subsystem ' + subsystemCode;
    var bytes = new Uint8Array(buffer);
    var text = '';
    try { text = new TextDecoder().decode(bytes).toLowerCase(); } catch (_) {}
    var signals = [];
    var isDotNet = text.indexOf('mscoree.dll') >= 0 || text.indexOf('_cor') >= 0;
    var isElectron = text.indexOf('electron') >= 0 || text.indexOf('node.dll') >= 0;
    if (isDotNet) signals.push('.NET / CLR');
    if (isElectron) signals.push('Electron-like');
    if (text.indexOf('d3d11') >= 0) signals.push('Direct3D 11');
    else if (text.indexOf('d3d9') >= 0) signals.push('Direct3D 9');
    if (text.indexOf('opengl32') >= 0) signals.push('OpenGL');
    if (text.indexOf('dsound') >= 0) signals.push('DirectSound');
    if (/setup|installer/i.test(file.name) || text.indexOf('inno setup') >= 0) signals.push('Installer');
    if (!signals.length) signals.push('Native Win32');
    var base = { fileName:file.name, size:file.size, arch:arch, peKind:peKind, sections:sections, entry:entry, subsystem:subsystem, signals:signals, isDotNet:isDotNet, isElectron:isElectron };
    var route = routeFor(base);
    base.routeLabel = route.label;
    base.routeReason = route.reason;
    base.routeState = route.state;
    return base;
  }

  function readFile(file) {
    state.selectedFile = file;
    app.innerHTML = shell(analyzingPage(file));
    bind();
    var limit = Math.min(file.size, 2 * 1024 * 1024);
    var reader = new FileReader();
    reader.onerror = function () { app.innerHTML = shell(errorPage('Safari could not read the selected file.')); bind(); };
    reader.onload = function () {
      try {
        state.analysis = parsePE(reader.result, file);
        app.innerHTML = shell(analysisPage(state.analysis));
        bind();
      } catch (err) {
        app.innerHTML = shell(errorPage(err && err.message ? err.message : String(err)));
        bind();
      }
    };
    reader.readAsArrayBuffer(file.slice(0, limit));
  }

  function storeAnalysis() {
    if (!state.analysis) return;
    var a = state.analysis;
    var rows = loadApps().filter(function (row) { return row.id !== a.fileName + ':' + a.size; });
    rows.unshift({ id:a.fileName + ':' + a.size, name:a.fileName.replace(/\.exe$/i,''), fileName:a.fileName, size:a.size, arch:a.arch, runtime:state.runtime, runtimeLabel:a.routeLabel, addedAt:new Date().toISOString() });
    saveApps(rows.slice(0, 30));
    state.page = 'apps';
    render();
  }

  function bind() {
    var picker = document.getElementById('ww-file');
    var arch = document.getElementById('ww-arch');
    var runtime = document.getElementById('ww-runtime');
    var type = document.getElementById('ww-type');
    if (arch) arch.onchange = function () { state.arch = this.value; };
    if (runtime) runtime.onchange = function () { state.runtime = this.value; };
    if (type) type.onchange = function () { state.type = this.value; };
    if (picker) picker.onchange = function () { if (this.files && this.files[0]) readFile(this.files[0]); };

    var upload = document.querySelector('.ww-upload');
    if (upload) {
      upload.ondragover = function (e) { e.preventDefault(); upload.classList.add('drag'); };
      upload.ondragleave = function () { upload.classList.remove('drag'); };
      upload.ondrop = function (e) { e.preventDefault(); upload.classList.remove('drag'); if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0]) readFile(e.dataTransfer.files[0]); };
    }

    app.onclick = function (event) {
      var el = event.target.closest ? event.target.closest('[data-page],[data-pick],[data-remove],#ww-save') : null;
      if (!el) return;
      if (el.getAttribute('data-page')) { state.page = el.getAttribute('data-page'); render(); return; }
      if (el.hasAttribute('data-pick')) { if (picker) picker.click(); return; }
      if (el.id === 'ww-save') { storeAnalysis(); return; }
      if (el.getAttribute('data-remove')) {
        var id = el.getAttribute('data-remove');
        saveApps(loadApps().filter(function (row) { return row.id !== id; }));
        render();
      }
    };
  }

  function render() {
    var content = state.page === 'apps' ? appsPage() : state.page === 'settings' ? settingsPage() : homePage();
    app.innerHTML = shell(content);
    bind();
  }

  function retireOldServiceWorkers() {
    if (!('serviceWorker' in navigator)) return;
    try {
      navigator.serviceWorker.getRegistrations().then(function (regs) {
        regs.forEach(function (reg) {
          try { reg.unregister(); } catch (_) {}
        });
      }).catch(function () {});
    } catch (_) {}
  }

  window.addEventListener('error', function (event) {
    if (!app.querySelector('.ww-window')) return;
    var toast = document.createElement('div');
    toast.className = 'ww-toast';
    toast.textContent = 'WinWeb recovered from a browser error. ' + (event.message || '');
    document.body.appendChild(toast);
    setTimeout(function () { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4500);
  });

  render();
  setTimeout(retireOldServiceWorkers, 1000);
})();