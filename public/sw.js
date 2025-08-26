// sw.js — safer caching to prevent "stuck old version"
// Built: 2025-08-26T08:47:07.559988
const VERSION = 'v2025-08-26-01';
const PREFIX = 'loan';
const STATIC_CACHE = `${PREFIX}-static-${VERSION}`;
const RUNTIME_CACHE = `${PREFIX}-rt-${VERSION}`;

// Only pre-cache truly static, safe-to-cache assets (NO HTML/JS)
const PRECACHE_URLS = [
  '/manifest.webmanifest',
  '/style.css',
  '/admin.css',
  '/print.css',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(STATIC_CACHE);
    await cache.addAll(PRECACHE_URLS);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    // delete old caches
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k.startsWith(PREFIX) && k !== STATIC_CACHE && k !== RUNTIME_CACHE) ? caches.delete(k) : null));
    await self.clients.claim();
  })());
});

// Helper to decide if a request should bypass cache entirely
function isBypass(req) {
  const url = new URL(req.url);
  if (req.mode === 'navigate') return true;               // all navigation (HTML)
  if (url.pathname.endsWith('.html')) return true;        // any html
  if (url.pathname === '/sw.js') return true;             // this file
  if (url.pathname.startsWith('/api/')) return true;      // serverless functions
  if (/supabase\.co/.test(url.host)) return true;        // Supabase endpoints
  return false;
}

// Choose a strategy by destination
function strategyFor(req) {
  const dest = req.destination;
  if (dest === 'style' || dest === 'image' || dest === 'font') return 'cache-first';
  if (dest === 'script' || dest === 'worker') return 'network-first'; // prefer fresh JS
  return 'network-first';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  if (isBypass(req)) {
    // Always hit network for HTML/API/Supabase/sw.js
    event.respondWith(fetch(req));
    return;
  }

  const strat = strategyFor(req);
  if (strat === 'cache-first') {
    event.respondWith((async () => {
      const cache = await caches.open(STATIC_CACHE);
      const cached = await cache.match(req);
      if (cached) return cached;
      const resp = await fetch(req);
      if (resp && resp.status === 200) cache.put(req, resp.clone());
      return resp;
    })());
  } else { // network-first
    event.respondWith((async () => {
      const cache = await caches.open(RUNTIME_CACHE);
      try {
        const resp = await fetch(req, { cache: 'no-store' });
        if (resp && resp.status === 200) cache.put(req, resp.clone());
        return resp;
      } catch (e) {
        const cached = await cache.match(req) || await caches.match(req);
        if (cached) return cached;
        throw e;
      }
    })());
  }
});

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') self.skipWaiting();
});
