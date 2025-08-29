
// Lightweight SW register with update prompt
export function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;

  navigator.serviceWorker.register('/sw.js')
    .then(async reg => {
      console.log('Service Worker registration ok.', reg.scope);
      // Listen for updates
      if (reg.waiting) {
        // already waiting
        reg.waiting.postMessage({ type: 'GET_VERSION' });
      }
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        if (!sw) return;
        sw.addEventListener('statechange', () => {
          if (sw.state === 'installed') {
            // show prompt UI if you have one; or auto-activate
            if (navigator.serviceWorker.controller) {
              console.log('Service Worker update found');
              sw.postMessage({ type: 'SKIP_WAITING' });
            }
          }
        });
      });

      navigator.serviceWorker.addEventListener('message', (evt) => {
        if (evt.data && evt.data.type === 'VERSION') {
          console.log('Loan App Service Worker', evt.data.version, 'loaded');
        }
      });
    })
    .catch(err => console.error('SW registration failed', err));
}
