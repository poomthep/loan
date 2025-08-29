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
      // await AuthManager.checkSession(); // Ensure user state is loaded
      // if (!AuthManager.isAdmin()) {
      //   this.showNotification('Access denied: Admin privileges required', 'error');
      //   // window.location.href = './index.html';
      //   // return;
      // }

      // Load initial data
      await this.loadAllData();

      // Setup real-time subscriptions
      this.setupRealTimeUpdates();

      // Setup event listeners
      this.setupEventListeners();

      // Render initial UI
      this.renderAllTables();
      this.updateStats();


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
      newMrrBank: document.getElementById('new-mrr-bank'),

      // Promotion form elements
      newProduct: document.getElementById('new-product'),
      newTitle: document.getElementById('new-title'),
      newDetail: document.getElementById('new-detail'),
      newDiscountBps: document.getElementById('new-discount-bps'),
      newYear1Rate: document.getElementById('new-year1-rate'),
      newYear1Months: document.getElementById('new-year1-months'),
      newYear2Rate: document.getElementById('new-year2-rate'),
      newLtvOverride: document.getElementById('new-ltv-override'),
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
      newRulePriority: document.getElementById('new-rule-priority'),

      // MRR form elements
      newMrrProduct: document.getElementById('new-mrr-product'),
      newMrrRate: document.getElementById('new-mrr-rate'),
      newMrrDate: document.getElementById('new-mrr-date'),

      // Action buttons
      btnPromoAdd: document.getElementById('btn-promo-add'),
      btnPromoRefresh: document.getElementById('btn-promo-refresh'),
      btnPromoExport: document.getElementById('btn-promo-export'),
      btnRulesAdd: document.getElementById('btn-rules-add'),
      btnRulesRefresh: document.getElementById('btn-rules-refresh'),
      btnRulesExport: document.getElementById('btn-rules-export'),
      btnMrrAdd: document.getElementById('btn-mrr-add'),
      btnMrrRefresh: document.getElementById('btn-mrr-refresh'),

      // Display areas
      promoBody: document.getElementById('promo-body'),
      rulesBody: document.getElementById('rules-body'),
      mrrBody: document.getElementById('mrr-body'),

      // Stats
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
      const data = await DataManager.getAllDataForAdmin();
      this.currentData = data;

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
  
  renderAllTables() {
    this.renderPromotions();
    this.renderBankRules();
    this.renderMrrRates();
  }

  // ========================================
  // UI SETUP
  // ========================================

  /**
   * เติมข้อมูลใน bank selectors
   */
  populateBankSelectors() {
    const selectors = [
        this.elements.newBank, 
        this.elements.newRuleBank,
        this.elements.newMrrBank,
        document.getElementById('quick-promo-bank')
    ];
    
    selectors.forEach(select => {
      if (!select) return;

      const currentValue = select.value;
      while (select.children.length > 1) {
        select.removeChild(select.lastChild);
      }

      this.currentData.banks.forEach(bank => {
        const option = document.createElement('option');
        option.value = bank.id;
        option.textContent = `${bank.short_name} - ${bank.name}`;
        select.appendChild(option);
      });
      select.value = currentValue;
    });
  }

  /**
   * ตั้งค่า Event Listeners
   */
  setupEventListeners() {
    this.elements.btnPromoAdd?.addEventListener('click', () => this.addPromotion());
    this.elements.btnPromoRefresh?.addEventListener('click', () => this.refreshAll('promotions'));
    this.elements.btnPromoExport?.addEventListener('click', () => this.exportData('promotions'));

    this.elements.btnRulesAdd?.addEventListener('click', () => this.addBankRule());
    this.elements.btnRulesRefresh?.addEventListener('click', () => this.refreshAll('rules'));
    this.elements.btnRulesExport?.addEventListener('click', () => this.exportData('bank_rules'));

    this.elements.btnMrrAdd?.addEventListener('click', () => this.addMrrRate());
    this.elements.btnMrrRefresh?.addEventListener('click', () => this.refreshAll('mrr'));

    this.setupFormValidation();
  }

  /**
   * ตั้งค่า form validation
   */
  setupFormValidation() {
    // Implement validation if needed
  }
  
  updateStats() {
      if (this.elements.statBanks) this.elements.statBanks.textContent = this.currentData.banks.length;
      if (this.elements.statPromotions) this.elements.statPromotions.textContent = this.currentData.promotions.length;
      if (this.elements.statRules) this.elements.statRules.textContent = this.currentData.bankRules.length;
      // statCalculations would need a separate query
  }
  
  async refreshAll() {
      try {
          this.showNotification('กำลังรีเฟรชข้อมูลทั้งหมด...', 'info');
          await this.loadAllData();
          this.renderAllTables();
          this.updateStats();
          this.showNotification('รีเฟรชข้อมูลเรียบร้อย', 'success');
      } catch (error) {
          this.showNotification('ไม่สามารถรีเฟรชข้อมูลได้', 'error');
      }
  }


  // ========================================
  // REAL-TIME UPDATES
  // ========================================

  /**
   * ตั้งค่า Real-time subscriptions
   */
  setupRealTimeUpdates() {
    const handleUpdate = (type) => (payload) => {
      console.log(`📡 ${type} updated:`, payload);
      this.showNotification(`ข้อมูล ${type} มีการอัพเดต`, 'info');
      this.refreshAll();
    };

    this.subscriptions.push(DataManager.subscribeToPromotions(handleUpdate('promotions')));
    this.subscriptions.push(DataManager.subscribeToBankRules(handleUpdate('bank_rules')));
    this.subscriptions.push(DataManager.subscribeToMRRRates(handleUpdate('mrr_rates')));
  }

  // ========================================
  // PROMOTIONS MANAGEMENT
  // ========================================

  async addPromotion() {
    const formData = {
        bank_id: this.elements.newBank?.value,
        product_type: this.elements.newProduct?.value,
        title: this.elements.newTitle?.value,
        description: this.elements.newDetail?.value,
        discount_bps: parseInt(this.elements.newDiscountBps?.value) || 0,
        year1_rate: parseFloat(this.elements.newYear1Rate?.value) || null,
        year1_months: parseInt(this.elements.newYear1Months?.value) || 12,
        year2_rate: parseFloat(this.elements.newYear2Rate?.value) || null,
        ltv_override: parseFloat(this.elements.newLtvOverride?.value) || null,
        active: this.elements.newActive?.checked,
    };

    if (!formData.bank_id || !formData.title) {
        this.showNotification('กรุณากรอกข้อมูลโปรโมชันให้ครบถ้วน', 'error');
        return;
    }

    try {
        const result = await DataManager.addPromotion(formData);
        if (result.success) {
            this.showNotification('เพิ่มโปรโมชันสำเร็จ', 'success');
            this.refreshAll();
        } else {
            this.showNotification(result.error, 'error');
        }
    } catch (error) {
        this.showNotification('เกิดข้อผิดพลาดในการเพิ่มโปรโมชัน', 'error');
    }
  }
  
  async deletePromotion(id) {
      if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโปรโมชันนี้?')) return;
      try {
          const result = await DataManager.deletePromotion(id);
          if (result.success) {
              this.showNotification('ลบโปรโมชันสำเร็จ', 'success');
              this.refreshAll();
          } else {
              this.showNotification(result.error, 'error');
          }
      } catch (error) {
          this.showNotification('เกิดข้อผิดพลาดในการลบโปรโมชัน', 'error');
      }
  }

  renderPromotions() {
    if (!this.elements.promoBody) return;
    this.elements.promoBody.innerHTML = '';
    this.currentData.promotions.forEach(promo => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${promo.bank.short_name}</td>
            <td>${promo.product_type}</td>
            <td>${promo.title}</td>
            <td>${this.truncateText(promo.description, 30)}</td>
            <td>${promo.discount_bps}</td>
            <td>${promo.fixed_rate || 'N/A'}</td>
            <td>${promo.fixed_months || 'N/A'}</td>
            <td>${promo.year1_rate || 'N/A'}</td>
            <td>${promo.year1_months || 'N/A'}</td>
            <td>${promo.year2_rate || 'N/A'}</td>
            <td>${promo.year2_months || 'N/A'}</td>
            <td>${promo.year3_rate || 'N/A'}</td>
            <td>${promo.year3_months || 'N/A'}</td>
            <td>${promo.final_rate || 'N/A'}</td>
            <td>${promo.ltv_override || 'N/A'}</td>
            <td>${this.formatDate(promo.valid_from)}</td>
            <td>${this.formatDate(promo.valid_until)}</td>
            <td><span class="status-badge ${promo.active ? 'active' : 'inactive'}">${promo.active ? 'Active' : 'Inactive'}</span></td>
            <td class="action-buttons">
                <button class="btn-small btn-edit" onclick="adminManager.editPromotion('${promo.id}')">✏️</button>
                <button class="btn-small btn-delete" onclick="adminManager.deletePromotion('${promo.id}')">🗑️</button>
            </td>
        `;
        this.elements.promoBody.appendChild(row);
    });
  }
  
  editPromotion(id){
      alert("Edit function for promotion ID: " + id + " is not yet implemented.");
  }


  // ========================================
  // BANK RULES MANAGEMENT
  // ========================================
  
  async addBankRule() {
      const formData = {
          bank_id: this.elements.newRuleBank?.value,
          product_type: this.elements.newRuleProduct?.value,
          property_type: this.elements.newRuleProp?.value || null,
          home_number: parseInt(this.elements.newRuleHome?.value) || null,
          dsr_cap: parseFloat(this.elements.newRuleDsr?.value),
          ltv_cap: parseFloat(this.elements.newRuleLtv?.value),
          max_tenure_years: parseInt(this.elements.newRuleYears?.value),
          max_age_at_maturity: parseInt(this.elements.newRuleAge?.value),
          min_income: parseFloat(this.elements.newRuleIncome?.value),
          mlc_per_month: parseFloat(this.elements.newRuleMlc?.value),
          priority: parseInt(this.elements.newRulePriority?.value) || 1
      };
      
      if (!formData.bank_id || !formData.dsr_cap || !formData.ltv_cap) {
          this.showNotification('กรุณากรอกข้อมูลกฎเกณฑ์ให้ครบถ้วน', 'error');
          return;
      }
      
      try {
          const result = await DataManager.addBankRule(formData);
          if (result.success) {
              this.showNotification('เพิ่มกฎเกณฑ์สำเร็จ', 'success');
              this.refreshAll();
          } else {
              this.showNotification(result.error, 'error');
          }
      } catch (error) {
          this.showNotification('เกิดข้อผิดพลาดในการเพิ่มกฎเกณฑ์', 'error');
      }
  }

  async deleteBankRule(id) {
      if (!confirm('คุณแน่ใจหรือไม่ว่าต้องการลบกฎเกณฑ์นี้?')) return;
      try {
          const result = await DataManager.deleteBankRule(id);
          if (result.success) {
              this.showNotification('ลบกฎเกณฑ์สำเร็จ', 'success');
              this.refreshAll();
          } else {
              this.showNotification(result.error, 'error');
          }
      } catch (error) {
          this.showNotification('เกิดข้อผิดพลาดในการลบกฎเกณฑ์', 'error');
      }
  }

  renderBankRules() {
    if (!this.elements.rulesBody) return;
    this.elements.rulesBody.innerHTML = '';
    this.currentData.bankRules.forEach(rule => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${rule.bank.short_name}</td>
            <td>${rule.product_type}</td>
            <td>${rule.property_type || 'ALL'}</td>
            <td>${rule.home_number || 'ALL'}</td>
            <td>${rule.dsr_cap}%</td>
            <td>${rule.ltv_cap}%</td>
            <td>${rule.max_tenure_years}</td>
            <td>${rule.max_age_at_maturity}</td>
            <td>${this.formatCurrency(rule.min_income)}</td>
            <td>${this.formatCurrency(rule.mlc_per_month)}</td>
            <td>${rule.priority}</td>
            <td class="action-buttons">
                <button class="btn-small btn-edit" onclick="adminManager.editBankRule('${rule.id}')">✏️</button>
                <button class="btn-small btn-delete" onclick="adminManager.deleteBankRule('${rule.id}')">🗑️</button>
            </td>
        `;
        this.elements.rulesBody.appendChild(row);
    });
  }
  
  editBankRule(id) {
      alert("Edit function for rule ID: " + id + " is not yet implemented.");
  }
  
  
    // ========================================
    // MRR RATES MANAGEMENT
    // ========================================
    
    async addMrrRate() {
        const formData = {
            bank_id: this.elements.newMrrBank?.value,
            product_type: this.elements.newMrrProduct?.value,
            rate: parseFloat(this.elements.newMrrRate?.value),
            effective_date: this.elements.newMrrDate?.value
        };
        
        if (!formData.bank_id || !formData.rate || !formData.effective_date) {
            this.showNotification('กรุณากรอกข้อมูล MRR ให้ครบถ้วน', 'error');
            return;
        }
        
        try {
            // In a real app, you would likely deactivate the old rate
            // For simplicity here, we just add a new one
            const result = await DataManager.updateMRRRate(formData.bank_id, formData.product_type, formData.rate); // This function might need adjustment in DataManager
            if (result.success) {
                this.showNotification('เพิ่ม/อัพเดต MRR สำเร็จ', 'success');
                this.refreshAll();
            } else {
                this.showNotification(result.error, 'error');
            }
        } catch (error) {
            this.showNotification('เกิดข้อผิดพลาดในการอัพเดต MRR', 'error');
        }
    }
    
    renderMrrRates() {
        if (!this.elements.mrrBody) return;
        this.elements.mrrBody.innerHTML = '';
        this.currentData.mrrRates.forEach(rate => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${rate.bank.short_name}</td>
                <td>${rate.product_type}</td>
                <td>${rate.rate}%</td>
                <td>${this.formatDate(rate.effective_date)}</td>
                <td><span class="status-badge ${rate.active ? 'active' : 'inactive'}">${rate.active ? 'Active' : 'Inactive'}</span></td>
                <td class="action-buttons">
                    <button class="btn-small btn-edit" onclick="adminManager.editMrrRate('${rate.id}')">✏️</button>
                </td>
            `;
            this.elements.mrrBody.appendChild(row);
        });
    }

    editMrrRate(id) {
        alert("Edit function for MRR ID: " + id + " is not yet implemented.");
    }


  // ========================================
  // UTILITY METHODS
  // ========================================

  showNotification(message, type = 'info', duration = 4000) {
    // Re-use existing notification logic
    if (window.showNotification) {
        window.showNotification(message, type, duration);
    } else {
        alert(`${type.toUpperCase()}: ${message}`);
    }
  }

  truncateText(text, length) {
    return text && text.length > length ? text.substring(0, length) + '...' : text || '';
  }

  formatDate(dateStr) {
    return dateStr ? new Date(dateStr).toLocaleDateString('th-TH') : '';
  }
  
  formatCurrency(num) {
      return num ? new Intl.NumberFormat('th-TH').format(num) : '';
  }
  
  exportData(dataType) {
      let data;
      let filename;
      switch(dataType) {
          case 'promotions':
              data = this.currentData.promotions;
              filename = 'promotions.json';
              break;
          case 'bank_rules':
              data = this.currentData.bankRules;
              filename = 'bank_rules.json';
              break;
          default:
              this.showNotification('ไม่รองรับการ export ข้อมูลประเภทนี้', 'error');
              return;
      }
      
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
  }
  
  exportAllData() {
      const allData = {
          banks: this.currentData.banks,
          promotions: this.currentData.promotions,
          bankRules: this.currentData.bankRules,
          mrrRates: this.currentData.mrrRates
      };
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'loan_app_all_data.json';
      a.click();
      URL.revokeObjectURL(url);
  }
  
  clearCache() {
      DataManager.clearAllCache();
      this.showNotification('ล้าง Cache สำเร็จ', 'success');
  }


  cleanup() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}

export default AdminManager;