const VERSION = 'v2025-08-26-1';

self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Network-first for JS/CSS; do not cache HTML or API at all
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Never cache HTML or any API
  if (req.destination === 'document' || url.pathname.startsWith('/api/')) {
    return;
  }

  // For JS/CSS/worker: network-first with fallback
  if (['script','style','worker'].includes(req.destination)) {
    event.respondWith((async () => {
      try {
        const fresh = await fetch(req, { cache: 'no-store' });
        return fresh;
      } catch (e) {
        const cache = await caches.open('static-' + VERSION);
        const cached = await cache.match(req, { ignoreVary: true });
        if (cached) return cached;
        throw e;
      }
    })());
    return;
  }
});