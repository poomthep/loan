// sw-register.js - Service Worker Registration
// ========================================
// SERVICE WORKER REGISTRATION & MANAGEMENT
// ========================================

/**
 * ลงทะเบียน Service Worker สำหรับ PWA functionality
 */
export async function registerServiceWorker() {
  // ตรวจสอบว่า browser รองรับ Service Worker หรือไม่
  if (!('serviceWorker' in navigator)) {
    console.warn('🚫 Service Worker not supported in this browser');
    return false;
  }

  try {
    console.log('🔧 Registering Service Worker...');
    
    // ลงทะเบียน Service Worker
    const registration = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none' // ไม่ cache sw.js เพื่อให้ได้เวอร์ชันใหม่เสมอ
    });

    console.log('✅ Service Worker registered successfully:', registration);

    // จัดการ Service Worker ที่รออยู่
    if (registration.waiting) {
      console.log('⏳ Service Worker is waiting, activating...');
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
    }

    // ฟัง update ของ Service Worker
    registration.addEventListener('updatefound', () => {
      console.log('🔄 Service Worker update found');
      handleServiceWorkerUpdate(registration);
    });

    // ฟังการเปลี่ยนแปลง controller
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      console.log('🔄 Service Worker controller changed, reloading...');
      
      // แสดงการแจ้งเตือนก่อน reload
      showUpdateNotification(() => {
        window.location.reload();
      });
    });

    // ตรวจสอบ updates เป็นระยะ
    setInterval(() => {
      registration.update();
    }, 60000); // ตรวจสอบทุก 1 นาที

    // เพิ่ม PWA install prompt
    setupPWAInstallPrompt();

    // Setup message channel กับ Service Worker
    setupServiceWorkerMessaging(registration);

    return registration;

  } catch (error) {
    console.error('❌ Service Worker registration failed:', error);
    return false;
  }
}

/**
 * จัดการ Service Worker update
 */
function handleServiceWorkerUpdate(registration) {
  const newWorker = registration.installing;
  
  if (!newWorker) return;

  newWorker.addEventListener('statechange', () => {
    console.log('🔄 New Service Worker state:', newWorker.state);
    
    if (newWorker.state === 'installed') {
      if (navigator.serviceWorker.controller) {
        // มี SW ใหม่พร้อมใช้งาน
        console.log('🆕 New Service Worker installed');
        showUpdateAvailableNotification(newWorker);
      } else {
        // SW ใหม่ครั้งแรก
        console.log('✅ Service Worker installed for the first time');
      }
    }
  });
}

/**
 * แสดงการแจ้งเตือนว่ามี update ใหม่
 */
function showUpdateAvailableNotification(newWorker) {
  // สร้าง notification element
  const notification = document.createElement('div');
  notification.id = 'sw-update-notification';
  notification.className = 'sw-update-notification';
  notification.innerHTML = `
    <div class="sw-notification-content">
      <div class="sw-notification-text">
        <strong>🚀 App Update Available!</strong>
        <p>A new version of Loan App is ready. Click update to get the latest features.</p>
      </div>
      <div class="sw-notification-actions">
        <button id="sw-update-btn" class="btn success">Update Now</button>
        <button id="sw-dismiss-btn" class="btn outline">Later</button>
      </div>
    </div>
  `;

  // เพิ่ม styles
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: white;
    border: 1px solid #007bff;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.3);
    padding: 20px;
    max-width: 400px;
    z-index: 10000;
    animation: slideIn 0.3s ease-out;
  `;

  // เพิ่ม CSS animation
  if (!document.getElementById('sw-notification-styles')) {
    const styles = document.createElement('style');
    styles.id = 'sw-notification-styles';
    styles.textContent = `
      @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
      }
      .sw-notification-content {
        display: flex;
        flex-direction: column;
        gap: 15px;
      }
      .sw-notification-text {
        color: #333;
      }
      .sw-notification-text strong {
        color: #007bff;
        display: block;
        margin-bottom: 8px;
      }
      .sw-notification-text p {
        margin: 0;
        font-size: 0.9em;
        line-height: 1.4;
      }
      .sw-notification-actions {
        display: flex;
        gap: 10px;
      }
      .sw-notification-actions button {
        flex: 1;
        padding: 8px 16px;
        border-radius: 6px;
        border: none;
        cursor: pointer;
        font-weight: 500;
        transition: all 0.2s;
      }
      .sw-notification-actions .btn.success {
        background: #28a745;
        color: white;
      }
      .sw-notification-actions .btn.success:hover {
        background: #218838;
      }
      .sw-notification-actions .btn.outline {
        background: transparent;
        color: #6c757d;
        border: 1px solid #6c757d;
      }
      .sw-notification-actions .btn.outline:hover {
        background: #6c757d;
        color: white;
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(notification);

  // Handle update button click
  document.getElementById('sw-update-btn').addEventListener('click', () => {
    notification.remove();
    
    // แจ้ง Service Worker ให้ skip waiting
    newWorker.postMessage({ type: 'SKIP_WAITING' });
    
    // แสดง loading
    showUpdateProgress();
  });

  // Handle dismiss button click
  document.getElementById('sw-dismiss-btn').addEventListener('click', () => {
    notification.remove();
  });

  // Auto dismiss after 30 seconds
  setTimeout(() => {
    if (notification.parentNode) {
      notification.remove();
    }
  }, 30000);
}

/**
 * แสดงการแจ้งเตือนหลังจาก update เสร็จ
 */
function showUpdateNotification(callback) {
  const notification = document.createElement('div');
  notification.className = 'sw-update-complete';
  notification.innerHTML = `
    <div style="
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: white;
      padding: 30px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.3);
      text-align: center;
      z-index: 10001;
      max-width: 300px;
    ">
      <div style="font-size: 2em; margin-bottom: 15px;">🎉</div>
      <h3 style="margin: 0 0 10px 0; color: #333;">Update Complete!</h3>
      <p style="margin: 0 0 20px 0; color: #666; line-height: 1.4;">
        Loan App has been updated with the latest features and improvements.
      </p>
      <button onclick="this.parentElement.parentElement.remove(); ${callback ? 'arguments[0]()' : ''}" 
              style="
                background: #007bff;
                color: white;
                border: none;
                padding: 10px 20px;
                border-radius: 6px;
                cursor: pointer;
                font-weight: 500;
              ">
        Continue
      </button>
    </div>
    <div style="
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.5);
      z-index: 10000;
    "></div>
  `;
  
  document.body.appendChild(notification);
}

/**
 * แสดง progress ระหว่าง update
 */
function showUpdateProgress() {
  const progress = document.createElement('div');
  progress.innerHTML = `
    <div style="
      position: fixed;
      top: 20px;
      right: 20px;
      background: white;
      border-radius: 8px;
      padding: 15px 20px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      z-index: 10000;
      display: flex;
      align-items: center;
      gap: 10px;
    ">
      <div class="loading-spinner" style="
        width: 16px;
        height: 16px;
        border: 2px solid #f3f3f3;
        border-top: 2px solid #007bff;
        border-radius: 50%;
        animation: spin 1s linear infinite;
      "></div>
      <span style="color: #333; font-weight: 500;">Updating app...</span>
    </div>
  `;

  if (!document.getElementById('spinner-styles')) {
    const spinnerStyles = document.createElement('style');
    spinnerStyles.id = 'spinner-styles';
    spinnerStyles.textContent = `
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `;
    document.head.appendChild(spinnerStyles);
  }

  document.body.appendChild(progress);
}

/**
 * ตั้งค่า PWA Install Prompt
 */
function setupPWAInstallPrompt() {
  let deferredPrompt;
  
  // ฟัง beforeinstallprompt event
  window.addEventListener('beforeinstallprompt', (e) => {
    console.log('📱 PWA install prompt available');
    
    // เก็บ event ไว้ใช้ภายหลัง
    deferredPrompt = e;
    e.preventDefault();
    
    // แสดง install button หลังจาก 5 วินาที
    setTimeout(() => {
      showPWAInstallButton(deferredPrompt);
    }, 5000);
  });

  // ฟัง appinstalled event
  window.addEventListener('appinstalled', () => {
    console.log('✅ PWA installed successfully');
    deferredPrompt = null;
    
    // แสดงการแจ้งเตือน
    showNotification('📱 App installed successfully! You can now use Loan App offline.', 'success');
  });
}

/**
 * แสดงปุ่ม Install PWA
 */
function showPWAInstallButton(deferredPrompt) {
  const installButton = document.createElement('button');
  installButton.id = 'pwa-install-btn';
  installButton.innerHTML = '📱 Install App';
  installButton.className = 'pwa-install-button';
  installButton.style.cssText = `
    position: fixed;
    bottom: 20px;
    right: 20px;
    background: #007bff;
    color: white;
    border: none;
    padding: 12px 20px;
    border-radius: 25px;
    font-weight: 500;
    cursor: pointer;
    box-shadow: 0 4px 12px rgba(0, 123, 255, 0.4);
    z-index: 1000;
    animation: bounceIn 0.6s ease-out;
    transition: all 0.3s ease;
  `;

  installButton.addEventListener('mouseenter', () => {
    installButton.style.transform = 'translateY(-2px)';
    installButton.style.boxShadow = '0 6px 16px rgba(0, 123, 255, 0.5)';
  });

  installButton.addEventListener('mouseleave', () => {
    installButton.style.transform = 'translateY(0)';
    installButton.style.boxShadow = '0 4px 12px rgba(0, 123, 255, 0.4)';
  });

  installButton.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // แสดง install prompt
    deferredPrompt.prompt();
    
    // รอผลตอบ
    const { outcome } = await deferredPrompt.userChoice;
    console.log('PWA install outcome:', outcome);
    
    deferredPrompt = null;
    installButton.remove();
  });

  document.body.appendChild(installButton);

  // ลบปุ่มหลังจาก 30 วินาที
  setTimeout(() => {
    if (installButton.parentNode) {
      installButton.style.animation = 'fadeOut 0.3s ease-in';
      setTimeout(() => installButton.remove(), 300);
    }
  }, 30000);

  // เพิ่ม animation styles
  if (!document.getElementById('pwa-install-styles')) {
    const styles = document.createElement('style');
    styles.id = 'pwa-install-styles';
    styles.textContent = `
      @keyframes bounceIn {
        0% { transform: scale(0.3); opacity: 0; }
        50% { transform: scale(1.05); }
        70% { transform: scale(0.9); }
        100% { transform: scale(1); opacity: 1; }
      }
      @keyframes fadeOut {
        from { opacity: 1; }
        to { opacity: 0; }
      }
    `;
    document.head.appendChild(styles);
  }
}

/**
 * ตั้งค่าการสื่อสารกับ Service Worker
 */
function setupServiceWorkerMessaging(registration) {
  // ส่งข้อความไป Service Worker
  window.sendMessageToSW = (message) => {
    return new Promise((resolve) => {
      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        resolve(event.data);
      };
      
      if (registration.active) {
        registration.active.postMessage(message, [messageChannel.port2]);
      }
    });
  };

  // ฟังข้อความจาก Service Worker
  navigator.serviceWorker.addEventListener('message', (event) => {
    console.log('📨 Message from Service Worker:', event.data);
    
    switch (event.data.type) {
      case 'CACHE_UPDATED':
        console.log('📦 Cache updated');
        break;
        
      case 'OFFLINE_STATUS':
        handleOfflineStatus(event.data.isOffline);
        break;
        
      case 'BACKGROUND_SYNC_SUCCESS':
        showNotification('✅ Data synced successfully', 'success');
        break;
        
      case 'BACKGROUND_SYNC_FAILED':
        showNotification('⚠️ Failed to sync data', 'warning');
        break;
    }
  });
}

/**
 * จัดการสถานะ offline/online
 */
function handleOfflineStatus(isOffline) {
  const statusIndicator = document.getElementById('connection-status');
  
  if (isOffline) {
    console.log('📴 App is offline');
    if (statusIndicator) {
      statusIndicator.innerHTML = '📴 ออฟไลน์';
      statusIndicator.style.color = '#dc3545';
    }
    showNotification('📴 You are offline. Some features may be limited.', 'warning', 5000);
  } else {
    console.log('🌐 App is online');
    if (statusIndicator) {
      statusIndicator.innerHTML = '🟢 ออนไลน์';
      statusIndicator.style.color = '#28a745';
    }
    showNotification('🌐 You are back online!', 'success', 3000);
  }
}

/**
 * แสดงการแจ้งเตือน
 */
function showNotification(message, type = 'info', duration = 4000) {
  const notification = document.createElement('div');
  notification.className = `sw-notification sw-notification-${type}`;
  notification.textContent = message;
  
  const colors = {
    success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
    error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
    warning: { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' },
    info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' }
  };
  
  const style = colors[type] || colors.info;
  
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: ${style.bg};
    color: ${style.color};
    border: 1px solid ${style.border};
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    z-index: 10000;
    font-weight: 500;
    animation: slideDown 0.3s ease-out;
    max-width: 90vw;
    text-align: center;
  `;

  // เพิ่ม animation styles
  if (!document.getElementById('sw-notification-animations')) {
    const styles = document.createElement('style');
    styles.id = 'sw-notification-animations';
    styles.textContent = `
      @keyframes slideDown {
        from { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-20px); 
        }
        to { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0); 
        }
      }
      @keyframes slideUp {
        from { 
          opacity: 1; 
          transform: translateX(-50%) translateY(0); 
        }
        to { 
          opacity: 0; 
          transform: translateX(-50%) translateY(-20px); 
        }
      }
    `;
    document.head.appendChild(styles);
  }

  document.body.appendChild(notification);

  // Auto remove
  setTimeout(() => {
    if (notification.parentNode) {
      notification.style.animation = 'slideUp 0.3s ease-in';
      setTimeout(() => {
        if (notification.parentNode) {
          notification.remove();
        }
      }, 300);
    }
  }, duration);

  // Click to dismiss
  notification.addEventListener('click', () => {
    if (notification.parentNode) {
      notification.style.animation = 'slideUp 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }
  });
}

/**
 * ตรวจสอบสถานะ Service Worker
 */
export async function getServiceWorkerStatus() {
  if (!('serviceWorker' in navigator)) {
    return { supported: false };
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      return { supported: true, registered: false };
    }

    // ดึงข้อมูลจาก Service Worker
    const status = await window.sendMessageToSW?.({ type: 'CACHE_STATUS' }) || {};
    
    return {
      supported: true,
      registered: true,
      active: !!registration.active,
      waiting: !!registration.waiting,
      installing: !!registration.installing,
      scope: registration.scope,
      updateFound: false,
      ...status
    };

  } catch (error) {
    console.error('Error getting Service Worker status:', error);
    return { supported: true, registered: false, error: error.message };
  }
}

/**
 * บังคับ update Service Worker
 */
export async function updateServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    throw new Error('Service Worker not supported');
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (!registration) {
      throw new Error('Service Worker not registered');
    }

    console.log('🔄 Checking for Service Worker updates...');
    await registration.update();
    
    if (registration.waiting) {
      registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('Error updating Service Worker:', error);
    throw error;
  }
}

/**
 * ยกเลิกการลงทะเบียน Service Worker
 */
export async function unregisterServiceWorker() {
  if (!('serviceWorker' in navigator)) {
    return false;
  }

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    
    if (registration) {
      console.log('🗑️ Unregistering Service Worker...');
      const result = await registration.unregister();
      console.log('✅ Service Worker unregistered:', result);
      return result;
    }
    
    return false;

  } catch (error) {
    console.error('Error unregistering Service Worker:', error);
    return false;
  }
}

/**
 * ล้าง cache ทั้งหมด
 */
export async function clearAllCaches() {
  try {
    // ล้าง cache ผ่าน Service Worker
    const result = await window.sendMessageToSW?.({ type: 'CLEAR_CACHE' });
    
    if (result?.success) {
      console.log('✅ All caches cleared via Service Worker');
      return true;
    }
    
    // Fallback: ล้าง cache โดยตรง
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      await Promise.all(
        cacheNames.map(cacheName => {
          console.log('🗑️ Deleting cache:', cacheName);
          return caches.delete(cacheName);
        })
      );
      console.log('✅ All caches cleared directly');
      return true;
    }
    
    return false;

  } catch (error) {
    console.error('Error clearing caches:', error);
    return false;
  }
}

/**
 * ตรวจสอบว่า app ทำงานใน standalone mode หรือไม่
 */
export function isRunningStandalone() {
  // ตรวจสอบ display mode
  if (window.matchMedia('(display-mode: standalone)').matches) {
    return true;
  }
  
  // ตรวจสอบ iOS Safari
  if (window.navigator.standalone === true) {
    return true;
  }
  
  // ตรวจสอบ Android Chrome
  if (window.matchMedia('(display-mode: fullscreen)').matches) {
    return true;
  }
  
  return false;
}

/**
 * ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
 */
export function setupNetworkStatusMonitoring() {
  // ตรวจสอบสถานะเริ่มต้น
  updateNetworkStatus();

  // ฟังการเปลี่ยนแปลงสถานะเครือข่าย
  window.addEventListener('online', () => {
    console.log('🌐 Network: Online');
    updateNetworkStatus();
    handleOfflineStatus(false);
  });

  window.addEventListener('offline', () => {
    console.log('📴 Network: Offline');
    updateNetworkStatus();
    handleOfflineStatus(true);
  });

  // ตรวจสอบสถานะเครือข่ายเป็นระยะ
  setInterval(updateNetworkStatus, 30000); // ทุก 30 วินาที
}

/**
 * อัพเดตสถานะเครือข่าย
 */
function updateNetworkStatus() {
  const isOnline = navigator.onLine;
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  
  const networkInfo = {
    online: isOnline,
    effectiveType: connection?.effectiveType || 'unknown',
    downlink: connection?.downlink || 'unknown',
    rtt: connection?.rtt || 'unknown'
  };

  console.log('📡 Network status:', networkInfo);

  // อัพเดต UI indicator
  const statusEl = document.getElementById('connection-status');
  if (statusEl && isOnline) {
    const effectiveType = connection?.effectiveType;
    let statusText = '🟢 ออนไลน์';
    
    if (effectiveType) {
      switch (effectiveType) {
        case 'slow-2g':
        case '2g':
          statusText += ' (ช้า)';
          break;
        case '3g':
          statusText += ' (ปานกลาง)';
          break;
        case '4g':
          statusText += ' (เร็ว)';
          break;
      }
    }
    
    statusEl.innerHTML = statusText;
  }

  return networkInfo;
}

/**
 * ฟังก์ชันเพื่อ debug Service Worker
 */
export const ServiceWorkerDebug = {
  /**
   * ดูข้อมูล Service Worker ทั้งหมด
   */
  async getFullStatus() {
    const status = await getServiceWorkerStatus();
    console.table(status);
    return status;
  },

  /**
   * ทดสอบ cache
   */
  async testCache() {
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      console.log('📦 Available caches:', cacheNames);
      
      for (const cacheName of cacheNames) {
        const cache = await caches.open(cacheName);
        const keys = await cache.keys();
        console.log(`📂 Cache "${cacheName}" has ${keys.length} entries:`, keys.map(req => req.url));
      }
    }
  },

  /**
   * บังคับ reload Service Worker
   */
  async forceReload() {
    await unregisterServiceWorker();
    await clearAllCaches();
    window.location.reload();
  },

  /**
   * ทดสอบ notifications
   */
  async testNotification() {
    showNotification('🧪 This is a test notification', 'info');
  }
};

// Export สำหรับใช้ใน console
if (typeof window !== 'undefined') {
  window.ServiceWorkerDebug = ServiceWorkerDebug;
}

/**
 * Auto-initialization
 */
export function initializeServiceWorker() {
  console.log('🚀 Initializing Service Worker system...');

  // ตั้งค่า network monitoring
  setupNetworkStatusMonitoring();

  // ลงทะเบียน Service Worker
  registerServiceWorker().then((registration) => {
    if (registration) {
      console.log('✅ Service Worker system initialized successfully');
      
      // แสดงสถานะใน console สำหรับ debug
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        console.log('🔧 Development mode: Service Worker debug tools available');
        console.log('💡 Use ServiceWorkerDebug.getFullStatus() to check status');
        console.log('💡 Use ServiceWorkerDebug.testCache() to inspect cache');
      }
    }
  });

  // ตรวจสอบว่าทำงานใน standalone mode หรือไม่
  if (isRunningStandalone()) {
    console.log('📱 Running in standalone mode (PWA)');
    document.body.classList.add('pwa-mode');
  } else {
    console.log('🌐 Running in browser mode');
  }
}

// Auto-initialize เมื่อโหลด
if (typeof window !== 'undefined' && document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeServiceWorker);
} else if (typeof window !== 'undefined') {
  initializeServiceWorker();
}