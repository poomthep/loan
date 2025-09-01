// รวมการคุยกับ DB ขึ้นเป็น namespace โกลบอล: window.DM
(function (global) {
  const sb = global.supabase || global.supabaseClient;
  if (!sb) {
    console.warn('[DM] Supabase client not found on window.supabase');
  }

  // ---------- Banks ----------
  async function getBanks() {
    const { data, error } = await sb
      .from('banks')
      .select('id, short_name, name, mrr, mrr_effective_from')
      .order('id');
    if (error) throw error;
    return data || [];
  }

  async function updateBankMRR(bankId, mrr, effectiveDate = null) {
    const { data, error } = await sb
      .from('banks')
      .update({ mrr, mrr_effective_from: effectiveDate })
      .eq('id', bankId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ---------- Promotions ----------
  async function listPromotions() {
    const { data, error } = await sb
      .from('promotions')
      .select('id, bank_id, product_type, title, base, year1, year2, year3, active')
      .order('id', { ascending: true });
    if (error) throw error;
    return data || [];
  }

  async function createPromotion(payload) {
    const { data, error } = await sb
      .from('promotions')
      .insert(payload)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  async function updatePromotion(id, payload) {
    const body = { ...payload };
    delete body.id;
    const { data, error } = await sb
      .from('promotions')
      .update(body)
      .eq('id', id)
      .select()
      .single();
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
