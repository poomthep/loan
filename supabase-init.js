// supabase-init.js (ESM)
// ดึงไลบรารีจาก CDN ES Module
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// ❗ ใส่ค่าโปรเจกต์ของกุ้งเอง (ห้ามคีย์จริงหลุดสาธารณะ)
const SUPABASE_URL = '{{SUPABASE_URL}}';            // เช่น https://xxxx.supabase.co
const SUPABASE_ANON_KEY = '{{SUPABASE_ANON_KEY}}';  // คีย์ anon

if (!SUPABASE_URL || !SUPABASE_ANON_KEY || SUPABASE_URL.includes('{{')) {
  console.error('[supabase-init] กรุณาใส่ค่า SUPABASE_URL/ANON_KEY ให้ถูกต้องใน supabase-init.js');
}

// ผูก client ไว้ที่ window.supabase ให้สคริปต์อื่นเรียกใช้ได้
window.supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true
  },
});

// helper สำหรับตรวจว่าพร้อมหรือยัง (ถ้าจำเป็น)
window.waitSupabase = async () => {
  if (window.supabase && typeof window.supabase.from === 'function') return window.supabase;
  throw new Error('Supabase client ยังไม่พร้อม');
};

console.info('[supabase-init] ready:', !!window.supabase);
