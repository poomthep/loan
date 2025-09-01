'use strict';

// ดึง helper จาก data-manager.js (ต้องมี export ตามชื่อเหล่านี้)
import {
  getBanks as dmGetBanks,
  updateBankMRR as dmUpdateBankMRR,
  listPromotions as dmListPromotions,
  createPromotion as dmCreatePromotion,
  updatePromotion as dmUpdatePromotion,
  deletePromotion as dmDeletePromotion,
} from './data-manager.js';

/** ชั้นบาง ๆ สำหรับหน้า /admin/ */
class AdminManager {
  // ---------- Banks ----------
  async getBanks() {
    return dmGetBanks();
  }
  async updateBankMRR(bankId, mrr, effectiveDate = null) {
    return dmUpdateBankMRR(bankId, mrr, effectiveDate);
  }

  // ---------- Promotions ----------
  async listPromotions() {
    return dmListPromotions();
  }
  /** upsert: มี id = update, ไม่มีก็ create */
  async upsertPromotion(payload) {
    if (payload?.id) return dmUpdatePromotion(payload.id, payload);
    return dmCreatePromotion(payload);
  }
  async deletePromotion(id) {
    return dmDeletePromotion(id);
  }
}

// named export
export { AdminManager };

// เผื่อเรียก helper ตรง ๆ
export {
  dmGetBanks as getBanks,
  dmUpdateBankMRR as updateBankMRR,
  dmListPromotions as listPromotions,
  dmCreatePromotion as createPromotion,
  dmUpdatePromotion as updatePromotion,
  dmDeletePromotion as deletePromotion,
};

// ✅ default export (แก้ปัญหา "does not provide an export named 'default'")
export default AdminManager;
