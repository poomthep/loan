/*! app.js (global, no-module) */
(function () {
  'use strict';

  function bootstrapApp() {
    try {
      if (!window.supabase || typeof window.supabase.from !== 'function') {
        throw new Error('Supabase client not initialized');
      }
      var DM = window.DataManager;
      if (!DM || typeof DM.init !== 'function') {
        throw new Error('DataManager not ready');
      }

      // เริ่ม Auth (ถ้ามี) แล้วค่อย init DataManager
      if (window.AuthManager && typeof window.AuthManager.initialize === 'function') {
        window.AuthManager.initialize().finally(function () {
          DM.init()
            .then(function () { console.log('App ready'); })
            .catch(function (err) { console.error('App init failed:', err); });
        });
      } else {
        DM.init()
          .then(function () { console.log('App ready'); })
          .catch(function (err) { console.error('App init failed:', err); });
      }
    } catch (err) {
      console.error('Bootstrap failed:', err);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrapApp);
  } else {
    bootstrapApp();
  }
})();
