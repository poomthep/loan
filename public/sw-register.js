export async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (reg.waiting) {
        reg.waiting.postMessage({ type: 'SKIP_WAITING' });
      }
      reg.addEventListener('updatefound', () => {
        const newWorker = reg.installing;
        if (newWorker) {
          newWorker.addEventListener('statechange', () => {
            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
              // new SW activated, reload to get fresh assets
              location.reload();
            }
          });
        }
      });
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        location.reload();
      });
    } catch (e) {
      console.warn('SW register failed', e);
    }
  }
}