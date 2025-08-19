// sw.js

const CACHE_NAME = 'admin-cache-v1';
const ASSETS_TO_CACHE = [
    // สามารถเพิ่มไฟล์ static อื่นๆ ที่นี่ได้ เช่น CSS, JS ภายนอก
];

// รายการ URL ที่จะไม่ให้แคชเด็ดขาด (Network Only)
const BYPASS_CACHE_PATTERNS = [
    /^\/admin\.html$/,
    /^\/admin(\/.*)?$/, // ทุก path ที่ขึ้นต้นด้วย /admin
    /.*\.supabase\.(co|in)$/, // ทุกโดเมนของ Supabase
];

// ฟังก์ชันตรวจสอบว่า request ควรถูก bypass หรือไม่
const shouldBypassCache = (request) => {
    const url = new URL(request.url);
    // 1. Bypass สำหรับ request ที่เป็น navigate mode (การเปิดหน้าเว็บโดยตรง)
    if (request.mode === 'navigate') {
        console.log(`[SW] Bypassing cache for navigation request: ${url.pathname}`);
        return true;
    }
    // 2. Bypass ตาม pattern ที่กำหนด
    return BYPASS_CACHE_PATTERNS.some(pattern => pattern.test(url.pathname) || pattern.test(url.hostname));
};

// --- Event Listeners ---

// install: ถูกเรียกเมื่อติดตั้ง SW ครั้งแรก
self.addEventListener('install', (event) => {
    console.log('[SW] Installing...');
    // บังคับให้ SW ใหม่ทำงานทันที ไม่ต้องรอให้แท็บเก่าปิด
    event.waitUntil(self.skipWaiting());
});

// activate: ถูกเรียกเมื่อ SW เริ่มทำงาน
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating...');
    // เคลียร์แคชเก่า
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            // ควบคุม client ทั้งหมดทันที
            return self.clients.claim();
        })
    );
});

// fetch: ถูกเรียกทุกครั้งที่มีการร้องขอ resource
self.addEventListener('fetch', (event) => {
    if (shouldBypassCache(event.request)) {
        // ถ้าเข้าเงื่อนไข bypass -> ไปที่ network อย่างเดียว
        return event.respondWith(fetch(event.request));
    }

    // กลยุทธ์: Stale-While-Revalidate สำหรับ resource อื่นๆ
    event.respondWith(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.match(event.request).then((cachedResponse) => {
                const fetchPromise = fetch(event.request).then((networkResponse) => {
                    // ถ้า fetch สำเร็จ, อัปเดต cache
                    cache.put(event.request, networkResponse.clone());
                    return networkResponse;
                });

                // ถ้ามีใน cache ให้ส่งกลับไปก่อน แล้วค่อยรอ fetchPromise อัปเดตเบื้องหลัง
                return cachedResponse || fetchPromise;
            });
        })
    );
});