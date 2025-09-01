
// data-manager.js
// รวม helper คุยกับ Supabase
import { getSupabase } from './supabase-init.js';
const SB = () => getSupabase();

export const DataManager = {
  async checkConnection(){
    try{
      const { error } = await SB().from('user_profiles').select('id').limit(1);
      return !error;
    }catch(e){ return false; }
  },
  // Banks
  async getBanks(){ const { data, error } = await SB().from('banks').select('*').order('short_name'); if(error) throw error; return data||[]; },
  // Promotions
  async getActivePromotions(product='MORTGAGE'){
    const { data, error } = await SB().from('promotions').select('*').eq('active', true).eq('product', product).order('bank_short'); 
    if(error) throw error; 
    return data||[]; 
  },
  // Save calculation history (optional table)
  async saveCalculation(payload){
    // table: calculations { id uuid pk, user_id uuid, payload json, created_at timestamptz default now() }
    const { data: session } = await SB().auth.getUser();
    const userId = session?.user?.id || null;
    const { error } = await SB().from('calculations').insert({ user_id: userId, payload });
    if(error) console.warn('saveCalculation error', error);
  },
  async getUserCalculations(limit=10){
    const { data: session } = await SB().auth.getUser();
    const userId = session?.user?.id || null;
    if(!userId) return [];
    const { data, error } = await SB().from('calculations').select('id, payload, created_at').eq('user_id', userId).order('created_at', { ascending:false }).limit(limit);
    if(error) return [];
    return data || [];
  }
};

if(typeof window!=='undefined') window.DataManager = DataManager;
export default DataManager;
