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