// js/loan.js
// ========================================
// Loan Calculator Controller for loan.html
// ========================================

import { AuthManager, showNotification } from './modules/auth-manager.js';
import DataManager from './modules/data-manager.js';
import LoanCalculator from './modules/loan-calculator-supabase.js';

/**
 * Main application class to manage the loan page.
 */
class LoanAppManager {
  constructor() {
    this.calculator = new LoanCalculator();
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;
    this.bindElements();
  }

  /**
   * Binds DOM elements.
   */
  bindElements() {
    this.elements = {
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
      btnRun: document.getElementById('btn-run'),
      btnSave: document.getElementById('btn-save-calculation'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnClearHistory: document.getElementById('btn-clear-history'),
      summary: document.getElementById('caps'),
      offers: document.getElementById('offers'),
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
      rulesCount: document.getElementById('rules-count'),
      lastUpdated: document.getElementById('last-updated'),
      calculationHistory: document.getElementById('calculation-history'),
      historyList: document.getElementById('history-list'),
      btnText: document.getElementById('btn-text'),
      btnSpinner: document.getElementById('btn-spinner'),
      blockLoan: document.getElementById('block-loan'),
      sortInfo: document.getElementById('sort-info'),
      exportSection: document.getElementById('export-section')
    };
  }

  /**
   * Initializes the loan app.
   */
  async initialize() {
    console.log('🚀 Initializing Loan App...');

    // Check auth status
    await AuthManager.checkSession();
    
    // Setup event listeners
    this.setupEventListeners();
    
    // Setup real-time updates
    this.setupRealTimeUpdates();

    // Load initial data counts
    await this.loadInitialData();

    // Load calculation history if user is logged in
    this.loadCalculationHistory();

    // Check URL hash for history section
    if (window.location.hash === '#history') {
      setTimeout(() => {
        this.elements.calculationHistory?.scrollIntoView({ behavior: 'smooth' });
      }, 500);
    }
    
    console.log('✅ Loan App initialized successfully');
  }

  /**
   * Sets up event listeners.
   */
  setupEventListeners() {
    this.elements.modeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.handleModeChange());
    });
    this.elements.product?.addEventListener('change', () => this.loadInitialData());
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    // Event listener for a dynamic element - loan history
    document.getElementById('history-list')?.addEventListener('click', (e) => {
        const historyItem = e.target.closest('.history-item');
        if (historyItem) {
            const calculationId = historyItem.dataset.id;
            this.loadCalculationFromHistory(calculationId);
        }
    });
    
    // Initial UI state
    this.handleModeChange();
  }
  
  /**
   * Sets up real-time updates from Supabase.
   */
  setupRealTimeUpdates() {
    this.calculator.setupRealTimeUpdates((changeType) => {
      console.log(`📡 Data updated: ${changeType}`);
      showNotification(`ข้อมูลมีการอัพเดต (${changeType})`, 'info');
      this.loadInitialData();
      if (this.currentResults.length > 0) {
        showNotification('กำลังคำนวณใหม่ด้วยข้อมูลล่าสุด...', 'info');
        this.runCalculation(true); // Re-run with latest data
      }
    });
  }

  /**
   * Loads initial data counts.
   */
  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';
      const [banks, promotions, rules] = await Promise.all([
        DataManager.getBanks(),
        DataManager.getActivePromotions(productType),
        DataManager.getBankRules(productType)
      ]);
      
      this.elements.banksCount.textContent = banks.length;
      this.elements.promotionsCount.textContent = promotions.length;
      this.elements.rulesCount.textContent = rules.length;
      this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  /**
   * Handles loan mode change.
   */
  handleModeChange() {
    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value;
    if (this.elements.blockLoan) {
      this.elements.blockLoan.style.display = selectedMode === 'check' ? 'block' : 'none';
    }
    if (this.elements.sortInfo) {
      this.elements.sortInfo.textContent = selectedMode === 'check' ? '(เรียงตาม DSR ต่ำสุด)' : '(เรียงตามวงเงินสูงสุด)';
    }
    this.clearResults();
  }

  /**
   * Runs the calculation logic.
   */
  async runCalculation(isReRun = false) {
    if (this.isCalculating) {
      showNotification('กำลังคำนวณอยู่ กรุณารอสักครู่', 'warning');
      return;
    }
    this.setCalculatingState(true);
    if (!isReRun) this.clearResults();

    const params = this.getFormParameters();
    if (!this.validateParameters(params)) {
      this.setCalculatingState(false);
      return;
    }

    try {
      const selectedMode = document.querySelector('input[name="mode"]:checked')?.value;
      const results = selectedMode === 'max' 
        ? await this.calculator.calculateMaxLoanAmount(params) 
        : await this.calculator.checkLoanAmount(params);
        
      this.currentResults = results;
      this.currentParams = { ...params, calculationMode: selectedMode };

      this.displayResults(results, selectedMode);
      this.updateStatistics(results);
      this.saveCalculation();

    } catch (error) {
      console.error('❌ Calculation error:', error);
      showNotification('เกิดข้อผิดพลาดในการคำนวณ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      this.setCalculatingState(false);
    }
  }

  /**
   * Extracts form parameters.
   */
  getFormParameters() {
    return {
      productType: this.elements.product?.value || 'MORTGAGE',
      income: this.getRawValue(this.elements.income) || 0,
      debt: this.getRawValue(this.elements.debt) || 0,
      incomeExtra: this.getRawValue(this.elements.incomeExtra) || 0,
      age: parseInt(this.elements.age?.value) || 30,
      years: parseInt(this.elements.years?.value) || 20,
      propertyValue: this.getRawValue(this.elements.property) || 0,
      propertyType: this.elements.propertyType?.value || null,
      homeNumber: parseInt(this.elements.homeNumber?.value) || null,
      loanAmount: this.getRawValue(this.elements.loanAmount) || 0
    };
  }

  /**
   * Validates form parameters.
   */
  validateParameters(params) {
    const errors = [];
    if (params.income <= 0) errors.push('กรุณากรอกรายได้');
    if (['MORTGAGE', 'REFINANCE'].includes(params.productType) && params.propertyValue <= 0) errors.push('กรุณากรอกมูลค่าหลักประกัน');
    if (document.querySelector('input[name="mode"]:checked')?.value === 'check' && params.loanAmount <= 0) errors.push('กรุณากรอกวงเงินที่ต้องการกู้');
    if (errors.length > 0) {
      showNotification(errors.join('<br>'), 'error');
      return false;
    }
    return true;
  }

  /**
   * Retrieves raw number value from a formatted input.
   */
  getRawValue(element) {
    if (!element) return 0;
    return parseInt(element.value.replace(/,/g, '')) || 0;
  }

  /**
   * Displays calculation results.
   */
  displayResults(results, mode) {
    if (this.elements.offers) {
      this.elements.offers.innerHTML = results.length > 0 ? '' : '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #999;">ไม่พบข้อเสนอที่เหมาะสม</td></tr>';
      results.forEach(result => {
        const row = document.createElement('tr');
        row.className = result.status === 'APPROVED' ? 'status-approved' : 'status-rejected';
        row.innerHTML = `
          <td><strong>${result.bankShortName}</strong></td>
          <td>${result.promotion?.title || '—'}</td>
          <td><strong>${result.interestRate?.toFixed(2) || '—'}%</strong></td>
          <td>${this.formatCurrency(result.monthlyPayment)}</td>
          <td>${this.formatCurrency(result.maxLoanAmount || result.loanAmount)}</td>
          <td>${result.dsr?.toFixed(2) || '—'}%</td>
          <td>${result.ltv?.toFixed(2) || '—'}%</td>
          <td><span class="status-${result.status.toLowerCase()}">${result.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}</span></td>
        `;
        this.elements.offers.appendChild(row);
      });
    }
    if (this.elements.exportSection) {
      this.elements.exportSection.style.display = results.length > 0 ? 'block' : 'none';
    }
    this.displaySummary(results, mode);
  }

  /**
   * Displays the summary section.
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
            <div><strong>วงเงินสูงสุด:</strong> ${this.formatCurrency(best.maxLoanAmount || best.loanAmount)}</div>
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
   * Updates statistics counts.
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

  /**
   * Sets calculation state.
   */
  setCalculatingState(calculating) {
    this.isCalculating = calculating;
    if (this.elements.btnText) {
      this.elements.btnText.textContent = calculating ? 'กำลังคำนวณ...' : '🚀 คำนวณ';
    }
    if (this.elements.btnSpinner) {
      this.elements.btnSpinner.style.display = calculating ? 'inline-block' : 'none';
    }
    if (this.elements.btnRun) {
      this.elements.btnRun.disabled = calculating;
    }
  }

  /**
   * Clears results and resets UI.
   */
  clearResults() {
    this.currentResults = [];
    if (this.elements.offers) {
      this.elements.offers.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px; color: #666;">📋 กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>';
    }
    if (this.elements.summary) {
      this.elements.summary.innerHTML = '';
    }
    ['totalOffers', 'approvedOffers', 'rejectedOffers', 'avgRate'].forEach(key => {
      if (this.elements[key]) this.elements[key].textContent = '—';
    });
    if (this.elements.exportSection) {
      this.elements.exportSection.style.display = 'none';
    }
  }

  /**
   * Saves current calculation.
   */
  async saveCalculation() {
    const user = AuthManager.getCurrentUser();
    if (!user) {
      showNotification('กรุณาเข้าสู่ระบบก่อนเพื่อบันทึกประวัติ', 'warning');
      return;
    }
    if (!this.currentResults.length) return;
    
    try {
      await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      showNotification('บันทึกการคำนวณเรียบร้อยแล้ว', 'success');
      this.loadCalculationHistory();
    } catch (error) {
      showNotification('ไม่สามารถบันทึกได้', 'error');
    }
  }

  /**
   * Loads calculation history.
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
   * Loads a past calculation.
   */
  async loadCalculationFromHistory(id) {
    const history = await DataManager.getUserCalculations(99); // Fetch a larger set to find it
    const calculation = history.find(c => c.id === id);
    if (!calculation) {
      showNotification('ไม่พบประวัติการคำนวณนี้', 'error');
      return;
    }
    this.fillFormWithData(calculation);
    this.currentResults = calculation.results.calculationResults;
    this.displayResults(this.currentResults, calculation.calculation_mode);
    this.updateStatistics(this.currentResults);
    showNotification('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว', 'success');
  }

  /**
   * Fills form inputs with data.
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
  }

  /**
   * Clears all calculation history.
   */
  async clearCalculationHistory() {
    if (confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) {
      try {
        await DataManager.clearUserCalculations();
        showNotification('ล้างประวัติเรียบร้อยแล้ว', 'success');
        this.loadCalculationHistory();
      } catch (error) {
        showNotification('ไม่สามารถล้างประวัติได้', 'error');
      }
    }
  }

  /**
   * Exports results to CSV.
   */
  exportToCSV() {
    if (!this.currentResults.length) return;
    const csv = LoanCalculator.exportToCSV(this.currentResults);
    this.downloadFile(csv, 'loan-calculation.csv', 'text/csv');
  }

  /**
   * Exports results to JSON.
   */
  exportToJSON() {
    if (!this.currentResults.length) return;
    const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
    this.downloadFile(json, 'loan-calculation.json', 'application/json');
  }

  /**
   * Downloads a file.
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

  /**
   * Formats a number as Thai currency.
   */
  formatCurrency(amount) {
    if (!amount || amount === 0) return '—';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(amount);
  }
}

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new LoanAppManager();
  app.initialize();
  window.loanApp = app; // For debugging
});