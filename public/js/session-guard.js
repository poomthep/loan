// Guards session across tabs and when page visibility changes
import { getSupabase } from './supabaseClient.js';

let started = false;
export async function startSessionGuard() {
  if (started) return;
  started = true;
  const supabase = await getSupabase();

  // Sync across tabs
  window.addEventListener('storage', async (e) => {
    if (e.key && e.key.includes('sb-') && e.key.endsWith('-auth-token')) {
      // another tab changed session -> reload to reflect
      location.reload();
    }
  });

  // Refresh when returning to the tab
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
      await supabase.auth.getSession(); // triggers refresh if needed
    }
  });

  // Periodic keep-alive (15 min)
  setInterval(async () => {
    await supabase.auth.getSession();
  }, 15 * 60 * 1000);
}