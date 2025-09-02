import { sb, getSession } from './supabase-init.js';

async function simpleSelect(table, fields, filters = []) {
  let q = sb.from(table).select(fields);
  for (const f of filters) {
    const [op, ...args] = f;
    if (op === "eq") q = q.eq(args[0], args[1]);
    if (op === "order") q = q.order(args[0], { ascending: !!args[1] });
    if (op === "limit") q = q.limit(args[0]);
  }
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// ---- Profiles ----
export async function getMyRole() {
  const session = await getSession();
  if (!session) return null;
  const uid = session.user.id;
  const { data, error } = await sb.from("user_profiles").select("role").eq("id", uid).maybeSingle();
  if (error) throw error;
  return data?.role || null;
}

// ---- Banks ----
export async function getBanks() {
  return await simpleSelect("banks", "id, short_name, name, mrr, mrr_effective_from", [["order", "id", true]]);
}

export async function updateBankMRR(bankId, mrr, effectiveDate) {
  const payload = { mrr };
  if (effectiveDate) payload.mrr_effective_from = effectiveDate;
  const { error } = await sb.from("banks").update(payload).eq("id", bankId);
  if (error) throw error;
  return true;
}

// ---- Promotions ----
export async function listPromotions() {
  return await simpleSelect("promotions", "id, bank_id, product_type, title, base, y1, y2, y3, active", [["order", "id", true]]);
}

export async function createPromotion(p) {
  const payload = {
    bank_id: p.bank_id,
    product_type: p.product_type,
    title: p.title,
    base: p.base ?? null,
    y1: p.y1 ?? null, y2: p.y2 ?? null, y3: p.y3 ?? null,
    active: !!p.active
  };
  const { data, error } = await sb.from("promotions").insert(payload).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function updatePromotion(id, p) {
  const payload = {
    bank_id: p.bank_id,
    product_type: p.product_type,
    title: p.title,
    base: p.base ?? null,
    y1: p.y1 ?? null, y2: p.y2 ?? null, y3: p.y3 ?? null,
    active: p.active
  };
  const { data, error } = await sb.from("promotions").update(payload).eq("id", id).select().maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertPromotion(p) {
  if (p.id) return await updatePromotion(p.id, p);
  return await createPromotion(p);
}

export async function deletePromotion(id) {
  const { error } = await sb.from("promotions").delete().eq("id", id);
  if (error) throw error;
  return true;
}