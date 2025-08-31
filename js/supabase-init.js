// Create window.supabase (ESM) — โหลดไฟล์นี้ก่อนทุกไฟล์ที่คุย DB
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.__SUPABASE || {};
const SUPABASE_URL = cfg.url || '';
const SUPABASE_ANON = cfg.anonKey || '';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

if (!supabase) {
  console.warn('[supabase-init] window.supabase is NULL. Please set window.__SUPABASE {url, anonKey} before loading this file.');
}

window.supabase = supabase;
