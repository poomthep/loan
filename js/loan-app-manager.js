/* ============================================================================
 * loan-app-manager.js  (ES Module; no default export)
 * - ไม่ export default เพื่อกัน error duplicate export
 * - ไม่ import data-manager แบบ hardcode; มี fallback
 * - ใช้ AuthManager/ DataManager จาก window หากมีอยู่ก่อน
 * ========================================================================== */

'use strict';

/* --------------------------- helpers: module resolve --------------------------- */
function pickDefault(ns) {
  if (ns && typeof ns === 'object') {
    if ('default' in ns && ns.default) return ns.default;
    if ('LoanCalculator' in ns && ns.LoanCalculator) return ns.LoanCalculator;
  }
  return ns;
}

// ดึง DataManager ให้ได้แน่ ๆ (จาก window → ./data-manager.js → ./data-manager.fix.js)
async function resolveDataManager() {
  if (typeof window !== 'undefined' && window.DataManager) return window.DataManager;

  try {
    const mod = await import('./data-manager.js');
    const DM = pickDefault(mod);
    if (DM) { window.DataManager = DM; return DM; }
  } catch (_) {}

  try {
    const mod = await import('./data-manager.fix.js');
    const DM = pickDefault(mod);
    if (DM) { window.DataManager = DM; return DM; }
  } catch (_) {}

  // ถ้าไม่มีจริง ๆ ก็โยน error ชัดเจน
  throw new Error('ไม่พบ DataManager (ทั้ง data-manager.js และ data-manager.fix.js)');
}

// ดึง LoanCalculator (ตัวนี้มีไฟล์อยู่แน่)
import * as __LCNS from './loan-calculator-supabase.js';
const LoanCalculatorCtor = pickDefault(__LCNS);

// AuthManager: รอจนกว่าจะพร้อม (อ่านจาก window เท่านั้น)
function waitForAuthManager(timeoutMs = 4000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    (function loop() {
      if (typeof window !== 'undefined' && window.AuthManager) {
        const am = window.AuthManager;
        try {
          if (typeof am.initialize === 'function') {
            am.initialize().then(() => resolve(am)).catch(() => resolve(am));
          } else {
            resolve(am);
          }
        } catch {
          resolve(am);
        }
        return;
      }
      if (Date.now() - start >= timeoutMs) return reject(new Error('AuthManager ยังไม่พร้อม'));
      setTimeout(loop, 60);
    })();
  });
}

/* ============================================================================
 * Main Controller
 * ========================================================================== */
export class LoanAppManager {
  constructor() {
    this.calculator = (typeof LoanCalculatorCtor === 'function')
      ? new LoanCalculatorCtor()
      : LoanCalculatorCtor;

    this.dm = null;                 // ← เก็บ DataManager ที่ resolve มา
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;

    this.elements = {};
  }

  /* --------------------------- lifecycle --------------------------- */
  async initialize() {
    console.log('🚀 Initializing Loan App...');

    // 1) Auth ให้พร้อมก่อน
    await waitForAuthManager().catch(() => { /* ปล่อยผ่าน แต่จะแจ้งบน UI ถ้าจำเป็น */ });

    // 2) DataManager พร้อม (มี fallback)
    this.dm = await resolveDataManager();

    // 3) bind DOM และ events
    this.bindElements();
    this.setupEventListeners();

    // 4) เช็คการเชื่อมต่อฐานข้อมูล (optional แล้วแต่ DM)
    try {
      let ok = true;
      if (this.dm && typeof this.dm.getBanks === 'function') {
        await this.dm.getBanks(); // ถ้าดึงได้ถือว่าโอเค
      }
      this.updateConnectionStatus(!!ok);
    } catch (e) {
      console.warn('check DB connection failed:', e);
      this.updateConnectionStatus(false);
    }

    // 5) โหลดข้อมูลเริ่มต้น + ประวัติ
    await this.loadInitialData();
    await this.loadCalculationHistory();

    console.log('✅ Loan App ready');
  }

  /* --------------------------- DOM binding --------------------------- */
  bindElements() {
    const $ = (id) => document.getElementById(id);
    this.elements = {
      // form
      modeRadios: document.querySelectorAll('input[name="mode"]'),
      product:      $('product'),
      income:       $('income'),
      debt:         $('debt'),
      incomeExtra:  $('income-extra'),
      age:          $('age'),
      years:        $('years'),
      property:     $('property'),
      propertyType: $('property-type'),
      homeNumber:   $('home-number'),
      loanAmount:   $('loan-amount'),

      // btn
      btnRun:         $('btn-run'),
      btnSave:        $('btn-save-calculation'),
      btnExportCSV:   $('btn-export-csv'),
      btnExportJSON:  $('btn-export-json'),
      btnClearHistory:$('btn-clear-history'),

      // display
      offers:  $('offers'),
      summary: $('caps'),

      // stats
      totalOffers:    $('total-offers'),
      approvedOffers: $('approved-offers'),
      rejectedOffers: $('rejected-offers'),
      avgRate:        $('avg-rate'),

      // status
      connectionStatus: $('connection-status'),
      banksCount:       $('banks-count'),
      promotionsCount:  $('promotions-count'),
      lastUpdated:      $('last-updated'),

      // history
      calculationHistory: $('calculation-history'),
      historyList:        $('history-list'),

      // ui
      blockLoan:  $('block-loan'),
      sortInfo:   $('sort-info'),
      btnText:    $('btn-text'),
      btnSpinner: $('btn-spinner')
    };
  }

  setupEventListeners() {
    // mode
    this.elements.modeRadios?.forEach(r =>
      r.addEventListener('change', () => this.handleModeChange())
    );

    // product
    this.elements.product?.addEventListener('change', () => this.loadInitialData());

    // buttons
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    // numeric formatters
    const numericIds = ['income','debt','incomeExtra','age','years','property','loanAmount'];
    numericIds.forEach(id => {
      const el = this.elements[id];
      if (!el) return;
      el.addEventListener('input', e => { e.target.value = String(e.target.value).replace(/[^0-9]/g,''); });
      el.addEventListener('blur', e => {
        const v = parseInt(e.target.value, 10) || 0;
        if (v > 0 && id !== 'age' && id !== 'years') {
          e.target.dataset.rawValue = v;
          e.target.value = v.toLocaleString();
        }
      });
      el.addEventListener('focus', e => {
        if (e.target.dataset?.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    });

    // shortcuts
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'Enter') { e.preventDefault(); this.runCalculation(); }
      if (e.key === 's')     { e.preventDefault(); this.saveCalculation(); }
      if (e.key === 'e')     { e.preventDefault(); this.exportToCSV(); }
    });
  }

  /* --------------------------- initial data --------------------------- */
  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';

      const [banks, promotions] = await Promise.all([
        this.dm?.getBanks?.() ?? Promise.resolve([]),
        this.dm?.getActivePromotions?.(productType) ?? Promise.resolve([])
      ]);

      if (this.elements.banksCount)      this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.lastUpdated)     this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (e) {
      console.warn('loadInitialData:', e);
    }
  }

  /* --------------------------- calculation --------------------------- */
  async runCalculation() {
    if (this.isCalculating) { this.notify('กำลังคำนวณอยู่ กรุณารอสักครู่','warning'); return; }

    const params = this.getFormParameters();
    if (!this.validateParameters(params)) return;

    this.setCalculatingState(true);
    this.clearResults();

    try {
      const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
      let results = [];

      if (mode === 'max') {
        results = await this.calculator.calculateMaxLoanAmount(params);
      } else {
        results = await this.calculator.checkLoanAmount(params);
      }

      this.currentResults = results;
      this.currentParams  = { ...params, calculationMode: mode };

      this.displayResults(results, mode);
      this.updateStatistics(results);

      if (results.length && typeof this.calculator.saveCalculation === 'function') {
        await this.calculator.saveCalculation(params, results, mode);
        await this.loadCalculationHistory();
      }
    } catch (e) {
      console.error('calc error:', e);
      this.notify('เกิดข้อผิดพลาดในการคำนวณ กรุณาลองใหม่อีกครั้ง','error');
    } finally {
      this.setCalculatingState(false);
    }
  }

  getFormParameters() {
    return {
      productType: this.elements.product?.value || 'MORTGAGE',
      income:      this.getRaw(this.elements.income),
      debt:        this.getRaw(this.elements.debt),
      incomeExtra: this.getRaw(this.elements.incomeExtra),
      age:   parseInt(this.elements.age?.value, 10)   || 30,
      years: parseInt(this.elements.years?.value, 10) || 20,
      propertyValue: this.getRaw(this.elements.property),
      propertyType:  this.elements.propertyType?.value || null,
      homeNumber:    parseInt(this.elements.homeNumber?.value, 10) || null,
      loanAmount:    this.getRaw(this.elements.loanAmount)
    };
  }
  getRaw(el) {
    if (!el) return 0;
    return parseInt(el.dataset?.rawValue ?? String(el.value || '').replace(/,/g,''), 10) || 0;
  }

  validateParameters(p) {
    const errs = [];
    if (p.income <= 0) errs.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errs.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errs.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if ((p.productType === 'MORTGAGE' || p.productType === 'REFINANCE') && p.propertyValue <= 0) {
      errs.push('กรุณากรอกมูลค่าหลักประกัน');
    }
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (mode === 'check' && p.loanAmount <= 0) errs.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errs.length) { this.notify(errs.join('<br>'),'error'); return false; }
    return true;
  }

  /* --------------------------- render --------------------------- */
  displayResults(results, mode) {
    if (!results || !results.length) { this.displayNoResults(); return; }

    const tbody = this.elements.offers;
    if (!tbody) return;
    tbody.innerHTML = '';

    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = (r.status === 'APPROVED') ? 'status-approved' : 'status-rejected';
      tr.innerHTML = `
        <td>
          <strong>${r.bankShortName || '-'}</strong>
          <div style="font-size:.8em;color:#666">${r.bankName || ''}</div>
        </td>
        <td>
          ${r.promotion
            ? `<div class="promo-badge">${r.promotion.title}</div>
               <div style="font-size:.8em;color:#666">${r.promotion.description || ''}</div>`
            : '<span style="color:#999">ไม่มีโปรโมชัน</span>'}
        </td>
        <td>
          <strong>${(r.interestRate || 0).toFixed(2)}%</strong>
          ${r.promotion?.year1Rate
            ? `<div style="font-size:.8em;color:#666">ปี 1: ${r.promotion.year1Rate}%</div>` : ''}
        </td>
        <td><strong>${this.money(r.monthlyPayment)}</strong></td>
        <td><strong>${this.money(r.maxLoanAmount ?? r.loanAmount)}</strong></td>
        <td><span class="${(r.dsr || 0) > 70 ? 'text-warning' : 'text-success'}">${(r.dsr || 0).toFixed(2)}%</span></td>
        <td><span class="${(r.ltv || 0) > 90 ? 'text-warning' : 'text-success'}">${(r.ltv || 0).toFixed(2)}%</span></td>
        <td>
          <span class="status-${String(r.status || '').toLowerCase()}">${r.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}</span>
          ${r.reasons ? `<div style="font-size:.8em;color:#dc3545">${r.reasons}</div>` : ''}
        </td>`;
      tbody.appendChild(tr);
    });

    const best = results.find(x => x.status === 'APPROVED');
    if (this.elements.summary) {
      if (!best) {
        this.elements.summary.innerHTML =
          `<div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5">
             <h4 style="color:#dc3545">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4>
             <p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p>
           </div>`;
      } else {
        this.elements.summary.innerHTML =
          (mode === 'max'
            ? `<div class="summary-highlight">
                 <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
                 <div class="summary-grid">
                   <div><strong>วงเงินสูงสุด:</strong> ${this.money(best.maxLoanAmount)}</div>
                   <div><strong>ค่างวด/เดือน:</strong> ${this.money(best.monthlyPayment)}</div>
                   <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate || 0).toFixed(2)}%</div>
                   <div><strong>DSR:</strong> ${(best.dsr || 0).toFixed(2)}%</div>
                   <div><strong>LTV:</strong> ${(best.ltv || 0).toFixed(2)}%</div>
                   ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>` : ''}
                 </div>
               </div>`
            : `<div class="summary-highlight">
                 <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
                 <div class="summary-grid">
                   <div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>
                   <div><strong>ค่างวด/เดือน:</strong> ${this.money(best.monthlyPayment)}</div>
                   <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate || 0).toFixed(2)}%</div>
                   <div><strong>DSR:</strong> ${(best.dsr || 0).toFixed(2)}%</div>
                   <div><strong>LTV:</strong> ${(best.ltv || 0).toFixed(2)}%</div>
                   ${best.promotion ? `<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>` : ''}
                 </div>
               </div>`);
      }
    }

    this.showExportOptions(true);
  }

  displayNoResults() {
    this.elements.offers && (this.elements.offers.innerHTML =
      `<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">
         ไม่พบข้อเสนอที่เหมาะสม กรุณาคำนวณเพื่อดูผลลัพธ์
       </td></tr>`);
    this.elements.summary && (this.elements.summary.innerHTML = '');
    this.showExportOptions(false);
  }

  updateStatistics(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(r => r > 0);
    const avg = rates.length ? rates.reduce((a,b)=>a+b,0)/rates.length : 0;

    this.elements.totalOffers    && (this.elements.totalOffers.textContent = results.length);
    this.elements.approvedOffers && (this.elements.approvedOffers.textContent = approved.length);
    this.elements.rejectedOffers && (this.elements.rejectedOffers.textContent = rejected.length);
    this.elements.avgRate        && (this.elements.avgRate.textContent = avg ? avg.toFixed(2) : '—');
  }

  /* --------------------------- history --------------------------- */
  async loadCalculationHistory() {
    try {
      const history = await (this.dm?.getUserCalculations?.(10) ?? Promise.resolve([]));
      if (!this.elements.calculationHistory || !this.elements.historyList) return;

      if (!history.length) {
        this.elements.calculationHistory.style.display = 'none';
        return;
      }

      this.elements.calculationHistory.style.display = 'block';
      const box = this.elements.historyList;
      box.innerHTML = '';

      history.forEach(c => {
        const div = document.createElement('div');
        div.className = 'history-item';

        const date = new Date(c.created_at).toLocaleString('th-TH');
        const modeText = c.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';
        const productTypeText = this.productText(c.product_type);

        div.innerHTML =
          `<div style="display:flex;justify-content:space-between;align-items:center">
             <div>
               <strong>${productTypeText}</strong> - ${modeText}
               <div style="font-size:.8em;color:#666;margin-top:2px">
                 รายได้: ${this.money(c.income)}
                 ${c.loan_amount ? ` | วงเงิน: ${this.money(c.loan_amount)}` : ''}
               </div>
             </div>
             <div style="font-size:.8em;color:#999">${date}</div>
           </div>`;

        div.addEventListener('click', () => this.loadCalculationFromHistory(c));
        box.appendChild(div);
      });
    } catch (e) {
      console.warn('loadCalculationHistory:', e);
    }
  }

  loadCalculationFromHistory(c) {
    const set = (el, v) => { if (el) el.value = (v ?? ''); };
    set(this.elements.product, c.product_type);
    set(this.elements.income, c.income);
    set(this.elements.debt, c.debt);
    set(this.elements.incomeExtra, c.income_extra);
    set(this.elements.age, c.age);
    set(this.elements.years, c.tenure_years);
    set(this.elements.property, c.property_value);
    set(this.elements.propertyType, c.property_type);
    set(this.elements.homeNumber, c.home_number);
    set(this.elements.loanAmount, c.loan_amount);

    const radio = document.querySelector(`input[name="mode"][value="${c.calculation_mode}"]`);
    if (radio) { radio.checked = true; this.handleModeChange(); }

    if (c.results?.calculationResults) {
      this.currentResults = c.results.calculationResults;
      this.displayResults(this.currentResults, c.calculation_mode);
      this.updateStatistics(this.currentResults);
    }
    this.notify('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว','success');
  }

  async clearCalculationHistory() {
    if (!confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;
    try {
      this.elements.calculationHistory && (this.elements.calculationHistory.style.display = 'none');
      this.notify('ล้างประวัติเรียบร้อยแล้ว','info');
    } catch {
      this.notify('ไม่สามารถล้างประวัติได้','error');
    }
  }

  /* --------------------------- export / save --------------------------- */
  async saveCalculation() {
    if (!this.currentResults.length) { this.notify('ไม่มีผลการคำนวณให้บันทึก','warning'); return; }
    try {
      if (typeof this.calculator.saveCalculation === 'function') {
        await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      }
      this.notify('บันทึกการคำนวณเรียบร้อยแล้ว','success');
      this.loadCalculationHistory();
    } catch {
      this.notify('ไม่สามารถบันทึกได้','error');
    }
  }

  exportToCSV() {
    if (!this.currentResults.length) { this.notify('ไม่มีข้อมูลให้ export','warning'); return; }
    try {
      const csv = (typeof LoanCalculatorCtor.exportToCSV === 'function')
        ? LoanCalculatorCtor.exportToCSV(this.currentResults)
        : '';
      this.download(csv, 'loan-calculation.csv', 'text/csv');
      this.notify('Export CSV เรียบร้อยแล้ว','success');
    } catch {
      this.notify('ไม่สามารถ export ได้','error');
    }
  }

  exportToJSON() {
    if (!this.currentResults.length) { this.notify('ไม่มีข้อมูลให้ export','warning'); return; }
    try {
      const json = (typeof LoanCalculatorCtor.exportToJSON === 'function')
        ? LoanCalculatorCtor.exportToJSON(this.currentResults, this.currentParams)
        : JSON.stringify({ results: this.currentResults, params: this.currentParams }, null, 2);
      this.download(json, 'loan-calculation.json', 'application/json');
      this.notify('Export JSON เรียบร้อยแล้ว','success');
    } catch {
      this.notify('ไม่สามารถ export ได้','error');
    }
  }

  /* --------------------------- misc utils --------------------------- */
  handleModeChange() {
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (this.elements.blockLoan) this.elements.blockLoan.style.display = (mode === 'check' ? 'block' : 'none');
    if (this.elements.sortInfo)  this.elements.sortInfo.textContent  = (mode === 'check' ? '(เรียงตาม DSR ต่ำสุด)' : '(เรียงตามวงเงินสูงสุด)');
    this.clearResults();
  }

  setCalculatingState(b) {
    this.isCalculating = b;
    if (this.elements.btnText)    this.elements.btnText.textContent = b ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.elements.btnSpinner) this.elements.btnSpinner.style.display = b ? 'inline-block' : 'none';
    if (this.elements.btnRun)     this.elements.btnRun.disabled = b;
  }

  clearResults() {
    this.currentResults = [];
    this.elements.offers  && (this.elements.offers.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#666">กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>`);
    this.elements.summary && (this.elements.summary.innerHTML = '');
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
    this.elements.connectionStatus.innerHTML = ok ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่สามารถเชื่อมต่อได้';
    this.elements.connectionStatus.style.color = ok ? '#28a745' : '#dc3545';
  }

  notify(message, type = 'info', duration = 4000) {
    const map = {
      success: 'bg-green-100 text-green-800 border-green-300',
      error:   'bg-red-100 text-red-800 border-red-300',
      info:    'bg-blue-100 text-blue-800 border-blue-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
    const el = document.createElement('div');
    el.className = `notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm ${map[type] || map.info}`;
    el.innerHTML = message;
    document.body.appendChild(el);
    setTimeout(() => { try { el.remove(); } catch {} }, duration);
    el.addEventListener('click', () => { try { el.remove(); } catch {} });
  }

  money(n) {
    if (!n) return '—';
    try {
      return new Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB', minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(n);
    } catch { return String(n); }
  }

  productText(t) {
    const map = { MORTGAGE:'สินเชื่อบ้าน', REFINANCE:'รีไฟแนนซ์', PERSONAL:'สินเชื่อส่วนบุคคล', SME:'สินเชื่อ SME' };
    return map[t] || t;
  }

  download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  cleanup() {
    try { this.calculator?.cleanup?.(); } catch {}
    try { this.dm?.clearAllCache?.(); } catch {}
  }
}

/* --------------------------- compatibility helpers --------------------------- */
export function runLoanPage() {
  const app = new LoanAppManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
  } else {
    app.initialize();
  }
  if (typeof window !== 'undefined') window.loanApp = app;
  return app;
}

// expose for old code
if (typeof window !== 'undefined') {
  window.LoanAppManager = LoanAppManager;
  window.runLoanPage = runLoanPage;
}

// auto-clean
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', () => {
    if (window.loanApp && typeof window.loanApp.cleanup === 'function') {
      try { window.loanApp.cleanup(); } catch {}
    }
  });
}
