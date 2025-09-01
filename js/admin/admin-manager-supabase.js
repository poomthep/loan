// /js/admin-manager-supabase.js
// เบา ๆ: เป็นชั้นบาง ๆ (facade) ครอบ data-manager ให้หน้า admin เรียกง่าย
// Export ทั้งแบบ named และ default เพื่อกันพลาดจากรูปแบบการ import ที่ต่างกัน

import {
  getBanks,
  updateBankMRR,
  listPromotions,
  upsertPromotion,
  deletePromotion,
} from './data-manager.js';

export class AdminManager {
  // Banks
  async getBanks() {
    return await getBanks();
  }

  async updateBankMRR(bankId, mrr, effectiveDate) {
    return await updateBankMRR(bankId, mrr, effectiveDate);
  }

  // Promotions
  async listPromotions() {
    return await listPromotions();
  }

  async upsertPromotion(payload) {
    // payload: {id?, bank_id, product_type, title, description?, base?, year1?, year2?, year3?, active?}
    return await upsertPromotion(payload);
  }

  async deletePromotion(id) {
    return await deletePromotion(id);
  }
}

// เผื่อไฟล์อื่น import เป็น default
export default AdminManager;

// เผื่ออยากเรียก function ตรง ๆ ก็ export ต่อให้ด้วย
export {
  getBanks,
  updateBankMRR,
  listPromotions,
  upsertPromotion,
  deletePromotion,
};
