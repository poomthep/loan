// Simple error handler for 406 and other HTTP errors
export class ErrorHandler {
  static handle406Error(url, error) {
    console.warn(`406 Error ignored for: ${url}`);
    // Don't show user notification for 406 errors from Supabase
    return null;
  }
  
  static showUserError(message) {
    const toast = document.createElement('div');
    toast.style.cssText = `
      position: fixed; top: 20px; right: 20px;
      background: #f44336; color: white;
      padding: 15px 20px; border-radius: 8px;
      z-index: 10000; max-width: 350px;
    `;
    toast.innerHTML = `${message} <button onclick="this.parentElement.remove()" style="background:none;border:none;color:white;float:right;">×</button>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }
}

// Override fetch to handle 406 errors silently
const originalFetch = window.fetch;
window.fetch = function(...args) {
  return originalFetch.apply(this, args)
    .then(response => {
      if (response.status === 406) {
        ErrorHandler.handle406Error(args[0], response);
      }
      return response;
    })
    .catch(error => {
      console.error('Fetch error:', error);
      throw error;
    });
};