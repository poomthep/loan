// js/app.js
// ========================================
// Main App Controller for index.html
// ========================================

import { AuthManager, updateAuthUI, setupLoginForm, setupLogoutButton, showNotification } from './auth-manager.js';

import { registerServiceWorker } from '../sw-register.js';
import { testSupabaseConnection } from './supabase-client.js';

// ใช้ตัว global ที่มาจาก data-manager.js
const DataManager = window.DataManager;

// ✅ วางทับฟังก์ชันเริ่มต้นของเดิม
function bootstrapApp() {
  if (!window.supabase) {
    console.error('Supabase client ยังไม่พร้อม');
    return;
  }
  if (!DataManager || typeof DataManager.init !== 'function') {
    console.error('DataManager ไม่พร้อม');
    return;
  }
  DataManager.init()
    .then(function () {
      console.log('App ready');
      // TODO: โค้ดเริ่มต้นอื่น ๆ ของกุ้ง เช่น เติม dropdown ธนาคาร
      // DataManager.getBanks().then(populateBankSelect);
    })
    .catch(function (err) {
      console.error('Bootstrap failed:', err);
    });
}

document.addEventListener('DOMContentLoaded', bootstrapApp);


/**
 * Main application class to manage the index page.
 */
class AppManager {
  constructor() {
    this.elements = {};
    this.bindElements();
  }

  /**
   * Binds DOM elements to the class instance.
   */
  bindElements() {
    this.elements = {
      connectionStatus: document.getElementById('connection-status'),
      installButton: null
    };
  }

  /**
   * Initializes the application.
   */
  async initialize() {
    console.log('🚀 App starting...');

    // Initialize AuthManager and UI
    await AuthManager.initialize();
    AuthManager.addAuthListener(updateAuthUI);
    updateAuthUI();
    setupLoginForm();
    setupLogoutButton();

    // Check database connection and update UI
    await this.updateConnectionStatus();

    // Setup PWA
    registerServiceWorker();
    this.setupPWAInstallPrompt();

    // Set up other UI listeners
    this.setupUIListeners();
    
    // Show welcome message
    setTimeout(() => {
      showNotification('ยินดีต้อนรับสู่ Loan App!', 'success');
    }, 2000);

    console.log('✅ App initialized successfully');
  }
  
  /**
   * Checks database connection and updates the UI.
   */
  async updateConnectionStatus() {
    if (!this.elements.connectionStatus) return;

    this.elements.connectionStatus.textContent = '🟡 กำลังเชื่อมต่อ...';
    this.elements.connectionStatus.style.color = '#ffc107';

    const isConnected = await testSupabaseConnection();
    
    if (isConnected) {
      this.elements.connectionStatus.textContent = '🟢 พร้อมใช้งาน';
      this.elements.connectionStatus.style.color = '#28a745';
    } else {
      this.elements.connectionStatus.textContent = '🔴 ไม่สามารถเชื่อมต่อได้';
      this.elements.connectionStatus.style.color = '#dc3545';
    }
  }

  /**
   * Sets up event listeners for UI interactions.
   */
  setupUIListeners() {
    // Add loading states to external links
    document.querySelectorAll('a').forEach(anchor => {
      anchor.addEventListener('click', function(e) {
        if (this.href && !this.href.includes('#') && !this.href.includes('mailto')) {
          this.innerHTML = '⏳ กำลังโหลด...';
          this.disabled = true;
        }
      });
    });
  }

  /**
   * Handles the PWA install prompt.
   */
  setupPWAInstallPrompt() {
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      let deferredPrompt = e;
      this.showInstallButton(deferredPrompt);
    });
  }

  /**
   * Creates and displays the PWA install button.
   */
  showInstallButton(deferredPrompt) {
    if (this.elements.installButton) return;

    const installBtn = document.createElement('button');
    installBtn.textContent = '📱 ติดตั้ง App';
    installBtn.className = 'btn outline';
    installBtn.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 1000;
    `;
    
    installBtn.addEventListener('click', () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        deferredPrompt.userChoice.then((choiceResult) => {
          if (choiceResult.outcome === 'accepted') {
            console.log('User accepted PWA install');
          }
          deferredPrompt = null;
          installBtn.remove();
          this.elements.installButton = null;
        });
      }
    });

    document.body.appendChild(installBtn);
    this.elements.installButton = installBtn;
  }
}

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppManager();
  app.initialize();
  window.appManager = app;
});