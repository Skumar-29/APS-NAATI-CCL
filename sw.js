'use strict';

const CACHE_NAME = 'aps-naati-my-vocabs-20260902-v19-3';
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
  './my-vocabs-v19-3.css',
  './scoring.js',
  './app.js',
  './study-hotfix-v5.js',
  './study-progress-v9.js',
  './cloud-sync-v11.js',
  './reliability-v15.js',
  './content-library-v17.js',
  './original-source-v18.js',
  './my-vocabs-v19-3.js',
  './content/languages.json',
  './content/exam_info.json',
  './content/lesson0.json',
  './content/packs/hi/dialogues.json',
  './content/packs/hi/vocabulary.json',
  './content/packs/hi/phrases.json',
  './content/packs/hi/general-vocabulary.json',
  './content/packs/hi/dialogue-vocabulary.json',
  './version.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;

  if (event.request.mode === 'navigate') {
    event.respondWith(
      fetch(event.request)
        .then(response => {
          const copy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  // Owner edits are deliberately network-first so GitHub-published content changes
  // are not hidden behind an older application cache.
  if (url.pathname.endsWith('/content/owner-content-v16.json')) {
    event.respondWith(
      fetch(event.request, { cache: 'no-store' })
        .then(response => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
      if (response && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    }))
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(windows => {
      const existing = windows.find(client => 'focus' in client);
      if (existing) return existing.focus();
      return clients.openWindow('./');
    })
  );
});
