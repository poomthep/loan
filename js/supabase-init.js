import { AppConfig } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

export const sb = createClient(AppConfig.SUPABASE_URL, AppConfig.SUPABASE_ANON_KEY, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
});

export async function getSession() {
  const { data, error } = await sb.auth.getSession();
  if (error) throw error;
  return data.session || null;
}

export async function logout() {
  try { await sb.auth.signOut(); }
  finally { window.location.assign(AppConfig.REDIRECTS.afterLogout); }
}