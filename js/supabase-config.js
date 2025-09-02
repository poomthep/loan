// Global app configuration (no modules)
window.AppConfig = {
  SUPABASE_URL: "https://YOUR_PROJECT_ID.supabase.co",
  SUPABASE_ANON_KEY: "YOUR_ANON_KEY",
  REDIRECTS: {
    afterLoginUser: "/loan/",
    afterLoginAdmin: "/admin/",
    afterLogout: "/"
  }
};
