// api.js - จัดการการสื่อสารกับ Supabase
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;

async function getClient() {
    if (client) return client;
    // ใช้ dynamic import เพื่อให้ Supabase client โหลดเมื่อจำเป็นเท่านั้น
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
}

async function fetchPromotions() {
    const sb = await getClient();
    return sb.from('promotions').select('*, banks(name)').order('created_at', { ascending: false });
}

export const api = { fetchPromotions };