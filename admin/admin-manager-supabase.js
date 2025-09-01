// ใช้ named export เท่านั้น (ไม่มี default)
// โมดูลนี้คือชั้นบาง ๆ สำหรับหน้า /admin/
// พึ่งพา data-manager.js ซึ่ง export ฟังก์ชันแบบ named เช่นกัน

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

  /**
   * อัปเดต MRR ธนาคาร
   * @param {number|string} bankId
   * @param {number} mrr
   * @param {string|null} effectiveDate 'YYYY-MM-DD' | null
   */
  async updateBankMRR(bankId, mrr, effectiveDate = null) {
    return updateBankMRR(bankId, mrr, effectiveDate);
  }

  // ---------- Promotions ----------
  async listPromotions() {
    return listPromotions();
  }

  /**
   * ถ้ามี id => update, ถ้าไม่มี => create
   */
  async upsertPromotion(payload) {
    return payload?.id
      ? updatePromotion(payload.id, payload)
      : createPromotion(payload);
  }

  async deletePromotion(id) {
    return deletePromotion(id);
  }
}

// เผื่อใช้ helper โดยตรง (ยังคงเป็น named ทั้งหมด)
export {
  getBanks,
  updateBankMRR,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};
