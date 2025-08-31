// คุยกับฐานข้อมูลทั้งหมด (banks, promotions, calculations)
// ใช้ named exports เท่านั้น (ไม่มี default)
function client() {
  const c = window.supabase;
  if (!c) throw new Error('Supabase client is required');
  return c;
}

export async function checkDatabaseConnection() {
  try {
    await getBanks({ limit: 1 });
    return true;
  } catch {
    return false;
  }
}

export async function getBanks(opts = {}) {
  const c = client();
  let q = c.from('banks').select('*').order('id', { ascending: true });
  if (opts.limit) q = q.limit(opts.limit);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

export async function getActivePromotions(productType = 'MORTGAGE') {
  const c = client();
  const { data, error } = await c
    .from('promotions')
    .select('*')
    .eq('active', true)
    .eq('product_type', productType)
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function saveCalculation(payload) {
  const c = client();
  const { data, error } = await c.from('calculations').insert(payload).select().single();
  if (error) throw error;
  return data;
}

export async function getUserCalculations(limit = 10) {
  const c = client();
  const { data, error } = await c
    .from('calculations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data || [];
}

/* ---------- Admin ---------- */
export async function listPromotions() {
  const c = client();
  const { data, error } = await c
    .from('promotions')
    .select('*')
    .order('id', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function upsertPromotion(row) {
  const c = client();
  const { data, error } = await c.from('promotions').upsert(row).select().single();
  if (error) throw error;
  return data;
}

export async function deletePromotion(id) {
  const c = client();
  const { error } = await c.from('promotions').delete().eq('id', id);
  if (error) throw error;
  return true;
}
