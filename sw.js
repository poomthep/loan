// sw.js — cache local assets (app shell)
const CACHE = 'promo-admin-v1';
const ASSETS = [
  './',
  './admin.html',
  './style.css',
  './admin.js',
  './manifest.webmanifest'
  // หมายเหตุ: ไฟล์ภายนอก (CDN fonts/supabase) ไม่แคชแบบ precache ที่นี่
];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE ? caches.delete(k) : Promise.resolve())))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  // cache-first เฉพาะไฟล์ใน origin เดียวกัน
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(cached => cached || fetch(e.request))
    );
  }
});
