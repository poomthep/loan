import { sb, getSession, logout } from './supabase-init.js';
import { getMyRole } from './data-manager.js';
import { AppConfig } from './supabase-config.js';

export async function loginWithPassword(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data.user;
}

export async function redirectAfterLogin() {
  const role = await getMyRole();
  if (role === "admin") window.location.assign(AppConfig.REDIRECTS.afterLoginAdmin);
  else window.location.assign(AppConfig.REDIRECTS.afterLoginUser);
}

export async function ensureLogin() {
  const session = await getSession();
  if (!session) {
    window.location.assign(AppConfig.REDIRECTS.afterLogout);
    return false;
  }
  return true;
}

export { logout };