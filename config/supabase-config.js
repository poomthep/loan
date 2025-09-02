// supabase-config.js
// ดึงค่า Environment Variables จาก Netlify หรือใช้ Placeholder
const supabaseUrl = window.SUPABASE_URL || "{{SUPABASE_URL}}";
const supabaseAnonKey = window.SUPABASE_ANON_KEY || "{{SUPABASE_ANON_KEY}}";

// สร้าง client เชื่อมต่อ Supabase
const supabase = window.supabase.createClient(supabaseUrl, supabaseAnonKey);

// export global
window.__supabase__ = supabase;
