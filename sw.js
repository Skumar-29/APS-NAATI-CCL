'use strict';

const CACHE_NAME = 'aps-naati-study-ready-20260807-v6';
const PRECACHE = [
  "./",
  "./index.html",
  "./404.html",
  "./APS_NAATI_GITHUB_STUDY_READY_BUILD_REPORT.json",
  "./BETA_PRIVACY_NOTICE.md",
  "./DIALOGUE_COMPARISON_AUDIT_V2.0.3.csv",
  "./FRIENDS_TEST_CHECKLIST.md",
  "./GITHUB_UPLOAD_STEPS.txt",
  "./PHRASE_AUDIT_V2.0.5.csv",
  "./PHRASE_LIBRARY_METHOD_V2.0.5.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V4.md",
  "./QA_REPORT_GITHUB_STUDY_READY_V5.md",
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
  "./study-hotfix-v5.css",
  "./study-hotfix-v5.js",
  "./styles.css",
  "./version.json"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll([...new Set(PRECACHE)])).then(() => self.skipWaiting()));
});
self.addEventListener('message', event => { if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting(); });
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('aps-naati-study-ready-') && key !== CACHE_NAME).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, {cache:'no-store'}).then(response => { const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put('./index.html',copy)); return response; }).catch(() => caches.match('./index.html')));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if(response && response.ok){ const copy=response.clone(); caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy)); } return response; })));
});
