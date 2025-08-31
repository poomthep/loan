// จัดการ Authentication และ expose เป็น window.AuthManager
// ต้องการ window.supabase จาก supabase-init.js

function _client() {
  const c = window.supabase;
  if (!c) throw new Error('Supabase client not ready');
  return c;
}

export const AuthManager = {
  async initialize() {
    // read current session for initial UI update
    try {
      const { data } = await _client().auth.getSession();
      this._emit(data?.session || null);
    } catch (e) { console.warn('[Auth.initialize]', e); }
  },

  async signIn(email, password) {
    const { data, error } = await _client().auth.signInWithPassword({ email, password });
    if (error) throw error;
    this._emit(data.session);
    return data;
  },

  async signUp(email, password) {
    const { data, error } = await _client().auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  async signOut() {
    const { error } = await _client().auth.signOut();
    if (error) throw error;
    this._emit(null);
  },

  addAuthListener(cb) {
    if (!this._subs) this._subs = new Set();
    this._subs.add(cb);
    return () => this._subs.delete(cb);
  },

  _emit(session) {
    (this._subs || []).forEach((cb) => {
      try { cb(session); } catch {}
    });
  }
};

if (typeof window !== 'undefined') {
  window.AuthManager = AuthManager;
  // live subscription to supabase.auth state changes
  try {
    const c = window.supabase;
    if (c) {
      c.auth.onAuthStateChange((_evt, session) => AuthManager._emit(session));
    }
  } catch {}
}
