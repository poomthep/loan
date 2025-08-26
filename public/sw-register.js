// sw-register.js — robust SW registration with auto-update
(function(){
  if (!('serviceWorker' in navigator)) return;

  function sendSkipWaiting(reg){
    if (reg && reg.waiting) reg.waiting.postMessage({ type: 'SKIP_WAITING' });
  }

  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' })
      .then(reg => {
        // Proactively check on load
        try { reg.update(); } catch(e) {}

        // Listen for new SW installing
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (!nw) return;
          nw.addEventListener('statechange', () => {
            if (nw.state === 'installed') {
              // A new SW is waiting
              sendSkipWaiting(reg);
            }
          });
        });

        // If a new controller takes over, reload once to get fresh assets
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (refreshing) return;
          refreshing = true;
          window.location.reload();
        });

        // Poll for updates every 20 minutes
        setInterval(() => { try { reg.update(); } catch(e) {} }, 20 * 60 * 1000);
      })
      .catch(err => console.error('[sw-register] registration error:', err));
  });
})();