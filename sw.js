'use strict';

const CACHE_NAME = 'aps-naati-study-ready-20260805-v2';
const PRECACHE = [
  "./",
  "./index.html",
  "./.nojekyll",
  "./404.html",
  "./app.js",
  "./app.js.backup-before-auth-emulator",
  "./app.js.backup-before-production-guard-rollout",
  "./app.js.backup-before-token-helper",
  "./app.js.backup-before-transcription-helper",
  "./content/dialogues.json",
  "./content/exam_info.json",
  "./content/languages.json",
  "./content/lesson0.json",
  "./content/packs/hi/dialogues.json",
  "./content/packs/hi/phrases.json",
  "./content/packs/hi/vocabulary.json",
  "./content/pilot50/batch01-runtime-overlay-v1.json",
  "./content/starter_phrases.json",
  "./content/starter_vocab.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./index.html",
  "./manifest.webmanifest",
  "./pilot50-runtime-overlay.js",
  "./scoring.js",
  "./study-hotfix-v2.css",
  "./study-hotfix-v2.js",
  "./styles.css",
  "./version.json"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll([...new Set(PRECACHE)]))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(
        keys
          .filter(key => key !== CACHE_NAME)
          .map(key => caches.delete(key))
      ))
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
          caches.open(CACHE_NAME)
            .then(cache => cache.put('./index.html', copy));
          return response;
        })
        .catch(() => caches.match('./index.html'))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request)
      .then(cached => cached || fetch(event.request).then(response => {
        if (response && response.ok) {
          const copy = response.clone();
          caches.open(CACHE_NAME)
            .then(cache => cache.put(event.request, copy));
        }
        return response;
      }))
  );
});
