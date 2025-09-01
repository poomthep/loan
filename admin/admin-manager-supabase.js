// /js/admin-manager-supabase.js
// เวอร์ชันสะอาด: รองรับทั้ง named และ default export
// ใช้ร่วมกับ data-manager.js ที่มีฟังก์ชันต่อไปนี้แล้ว

import {
  getBanks as dmGetBanks,
  updateBankMRR as dmUpdateBankMRR,
  listPromotions as dmListPromotions,
  createPromotion as dmCreatePromotion,
  updatePromotion as dmUpdatePromotion,
  deletePromotion as dmDeletePromotion,
} from './data-manager.js';

/**
 * AdminManager: ชั้นบาง ๆ สำหรับหน้า /admin/
 * - รวมเมธอดใช้งานทั่วไปสำหรับแอดมิน
 * - upsertPromotion จะเลือก create/update ให้อัตโนมัติ
 */
export class AdminManager {
  async getBanks() { return dmGetBanks(); }
  async updateBankMRR(id, mrr, eff=null) { return dmUpdateBankMRR(id, mrr, eff); }
  async listPromotions() { return dmListPromotions(); }
  async upsertPromotion(payload) { return upsertPromotion(payload); }
  async deletePromotion(id) { return dmDeletePromotion(id); }
}

/** ฟังก์ชันระดับบนสำหรับ import ตรง ๆ: { upsertPromotion } */
export async function upsertPromotion(payload) {
  if (payload?.id) return dmUpdatePromotion(payload.id, payload);
  return dmCreatePromotion(payload);
}

// re-export helper เผื่ออยากเรียกโดยตรงจากโมดูลนี้
export {
  dmGetBanks as getBanks,
  dmUpdateBankMRR as updateBankMRR,
  dmListPromotions as listPromotions,
  dmCreatePromotion as createPromotion,
  dmUpdatePromotion as updatePromotion,
  dmDeletePromotion as deletePromotion,
};

// ให้ default เป็นคลาส AdminManager (ใครจะ import default ก็ได้)
export default AdminManager;
