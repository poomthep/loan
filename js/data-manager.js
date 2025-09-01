import {supabase}from './supabase-init.js';

export async function getBanks(){
		const {data,error}=await supabase.from('banks').select('id,short_name,name').order('id');
		if(error)throw error;
		return data||[]
	}
	
// js/data-manager.js
export async function getActivePromotions(productType) {
  let query = window.supabase
    .from('promotions')
    .select('*')
    .eq('active', true);        // <- ใช้ active ไม่ใช่ is_active

  if (productType) {
    query = query.eq('product_type', productType);
  }

  const { data, error } = await query.order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function saveCalculation(params,results,mode){
		const s=(await supabase.auth.getSession()).data.session;
		if(!s)return;
		const payload={user_id:s.user.id,product_type:params.productType,calculation_mode:mode,params,results:{calculationResults:results}};
		const {error}=await supabase.from('calculations').insert(payload);
		if(error)console.warn('saveCalculation',error.message)
	}

export async function getUserCalculations(limit=10){
	const s=(await supabase.auth.getSession()).data.session;
	if(!s)return[];
	const {data,error}=await supabase.from('calculations').select('*').eq('user_id',s.user.id).order('created_at',{ascending:false}).limit(limit);
	if(error)throw error;return data||[]
	}
	
export async function checkDatabaseConnection(){
		try{await supabase.from('banks').select('id').limit(1);
		return true}catch(e){return false}
	}
	
	// js/data-manager.js
// NOTE: ต้องมี window.supabase มาจาก supabase-init.js แล้ว

export async function getBanks() {
  const { data, error } = await window.supabase
    .from('banks')
    .select('id, short_name, name, mrr, mrr_effective_date')
    .order('short_name', { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function updateBankMRR(bankId, mrr, effectiveDate) {
  const payload = { mrr };
  if (effectiveDate) payload.mrr_effective_date = effectiveDate;

  const { data, error } = await window.supabase
    .from('banks')
    .update(payload)
    .eq('id', bankId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function getActivePromotions(productType) {
  let query = window.supabase
    .from('promotions')
    .select(`
      id, bank_id, product_type, title, description,
      base, year1_rate, year2_rate, year3_rate,
      active
    `)
    .eq('active', true)
    .order('id', { ascending: true });

  if (productType) query = query.eq('product_type', productType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function listPromotions(productType) {
  // ใช้ในหน้าแอดมิน (เห็นทั้ง active/inactive)
  let query = window.supabase
    .from('promotions')
    .select(`
      id, bank_id, product_type, title, description,
      base, year1_rate, year2_rate, year3_rate,
      active
    `)
    .order('id', { ascending: true });

  if (productType) query = query.eq('product_type', productType);

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

export async function createPromotion(promo) {
  // promo: { bank_id, product_type, title, description, base, year1_rate, year2_rate, year3_rate, active }
  const { data, error } = await window.supabase
    .from('promotions')
    .insert(promo)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updatePromotion(id, patch) {
  const { data, error } = await window.supabase
    .from('promotions')
    .update(patch)
    .eq('id', id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function deletePromotion(id) {
  const { error } = await window.supabase
    .from('promotions')
    .delete()
    .eq('id', id);
  if (error) throw error;
  return true;
}
