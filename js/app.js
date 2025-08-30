// js/app.js
// ========================================
// Main App Controller for index.html
// ========================================

import { AuthManager, setupLoginForm, setupLogoutButton, updateAuthUI, showNotification } from './modules/auth-manager.js';
import DataManager from './modules/data-manager.js';
import { initializeServiceWorker, setupNetworkStatusMonitoring } from '../sw-register.js'; // Assuming sw-register.js is in the root directory or adjust path

/**
 * Main application class to manage the index page.
 */
class AppManager {
  constructor() {
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
    updateAuthUI();
    setupLoginForm();
    setupLogoutButton();

    // Setup network monitoring and check initial status
    setupNetworkStatusMonitoring();
    const isConnected = await DataManager.checkDatabaseConnection();
    this.updateConnectionStatus(isConnected);

    // Setup PWA
    initializeServiceWorker();

    // Set up other UI listeners
    this.setupUIListeners();

    // Show welcome message
    setTimeout(() => {
      showNotification('ยินดีต้อนรับสู่ Loan App!', 'success');
    }, 2000);

    console.log('✅ App initialized successfully');
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

    // PWA install prompt handling
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      let deferredPrompt = e;
      this.showInstallButton(deferredPrompt);
    });
  }

  /**
   * Updates the UI to show the database connection status.
   * @param {boolean} connected - True if connected, false otherwise.
   */
  updateConnectionStatus(connected) {
    if (this.elements.connectionStatus) {
      if (connected) {
        this.elements.connectionStatus.innerHTML = '🟢 พร้อมใช้งาน';
        this.elements.connectionStatus.style.color = '#28a745';
      } else {
        this.elements.connectionStatus.innerHTML = '🔴 ไม่สามารถเชื่อมต่อได้';
        this.elements.connectionStatus.style.color = '#dc3545';
      }
    }
  }

  /**
   * Creates and displays the PWA install button.
   * @param {Event} deferredPrompt - The PWA install event.
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
      display: none; // Initially hide
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
    
    // Show the button after a delay
    setTimeout(() => {
      if (installBtn && installBtn.parentNode) {
        installBtn.style.display = 'block';
      }
    }, 5000);
  }
}

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AppManager();
  app.initialize();
  window.appManager = app; // Export for console debugging
});

// For older browsers/environments
if (document.readyState === 'complete') {
  const app = new AppManager();
  app.initialize();
  window.appManager = app;
}