// js/loan-app-manager.js
// ========================================
// LOAN APP MANAGER - MAIN CONTROLLER
// ========================================

import { AuthManager } from './auth-manager.js';
import DataManager from './data-manager.js';
import LoanCalculator from './loan-calculator-supabase.js';

/**
 * จัดการแอปพลิเคชันหลักสำหรับการคำนวณสินเชื่อ
 */
export class LoanAppManager {
  constructor() {
    this.calculator = new LoanCalculator();
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;
    
    // DOM Elements
    this.elements = {};
    this.bindElements();
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * เริ่มต้นแอปพลิเคชัน
   */
  async initialize() {
    try {
      console.log('🚀 Initializing Loan App...');

      // Initialize authentication
      await AuthManager.initialize();

      // Setup UI event listeners
      this.setupEventListeners();
      
      // Check database connection
      const connected = await DataManager.checkDatabaseConnection();
      this.updateConnectionStatus(connected);

      // Setup real-time updates
      this.setupRealTimeUpdates();

      // Load initial data
      await this.loadInitialData();

      // Load calculation history
      await this.loadCalculationHistory();

      console.log('✅ Loan App initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize Loan App:', error);
      this.showNotification('ไม่สามารถเริ่มต้นแอปได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  /**
   * ผูก DOM elements
   */
  bindElements() {
    this.elements = {
      // Form elements
      modeRadios: document.querySelectorAll('input[name="mode"]'),
      product: document.getElementById('product'),
      income: document.getElementById('income'),
      debt: document.getElementById('debt'),
      incomeExtra: document.getElementById('income-extra'),
      age: document.getElementById('age'),
      years: document.getElementById('years'),
      property: document.getElementById('property'),
      propertyType: document.getElementById('property-type'),
      homeNumber: document.getElementById('home-number'),
      loanAmount: document.getElementById('loan-amount'),
      blockProperty: document.getElementById('block-property'),
      blockPropMeta: document.getElementById('block-prop-meta'),
      blockHome: document.getElementById('block-home'),
      
      // Buttons
      btnRun: document.getElementById('btn-run'),
      btnSave: document.getElementById('btn-save-calculation'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnClearHistory: document.getElementById('btn-clear-history'),
      
      // Display elements
      summary: document.getElementById('caps'),
      offers: document.getElementById('offers'),
      note: document.getElementById('note'),
      exportSection: document.getElementById('export-section'),
      
      // Statistics
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),
      
      // Status elements
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
      rulesCount: document.getElementById('rules-count'),
      lastUpdated: document.getElementById('last-updated'),
      
      // History
      calculationHistory: document.getElementById('calculation-history'),
      historyList: document.getElementById('history-list'),
      
      // UI elements
      btnText: document.getElementById('btn-text'),
      btnSpinner: document.getElementById('btn-spinner'),
      blockLoan: document.getElementById('block-loan'),
      sortInfo: document.getElementById('sort-info')
    };
  }

  /**
   * ตั้งค่า Event Listeners
   */
  setupEventListeners() {
    this.elements.modeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.handleModeChange());
    });
    this.elements.product?.addEventListener('change', () => this.handleProductTypeChange());
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    document.getElementById('history-list')?.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const calculationId = historyItem.dataset.id;
            this.loadCalculationFromHistory(calculationId);
        }
    });
    
    this.setupFormValidation();
    this.handleProductTypeChange(); // Call on initial load
    this.handleModeChange(); // Call on initial load
  }

  /**
   * จัดการการเปลี่ยนประเภทผลิตภัณฑ์
   */
  handleProductTypeChange() {
      const productType = this.elements.product.value;
      const isMortgageOrRefinance = ['MORTGAGE', 'REFINANCE'].includes(productType);
      
      if (this.elements.blockProperty) {
          this.elements.blockProperty.style.display = isMortgageOrRefinance ? 'block' : 'none';
      }
      if (this.elements.blockPropMeta) {
          this.elements.blockPropMeta.style.display = isMortgageOrRefinance ? 'block' : 'none';
      }
      if (this.elements.blockHome) {
          this.elements.blockHome.style.display = isMortgageOrRefinance ? 'block' : 'none';
      }
      
      this.loadInitialData();
      this.clearResults();
  }
  
  /**
   * ตั้งค่า Real-time updates
   */
  setupRealTimeUpdates() {
    this.calculator.setupRealTimeUpdates((changeType) => {
      console.log(`📡 Data updated: ${changeType}`);
      this.showNotification(`ข้อมูล${this.getChangeTypeText(changeType)}มีการอัพเดต`, 'info');
      
      this.loadInitialData();
      
      if (this.currentResults.length > 0) {
        this.showNotification('กำลังคำนวณใหม่ด้วยข้อมูลล่าสุด...', 'info');
        setTimeout(() => this.runCalculation(), 1000);
      }
    });
  }

  /**
   * โหลดข้อมูลเบื้องต้น
   */
  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';
      
      const [banks, promotions, rules] = await Promise.all([
        DataManager.getBanks(),
        DataManager.getActivePromotions(productType),
        DataManager.getBankRules(productType)
      ]);

      if (this.elements.banksCount) this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.rulesCount) this.elements.rulesCount.textContent = rules.length;
      if (this.elements.lastUpdated) this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');

    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  // ========================================
  // FORM HANDLING
  // ========================================

  /**
   * จัดการการเปลี่ยน mode
   */
  handleModeChange() {
    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value;
    
    if (this.elements.blockLoan) {
      this.elements.blockLoan.style.display = selectedMode === 'check' ? 'block' : 'none';
    }

    if (this.elements.sortInfo) {
      this.elements.sortInfo.textContent = selectedMode === 'check' 
        ? '(เรียงตาม DSR ต่ำสุด)' 
        : '(เรียงตามวงเงินสูงสุด)';
    }

    this.clearResults();
  }

  /**
   * ตั้งค่า form validation
   */
  setupFormValidation() {
    const numericInputs = [
      this.elements.income,
      this.elements.debt,
      this.elements.incomeExtra,
      this.elements.age,
      this.elements.years,
      this.elements.property,
      this.elements.loanAmount
    ];

    numericInputs.forEach(input => {
      if (!input) return;

      input.addEventListener('input', (e) => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });

      input.addEventListener('blur', (e) => {
        const value = parseInt(e.target.value) || 0;
        if (value > 0) {
          e.target.dataset.rawValue = value;
          e.target.value = value.toLocaleString();
        }
      });

      input.addEventListener('focus', (e) => {
        if (e.target.dataset.rawValue) {
          e.target.value = e.target.dataset.rawValue;
        }
      });
    });
  }
  
  // ========================================
  // CALCULATION LOGIC
  // ========================================

  /**
   * รันการคำนวณหลัก
   */
  async runCalculation() {
    if (this.isCalculating) {
      this.showNotification('กำลังคำนวณอยู่ กรุณารอสักครู่', 'warning');
      return;
    }

    try {
      const params = this.getFormParameters();
      if (!this.validateParameters(params)) {
        return;
      }

      this.setCalculatingState(true);
      this.clearResults();

      console.log('🔢 Starting calculation with params:', params);

      const selectedMode = document.querySelector('input[name="mode"]:checked')?.value;
      let results = [];

      if (selectedMode === 'max') {
        results = await this.calculator.calculateMaxLoanAmount(params);
      } else {
        results = await this.calculator.checkLoanAmount(params);
      }

      this.currentResults = results;
      this.currentParams = { ...params, calculationMode: selectedMode };

      this.displayResults(results, selectedMode);
      this.updateStatistics(results);

      if (results.length > 0) {
        await this.saveCalculation();
      }

      console.log('✅ Calculation completed:', results.length, 'offers');

    } catch (error) {
      console.error('❌ Calculation error:', error);
      this.showNotification('เกิดข้อผิดพลาดในการคำนวณ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      this.setCalculatingState(false);
    }
  }

  /**
   * ดึงพารามิเตอร์จากฟอร์ม
   */
  getFormParameters() {
    const propertyType = this.elements.product?.value === 'MORTGAGE' ? this.elements.propertyType?.value : null;
    const homeNumber = this.elements.product?.value === 'MORTGAGE' ? parseInt(this.elements.homeNumber?.value) : null;
    
    return {
      productType: this.elements.product?.value || 'MORTGAGE',
      income: this.getRawValue(this.elements.income) || 0,
      debt: this.getRawValue(this.elements.debt) || 0,
      incomeExtra: this.getRawValue(this.elements.incomeExtra) || 0,
      age: parseInt(this.elements.age?.value) || 30,
      years: parseInt(this.elements.years?.value) || 20,
      propertyValue: this.getRawValue(this.elements.property) || 0,
      propertyType,
      homeNumber,
      loanAmount: this.getRawValue(this.elements.loanAmount) || 0
    };
  }

  /**
   * ดึงค่าดิบจาก formatted input
   */
  getRawValue(element) {
    if (!element) return 0;
    return parseInt(element.value.replace(/,/g, '')) || 0;
  }

  /**
   * ตรวจสอบพารามิเตอร์
   */
  validateParameters(params) {
    const errors = [];

    if (params.income <= 0) {
      errors.push('กรุณากรอกรายได้');
    }

    if (['MORTGAGE', 'REFINANCE'].includes(params.productType)) {
      if (params.propertyValue <= 0) {
        errors.push('กรุณากรอกมูลค่าหลักประกัน');
      }
    }

    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value;
    if (selectedMode === 'check' && params.loanAmount <= 0) {
      errors.push('กรุณากรอกวงเงินที่ต้องการกู้');
    }

    if (errors.length > 0) {
      this.showNotification(errors.join('<br>'), 'error');
      return false;
    }

    return true;
  }

  // ========================================
  // RESULTS DISPLAY
  // ========================================

  /**
   * แสดงผลการคำนวณ
   */
  displayResults(results, mode) {
    if (!results || results.length === 0) {
      this.displayNoResults();
      return;
    }

    this.displayResultsTable(results, mode);
    this.displaySummary(results, mode);
    this.elements.exportSection.style.display = 'block';
  }

  /**
   * แสดงตารางผลลัพธ์
   */
  displayResultsTable(results, mode) {
    if (!this.elements.offers) return;

    const tbody = this.elements.offers;
    tbody.innerHTML = '';

    results.forEach(result => {
      const row = document.createElement('tr');
      row.className = result.status === 'APPROVED' ? 'status-approved' : 'status-rejected';
      
      const monthlyPayment = result.monthlyPayment ? this.formatCurrency(result.monthlyPayment) : '—';
      const loanAmount = result.maxLoanAmount || result.loanAmount;
      const formattedLoanAmount = loanAmount ? this.formatCurrency(loanAmount) : '—';

      row.innerHTML = `
        <td>
          <strong>${result.bankShortName}</strong>
        </td>
        <td>${result.promotion?.title || '—'}</td>
        <td><strong>${result.interestRate?.toFixed(2) || '—'}%</strong></td>
        <td>${monthlyPayment}</td>
        <td>${formattedLoanAmount}</td>
        <td>${result.dsr?.toFixed(2) || '—'}%</td>
        <td>${result.ltv?.toFixed(2) || '—'}%</td>
        <td><span class="status-${result.status.toLowerCase()}">${result.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}</span></td>
      `;

      tbody.appendChild(row);
    });
  }

  /**
   * แสดงสรุปผล
   */
  displaySummary(results, mode) {
    if (!this.elements.summary) return;

    const approved = results.filter(r => r.status === 'APPROVED');
    const best = approved.length > 0 ? approved[0] : null;

    if (best) {
      const summaryHTML = `
        <div class="summary-highlight">
          <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
          <div class="summary-grid">
            <div><strong>วงเงิน:</strong> ${this.formatCurrency(best.maxLoanAmount || best.loanAmount)}</div>
            <div><strong>ค่างวด/เดือน:</strong> ${this.formatCurrency(best.monthlyPayment)}</div>
            <div><strong>อัตราดอกเบี้ย:</strong> ${best.interestRate?.toFixed(2)}%</div>
            <div><strong>DSR:</strong> ${best.dsr?.toFixed(2)}%</div>
            <div><strong>LTV:</strong> ${best.ltv?.toFixed(2)}%</div>
          </div>
        </div>
      `;
      this.elements.summary.innerHTML = summaryHTML;
    } else {
      this.elements.summary.innerHTML = `<div class="summary-highlight" style="border-color: #dc3545;"><h4>❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4></div>`;
    }
  }

  /**
   * แสดงเมื่อไม่มีผลลัพธ์
   */
  displayNoResults() {
    if (this.elements.offers) {
      this.elements.offers.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">ไม่พบข้อเสนอที่เหมาะสม</td></tr>';
    }

    if (this.elements.summary) {
      this.elements.summary.innerHTML = '';
    }
  }

  /**
   * อัพเดตสถิติ
   */
  updateStatistics(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(r => r > 0);
    const avgRate = rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;

    this.elements.totalOffers.textContent = results.length;
    this.elements.approvedOffers.textContent = approved.length;
    this.elements.rejectedOffers.textContent = rejected.length;
    this.elements.avgRate.textContent = avgRate > 0 ? avgRate.toFixed(2) : '—';
  }

  // ========================================
  // CALCULATION HISTORY
  // ========================================

  /**
   * โหลดประวัติการคำนวณ
   */
  async loadCalculationHistory() {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      this.elements.calculationHistory.style.display = 'none';
      return;
    }
    
    try {
      const history = await DataManager.getUserCalculations(10);
      this.elements.calculationHistory.style.display = history.length > 0 ? 'block' : 'none';
      this.elements.historyList.innerHTML = history.map(calc => `
        <div class="history-item" data-id="${calc.id}">
          <div><strong>${calc.product_type}</strong> - ${calc.calculation_mode}</div>
          <div style="font-size: 0.8em; color: #666;">${new Date(calc.created_at).toLocaleString('th-TH')}</div>
        </div>
      `).join('');
    } catch (error) {
      console.error('Error loading history:', error);
    }
  }

  /**
   * โหลดการคำนวณจากประวัติ
   */
  async loadCalculationFromHistory(id) {
    const history = await DataManager.getUserCalculations(99); 
    const calculation = history.find(c => c.id === id);
    if (!calculation) {
      this.showNotification('ไม่พบประวัติการคำนวณนี้', 'error');
      return;
    }
    this.fillFormWithData(calculation);
    this.currentResults = calculation.results.calculationResults;
    this.displayResults(this.currentResults, calculation.calculation_mode);
    this.updateStatistics(this.currentResults);
    this.showNotification('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว', 'success');
  }

  /**
   * เติมข้อมูลลงในฟอร์ม
   */
  fillFormWithData(data) {
    this.elements.product.value = data.product_type;
    document.querySelector(`input[name="mode"][value="${data.calculation_mode}"]`).checked = true;
    this.elements.income.value = data.income.toLocaleString();
    this.elements.debt.value = data.debt.toLocaleString();
    this.elements.incomeExtra.value = data.income_extra.toLocaleString();
    this.elements.age.value = data.age;
    this.elements.years.value = data.tenure_years;
    this.elements.property.value = data.property_value.toLocaleString();
    this.elements.propertyType.value = data.property_type || '';
    this.elements.homeNumber.value = data.home_number || '';
    this.elements.loanAmount.value = data.loan_amount.toLocaleString();
    this.handleModeChange();
    this.handleProductTypeChange();
  }

  /**
   * ล้างประวัติการคำนวณ
   */
  async clearCalculationHistory() {
    if (confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) {
      try {
        await DataManager.clearUserCalculations();
        this.showNotification('ล้างประวัติเรียบร้อยแล้ว', 'success');
        this.loadCalculationHistory();
      } catch (error) {
        this.showNotification('ไม่สามารถล้างประวัติได้', 'error');
      }
    }
  }
  
  // ========================================
  // EXPORT FUNCTIONS
  // ========================================

  /**
   * บันทึกการคำนวณ
   */
  async saveCalculation() {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      this.showNotification('กรุณาเข้าสู่ระบบก่อนเพื่อบันทึกประวัติ', 'warning');
      return;
    }
    if (!this.currentResults.length) return;
    
    try {
      await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      this.showNotification('บันทึกการคำนวณเรียบร้อยแล้ว', 'success');
      this.loadCalculationHistory();
    } catch (error) {
      this.showNotification('ไม่สามารถบันทึกได้', 'error');
    }
  }

  /**
   * Export เป็น CSV
   */
  exportToCSV() {
    if (!this.currentResults.length) return;
    const csv = LoanCalculator.exportToCSV(this.currentResults);
    this.downloadFile(csv, 'loan-calculation.csv', 'text/csv');
  }

  /**
   * Export เป็น JSON
   */
  exportToJSON() {
    if (!this.currentResults.length) return;
    const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
    this.downloadFile(json, 'loan-calculation.json', 'application/json');
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
  // UTILITY METHODS
  // ========================================

  /**
   * แสดงสถานะการคำนวณ
   */
  setCalculatingState(calculating) {
    this.isCalculating = calculating;
    this.elements.btnText.textContent = calculating ? 'กำลังคำนวณ...' : '🚀 คำนวณ';
    this.elements.btnSpinner.style.display = calculating ? 'inline-block' : 'none';
    this.elements.btnRun.disabled = calculating;
  }
  
  /**
   * ล้างผลลัพธ์
   */
  clearResults() {
    this.currentResults = [];
    this.elements.offers.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">📋 กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>';
    this.elements.summary.innerHTML = '';
    
    ['totalOffers', 'approvedOffers', 'rejectedOffers', 'avgRate'].forEach(key => {
      this.elements[key].textContent = '—';
    });
    
    this.elements.exportSection.style.display = 'none';
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
   * จัดรูปแบบเงิน
   */
  formatCurrency(amount) {
    if (!amount || amount === 0) return '—';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }

  /**
   * แปลง product type เป็นข้อความไทย
   */
  getProductTypeText(productType) {
    const types = {
      'MORTGAGE': 'สินเชื่อบ้าน',
      'REFINANCE': 'รีไฟแนนซ์',
      'PERSONAL': 'สินเชื่อส่วนบุคคล',
      'SME': 'สินเชื่อ SME'
    };
    return types[productType] || productType;
  }

  /**
   * แปลง change type เป็นข้อความไทย
   */
  getChangeTypeText(changeType) {
    const types = {
      'promotions': 'โปรโมชัน',
      'rules': 'กฎเกณฑ์',
      'rates': 'อัตราดอกเบี้ย'
    };
    return types[changeType] || changeType;
  }
}

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new LoanAppManager();
  app.initialize();
  window.loanApp = app; // For debugging
});