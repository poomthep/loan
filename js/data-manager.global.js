// window.DM – data layer โกลบอล (ไม่ใช้ ES modules)
(function (global) {
  const sb = global.supabase || global.supabaseClient;
  if (!sb) console.warn('[DM] window.supabase client not found');

  // ---------- ตรวจชื่อคอลัมน์โปรโมชันแบบอัตโนมัติ ----------
  // ค่าเริ่มต้นลองเป็น y1/y2/y3 ก่อน ถ้าเจอ 42703 จะสลับเป็น year1/year2/year3
  const promoCols = { y1: 'y1', y2: 'y2', y3: 'y3', checked: false };

  async function ensurePromoColumns() {
    if (promoCols.checked) return;
    // ลอง select แบบเบา ๆ เพื่อดูว่าคอลัมน์มีจริงไหม
    const { error } = await sb
      .from('promotions')
      .select('id,' + promoCols.y1)
      .limit(1);
    if (error && error.code === '42703') {
      // เปลี่ยนไปชุด year1/year2/year3
      promoCols.y1 = 'year1';
      promoCols.y2 = 'year2';
      promoCols.y3 = 'year3';
    }
    promoCols.checked = true;
  }

  // ---------- Banks ----------
  async function getBanks() {
    const { data, error } = await sb
      .from('banks')
      .select('id, short_name, name, mrr')
      .order('id');
    if (error) throw error;
    return (data || []).map(r => ({
      id: r.id,
      short_name: r.short_name,
      name: r.name,
      mrr: r.mrr,
      mrr_effective_from: r.mrr_effective_from || null, // กันไว้เผื่ออนาคต
    }));
  }

  async function updateBankMRR(bankId, mrr /* , effectiveDate */) {
    const { data, error } = await sb
      .from('banks')
      .update({ mrr })
      .eq('id', bankId)
      .select()
      .single();
    if (error) throw error;
    return data;
  }

  // ---------- Promotions (normalize เป็น y1,y2,y3 เสมอ) ----------
  async function listPromotions() {
    await ensurePromoColumns();

    const selectFields = [
      'id',
      'bank_id',
      'product_type',
      'title',
      'base',
      promoCols.y1,
      promoCols.y2,
      promoCols.y3,
      'active',
    ].join(',');

    let { data, error } = await sb.from('promotions').select(selectFields).order('id');
    // เผื่อโดน cache schema เก่า ให้ fallback อีกชั้น
    if (error && error.code === '42703') {
      promoCols.y1 = 'year1'; promoCols.y2 = 'year2'; promoCols.y3 = 'year3';
      const select2 = [
        'id','bank_id','product_type','title','base',
        promoCols.y1,promoCols.y2,promoCols.y3,'active'
      ].join(',');
      ({ data, error } = await sb.from('promotions').select(select2).order('id'));
    }
    if (error) throw error;

    const y1k = promoCols.y1, y2k = promoCols.y2, y3k = promoCols.y3;
    return (data || []).map(r => ({
      id: r.id,
      bank_id: r.bank_id,
      product_type: r.product_type,
      title: r.title,
      base: r.base,
      y1: r[y1k] ?? null,
      y2: r[y2k] ?? null,
      y3: r[y3k] ?? null,
      active: !!r.active,
    }));
  }

  function buildPromoBody(payload) {
    const y1 = payload.y1 ?? payload.year1 ?? null;
    const y2 = payload.y2 ?? payload.year2 ?? null;
    const y3 = payload.y3 ?? payload.year3 ?? null;
    return {
      bank_id: payload.bank_id,
      product_type: payload.product_type,
      title: payload.title,
      base: payload.base ?? null,
      active: !!payload.active,
      // เขียนด้วยชื่อคีย์ dynamic ให้ตรงกับ schema ที่ตรวจพบ
      [promoCols.y1]: y1,
      [promoCols.y2]: y2,
      [promoCols.y3]: y3,
    };
  }

  async function createPromotion(payload) {
    await ensurePromoColumns();
    const body = buildPromoBody(payload);
    const { data, error } = await sb.from('promotions').insert(body).select().single();
    if (error) throw error;
    return data;
  }

  async function updatePromotion(id, payload) {
    await ensurePromoColumns();
    const body = buildPromoBody(payload);
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
