// Minimal service worker for PWA installability
// キャッシュは行わず、インストール可能にするためだけに存在する
const CACHE_NAME = 'lineup-card-v1';

self.addEventListener('install', (e) => {
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(key => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// ネットワークファーストで動作（キャッシュしない）
self.addEventListener('fetch', (e) => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
