(function(){
  'use strict';

  var app=document.getElementById('app');
  var main=document.getElementById('ww-main');
  var input=document.getElementById('ww-file');
  var sheet=document.getElementById('ww-sheet');
  if(!app||!main||!input||!sheet)return;

  var HOME_HTML=main.innerHTML;
  var STORE_KEY='winweb.shell.apps.v3';
  var state={page:'home',arch:'auto',runtime:'auto',type:'auto',file:null,analysis:null};

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot',"'":'&#39;'}[ch]||ch;});}
  function icon(name){return '<img src="./fluent/'+name+'.svg" alt="" />';}
  function fmtBytes(bytes){var u=['B','KB','MB','GB'];var v=Number(bytes||0),i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return(i===0?v.toFixed(0):v<10?v.toFixed(2):v<100?v.toFixed(1):v.toFixed(0))+' '+u[i];}
  function loadApps(){try{var value=localStorage.getItem(STORE_KEY);var rows=value?JSON.parse(value):[];return Array.isArray(rows)?rows:[];}catch(_){return[];}}
  function saveApps(rows){try{localStorage.setItem(STORE_KEY,JSON.stringify(rows));}catch(_){}}
  function setActive(page){
    app.setAttribute('data-page',page);
    var nodes=document.querySelectorAll('[data-page-link]');
    for(var i=0;i<nodes.length;i++){nodes[i].classList.toggle('active',nodes[i].getAttribute('data-page-link')===page);}
  }
  function syncControls(){
    var arch=document.getElementById('ww-arch'),runtime=document.getElementById('ww-runtime'),type=document.getElementById('ww-type');
    if(arch){arch.value=state.arch;arch.onchange=function(){state.arch=this.value;};}
    if(runtime){runtime.value=state.runtime;runtime.onchange=function(){state.runtime=this.value;};}
    if(type){type.value=state.type;type.onchange=function(){state.type=this.value;};}
  }
  function renderHome(){state.page='home';main.innerHTML=HOME_HTML;setActive('home');syncControls();bindPickers();bindNavigation();}
  function renderApps(){
    state.page='apps';setActive('apps');var rows=loadApps();var body='';
    if(!rows.length){body='<div class="ww-empty">'+icon('apps')+'<div><strong>Your app library is empty</strong><small>Add an EXE from Home. Only metadata is stored here.</small></div><button class="ww-primary" type="button" data-pick>Add Windows app</button></div>';}else{
      for(var i=0;i<rows.length;i++){var r=rows[i];body+='<article class="ww-app-row"><span class="icon">'+icon('document')+'</span><div class="copy"><strong>'+esc(r.name)+'</strong><small>'+esc(r.fileName)+' · '+fmtBytes(r.size)+' · '+esc(r.runtimeLabel||'Auto-route')+'</small></div><span class="ww-chip">'+esc((r.arch||'unknown').toUpperCase())+'</span><button class="ww-remove" type="button" data-remove="'+esc(r.id)+'">Remove</button></article>';}
    }
    main.innerHTML='<section class="ww-page"><div class="ww-page-head"><span class="ww-eyebrow">Apps</span><h1>App library</h1><p>Saved app metadata stays on this device. Executable bytes are never loaded during startup.</p></div><div class="ww-library">'+body+'</div></section>';
    bindPickers();bindNavigation();var remove=document.querySelectorAll('[data-remove]');for(var j=0;j<remove.length;j++){remove[j].onclick=function(){var id=this.getAttribute('data-remove');saveApps(loadApps().filter(function(x){return x.id!==id;}));renderApps();};}
  }
  function renderSettings(){
    state.page='settings';setActive('settings');
    main.innerHTML='<section class="ww-page"><div class="ww-page-head"><span class="ww-eyebrow">Settings</span><h1>Runtime settings</h1><p>WinWeb keeps Home intentionally tiny for iPhone 11 and other memory-constrained browsers.</p></div><div class="ww-settings"><article class="ww-setting-row"><span>'+icon('settings')+'</span><div><strong>Smart memory mode</strong><small>No WebGPU context, OPFS scan, Wine image or emulator WASM on Home.</small></div><b>ON</b></article><article class="ww-setting-row"><span>'+icon('apps')+'</span><div><strong>Runtime loading</strong><small>Engines are loaded only after executable inspection and a deliberate launch action.</small></div><b>LAZY</b></article><article class="ww-setting-row"><span>'+icon('info')+'</span><div><strong>PE preflight</strong><small>First pass reads 64 KB; a bounded extension is used only when the PE header sits farther into the file.</small></div><b>64 KB</b></article></div></section>';
    bindNavigation();
  }
  function bindPickers(){var picks=document.querySelectorAll('[data-pick]');for(var i=0;i<picks.length;i++){picks[i].onclick=function(){input.value='';input.click();};}}
  function bindNavigation(){var links=document.querySelectorAll('[data-page-link]');for(var i=0;i<links.length;i++){links[i].onclick=function(){var page=this.getAttribute('data-page-link');if(page==='apps')renderApps();else if(page==='settings')renderSettings();else renderHome();};}}

  function showSheet(html){sheet.innerHTML=html;sheet.hidden=false;document.body.setAttribute('data-sheet-open','1');var close=sheet.querySelector('[data-close]');if(close)close.onclick=hideSheet;}
  function hideSheet(){sheet.hidden=true;sheet.innerHTML='';document.body.removeAttribute('data-sheet-open');}
  sheet.addEventListener('click',function(e){if(e.target===sheet)hideSheet();});

  function analyzeDialog(file){showSheet('<section class="ww-sheet-card"><header class="ww-sheet-head"><span class="file">'+icon('document')+'</span><div><strong>'+esc(file.name)+'</strong><small>'+fmtBytes(file.size)+' · Local inspection</small></div><button class="ww-sheet-close" type="button" data-close aria-label="Close">×</button></header><div class="ww-sheet-body"><div class="ww-analyze-status"><span class="ww-spinner"></span><span>Reading the executable header…</span></div></div></section>');}
  function failDialog(file,message){showSheet('<section class="ww-sheet-card"><header class="ww-sheet-head"><span class="file">'+icon('document')+'</span><div><strong>'+esc(file.name)+'</strong><small>Inspection failed</small></div><button class="ww-sheet-close" type="button" data-close>×</button></header><div class="ww-sheet-body"><div class="ww-warning">'+esc(message)+'</div><p class="ww-sheet-note">No emulator or graphics runtime was loaded.</p></div><footer class="ww-sheet-actions"><button type="button" class="ww-secondary" data-close>Close</button></footer></section>');var nodes=sheet.querySelectorAll('[data-close]');for(var i=0;i<nodes.length;i++)nodes[i].onclick=hideSheet;}

  function machineName(machine){if(machine===0x14c)return'x86';if(machine===0x8664)return'x64';if(machine===0x1c0||machine===0x1c4)return'arm';if(machine===0xaa64)return'arm64';return'unknown';}
  function subsystemName(code){var map={1:'Native',2:'Windows GUI',3:'Windows Console',7:'POSIX',9:'Windows CE',10:'EFI App',11:'EFI Driver',12:'EFI Runtime',14:'Xbox',16:'Boot App'};return map[code]||('Subsystem '+code);}
  function routeFor(a){
    if(state.runtime!=='auto'){var names={hle:'BottleShip + v86',wine32:'Wine32 compatibility',wine64:'Wine64 experimental',web:'Optimized web adapter'};return{label:names[state.runtime]||'Manual runtime',reason:'Manual runtime override selected.',status:'Override'};}
    if(a.isVSCode)return{label:'Optimized web adapter',reason:'VS Code-like executable name detected; a browser-native Code-OSS path is preferable to nested Electron emulation.',status:'Suggested'};
    if(a.isDotNet)return{label:'Wine compatibility',reason:'.NET CLR metadata is present, so the Wine compatibility path is safer.',status:'Planned'};
    if(a.arch==='x86')return{label:'BottleShip + v86',reason:'32-bit PE detected; HLE is the preferred fast path when imported APIs are supported.',status:'Preferred'};
    if(a.arch==='x64')return{label:'Wine64 experimental',reason:'64-bit PE detected. iPhone Safari remains an experimental x64 target and must not depend on Memory64.',status:'Experimental'};
    return{label:'Unsupported architecture',reason:'This CPU architecture does not currently have a safe browser runtime route.',status:'Unsupported'};
  }
  function parsePE(buffer,file){
    var view=new DataView(buffer);if(view.byteLength<64)throw new Error('The file is too small to contain a Windows PE header.');
    if(view.getUint16(0,true)!==0x5a4d)throw new Error('Missing MZ signature. This does not look like a normal Windows PE executable.');
    var pe=view.getUint32(0x3c,true);if(pe+256>view.byteLength)throw new Error('PE header is outside the initial scan window.');
    if(view.getUint32(pe,true)!==0x00004550)throw new Error('Missing PE signature.');
    var machine=view.getUint16(pe+4,true),sections=view.getUint16(pe+6,true),optionalSize=view.getUint16(pe+20,true),characteristics=view.getUint16(pe+22,true),opt=pe+24;
    if(opt+optionalSize>view.byteLength)throw new Error('Optional header is incomplete in the scan window.');
    var magic=view.getUint16(opt,true),peKind=magic===0x20b?'PE32+':magic===0x10b?'PE32':'Unknown PE';
    var entry=view.getUint32(opt+16,true),subsystem=view.getUint16(opt+68,true),dataDir=opt+(magic===0x20b?112:96),clrRva=0;
    if(optionalSize>(dataDir-opt)+(14*8)+4&&dataDir+(14*8)+4<=view.byteLength)clrRva=view.getUint32(dataDir+(14*8),true);
    var lower=file.name.toLowerCase();var installer=/setup|install|installer|update|upgrade/.test(lower);var isVSCode=/visual.?studio.?code|vscode|code[-_. ]setup/.test(lower);
    var a={fileName:file.name,size:file.size,arch:machineName(machine),machine:machine,sections:sections,peKind:peKind,entry:entry,subsystem:subsystemName(subsystem),isDll:!!(characteristics&0x2000),isDotNet:clrRva!==0,isInstaller:installer,isVSCode:isVSCode};
    var route=routeFor(a);a.routeLabel=route.label;a.routeReason=route.reason;a.routeStatus=route.status;return a;
  }
  function readForPE(file){
    var firstSize=Math.min(file.size,65536);
    return file.slice(0,firstSize).arrayBuffer().then(function(first){
      if(first.byteLength<64)return first;var v=new DataView(first);var pe=v.getUint32(0x3c,true);if(pe+512<=first.byteLength)return first;
      var need=Math.min(file.size,Math.max(65536,pe+512));if(need>262144)throw new Error('The PE header is unusually far into the file; WinWeb stopped the preflight to protect mobile memory.');return file.slice(0,need).arrayBuffer();
    });
  }
  function resultDialog(a){
    var mismatch=state.arch!=='auto'&&state.arch!==a.arch;var type=a.isDll?'DLL':a.isInstaller?'Installer':'Application';
    var html='<section class="ww-sheet-card"><header class="ww-sheet-head"><span class="file">'+icon('document')+'</span><div><strong>'+esc(a.fileName)+'</strong><small>'+fmtBytes(a.size)+' · '+esc(a.peKind)+'</small></div><button class="ww-sheet-close" type="button" data-close>×</button></header><div class="ww-sheet-body"><div class="ww-result-grid"><div class="ww-result-box"><span>Architecture</span><strong>'+esc(a.arch.toUpperCase())+'</strong></div><div class="ww-result-box"><span>Type</span><strong>'+esc(type)+'</strong></div><div class="ww-result-box"><span>Subsystem</span><strong>'+esc(a.subsystem)+'</strong></div><div class="ww-result-box"><span>Sections</span><strong>'+esc(a.sections)+'</strong></div></div>'+(mismatch?'<div class="ww-warning">Architecture override says '+esc(state.arch.toUpperCase())+', but the executable reports '+esc(a.arch.toUpperCase())+'.</div>':'')+'<div class="ww-route"><span>Recommended runtime</span><strong>'+esc(a.routeLabel)+'</strong><small>'+esc(a.routeReason)+'</small></div><p class="ww-sheet-note">First-pass inspection is local and bounded. WinWeb has not loaded Wine, WebGPU or emulator WASM yet.</p></div><footer class="ww-sheet-actions"><button type="button" class="ww-secondary" data-close>Cancel</button><button type="button" class="ww-primary" id="ww-save-app">Add to WinWeb</button></footer></section>';
    showSheet(html);var closes=sheet.querySelectorAll('[data-close]');for(var i=0;i<closes.length;i++)closes[i].onclick=hideSheet;var save=document.getElementById('ww-save-app');if(save)save.onclick=function(){var rows=loadApps();rows.unshift({id:String(Date.now()),name:a.fileName.replace(/\.[^.]+$/,''),fileName:a.fileName,size:a.size,arch:a.arch,runtimeLabel:a.routeLabel,addedAt:Date.now()});saveApps(rows.slice(0,40));hideSheet();renderApps();};
  }
  function inspectFile(file){state.file=file;analyzeDialog(file);readForPE(file).then(function(buffer){var a=parsePE(buffer,file);state.analysis=a;resultDialog(a);}).catch(function(err){failDialog(file,err&&err.message?err.message:String(err));});}

  input.addEventListener('change',function(){var file=input.files&&input.files[0];if(file)inspectFile(file);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)hideSheet();});

  bindNavigation();bindPickers();syncControls();setActive('home');
  app.setAttribute('data-ready','1');

  if('serviceWorker' in navigator){window.setTimeout(function(){navigator.serviceWorker.getRegistrations().then(function(regs){for(var i=0;i<regs.length;i++){var url=regs[i].active&&regs[i].active.scriptURL||'';if(url.indexOf('coi-serviceworker')!==-1)regs[i].unregister();}}).catch(function(){});},1500);}
})();
