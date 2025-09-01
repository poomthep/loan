
// supabase-init.js
// สร้าง client และผูกไว้ที่ window.supabase + export ฟังก์ชัน getSupabase()
// แหล่ง config: window.__SB_URL__, window.__SB_ANON__, <meta name="supabase-url">, <meta name="supabase-anon">
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

function readMeta(name){
  const el=document.querySelector(`meta[name="${name}"]`);
  return el? el.getAttribute('content') : '';
}
function getConfig(){
  const url  = (window.__SB_URL__  || readMeta('supabase-url')  || '').trim();
  const anon = (window.__SB_ANON__ || readMeta('supabase-anon') || '').trim();
  if(!url || !anon){
    console.warn('⚠️ Supabase config is empty. Please set in js/supabase-config.js or meta tags.');
  }
  return { url, anon };
}

let _client = null;
export function getSupabase(){
  if(_client) return _client;
  const {url, anon} = getConfig();
  if(!url || !anon) throw new Error('Supabase URL/Anon key is required');
  _client = createClient(url, anon, { auth: { persistSession: true, autoRefreshToken: true } });
  if(typeof window!=='undefined') window.supabase = _client;
  return _client;
}

// สร้างทันทีถ้าค่า config พร้อม
try { getSupabase(); } catch(e) { /* รอให้เพจ set ค่าไว้ก่อนก็ได้ */ }
