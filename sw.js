const CACHE='aps-naati-ccl-v2.0.5-curated-phrases';
const ASSETS=['./','./index.html','./styles.css','./scoring.js','./app.js','./manifest.webmanifest','./icon.svg','./icon-192.png','./icon-512.png','./content/dialogues.json','./content/starter_vocab.json','./content/starter_phrases.json','./content/exam_info.json','./content/lesson0.json','./version.json'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{if(e.request.method!=='GET')return;e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request).then(r=>{const copy=r.clone();caches.open(CACHE).then(c=>c.put(e.request,copy));return r;}).catch(()=>caches.match('./index.html'))));});
