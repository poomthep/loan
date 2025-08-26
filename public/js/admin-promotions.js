// Hotfix: ensure bank_id is not null when inserting a new promotion
import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';

const PRODUCTS = ['MORTGAGE','PERSONAL','SME'];
const qs = (s)=>document.querySelector(s);

async function ensureAdmin() {
  const { role } = await getProfileRole();
  if (role !== 'admin') {
    alert('ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น');
    location.href = '/index.html';
    throw new Error('not admin');
  }
}

async function addNewPromo(){
  const sb = await getSupabase();
  // pick first bank as default to satisfy NOT NULL constraint
  const { data: banks, error: bankErr } = await sb.from('banks').select('id').order('bank_name', { ascending: true }).limit(1);
  const bank_id = banks && banks[0] ? banks[0].id : null;
  const payload = { active: true, product_type: 'MORTGAGE' };
  if (bank_id) payload.bank_id = bank_id;

  const { error } = await sb.from('promotions').insert([ payload ]);
  if (error) { alert(error.message || 'เพิ่มโปรไม่สำเร็จ'); return; }

  // trigger your existing refresh() if present
  if (typeof refresh === 'function') {
    await refresh();
  } else {
    location.reload();
  }
}

// expose a minimal init that only wires add button; works with existing page structure
export async function initAdminPromotions(){
  await ensureAdmin();
  qs('#btn-promo-add')?.addEventListener('click', addNewPromo);
}

// also expose advanced name for compatibility
export async function initAdminPromotionsAdvanced(){
  return initAdminPromotions();
}