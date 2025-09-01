// data-manager.js
// ฟังก์ชันข้อมูลกลางที่หน้า Admin (และหน้าอื่น) เรียกใช้
// export: getBanks, updateBankMRR, listPromotions, createPromotion, updatePromotion, deletePromotion, upsertPromotion

import { supabase as _sb } from './supabase-init.js';

// -------- utils --------
function client() {
  return _sb || (typeof window !== 'undefined' ? window.supabase : null);
}
function ensureClient() {
  const sb = client();
  if (!sb) throw new Error('Supabase client is required. Make sure supabase-init.js is loaded.');
  return sb;
}
function nOrNull(v) {
  if (v === '' || v === undefined || v === null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function sanitizePromo(p = {}) {
  return {
    bank_id: p.bank_id ?? null,
    product_type: p.product_type ?? null,
    title: (p.title || '').toString().slice(0, 200),
    description: p.description ?? null,
    base: (p.base || 'fixed').toLowerCase() === 'mrr' ? 'mrr' : 'fixed',
    year1: nOrNull(p.year1 ?? p.year1_rate ?? p.year1_spread),
    year2: nOrNull(p.year2 ?? p.year2_rate ?? p.year2_spread),
    year3: nOrNull(p.year3 ?? p.year3_rate ?? p.year3_spread),
    active: !!p.active,
  };
}

// ===============================
// Banks
// ===============================
export async function getBanks() {
  const sb = ensureClient();
  const { data, error } = await sb
    .from('banks')
    .select('id, short_name, name, mrr, mrr_effective_date')
    .order('short_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function updateBankMRR(bankId, mrr, effectiveDate) {
  const sb = ensureClient();
  const payload = { mrr: nOrNull(mrr), mrr_effective_date: effectiveDate || null };
  const { error } = await sb.from('banks').update(payload).eq('id', bankId);
  if (error) throw error;
  return true;
}

// ===============================
// Promotions
// ===============================
export async function listPromotions() {
  const sb = ensureClient();
  const { data: promos, error } = await sb
    .from('promotions')
    .select('id, bank_id, product_type, title, description, base, year1, year2, year3, active')
    .order('id', { ascending: true });
  if (error) throw error;
  const list = promos || [];

  // เติม bank_short_name
  try {
    const banks = await getBanks();
    const map = new Map(banks.map((b) => [b.id, b.short_name]));
    return list.map((p) => ({ ...p, bank_short_name: map.get(p.bank_id) || null }));
  } catch {
    return list;
  }
}

export async function createPromotion(payload) {
  const sb = ensureClient();
  const clean = sanitizePromo(payload);
  const { data, error } = await sb.from('promotions').insert([clean]).select('id').single();
  if (error) throw error;
  return data; // { id }
}

export async function updatePromotion(id, payload) {
  const sb = ensureClient();
  const clean = sanitizePromo(payload);
  const { data, error } = await sb.from('promotions').update(clean).eq('id', id).select('id').single();
  if (error) throw error;
  return data; // { id }
}

export async function deletePromotion(id) {
  const sb = ensureClient();
  const { error } = await sb.from('promotions').delete().eq('id', id);
  if (error) throw error;
  return true;
}

/**
 * upsertPromotion — ใช้ตัวเดียวได้ทั้งเพิ่ม/แก้:
 * - ถ้ามี payload.id จะเรียก updatePromotion
 * - ถ้าไม่มี id จะเรียก createPromotion
 * คืนค่า { id }
 */
export async function upsertPromotion(payload) {
  const id = payload && (payload.id ?? payload.promo_id);
  if (id != null && id !== '') {
    const { id: rid } = await updatePromotion(id, payload);
    return { id: rid ?? id };
  } else {
    return await createPromotion(payload);
  }
}
