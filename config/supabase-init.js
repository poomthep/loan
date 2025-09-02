// supabase-init.js
// ใช้ global Supabase จาก CDN และ config
const supabase = window.supabase.createClient(
  window.__SUPABASE_URL__,
  window.__SUPABASE_ANON_KEY__
);
window.__supabase__ = supabase;

console.log("Supabase initialized:", window.__SUPABASE_URL__);
