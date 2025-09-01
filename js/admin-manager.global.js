// ชั้นบางๆ สำหรับหน้าแอดมิน โยนเป็นคลาสโกลบอล window.AdminManager
(function (global) {
  const DM = global.DM || {};

  function AdminManager() {
    // Banks
    this.getBanks = () => DM.getBanks();
    this.updateBankMRR = (id, mrr, date) => DM.updateBankMRR(id, mrr, date);

    // Promotions
    this.listPromotions  = () => DM.listPromotions();
    this.upsertPromotion = (p) => DM.upsertPromotion(p);
    this.deletePromotion = (id) => DM.deletePromotion(id);

    this.init = async function () { /* ใส่ bootstrap เพิ่มได้ถ้าต้องการ */ };
  }

  global.AdminManager = AdminManager;
})(window);
