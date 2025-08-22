// api.js - จัดการการสื่อสารกับ Supabase
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';

let client = null;

async function getClient() {
    if (client) return client;
    const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm');
    client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    return client;
}

/**
 * ดึงรายการโปรโมชัน พร้อมข้อมูลธนาคาร (รวมอัตรามาตรฐานปัจจุบัน)
 */
async function fetchPromotions() {
    const sb = await getClient();
    return sb
      .from('promotions')
      .select('*, bank_id, banks(name, current_mrr, current_mlr, current_mor)')
      .order('created_at', { ascending: false });
}

export const api = { fetchPromotions };
