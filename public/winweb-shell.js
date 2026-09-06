(function(){
  'use strict';

  var app=document.getElementById('app');
  var main=document.getElementById('ww-main');
  var input=document.getElementById('ww-file');
  var sheet=document.getElementById('ww-sheet');
  if(!app||!main||!input||!sheet)return;

  var HOME_HTML=main.innerHTML;
  var STORE_KEY='winweb.shell.apps.v5';
  var PENDING_KEY='winweb.pendingRun';
  var PENDING_ATTEMPT='winweb.pendingRunAttempt';
  var RUNTIME_DB='winweb-runtime-v1';
  var RUNTIME_STORE='pending';
  var state={page:'home',arch:'auto',runtime:'auto',type:'auto',file:null,analysis:null,worker:null,inputView:null,runtimeRoot:null,guestWidth:640,guestHeight:480};

  function esc(value){return String(value==null?'':value).replace(/[&<>"']/g,function(ch){return{'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]||ch;});}
  function icon(name){return '<img src="./fluent/'+name+'.svg?v=20260906-shell5" alt="" />';}
  function fmtBytes(bytes){var u=['B','KB','MB','GB'];var v=Number(bytes||0),i=0;while(v>=1024&&i<u.length-1){v/=1024;i++;}return(i===0?v.toFixed(0):v<10?v.toFixed(2):v<100?v.toFixed(1):v.toFixed(0))+' '+u[i];}
  function loadApps(){try{var raw=localStorage.getItem(STORE_KEY);var rows=raw?JSON.parse(raw):[];return Array.isArray(rows)?rows:[];}catch(_){return[];}}
  function saveApps(rows){try{localStorage.setItem(STORE_KEY,JSON.stringify(rows));}catch(_){}}
  function setActive(page){
    app.setAttribute('data-page',page);
    var nodes=document.querySelectorAll('[data-page-link]');
    for(var i=0;i<nodes.length;i++)nodes[i].classList.toggle('active',nodes[i].getAttribute('data-page-link')===page);
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
    if(!rows.length){
      body='<div class="ww-empty">'+icon('apps')+'<div><strong>Your app library is empty</strong><small>Add an EXE from Home. The Windows runtime stays unloaded until you press Run.</small></div><button class="ww-primary" type="button" data-pick>Add Windows app</button></div>';
    }else{
      for(var i=0;i<rows.length;i++){
        var r=rows[i];
        body+='<article class="ww-app-row"><span class="icon">'+icon('document')+'</span><div class="copy"><strong>'+esc(r.name)+'</strong><small>'+esc(r.fileName)+' · '+fmtBytes(r.size)+' · '+esc(r.runtimeLabel||'Auto-route')+'</small></div><span class="ww-chip">'+esc((r.arch||'unknown').toUpperCase())+'</span><button class="ww-remove" type="button" data-remove="'+esc(r.id)+'">Remove</button></article>';
      }
    }
    main.innerHTML='<section class="ww-page"><div class="ww-page-head"><span class="ww-eyebrow">Apps</span><h1>App library</h1><p>Saved app metadata stays local. To run an app again, choose its EXE from Files until persistent executable containers are enabled.</p></div><div class="ww-library">'+body+'</div></section>';
    bindPickers();bindNavigation();var remove=document.querySelectorAll('[data-remove]');for(var j=0;j<remove.length;j++){remove[j].onclick=function(){var id=this.getAttribute('data-remove');saveApps(loadApps().filter(function(x){return x.id!==id;}));renderApps();};}
  }
  function renderSettings(){
    state.page='settings';setActive('settings');
    main.innerHTML='<section class="ww-page"><div class="ww-page-head"><span class="ww-eyebrow">Settings</span><h1>Runtime settings</h1><p>WinWeb uses an iPhone-first runtime profile and never boots the emulator on Home.</p></div><div class="ww-settings"><article class="ww-setting-row"><span>'+icon('settings')+'</span><div><strong>iPhone smart-memory mode</strong><small>Home loads no WebGPU context, Wine image or emulator WASM. The HLE engine is built with a smaller mobile memory ceiling.</small></div><b>ON</b></article><article class="ww-setting-row"><span>'+icon('apps')+'</span><div><strong>Runtime loading</strong><small>The engine starts only after PE inspection and an explicit Run application tap.</small></div><b>LAZY</b></article><article class="ww-setting-row"><span>'+icon('info')+'</span><div><strong>PE preflight</strong><small>First pass reads 64 KB and expands only when the PE header requires it.</small></div><b>64 KB</b></article></div></section>';
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
    if(a.isVSCode)return{label:'Optimized web adapter',reason:'VS Code-like executable detected. The browser-native adapter is preferable to nested Electron emulation.',status:'Suggested'};
    if(a.isDotNet)return{label:'Wine compatibility',reason:'.NET CLR metadata is present, so Wine compatibility is safer.',status:'Planned'};
    if(a.arch==='x86')return{label:'BottleShip + v86',reason:'32-bit PE detected. The HLE engine can be attempted directly in the browser.',status:'Runnable'};
    if(a.arch==='x64')return{label:'Wine64 experimental',reason:'64-bit PE detected. The iPhone Safari x64 path is not yet wired for direct launch.',status:'Experimental'};
    return{label:'Unsupported architecture',reason:'This architecture does not currently have a browser execution path.',status:'Unsupported'};
  }
  function parsePE(buffer,file){
    var view=new DataView(buffer);if(view.byteLength<64)throw new Error('The file is too small to contain a Windows PE header.');
    if(view.getUint16(0,true)!==0x5a4d)throw new Error('Missing MZ signature. This does not look like a normal Windows executable.');
    var pe=view.getUint32(0x3c,true);if(pe+256>view.byteLength)throw new Error('PE header is outside the initial scan window.');
    if(view.getUint32(pe,true)!==0x00004550)throw new Error('Missing PE signature.');
    var machine=view.getUint16(pe+4,true),sections=view.getUint16(pe+6,true),optionalSize=view.getUint16(pe+20,true),characteristics=view.getUint16(pe+22,true),opt=pe+24;
    if(opt+optionalSize>view.byteLength)throw new Error('Optional header is incomplete in the scan window.');
    var magic=view.getUint16(opt,true),peKind=magic===0x20b?'PE32+':magic===0x10b?'PE32':'Unknown PE';
    var subsystem=view.getUint16(opt+68,true),dataDir=opt+(magic===0x20b?112:96),clrRva=0;
    if(optionalSize>(dataDir-opt)+(14*8)+4&&dataDir+(14*8)+4<=view.byteLength)clrRva=view.getUint32(dataDir+(14*8),true);
    var lower=file.name.toLowerCase(),installer=/setup|install|installer|update|upgrade/.test(lower),isVSCode=/visual.?studio.?code|vscode|code[-_. ]setup/.test(lower);
    var a={fileName:file.name,size:file.size,arch:machineName(machine),machine:machine,sections:sections,peKind:peKind,subsystem:subsystemName(subsystem),isDll:!!(characteristics&0x2000),isDotNet:clrRva!==0,isInstaller:installer,isVSCode:isVSCode};
    var route=routeFor(a);a.routeLabel=route.label;a.routeReason=route.reason;a.routeStatus=route.status;return a;
  }
  function readForPE(file){
    var firstSize=Math.min(file.size,65536);
    return file.slice(0,firstSize).arrayBuffer().then(function(first){
      if(first.byteLength<64)return first;var v=new DataView(first);var pe=v.getUint32(0x3c,true);if(pe+512<=first.byteLength)return first;
      var need=Math.min(file.size,Math.max(65536,pe+512));if(need>262144)throw new Error('The PE header is unusually far into the file; WinWeb stopped the preflight to protect mobile memory.');return file.slice(0,need).arrayBuffer();
    });
  }
  function canRunHle(a){return a.arch==='x86'&&!a.isDll&&(state.runtime==='auto'||state.runtime==='hle');}
  function resultDialog(a){
    var mismatch=state.arch!=='auto'&&state.arch!==a.arch,type=a.isDll?'DLL':a.isInstaller?'Installer':'Application',runnable=canRunHle(a);
    var runLabel=runnable?'Run application':'Runtime not ready';
    var html='<section class="ww-sheet-card"><header class="ww-sheet-head"><span class="file">'+icon('document')+'</span><div><strong>'+esc(a.fileName)+'</strong><small>'+fmtBytes(a.size)+' · '+esc(a.peKind)+'</small></div><button class="ww-sheet-close" type="button" data-close>×</button></header><div class="ww-sheet-body"><div class="ww-result-grid"><div class="ww-result-box"><span>Architecture</span><strong>'+esc(a.arch.toUpperCase())+'</strong></div><div class="ww-result-box"><span>Type</span><strong>'+esc(type)+'</strong></div><div class="ww-result-box"><span>Subsystem</span><strong>'+esc(a.subsystem)+'</strong></div><div class="ww-result-box"><span>Sections</span><strong>'+esc(a.sections)+'</strong></div></div>'+(mismatch?'<div class="ww-warning">Architecture override says '+esc(state.arch.toUpperCase())+', but the executable reports '+esc(a.arch.toUpperCase())+'.</div>':'')+'<div class="ww-route"><span>Recommended runtime</span><strong>'+esc(a.routeLabel)+'</strong><small>'+esc(a.routeReason)+'</small></div>'+(runnable?'':'<div class="ww-warning">Direct Run is currently wired to compatible x86/32-bit applications through BottleShip + v86. This file can still be added to the library.</div>')+'<p class="ww-sheet-note">The emulator remains unloaded until you press Run application.</p></div><footer class="ww-sheet-actions"><button type="button" class="ww-secondary" data-close>Cancel</button><button type="button" class="ww-secondary" id="ww-save-app">Add to WinWeb</button><button type="button" class="ww-primary" id="ww-run-app" '+(runnable?'':'disabled')+'>'+runLabel+'</button></footer></section>';
    showSheet(html);
    var closes=sheet.querySelectorAll('[data-close]');for(var i=0;i<closes.length;i++)closes[i].onclick=hideSheet;
    var save=document.getElementById('ww-save-app');if(save)save.onclick=function(){addAnalysisToLibrary(a);hideSheet();renderApps();};
    var run=document.getElementById('ww-run-app');if(run&&runnable)run.onclick=function(){hideSheet();startRunFlow(state.file,a);};
  }
  function addAnalysisToLibrary(a){var rows=loadApps();rows.unshift({id:String(Date.now()),name:a.fileName.replace(/\.[^.]+$/,''),fileName:a.fileName,size:a.size,arch:a.arch,runtimeLabel:a.routeLabel,addedAt:Date.now()});saveApps(rows.slice(0,40));}
  function inspectFile(file){state.file=file;analyzeDialog(file);readForPE(file).then(function(buffer){var a=parsePE(buffer,file);state.analysis=a;resultDialog(a);}).catch(function(err){failDialog(file,err&&err.message?err.message:String(err));});}

  function openRuntimeDb(){
    return new Promise(function(resolve,reject){var req=indexedDB.open(RUNTIME_DB,1);req.onupgradeneeded=function(){if(!req.result.objectStoreNames.contains(RUNTIME_STORE))req.result.createObjectStore(RUNTIME_STORE);};req.onsuccess=function(){resolve(req.result);};req.onerror=function(){reject(req.error||new Error('IndexedDB failed.'));};});
  }
  async function storePending(file,a){var db=await openRuntimeDb();await new Promise(function(resolve,reject){var tx=db.transaction(RUNTIME_STORE,'readwrite');tx.objectStore(RUNTIME_STORE).put({blob:file,name:file.name,type:file.type,lastModified:file.lastModified||Date.now(),analysis:a},'run');tx.oncomplete=resolve;tx.onerror=function(){reject(tx.error||new Error('Could not store executable for runtime reload.'));};});db.close();}
  async function readPending(){var db=await openRuntimeDb();var value=await new Promise(function(resolve,reject){var req=db.transaction(RUNTIME_STORE,'readonly').objectStore(RUNTIME_STORE).get('run');req.onsuccess=function(){resolve(req.result||null);};req.onerror=function(){reject(req.error||new Error('Could not restore pending executable.'));};});db.close();return value;}
  async function clearPending(){try{var db=await openRuntimeDb();await new Promise(function(resolve){var tx=db.transaction(RUNTIME_STORE,'readwrite');tx.objectStore(RUNTIME_STORE).delete('run');tx.oncomplete=resolve;tx.onerror=resolve;});db.close();}catch(_){}}

  function runtimeError(title,message){showSheet('<section class="ww-sheet-card"><header class="ww-sheet-head"><span class="file">'+icon('info')+'</span><div><strong>'+esc(title)+'</strong><small>Runtime</small></div><button class="ww-sheet-close" type="button" data-close>×</button></header><div class="ww-sheet-body"><div class="ww-warning">'+esc(message)+'</div></div><footer class="ww-sheet-actions"><button class="ww-primary" type="button" data-close>Close</button></footer></section>');var closes=sheet.querySelectorAll('[data-close]');for(var i=0;i<closes.length;i++)closes[i].onclick=hideSheet;}
  async function startRunFlow(file,a){
    if(!file)return runtimeError('No executable selected','Choose the EXE again and press Run application.');
    if(!canRunHle(a))return runtimeError('Runtime not available','Direct Run currently supports compatible x86 executables through the BottleShip HLE engine.');
    try{
      if(!window.crossOriginIsolated||typeof SharedArrayBuffer!=='function'){
        if(!('serviceWorker' in navigator))throw new Error('This browser cannot enable the shared-memory runtime required by BottleShip.');
        await storePending(file,a);
        sessionStorage.setItem(PENDING_KEY,'1');sessionStorage.setItem(PENDING_ATTEMPT,'0');
        var reg=await navigator.serviceWorker.register('./coi-serviceworker.js?v=20260906-runtime1',{scope:'./'});
        await navigator.serviceWorker.ready;
        if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
        window.setTimeout(function(){location.reload();},150);
        return;
      }
      await launchBottleShip(file,a);
    }catch(err){runtimeError('Could not start application',err&&err.message?err.message:String(err));}
  }

  function chooseGuestSize(){var w=Math.max(320,window.innerWidth||390),h=Math.max(480,window.innerHeight||844);if(w<=430)return{width:640,height:480};if(w<900||h<700)return{width:854,height:480};return{width:1280,height:720};}
  function showRuntimeView(file){
    var root=document.createElement('section');root.className='ww-runtime';root.innerHTML='<header class="ww-runtime-top"><img src="./windows11-logo.svg?v=20260906-shell5" alt=""><div class="ww-runtime-title"><strong>'+esc(file.name)+'</strong><small id="ww-runtime-status">Starting Windows runtime…</small></div><button class="ww-runtime-stop" id="ww-runtime-stop" type="button">Stop</button></header><div class="ww-runtime-stage"><canvas id="ww-runtime-canvas" class="ww-runtime-canvas"></canvas><div class="ww-runtime-loading" id="ww-runtime-loading"><div class="ww-runtime-loading-card"><span class="ww-spinner"></span><strong id="ww-runtime-loading-title">Preparing runtime</strong><small id="ww-runtime-loading-copy">Loading the x86 engine only now. Home stays lightweight.</small><div class="ww-runtime-progress"><i id="ww-runtime-progress-bar"></i></div></div></div></div><footer class="ww-runtime-controls"><button type="button" data-vk="27">Esc</button><button type="button" data-vk="17">Ctrl</button><button type="button" data-vk="18">Alt</button><button type="button" data-vk="9">Tab</button><button type="button" data-vk="13">Enter</button><button type="button" id="ww-keyboard">Keyboard</button></footer><input class="ww-runtime-hidden-input" id="ww-runtime-input" autocomplete="off" autocapitalize="off" spellcheck="false">';document.body.appendChild(root);state.runtimeRoot=root;return root;
  }
  function stopRuntime(){if(state.worker){try{state.worker.terminate();}catch(_){ }state.worker=null;}state.inputView=null;if(state.runtimeRoot){state.runtimeRoot.remove();state.runtimeRoot=null;}clearPending();sessionStorage.removeItem(PENDING_KEY);sessionStorage.removeItem(PENDING_ATTEMPT);}
  function setRuntimeStatus(text){var el=document.getElementById('ww-runtime-status');if(el)el.textContent=text;}
  function setRuntimeProgress(percent,label){var bar=document.getElementById('ww-runtime-progress-bar'),copy=document.getElementById('ww-runtime-loading-copy');if(bar)bar.style.width=Math.max(5,Math.min(100,Number(percent)||5))+'%';if(copy&&label)copy.textContent=label;}
  function hideRuntimeLoading(){var el=document.getElementById('ww-runtime-loading');if(el)el.style.display='none';}
  function mapPointer(canvas,e){var rect=canvas.getBoundingClientRect();var x=(e.clientX-rect.left)/Math.max(1,rect.width)*state.guestWidth;var y=(e.clientY-rect.top)/Math.max(1,rect.height)*state.guestHeight;return{x:Math.max(0,Math.min(state.guestWidth-1,Math.round(x))),y:Math.max(0,Math.min(state.guestHeight-1,Math.round(y)))};}
  function bump(){if(state.inputView)Atomics.add(state.inputView,0,1);}
  function setPointer(canvas,e){if(!state.inputView)return;var p=mapPointer(canvas,e);Atomics.store(state.inputView,1,p.x);Atomics.store(state.inputView,2,p.y);Atomics.store(state.inputView,3,e.buttons||0);Atomics.store(state.inputView,13,1);bump();}
  function keyVk(vk,down){if(!state.inputView||vk<0||vk>255)return;var word=16+(vk>>>5),mask=1<<(vk&31);if(down)Atomics.or(state.inputView,word,mask);else Atomics.and(state.inputView,word,~mask);Atomics.store(state.inputView,4,vk);Atomics.store(state.inputView,5,down?1:0);bump();}
  function eventVk(e){var k=e.key;if(k==='Escape')return 27;if(k==='Enter')return 13;if(k==='Tab')return 9;if(k==='Backspace')return 8;if(k==='Delete')return 46;if(k==='ArrowLeft')return 37;if(k==='ArrowUp')return 38;if(k==='ArrowRight')return 39;if(k==='ArrowDown')return 40;if(k==='Control')return 17;if(k==='Shift')return 16;if(k==='Alt')return 18;if(k===' ')return 32;if(k&&k.length===1){var c=k.toUpperCase().charCodeAt(0);if(c>=48&&c<=90)return c;}return null;}
  function bindRuntimeInput(canvas){
    canvas.addEventListener('pointerdown',function(e){canvas.setPointerCapture&&canvas.setPointerCapture(e.pointerId);setPointer(canvas,e);e.preventDefault();});canvas.addEventListener('pointermove',function(e){if(e.buttons)setPointer(canvas,e);});canvas.addEventListener('pointerup',function(e){setPointer(canvas,e);});canvas.addEventListener('wheel',function(e){if(state.inputView){Atomics.add(state.inputView,12,Math.round(-e.deltaY));bump();e.preventDefault();}},{passive:false});
    var hidden=document.getElementById('ww-runtime-input');if(hidden){hidden.addEventListener('keydown',function(e){var vk=eventVk(e);if(vk!=null){keyVk(vk,true);e.preventDefault();}});hidden.addEventListener('keyup',function(e){var vk=eventVk(e);if(vk!=null){keyVk(vk,false);e.preventDefault();}});}
    var keyboard=document.getElementById('ww-keyboard');if(keyboard)keyboard.onclick=function(){if(hidden){hidden.value='';hidden.focus();}};
    var buttons=document.querySelectorAll('.ww-runtime-controls [data-vk]');for(var i=0;i<buttons.length;i++){buttons[i].onpointerdown=function(e){keyVk(Number(this.getAttribute('data-vk')),true);e.preventDefault();};buttons[i].onpointerup=function(e){keyVk(Number(this.getAttribute('data-vk')),false);e.preventDefault();};}
  }
  async function launchBottleShip(file,a){
    if(typeof SharedArrayBuffer!=='function'||!window.crossOriginIsolated)throw new Error('Shared-memory isolation is not active yet.');
    if(typeof Worker!=='function'||typeof WebAssembly!=='object')throw new Error('This browser is missing Worker or WebAssembly support.');
    if(typeof HTMLCanvasElement==='undefined'||!HTMLCanvasElement.prototype.transferControlToOffscreen)throw new Error('This Safari build does not expose OffscreenCanvas transfer required by the current BottleShip worker.');
    var root=showRuntimeView(file),canvas=document.getElementById('ww-runtime-canvas'),stop=document.getElementById('ww-runtime-stop');if(stop)stop.onclick=stopRuntime;
    var size=chooseGuestSize();state.guestWidth=size.width;state.guestHeight=size.height;canvas.width=size.width;canvas.height=size.height;
    var inputBuffer=new SharedArrayBuffer(1024);state.inputView=new Int32Array(inputBuffer);bindRuntimeInput(canvas);
    setRuntimeStatus('Loading x86 engine…');setRuntimeProgress(8,'Loading BottleShip + v86…');
    var module=await import('./engines/bottleship/engine-loader.js?v=20260906-runtime1');if(!module||typeof module.createBottleShipWorker!=='function')throw new Error('The BottleShip engine bundle is missing from this deployment.');
    var worker=module.createBottleShipWorker();state.worker=worker;var ready=false,loaded=false;
    var timeout=window.setTimeout(function(){if(!ready){setRuntimeStatus('Runtime startup timed out');setRuntimeProgress(100,'The worker did not become ready. Stop and try a smaller x86 application.');}},45000);
    worker.addEventListener('error',function(e){setRuntimeStatus('Runtime error');setRuntimeProgress(100,e.message||'BottleShip worker failed.');});
    worker.addEventListener('message',function(e){var m=e.data||{};if(m.type==='ready'){ready=true;window.clearTimeout(timeout);setRuntimeStatus('Loading application…');setRuntimeProgress(28,'Engine ready. Importing '+file.name+'…');if(!loaded){loaded=true;worker.postMessage({type:'load_bundle',blob:file});}}else if(m.type==='loading_progress'){var pct=30+Math.max(0,Math.min(70,Number(m.percent)||0))*.7;setRuntimeStatus(m.label||m.phase||'Loading application…');setRuntimeProgress(pct,m.label||m.phase||'Loading application…');}else if(m.type==='first_present'){setRuntimeStatus('Running');setRuntimeProgress(100,'Application is running.');hideRuntimeLoading();clearPending();sessionStorage.removeItem(PENDING_KEY);sessionStorage.removeItem(PENDING_ATTEMPT);}else if(m.type==='window_title'&&m.title){var title=root.querySelector('.ww-runtime-title strong');if(title)title.textContent=m.title;}else if(m.type==='process_exit'){setRuntimeStatus(m.crashed?'Application crashed':'Application exited');if(!m.crashed)hideRuntimeLoading();}else if(m.type==='error'){setRuntimeStatus('Application error');setRuntimeProgress(100,m.message||'BottleShip runtime error.');}});
    var offscreen=canvas.transferControlToOffscreen();worker.postMessage({type:'init',canvas:offscreen,inputBuffer:inputBuffer,width:size.width,height:size.height},[offscreen]);
  }

  async function resumePendingRun(){
    if(sessionStorage.getItem(PENDING_KEY)!=='1')return;
    try{
      if(!window.crossOriginIsolated||typeof SharedArrayBuffer!=='function'){
        var attempt=Number(sessionStorage.getItem(PENDING_ATTEMPT)||'0');if(attempt<1){sessionStorage.setItem(PENDING_ATTEMPT,String(attempt+1));window.setTimeout(function(){location.reload();},150);return;}
        throw new Error('GitHub Pages could not enter cross-origin isolated mode. The current BottleShip engine cannot run without SharedArrayBuffer.');
      }
      var pending=await readPending();if(!pending||!pending.blob)throw new Error('The uploaded executable could not be restored after the runtime reload.');
      var file=new File([pending.blob],pending.name||'application.exe',{type:pending.type||'application/octet-stream',lastModified:pending.lastModified||Date.now()});state.file=file;state.analysis=pending.analysis||null;await launchBottleShip(file,pending.analysis||{arch:'x86'});
    }catch(err){sessionStorage.removeItem(PENDING_KEY);sessionStorage.removeItem(PENDING_ATTEMPT);runtimeError('Could not resume application',err&&err.message?err.message:String(err));}
  }

  input.addEventListener('change',function(){var file=input.files&&input.files[0];if(file)inspectFile(file);});
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&!sheet.hidden)hideSheet();});
  bindNavigation();bindPickers();syncControls();setActive('home');app.setAttribute('data-ready','1');
  window.setTimeout(resumePendingRun,0);
})();
