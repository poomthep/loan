// ultra-minimal SW for A2HS criteria
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());
// keep a fetch handler so some browsers treat as a PWA
self.addEventListener('fetch', () => {});
