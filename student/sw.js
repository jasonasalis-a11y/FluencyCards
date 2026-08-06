const C='fe-shell-0.9.6.6';
self.addEventListener('install',e=>e.waitUntil(caches.open(C).then(c=>c.addAll(['/','/index.html','/manifest.webmanifest']))));
self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith((async()=>{const cached=await caches.match(e.request);if(cached)return cached;const response=await fetch(e.request);if(new URL(e.request.url).pathname.startsWith('/media/'))return response;const copy=response.clone();caches.open(C).then(c=>c.put(e.request,copy)).catch(()=>{});return response})())});
