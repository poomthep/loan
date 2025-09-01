// ใช้ named export เท่านั้น
// ทำงานทับกับ data-manager.js ที่ export เป็น named อยู่แล้ว

import {
  getBanks,
  updateBankMRR,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from './data-manager.js';

export class AdminManager {
  // ---------- Banks ----------
  async getBanks() {
    return getBanks();
  }
  async updateBankMRR(bankId, mrr, effectiveDate = null) {
    return updateBankMRR(bankId, mrr, effectiveDate);
  }

  // ---------- Promotions ----------
  async listPromotions() {
    return listPromotions();
  }
  async upsertPromotion(payload) {
    return payload?.id
      ? updatePromotion(payload.id, payload)
      : createPromotion(payload);
  }
  async deletePromotion(id) {
    return deletePromotion(id);
  }
}

// เผื่ออยากเรียกฟังก์ชันตรง ๆ จากที่อื่น ก็ re-export ให้ด้วย (named ทั้งหมด)
export {
  getBanks,
  updateBankMRR,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
