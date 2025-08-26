// session-guard.js — cross-tab safe session refresh for Supabase
import { supabase } from './supabase-client.js';

let refreshTimer = null;
const PRE_REFRESH_SECONDS = 90; // refresh ~1.5 minutes before expiry

export async function scheduleSessionRefresh(passedSession) {
  try {
    // Clear previous timer
    if (refreshTimer) { clearTimeout(refreshTimer); refreshTimer = null; }

    const { data: { session } } = await supabase.auth.getSession();
    const s = passedSession || session;
    if (!s || !s.expires_at) return;

    const nowSec = Math.floor(Date.now() / 1000);
    const dueInSec = Math.max(1, (s.expires_at - PRE_REFRESH_SECONDS) - nowSec);
    refreshTimer = setTimeout(async () => {
      try {
        // Light ping to ensure session is still valid; supabase-js auto-refreshes
        await supabase.auth.getSession();
      } catch (e) {
        console.warn('[session-guard] refresh error', e);
      } finally {
        scheduleSessionRefresh(); // reschedule
      }
    }, dueInSec * 1000);
  } catch (e) {
    console.warn('[session-guard] schedule error', e);
  }
}

export function setupVisibilityHandlers() {
  const onFocus = () => scheduleSessionRefresh();
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') onFocus(); });
  window.addEventListener('focus', onFocus);
  // Cross-tab: when another tab updates supabase token in localStorage
  window.addEventListener('storage', (e) => {
    if (e.key && e.key.includes('supabase.auth.token')) onFocus();
  });
}

// Hook auth changes so any login/logout immediately re-schedules
supabase.auth.onAuthStateChange((_event, session) => {
  scheduleSessionRefresh(session || undefined);
});

// Optional: kick things off
scheduleSessionRefresh();