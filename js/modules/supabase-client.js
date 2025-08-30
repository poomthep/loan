// js/modules/supabase-client.js
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

// ดึงค่าจาก environment variables ของ Netlify (หรือ Vercel)
// เพื่อไม่ให้ API Key ถูกเผยแพร่ในโค้ด
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

if (!supabaseUrl || !supabaseKey) {
  console.error('🚫 Supabase URL or Key is missing. Please set environment variables.');
  // สามารถแสดง error ใน UI ได้ด้วย
}

export const supabase = createClient(supabaseUrl, supabaseKey);