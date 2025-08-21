// session-guard.js (Refactored as a helper module)
import { supabase } from './supabase-client.js';

let refreshTimer = null;
const PRE_REFRESH_SECONDS = 60; // Refresh 60 seconds before expiry

// This function is now exported to be called by admin.js
export async function scheduleSessionRefresh(session) {
    if (refreshTimer) clearTimeout(refreshTimer);

    const sessionToSchedule = session || (await supabase.auth.getSession()).data.session;
    if (!sessionToSchedule?.expires_at) {
        return; // No session to schedule, do nothing.
    }

    const now = Math.floor(Date.now() / 1000);
    const secondsLeft = sessionToSchedule.expires_at - now;
    
    if (secondsLeft <= PRE_REFRESH_SECONDS) {
        // If expiry is imminent, refresh now.
        refreshSession('near-expiry');
    } else {
        // Otherwise, schedule a refresh for a later time.
        const refreshInMs = (secondsLeft - PRE_REFRESH_SECONDS) * 1000;
        refreshTimer = setTimeout(() => refreshSession('scheduled'), Math.max(0, refreshInMs));
    }
}

async function refreshSession(reason = 'manual') {
    try {
        console.log(`[SessionGuard] Refreshing session (reason: ${reason})...`);
        const { data, error } = await supabase.auth.refreshSession();
        if (error) throw error;
        if (data.session) {
            // After refresh, schedule the next one.
            scheduleSessionRefresh(data.session);
        }
    } catch (err) {
        console.warn('[SessionGuard] Failed to refresh session:', err.message);
    }
}

// This function sets up listeners that trigger a session check.
export function setupVisibilityHandlers() {
    const handleVisibilityChange = () => {
        if (document.visibilityState === 'visible') {
            scheduleSessionRefresh();
        }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleVisibilityChange);
    window.addEventListener('storage', (e) => {
        if (e.key && e.key.includes('supabase.auth.token')) {
            handleVisibilityChange();
        }
    });
}