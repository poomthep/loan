// js/data-manager.js
// ========================================
// DATA MANAGER - SUPABASE INTEGRATION
// ========================================

import supabase from './supabase-client.js';

/**
 * จัดการข้อมูลทั้งหมดจาก Supabase
 */
class DataManager {
  static cache = new Map();
  static cacheTimeout = 5 * 60 * 1000; // 5 minutes

  // ========================================
  // BANKS MANAGEMENT
  // ========================================

  /**
   * ดึงข้อมูลธนาคารทั้งหมด
   */
  static async getBanks() {
    const cacheKey = 'banks';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('active', true)
        .order('name');

      if (error) throw error;

      this.setCache(cacheKey, data);
      return data || [];

    } catch (error) {
      console.error('Error fetching banks:', error);
      return [];
    }
  }

  /**
   * ดึงข้อมูลธนาคารโดย ID
   */
  static async getBankById(bankId) {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('*')
        .eq('id', bankId)
        .single();

      if (error) throw error;
      return data;

    } catch (error) {
      console.error('Error fetching bank by ID:', error);
      return null;
    }
  }

  // ========================================
  // USER PROFILES
  // ========================================

  /**
   * ดึงข้อมูล user profile
   */
  static async getUserProfile(userId) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;

    } catch (error) {
      console.error('Error fetching user profile:', error);
      return null;
    }
  }

  /**
   * อัพเดต user profile
   */
  static async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: userId,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };

    } catch (error) {
      console.error('Error updating user profile:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // PROMOTIONS MANAGEMENT  
  // ========================================

  /**
   * ดึงโปรโมชั่นที่ active
   */
  static async getActivePromotions(productType) {
    const cacheKey = `promotions_${productType}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      let query = supabase
        .from('promotions')
        .select('*, banks(name, short_name)')
        .eq('active', true);

      if (productType) {
        query = query.eq('product_type', productType);
      }

      const { data, error } = await query
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.setCache(cacheKey, data);
      return data || [];

    } catch (error) {
      console.error('Error fetching promotions:', error);
      return [];
    }
  }

  /**
   * เพิ่มโปรโมชั่นใหม่
   */
  static async addPromotion(promotionData) {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .insert([{
          ...promotionData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      this.clearCacheByPattern('promotions_');
      
      return { success: true, data };

    } catch (error) {
      console.error('Error adding promotion:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // BANK RULES MANAGEMENT
  // ========================================

  /**
   * ดึงกฎเกณฑ์ธนาคาร
   */
  static async getBankRules() {
    const cacheKey = 'bank_rules';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('bank_rules')
        .select('*, banks(name, short_name)')
        .eq('active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      this.setCache(cacheKey, data);
      return data || [];

    } catch (error) {
      console.error('Error fetching bank rules:', error);
      return [];
    }
  }

  /**
   * ดึกกฎเกณฑ์ธนาคารโดยเงื่อนไข
   */
  static async getBankRulesByBank(bankId, productType, propertyType = null, homeNumber = null) {
    try {
      let query = supabase
        .from('bank_rules')
        .select('*')
        .eq('bank_id', bankId)
        .eq('product_type', productType)
        .eq('active', true);

      if (propertyType) {
        query = query.or(`property_type.is.null,property_type.eq.${propertyType}`);
      }

      if (homeNumber) {
        query = query.or(`home_number.is.null,home_number.eq.${homeNumber}`);
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error fetching bank rules by conditions:', error);
      return [];
    }
  }

  /**
   * เพิ่มกฎเกณฑ์ธนาคาร
   */
  static async addBankRule(ruleData) {
    try {
      const { data, error } = await supabase
        .from('bank_rules')
        .insert([{
          ...ruleData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;

      // Clear cache
      this.clearCache('bank_rules');
      
      return { success: true, data };

    } catch (error) {
      console.error('Error adding bank rule:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * อัพเดตกฎเกณฑ์ธนาคาร
   */
  static async updateBankRule(ruleId, updates) {
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

      // Clear cache
      this.clearCache('bank_rules');
      
      return { success: true, data };

    } catch (error) {
      console.error('Error updating bank rule:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ลบกฎเกณฑ์ธนาคาร
   */
  static async deleteBankRule(ruleId) {
    try {
      const { error } = await supabase
        .from('bank_rules')
        .delete()
        .eq('id', ruleId);

      if (error) throw error;

      // Clear cache
      this.clearCache('bank_rules');
      
      return { success: true };

    } catch (error) {
      console.error('Error deleting bank rule:', error);
      return { success: false, error: error.message };
    }
  }

  // ========================================
  // MRR RATES MANAGEMENT
  // ========================================

  /**
   * ดึงอัตรา MRR
   */
  static async getMRRRate(bankId, productType) {
    try {
      const { data, error } = await supabase
        .from('mrr_rates')
        .select('*')
        .eq('bank_id', bankId)
        .eq('product_type', productType)
        .order('effective_date', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data;

    } catch (error) {
      console.error('Error fetching MRR rate:', error);
      return null;
    }
  }

  // ========================================
  // CALCULATIONS HISTORY
  // ========================================

  /**
   * บันทึกการคำนวณ
   */
  static async saveCalculation(calculationData) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      const { data, error } = await supabase
        .from('user_calculations')
        .insert([{
          user_id: user?.id || null,
          session_id: user?.id || this.getSessionId(),
          ...calculationData,
          created_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return { success: true, data };

    } catch (error) {
      console.error('Error saving calculation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * ดึงประวัติการคำนวณ
   */
  static async getUserCalculations(limit = 10) {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      let query = supabase
        .from('user_calculations')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (user) {
        query = query.eq('user_id', user.id);
      } else {
        query = query.eq('session_id', this.getSessionId());
      }

      const { data, error } = await query;

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error fetching user calculations:', error);
      return [];
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
      .channel('promotions_changes')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'promotions' },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to bank rules changes
   */
  static subscribeToBankRules(callback) {
    return supabase
      .channel('bank_rules_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'bank_rules' },
        callback
      )
      .subscribe();
  }

  /**
   * Subscribe to MRR rates changes
   */
  static subscribeToMRRRates(callback) {
    return supabase
      .channel('mrr_rates_changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'mrr_rates' },
        callback
      )
      .subscribe();
  }

  // ========================================
  // HELPER FUNCTIONS
  // ========================================

  /**
   * ตรวจสอบการเชื่อมต่อฐานข้อมูล
   */
  static async checkDatabaseConnection() {
    try {
      const { data, error } = await supabase
        .from('banks')
        .select('count')
        .limit(1);

      if (error) throw error;
      return true;

    } catch (error) {
      console.error('Database connection failed:', error);
      return false;
    }
  }

  /**
   * ดึงข้อมูลทั้งหมดสำหรับ Admin
   */
  static async getAllDataForAdmin() {
    try {
      const [banks, promotions, bankRules, mrrRates] = await Promise.all([
        this.getBanks(),
        this.getActivePromotions(),
        this.getBankRules(),
        this.getMRRRates()
      ]);

      return { banks, promotions, bankRules, mrrRates };

    } catch (error) {
      console.error('Error loading admin data:', error);
      return { banks: [], promotions: [], bankRules: [], mrrRates: [] };
    }
  }

  /**
   * ดึงข้อมูลทั้งหมดสำหรับการคำนวณ
   */
  static async getAllDataForCalculation(productType) {
    try {
      const [banks, promotions, bankRules, mrrRates] = await Promise.all([
        this.getBanks(),
        this.getActivePromotions(productType),
        this.getBankRules(),
        this.getMRRRates()
      ]);

      return { banks, promotions, bankRules, mrrRates };

    } catch (error) {
      console.error('Error loading calculation data:', error);
      return { banks: [], promotions: [], bankRules: [], mrrRates: [] };
    }
  }

  // ========================================
  // CACHE MANAGEMENT
  // ========================================

  static getFromCache(key) {
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.timestamp < this.cacheTimeout) {
      return cached.data;
    }
    return null;
  }

  static setCache(key, data) {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }

  static clearCache(key) {
    this.cache.delete(key);
  }

  static clearCacheByPattern(pattern) {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }

  static clearAllCache() {
    this.cache.clear();
  }

  /**
   * Get session ID for guest users
   */
  static getSessionId() {
    let sessionId = localStorage.getItem('loan_session_id');
    if (!sessionId) {
      sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
      localStorage.setItem('loan_session_id', sessionId);
    }
    return sessionId;
  }

  /**
   * Find best matching rule
   */
  static findBestMatchingRule(rules, criteria) {
    if (!rules.length) return null;

    // Sort by specificity (more specific rules first)
    return rules.sort((a, b) => {
      let scoreA = 0, scoreB = 0;
      
      if (a.property_type && a.property_type === criteria.propertyType) scoreA += 2;
      if (b.property_type && b.property_type === criteria.propertyType) scoreB += 2;
      
      if (a.home_number && a.home_number === criteria.homeNumber) scoreA += 1;
      if (b.home_number && b.home_number === criteria.homeNumber) scoreB += 1;
      
      return scoreB - scoreA;
    })[0];
  }

  /**
   * Get promotions by bank
   */
  static async getPromotionsByBank(bankId, productType) {
    try {
      const { data, error } = await supabase
        .from('promotions')
        .select('*')
        .eq('bank_id', bankId)
        .eq('product_type', productType)
        .eq('active', true);

      if (error) throw error;
      return data || [];

    } catch (error) {
      console.error('Error fetching promotions by bank:', error);
      return [];
    }
  }

  /**
   * Get all MRR rates
   */
  static async getMRRRates() {
    const cacheKey = 'mrr_rates';
    const cached = this.getFromCache(cacheKey);
    if (cached) return cached;

    try {
      const { data, error } = await supabase
        .from('mrr_rates')
        .select('*, banks(name, short_name)')
        .order('effective_date', { ascending: false });

      if (error) throw error;

      this.setCache(cacheKey, data);
      return data || [];

    } catch (error) {
      console.error('Error fetching MRR rates:', error);
      return [];
    }
  }
}

export default DataManager;