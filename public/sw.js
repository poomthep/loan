// public/sw.js
const CACHE_NAME = 'loan-app-cache-v1';
// รายชื่อไฟล์ทั้งหมดที่ประกอบกันเป็นหน้าเว็บของเรา
const urlsToCache = [
  '/',
  '/index.html',
  '/admin.html',
  '/style.css',
  '/admin.css',
  '/print.css',
  '/app.js',
  '/admin.js',
  '/api.js',
  '/calc.js',
  '/exports-ui.js',
  '/format.js',
  '/render.js',
  '/session-guard.js',
  '/storage.js',
  '/supabase-client.js',
  '/sw-register.js',
  '/favicon.ico',
  '/manifest.webmanifest',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // ถ้าเจอใน Cache ให้ส่งกลับไปเลย
        if (response) {
          return response;
        }
        // ถ้าไม่เจอ ให้ไปโหลดจาก Network
        return fetch(event.request);
      })
  );
});

self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
  return self.clients.claim();
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});