// Require: window.AppConfig + CDN <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
(function () {
  if (!window.AppConfig) { console.error("AppConfig missing"); return; }
  if (!window.supabase || !supabase.createClient) {
    console.error("Supabase UMD not found. Load CDN before supabase-init.js");
    return;
  }
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = window.AppConfig;
  window.sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
  });

  window.getSession = async function () {
    const { data, error } = await sb.auth.getSession();
    if (error) throw error;
    return data.session || null;
  };

  window.logout = async function () {
    try { await sb.auth.signOut(); }
    finally { window.location.assign(window.AppConfig.REDIRECTS.afterLogout); }
  };
})();
