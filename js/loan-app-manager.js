// js/loan-app-manager.js
// ========================================
// LOAN APP MANAGER - MAIN CONTROLLER (SAFE BUILD)
// - ใช้ window.AuthManager แทนการ import
// - ป้องกันการประกาศซ้ำด้วยเนมสเปซส่วนตัว
// - รองรับ DataManager ทั้ง default และ named export
// ========================================

import * as DataManagerNS from './data-manager.fix.js';
import LoanCalculator from './loan-calculator-supabase.js';

// ---- helpers: isolate to avoid re-declare ----
(function (global) {
  if (!global.__loanHelpers) {
    const getAM = () => (global && global.AuthManager) ? global.AuthManager : null;

    const waitForAuthManager = async (maxWaitMs = 8000, intervalMs = 120) => {
      const start = Date.now();
      while (Date.now() - start < maxWaitMs) {
        const am = getAM();
        if (am && typeof am.initialize === 'function') return am;
        await new Promise(r => setTimeout(r, intervalMs));
      }
      console.warn('[LoanApp] AuthManager not found; continue as GUEST.');
      return null;
    };

    // UI toast แบบเบา ๆ
    const toast = (message, type = 'info', duration = 3500) => {
      const colors = {
        success: 'background:#e8f7ee;color:#0f7a3a;border:1px solid #bfe9cf',
        error:   'background:#ffecec;color:#b00020;border:1px solid #ffb3b3',
        info:    'background:#eef5ff;color:#0a4b9e;border:1px solid #cbdcff',
        warning: 'background:#fff8e1;color:#8d6200;border:1px solid #ffe7a3'
      };
      const box = document.createElement('div');
      box.setAttribute('style',
        `position:fixed;right:16px;top:16px;z-index:9999;padding:10px 12px;border-radius:10px;font:13px/1.4 system-ui,Segoe UI,Arial;${colors[type]||colors.info}`);
      box.innerHTML = message;
      document.body.appendChild(box);
      setTimeout(() => box.remove(), duration);
    };

    global.__loanHelpers = { getAM, waitForAuthManager, toast };
  }
})(window);

const { getAM, waitForAuthManager, toast } = window.__loanHelpers;

// ให้ใช้งาน DataManager ได้ทั้งแบบ default และ named
const DM = (DataManagerNS && DataManagerNS.default) ? DataManagerNS.default : DataManagerNS;

// ========================================
// MAIN CLASS
// ========================================
export default class LoanAppManager {
  constructor() {
    this.calculator = new LoanCalculator();
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;
    this.elements = {};
  }

  // ---------------------------
  // INIT
  // ---------------------------
  async initialize() {
    try {
      console.log('🚀 Initializing Loan App...');
      this.bindElements();

      // รอ AuthManager (ไม่ throw หากไม่มี)
      const AM = await waitForAuthManager();
      if (AM) {
        try { await AM.initialize(); } catch (e) { console.warn('Auth init warning:', e); }
      }

      this.setupEventListeners();

      // ตรวจ DB (ถ้ามีฟังก์ชัน)
      const connected = (DM && typeof DM.checkDatabaseConnection === 'function')
        ? await DM.checkDatabaseConnection().catch(() => false)
        : true;
      this.updateConnectionStatus(connected);

      // ตั้งค่า real-time updates (ผ่าน calculator)
      this.setupRealTimeUpdates();

      // โหลดข้อมูลเบื้องต้น
      await this.loadInitialData();

      // ประวัติการคำนวณ
      await this.loadCalculationHistory();

      console.log('✅ Loan App initialized');

    } catch (err) {
      console.error('❌ Failed to initialize Loan App:', err);
      toast('ไม่สามารถเริ่มต้นแอปได้ กรุณารีเฟรชหน้าอีกครั้ง', 'error');
    }
  }

  bindElements() {
    this.elements = {
      // ฟอร์ม
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

      // ปุ่ม
      btnRun: document.getElementById('btn-run'),
      btnSave: document.getElementById('btn-save-calculation'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // แสดงผล
      summary: document.getElementById('caps'),
      offers: document.getElementById('offers'),
      note: document.getElementById('note'),

      // สถิติ
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),

      // สถานะ
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
      lastUpdated: document.getElementById('last-updated'),

      // ประวัติ
      calculationHistory: document.getElementById('calculation-history'),
      historyList: document.getElementById('history-list'),

      // ปุ่ม/ตัวช่วย UI
      btnText: document.getElementById('btn-text'),
      btnSpinner: document.getElementById('btn-spinner'),
      blockLoan: document.getElementById('block-loan'),
      sortInfo: document.getElementById('sort-info')
    };
  }

  setupEventListeners() {
    // เปลี่ยนโหมด
    this.elements.modeRadios.forEach(r =>
      r.addEventListener('change', () => this.handleModeChange())
    );

    // เปลี่ยนสินค้า
    this.elements.product?.addEventListener('change', () => this.loadInitialData());

    // ปุ่มคำนวณ
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());

    // ปุ่ม export
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());

    // ประวัติ
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    // validate เบื้องต้น
    this.setupFormValidation();

    // คีย์ลัด
    this.setupKeyboardShortcuts();
  }

  setupRealTimeUpdates() {
    if (typeof this.calculator?.setupRealTimeUpdates === 'function') {
      this.calculator.setupRealTimeUpdates((changeType) => {
        console.log(`📡 Data updated: ${changeType}`);
        toast(`ข้อมูลมีการอัปเดต`, 'info');
        this.loadInitialData();
        if (this.currentResults.length > 0) {
          setTimeout(() => this.runCalculation(), 600);
        }
      });
    }
  }

  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';

      const banks = (DM.getBanks)
        ? await DM.getBanks().catch(() => [])
        : [];

      const promotions = (DM.getActivePromotions)
        ? await DM.getActivePromotions(productType).catch(() => [])
        : [];

      if (this.elements.banksCount) this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.lastUpdated) this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');

    } catch (e) {
      console.warn('loadInitialData warn:', e);
    }
  }

  // ---------------------------
  // FORM & VALIDATION
  // ---------------------------
  handleModeChange() {
    const selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (this.elements.blockLoan) this.elements.blockLoan.style.display = (selectedMode === 'check') ? 'block' : 'none';
    if (this.elements.sortInfo) {
      this.elements.sortInfo.textContent = (selectedMode === 'check')
        ? '(เรียงตาม DSR ต่ำสุด)'
        : '(เรียงตามวงเงินสูงสุด)';
    }
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
        if (e.target.dataset.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    });
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 'Enter') { e.preventDefault(); this.runCalculation(); }
      if (e.key.toLowerCase() === 's') { e.preventDefault(); this.saveCalculation(); }
      if (e.key.toLowerCase() === 'e') { e.preventDefault(); this.exportToCSV(); }
    });
  }

  // ---------------------------
  // CALCULATION
  // ---------------------------
  async runCalculation() {
    if (this.isCalculating) { toast('กำลังคำนวณอยู่ กรุณารอสักครู่', 'warning'); return; }

    try {
      const params = this.getFormParameters();
      if (!this.validateParameters(params)) return;

      this.setCalculatingState(true);
      this.clearResults();

      const selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
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

      if (results.length > 0 && typeof this.calculator.saveCalculation === 'function') {
        await this.calculator.saveCalculation(params, results, selectedMode).catch(() => {});
        this.loadCalculationHistory();
      }

    } catch (err) {
      console.error('calc error:', err);
      toast('เกิดข้อผิดพลาดในการคำนวณ', 'error');
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
    return parseInt(el.dataset.rawValue || String(el.value || '').replace(/,/g, '')) || 0;
  }

  validateParameters(p) {
    const errs = [];
    if (p.income <= 0) errs.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errs.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errs.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if (['MORTGAGE','REFINANCE'].includes(p.productType) && p.propertyValue <= 0) {
      errs.push('กรุณากรอกมูลค่าหลักประกัน');
    }
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (mode === 'check' && p.loanAmount <= 0) errs.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errs.length) { toast(errs.join('<br>'), 'error', 4500); return false; }
    return true;
  }

  // ---------------------------
  // RENDER
  // ---------------------------
  displayResults(results, mode) {
    if (!results || results.length === 0) {
      this.displayNoResults();
      return;
    }
    this.displayResultsTable(results, mode);
    this.displaySummary(results, mode);
    this.showExportOptions(true);
  }

  displayResultsTable(results) {
    if (!this.elements.offers) return;
    const tbody = this.elements.offers;
    tbody.innerHTML = '';

    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = (r.status === 'APPROVED') ? 'status-approved' : 'status-rejected';
      tr.innerHTML = `
        <td>
          <strong>${r.bankShortName || '-'}</strong>
          <div style="font-size:12px;color:#666">${r.bankName || ''}</div>
        </td>
        <td>
          ${r.promotion ? `
            <div class="promo-badge">${r.promotion.title || ''}</div>
            <div style="font-size:12px;color:#666;margin-top:4px">${r.promotion.description || ''}</div>
          ` : '<span style="color:#999">ไม่มีโปรโมชัน</span>'}
        </td>
        <td>
          <strong>${(r.interestRate ?? 0).toFixed(2)}%</strong>
          ${r.promotion?.year1Rate ? `<div style="font-size:12px;color:#666">ปี 1: ${r.promotion.year1Rate}%</div>` : ''}
        </td>
        <td><strong>${this.formatCurrency(r.monthlyPayment)}</strong></td>
        <td><strong>${this.formatCurrency(r.maxLoanAmount || r.loanAmount)}</strong></td>
        <td><span class="${(r.dsr||0) > 70 ? 'text-warning':'text-success'}">${(r.dsr ?? 0).toFixed(2)}%</span></td>
        <td><span class="${(r.ltv||0) > 90 ? 'text-warning':'text-success'}">${(r.ltv ?? 0).toFixed(2)}%</span></td>
        <td>
          <span class="status-${String(r.status||'').toLowerCase()}">
            ${r.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}
          </span>
          ${r.reasons ? `<div style="font-size:12px;color:#b00020;margin-top:2px">${r.reasons}</div>` : ''}
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  displaySummary(results, mode) {
    if (!this.elements.summary) return;
    const ok = results.filter(x => x.status === 'APPROVED');
    const best = ok[0];

    if (!best) {
      this.elements.summary.innerHTML = `
        <div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5">
          <h4 style="color:#dc3545">❌ ไม่มีธนาคารที่อนุมัติ</h4>
          <p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p>
        </div>`;
      return;
    }

    this.elements.summary.innerHTML = (mode === 'max')
      ? `
        <div class="summary-highlight">
          <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName || '-'}</h4>
          <div class="summary-grid">
            <div><strong>วงเงินสูงสุด:</strong> ${this.formatCurrency(best.maxLoanAmount)}</div>
            <div><strong>ค่างวด/เดือน:</strong> ${this.formatCurrency(best.monthlyPayment)}</div>
            <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate ?? 0).toFixed(2)}%</div>
            <div><strong>DSR:</strong> ${(best.dsr ?? 0).toFixed(2)}%</div>
            <div><strong>LTV:</strong> ${(best.ltv ?? 0).toFixed(2)}%</div>
            ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title || ''}</div>` : ''}
          </div>
        </div>`
      : `
        <div class="summary-highlight">
          <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName || '-'}</h4>
          <div class="summary-grid">
            <div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>
            <div><strong>ค่างวด/เดือน:</strong> ${this.formatCurrency(best.monthlyPayment)}</div>
            <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate ?? 0).toFixed(2)}%</div>
            <div><strong>DSR:</strong> ${(best.dsr ?? 0).toFixed(2)}%</div>
            <div><strong>LTV:</strong> ${(best.ltv ?? 0).toFixed(2)}%</div>
            ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title || ''}</div>` : ''}
          </div>
        </div>`;
  }

  displayNoResults() {
    if (this.elements.offers) {
      this.elements.offers.innerHTML = `
        <tr><td colspan="8" style="text-align:center;padding:20px;color:#999">
          ไม่พบข้อเสนอที่เหมาะสม กรุณาตรวจสอบข้อมูลและลองใหม่
        </td></tr>`;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    this.showExportOptions(false);
  }

  updateStatistics(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(v => v > 0);
    const avg = rates.length ? (rates.reduce((s,v)=>s+v,0)/rates.length) : 0;

    if (this.elements.totalOffers)   this.elements.totalOffers.textContent = results.length;
    if (this.elements.approvedOffers) this.elements.approvedOffers.textContent = approved.length;
    if (this.elements.rejectedOffers) this.elements.rejectedOffers.textContent = rejected.length;
    if (this.elements.avgRate)       this.elements.avgRate.textContent = avg ? avg.toFixed(2) : '—';
  }

  // ---------------------------
  // HISTORY
  // ---------------------------
  async loadCalculationHistory() {
    try {
      const items = (DM.getUserCalculations)
        ? await DM.getUserCalculations(10).catch(() => [])
        : [];
      if (!this.elements.calculationHistory) return;

      if (items.length) {
        this.displayCalculationHistory(items);
        this.elements.calculationHistory.style.display = 'block';
      } else {
        this.elements.calculationHistory.style.display = 'none';
      }
    } catch (e) {
      console.warn('loadCalculationHistory warn:', e);
    }
  }

  displayCalculationHistory(history) {
    if (!this.elements.historyList) return;
    this.elements.historyList.innerHTML = '';

    history.forEach(c => {
      const item = document.createElement('div');
      item.className = 'history-item';
      const date = new Date(c.created_at).toLocaleString('th-TH');
      const productText = this.getProductTypeText(c.product_type);
      const modeText = (c.calculation_mode === 'max') ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';

      item.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center">
          <div>
            <strong>${productText}</strong> - ${modeText}
            <div style="font-size:12px;color:#666;margin-top:2px">
              รายได้: ${this.formatCurrency(c.income)}
              ${c.loan_amount ? ` | วงเงิน: ${this.formatCurrency(c.loan_amount)}` : ''}
            </div>
          </div>
          <div style="font-size:12px;color:#999">${date}</div>
        </div>`;

      item.addEventListener('click', () => this.loadCalculationFromHistory(c));
      this.elements.historyList.appendChild(item);
    });
  }

  loadCalculationFromHistory(c) {
    if (this.elements.product)      this.elements.product.value      = c.product_type;
    if (this.elements.income)       this.elements.income.value       = c.income;
    if (this.elements.debt)         this.elements.debt.value         = c.debt;
    if (this.elements.incomeExtra)  this.elements.incomeExtra.value  = c.income_extra;
    if (this.elements.age)          this.elements.age.value          = c.age;
    if (this.elements.years)        this.elements.years.value        = c.tenure_years;
    if (this.elements.property)     this.elements.property.value     = c.property_value;
    if (this.elements.propertyType) this.elements.propertyType.value = c.property_type || '';
    if (this.elements.homeNumber)   this.elements.homeNumber.value   = c.home_number || '';
    if (this.elements.loanAmount)   this.elements.loanAmount.value   = c.loan_amount;

    const radio = document.querySelector(`input[name="mode"][value="${c.calculation_mode}"]`);
    if (radio) { radio.checked = true; this.handleModeChange(); }

    if (c.results?.calculationResults) {
      this.currentResults = c.results.calculationResults;
      this.displayResults(this.currentResults, c.calculation_mode);
      this.updateStatistics(this.currentResults);
    }
    toast('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว', 'success');
  }

  async clearCalculationHistory() {
    if (!confirm('ต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;
    if (this.elements.calculationHistory) this.elements.calculationHistory.style.display = 'none';
    toast('ล้างประวัติเรียบร้อยแล้ว', 'info');
  }

  // ---------------------------
  // EXPORTS
  // ---------------------------
  async saveCalculation() {
    if (!this.currentResults.length) { toast('ไม่มีผลการคำนวณให้บันทึก', 'warning'); return; }
    try {
      await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      toast('บันทึกการคำนวณเรียบร้อยแล้ว', 'success');
      this.loadCalculationHistory();
    } catch (e) {
      toast('ไม่สามารถบันทึกได้', 'error');
    }
  }

  exportToCSV() {
    if (!this.currentResults.length) { toast('ไม่มีข้อมูลให้ export', 'warning'); return; }
    try {
      const csv = LoanCalculator.exportToCSV(this.currentResults);
      this.downloadFile(csv, 'loan-calculation.csv', 'text/csv');
      toast('Export CSV สำเร็จ', 'success');
    } catch { toast('ไม่สามารถ export ได้', 'error'); }
  }

  exportToJSON() {
    if (!this.currentResults.length) { toast('ไม่มีข้อมูลให้ export', 'warning'); return; }
    try {
      const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
      this.downloadFile(json, 'loan-calculation.json', 'application/json');
      toast('Export JSON สำเร็จ', 'success');
    } catch { toast('ไม่สามารถ export ได้', 'error'); }
  }

  downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // ---------------------------
  // UTILS
  // ---------------------------
  setCalculatingState(on) {
    this.isCalculating = on;
    if (this.elements.btnText) this.elements.btnText.textContent = on ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.elements.btnSpinner) this.elements.btnSpinner.style.display = on ? 'inline-block' : 'none';
    if (this.elements.btnRun) this.elements.btnRun.disabled = on;
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
    [this.elements.btnSave, this.elements.btnExportCSV, this.elements.btnExportJSON].forEach(b => {
      if (b) b.style.display = show ? 'inline-block' : 'none';
    });
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

  formatCurrency(v) {
    if (!v) return '—';
    return new Intl.NumberFormat('th-TH', { style:'currency', currency:'THB', minimumFractionDigits:0 }).format(v);
    }

  getProductTypeText(t) {
    const map = { MORTGAGE:'สินเชื่อบ้าน', REFINANCE:'รีไฟแนนซ์', PERSONAL:'สินเชื่อส่วนบุคคล', SME:'สินเชื่อ SME' };
    return map[t] || t || '-';
  }

  // ---------------------------
  // CLEANUP
  // ---------------------------
  cleanup() {
    try { this.calculator?.cleanup?.(); } catch {}
    try { getAM()?.cleanup?.(); } catch {}
    try { DM?.clearAllCache?.(); } catch {}
    this.elements = {};
    console.log('🧹 Loan App cleaned up');
  }
}

// ----------------------------------------
// Auto bootstrap (ไม่ใช่ top-level await)
// ----------------------------------------
(function () {
  const run = () => {
    const app = new LoanAppManager();
    app.initialize();
    window.loanApp = app;
    window.addEventListener('beforeunload', () => {
      try { app.cleanup(); } catch {}
    });
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', run, { once: true });
  } else {
    run();
  }
})();
