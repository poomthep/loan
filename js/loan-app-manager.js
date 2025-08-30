// js/loan-app-manager.js
// ========================================
// LOAN APP MANAGER - MAIN CONTROLLER
// ========================================

import DataManager from './data-manager.js';
import LoanCalculator from './loan-calculator-supabase.js';

/* รอให้ window.AuthManager จากไฟล์ auth-manager.js พร้อมใช้งาน */
async function waitForAuthManager(timeoutMs = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' &&
        window.AuthManager &&
        typeof window.AuthManager.initialize === 'function') {
      return window.AuthManager;
    }
    await new Promise(res => setTimeout(res, 50));
  }
  throw new Error('AuthManager ยังไม่พร้อม');
}

class LoanAppManager {
  constructor() {
    this.auth = null;
    this.calculator = new LoanCalculator();
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;

    this.elements = {};
    this.bindElements();
  }

  // -------------------- INIT --------------------
  async initialize() {
    try {
      console.log('🚀 Initializing Loan App...');

      // รอและผูก AuthManager จาก window
      this.auth = await waitForAuthManager(10000);
      await this.auth.initialize();

      this.setupEventListeners();

      const connected = await DataManager.checkDatabaseConnection();
      this.updateConnectionStatus(connected);

      this.setupRealTimeUpdates();

      await this.loadInitialData();
      await this.loadCalculationHistory();

      console.log('✅ Loan App initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Loan App:', error);
      this.showNotification('ไม่สามารถเริ่มต้นแอปได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  bindElements() {
    this.elements = {
      // Form
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

      // Display
      summary: document.getElementById('caps'),
      offers: document.getElementById('offers'),
      note: document.getElementById('note'),

      // Stats
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),

      // Status
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
      lastUpdated: document.getElementById('last-updated'),

      // History
      calculationHistory: document.getElementById('calculation-history'),
      historyList: document.getElementById('history-list'),

      // UI bits
      btnText: document.getElementById('btn-text'),
      btnSpinner: document.getElementById('btn-spinner'),
      blockLoan: document.getElementById('block-loan'),
      sortInfo: document.getElementById('sort-info')
    };
  }

  setupEventListeners() {
    this.elements.modeRadios.forEach(r => {
      r.addEventListener('change', () => this.handleModeChange());
    });

    this.elements.product?.addEventListener('change', () => this.loadInitialData());
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    this.setupFormValidation();
    this.setupKeyboardShortcuts();
  }

  setupRealTimeUpdates() {
    this.calculator.setupRealTimeUpdates(changeType => {
      console.log(`📡 Data updated: ${changeType}`);
      this.showNotification(`ข้อมูล${this.getChangeTypeText(changeType)}มีการอัพเดต`, 'info');
      this.loadInitialData();
      if (this.currentResults.length > 0) {
        this.showNotification('กำลังคำนวณใหม่ด้วยข้อมูลล่าสุด...', 'info');
        setTimeout(() => this.runCalculation(), 800);
      }
    });
  }

  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';
      const [banks, promotions] = await Promise.all([
        DataManager.getBanks(),
        DataManager.getActivePromotions(productType)
      ]);

      if (this.elements.banksCount) this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.lastUpdated) this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (e) {
      console.error('Error loading initial data:', e);
    }
  }

  // -------------------- FORM --------------------
  handleModeChange() {
    const selected = document.querySelector('input[name="mode"]:checked')?.value;
    if (this.elements.blockLoan) this.elements.blockLoan.style.display = selected === 'check' ? 'block' : 'none';
    if (this.elements.sortInfo) {
      this.elements.sortInfo.textContent = selected === 'check'
        ? '(เรียงตาม DSR ต่ำสุด)'
        : '(เรียงตามวงเงินสูงสุด)';
    }
    this.clearResults();
  }

  setupFormValidation() {
    const numericInputs = [
      this.elements.income, this.elements.debt, this.elements.incomeExtra,
      this.elements.age, this.elements.years, this.elements.property, this.elements.loanAmount
    ];

    numericInputs.forEach(input => {
      if (!input) return;
      input.addEventListener('input', e => {
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
      });
      input.addEventListener('blur', e => {
        const v = parseInt(e.target.value) || 0;
        if (v > 0 && input !== this.elements.age && input !== this.elements.years) {
          e.target.dataset.rawValue = v;
          e.target.value = v.toLocaleString();
        }
      });
      input.addEventListener('focus', e => {
        if (e.target.dataset.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', e => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Enter') { e.preventDefault(); this.runCalculation(); }
      if (e.key === 's')     { e.preventDefault(); this.saveCalculation(); }
      if (e.key === 'e')     { e.preventDefault(); this.exportToCSV(); }
    });
  }

  // -------------------- CALC --------------------
  async runCalculation() {
    if (this.isCalculating) { this.showNotification('กำลังคำนวณอยู่ กรุณารอสักครู่', 'warning'); return; }

    try {
      const params = this.getFormParameters();
      if (!this.validateParameters(params)) return;

      this.setCalculatingState(true);
      this.clearResults();

      const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
      let results = [];

      if (mode === 'max') results = await this.calculator.calculateMaxLoanAmount(params);
      else results = await this.calculator.checkLoanAmount(params);

      this.currentResults = results;
      this.currentParams = { ...params, calculationMode: mode };

      this.displayResults(results, mode);
      this.updateStatistics(results);

      if (results.length > 0) {
        await this.calculator.saveCalculation(params, results, mode);
        this.loadCalculationHistory();
      }
    } catch (e) {
      console.error('❌ Calculation error:', e);
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

  getRawValue(el) {
    if (!el) return 0;
    return parseInt(el.dataset.rawValue || el.value.replace(/,/g, '')) || 0;
  }

  validateParameters(p) {
    const errs = [];
    if (p.income <= 0) errs.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errs.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errs.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if (['MORTGAGE', 'REFINANCE'].includes(p.productType) && p.propertyValue <= 0) {
      errs.push('กรุณากรอกมูลค่าหลักประกัน');
    }
    const mode = document.querySelector('input[name="mode"]:checked')?.value;
    if (mode === 'check' && p.loanAmount <= 0) errs.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errs.length) { this.showNotification(errs.join('<br/>'), 'error'); return false; }
    return true;
  }

  // -------------------- DISPLAY --------------------
  displayResults(results, mode) {
    if (!results || results.length === 0) { this.displayNoResults(); return; }
    this.displayResultsTable(results, mode);
    this.displaySummary(results, mode);
    this.showExportOptions(true);
  }

  displayResultsTable(results) {
    const tbody = this.elements.offers;
    if (!tbody) return;
    tbody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = r.status === 'APPROVED' ? 'status-approved' : 'status-rejected';
      tr.innerHTML = `
        <td>
          <strong>${r.bankShortName}</strong>
          <div style="font-size:.8em;color:#666">${r.bankName}</div>
        </td>
        <td>
          ${r.promotion ? `
            <div class="promo-badge">${r.promotion.title}</div>
            <div style="font-size:.8em;color:#666;margin-top:4px">${r.promotion.description || ''}</div>
          ` : '<span style="color:#999">ไม่มีโปรโมชัน</span>'}
        </td>
        <td>
          <strong>${r.interestRate?.toFixed(2) || '—'}%</strong>
          ${r.promotion?.year1Rate ? `<div style="font-size:.8em;color:#666">ปี 1: ${r.promotion.year1Rate}%</div>` : ''}
        </td>
        <td><strong>${this.formatCurrency(r.monthlyPayment)}</strong></td>
        <td><strong>${this.formatCurrency(r.maxLoanAmount || r.loanAmount)}</strong></td>
        <td><span class="${r.dsr > 70 ? 'text-warning' : 'text-success'}">${r.dsr?.toFixed(2) || '—'}%</span></td>
        <td><span class="${r.ltv > 90 ? 'text-warning' : 'text-success'}">${r.ltv?.toFixed(2) || '—'}%</span></td>
        <td>
          <span class="status-${String(r.status || '').toLowerCase()}">
            ${r.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}
          </span>
          ${r.reasons ? `<div style="font-size:.8em;color:#dc3545;margin-top:2px">${r.reasons}</div>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  displaySummary(results, mode) {
    const box = this.elements.summary;
    if (!box) return;

    const approved = results.filter(r => r.status === 'APPROVED');
    const best = approved[0];

    if (!best) {
      box.innerHTML = `
        <div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5">
          <h4 style="color:#dc3545">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4>
          <p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p>
        </div>`;
      return;
    }

    box.innerHTML = (mode === 'max')
      ? `
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
      </div>`
      : `
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
      </div>`;
  }

  displayNoResults() {
    if (this.elements.offers) {
      this.elements.offers.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:20px;color:#666">
          ไม่พบข้อเสนอที่เหมาะสม กรุณาตรวจสอบข้อมูลและลองใหม่
        </td></tr>`;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    this.showExportOptions(false);
  }

  updateStatistics(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(x => x > 0);
    const avg = rates.length ? (rates.reduce((s, x) => s + x, 0) / rates.length) : 0;

    if (this.elements.totalOffers) this.elements.totalOffers.textContent = results.length;
    if (this.elements.approvedOffers) this.elements.approvedOffers.textContent = approved.length;
    if (this.elements.rejectedOffers) this.elements.rejectedOffers.textContent = rejected.length;
    if (this.elements.avgRate) this.elements.avgRate.textContent = avg ? avg.toFixed(2) : '—';
  }

  // -------------------- HISTORY --------------------
  async loadCalculationHistory() {
    try {
      const history = await DataManager.getUserCalculations(10);
      if (history?.length) {
        this.displayCalculationHistory(history);
        if (this.elements.calculationHistory) this.elements.calculationHistory.style.display = 'block';
      } else if (this.elements.calculationHistory) {
        this.elements.calculationHistory.style.display = 'none';
      }
    } catch (e) {
      console.error('Error loading calculation history:', e);
    }
  }

  displayCalculationHistory(list) {
    const wrap = this.elements.historyList;
    if (!wrap) return;
    wrap.innerHTML = '';
    list.forEach(item => {
      const div = document.createElement('div');
      div.className = 'history-item';
      const date = new Date(item.created_at).toLocaleString('th-TH');
      const prod = this.getProductTypeText(item.product_type);
      const modeText = item.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';
      div.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${prod}</strong> - ${modeText}
            <div style="font-size:.8em;color:#666;margin-top:2px">
              รายได้: ${this.formatCurrency(item.income)}
              ${item.loan_amount ? `| วงเงิน: ${this.formatCurrency(item.loan_amount)}` : ''}
            </div>
          </div>
          <div style="font-size:.8em;color:#999">${date}</div>
        </div>`;
      div.addEventListener('click', () => this.loadCalculationFromHistory(item));
      wrap.appendChild(div);
    });
  }

  loadCalculationFromHistory(c) {
    if (this.elements.product) this.elements.product.value = c.product_type;
    if (this.elements.income) this.elements.income.value = c.income;
    if (this.elements.debt) this.elements.debt.value = c.debt;
    if (this.elements.incomeExtra) this.elements.incomeExtra.value = c.income_extra;
    if (this.elements.age) this.elements.age.value = c.age;
    if (this.elements.years) this.elements.years.value = c.tenure_years;
    if (this.elements.property) this.elements.property.value = c.property_value;
    if (this.elements.propertyType) this.elements.propertyType.value = c.property_type || '';
    if (this.elements.homeNumber) this.elements.homeNumber.value = c.home_number || '';
    if (this.elements.loanAmount) this.elements.loanAmount.value = c.loan_amount;

    const r = document.querySelector(`input[name="mode"][value="${c.calculation_mode}"]`);
    if (r) { r.checked = true; this.handleModeChange(); }

    if (c.results?.calculationResults) {
      this.currentResults = c.results.calculationResults;
      this.displayResults(this.currentResults, c.calculation_mode);
      this.updateStatistics(this.currentResults);
    }
    this.showNotification('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว', 'success');
  }

  async clearCalculationHistory() {
    if (!confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;
    if (this.elements.calculationHistory) this.elements.calculationHistory.style.display = 'none';
    this.showNotification('ล้างประวัติเรียบร้อยแล้ว', 'info');
  }

  // -------------------- EXPORT/SAVE --------------------
  async saveCalculation() {
    if (!this.currentResults.length) { this.showNotification('ไม่มีผลการคำนวณให้บันทึก', 'warning'); return; }
    try {
      await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      this.showNotification('บันทึกการคำนวณเรียบร้อยแล้ว', 'success');
      this.loadCalculationHistory();
    } catch {
      this.showNotification('ไม่สามารถบันทึกได้ กรุณาลองใหม่อีกครั้ง', 'error');
    }
  }

  exportToCSV() {
    if (!this.currentResults.length) { this.showNotification('ไม่มีข้อมูลให้ export', 'warning'); return; }
    try {
      const csv = LoanCalculator.exportToCSV(this.currentResults);
      this.downloadFile(csv, 'loan-calculation.csv', 'text/csv');
      this.showNotification('Export CSV เรียบร้อยแล้ว', 'success');
    } catch { this.showNotification('ไม่สามารถ export ได้', 'error'); }
  }

  exportToJSON() {
    if (!this.currentResults.length) { this.showNotification('ไม่มีข้อมูลให้ export', 'warning'); return; }
    try {
      const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
      this.downloadFile(json, 'loan-calculation.json', 'application/json');
      this.showNotification('Export JSON เรียบร้อยแล้ว', 'success');
    } catch { this.showNotification('ไม่สามารถ export ได้', 'error'); }
  }

  downloadFile(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click();
    document.body.removeChild(a); URL.revokeObjectURL(url);
  }

  // -------------------- UTILS --------------------
  setCalculatingState(flag) {
    this.isCalculating = flag;
    if (this.elements.btnText) this.elements.btnText.textContent = flag ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.elements.btnSpinner) this.elements.btnSpinner.style.display = flag ? 'inline-block' : 'none';
    if (this.elements.btnRun) this.elements.btnRun.disabled = flag;
  }

  clearResults() {
    this.currentResults = [];
    if (this.elements.offers) {
      this.elements.offers.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:20px;color:#666">
          กรุณาคำนวณเพื่อดูข้อเสนอ
        </td></tr>`;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    ['totalOffers','approvedOffers','rejectedOffers','avgRate'].forEach(k => {
      if (this.elements[k]) this.elements[k].textContent = '—';
    });
    this.showExportOptions(false);
  }

  showExportOptions(show) {
    [this.elements.btnSave, this.elements.btnExportCSV, this.elements.btnExportJSON]
      .forEach(btn => { if (btn) btn.style.display = show ? 'inline-block' : 'none'; });
  }

  updateConnectionStatus(ok) {
    if (!this.elements.connectionStatus) return;
    if (ok) {
      this.elements.connectionStatus.innerHTML = '🟢 เชื่อมต่อแล้ว';
      this.elements.connectionStatus.style.color = '#28a745';
    } else {
      this.elements.connectionStatus.innerHTML = '🔴 ไม่สามารถเชื่อมต่อได้';
      this.elements.connectionStatus.style.color = '#dc3545';
    }
  }

  showNotification(msg, type = 'info', duration = 4000) {
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.innerHTML = msg;
    (document.getElementById('notification-area') || document.body).appendChild(n);
    setTimeout(() => { try { n.remove(); } catch {} }, duration);
    n.addEventListener('click', () => { try { n.remove(); } catch {} });
  }

  formatCurrency(amount) {
    if (!amount) return '—';
    return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0 }).format(amount);
    }

  getProductTypeText(t) {
    const map = { MORTGAGE: 'สินเชื่อบ้าน', REFINANCE: 'รีไฟแนนซ์', PERSONAL: 'สินเชื่อส่วนบุคคล', SME: 'สินเชื่อ SME' };
    return map[t] || t;
  }

  getChangeTypeText(t) {
    const map = { promotions: 'โปรโมชัน', rules: 'กฎเกณฑ์', rates: 'อัตราดอกเบี้ย' };
    return map[t] || t;
  }

  // -------------------- CLEANUP --------------------
  cleanup() {
    try { this.calculator?.cleanup?.(); } catch {}
    try { this.auth?.cleanup?.(); } catch {}
    try { DataManager?.clearAllCache?.(); } catch {}
    this.removeEventListeners();
    console.log('🧹 Loan App cleaned up');
  }

  removeEventListeners() {
    // หากมีการเก็บ reference listeners ไว้ ให้ลบที่นี่
    this.elements = {};
  }
}

// -------------------- Backward compat --------------------
export function runLoanPage() {
  console.warn('runLoanPage() is deprecated. Use LoanAppManager instead.');
  const app = new LoanAppManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
  } else {
    app.initialize();
  }
  window.loanApp = app;
  return app;
}

// Auto cleanup
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (window.loanApp?.cleanup) window.loanApp.cleanup();
  });
}

// -------------------- EXPORTS --------------------
export { LoanAppManager };
export default LoanAppManager;
