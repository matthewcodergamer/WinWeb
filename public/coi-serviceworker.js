/* WinWeb on-demand cross-origin isolation service worker.
 * Runtime assets may use normal browser caching, but the app shell is always
 * network-fresh so an old iPhone/Safari service worker cannot pin WinWeb to a
 * stale runtime implementation after a GitHub Pages deploy.
 */
var WINWEB_SW_BUILD='20260906-sw4';

self.addEventListener('install',function(){
  self.skipWaiting();
});

self.addEventListener('activate',function(event){
  event.waitUntil(Promise.all([
    self.clients.claim(),
    caches.keys().then(function(keys){
      return Promise.all(keys.map(function(key){
        if(/^winweb[-.]/i.test(key))return caches.delete(key);
        return Promise.resolve(false);
      }));
    })
  ]));
});

self.addEventListener('message',function(event){
  var data=event.data||{};
  if(data.type==='SKIP_WAITING')self.skipWaiting();
  if(data.type==='WINWEB_SW_VERSION'&&event.source){
    try{event.source.postMessage({type:'WINWEB_SW_VERSION',build:WINWEB_SW_BUILD});}catch(_){}
  }
});

function decorate(response){
  if(!response||response.status===0)return response;
  var headers=new Headers(response.headers);
  headers.set('Cross-Origin-Opener-Policy','same-origin');
  headers.set('Cross-Origin-Embedder-Policy','require-corp');
  headers.set('Cross-Origin-Resource-Policy','same-origin');
  headers.set('X-WinWeb-Service-Worker',WINWEB_SW_BUILD);
  return new Response(response.body,{status:response.status,statusText:response.statusText,headers:headers});
}

function isShellRequest(request,url){
  if(request.mode==='navigate')return true;
  if(url.origin!==self.location.origin)return false;
  return /\/(?:index\.html|winweb-shell\.js|winweb-shell\.css|winweb-v\d+\.css|coi-serviceworker\.js)$/.test(url.pathname);
}

self.addEventListener('fetch',function(event){
  var request=event.request;
  if(request.cache==='only-if-cached'&&request.mode!=='same-origin')return;

  var url;
  try{url=new URL(request.url);}catch(_){url=null;}
  var fresh=!!url&&isShellRequest(request,url);
  var networkRequest=request;
  if(fresh){
    try{networkRequest=new Request(request,{cache:'no-store'});}catch(_){networkRequest=request;}
  }

  event.respondWith(fetch(networkRequest).then(function(response){
    return decorate(response);
  }).catch(function(primaryError){
    if(networkRequest!==request){
      return fetch(request).then(function(response){return decorate(response);});
    }
    throw primaryError;
  }));
});
