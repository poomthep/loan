// /js/supabase-init.js
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function readConfig() {
  const urlFromWin  = (window.__SB_URL__  || '').trim();
  const keyFromWin  = (window.__SB_ANON__ || '').trim();

  const metaUrl = document.querySelector('meta[name="supabase-url"]')?.content?.trim() || '';
  const metaKey = document.querySelector('meta[name="supabase-anon"]')?.content?.trim() || '';

  const url = urlFromWin || metaUrl;
  const key = keyFromWin || metaKey;
  return { url, key };
}

const { url, key } = readConfig();

if (!url || !/^https?:\/\/.+/.test(url)) {
  throw new Error('SUPABASE_URL not set or invalid. Please set window.__SB_URL__ or <meta name="supabase-url">.');
}
if (!key) {
  throw new Error('SUPABASE_ANON_KEY not set. Please set window.__SB_ANON__ or <meta name="supabase-anon">.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: true, storage: localStorage },
});
window.supabase = supabase; // เผื่อสคริปต์อื่นใช้
