// supabase-client.js
// ไฟล์นี้จะทำการสร้าง Supabase client เพียงครั้งเดียวและส่งออกไปให้ไฟล์อื่นใช้

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '/api/config.js';

// สร้าง client และตั้งค่า auth ที่นี่เพียงที่เดียว
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
    },
});