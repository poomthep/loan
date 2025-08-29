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

      // Check admin permissions
      if (!AuthManager.isAdmin()) {
        throw new Error('Access denied: Admin privileges required');
      }

      // Load initial data
      await this.loadAllData();

      // Setup real-time subscriptions
      this.setupRealTimeUpdates();

      // Setup event listeners
      this.setupEventListeners();

      // Render initial UI
      this.renderPromotions();
      this.renderBankRules();

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
      // Bank selectors
      newBank: document.getElementById('new-bank'),
      newRuleBank: document.getElementById('new-rule-bank'),

      // Promotion form elements
      newProduct: document.getElementById('new-product'),
      newTitle: document.getElementById('new-title'),
      newDetail: document.getElementById('new-detail'),
      newActive: document.getElementById('new-active'),

      // Bank rule form elements
      newRuleProduct: document.getElementById('new-rule-product'),
      newRuleProp: document.getElementById('new-rule-prop'),
      newRuleHome: document.getElementById('new-rule-home'),
      newRuleDsr: document.getElementById('new-rule-dsr'),
      newRuleLtv: document.getElementById('new-rule-ltv'),
      newRuleYears: document.getElementById('new-rule-years'),
      newRuleAge: document.getElementById('new-rule-age'),
      newRuleIncome: document.getElementById('new-rule-income'),
      newRuleMlc: document.getElementById('new-rule-mlc'),

      // Action buttons
      btnPromoAdd: document.getElementById('btn-promo-add'),
      btnPromoRefresh: document.getElementById('btn-promo-refresh'),
      btnRulesAdd: document.getElementById('btn-rules-add'),
      btnRulesRefresh: document.getElementById('btn-rules-refresh'),

      // Display areas
      promoBody: document.getElementById('promo-body'),
      rulesBody: document.getElementById('rules-body')
    };
  }

  /**
   * โหลดข้อมูลทั้งหมด
   */
  async loadAllData() {
    try {
      const data = await DataManager.getAllDataForAdmin();
      this.currentData = data;

      // Populate bank selectors
      this.populateBankSelectors();

      console.log('📊 Admin data loaded:', {
        banks: data.banks.length,
        promotions: data.promotions.length,
        bankRules: data.bankRules.length,
        mrrRates: data.mrrRates.length
      });

    } catch (error) {
      console.error('Error loading admin data:', error);
      throw error;
    }
  }

  // ========================================
  // UI SETUP
  // ========================================

  /**
   * เติมข้อมูลใน bank selectors
   */
  populateBankSelectors() {
    const selectors = [this.elements.newBank, this.elements.newRuleBank];
    
    selectors.forEach(select => {
      if (!select) return;

      // Clear existing options (except first one)
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      // Add bank options
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
    // Promotion management
    this.elements.btnPromoAdd?.addEventListener('click', () => this.addPromotion());
    this.elements.btnPromoRefresh?.addEventListener('click', () => this.refreshPromotions());

    // Bank rules management
    this.elements.btnRulesAdd?.addEventListener('click', () => this.addBankRule());
    this.elements.btnRulesRefresh?.addEventListener('click', () => this.refreshBankRules());

    // Form validation
    this.setupFormValidation();
  }

  /**
   * ตั้งค่า form validation
   */
  setupFormValidation() {
    // Numeric inputs
    const numericFields = [
      this.elements.newRuleDsr,
      this.elements.newRuleLtv,
      this.elements.newRuleYears,
      this.elements.newRuleAge,
      this.elements.newRuleIncome,
      this.elements.newRuleMlc
    ];

    numericFields.forEach(field => {
      if (!field) return;

      field.addEventListener('input', (e) => {
        // Allow only numbers and decimal point
        e.target.value = e.target.value.replace(/[^0-9.]/g, '');
      });

      field.addEventListener('blur', (e) => {
        // Validate ranges
        this.validateNumericField(e.target);
      });
    });
  }

  /**
   * ตรวจสอบ numeric field
   */
  validateNumericField(field) {
    const value = parseFloat(field.value);
    if (isNaN(value)) return;

    switch (field.id) {
      case 'new-rule-dsr':
      case 'new-rule-ltv':
        if (value > 100) field.value = 100;
        if (value < 0) field.value = 0;
        break;
      case 'new-rule-age':
        if (value > 100) field.value = 100;
        if (value < 18) field.value = 18;
        break;
      case 'new-rule-years':
        if (value > 50) field.value = 50;
        if (value < 1) field.value = 1;
        break;
    }
  }

  // ========================================
  // REAL-TIME UPDATES
  // ========================================

  /**
   * ตั้งค่า Real-time subscriptions
   */
  setupRealTimeUpdates() {
    // Subscribe to promotions changes
    this.subscriptions.push(
      DataManager.subscribeToPromotions((payload) => {
        console.log('📡 Promotions updated:', payload);
        this.handleRealTimeUpdate('promotions', payload);
      })
    );

    // Subscribe to bank rules changes
    this.subscriptions.push(
      DataManager.subscribeToBankRules((payload) => {
        console.log('📡 Bank rules updated:', payload);
        this.handleRealTimeUpdate('rules', payload);
      })
    );

    // Subscribe to MRR rates changes
    this.subscriptions.push(
      DataManager.subscribeToMRRRates((payload) => {
        console.log('📡 MRR rates updated:', payload);
        this.handleRealTimeUpdate('rates', payload);
      })
    );
  }

  /**
   * จัดการ real-time updates
   */
  async handleRealTimeUpdate(type, payload) {
    try {
      // Show notification
      this.showNotification(`ข้อมูล${type}ได้รับการอัพเดต`, 'info');

      // Reload data
      await this.loadAllData();

      // Re-render affected sections
      if (type === 'promotions') {
        this.renderPromotions();
      } else if (type === 'rules') {
        this.renderBankRules();
      }

    } catch (error) {
      console.error('Error handling real-time update:', error);
    }
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
      
      if (!this.validatePromotionForm(formData)) {
        return;
      }

      // Show loading
      this.setButtonLoading(this.elements.btnPromoAdd, true);

      // Add promotion
      const result = await DataManager.addPromotion(formData);

      if (result.success) {
        this.showNotification('เพิ่มโปรโมชันสำเร็จ', 'success');
        this.clearPromotionForm();
        this.renderPromotions();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error adding promotion:', error);
      this.showNotification('ไม่สามารถเพิ่มโปรโมชันได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnPromoAdd, false);
    }
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
      active: this.elements.newActive?.checked ?? true,
      valid_from: new Date().toISOString().split('T')[0],
      discount_bps: 0, // Default values, can be extended
      year1_rate: null,
      final_rate: null
    };
  }

  /**
   * ตรวจสอบฟอร์มโปรโมชัน
   */
  validatePromotionForm(formData) {
    const errors = [];

    if (!formData.bank_id) {
      errors.push('กรุณาเลือกธนาคาร');
    }

    if (!formData.title) {
      errors.push('กรุณากรอกชื่อโปรโมชัน');
    }

    if (errors.length > 0) {
      this.showNotification(errors.join('<br>'), 'error');
      return false;
    }

    return true;
  }

  /**
   * ล้างฟอร์มโปรโมชัน
   */
  clearPromotionForm() {
    if (this.elements.newBank) this.elements.newBank.value = '';
    if (this.elements.newProduct) this.elements.newProduct.value = 'MORTGAGE';
    if (this.elements.newTitle) this.elements.newTitle.value = '';
    if (this.elements.newDetail) this.elements.newDetail.value = '';
    if (this.elements.newActive) this.elements.newActive.checked = true;
  }

  /**
   * รีเฟรชโปรโมชัน
   */
  async refreshPromotions() {
    try {
      this.setButtonLoading(this.elements.btnPromoRefresh, true);
      await this.loadAllData();
      this.renderPromotions();
      this.showNotification('รีเฟรชข้อมูลเรียบร้อย', 'success');
    } catch (error) {
      this.showNotification('ไม่สามารถรีเฟรชได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnPromoRefresh, false);
    }
  }

  /**
   * แสดงตารางโปรโมชัน
   */
  renderPromotions() {
    if (!this.elements.promoBody) return;

    this.elements.promoBody.innerHTML = '';

    if (this.currentData.promotions.length === 0) {
      const row = document.createElement('tr');
      row.innerHTML = '<td colspan="11" style="text-align: center; color: #666;">ไม่มีข้อมูลกฎเกณฑ์</td>';
      this.elements.rulesBody.appendChild(row);
      return;
    }

    this.currentData.bankRules.forEach(rule => {
      const row = document.createElement('tr');
      row.className = rule.active ? '' : 'inactive';
      
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
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="adminManager.editBankRule('${rule.id}')">
              ✏️
            </button>
            <button class="btn-small btn-delete" onclick="adminManager.deleteBankRule('${rule.id}')">
              🗑️
            </button>
          </div>
        </td>
      `;

      this.elements.rulesBody.appendChild(row);
    });
  }

  /**
   * แก้ไขกฎเกณฑ์ธนาคาร
   */
  async editBankRule(ruleId) {
    const rule = this.currentData.bankRules.find(r => r.id === ruleId);
    if (!rule) return;

    // Fill form with existing data
    if (this.elements.newRuleBank) this.elements.newRuleBank.value = rule.bank_id;
    if (this.elements.newRuleProduct) this.elements.newRuleProduct.value = rule.product_type;
    if (this.elements.newRuleProp) this.elements.newRuleProp.value = rule.property_type || '';
    if (this.elements.newRuleHome) this.elements.newRuleHome.value = rule.home_number || '';
    if (this.elements.newRuleDsr) this.elements.newRuleDsr.value = rule.dsr_cap || '';
    if (this.elements.newRuleLtv) this.elements.newRuleLtv.value = rule.ltv_cap || '';
    if (this.elements.newRuleYears) this.elements.newRuleYears.value = rule.max_tenure_years || '';
    if (this.elements.newRuleAge) this.elements.newRuleAge.value = rule.max_age_at_maturity || '';
    if (this.elements.newRuleIncome) this.elements.newRuleIncome.value = rule.min_income || '';
    if (this.elements.newRuleMlc) this.elements.newRuleMlc.value = rule.mlc_per_month || '';

    // Change button to "Update"
    if (this.elements.btnRulesAdd) {
      this.elements.btnRulesAdd.textContent = 'อัพเดต';
      this.elements.btnRulesAdd.onclick = () => this.updateBankRule(ruleId);
    }

    // Scroll to form
    this.elements.newRuleBank?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * อัพเดตกฎเกณฑ์ธนาคาร
   */
  async updateBankRule(ruleId) {
    try {
      const formData = this.getBankRuleFormData();
      
      if (!this.validateBankRuleForm(formData)) {
        return;
      }

      this.setButtonLoading(this.elements.btnRulesAdd, true);

      const result = await DataManager.updateBankRule(ruleId, formData);

      if (result.success) {
        this.showNotification('อัพเดตกฎเกณฑ์สำเร็จ', 'success');
        this.resetBankRuleForm();
        this.renderBankRules();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error updating bank rule:', error);
      this.showNotification('ไม่สามารถอัพเดตกฎเกณฑ์ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnRulesAdd, false);
    }
  }

  /**
   * ลบกฎเกณฑ์ธนาคาร
   */
  async deleteBankRule(ruleId) {
    const rule = this.currentData.bankRules.find(r => r.id === ruleId);
    if (!rule) return;

    if (!confirm(`คุณต้องการลบกฎเกณฑ์ ${rule.bank?.short_name} - ${rule.product_type} หรือไม่?`)) {
      return;
    }

    try {
      const result = await DataManager.deleteBankRule(ruleId);

      if (result.success) {
        this.showNotification('ลบกฎเกณฑ์สำเร็จ', 'success');
        this.renderBankRules();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error deleting bank rule:', error);
      this.showNotification('ไม่สามารถลบกฎเกณฑ์ได้', 'error');
    }
  }

  /**
   * รีเซ็ตฟอร์มกฎเกณฑ์
   */
  resetBankRuleForm() {
    this.clearBankRuleForm();
    
    if (this.elements.btnRulesAdd) {
      this.elements.btnRulesAdd.textContent = '+ เพิ่ม';
      this.elements.btnRulesAdd.onclick = () => this.addBankRule();
    }
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * ตั้งค่าสถานะ loading สำหรับปุ่ม
   */
  setButtonLoading(button, loading) {
    if (!button) return;

    if (loading) {
      button.disabled = true;
      button.style.opacity = '0.6';
      button.innerHTML = `<span class="loading-spinner"></span> กำลังประมวลผล...`;
    } else {
      button.disabled = false;
      button.style.opacity = '1';
      // Reset original text based on button id
      if (button.id === 'btn-promo-add') {
        button.innerHTML = '+ เพิ่มโปร';
      } else if (button.id === 'btn-promo-refresh') {
        button.innerHTML = '↻ รีเฟรช';
      } else if (button.id === 'btn-rules-add') {
        button.innerHTML = '+ เพิ่ม';
      } else if (button.id === 'btn-rules-refresh') {
        button.innerHTML = '↻ รีเฟรช';
      }
    }
  }

  /**
   * แสดงการแจ้งเตือน
   */
  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;

    // Position notification
    notification.style.position = 'fixed';
    notification.style.top = '20px';
    notification.style.right = '20px';
    notification.style.zIndex = '9999';
    notification.style.maxWidth = '400px';
    notification.style.padding = '12px 16px';
    notification.style.borderRadius = '8px';
    notification.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
    notification.style.animation = 'slideIn 0.3s ease-out';

    // Style based on type
    const colors = {
      success: { bg: '#d4edda', color: '#155724', border: '#c3e6cb' },
      error: { bg: '#f8d7da', color: '#721c24', border: '#f5c6cb' },
      info: { bg: '#d1ecf1', color: '#0c5460', border: '#bee5eb' },
      warning: { bg: '#fff3cd', color: '#856404', border: '#ffeaa7' }
    };

    const style = colors[type] || colors.info;
    notification.style.background = style.bg;
    notification.style.color = style.color;
    notification.style.border = `1px solid ${style.border}`;

    document.body.appendChild(notification);

    // Auto-remove
    setTimeout(() => {
      if (notification.parentNode) {
        notification.style.animation = 'slideOut 0.3s ease-in';
        setTimeout(() => {
          notification.parentNode.removeChild(notification);
        }, 300);
      }
    }, duration);

    // Click to dismiss
    notification.addEventListener('click', () => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    });
  }

  /**
   * ตัดข้อความให้สั้น
   */
  truncateText(text, maxLength) {
    if (!text || text.length <= maxLength) return text || '—';
    return text.substring(0, maxLength) + '...';
  }

  /**
   * จัดรูปแบบวันที่
   */
  formatDate(dateString) {
    if (!dateString) return '—';
    
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return dateString;
    }
  }

  /**
   * จัดรูปแบบเงิน
   */
  formatCurrency(amount) {
    if (!amount || amount === 0) return '—';
    
    try {
      return new Intl.NumberFormat('th-TH', {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0
      }).format(amount);
    } catch (error) {
      return amount.toString();
    }
  }

  // ========================================
  // EXPORT/IMPORT FUNCTIONS
  // ========================================

  /**
   * Export ข้อมูลทั้งหมด
   */
  exportAllData() {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      data: {
        banks: this.currentData.banks,
        promotions: this.currentData.promotions.map(p => ({
          ...p,
          bank: undefined // Remove populated bank data
        })),
        bankRules: this.currentData.bankRules.map(r => ({
          ...r,
          bank: undefined // Remove populated bank data
        })),
        mrrRates: this.currentData.mrrRates.map(m => ({
          ...m,
          bank: undefined // Remove populated bank data
        }))
      }
    };

    this.downloadFile(
      JSON.stringify(exportData, null, 2),
      `loan-app-data-${new Date().toISOString().split('T')[0]}.json`,
      'application/json'
    );

    this.showNotification('Export ข้อมูลเรียบร้อย', 'success');
  }

  /**
   * ดาวน์โหลดไฟล์
   */
  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ========================================
  // CLEANUP
  // ========================================

  /**
   * ทำความสะอาดก่อนปิดหน้า
   */
  cleanup() {
    // Unsubscribe from all real-time updates
    this.subscriptions.forEach(subscription => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    });
    this.subscriptions = [];

    // Clear data
    this.currentData = {
      banks: [],
      promotions: [],
      bankRules: [],
      mrrRates: []
    };

    // Clear elements reference
    this.elements = {};

    console.log('🧹 Admin Manager cleaned up');
  }
}

// ========================================
// INITIALIZATION FUNCTIONS
// ========================================

/**
 * เริ่มต้น Admin Manager (สำหรับ backward compatibility)
 */
export function initAdminPromotionsAdvanced() {
  console.warn('initAdminPromotionsAdvanced() is deprecated. Use AdminManager instead.');
  
  const adminManager = new AdminManager();
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      adminManager.initialize();
    });
  } else {
    adminManager.initialize();
  }
  
  // Export to window for global access
  window.adminManager = adminManager;
  
  return adminManager;
}

/**
 * เริ่มต้น Bank Rules (สำหรับ backward compatibility)
 */
export function initAdminRules() {
  // This is handled by initAdminPromotionsAdvanced now
  console.log('📝 Bank Rules management integrated with AdminManager');
}

// ========================================
// GLOBAL STYLES (AUTO-INJECT)
// ========================================

// Add CSS styles for admin interface
if (typeof document !== 'undefined') {
  const styles = `
    <style>
    .loading-spinner {
      display: inline-block;
      width: 12px;
      height: 12px;
      border: 2px solid #f3f3f3;
      border-top: 2px solid #3498db;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
    
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    
    .action-buttons {
      display: flex;
      gap: 4px;
    }
    
    .btn-small {
      padding: 4px 8px;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.8em;
      transition: all 0.2s;
    }
    
    .btn-edit {
      background: #e3f2fd;
      color: #1976d2;
    }
    
    .btn-edit:hover {
      background: #bbdefb;
    }
    
    .btn-delete {
      background: #ffebee;
      color: #d32f2f;
    }
    
    .btn-delete:hover {
      background: #ffcdd2;
    }
    
    .status-badge {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.8em;
      font-weight: bold;
    }
    
    .status-badge.active {
      background: #d4edda;
      color: #155724;
    }
    
    .status-badge.inactive {
      background: #f8d7da;
      color: #721c24;
    }
    
    tr.inactive {
      opacity: 0.6;
      background: #f8f9fa;
    }
    
    .text-warning {
      color: #856404;
    }
    
    .text-success {
      color: #155724;
    }
    </style>
  `;
  
  document.head.insertAdjacentHTML('beforeend', styles);
}

// ========================================
// AUTO CLEANUP ON PAGE UNLOAD
// ========================================

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (window.adminManager && typeof window.adminManager.cleanup === 'function') {
      window.adminManager.cleanup();
    }
  });
}

// ========================================
// EXPORT
// ========================================

export default AdminManager;
// stray removed: .innerHTML = '<td colspan="19" style="text-align: center; color: #666;">ไม่มีข้อมูลโปรโมชัน</td>';
      this.elements.promoBody.appendChild(row);
      return;
    }

    this.currentData.promotions.forEach(promo => {
      const row = document.createElement('tr');
      row.className = promo.active ? '' : 'inactive';
      
      row.innerHTML = `
        <td>${promo.bank?.short_name || '—'}</td>
        <td>${promo.product_type}</td>
        <td title="${promo.description || ''}">${this.truncateText(promo.title, 20)}</td>
        <td>${this.truncateText(promo.description || '', 30)}</td>
        <td>${promo.discount_bps || 0}</td>
        <td>${promo.remaining_months || 0}</td>
        <td>${promo.year1_months || 0}</td>
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
            <button class="btn-small btn-edit" onclick="adminManager.editPromotion('${promo.id}')">
              ✏️
            </button>
            <button class="btn-small btn-delete" onclick="adminManager.deletePromotion('${promo.id}')">
              🗑️
            </button>
          </div>
        </td>
      `;

      this.elements.promoBody.appendChild(row);
    });
  }

  /**
   * แก้ไขโปรโมชัน
   */
  async editPromotion(promotionId) {
    const promotion = this.currentData.promotions.find(p => p.id === promotionId);
    if (!promotion) return;

    // Fill form with existing data
    if (this.elements.newBank) this.elements.newBank.value = promotion.bank_id;
    if (this.elements.newProduct) this.elements.newProduct.value = promotion.product_type;
    if (this.elements.newTitle) this.elements.newTitle.value = promotion.title;
    if (this.elements.newDetail) this.elements.newDetail.value = promotion.description || '';
    if (this.elements.newActive) this.elements.newActive.checked = promotion.active;

    // Change button to "Update"
    if (this.elements.btnPromoAdd) {
      this.elements.btnPromoAdd.textContent = 'อัพเดต';
      this.elements.btnPromoAdd.onclick = () => this.updatePromotion(promotionId);
    }

    // Scroll to form
    this.elements.newBank?.scrollIntoView({ behavior: 'smooth' });
  }

  /**
   * อัพเดตโปรโมชัน
   */
  async updatePromotion(promotionId) {
    try {
      const formData = this.getPromotionFormData();
      
      if (!this.validatePromotionForm(formData)) {
        return;
      }

      this.setButtonLoading(this.elements.btnPromoAdd, true);

      const result = await DataManager.updatePromotion(promotionId, formData);

      if (result.success) {
        this.showNotification('อัพเดตโปรโมชันสำเร็จ', 'success');
        this.resetPromotionForm();
        this.renderPromotions();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error updating promotion:', error);
      this.showNotification('ไม่สามารถอัพเดตโปรโมชันได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnPromoAdd, false);
    }
  }

  /**
   * ลบโปรโมชัน
   */
  async deletePromotion(promotionId) {
    const promotion = this.currentData.promotions.find(p => p.id === promotionId);
    if (!promotion) return;

    if (!confirm(`คุณต้องการลบโปรโมชัน "${promotion.title}" หรือไม่?`)) {
      return;
    }

    try {
      const result = await DataManager.deletePromotion(promotionId);

      if (result.success) {
        this.showNotification('ลบโปรโมชันสำเร็จ', 'success');
        this.renderPromotions();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error deleting promotion:', error);
      this.showNotification('ไม่สามารถลบโปรโมชันได้', 'error');
    }
  }

  /**
   * รีเซ็ตฟอร์มโปรโมชัน
   */
  resetPromotionForm() {
    this.clearPromotionForm();
    
    if (this.elements.btnPromoAdd) {
      this.elements.btnPromoAdd.textContent = '+ เพิ่มโปร';
      this.elements.btnPromoAdd.onclick = () => this.addPromotion();
    }
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
      
      if (!this.validateBankRuleForm(formData)) {
        return;
      }

      this.setButtonLoading(this.elements.btnRulesAdd, true);

      const result = await DataManager.addBankRule(formData);

      if (result.success) {
        this.showNotification('เพิ่มกฎเกณฑ์สำเร็จ', 'success');
        this.clearBankRuleForm();
        this.renderBankRules();
      } else {
        this.showNotification(result.error, 'error');
      }

    } catch (error) {
      console.error('Error adding bank rule:', error);
      this.showNotification('ไม่สามารถเพิ่มกฎเกณฑ์ได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnRulesAdd, false);
    }
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
      active: true,
      priority: 1
    };
  }

  /**
   * ตรวจสอบฟอร์มกฎเกณฑ์
   */
  validateBankRuleForm(formData) {
    const errors = [];

    if (!formData.bank_id) {
      errors.push('กรุณาเลือกธนาคาร');
    }

    if (!formData.dsr_cap || formData.dsr_cap <= 0) {
      errors.push('กรุณากรอก DSR cap ที่ถูกต้อง');
    }

    if (!formData.ltv_cap || formData.ltv_cap <= 0) {
      errors.push('กรุณากรอก LTV cap ที่ถูกต้อง');
    }

    if (errors.length > 0) {
      this.showNotification(errors.join('<br>'), 'error');
      return false;
    }

    return true;
  }

  /**
   * ล้างฟอร์มกฎเกณฑ์
   */
  clearBankRuleForm() {
    const fields = [
      'newRuleBank', 'newRuleProduct', 'newRuleProp', 'newRuleHome',
      'newRuleDsr', 'newRuleLtv', 'newRuleYears', 'newRuleAge',
      'newRuleIncome', 'newRuleMlc'
    ];

    fields.forEach(fieldName => {
      const element = this.elements[fieldName];
      if (element) {
        if (element.type === 'select-one') {
          element.selectedIndex = 0;
        } else {
          element.value = '';
        }
      }
    });
  }

  /**
   * รีเฟรชกฎเกณฑ์
   */
  async refreshBankRules() {
    try {
      this.setButtonLoading(this.elements.btnRulesRefresh, true);
      await this.loadAllData();
      this.renderBankRules();
      this.showNotification('รีเฟรชข้อมูลเรียบร้อย', 'success');
    } catch (error) {
      this.showNotification('ไม่สามารถรีเฟรชได้', 'error');
    } finally {
      this.setButtonLoading(this.elements.btnRulesRefresh, false);
    }
  }

  /**
   * แสดงตารางกฎเกณฑ์
   */
  renderBankRules() {
    if (!this.elements.rulesBody) return;

    this.elements.rulesBody.innerHTML = '';

    if (this.currentData.bankRules.length === 0) {
      const row = document.createElement('tr');
      row