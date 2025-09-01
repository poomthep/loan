// /js/admin-manager-supabase.js
// เวอร์ชันล่าสุด: รองรับทั้ง named และ default export + รวม helper ครบ
// ใช้ร่วมกับ data-manager.js ที่ export ฟังก์ชันเหล่านี้ไว้แล้ว

import {
  // banks
  getBanks,
  updateBankMRR,

  // promotions
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
} from './data-manager.js';

/**
 * AdminManager: ชั้นบาง ๆ สำหรับหน้า /admin/
 * - รวมเมธอดใช้งานทั่วไปสำหรับแอดมิน
 * - upsertPromotion จะเลือก create/update ให้อัตโนมัติ
 */
class AdminManager {
  // ---------- Banks ----------
  async getBanks() {
    return await getBanks();
  }

  /**
   * อัปเดต MRR ธนาคาร
   * @param {number|string} bankId
   * @param {number} mrr ค่า MRR เช่น 6.85
   * @param {string|null} effectiveDate 'YYYY-MM-DD' หรือ null
   */
  async updateBankMRR(bankId, mrr, effectiveDate = null) {
    return await updateBankMRR(bankId, mrr, effectiveDate);
  }

  // ---------- Promotions ----------
  async listPromotions() {
    return await listPromotions();
  }

  /**
   * upsertPromotion: ถ้ามี id => update, ถ้าไม่มี => create
   * @param {{
   *  id?: number,
   *  bank_id: number,
   *  product_type: 'MORTGAGE'|'REFINANCE'|'PERSONAL'|'SME',
   *  title: string,
   *  description?: string|null,
   *  base?: 'MRR'|'MLR'|'MOR'|null,
   *  year1?: number|null,
   *  year2?: number|null,
   *  year3?: number|null,
   *  active?: boolean
   * }} payload
   */
  async upsertPromotion(payload) {
    if (payload && payload.id) {
      return await updatePromotion(payload.id, payload);
    }
    return await createPromotion(payload);
  }

  async deletePromotion(id) {
    return await deletePromotion(id);
  }
}

// export ได้ทั้ง named + default เพื่อกันพลาดเวลา import
export { AdminManager };
export default AdminManager;

// re-export helper เผื่ออยากเรียกโดยตรง
export {
  getBanks,
  updateBankMRR,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
};


export { AdminManager, getBanks, updateBankMRR, listPromotions, upsertPromotion, deletePromotion };
+ export default AdminManager;