// js/admin-manager-supabase.js
// ========================================
// ADMIN MANAGER - COMPLETE INTEGRATION
// ========================================

import { AuthManager } from './auth-manager.js';
import DataManager from './data-manager.js';

/**
 * จัดการหน้า Admin Panel ทั้งหมด
 */
export class AdminManager {
  constructor() {
    this.currentData = {
      banks: [],
      promotions: [],
      bankRules: [],
      mrrRates: []
    };
    
    this.subscriptions = [];
    this.bindElements();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * เริ่มต้น Admin Manager
   */
  async initialize() {
    try {
      console.log('🔧 Initializing Admin Manager...');

      await this.loadAllData();
      this.setupRealTimeUpdates();
      this.setupEventListeners();
      this.renderAllData();

      console.log('✅ Admin Manager initialized successfully');

    } catch (error) {
      console.error('❌ Admin Manager initialization failed:', error);
      this.showNotification(error.message, 'error');
    }
  }

  /**
   * ผูก DOM elements
   */
  bindElements() {
    this.elements = {
      newBank: document.getElementById('new-bank'),
      newRuleBank: document.getElementById('new-rule-bank'),
      newMrrBank: document.getElementById('new-mrr-bank'),
      
      newProduct: document.getElementById('new-product'),
      newTitle: document.getElementById('new-title'),
      newDetail: document.getElementById('new-detail'),
      newDiscountBps: document.getElementById('new-discount-bps'),
      newYear1Rate: document.getElementById('new-year1-rate'),
      newYear1Months: document.getElementById('new-year1-months'),
      newYear2Rate: document.getElementById('new-year2-rate'),
      newYear2Months: document.getElementById('new-year2-months'),
      newYear3Rate: document.getElementById('new-year3-rate'),
      newYear3Months: document.getElementById('new-year3-months'),
      newFinalRate: document.getElementById('new-final-rate'),
      newLtvOverride: document.getElementById('new-ltv-override'),
      newActive: document.getElementById('new-active'),

      newRuleProduct: document.getElementById('new-rule-product'),
      newRuleProp: document.getElementById('new-rule-prop'),
      newRuleHome: document.getElementById('new-rule-home'),
      newRuleDsr: document.getElementById('new-rule-dsr'),
      newRuleLtv: document.getElementById('new-rule-ltv'),
      newRuleYears: document.getElementById('new-rule-years'),
      newRuleAge: document.getElementById('new-rule-age'),
      newRuleIncome: document.getElementById('new-rule-income'),
      newRuleMlc: document.getElementById('new-rule-mlc'),
      newRulePriority: document.getElementById('new-rule-priority'),
      
      newMrrProduct: document.getElementById('new-mrr-product'),
      newMrrRate: document.getElementById('new-mrr-rate'),
      newMrrDate: document.getElementById('new-mrr-date'),

      btnPromoAdd: document.getElementById('btn-promo-add'),
      btnPromoRefresh: document.getElementById('btn-promo-refresh'),
      btnRulesAdd: document.getElementById('btn-rules-add'),
      btnRulesRefresh: document.getElementById('btn-rules-refresh'),
      btnMrrAdd: document.getElementById('btn-mrr-add'),
      btnMrrRefresh: document.getElementById('btn-mrr-refresh'),
      
      promoBody: document.getElementById('promo-body'),
      rulesBody: document.getElementById('rules-body'),
      mrrBody: document.getElementById('mrr-body'),

      statBanks: document.getElementById('stat-banks'),
      statPromotions: document.getElementById('stat-promotions'),
      statRules: document.getElementById('stat-rules'),
      statCalculations: document.getElementById('stat-calculations')
    };
  }

  /**
   * โหลดข้อมูลทั้งหมด
   */
  async loadAllData() {
    try {
      const [banks, promotions, bankRules, mrrRates] = await Promise.all([
        DataManager.getBanks(),
        DataManager.getPromotionsWithBank(),
        DataManager.getBankRulesWithBank(),
        DataManager.getMrrRatesWithBank()
      ]);
      
      this.currentData.banks = banks;
      this.currentData.promotions = promotions;
      this.currentData.bankRules = bankRules;
      this.currentData.mrrRates = mrrRates;

      this.populateBankSelectors();
      this.updateStats();

      console.log('📊 Admin data loaded:', {
        banks: this.currentData.banks.length,
        promotions: this.currentData.promotions.length,
        bankRules: this.currentData.bankRules.length,
        mrrRates: this.currentData.mrrRates.length
      });

    } catch (error) {
      console.error('Error loading admin data:', error);
      this.showNotification('เกิดข้อผิดพลาดในการโหลดข้อมูล', 'error');
    }
  }

  // ========================================
  // UI SETUP
  // ========================================
  
  /**
   * Render all sections
   */
  renderAllData() {
    this.renderPromotions();
    this.renderBankRules();
    this.renderMrrRates();
  }

  /**
   * เติมข้อมูลใน bank selectors
   */
  populateBankSelectors() {
    const selectors = [this.elements.newBank, this.elements.newRuleBank, this.elements.newMrrBank];
    
    selectors.forEach(select => {
      if (!select) return;

      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      this.currentData.banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = `${bank.short_name} - ${bank.name}`;
        select.appendChild(option);
      });
    });
  }

  /**
   * ตั้งค่า Event Listeners
   */
  setupEventListeners() {
    this.elements.btnPromoAdd?.addEventListener('click', () => this.addPromotion());
    this.elements.btnPromoRefresh?.addEventListener('click', () => this.refreshPromotions());
    this.elements.btnRulesAdd?.addEventListener('click', () => this.addBankRule());
    this.elements.btnRulesRefresh?.addEventListener('click', () => this.refreshBankRules());
    this.elements.btnMrrAdd?.addEventListener('click', () => this.addMrrRate());
    this.elements.btnMrrRefresh?.addEventListener('click', () => this.refreshMrrRates());
    
    this.elements.promoBody?.addEventListener('click', (e) => this.handleActionClick(e, 'promotions'));
    this.elements.rulesBody?.addEventListener('click', (e) => this.handleActionClick(e, 'rules'));
    this.elements.mrrBody?.addEventListener('click', (e) => this.handleActionClick(e, 'mrrRates'));
  }
  
  /**
   * Handles clicks on edit/delete buttons in tables
   */
  handleActionClick(e, type) {
    const target = e.target;
    const isEdit = target.closest('.btn-edit');
    const isDelete = target.closest('.btn-delete');
    
    if (isEdit || isDelete) {
      const row = target.closest('tr');
      const id = row.dataset.id;
      
      if (isEdit) {
        if (type === 'promotions') this.editPromotion(id);
        if (type === 'rules') this.editBankRule(id);
        if (type === 'mrrRates') this.editMrrRate(id);
      }
      
      if (isDelete) {
        if (type === 'promotions') this.deletePromotion(id);
        if (type === 'rules') this.deleteBankRule(id);
        if (type === 'mrrRates') this.deleteMrrRate(id);
      }
    }
  }

  // ========================================
  // REAL-TIME UPDATES
  // ========================================

  /**
   * ตั้งค่า Real-time subscriptions
   */
  setupRealTimeUpdates() {
    this.subscriptions.push(
      DataManager.subscribeToPromotions(() => this.refreshPromotions())
    );
    this.subscriptions.push(
      DataManager.subscribeToBankRules(() => this.refreshBankRules())
    );
    this.subscriptions.push(
      DataManager.subscribeToMRRRates(() => this.refreshMrrRates())
    );
    this.subscriptions.push(
      DataManager.subscribeToBanks(() => this.refreshAllData())
    );
  }

  // ========================================
  // PROMOTIONS MANAGEMENT
  // ========================================

  /**
   * เพิ่มโปรโมชันใหม่
   */
  async addPromotion() {
    try {
      const formData = this.getPromotionFormData();
      if (!this.validatePromotionForm(formData)) return;

      this.setButtonLoading(this.elements.btnPromoAdd, true);
      const result = await DataManager.addPromotion(formData);

      if (result.success) {
        this.showNotification('เพิ่มโปรโมชันสำเร็จ', 'success');
        this.clearPromotionForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถเพิ่มโปรโมชันได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnPromoAdd, false);
    }
  }
  
  /**
   * อัพเดตโปรโมชัน
   */
  async updatePromotion(id) {
    try {
      const formData = this.getPromotionFormData();
      if (!this.validatePromotionForm(formData)) return;

      this.setButtonLoading(this.elements.btnPromoAdd, true);
      const result = await DataManager.updatePromotion(id, formData);

      if (result.success) {
        this.showNotification('อัพเดตโปรโมชันสำเร็จ', 'success');
        this.resetPromotionForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถอัพเดตโปรโมชันได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnPromoAdd, false);
    }
  }

  /**
   * ลบโปรโมชัน
   */
  async deletePromotion(id) {
    const promo = this.currentData.promotions.find(p => p.id === id);
    if (!promo || !confirm(`ยืนยันลบโปรโมชัน "${promo.title}"?`)) return;

    try {
      const result = await DataManager.deletePromotion(id);
      if (result.success) {
        this.showNotification('ลบโปรโมชันสำเร็จ', 'success');
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถลบโปรโมชันได้', 'error');
    }
  }

  /**
   * แสดงตารางโปรโมชัน
   */
  async renderPromotions() {
    if (!this.elements.promoBody) return;
    this.elements.promoBody.innerHTML = '';
    
    if (this.currentData.promotions.length === 0) {
      this.elements.promoBody.innerHTML = '<tr><td colspan="19" class="text-center text-gray-500 py-4">ไม่มีข้อมูลโปรโมชัน</td></tr>';
      return;
    }

    this.currentData.promotions.forEach(promo => {
      const row = document.createElement('tr');
      row.dataset.id = promo.id;
      row.className = promo.active ? '' : 'inactive';
      
      const bank = this.currentData.banks.find(b => b.id === promo.bank_id);
      
      row.innerHTML = `
        <td>${bank?.short_name || '—'}</td>
        <td>${promo.product_type}</td>
        <td>${this.truncateText(promo.title, 20)}</td>
        <td title="${promo.description || ''}">${this.truncateText(promo.description || '', 30)}</td>
        <td>${promo.discount_bps || 0}</td>
        <td>${promo.remaining_months || 0}</td>
        <td>${promo.year1_rate || '—'}</td>
        <td>${promo.year1_months || 0}</td>
        <td>${promo.year2_rate || '—'}</td>
        <td>${promo.year2_months || 0}</td>
        <td>${promo.year3_rate || '—'}</td>
        <td>${promo.year3_months || 0}</td>
        <td>${promo.final_rate || '—'}</td>
        <td>${promo.ltv_override || '—'}</td>
        <td>${this.formatDate(promo.valid_from)}</td>
        <td>${this.formatDate(promo.valid_until)}</td>
        <td>
          <span class="status-badge ${promo.active ? 'active' : 'inactive'}">
            ${promo.active ? '✅' : '❌'}
          </span>
        </td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit">✏️</button>
            <button class="btn-small btn-delete">🗑️</button>
          </div>
        </td>
      `;
      this.elements.promoBody.appendChild(row);
    });
  }
  
  /**
   * ดึงข้อมูลจากฟอร์มโปรโมชัน
   */
  getPromotionFormData() {
    return {
      bank_id: this.elements.newBank?.value || null,
      product_type: this.elements.newProduct?.value || 'MORTGAGE',
      title: this.elements.newTitle?.value?.trim() || '',
      description: this.elements.newDetail?.value?.trim() || '',
      discount_bps: parseInt(this.elements.newDiscountBps?.value) || null,
      year1_rate: parseFloat(this.elements.newYear1Rate?.value) || null,
      year1_months: parseInt(this.elements.newYear1Months?.value) || null,
      year2_rate: parseFloat(this.elements.newYear2Rate?.value) || null,
      year2_months: parseInt(this.elements.newYear2Months?.value) || null,
      year3_rate: parseFloat(this.elements.newYear3Rate?.value) || null,
      year3_months: parseInt(this.elements.newYear3Months?.value) || null,
      final_rate: parseFloat(this.elements.newFinalRate?.value) || null,
      ltv_override: parseFloat(this.elements.newLtvOverride?.value) || null,
      active: this.elements.newActive?.checked ?? true,
      valid_from: this.elements.newValidFrom?.value,
      valid_until: this.elements.newValidUntil?.value
    };
  }
  
  /**
   * ตรวจสอบฟอร์มโปรโมชัน
   */
  validatePromotionForm(formData) {
    const errors = [];
    if (!formData.bank_id) errors.push('กรุณาเลือกธนาคาร');
    if (!formData.title) errors.push('กรุณากรอกชื่อโปรโมชัน');
    if (errors.length) {
      this.showNotification(errors.join('<br>'), 'error');
      return false;
    }
    return true;
  }

  /**
   * ล้างฟอร์มโปรโมชัน
   */
  clearPromotionForm() {
    this.elements.newBank.value = '';
    this.elements.newProduct.value = 'MORTGAGE';
    this.elements.newTitle.value = '';
    this.elements.newDetail.value = '';
    this.elements.newDiscountBps.value = '';
    this.elements.newYear1Rate.value = '';
    this.elements.newYear1Months.value = '';
    this.elements.newYear2Rate.value = '';
    this.elements.newYear2Months.value = '';
    this.elements.newYear3Rate.value = '';
    this.elements.newYear3Months.value = '';
    this.elements.newFinalRate.value = '';
    this.elements.newLtvOverride.value = '';
    this.elements.newActive.checked = true;
  }

  /**
   * รีเซ็ตฟอร์มโปรโมชัน (หลังจากอัปเดต)
   */
  resetPromotionForm() {
    this.clearPromotionForm();
    this.elements.btnPromoAdd.textContent = '➕ เพิ่มโปรโมชัน';
    this.elements.btnPromoAdd.onclick = () => this.addPromotion();
  }
  
  /**
   * แก้ไขโปรโมชัน
   */
  editPromotion(id) {
    const promo = this.currentData.promotions.find(p => p.id === id);
    if (!promo) return;
    
    this.elements.newBank.value = promo.bank_id;
    this.elements.newProduct.value = promo.product_type;
    this.elements.newTitle.value = promo.title;
    this.elements.newDetail.value = promo.description;
    this.elements.newDiscountBps.value = promo.discount_bps;
    this.elements.newYear1Rate.value = promo.year1_rate;
    this.elements.newYear1Months.value = promo.year1_months;
    this.elements.newYear2Rate.value = promo.year2_rate;
    this.elements.newYear2Months.value = promo.year2_months;
    this.elements.newYear3Rate.value = promo.year3_rate;
    this.elements.newYear3Months.value = promo.year3_months;
    this.elements.newFinalRate.value = promo.final_rate;
    this.elements.newLtvOverride.value = promo.ltv_override;
    this.elements.newActive.checked = promo.active;
    
    this.elements.btnPromoAdd.textContent = '💾 อัพเดตโปรโมชัน';
    this.elements.btnPromoAdd.onclick = () => this.updatePromotion(id);
    this.showNotification('แก้ไขข้อมูลโปรโมชัน', 'info');
  }

  /**
   * รีเฟรชข้อมูลโปรโมชัน
   */
  async refreshPromotions() {
    const promotions = await DataManager.getPromotionsWithBank();
    this.currentData.promotions = promotions;
    this.renderPromotions();
    this.showNotification('รีเฟรชข้อมูลโปรโมชันเรียบร้อย', 'success');
  }

  // ========================================
  // BANK RULES MANAGEMENT
  // ========================================

  /**
   * เพิ่มกฎเกณฑ์ธนาคารใหม่
   */
  async addBankRule() {
    try {
      const formData = this.getBankRuleFormData();
      if (!this.validateBankRuleForm(formData)) return;
      this.setButtonLoading(this.elements.btnRulesAdd, true);
      const result = await DataManager.addBankRule(formData);
      if (result.success) {
        this.showNotification('เพิ่มกฎเกณฑ์สำเร็จ', 'success');
        this.clearBankRuleForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถเพิ่มกฎเกณฑ์ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnRulesAdd, false);
    }
  }

  /**
   * อัพเดตกฎเกณฑ์ธนาคาร
   */
  async updateBankRule(id) {
    try {
      const formData = this.getBankRuleFormData();
      if (!this.validateBankRuleForm(formData)) return;
      this.setButtonLoading(this.elements.btnRulesAdd, true);
      const result = await DataManager.updateBankRule(id, formData);
      if (result.success) {
        this.showNotification('อัพเดตกฎเกณฑ์สำเร็จ', 'success');
        this.resetBankRuleForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถอัพเดตกฎเกณฑ์ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnRulesAdd, false);
    }
  }

  /**
   * ลบกฎเกณฑ์ธนาคาร
   */
  async deleteBankRule(id) {
    const rule = this.currentData.bankRules.find(r => r.id === id);
    if (!rule || !confirm(`ยืนยันลบกฎเกณฑ์สำหรับ ${rule.bank?.short_name} - ${rule.product_type}?`)) return;

    try {
      const result = await DataManager.deleteBankRule(id);
      if (result.success) {
        this.showNotification('ลบกฎเกณฑ์สำเร็จ', 'success');
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถลบกฎเกณฑ์ได้', 'error');
    }
  }
  
  /**
   * แสดงตารางกฎเกณฑ์
   */
  async renderBankRules() {
    if (!this.elements.rulesBody) return;
    this.elements.rulesBody.innerHTML = '';

    if (this.currentData.bankRules.length === 0) {
      this.elements.rulesBody.innerHTML = '<tr><td colspan="12" class="text-center text-gray-500 py-4">ไม่มีข้อมูลกฎเกณฑ์</td></tr>';
      return;
    }

    this.currentData.bankRules.forEach(rule => {
      const row = document.createElement('tr');
      row.dataset.id = rule.id;
      row.innerHTML = `
        <td>${rule.bank?.short_name || '—'}</td>
        <td>${rule.product_type}</td>
        <td>${rule.property_type || '—'}</td>
        <td>${rule.home_number || '—'}</td>
        <td>${rule.dsr_cap || '—'}%</td>
        <td>${rule.ltv_cap || '—'}%</td>
        <td>${rule.max_tenure_years || '—'}</td>
        <td>${rule.max_age_at_maturity || '—'}</td>
        <td>${this.formatCurrency(rule.min_income)}</td>
        <td>${this.formatCurrency(rule.mlc_per_month)}</td>
        <td>${rule.priority || '—'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit">✏️</button>
            <button class="btn-small btn-delete">🗑️</button>
          </div>
        </td>
      `;
      this.elements.rulesBody.appendChild(row);
    });
  }

  /**
   * ดึงข้อมูลจากฟอร์มกฎเกณฑ์
   */
  getBankRuleFormData() {
    return {
      bank_id: this.elements.newRuleBank?.value || null,
      product_type: this.elements.newRuleProduct?.value || 'MORTGAGE',
      property_type: this.elements.newRuleProp?.value || null,
      home_number: parseInt(this.elements.newRuleHome?.value) || null,
      dsr_cap: parseFloat(this.elements.newRuleDsr?.value) || null,
      ltv_cap: parseFloat(this.elements.newRuleLtv?.value) || null,
      max_tenure_years: parseInt(this.elements.newRuleYears?.value) || null,
      max_age_at_maturity: parseInt(this.elements.newRuleAge?.value) || null,
      min_income: parseFloat(this.elements.newRuleIncome?.value) || null,
      mlc_per_month: parseFloat(this.elements.newRuleMlc?.value) || null,
      priority: parseInt(this.elements.newRulePriority?.value) || null
    };
  }
  
  /**
   * ตรวจสอบฟอร์มกฎเกณฑ์
   */
  validateBankRuleForm(formData) {
    const errors = [];
    if (!formData.bank_id) errors.push('กรุณาเลือกธนาคาร');
    if (!formData.dsr_cap || formData.dsr_cap <= 0) errors.push('DSR cap ต้องมากกว่า 0');
    if (!formData.ltv_cap || formData.ltv_cap <= 0) errors.push('LTV cap ต้องมากกว่า 0');
    if (errors.length) {
      this.showNotification(errors.join('<br>'), 'error');
      return false;
    }
    return true;
  }

  /**
   * ล้างฟอร์มกฎเกณฑ์
   */
  clearBankRuleForm() {
    this.elements.newRuleBank.value = '';
    this.elements.newRuleProduct.value = 'MORTGAGE';
    this.elements.newRuleProp.value = '';
    this.elements.newRuleHome.value = '';
    this.elements.newRuleDsr.value = '';
    this.elements.newRuleLtv.value = '';
    this.elements.newRuleYears.value = '';
    this.elements.newRuleAge.value = '';
    this.elements.newRuleIncome.value = '';
    this.elements.newRuleMlc.value = '';
    this.elements.newRulePriority.value = '';
  }

  /**
   * รีเซ็ตฟอร์มกฎเกณฑ์ (หลังจากอัปเดต)
   */
  resetBankRuleForm() {
    this.clearBankRuleForm();
    this.elements.btnRulesAdd.textContent = '➕ เพิ่มกฎเกณฑ์';
    this.elements.btnRulesAdd.onclick = () => this.addBankRule();
  }

  /**
   * แก้ไขกฎเกณฑ์
   */
  editBankRule(id) {
    const rule = this.currentData.bankRules.find(r => r.id === id);
    if (!rule) return;

    this.elements.newRuleBank.value = rule.bank_id;
    this.elements.newRuleProduct.value = rule.product_type;
    this.elements.newRuleProp.value = rule.property_type || '';
    this.elements.newRuleHome.value = rule.home_number || '';
    this.elements.newRuleDsr.value = rule.dsr_cap;
    this.elements.newRuleLtv.value = rule.ltv_cap;
    this.elements.newRuleYears.value = rule.max_tenure_years;
    this.elements.newRuleAge.value = rule.max_age_at_maturity;
    this.elements.newRuleIncome.value = rule.min_income;
    this.elements.newRuleMlc.value = rule.mlc_per_month;
    this.elements.newRulePriority.value = rule.priority;

    this.elements.btnRulesAdd.textContent = '💾 อัพเดตกฎเกณฑ์';
    this.elements.btnRulesAdd.onclick = () => this.updateBankRule(id);
    this.showNotification('แก้ไขข้อมูลกฎเกณฑ์', 'info');
  }

  /**
   * รีเฟรชข้อมูลกฎเกณฑ์
   */
  async refreshBankRules() {
    const rules = await DataManager.getBankRulesWithBank();
    this.currentData.bankRules = rules;
    this.renderBankRules();
    this.showNotification('รีเฟรชข้อมูลกฎเกณฑ์เรียบร้อย', 'success');
  }
  
  // ========================================
  // MRR RATES MANAGEMENT
  // ========================================
  
  /**
   * เพิ่มอัตรา MRR
   */
  async addMrrRate() {
    try {
      const formData = this.getMrrRateFormData();
      if (!formData.bank_id || !formData.rate) {
        this.showNotification('กรุณาเลือกธนาคารและกรอกอัตราดอกเบี้ย', 'error');
        return;
      }
      this.setButtonLoading(this.elements.btnMrrAdd, true);
      const result = await DataManager.addMrrRate(formData);
      if (result.success) {
        this.showNotification('เพิ่มอัตรา MRR สำเร็จ', 'success');
        this.clearMrrRateForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถเพิ่มอัตรา MRR ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnMrrAdd, false);
    }
  }

  /**
   * ลบอัตรา MRR
   */
  async deleteMrrRate(id) {
    const rate = this.currentData.mrrRates.find(r => r.id === id);
    if (!rate || !confirm(`ยืนยันลบอัตรา MRR ของ ${rate.bank?.short_name}?`)) return;

    try {
      const result = await DataManager.deleteMrrRate(id);
      if (result.success) {
        this.showNotification('ลบอัตรา MRR สำเร็จ', 'success');
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถลบอัตรา MRR ได้', 'error');
    }
  }
  
  /**
   * แสดงตาราง MRR
   */
  async renderMrrRates() {
    if (!this.elements.mrrBody) return;
    this.elements.mrrBody.innerHTML = '';
    
    if (this.currentData.mrrRates.length === 0) {
      this.elements.mrrBody.innerHTML = '<tr><td colspan="6" class="text-center text-gray-500 py-4">ไม่มีข้อมูลอัตรา MRR</td></tr>';
      return;
    }
    
    this.currentData.mrrRates.forEach(rate => {
      const row = document.createElement('tr');
      row.dataset.id = rate.id;
      row.innerHTML = `
        <td>${rate.bank?.short_name || '—'}</td>
        <td>${rate.product_type}</td>
        <td>${rate.rate || '—'}%</td>
        <td>${this.formatDate(rate.effective_date)}</td>
        <td><span class="status-badge ${rate.active ? 'active' : 'inactive'}">${rate.active ? '✅' : '❌'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit">✏️</button>
            <button class="btn-small btn-delete">🗑️</button>
          </div>
        </td>
      `;
      this.elements.mrrBody.appendChild(row);
    });
  }

  /**
   * ดึงข้อมูลจากฟอร์ม MRR
   */
  getMrrRateFormData() {
    return {
      bank_id: this.elements.newMrrBank?.value || null,
      product_type: this.elements.newMrrProduct?.value || 'MORTGAGE',
      rate: parseFloat(this.elements.newMrrRate?.value) || null,
      effective_date: this.elements.newMrrDate?.value || null,
      active: true
    };
  }

  /**
   * ล้างฟอร์ม MRR
   */
  clearMrrRateForm() {
    this.elements.newMrrBank.value = '';
    this.elements.newMrrProduct.value = 'MORTGAGE';
    this.elements.newMrrRate.value = '';
    this.elements.newMrrDate.value = new Date().toISOString().split('T')[0];
  }
  
  /**
   * แก้ไขอัตรา MRR
   */
  editMrrRate(id) {
    const rate = this.currentData.mrrRates.find(r => r.id === id);
    if (!rate) return;

    this.elements.newMrrBank.value = rate.bank_id;
    this.elements.newMrrProduct.value = rate.product_type;
    this.elements.newMrrRate.value = rate.rate;
    this.elements.newMrrDate.value = new Date(rate.effective_date).toISOString().split('T')[0];

    this.elements.btnMrrAdd.textContent = '💾 อัพเดต MRR';
    this.elements.btnMrrAdd.onclick = () => this.updateMrrRate(id);
    this.showNotification('แก้ไขข้อมูลอัตรา MRR', 'info');
  }

  /**
   * อัพเดตอัตรา MRR
   */
  async updateMrrRate(id) {
    try {
      const formData = this.getMrrRateFormData();
      if (!formData.bank_id || !formData.rate) {
        this.showNotification('กรุณาเลือกธนาคารและกรอกอัตราดอกเบี้ย', 'error');
        return;
      }
      this.setButtonLoading(this.elements.btnMrrAdd, true);
      const result = await DataManager.updateMrrRate(id, formData);
      if (result.success) {
        this.showNotification('อัพเดตอัตรา MRR สำเร็จ', 'success');
        this.resetMrrRateForm();
      } else {
        this.showNotification(result.error, 'error');
      }
    } catch (error) {
      this.showNotification('ไม่สามารถอัพเดตอัตรา MRR ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnMrrAdd, false);
    }
  }

  /**
   * รีเซ็ตฟอร์ม MRR (หลังจากอัปเดต)
   */
  resetMrrRateForm() {
    this.clearMrrRateForm();
    this.elements.btnMrrAdd.textContent = '➕ เพิ่มอัตรา MRR';
    this.elements.btnMrrAdd.onclick = () => this.addMrrRate();
  }
  
  /**
   * รีเฟรชข้อมูล MRR
   */
  async refreshMrrRates() {
    const rates = await DataManager.getMrrRatesWithBank();
    this.currentData.mrrRates = rates;
    this.renderMrrRates();
    this.showNotification('รีเฟรชข้อมูลอัตรา MRR เรียบร้อย', 'success');
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * อัพเดตสถิติ
   */
  async updateStats() {
    const counts = await DataManager.getStats();
    if (this.elements.statBanks) this.elements.statBanks.textContent = this.currentData.banks.length;
    if (this.elements.statPromotions) this.elements.statPromotions.textContent = this.currentData.promotions.length;
    if (this.elements.statRules) this.elements.statRules.textContent = this.currentData.bankRules.length;
    if (this.elements.statCalculations) this.elements.statCalculations.textContent = counts.calculations;
  }

  /**
   * แสดงการแจ้งเตือน
   */
  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;
    
    const notificationArea = document.getElementById('notification-area');
    if (notificationArea) {
      notificationArea.appendChild(notification);
    } else {
      document.body.appendChild(notification);
    }

    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
  }

  /**
   * ตั้งค่าสถานะโหลดของปุ่ม
   */
  setButtonLoading(button, isLoading) {
    if (!button) return;
    button.disabled = isLoading;
    button.innerHTML = isLoading ? `<div class="loading-spinner"></div>` : button.innerHTML;
  }

  /**
   * ตัดข้อความให้สั้นลง
   */
  truncateText(text, maxLength) {
    if (!text) return '';
    return text.length > maxLength ? text.substring(0, maxLength) + '...' : text;
  }

  /**
   * จัดรูปแบบวันที่
   */
  formatDate(date) {
    if (!date) return '—';
    return new Date(date).toLocaleDateString('th-TH');
  }

  /**
   * จัดรูปแบบสกุลเงิน
   */
  formatCurrency(amount) {
    if (!amount && amount !== 0) return '—';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }
}

// ========================================
// GLOBAL INITIALIZATION
// ========================================

document.addEventListener('DOMContentLoaded', () => {
  const adminManager = new AdminManager();
  adminManager.initialize();
  window.adminManager = adminManager;
});