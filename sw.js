'use strict';
const CACHE = 'koryosan-static-v5';
const ASSETS = [
  './','./index.html','./manifest.webmanifest',
  './styles.css?v=5','./firebase-auth.css?v=5','./firebase-config.js?v=5','./cloud-model.js?v=5','./firebase-client.js?v=5','./songs.js?v=5','./details.js?v=5','./metronome.js?v=5','./app.js?v=5',
  './icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png'
];
self.addEventListener('install',event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(ASSETS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
  event.waitUntil(Promise.all([
    caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('koryosan-static-')&&key!==CACHE).map(key=>caches.delete(key)))),
    self.clients.claim()
  ]));
});
self.addEventListener('fetch',event=>{
  const request=event.request;
  if(request.method!=='GET')return;
  if(new URL(request.url).origin!==self.location.origin)return;
  event.respondWith((async()=>{
    const cache=await caches.open(CACHE);
    try{
      const response=await fetch(request);
      if(response.ok)void cache.put(request,response.clone()).catch(()=>{});
      return response;
    }catch(_){
      return (await cache.match(request)) || (request.mode==='navigate'?await cache.match('./index.html'):Response.error());
    }
  })());
});
