// Global app configuration (no modules)
export const AppConfig = {
  SUPABASE_URL: "https://kpsferwaplnkzrbqoghv.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwc2ZlcndhcGxua3pyYnFvZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTI1NjUsImV4cCI6MjA3MTA4ODU2NX0.FizC7Ia92dqvbtfuU5T3hymh-UX6OEqQRvQnB0oY96Y",
  REDIRECTS: {
    afterLoginUser: "/loan/",
    afterLoginAdmin: "/admin/",
    afterLogout: "/"
  }
};