// js/modules/data-manager.js
import { supabase } from './supabase-client.js';

export class DataManager {
  async getBanks() {
    const { data, error } = await supabase.from('banks').select('*').order('name', { ascending: true });
    if (error) throw error;
    return data;
  }
  
  async getPromotions() {
    const { data, error } = await supabase.from('promotions').select('*');
    if (error) throw error;
    return data;
  }
  
  async getRules() {
    const { data, error } = await supabase.from('rules').select('*');
    if (error) throw error;
    return data;
  }
  
  async getMrrRates() {
    const { data, error } = await supabase.from('mrr_rates').select('*');
    if (error) throw error;
    return data;
  }
  
  // Method สำหรับการจัดการข้อมูล (เพิ่ม, แก้ไข, ลบ)
  // ต้องมีการตั้งค่า RLS ที่เหมาะสมใน Supabase
  async addBank(bank) {
    const { data, error } = await supabase.from('banks').insert([bank]);
    if (error) throw error;
    return data;
  }
  
  // ... เพิ่ม methods สำหรับ addPromotion, addRule, update, delete
}

export default DataManager;