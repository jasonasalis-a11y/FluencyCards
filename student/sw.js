// Bump SHELL_VERSION on every release that changes index.html/manifest, so
// returning users get fresh app code instead of being stuck on old cached
// code forever. Course content (JSON/audio/images) is unaffected by this —
// that stays cache-first via the runtime cache below, same as before.
const SHELL_VERSION='0.9.6.9';
const SHELL_CACHE='fe-shell-'+SHELL_VERSION;
const RUNTIME_CACHE='fe-runtime';
const SHELL_FILES=['/','/index.html','/manifest.webmanifest'];

self.addEventListener('install',e=>e.waitUntil(caches.open(SHELL_CACHE).then(c=>c.addAll(SHELL_FILES)).then(()=>self.skipWaiting())));

self.addEventListener('activate',e=>e.waitUntil((async()=>{
  const keys=await caches.keys();
  await Promise.all(keys.filter(k=>k.startsWith('fe-shell-')&&k!==SHELL_CACHE).map(k=>caches.delete(k)));
  await self.clients.claim();
})()));

self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const isShell=e.request.mode==='navigate'||SHELL_FILES.includes(url.pathname);
  if(isShell){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(e.request);
        caches.open(SHELL_CACHE).then(c=>c.put(e.request,fresh.clone())).catch(()=>{});
        return fresh;
      }catch(err){
        const cached=await caches.match(e.request,{ignoreSearch:true});
        if(cached)return cached;
        throw err;
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    const cached=await caches.match(e.request);
    if(cached)return cached;
    const response=await fetch(e.request);
    if(url.pathname.startsWith('/media/'))return response;
    const copy=response.clone();
    caches.open(RUNTIME_CACHE).then(c=>c.put(e.request,copy)).catch(()=>{});
    return response;
  })());
});
