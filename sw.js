/* sw.js – v3 (network-first for HTML; bypass cache for admin & supabase) */

const CACHE = 'pa-static-v3';
const PRECACHE = [
  '/', '/index.html',
  // ไม่ precache /admin.html เพื่อบังคับโหลดใหม่เสมอ
  '/icons/icon-192.png', '/icons/icon-512.png',
  '/manifest.webmanifest'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  const isHTML = req.mode === 'navigate' || req.destination === 'document';
  const isAdmin = url.pathname === '/admin.html' || url.pathname.startsWith('/admin');
  const isSupabase = url.hostname.includes('supabase.co') || url.hostname.includes('supabase.in');

  // 1) admin.html และทุกอย่างที่ยิงไป supabase → ไม่ cache, ตรงเน็ตเสมอ
  if (isAdmin || isSupabase || isHTML) {
    event.respondWith(fetch(req, { cache: 'no-store' }));
    return;
  }

  // 2) สินทรัพย์ทั่วไป → stale-while-revalidate
  event.respondWith(
    caches.match(req).then((cached) => {
      const fetchPromise = fetch(req).then((res) => {
        if (req.method === 'GET' && res && res.ok && res.type !== 'opaque') {
          const clone = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, clone));
        }
        return res;
      }).catch(() => cached);
      return cached || fetchPromise;
    })
  );
});
