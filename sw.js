// Minimal service worker (no fetch handler; ไม่มี warning no-op)
self.addEventListener('install', (e) => self.skipWaiting());
self.addEventListener('activate', (e) => self.clients.claim());
