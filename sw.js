// sw.js - Service Worker for Loan App
// ========================================
// PROGRESSIVE WEB APP SERVICE WORKER
// ========================================

const VERSION = 'v2025-08-29-1';
const CACHE_NAME = `loan-app-${VERSION}`;

// ไฟล์ที่ต้อง cache สำหรับ offline
const STATIC_CACHE_FILES = [
  // Core HTML files
  '/index.html',
  '/loan.html',
  '/admin.html',
  
  // CSS files
  '/css/styles.css',
  
  // JavaScript files (core only)
  '/js/supabase-client.js',
  '/js/auth-manager.js',
  '/js/data-manager.js',
  '/js/loan-calculator-supabase.js',
  '/js/loan-app-manager.js',
  '/js/admin-manager-supabase.js',
  '/js/session-guard.js',
  
  // PWA files
  '/manifest.webmanifest',
  
  // External CDN resources (cache for offline)
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2',
  'https://cdn.jsdelivr.net/npm/tailwindcss@3.3.0/dist/tailwind.min.css'
];

// ไฟล์ที่ไม่ต้อง cache
const EXCLUDE_FROM_CACHE = [
  '/sw.js',
  '/sw-register.js'
];

// ========================================
// SERVICE WORKER EVENTS
// ========================================

/**
 * Install Event - ติดตั้ง Service Worker
 */
self.addEventListener('install', (event) => {
  console.log('🔧 Service Worker installing...');
  
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('📦 Caching static files...');
        
        // กรองไฟล์ที่ไม่ต้อง cache ออก
        const filesToCache = STATIC_CACHE_FILES.filter(
          file => !EXCLUDE_FROM_CACHE.some(exclude => file.includes(exclude))
        );
        
        return cache.addAll(filesToCache);
      })
      .then(() => {
        console.log('✅ Static files cached successfully');
        // บังคับให้ Service Worker ใหม่เริ่มทำงานทันที
        self.skipWaiting();
      })
      .catch((error) => {
        console.error('❌ Failed to cache static files:', error);
      })
  );
});

/**
 * Activate Event - เปิดใช้งาน Service Worker
 */
self.addEventListener('activate', (event) => {
  console.log('🚀 Service Worker activating...');
  
  event.waitUntil(
    Promise.all([
      // ลบ cache เก่า
      caches.keys().then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== CACHE_NAME) {
              console.log('🗑️ Deleting old cache:', cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      }),
      
      // ครอบคลุม clients ทั้งหมด
      self.clients.claim()
    ]).then(() => {
      console.log('✅ Service Worker activated successfully');
    })
  );
});

/**
 * Fetch Event - จัดการ network requests
 */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);
  
  // ไม่จัดการ requests ที่ไม่ใช่ HTTP/HTTPS
  if (!request.url.startsWith('http')) {
    return;
  }
  
  // ไม่ cache API requests จาก Supabase
  if (url.hostname.includes('supabase.co')) {
    return handleSupabaseRequest(event);
  }
  
  // ไม่ cache WebSocket connections
  if (request.url.includes('ws://') || request.url.includes('wss://')) {
    return;
  }

  // จัดการตามประเภทของ request
  if (request.destination === 'document') {
    event.respondWith(handleDocumentRequest(request));
  } else if (['script', 'style', 'worker'].includes(request.destination)) {
    event.respondWith(handleStaticAssetRequest(request));
  } else {
    event.respondWith(handleOtherRequest(request));
  }
});

/**
 * จัดการ HTML documents - Network First with Cache Fallback
 */
async function handleDocumentRequest(request) {
  try {
    // พยายามดึงจาก network ก่อน
    const networkResponse = await fetch(request, {
      cache: 'no-store' // ไม่ cache HTML เพื่อให้ได้เนื้อหาล่าสุด
    });
    
    if (networkResponse.ok) {
      return networkResponse;
    }
    
    throw new Error('Network response not ok');
    
  } catch (error) {
    console.warn('📡 Network failed, trying cache:', request.url);
    
    // หาก network ล้มเหลว ให้ใช้ cache
    const cachedResponse = await caches.match(request);
    
    if (cachedResponse) {
      return cachedResponse;
    }
    
    // ถ้าไม่มีใน cache ให้ fallback ไป index.html
    const indexCache = await caches.match('/index.html');
    if (indexCache) {
      return indexCache;
    }
    
    // สุดท้ายถ้าไม่มีอะไรเลย
    return new Response('App is offline and no cached content available', {
      status: 503,
      statusText: 'Service Unavailable'
    });
  }
}

/**
 * จัดการ Static assets - Cache First with Network Fallback
 */
async function handleStaticAssetRequest(request) {
  try {
    // ลองหาใน cache ก่อน
    const cachedResponse = await caches.match(request, {
      ignoreVary: true,
      ignoreSearch: true
    });
    
    if (cachedResponse) {
      // หากมีใน cache ให้ใช้เลย แต่ update ใน background
      fetchAndUpdateCache(request);
      return cachedResponse;
    }
    
    // ถ้าไม่มีใน cache ให้ดึงจาก network
    return await fetchAndCache(request);
    
  } catch (error) {
    console.error('Failed to handle static asset:', error);
    
    // ถ้าทั้ง cache และ network ล้มเหลว
    return new Response('Asset not available offline', {
      status: 404,
      statusText: 'Not Found'
    });
  }
}

/**
 * จัดการ requests อื่นๆ - Network First
 */
async function handleOtherRequest(request) {
  try {
    return await fetch(request);
  } catch (error) {
    // ลองหาใน cache
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }
    
    throw error;
  }
}

/**
 * จัดการ Supabase requests - ไม่ cache, ผ่านตรงๆ
 */
function handleSupabaseRequest(event) {
  // ไม่ cache Supabase API calls เพื่อให้ได้ข้อมูลล่าสุดเสมอ
  return; // ให้ browser จัดการเอง
}

/**
 * Fetch และ cache ไฟล์ใหม่
 */
async function fetchAndCache(request) {
  const response = await fetch(request, {
    cache: 'no-store'
  });
  
  if (response.ok && request.method === 'GET') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  
  return response;
}

/**
 * Update cache ใน background
 */
function fetchAndUpdateCache(request) {
  fetch(request, { cache: 'no-store' })
    .then(response => {
      if (response.ok) {
        return caches.open(CACHE_NAME).then(cache => {
          cache.put(request, response.clone());
        });
      }
    })
    .catch(() => {
      // ไม่ต้องทำอะไรถ้า update ล้มเหลว
    });
}

// ========================================
// MESSAGE HANDLING
// ========================================

/**
 * รับ messages จาก main thread
 */
self.addEventListener('message', (event) => {
  const { data } = event;
  
  switch (data?.type) {
    case 'SKIP_WAITING':
      console.log('⏭️ Skipping waiting...');
      self.skipWaiting();
      break;
      
    case 'GET_VERSION':
      event.ports[0].postMessage({ version: VERSION });
      break;
      
    case 'CLEAR_CACHE':
      clearAllCaches().then(() => {
        event.ports[0].postMessage({ success: true });
      });
      break;
      
    case 'CACHE_STATUS':
      getCacheStatus().then(status => {
        event.ports[0].postMessage(status);
      });
      break;
      
    default:
      console.log('📨 Unknown message:', data);
  }
});

/**
 * ล้าง cache ทั้งหมด
 */
async function clearAllCaches() {
  const cacheNames = await caches.keys();
  await Promise.all(
    cacheNames.map(cacheName => {
      console.log('🗑️ Clearing cache:', cacheName);
      return caches.delete(cacheName);
    })
  );
  console.log('✅ All caches cleared');
}

/**
 * ดูสถานะ cache
 */
async function getCacheStatus() {
  const cache = await caches.open(CACHE_NAME);
  const keys = await cache.keys();
  
  return {
    version: VERSION,
    cacheName: CACHE_NAME,
    cachedFiles: keys.length,
    files: keys.map(req => req.url)
  };
}

// ========================================
// BACKGROUND SYNC (Future Enhancement)
// ========================================

/**
 * Background Sync - สำหรับ sync ข้อมูลเมื่อออนไลน์
 */
self.addEventListener('sync', (event) => {
  console.log('🔄 Background sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'background-sync-calculations':
      event.waitUntil(syncCalculations());
      break;
      
    case 'background-sync-user-data':
      event.waitUntil(syncUserData());
      break;
  }
});

async function syncCalculations() {
  // TODO: Implement calculation sync when online
  console.log('🔄 Syncing calculations...');
}

async function syncUserData() {
  // TODO: Implement user data sync when online
  console.log('🔄 Syncing user data...');
}

// ========================================
// PUSH NOTIFICATIONS (Future Enhancement)
// ========================================

/**
 * Push notifications - สำหรับแจ้งเตือนโปรโมชันใหม่
 */
self.addEventListener('push', (event) => {
  console.log('📱 Push notification received:', event);
  
  const options = {
    body: event.data?.text() || 'New promotion available!',
    icon: '/icons/icon-192.png',
    badge: '/icons/badge-72.png',
    tag: 'loan-app-notification',
    data: event.data?.json() || {},
    actions: [
      {
        action: 'open',
        title: 'Open App',
        icon: '/icons/icon-96.png'
      },
      {
        action: 'dismiss',
        title: 'Dismiss'
      }
    ]
  };
  
  event.waitUntil(
    self.registration.showNotification('Loan App', options)
  );
});

/**
 * จัดการการคลิก notification
 */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'open') {
    event.waitUntil(
      clients.openWindow('/loan.html')
    );
  }
});

// ========================================
// ERROR HANDLING
// ========================================

/**
 * จัดการ errors
 */
self.addEventListener('error', (event) => {
  console.error('💥 Service Worker error:', event.error);
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('💥 Unhandled promise rejection in SW:', event.reason);
});

// ========================================
// PERIODIC BACKGROUND SYNC (Future Enhancement)
// ========================================

/**
 * Periodic background sync - อัพเดตข้อมูลเป็นระยะ
 */
self.addEventListener('periodicsync', (event) => {
  console.log('⏰ Periodic sync triggered:', event.tag);
  
  switch (event.tag) {
    case 'update-rates':
      event.waitUntil(updateInterestRates());
      break;
      
    case 'cleanup-old-data':
      event.waitUntil(cleanupOldData());
      break;
  }
});

async function updateInterestRates() {
  // TODO: Implement periodic rate updates
  console.log('📈 Updating interest rates...');
}

async function cleanupOldData() {
  // TODO: Implement data cleanup
  console.log('🧹 Cleaning up old data...');
}

// ========================================
// INITIALIZATION
// ========================================

console.log(`🚀 Loan App Service Worker ${VERSION} loaded`);
console.log('📦 Will cache:', STATIC_CACHE_FILES.length, 'files');
console.log('🚫 Will exclude:', EXCLUDE_FROM_CACHE.length, 'patterns');