'use strict';

const CACHE_NAME = 'aps-naati-natural-hindi-20260809-v14';
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./APS_NAATI_GITHUB_STUDY_READY_BUILD_REPORT.json",
  "./BETA_PRIVACY_NOTICE.md",
  "./DIALOGUE_COMPARISON_AUDIT_V2.0.3.csv",
  "./FIREBASE_CLOUD_SYNC_SETUP.txt",
  "./FRIENDS_TEST_CHECKLIST.md",
  "./GITHUB_UPLOAD_STEPS.txt",
  "./PHRASE_AUDIT_V2.0.5.csv",
  "./PHRASE_LIBRARY_METHOD_V2.0.5.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V4.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V5.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V6.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V7.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V8.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V9.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V11.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V12.md",
  "./QA_REPORT_V2.0.3.md",
  "./QA_REPORT_V2.0.4.md",
  "./QA_REPORT_V2.0.5.md",
  "./QA_REPORT_V2.0.6.md",
  "./QA_REPORT_V2.0.7.md",
  "./README.md",
  "./README.txt",
  "./UPDATE_NOTES_V2.0.3.md",
  "./UPDATE_NOTES_V2.0.4.md",
  "./UPDATE_NOTES_V2.0.5.md",
  "./UPDATE_NOTES_V2.0.6.md",
  "./UPDATE_NOTES_V2.0.7.md",
  "./UPLOAD_THIS_VERSION.txt",
  "./VOCABULARY_AUDIT_V2.0.3.csv",
  "./app.js",
  "./cloud-sync-v11.css",
  "./cloud-sync-v11.js",
  "./content/dialogues.json",
  "./content/exam_info.json",
  "./content/languages.json",
  "./content/lesson0.json",
  "./content/packs/hi/dialogues.json",
  "./content/packs/hi/phrases.json",
  "./content/packs/hi/vocabulary.json",
"./content/starter_phrases.json",
  "./content/starter_vocab.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon.svg",
  "./manifest.webmanifest",
"./scoring.js",
  "./study-hotfix-v5.css",
  "./study-hotfix-v5.js",
  "./study-progress-v9.css",
  "./study-progress-v9.js",
  "./styles.css",
  "./version.json",
  "./QA_REPORT_GITHUB_RELIABILITY_V13.json",
  "./QA_REPORT_GITHUB_RELIABILITY_V13.md",
  "./CONTENT_RELIABILITY_V13.md",
  "./content/packs/hi/general-vocabulary.json",
  "./reliability-v14.js",
  "./reliability-v14.css"
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
