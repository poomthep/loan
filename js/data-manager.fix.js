/*! data-manager.fix.js
 * Override ฟังก์ชันหลักของ DataManager เพื่อกันคอลัมน์ไม่ตรงสกีมา
 * ต้องโหลดไฟล์นี้ "หลัง" data-manager.js เสมอ
 */
(function (g) {
  'use strict';

  var DM = g.DataManager = g.DataManager || {};
  DM._cache = DM._cache || { banks: null };

  function ensureClient() {
    var sb = g.supabase;
    if (!sb || typeof sb.from !== 'function') {
      throw new Error('Supabase client (window.supabase) is required');
    }
    return sb;
  }

  // ✅ แทนที่ทั้งฟังก์ชัน
  DM.preloadBanks = function () {
    var sb = ensureClient();
    console.info('[DM.fix] preloadBanks override active');

    return sb
      .from('banks')
      .select('*') // <- กันคอลัมน์ mismatch (ไม่ใส่ is_active)
      .order('short_name', { ascending: true })
      .then(function (resp) {
        if (resp.error) {
          console.error('[DM.fix] preloadBanks error:', resp.error);
          throw resp.error;
        }

        var list = Array.isArray(resp.data) ? resp.data.map(function (row) {
          // normalize ชื่อคอลัมน์ เพื่อกันโค้ดส่วนอื่นที่คาดหวัง
          if (typeof row.name === 'undefined' && typeof row.bank_name !== 'undefined') {
            row.name = row.bank_name;
          }
          if (typeof row.short_name === 'undefined' && typeof row.code !== 'undefined') {
            row.short_name = row.code;
          }
          if (typeof row.is_active === 'undefined') {
            row.is_active = true; // default ให้เปิดใช้
          }
          return row;
        }) : [];

        DM._cache.banks = list;
        return list;
      });
  };

  // ✅ แทนที่ทั้งฟังก์ชัน
  DM.getBanks = function (force) {
    if (!force && Array.isArray(DM._cache.banks)) {
      return Promise.resolve(DM._cache.banks);
    }
    return DM.preloadBanks();
  };

  // ✅ แทนที่ทั้งฟังก์ชัน
  DM.init = function () {
    return DM.preloadBanks().then(function () { return true; });
  };

})(window);
