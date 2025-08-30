/*! data-manager.js (no-async version)
 * Loan App – Data Manager for browser (global)
 * - ไม่ใช้ async/await เพื่อกัน parse error
 * - ผูก API ไว้ที่ window.DataManager
 * - ต้องมี window.supabase (โหลดจาก supabase-init.js มาก่อน)
 */
(function (global) {
  'use strict';

  // ----------------------------
  // Utilities
  // ----------------------------
  function ensureClient() {
    var sb = global && global.supabase;
    if (!sb || typeof sb.from !== 'function') {
      throw new Error('Supabase client (window.supabase) is required');
    }
    return sb;
  }

  function getUserIdIfAny() {
    try {
      if (global.AuthManager && typeof global.AuthManager.getUser === 'function') {
        var u = global.AuthManager.getUser();
        return (u && u.id) ? u.id : null;
      }
    } catch (e) {}
    return null;
  }

  function assertAdminIfPossible() {
    if (global.AuthManager && typeof global.AuthManager.isAdmin === 'function') {
      if (!global.AuthManager.isAdmin()) {
        throw new Error('ต้องเป็น Admin เท่านั้น');
      }
    }
  }

  // ----------------------------
  // DataManager (global object)
  // ----------------------------
  var DataManager = {
    _cache: {
      banks: null,
      promotionsActive: null,
      bankRules: null,
      mrrRates: null
    },

    /**
     * เรียกตอนเริ่มแอป – preload ข้อมูลที่จำเป็น
     */
    init: function () {
      var self = this;
      return self.preloadBanks().then(function () { return true; });
    },

    /**
     * โหลดรายชื่อธนาคารและแคช
     */
    preloadBanks: function () {
      var self = this;
      var sb = ensureClient();
      return sb
        .from('banks')
        .select('id, name, bank_name, short_name, is_active')
        .order('short_name', { ascending: true })
        .then(function (resp) {
          if (resp.error) throw resp.error;
          self._cache.banks = Array.isArray(resp.data) ? resp.data : [];
          return self._cache.banks;
        });
    },

    /**
     * ดึงรายชื่อธนาคารจากแคช (หรือโหลดใหม่ถ้า force)
     */
    getBanks: function (force) {
      if (!force && Array.isArray(this._cache.banks)) {
        return Promise.resolve(this._cache.banks);
      }
      return this.preloadBanks();
    },

    /**
     * หาแบงก์ตาม id
     */
    getBankById: function (bankId) {
      return this.getBanks(false).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var b = list[i];
          if (b && b.id === bankId) return b;
        }
        return null;
      });
    },

    /**
     * หาแบงก์ตาม short_name
     */
    getBankByShortName: function (shortName) {
      return this.getBanks(false).then(function (list) {
        for (var i = 0; i < list.length; i++) {
          var b = list[i];
          if (b && b.short_name === shortName) return b;
        }
        return null;
      });
    },

    /**
     * โปรโมชันที่เปิดใช้งาน (สำหรับหน้า user)
     */
    getActivePromotions: function () {
      var self = this;
      var sb = ensureClient();
      return sb
        .from('promotions')
        .select('*, bank:banks(name, short_name)')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .then(function (resp) {
          if (resp.error) throw resp.error;
          self._cache.promotionsActive = Array.isArray(resp.data) ? resp.data : [];
          return self._cache.promotionsActive;
        });
    },

    /**
     * กฎเกณฑ์ธนาคาร (เช่น DSR/LTV rule ต่อผลิตภัณฑ์)
     */
    getBankRules: function () {
      var self = this;
      var sb = ensureClient();
      return sb
        .from('bank_rules')
        .select('*, bank:banks(name, short_name)')
        .order('bank_id', { ascending: true })
        .order('product_type', { ascending: true })
        .then(function (resp) {
          if (resp.error) throw resp.error;
          self._cache.bankRules = Array.isArray(resp.data) ? resp.data : [];
          return self._cache.bankRules;
        });
    },

    /**
     * อัตรา MRR (ตามแบงก์/ประเภท/มีผลเมื่อไหร่)
     */
    getMRRRates: function () {
      var self = this;
      var sb = ensureClient();
      return sb
        .from('mrr_rates')
        .select('*, bank:banks(name, short_name)')
        .order('bank_id', { ascending: true })
        .order('product_type', { ascending: true })
        .order('effective_date', { ascending: true })
        .then(function (resp) {
          if (resp.error) throw resp.error;
          self._cache.mrrRates = Array.isArray(resp.data) ? resp.data : [];
          return self._cache.mrrRates;
        });
    },

    /**
     * รวมข้อมูลที่ต้องใช้คำนวณ (หน้า user)
     */
    getAllDataForCalculation: function () {
      var self = this;
      return Promise.all([
        self.getBanks(false),
        self.getBankRules(),
        self.getMRRRates(),
        self.getActivePromotions()
      ]).then(function (out) {
        return {
          banks: out[0] || [],
          bankRules: out[1] || [],
          mrrRates: out[2] || [],
          promotions: out[3] || []
        };
      });
    },

    /**
     * รวมข้อมูลสำหรับ Admin (ดึงทั้งหมด ไม่กรอง is_active)
     */
    getAllDataForAdmin: function () {
      assertAdminIfPossible();
      var sb = ensureClient();

      return Promise.all([
        sb.from('banks')
          .select('*')
          .order('short_name', { ascending: true }),

        sb.from('promotions')
          .select('*, bank:banks(name, short_name)')
          .order('created_at', { ascending: false }),

        sb.from('bank_rules')
          .select('*, bank:banks(name, short_name)')
          .order('bank_id', { ascending: true })
          .order('product_type', { ascending: true }),

        sb.from('mrr_rates')
          .select('*, bank:banks(name, short_name)')
          .order('bank_id', { ascending: true })
          .order('product_type', { ascending: true })
          .order('effective_date', { ascending: true })
      ]).then(function (results) {
        var banksRes = results[0];
        var promotionsRes = results[1];
        var bankRulesRes = results[2];
        var mrrRatesRes = results[3];

        if (banksRes.error) throw banksRes.error;
        if (promotionsRes.error) throw promotionsRes.error;
        if (bankRulesRes.error) throw bankRulesRes.error;
        if (mrrRatesRes.error) throw mrrRatesRes.error;

        return {
          banks: banksRes.data || [],
          promotions: promotionsRes.data || [],
          bankRules: bankRulesRes.data || [],
          mrrRates: mrrRatesRes.data || []
        };
      });
    },

    /**
     * บันทึกผลการคำนวณ (ถ้ามีตาราง calculations)
     */
    saveCalculation: function (payload) {
      var sb = ensureClient();
      var userId = getUserIdIfAny();

      var row = {};
      for (var k in payload) {
        if (Object.prototype.hasOwnProperty.call(payload, k)) {
          row[k] = payload[k];
        }
      }
      if (userId) row.user_id = userId;

      return sb.from('calculations').insert(row).select('*').single()
        .then(function (resp) {
          if (resp.error) throw resp.error;
          return resp.data;
        });
    },

    /**
     * ประวัติการคำนวณของผู้ใช้ปัจจุบัน
     */
    getUserCalculations: function (limit) {
      var sb = ensureClient();
      var userId = getUserIdIfAny();
      if (!userId) return Promise.resolve([]);

      var query = sb
        .from('calculations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (typeof limit === 'number' && limit > 0) {
        query = query.limit(limit);
      }

      return query.then(function (resp) {
        if (resp.error) throw resp.error;
        return resp.data || [];
      });
    }
  };

  // expose to window
  global.DataManager = DataManager;
  console.info('[DataManager] ready:', !!global.DataManager);

})(typeof window !== 'undefined' ? window : this);
