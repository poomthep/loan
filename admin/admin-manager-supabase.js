// /js/admin-manager-supabase.js
// เวอร์ชันสะอาด: รองรับทั้ง named และ default export
// ใช้ร่วมกับ data-manager.js ที่มีฟังก์ชันต่อไปนี้แล้ว
import * as AdminNS from '../js/admin-manager-supabase.js?v=20250901-6';
const AdminManager = AdminNS.AdminManager || AdminNS.default;
const am = new AdminManager();

import {
  // banks
  getBanks as dmGetBanks,
  updateBankMRR as dmUpdateBankMRR,
  // promotions
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
  // ---------- Banks ----------
  async getBanks() {
    return dmGetBanks();
  }

  /**
   * อัปเดต MRR ธนาคาร
   * @param {number|string} bankId
   * @param {number} mrr ค่า MRR เช่น 6.85
   * @param {string|null} effectiveDate 'YYYY-MM-DD' หรือ null
   */
  async updateBankMRR(bankId, mrr, effectiveDate = null) {
    return dmUpdateBankMRR(bankId, mrr, effectiveDate);
  }

  // ---------- Promotions ----------
  async listPromotions() {
    return dmListPromotions();
  }

  /**
   * upsertPromotion: ถ้ามี id => update, ถ้าไม่มี => create
   * (เมธอดนี้เรียกใช้ฟังก์ชันระดับบนชื่อเดียวกันอีกที)
   */
  async upsertPromotion(payload) {
    return upsertPromotion(payload);
  }

  async deletePromotion(id) {
    return dmDeletePromotion(id);
  }
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
