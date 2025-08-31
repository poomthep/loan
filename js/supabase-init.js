// Create window.supabase (ESM) — โหลดไฟล์นี้ก่อนทุกไฟล์ที่คุย DB
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const cfg = window.__SUPABASE || {};
const SUPABASE_URL = https://kpsferwaplnkzrbqoghv.supabase.co || '';
const SUPABASE_ANON = eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwc2ZlcndhcGxua3pyYnFvZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTI1NjUsImV4cCI6MjA3MTA4ODU2NX0.FizC7Ia92dqvbtfuU5T3hymh-UX6OEqQRvQnB0oY96Y || '';

/** @type {import('@supabase/supabase-js').SupabaseClient | null} */
export const supabase = (SUPABASE_URL && SUPABASE_ANON)
  ? createClient(SUPABASE_URL, SUPABASE_ANON)
  : null;

if (!supabase) {
  console.warn('[supabase-init] window.supabase is NULL. Please set window.__SUPABASE {url, anonKey} before loading this file.');
}

window.supabase = supabase;
