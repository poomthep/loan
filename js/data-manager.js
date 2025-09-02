(function(){
  function requireClient(){
    const c = (window && window.SUPABASE) || null;
    if (!c) throw new Error('Supabase client not initialized');
    return c;
  }

  function normPromo(p){
    return {
      id: p.id,
      bank_id: p.bank_id ?? p.bankId ?? null,
      product_type: p.product_type ?? p.productType ?? null,
      title: p.title ?? null,
      base: p.base ?? null,
      year1: ('year1' in p) ? p.year1 : (('y1' in p) ? p.y1 : null),
      year2: ('year2' in p) ? p.year2 : (('y2' in p) ? p.y2 : null),
      year3: ('year3' in p) ? p.year3 : (('y3' in p) ? p.y3 : null),
      active: ('active' in p) ? p.active : true,
    };
  }

  const DM = {
    async getBanks(){
      const sb = requireClient();
      // พยายาม select ให้ครอบคลุม schema ที่ต่างกัน
      let sel = 'id, short_name, name, mrr, mrr_effective_from';
      let { data, error } = await sb.from('banks').select(sel).order('short_name', { nulls: 'last' });
      if (error){
        // fallback ถ้าบางคอลัมน์หาย
        console.warn('getBanks() fallback:', error.message);
        ({ data, error } = await sb.from('banks').select('id, short_name, name, mrr').order('short_name', { nulls:'last' }));
        if (error) throw error;
      }
      return data || [];
    },

    async updateBankMRR(bankId, mrr, effectiveDate=null){
      const sb = requireClient();
      const payload = { mrr };
      if (effectiveDate) payload.mrr_effective_from = effectiveDate;
      const { error } = await sb.from('banks').update(payload).eq('id', bankId);
      if (error) throw error;
      return true;
    },

    async listPromotions(){
      const sb = requireClient();
      // ดึงทุกคอลัมน์แล้ว normalize (รองรับชื่อฟิลด์ y1/y2/y3 หรือ year1/year2/year3)
      const { data, error } = await sb.from('promotions').select('*').eq('active', true).order('id', {ascending:true});
      if (error){
        console.warn('listPromotions() error:', error.message);
        return [];
      }
      return (data || []).map(normPromo);
    },

    async createPromotion(payload){
      const sb = requireClient();
      const p = Object.assign({}, payload);
      // แปลง y1/y2/y3 → year1/year2/year3 ถ้ายังไม่มี
      p.year1 = p.year1 ?? p.y1 ?? null;
      p.year2 = p.year2 ?? p.y2 ?? null;
      p.year3 = p.year3 ?? p.y3 ?? null;
      const { data, error } = await sb.from('promotions').insert([{
        bank_id: p.bank_id,
        product_type: p.product_type,
        title: p.title,
        description: p.description ?? null,
        base: p.base ?? null,
        year1: p.year1, year2: p.year2, year3: p.year3,
        active: ('active' in p) ? !!p.active : true
      }]).select('*').single();
      if (error) throw error;
      return normPromo(data);
    },

    async updatePromotion(id, payload){
      const sb = requireClient();
      const p = Object.assign({}, payload);
      p.year1 = p.year1 ?? p.y1 ?? null;
      p.year2 = p.year2 ?? p.y2 ?? null;
      p.year3 = p.year3 ?? p.y3 ?? null;
      const { data, error } = await sb.from('promotions').update({
        bank_id: p.bank_id,
        product_type: p.product_type,
        title: p.title,
        description: p.description ?? null,
        base: p.base ?? null,
        year1: p.year1, year2: p.year2, year3: p.year3,
        active: ('active' in p) ? !!p.active : undefined
      }).eq('id', id).select('*').single();
      if (error) throw error;
      return normPromo(data);
    },

    async deletePromotion(id){
      const sb = requireClient();
      const { error } = await sb.from('promotions').delete().eq('id', id);
      if (error) throw error;
      return true;
    },
  };

  window.DM = DM;
})();