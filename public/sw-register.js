// sw-register.js — robust registration & fast updates
(function(){
  if (!('serviceWorker' in navigator)) return;

  function sendSkipWaiting(reg){
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => {
        // Check for updates periodically
        setInterval(() => {
          try {
            reg.update();
          } catch (e) {
            console.warn('[SW] Periodic update failed:', e);
          }
        }, 60 * 60 * 1000); // every hour

        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed') {
              sendSkipWaiting(reg);
            }
          });
        });

        // Ensure the waiting SW is activated on page load
        sendSkipWaiting(reg);

        // Reload the page once after a new SW has taken control
        let refreshing;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          window.location.reload();
          refreshing = true;
        });
      })
      .catch(err => console.error('[sw-register] registration error:', err));
  });
})();