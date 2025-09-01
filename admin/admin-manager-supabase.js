// /js/admin-manager-supabase.js
'use strict';

import {
  getBanks as dmGetBanks,
  updateBankMRR as dmUpdateBankMRR,
  listPromotions as dmListPromotions,
  createPromotion as dmCreatePromotion,
  updatePromotion as dmUpdatePromotion,
  deletePromotion as dmDeletePromotion,
} from './data-manager.js';

export class AdminManager {
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
  async upsertPromotion(payload) {
    if (payload?.id) return dmUpdatePromotion(payload.id, payload);
    return dmCreatePromotion(payload);
  }
  async deletePromotion(id) {
    return dmDeletePromotion(id);
  }
}

// เผื่ออยากเรียก helper โดยตรง
export {
  dmGetBanks as getBanks,
  dmUpdateBankMRR as updateBankMRR,
  dmListPromotions as listPromotions,
  dmCreatePromotion as createPromotion,
  dmUpdatePromotion as updatePromotion,
  dmDeletePromotion as deletePromotion,
};

// ✅ default export เป็นคลาสจริง ๆ
export default AdminManager;
