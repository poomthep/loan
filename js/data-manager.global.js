// รวมการคุยกับ DB ขึ้นเป็น namespace โกลบอล: window.DM
(function (global) {
  const sb = global.supabase || global.supabaseClient;
  if (!sb) {
    console.warn('[DM] Supabase client not found on window.supabase');
  }

  // ---------- Banks ----------
  // NOTE: ไม่ select คอลัมน์วันที่ เพราะ schema ของคุณไม่มี (กัน 42703)
  async function getBanks() {
    const { data, error } = await sb
      .from('banks')
      .select('id, short_name, name, mrr')
      .order('id');
    if (error) throw error;

    // map ให้มี field เสริมไว้ใช้แสดง (ถ้าอนาคตมีคอลัมน์วันที่)
    return (data || []).map(row => ({
      id: row.id,
      short_name: row.short_name,
      name: row.name,
      mrr: row.mrr,
      // เผื่ออนาคตเพิ่มคอลัมน์วันที่ จะไม่พัง
      mrr_effective_from: row.mrr_effective_from || row.effective_from || row.mrr_effective_date || null,
    }));
  }

  // อัปเดตเฉพาะ mrr (ไม่อัปเดตวันที่ เพราะ schema ไม่มีคอลัมน์)
  async function updateBankMRR(bankId, mrr /*, effectiveDate = null */) {
    const { data, error } = await sb
      .from('banks')
      .update({ mrr })
      .eq('id', bankId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ---------- Promotions ----------
  // ใช้ y1,y2,y3 ตาม schema จริง
  async function listPromotions() {
    const { data, error } = await sb
      .from('promotions')
      .select('id, bank_id, product_type, title, base, y1, y2, y3, active')
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createPromotion(payload) {
    // แปลง year1..3 -> y1..3 เผื่อโค้ดเก่าเผลอส่งมา
    const body = {
      bank_id: payload.bank_id,
      product_type: payload.product_type,
      title: payload.title,
      base: payload.base ?? null,
      y1: payload.y1 ?? payload.year1 ?? null,
      y2: payload.y2 ?? payload.year2 ?? null,
      y3: payload.y3 ?? payload.year3 ?? null,
      active: !!payload.active,
    };
    const { data, error } = await sb.from('promotions').insert(body).select().single();
    if (error) throw error;
    return data;
  }

  async function updatePromotion(id, payload) {
    const body = {
      bank_id: payload.bank_id,
      product_type: payload.product_type,
      title: payload.title,
      base: payload.base ?? null,
      y1: payload.y1 ?? payload.year1 ?? null,
      y2: payload.y2 ?? payload.year2 ?? null,
      y3: payload.y3 ?? payload.year3 ?? null,
      active: !!payload.active,
    };
    const { data, error } = await sb.from('promotions').update(body).eq('id', id).select().single();
    if (error) throw error;
    return data;
  }

  async function upsertPromotion(payload) {
    if (payload && payload.id) return updatePromotion(payload.id, payload);
    return createPromotion(payload);
  }

  async function deletePromotion(id) {
    const { error } = await sb.from('promotions').delete().eq('id', id);
    if (error) throw error;
    return true;
  }

  global.DM = {
    // banks
    getBanks,
    updateBankMRR,
    // promotions
    listPromotions,
    createPromotion,
    updatePromotion,
    upsertPromotion,
    deletePromotion,
  };
})(window);
