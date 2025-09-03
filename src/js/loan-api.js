import { supabase } from '../config/supabaseClient.js';

export async function getPromotions(){
  const { data, error } = await supabase.from('promotions').select('*');
  if(error) throw error;
  return data;
}
