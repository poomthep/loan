// สร้าง client แบบโกลบอล ใช้ได้ทั้งโปรเจ็กต์ (ไม่ใช้ import/export)
(function (global) {
  if (!global.supabase) {
    console.error("[supabase-init] Supabase JS SDK ไม่อยู่บนหน้า (ต้องโหลดจาก CDN ก่อน)");
    return;
  }
  const cfg = global.SUPABASE_CONFIG;
  if (!cfg || !cfg.url || !cfg.anonKey) {
    console.error("[supabase-init] ไม่พบ SUPABASE_CONFIG (url/anonKey)");
    return;
  }
  const { createClient } = global.supabase;
  const client = createClient(cfg.url, cfg.anonKey);
  // โยนขึ้นโกลบอลให้ทุกไฟล์เรียก
  global.supabaseClient = client;
  global.supabase = client;
  console.log("[supabase-init] Supabase client พร้อมใช้งาน");
})(window);
