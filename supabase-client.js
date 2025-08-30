// supabase-client.js — SAFE GUARD (ป้องกัน init ซ้อน)
// ถ้าใช้ supabase-init.js (ESM) แล้วจะมี client อยู่ที่ window.supabase.from
(function (g) {
  'use strict';
  // ถ้ามี client พร้อมใช้งานแล้ว -> ไม่ต้องทำอะไร
  if (g.supabase && typeof g.supabase.from === 'function') {
    console.info('[supabase-client] client already initialized; skip.');
    return;
  }

  // fallback กรณีใช้ UMD ที่ global เป็น g.Supabase (ไม่ค่อยได้ใช้แล้ว)
  if (g.Supabase && typeof g.Supabase.createClient === 'function') {
    // *** ใส่ URL/KEY เฉพาะกรณีที่คุณตั้งใจจะใช้ UMD เท่านั้น ***
    var SUPABASE_URL = g.SUPABASE_URL || '';
    var SUPABASE_ANON_KEY = g.SUPABASE_ANON_KEY || '';
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error('[supabase-client] Missing SUPABASE_URL/ANON_KEY. If you use supabase-init.js, remove this file from HTML.');
      return;
    }
    g.supabase = g.Supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    console.info('[supabase-client] initialized via UMD fallback.');
    return;
  }

  // ไม่พบไลบรารี — แจ้งลบไฟล์นี้ทิ้ง
  console.warn('[supabase-client] No library found. If you use supabase-init.js, please REMOVE this file from HTML.');
})(window);
