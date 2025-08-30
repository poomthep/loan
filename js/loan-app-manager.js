// js/loan-app-manager.js
// ========================================
// LOAN APP MANAGER - MAIN CONTROLLER
// ========================================

/** ===== ใช้ AuthManager แบบ global ไม่ import ===== */
const AM = (typeof window !== 'undefined' && window.AuthManager)
  ? window.AuthManager
  : null;

function getAM() {
  if (AM) return AM;
  if (typeof window !== 'undefined' && window.AuthManager) return window.AuthManager;
  throw new Error('AuthManager ยังไม่พร้อม');
}

/** ===== Data Layer: รองรับทุกแบบของ data-manager.fix.js ===== */
import * as DM from './data-manager.fix.js';
const DataManager = DM.default || DM.DataManager || DM;

/** Calculator (เวอร์ชันใหม่ที่คุณใช้) */
import LoanCalculator from './loan-calculator-supabase.js';

/**
 * จัดการแอปพลิเคชันหลักสำหรับการคำนวณสินเชื่อ
 */
class LoanAppManager {
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

      // Initialize authentication (global)
      await getAM().initialize();

      // Setup UI event listeners
      this.setupEventListeners();

      // Check database connection
      const connected = await (DataManager.checkDatabaseConnection
        ? DataManager.checkDatabaseConnection()
        : Promise.resolve(true));
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

      // Statistics
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),

      // Status elements
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
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
    // Mode selection
    this.elements.modeRadios.forEach(radio => {
      radio.addEventListener('change', () => this.handleModeChange());
    });

    // Product type change
    this.elements.product?.addEventListener('change', () => {
      this.loadInitialData();
    });

    // Calculate button
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());

    // Export buttons
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());

    // History management
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    // Form validation
    this.setupFormValidation();

    // Keyboard shortcuts
    this.setupKeyboardShortcuts();
  }

  /**
   * ตั้งค่า Real-time updates
   */
  setupRealTimeUpdates() {
    this.calculator.setupRealTimeUpdates((changeType) => {
      console.log(`📡 Data updated: ${changeType}`);
      this.showNotification(`ข้อมูล${this.getChangeTypeText(changeType)}มีการอัพเดต`, 'info');

      // Reload data counts
      this.loadInitialData();

      // Re-calculate if we have current results
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

      // Load data counts for display
      const [banks, promotions] = await Promise.all([
        DataManager.getBanks(),
        DataManager.getActivePromotions(productType)
      ]);

      if (this.elements.banksCount) {
        this.elements.banksCount.textContent = banks.length;
      }
      if (this.elements.promotionsCount) {
        this.elements.promotionsCount.textContent = promotions.length;
      }
      if (this.elements.lastUpdated) {
        this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  // ========================================
  // FORM HANDLING
  // ========================================

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

    // Clear previous results
    this.clearResults();
  }

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
        if (value > 0 && input !== this.elements.age && input !== this.elements.years) {
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

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case 'Enter':
            e.preventDefault();
            this.runCalculation();
            break;
          case 's':
            e.preventDefault();
            this.saveCalculation();
            break;
          case 'e':
            e.preventDefault();
            this.exportToCSV();
            break;
        }
      }
    });
  }

  // ========================================
  // CALCULATION LOGIC
  // ========================================

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
        await this.calculator.saveCalculation(params, results, selectedMode);
        this.loadCalculationHistory(); // Refresh history
      }

      console.log('✅ Calculation completed:', results.length, 'offers');
    } catch (error) {
      console.error('❌ Calculation error:', error);
      this.showNotification('เกิดข้อผิดพลาดในการคำนวณ กรุณาลองใหม่อีกครั้ง', 'error');
    } finally {
      this.setCalculatingState(false);
    }
  }

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

  getRawValue(element) {
    if (!element) return 0;
    return parseInt(element.dataset.rawValue || element.value.replace(/,/g, '')) || 0;
  }

  validateParameters(params) {
    const errors = [];

    if (params.income <= 0) {
      errors.push('กรุณากรอกรายได้');
    }
    if (params.age < 18 || params.age > 80) {
      errors.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    }
    if (params.years < 1 || params.years > 35) {
      errors.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
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

  displayResults(results, mode) {
    if (!results || results.length === 0) {
      this.displayNoResults();
      return;
    }

    this.displayResultsTable(results, mode);
    this.displaySummary(results, mode);
    this.showExportOptions(true);
  }

  displayResultsTable(results, mode) {
    if (!this.elements.offers) return;

    const tbody = this.elements.offers;
    tbody.innerHTML = '';

    results.forEach(result => {
      const row = document.createElement('tr');
      row.className = result.status === 'APPROVED' ? 'status-approved' : 'status-rejected';

      row.innerHTML = `
        <td>
          <strong>${result.bankShortName}</strong>
          <div style="font-size: 0.8em; color: #666;">${result.bankName}</div>
        </td>
        <td>
          ${result.promotion ? `
            <div class="promo-badge">${result.promotion.title}</div>
            <div style="font-size: 0.8em; color: #666; margin-top: 4px;">
              ${result.promotion.description || ''}
            </div>
          ` : '<span style="color: #999;">ไม่มีโปรโมชัน</span>'}
        </td>
        <td>
          <strong>${result.interestRate?.toFixed(2) || '—'}%</strong>
          ${result.promotion?.year1Rate ? `
            <div style="font-size: 0.8em; color: #666;">
              ปี 1: ${result.promotion.year1Rate}%
            </div>
          ` : ''}
        </td>
        <td>
          <strong>${this.formatCurrency(result.monthlyPayment)}</strong>
        </td>
        <td>
          <strong>${this.formatCurrency(result.maxLoanAmount || result.loanAmount)}</strong>
        </td>
        <td>
          <span class="${result.dsr > 70 ? 'text-warning' : 'text-success'}">
            ${result.dsr?.toFixed(2) || '—'}%
          </span>
        </td>
        <td>
          <span class="${result.ltv > 90 ? 'text-warning' : 'text-success'}">
            ${result.ltv?.toFixed(2) || '—'}%
          </span>
        </td>
        <td>
          <span class="status-${result.status.toLowerCase()}">
            ${result.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}
          </span>
          ${result.reasons ? `<div style="font-size: 0.8em; color: #dc3545; margin-top: 2px;">${result.reasons}</div>` : ''}
        </td>
      `;

      tbody.appendChild(row);
    });
  }

  displaySummary(results, mode) {
    if (!this.elements.summary) return;

    const approved = results.filter(r => r.status === 'APPROVED');
    const best = approved.length > 0 ? approved[0] : null;

    if (best) {
      const summaryHTML = mode === 'max' ? `
        <div class="summary-highlight">
          <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
          <div class="summary-grid">
            <div><strong>วงเงินสูงสุด:</strong> ${this.formatCurrency(best.maxLoanAmount)}</div>
            <div><strong>ค่างวด/เดือน:</strong> ${this.formatCurrency(best.monthlyPayment)}</div>
            <div><strong>อัตราดอกเบี้ย:</strong> ${best.interestRate?.toFixed(2)}%</div>
            <div><strong>DSR:</strong> ${best.dsr?.toFixed(2)}%</div>
            <div><strong>LTV:</strong> ${best.ltv?.toFixed(2)}%</div>
            ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>` : ''}
          </div>
        </div>
      ` : `
        <div class="summary-highlight">
          <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
          <div class="summary-grid">
            <div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>
            <div><strong>ค่างวด/เดือน:</strong> ${this.formatCurrency(best.monthlyPayment)}</div>
            <div><strong>อัตราดอกเบี้ย:</strong> ${best.interestRate?.toFixed(2)}%</div>
            <div><strong>DSR:</strong> ${best.dsr?.toFixed(2)}%</div>
            <div><strong>LTV:</strong> ${best.ltv?.toFixed(2)}%</div>
            ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>` : ''}
          </div>
        </div>
      `;
      this.elements.summary.innerHTML = summaryHTML;
    } else {
      this.elements.summary.innerHTML = `
        <div class="summary-highlight" style="border-color: #dc3545; background: #fff5f5;">
          <h4 style="color: #dc3545;">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4>
          <p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p>
        </div>
      `;
    }
  }

  displayNoResults() {
    if (this.elements.offers) {
      this.elements.offers.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 20px; color: #999;">
            ไม่พบข้อเสนอที่เหมาะสม กรุณาตรวจสอบข้อมูลและลองใหม่
          </td>
        </tr>
      `;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    this.showExportOptions(false);
  }

  updateStatistics(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(r => r > 0);
    const avgRate = rates.length > 0 ? rates.reduce((s, v) => s + v, 0) / rates.length : 0;

    if (this.elements.totalOffers) this.elements.totalOffers.textContent = results.length;
    if (this.elements.approvedOffers) this.elements.approvedOffers.textContent = approved.length;
    if (this.elements.rejectedOffers) this.elements.rejectedOffers.textContent = rejected.length;
    if (this.elements.avgRate) this.elements.avgRate.textContent = avgRate > 0 ? avgRate.toFixed(2) : '—';
  }

  // ========================================
  // CALCULATION HISTORY
  // ========================================

  async loadCalculationHistory() {
    try {
      if (!DataManager.getUserCalculations) {
        this.elements.calculationHistory?.style && (this.elements.calculationHistory.style.display = 'none');
        return;
      }
      const history = await DataManager.getUserCalculations(10);

      if (history.length > 0) {
        this.displayCalculationHistory(history);
        if (this.elements.calculationHistory) this.elements.calculationHistory.style.display = 'block';
      } else {
        if (this.elements.calculationHistory) this.elements.calculationHistory.style.display = 'none';
      }
    } catch (error) {
      console.error('Error loading calculation history:', error);
    }
  }

  displayCalculationHistory(history) {
    if (!this.elements.historyList) return;
    this.elements.historyList.innerHTML = '';

    history.forEach(calculation => {
      const item = document.createElement('div');
      item.className = 'history-item';

      const date = new Date(calculation.created_at).toLocaleString('th-TH');
      const productTypeText = this.getProductTypeText(calculation.product_type);
      const modeText = calculation.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';

      item.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <strong>${productTypeText}</strong> - ${modeText}
            <div style="font-size: 0.8em; color: #666; margin-top: 2px;">
              รายได้: ${this.formatCurrency(calculation.income)}
              ${calculation.loan_amount ? `| วงเงิน: ${this.formatCurrency(calculation.loan_amount)}` : ''}
            </div>
          </div>
          <div style="font-size: 0.8em; color: #999;">${date}</div>
        </div>
      `;

      item.addEventListener('click', () => this.loadCalculationFromHistory(calculation));
      this.elements.historyList.appendChild(item);
    });
  }

  loadCalculationFromHistory(calculation) {
    if (this.elements.product) this.elements.product.value = calculation.product_type;
    if (this.elements.income) this.elements.income.value = calculation.income;
    if (this.elements.debt) this.elements.debt.value = calculation.debt;
    if (this.elements.incomeExtra) this.elements.incomeExtra.value = calculation.income_extra;
    if (this.elements.age) this.elements.age.value = calculation.age;
    if (this.elements.years) this.elements.years.value = calculation.tenure_years;
    if (this.elements.property) this.elements.property.value = calculation.property_value;
    if (this.elements.propertyType) this.elements.propertyType.value = calculation.property_type || '';
    if (this.elements.homeNumber) this.elements.homeNumber.value = calculation.home_number || '';
    if (this.elements.loanAmount) this.elements.loanAmount.value = calculation.loan_amount;

    const modeRadio = document.querySelector(`input[name="mode"][value="${calculation.calculation_mode}"]`);
    if (modeRadio) {
      modeRadio.checked = true;
      this.handleModeChange();
    }

    if (calculation.results?.calculationResults) {
      this.currentResults = calculation.results.calculationResults;
      this.displayResults(this.currentResults, calculation.calculation_mode);
      this.updateStatistics(this.currentResults);
    }

    this.showNotification('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว', 'success');
  }

  async clearCalculationHistory() {
    if (!confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;

    try {
      this.elements.calculationHistory.style.display = 'none';
      this.showNotification('ล้างประวัติเรียบร้อยแล้ว', 'info');
    } catch (error) {
      this.showNotification('ไม่สามารถล้างประวัติได้', 'error');
    }
  }

  // ========================================
  // EXPORT FUNCTIONS
  // ========================================

  async saveCalculation() {
    if (!this.currentResults.length) {
      this.showNotification('ไม่มีผลการคำนวณให้บันทึก', 'warning');
      return;
    }

    try {
      await this.calculator.saveCalculation(
        this.currentParams,
        this.currentResults,
        this.currentParams.calculationMode
      );

      this.showNotification('บันทึกการคำนวณเรียบร้อยแล้ว', 'success');
      this.loadCalculationHistory();
    } catch (error) {
      this.showNotification('ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  exportToCSV() {
    if (!this.currentResults.length) {
      this.showNotification('ไม่มีข้อมูลให้ export', 'warning');
      return;
    }
    try {
      const csv = LoanCalculator.exportToCSV(this.currentResults);
      this.downloadFile(csv, 'loan-calculation.csv', 'text/csv');
      this.showNotification('Export CSV เรียบร้อยแล้ว', 'success');
    } catch (error) {
      this.showNotification('ไม่สามารถ export ได้', 'error');
    }
  }

  exportToJSON() {
    if (!this.currentResults.length) {
      this.showNotification('ไม่มีข้อมูลให้ export', 'warning');
      return;
    }
    try {
      const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
      this.downloadFile(json, 'loan-calculation.json', 'application/json');
      this.showNotification('Export JSON เรียบร้อยแล้ว', 'success');
    } catch (error) {
      this.showNotification('ไม่สามารถ export ได้', 'error');
    }
  }

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

  setCalculatingState(calculating) {
    this.isCalculating = calculating;

    if (this.elements.btnText) {
      this.elements.btnText.textContent = calculating ? 'กำลังคำนวณ...' : 'คำนวณ';
    }
    if (this.elements.btnSpinner) {
      this.elements.btnSpinner.style.display = calculating ? 'inline-block' : 'none';
    }
    if (this.elements.btnRun) {
      this.elements.btnRun.disabled = calculating;
    }
  }

  clearResults() {
    this.currentResults = [];

    if (this.elements.offers) {
      this.elements.offers.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 20px; color: #666;">
            กรุณาคำนวณเพื่อดูข้อเสนอ
          </td>
        </tr>
      `;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';

    ['totalOffers', 'approvedOffers', 'rejectedOffers', 'avgRate'].forEach(key => {
      if (this.elements[key]) this.elements[key].textContent = '—';
    });

    this.showExportOptions(false);
  }

  showExportOptions(show) {
    const exportButtons = [
      this.elements.btnSave,
      this.elements.btnExportCSV,
      this.elements.btnExportJSON
    ];
    exportButtons.forEach(btn => {
      if (btn) btn.style.display = show ? 'inline-block' : 'none';
    });
  }

  updateConnectionStatus(connected) {
    if (!this.elements.connectionStatus) return;

    if (connected) {
      this.elements.connectionStatus.innerHTML = '🟢 เชื่อมต่อแล้ว';
      this.elements.connectionStatus.style.color = '#28a745';
    } else {
      this.elements.connectionStatus.innerHTML = '🔴 ไม่สามารถเชื่อมต่อได้';
      this.elements.connectionStatus.style.color = '#dc3545';
    }
  }

  showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.innerHTML = message;

    const notificationArea = document.getElementById('notification-area') || document.body;
    notificationArea.appendChild(notification);

    setTimeout(() => {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
    }, duration);

    notification.addEventListener('click', () => {
      if (notification.parentNode) notification.parentNode.removeChild(notification);
    });
  }

  formatCurrency(amount) {
    if (!amount || amount === 0) return '—';
    return new Intl.NumberFormat('th-TH', {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  }

  getProductTypeText(productType) {
    const types = {
      'MORTGAGE': 'สินเชื่อบ้าน',
      'REFINANCE': 'รีไฟแนนซ์',
      'PERSONAL': 'สินเชื่อส่วนบุคคล',
      'SME': 'สินเชื่อ SME'
    };
    return types[productType] || productType;
  }

  getChangeTypeText(changeType) {
    const types = {
      'promotions': 'โปรโมชัน',
      'rules': 'กฎเกณฑ์',
      'rates': 'อัตราดอกเบี้ย'
    };
    return types[changeType] || changeType;
  }

  // ========================================
  // CLEANUP
  // ========================================

  cleanup() {
    // Cleanup calculator subscriptions
    this.calculator.cleanup();

    // Cleanup auth manager
    getAM().cleanup?.();

    // Clear cache
    DataManager.clearAllCache?.();

    // Remove event listeners (ที่นี่เราล้างอ้างอิงไว้ก่อน)
    this.elements = {};

    console.log('🧹 Loan App cleaned up');
  }
}

// ========================================
// UTILITY FUNCTIONS FOR BACKWARD COMPATIBILITY
// ========================================

// ========================================
// EXPORT
// ========================================
export { LoanAppManager };        // named export
export default LoanAppManager;    // default export


// ========================================
// AUTO CLEANUP ON PAGE UNLOAD
// ========================================
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (window.loanApp && typeof window.loanApp.cleanup === 'function') {
      window.loanApp.cleanup();
    }
  });
}
