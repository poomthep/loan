// js/data-manager.js
// ========================================
// DATA MANAGER - DATABASE OPERATIONS
// ========================================

import supabase, { handleSupabaseError, retrySupabaseRequest, getSessionId } from './supabase-client.js';
import { AuthManager } from './auth-manager.js';

/**
 * จัดการการดึงและจัดการข้อมูลจาก Supabase
 */
export class DataManager {
  static cache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  /**
   * ดึงข้อมูลพร้อม cache
   */
  static async getWithCache(key, fetcher, ttl = this.cacheTimeout) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < ttl) {
      return cached.data;
    }

    try {
      const data = await fetcher();
      this.cache.set(key, { data, timestamp: Date.now() });
      return data;
    } catch (error) {
      // หากมี cached data เก่า ให้ใช้แทน
      if (cached) {
        console.warn('Using stale cache data due to error:', error);
        return cached.data;
      }
      throw error;
    }
  }

  /**
   * ล้าง cache
   */
  static clearCache(pattern = null) {
    if (pattern) {
      for (const key of this.cache.keys()) {
        if (key.includes(pattern)) {
          this.cache.delete(key);
        }
      }
    } else {
      this.cache.clear();
    }
  }

  // ========================================
  // BANKS OPERATIONS
  // ========================================

  /**
   * ดึงรายการธนาคารทั้งหมด
   */
  static async getBanks() {
    return this.getWithCache('banks', async () => {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('active', true)
        .order('short_name');

      if (error) throw error;
      return data || [];
    });
  }

  /**
   * ดึงกฎเกณฑ์ของธนาคารเฉพาะ
   */
  static async getBankRulesByBank(bankId, productType, propertyType = null, homeNumber = null) {
    const rules = await this.getBankRules(productType);
    
    return rules.filter(rule => {
      if (rule.bank_id !== bankId) return false;
      if (propertyType && rule.property_type && rule.property_type !== propertyType) return false;
      if (homeNumber && rule.home_number && rule.home_number !== homeNumber) return false;
      return true;
    }).sort((a, b) => (a.priority || 1) - (b.priority || 1));
  }

  /**
   * หากฎเกณฑ์ที่เหมาะสมที่สุด
   */
  static findBestMatchingRule(rules, criteria) {
    // เรียงลำดับความเหมาะสม: เงื่อนไขเฉพาะเจาะจง > ทั่วไป
    return rules.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      
      // Property type match
      if (a.property_type === criteria.propertyType) scoreA += 10;
      if (b.property_type === criteria.propertyType) scoreB += 10;
      
      // Home number match
      if (a.home_number === criteria.homeNumber) scoreA += 5;
      if (b.home_number === criteria.homeNumber) scoreB += 5;
      
      // Priority
      scoreA += (10 - (a.priority || 1));
      scoreB += (10 - (b.priority || 1));
      
      return scoreB - scoreA;
    })[0];
  }

  // ========================================
  // USER CALCULATIONS OPERATIONS
  // ========================================

  /**
   * บันทึกประวัติการคำนวณ
   */
  static async saveCalculation(calculationData) {
    try {
      const user = AuthManager.getCurrentUser();
      const dataToSave = {
        ...calculationData,
        user_id: user?.id || null,
        session_id: !user ? getSessionId() : null,
        created_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('user_calculations')
        .insert(dataToSave)
        .select()
        .single();

      if (error) throw error;
      
      console.log('✅ Calculation saved:', data.id);
      return { success: true, data };

    } catch (error) {
      console.error('❌ Error saving calculation:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * ดึงประวัติการคำนวณ
   */
  static async getUserCalculations(limit = 10) {
    try {
      const user = AuthManager.getCurrentUser();
      const sessionId = getSessionId();

      let query = supabase
        .from('user_calculations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.eq('session_id', sessionId);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];

    } catch (error) {
      console.error('Error loading user calculations:', error);
      return [];
    }
  }

  /**
   * ลบประวัติการคำนวณ
   */
  static async deleteCalculation(calculationId) {
    try {
      const { error } = await supabase
        .from('user_calculations')
        .delete()
        .eq('id', calculationId);

      if (error) throw error;
      
      return { success: true };

    } catch (error) {
      console.error('Error deleting calculation:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  // ========================================
  // ADMIN OPERATIONS
  // ========================================

  /**
   * เพิ่มธนาคารใหม่ (Admin only)
   */
  static async addBank(bankData) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { data, error } = await supabase
        .from('banks')
        .insert(bankData)
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('banks');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * เพิ่มโปรโมชันใหม่ (Admin only)
   */
  static async addPromotion(promotionData) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { data, error } = await supabase
        .from('promotions')
        .insert(promotionData)
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('promotions');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * อัพเดตโปรโมชัน (Admin only)
   */
  static async updatePromotion(promotionId, updates) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { data, error } = await supabase
        .from('promotions')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', promotionId)
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('promotions');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * ลบโปรโมชัน (Admin only)
   */
  static async deletePromotion(promotionId) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { error } = await supabase
        .from('promotions')
        .delete()
        .eq('id', promotionId);

      if (error) throw error;
      
      this.clearCache('promotions');
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * เพิ่มกฎเกณฑ์ธนาคารใหม่ (Admin only)
   */
  static async addBankRule(ruleData) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { data, error } = await supabase
        .from('bank_rules')
        .insert(ruleData)
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('bank_rules');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * อัพเดตกฎเกณฑ์ธนาคาร (Admin only)
   */
  static async updateBankRule(ruleId, updates) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { data, error } = await supabase
        .from('bank_rules')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', ruleId)
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('bank_rules');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * ลบกฎเกณฑ์ธนาคาร (Admin only)
   */
  static async deleteBankRule(ruleId) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      const { error } = await supabase
        .from('bank_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;
      
      this.clearCache('bank_rules');
      return { success: true };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * อัพเดตอัตรา MRR (Admin only)
   */
  static async updateMRRRate(bankId, productType, newRate) {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      // เพิ่มอัตราใหม่
      const { data, error } = await supabase
        .from('mrr_rates')
        .insert({
          bank_id: bankId,
          product_type: productType,
          rate: newRate,
          effective_date: new Date().toISOString().split('T')[0],
          active: true
        })
        .select()
        .single();

      if (error) throw error;
      
      this.clearCache('mrr_rates');
      return { success: true, data };

    } catch (error) {
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  // ========================================
  // REAL-TIME SUBSCRIPTIONS
  // ========================================

  /**
   * Subscribe to promotions changes
   */
  static subscribeToPromotions(callback) {
    return supabase
      .channel('promotions-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'promotions'
      }, (payload) => {
        console.log('🔄 Promotions changed:', payload);
        this.clearCache('promotions');
        callback && callback(payload);
      })
      .subscribe();
  }

  /**
   * Subscribe to bank rules changes
   */
  static subscribeToBankRules(callback) {
    return supabase
      .channel('bank-rules-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'bank_rules'
      }, (payload) => {
        console.log('🔄 Bank rules changed:', payload);
        this.clearCache('bank_rules');
        callback && callback(payload);
      })
      .subscribe();
  }

  /**
   * Subscribe to MRR rates changes
   */
  static subscribeToMRRRates(callback) {
    return supabase
      .channel('mrr-rates-changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'mrr_rates'
      }, (payload) => {
        console.log('🔄 MRR rates changed:', payload);
        this.clearCache('mrr_rates');
        callback && callback(payload);
      })
      .subscribe();
  }

  /**
   * Unsubscribe from all channels
   */
  static unsubscribeAll() {
    return supabase.removeAllChannels();
  }

  // ========================================
  // BULK OPERATIONS
  // ========================================

  /**
   * ดึงข้อมูลทั้งหมดสำหรับการคำนวณ
   */
  static async getAllDataForCalculation(productType) {
    try {
      const [banks, promotions, bankRules, mrrRates] = await Promise.all([
        this.getBanks(),
        this.getActivePromotions(productType),
        this.getBankRules(productType),
        this.getMRRRates(productType)
      ]);

      return {
        banks: banks || [],
        promotions: promotions || [],
        bankRules: bankRules || [],
        mrrRates: mrrRates || []
      };

    } catch (error) {
      console.error('Error loading calculation data:', error);
      return {
        banks: [],
        promotions: [],
        bankRules: [],
        mrrRates: []
      };
    }
  }

  /**
   * ดึงข้อมูลสำหรับ Admin Panel
   */
  static async getAllDataForAdmin() {
    if (!AuthManager.isAdmin()) {
      throw new Error('ต้องเป็น Admin เท่านั้น');
    }

    try {
      // ดึงข้อมูลทั้งหมดรวมที่ไม่ active
      const [banks, promotions, bankRules, mrrRates] = await Promise.all([
        supabase.from('banks').select('*').order('short_name'),
        supabase.from('promotions').select(`
          *,
          bank:banks(name, short_name)
        `).order('created_at', { ascending: false }),
        supabase.from('bank_rules').select(`
          *,
          bank:banks(name, short_name)
        `).order('bank_id', 'product_type'),
        supabase.from('mrr_rates').select(`
          *,
          bank:banks(name, short_name)
        `).order('bank_id', 'product_type', 'effective_date')
      ]);

      return {
        banks: banks.data || [],
        promotions: promotions.data || [],
        bankRules: bankRules.data || [],
        mrrRates: mrrRates.data || []
      };

    } catch (error) {
      console.error('Error loading admin data:', error);
      throw error;
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * ตรวจสอบสถานะการเชื่อมต่อ Database
   */
  static async checkDatabaseConnection() {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('count')
        .limit(1);

      if (error) throw error;
      
      console.log('✅ Database connection OK');
      return true;

    } catch (error) {
      console.error('❌ Database connection failed:', error);
      return false;
    }
  }

  /**
   * ล้าง cache ทั้งหมด
   */
  static clearAllCache() {
    this.cache.clear();
    console.log('🧹 All cache cleared');
  }

  /**
   * แสดงสถิติ cache
   */
  static getCacheStats() {
    const now = Date.now();
    const stats = {
      totalEntries: this.cache.size,
      fresh: 0,
      stale: 0,
      entries: []
    };

    for (const [key, value] of this.cache.entries()) {
      const age = now - value.timestamp;
      const isFresh = age < this.cacheTimeout;
      
      if (isFresh) {
        stats.fresh++;
      } else {
        stats.stale++;
      }

      stats.entries.push({
        key,
        age: Math.round(age / 1000), // seconds
        fresh: isFresh
      });
    }

    return stats;
  }
}

// ========================================
// EXPORT FOR LEGACY COMPATIBILITY
// ========================================

// Export individual methods for backward compatibility
export const {
  getBanks,
  getActivePromotions,
  getBankRules,
  getMRRRates,
  saveCalculation,
  getUserCalculations,
  getAllDataForCalculation
} = DataManager;

export default DataManager;
  }

  /**
   * ดึงข้อมูลธนาคารตาม ID
   */
  static async getBankById(bankId) {
    const banks = await this.getBanks();
    return banks.find(bank => bank.id === bankId);
  }

  /**
   * ดึงข้อมูลธนาคารตาม short_name
   */
  static async getBankByShortName(shortName) {
    const banks = await this.getBanks();
    return banks.find(bank => bank.short_name === shortName);
  }

  // ========================================
  // MRR RATES OPERATIONS
  // ========================================

  /**
   * ดึงอัตรา MRR ล่าสุด
   */
  static async getMRRRates(productType = null) {
    const cacheKey = `mrr_rates_${productType || 'all'}`;
    
    return this.getWithCache(cacheKey, async () => {
      let query = supabase
        .from('mrr_rates')
        .select(`
          *,
          bank:banks(name, short_name)
        `)
        .eq('active', true)
        .order('effective_date', { ascending: false });

      if (productType) {
        query = query.eq('product_type', productType);
      }

      const { data, error } = await query;
      if (error) throw error;

      // จัดกลุ่มตาม bank_id และ product_type เพื่อเอาล่าสุด
      const latestRates = {};
      data?.forEach(rate => {
        const key = `${rate.bank_id}_${rate.product_type}`;
        if (!latestRates[key] || rate.effective_date > latestRates[key].effective_date) {
          latestRates[key] = rate;
        }
      });

      return Object.values(latestRates);
    });
  }

  /**
   * ดึงอัตรา MRR ของธนาคารและผลิตภัณฑ์เฉพาะ
   */
  static async getMRRRate(bankId, productType) {
    const rates = await this.getMRRRates(productType);
    return rates.find(rate => rate.bank_id === bankId);
  }

  // ========================================
  // PROMOTIONS OPERATIONS
  // ========================================

  /**
   * ดึงโปรโมชันที่ใช้งานได้
   */
  static async getActivePromotions(productType = null) {
    const cacheKey = `promotions_${productType || 'all'}`;
    
    return this.getWithCache(cacheKey, async () => {
      let query = supabase
        .from('active_promotions')
        .select('*')
        .order('bank_short_name');

      if (productType) {
        query = query.eq('product_type', productType);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    }, 2 * 60 * 1000); // cache เพียง 2 นาที สำหรับโปรโมชัน
  }

  /**
   * ดึงโปรโมชันตาม bank และ product type
   */
  static async getPromotionsByBank(bankId, productType = null) {
    const promotions = await this.getActivePromotions(productType);
    return promotions.filter(promo => promo.bank_id === bankId);
  }

  // ========================================
  // BANK RULES OPERATIONS
  // ========================================

  /**
   * ดึงกฎเกณฑ์ธนาคาร
   */
  static async getBankRules(productType = null) {
    const cacheKey = `bank_rules_${productType || 'all'}`;
    
    return this.getWithCache(cacheKey, async () => {
      let query = supabase
        .from('active_bank_rules')
        .select('*');

      if (productType) {
        query = query.eq('product_type', productType);
      }

      const { data, error } = await query;
      if (error) throw error;
      
      return data || [];
    });