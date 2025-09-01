// จัดการหน้า /loan: bind DOM, อ่านค่าจากฟอร์ม, เรียก calculator
import {
  checkDatabaseConnection,
  getBanks,
  getActivePromotions,
  getUserCalculations,
  saveCalculation
} from './data-manager.js';
import { LoanCalculator } from './loan-calculator-supabase.js';

function $(id) { return document.getElementById(id); }
function rawNum(el) {
  if (!el) return 0;
  const s = (el.dataset?.rawValue) ?? String(el.value || '').replace(/,/g, '');
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : 0;
}
function money(n) {
  try {
    return new Intl.NumberFormat('th-TH',{ style:'currency', currency:'THB', minimumFractionDigits:0 }).format(n || 0);
  } catch { return String(n || 0); }
}

export class LoanAppManager {
  constructor() {
    this.calculator = new LoanCalculator();
    this.elements = {};
    this.currentResults = [];
    this.currentParams  = {};
    this.isCalculating = false;
  }

  async initialize() {
    this.bindElements();
    this.setupEvents();

    // ping DB (ไม่ throw เพื่อไม่บล็อก UI)
    try { this.updateConn(await checkDatabaseConnection()); }
    catch { this.updateConn(false); }

    await this.loadInitialMeta();
    await this.loadHistory();

    console.log('Loan App ready');
  }

  bindElements() {
    this.els = {
      modeRadios: document.querySelectorAll('input[name="mode"]'),
      product: $('product'),
      income: $('income'),
      debt: $('debt'),
      incomeExtra: $('income-extra'),
      age: $('age'),
      years: $('years'),
      property: $('property'),
      propertyType: $('property-type'),
      homeNumber: $('home-number'),
      loanAmount: $('loan-amount'),
      btnRun: $('btn-run'),
      btnSave: $('btn-save-calculation'),
      btnExportCSV: $('btn-export-csv'),
      btnExportJSON: $('btn-export-json'),
      offers: $('offers'),
      summary: $('caps'),
      totalOffers: $('total-offers'),
      approvedOffers: $('approved-offers'),
      rejectedOffers: $('rejected-offers'),
      avgRate: $('avg-rate'),
      banksCount: $('banks-count'),
      promotionsCount: $('promotions-count'),
      lastUpdated: $('last-updated'),
      calcHistory: $('calculation-history'),
      historyList: $('history-list'),
      blockLoan: $('block-loan'),
      sortInfo: $('sort-info'),
      btnSpinner: $('btn-spinner'),
      btnText: $('btn-text'),
      conn: $('connection-status'),
    };
  }

  setupEvents() {
    const E = this.els;
    if (E.modeRadios?.forEach) {
      E.modeRadios.forEach(r => r.addEventListener('change', () => this.handleModeChange()));
    }
    E.product?.addEventListener('change', () => this.loadInitialMeta());
    E.btnRun?.addEventListener('click', () => this.run());
    E.btnSave?.addEventListener('click', () => this.save());
    E.btnExportCSV?.addEventListener('click', () => this.exportCSV());
    E.btnExportJSON?.addEventListener('click', () => this.exportJSON());

    const ids = ['income','debt','incomeExtra','age','years','property','loanAmount'];
    ids.forEach(id => {
      const el = E[id];
      if (!el) return;
      el.addEventListener('input', e => e.target.value = String(e.target.value).replace(/[^0-9]/g, ''));
      el.addEventListener('blur', e => {
        const v = parseInt(e.target.value, 10) || 0;
        if (!e.target.dataset) e.target.dataset = {};
        e.target.dataset.rawValue = v;
        if (!['age','years'].includes(e.target.id)) e.target.value = v.toLocaleString();
      });
      el.addEventListener('focus', e => {
        if (e.target.dataset?.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    });

    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'Enter') { e.preventDefault(); this.run(); }
      if (e.key === 's')     { e.preventDefault(); this.save(); }
      if (e.key === 'e')     { e.preventDefault(); this.exportCSV(); }
    });
  }

  async loadInitialMeta() {
    try {
      const productType = this.els.product?.value || 'MORTGAGE';
      const [banks, promos] = await Promise.all([
        getBanks(),
        getActivePromotions(productType),
      ]);
      if (this.els.banksCount)      this.els.banksCount.textContent = banks.length;
      if (this.els.promotionsCount) this.els.promotionsCount.textContent = promos.length;
      if (this.els.lastUpdated)     this.els.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (e) {
      console.warn('[loadInitialMeta]', e);
    }
  }

  paramsFromForm() {
    return {
      productType: this.els.product?.value || 'MORTGAGE',
      income: rawNum(this.els.income),
      debt: rawNum(this.els.debt),
      incomeExtra: rawNum(this.els.incomeExtra),
      age: parseInt(this.els.age?.value, 10) || 30,
      years: parseInt(this.els.years?.value, 10) || 20,
      propertyValue: rawNum(this.els.property),
      propertyType: this.els.propertyType?.value || null,
      homeNumber: parseInt(this.els.homeNumber?.value, 10) || null,
      loanAmount: rawNum(this.els.loanAmount),
    };
  }

  validate(p) {
    const errs = [];
    if (p.income <= 0) errs.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errs.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errs.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if ((p.productType === 'MORTGAGE' || p.productType === 'REFINANCE') && p.propertyValue <= 0)
      errs.push('กรุณากรอกมูลค่าหลักประกัน');

    const mode = this.mode();
    if (mode === 'check' && p.loanAmount <= 0) errs.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errs.length) { this.toast(errs.join('<br>'),'error'); return false; }
    return true;
  }

  mode() {
    const r = document.querySelector('input[name="mode"]:checked');
    return r ? r.value : 'max';
  }

  setPending(b) {
    this.isCalculating = b;
    if (this.els.btnText) this.els.btnText.textContent = b ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.els.btnSpinner) this.els.btnSpinner.style.display = b ? 'inline-block' : 'none';
    if (this.els.btnRun) this.els.btnRun.disabled = b;
  }

  handleModeChange() {
    const m = this.mode();
    if (this.els.blockLoan) this.els.blockLoan.style.display = (m === 'check' ? 'block' : 'none');
    if (this.els.sortInfo) this.els.sortInfo.textContent = (m === 'check' ? '(เรียงตาม DSR ต่ำสุด)' : '(เรียงตามวงเงินสูงสุด)');
    this.clearResults();
  }

  clearResults() {
    if (this.els.offers) this.els.offers.innerHTML =
      '<tr><td colspan="8" style="text-align:center;padding:20px;color:#666">กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>';
    if (this.els.summary) this.els.summary.innerHTML = '';
    ['totalOffers','approvedOffers','rejectedOffers','avgRate'].forEach(k => this.els[k] && (this.els[k].textContent = '—'));
    this.toggleExport(false);
    this.currentResults = [];
  }

  async run() {
    if (this.isCalculating) return;
    const p = this.paramsFromForm();
    if (!this.validate(p)) return;

    this.setPending(true); this.clearResults();
    const mode = this.mode();

    try {
      const results = (mode === 'max')
        ? await this.calculator.calculateMaxLoanAmount(p)
        : await this.calculator.checkLoanAmount(p);

      this.currentResults = results;
      this.currentParams = { ...p, calculationMode: mode };

      this.renderResults(results, mode);
      this.updateStats(results);

    } catch (e) {
      console.error(e);
      this.toast('เกิดข้อผิดพลาดในการคำนวณ', 'error');
    } finally {
      this.setPending(false);
    }
  }

  renderResults(results, mode) {
    if (!results?.length) {
      if (this.els.offers) this.els.offers.innerHTML =
        '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">ไม่พบข้อเสนอที่เหมาะสม</td></tr>';
      this.toggleExport(false);
      return;
    }
    const tbody = this.els.offers;
    tbody.innerHTML = '';

    for (const r of results) {
      const tr = document.createElement('tr');
      tr.className = (r.status === 'APPROVED') ? 'status-approved' : 'status-rejected';
      tr.innerHTML = `
        <td><strong>${r.bankShortName || '-'}</strong><div style="font-size:.8em;color:#666">${r.bankName || ''}</div></td>
        <td>${
          r.promotion
            ? `<div class="promo-badge">${r.promotion.title || ''}</div><div style="font-size:.8em;color:#666">${r.promotion.description || ''}</div>`
            : '<span style="color:#999">ไม่มีโปรโมชัน</span>'
        }</td>
        <td><strong>${(r.interestRate || 0).toFixed(2)}%</strong>${
            r.promotion?.year1Rate ? `<div style="font-size:.8em;color:#666">ปี 1: ${r.promotion.year1Rate}%</div>` : ''
        }</td>
        <td><strong>${money(r.monthlyPayment)}</strong></td>
        <td><strong>${money(r.maxLoanAmount ?? r.loanAmount)}</strong></td>
        <td>${(r.dsr || 0).toFixed(2)}%</td>
        <td>${(r.ltv || 0).toFixed(2)}%</td>
        <td><span class="status-${String(r.status || '').toLowerCase()}">${r.status==='APPROVED'?'✅ อนุมัติ':'❌ ไม่อนุมัติ'}</span>${
          r.reasons ? `<div style="font-size:.8em;color:#dc3545">${r.reasons}</div>` : ''
        }</td>
      `;
      tbody.appendChild(tr);
    }

    // highlight best
    const approved = results.filter(r => r.status === 'APPROVED');
    const best = approved[0];
    if (this.els.summary) {
      this.els.summary.innerHTML = best
        ? (mode === 'max'
            ? `<div class="summary-highlight">
                 <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
                 <div class="summary-grid">
                   <div><strong>วงเงินสูงสุด:</strong> ${money(best.maxLoanAmount)}</div>
                   <div><strong>ค่างวด/เดือน:</strong> ${money(best.monthlyPayment)}</div>
                   <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate||0).toFixed(2)}%</div>
                   <div><strong>DSR:</strong> ${(best.dsr||0).toFixed(2)}%</div>
                   <div><strong>LTV:</strong> ${(best.ltv||0).toFixed(2)}%</div>
                 </div>
               </div>`
            : `<div class="summary-highlight">
                 <h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
                 <div class="summary-grid">
                   <div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>
                   <div><strong>ค่างวด/เดือน:</strong> ${money(best.monthlyPayment)}</div>
                   <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate||0).toFixed(2)}%</div>
                   <div><strong>DSR:</strong> ${(best.dsr||0).toFixed(2)}%</div>
                   <div><strong>LTV:</strong> ${(best.ltv||0).toFixed(2)}%</div>
                 </div>
               </div>`)
        : `<div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5">
             <h4 style="color:#dc3545">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4>
             <p>ลองเพิ่มรายได้ ลดภาระหนี้ หรือปรับวงเงินที่ต้องการ</p>
           </div>`;
    }

    this.toggleExport(true);
  }

  updateStats(results) {
    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    const rates = approved.map(r => r.interestRate).filter(x => x > 0);
    const avg = rates.length ? (rates.reduce((a,b)=>a+b,0) / rates.length) : 0;

    if (this.els.totalOffers)    this.els.totalOffers.textContent = results.length;
    if (this.els.approvedOffers) this.els.approvedOffers.textContent = approved.length;
    if (this.els.rejectedOffers) this.els.rejectedOffers.textContent = rejected.length;
    if (this.els.avgRate)        this.els.avgRate.textContent = avg ? avg.toFixed(2) : '—';
  }

  async save() {
    if (!this.currentResults.length) { this.toast('ไม่มีผลลัพธ์ให้บันทึก','warning'); return; }
    try {
      await saveCalculation({
        product_type: this.currentParams.productType,
        income: this.currentParams.income,
        debt: this.currentParams.debt,
        income_extra: this.currentParams.incomeExtra,
        age: this.currentParams.age,
        tenure_years: this.currentParams.years,
        property_value: this.currentParams.propertyValue,
        property_type: this.currentParams.propertyType,
        home_number: this.currentParams.homeNumber,
        loan_amount: this.currentParams.loanAmount,
        calculation_mode: this.currentParams.calculationMode,
        results: { calculationResults: this.currentResults },
      });
      this.toast('บันทึกการคำนวณเรียบร้อยแล้ว','success');
      this.loadHistory();
    } catch (e) {
      console.error(e);
      this.toast('บันทึกไม่สำเร็จ','error');
    }
  }

  async loadHistory() {
    try {
      const list = await getUserCalculations(10);
      if (!this.els.calcHistory || !this.els.historyList) return;
      if (!list?.length) { this.els.calcHistory.style.display = 'none'; return; }
      this.els.calcHistory.style.display = 'block';
      this.els.historyList.innerHTML = '';
      for (const c of list) {
        const div = document.createElement('div');
        div.className = 'history-item';
        const date = new Date(c.created_at).toLocaleString('th-TH');
        const ptext = this.productText(c.product_type);
        const mtext = c.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';
        div.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${ptext}</strong> - ${mtext}
            <div style="font-size:.8em;color:#666">รายได้: ${money(c.income)}${c.loan_amount ? (' | วงเงิน: ' + money(c.loan_amount)) : ''}</div>
          </div>
          <div style="font-size:.8em;color:#999">${date}</div>
        </div>`;
        div.addEventListener('click', () => this.applyHistory(c));
        this.els.historyList.appendChild(div);
      }
    } catch (e) {
      console.warn('[loadHistory]', e);
    }
  }

  applyHistory(c) {
    const set = (el, v) => { if (el) el.value = (v ?? ''); };
    set(this.els.product, c.product_type);
    set(this.els.income, c.income);
    set(this.els.debt, c.debt);
    set(this.els.incomeExtra, c.income_extra);
    set(this.els.age, c.age);
    set(this.els.years, c.tenure_years);
    set(this.els.property, c.property_value);
    set(this.els.propertyType, c.property_type);
    set(this.els.homeNumber, c.home_number);
    set(this.els.loanAmount, c.loan_amount);

    const r = document.querySelector(`input[name="mode"][value="${c.calculation_mode}"]`);
    if (r) { r.checked = true; this.handleModeChange(); }

    if (c.results?.calculationResults) {
      this.currentResults = c.results.calculationResults;
      this.renderResults(this.currentResults, c.calculation_mode);
      this.updateStats(this.currentResults);
    }
    this.toast('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว','success');
  }

  exportCSV() {
    if (!this.currentResults.length) { this.toast('ไม่มีข้อมูลให้ export','warning'); return; }
    const csv = LoanCalculator.exportToCSV(this.currentResults);
    this.download(csv, 'loan-calculation.csv', 'text/csv');
    this.toast('Export CSV เรียบร้อยแล้ว','success');
  }

  exportJSON() {
    if (!this.currentResults.length) { this.toast('ไม่มีข้อมูลให้ export','warning'); return; }
    const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
    this.download(json, 'loan-calculation.json', 'application/json');
    this.toast('Export JSON เรียบร้อยแล้ว','success');
  }

  toggleExport(show) {
    ['btnSave','btnExportCSV','btnExportJSON'].forEach(k => {
      const el = this.els[k]; if (el) el.style.display = show ? 'inline-block' : 'none';
    });
  }

  updateConn(ok) {
    if (!this.els.conn) return;
    this.els.conn.innerHTML = ok ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่สามารถเชื่อมต่อได้';
    this.els.conn.style.color = ok ? '#28a745' : '#dc3545';
  }

  productText(t) {
    const map = { MORTGAGE:'สินเชื่อบ้าน', REFINANCE:'รีไฟแนนซ์', PERSONAL:'สินเชื่อส่วนบุคคล', SME:'สินเชื่อ SME' };
    return map[t] || t;
  }

  download(content, filename, mime) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  toast(message, type='info', duration=3000) {
    const colors = {
      success:'bg-green-100 text-green-800 border-green-300',
      error:'bg-red-100 text-red-800 border-red-300',
      info:'bg-blue-100 text-blue-800 border-blue-300',
      warning:'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
    const n = document.createElement('div');
    n.className = 'notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm ' + (colors[type] || colors.info);
    n.innerHTML = message;
    document.body.appendChild(n);
    setTimeout(() => { try { n.remove(); } catch {} }, duration);
    n.addEventListener('click', () => { try { n.remove(); } catch {} });
  }
}

export function runLoanPage() {
  const app = new LoanAppManager();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => app.initialize());
  } else {
    app.initialize();
  }
  window.loanApp = app;
  return app;
}
