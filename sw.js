'use strict';

const APP_CACHE = 'aps-naati-v21-3-hindi-dialogue-rebuild-shell';
const CONTENT_CACHE = 'aps-naati-content-runtime-v21-3-hindi-dialogue-rebuild';
const PRECACHE = [
  './',
  './index.html',
  './404.html',
  './manifest.webmanifest',
  './icon.svg',
  './icon-192.png',
  './icon-512.png',
  './styles.css',
  './study-hotfix-v5.css',
  './cloud-sync-v11.css',
  './study-progress-v9.css',
  './reliability-v15.css',
  './content-library-v17.css',
  './original-source-v18.css',
  './my-vocabs-v19-4.css',
  './online-v20.css',
  './online-v20-1.css',
  './ui-v20-2.css',
  './voice-manager-v21.css',
  './instant-word-lookup-v21-2.css',
  './practice-controls-v21-2-1.css',
  './recent-dialogues-v21-3.css',
  './scoring.js',
  './app.js',
  './study-hotfix-v5.js',
  './study-progress-v9.js',
  './cloud-sync-v11.js',
  './reliability-v15.js',
  './content-library-v17.js',
  './original-source-v18.js',
  './my-vocabs-v19-4.js',
  './online-v20.js',
  './online-v20-1.js',
  './ui-v20-2.js',
  './voice-manager-v21.js',
  './instant-word-lookup-v21-2.js',
  './practice-controls-v21-2-1.js',
  './recent-dialogues-v21-3.js',
  './content/languages.json',
  './content/exam_info.json',
  './content/lesson0.json',
  './content/online-manifest-v20.json',
  './version.json'
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(APP_CACHE);
    const requests = PRECACHE.map(path => new Request(new URL(path, self.registration.scope).href, { cache: 'reload' }));
    await cache.addAll(requests);
    await self.skipWaiting();
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    const contentCache = await caches.open(CONTENT_CACHE);
    // Preserve already-downloaded language packs from older monolithic caches so
    // upgrading the UI does not force another multi-megabyte download.
    for (const key of keys) {
      if (key === APP_CACHE || key === CONTENT_CACHE) continue;
      try {
        const old = await caches.open(key);
        const requests = await old.keys();
        for (const request of requests) {
          const url = new URL(request.url);
          if (!/\/content\/packs\/[^/]+\/.*\.json$/i.test(url.pathname)) continue;
          // V21.3 Hindi rebuild: do not migrate the old Hindi dialogue or dialogue-vocabulary files.
          // Both changed materially and must be fetched fresh after this update.
          if (/\/content\/packs\/hi\/(?:dialogues|dialogue-vocabulary)\.json$/i.test(url.pathname)) continue;
          const response = await old.match(request);
          if (response) await contentCache.put(request, response.clone());
        }
      } catch {}
      await caches.delete(key);
    }
    await self.clients.claim();
  })());
});

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CONTENT_CACHE);
  const cached = await cache.match(request);
  const network = fetch(request).then(response => {
    if (response && response.ok) cache.put(request, response.clone());
    return response;
  }).catch(() => null);
  if (cached) {
    // Refresh quietly; navigation/content rendering does not wait for the network.
    network.catch(() => {});
    return cached;
  }
  return (await network) || new Response('', { status: 503, statusText: 'Offline' });
}

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request).then(response => {
        const copy = response.clone();
        caches.open(APP_CACHE).then(cache => cache.put('./index.html', copy));
        return response;
      }).catch(() => caches.match('./index.html'))
    );
    return;
  }


  if (url.pathname.endsWith('/version.json') || url.pathname.endsWith('/content/online-manifest-v20.json')) {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response && response.ok) caches.open(APP_CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }).catch(() => caches.match(event.request)));
    return;
  }

  if (/\/content\/owner-content-v16(?:-[^/]+)?\.json$/i.test(url.pathname)) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' }).then(response => {
        if (response && response.ok) caches.open(CONTENT_CACHE).then(cache => cache.put(event.request, response.clone()));
        return response;
      }).catch(() => caches.match(event.request))
    );
    return;
  }

  // Large language-pack JSON is cached independently from the app shell. A tiny
  // UI update no longer forces ~19 MB of dialogue/vocabulary content to recache.
  if (/\/content\/packs\/[^/]+\/.*\.json$/i.test(url.pathname)) {
    event.respondWith(staleWhileRevalidate(event.request));
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && response.ok) caches.open(APP_CACHE).then(cache => cache.put(event.request, response.clone()));
      return response;
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
    const existing = windows.find(client => 'focus' in client);
    if (existing) return existing.focus();
    return clients.openWindow('./');
  }));
});
