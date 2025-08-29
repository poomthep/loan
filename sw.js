
/* Loan App Service Worker - robust precache
   Changelog v2024-12-19-2
   - Best-effort precache: cache items one-by-one, skip failures (was addAll which fails entire install)
   - Gentle logging for visibility
*/
const SW_VERSION = 'v2024-12-19-2';
const CACHE_NAME = `loan-app-cache-${SW_VERSION}`;

// Feel free to tailor this list; failures will be skipped safely.
const PRECACHE_URLS = (self.__PRECACHE_URLS && Array.isArray(self.__PRECACHE_URLS))
  ? self.__PRECACHE_URLS
  : [
      '/', '/index.html', '/admin.html', '/loan.html',
      '/manifest.webmanifest', '/sw-register.js',
      '/auth-manager.js', '/js/auth-manager.js',
      '/js/admin-manager-supabase.js', '/supabase-client.js', '/js/supabase-client.js',
    ];

// Do not precache cross-origin API endpoints
function sameOrigin(u) {
  try { return new URL(u, self.location.origin).origin === self.location.origin; }
  catch { return false; }
}

self.addEventListener('install', event => {
  console.log('Loan App Service Worker', SW_VERSION, 'installing...');
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    let ok = 0, fail = 0;
    for (const raw of PRECACHE_URLS) {
      const url = new URL(raw, self.location.origin).toString();
      if (!sameOrigin(url)) continue; // skip cross-origin
      try {
        const res = await fetch(url, { cache: 'no-cache' });
        if (res && res.ok) {
          await cache.put(url, res.clone());
          ok++;
        } else {
          fail++;
          console.warn('[SW] skip precache', url, res && res.status);
        }
      } catch (e) {
        fail++;
        console.warn('[SW] skip precache', url, e && e.message);
      }
    }
    console.log(`[SW] precache done: ${ok} cached, ${fail} skipped`);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', event => {
  console.log('Loan App Service Worker', SW_VERSION, 'activating...');
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names.filter(n => n.startsWith('loan-app-cache-') && n !== CACHE_NAME)
      .map(n => caches.delete(n)));
    await self.clients.claim();
  })());
});

// Cache-first for same-origin GET requests to static assets; network-only for Supabase APIs.
self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Bypass cross-origin
  if (url.origin !== location.origin) return;

  // Never cache admin API-like URLs (none here); we default to cache-first for same-origin assets.
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cached = await cache.match(req);
    if (cached) return cached;

    try {
      const res = await fetch(req);
      // Only cache OK responses
      if (res && res.ok && sameOrigin(req.url)) {
        cache.put(req, res.clone()).catch(()=>{});
      }
      return res;
    } catch (e) {
      // Offline fallback: try cache again (maybe matched by URL without search)
      const fallback = await cache.match(url.pathname);
      if (fallback) return fallback;
      throw e;
    }
  })());
});

self.addEventListener('message', (e) => {
  if (!e.data) return;
  if (e.data.type === 'GET_VERSION') {
    e.source && e.source.postMessage({ type: 'VERSION', version: SW_VERSION });
  } else if (e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
