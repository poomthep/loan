/* ============================================================================
 * loan-app-manager.js
 * - ESM module (มีทั้ง named export และ default export)
 * - ไม่ import auth-manager เป็นโมดูล ใช้จาก window.AuthManager แทน
 * - รองรับ DataManager และ LoanCalculator ไม่ว่าจะ export แบบ default หรือ named
 * ========================================================================== */

import * as DataManagerNS from './data-manager.js';
import * as LoanCalcNS from './loan-calculator-supabase.js';

// รองรับได้ทั้งกรณีมี/ไม่มี default export
const DataManager = DataManagerNS.default ?? DataManagerNS;
const LoanCalculator = LoanCalcNS.default ?? LoanCalcNS;

// ===== helpers: AuthManager แบบ global =====
function getAM() {
  const m = (typeof window !== 'undefined') ? window.AuthManager : null;
  if (m) return m;
  throw new Error('AuthManager ยังไม่พร้อม');
}
async function waitForAuthManager(timeoutMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (typeof window !== 'undefined' && window.AuthManager) {
      // ถ้ามี initialize ให้เรียกหนึ่งครั้งแบบไม่ throw
      try { if (typeof window.AuthManager.initialize === 'function') await window.AuthManager.initialize(); } catch (_) {}
      return window.AuthManager;
    }
    await new Promise(r => setTimeout(r, 60));
  }
  throw new Error('AuthManager ยังไม่พร้อม');
}

// ==========================================================================
// Main class
// ==========================================================================
export class LoanAppManager {
  constructor() {
    this.calculator = new LoanCalculator();
    this.currentResults = [];
    this.currentParams = {};
    this.isCalculating = false;
    this.elements = {};
  }

  // -------------------- bootstrap --------------------
  async initialize() {
    console.log('🚀 Initializing Loan App...');
    await waitForAuthManager();

    this.bindElements();
    this.setupEventListeners();

    try {
      const ok = await (DataManager.checkDatabaseConnection?.() ?? true);
      this.updateConnectionStatus(!!ok);
    } catch (e) {
      console.warn('checkDatabaseConnection error:', e);
      this.updateConnectionStatus(false);
    }

    await this.loadInitialData();
    await this.loadCalculationHistory();
    console.log('✅ Loan App ready');
  }

  bindElements() {
    this.elements = {
      // mode + input
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

      // buttons
      btnRun: document.getElementById('btn-run'),
      btnSave: document.getElementById('btn-save-calculation'),
      btnExportCSV: document.getElementById('btn-export-csv'),
      btnExportJSON: document.getElementById('btn-export-json'),
      btnClearHistory: document.getElementById('btn-clear-history'),

      // outputs
      offers: document.getElementById('offers'),
      summary: document.getElementById('caps'),
      totalOffers: document.getElementById('total-offers'),
      approvedOffers: document.getElementById('approved-offers'),
      rejectedOffers: document.getElementById('rejected-offers'),
      avgRate: document.getElementById('avg-rate'),

      // status
      connectionStatus: document.getElementById('connection-status'),
      banksCount: document.getElementById('banks-count'),
      promotionsCount: document.getElementById('promotions-count'),
      lastUpdated: document.getElementById('last-updated'),

      // history
      calculationHistory: document.getElementById('calculation-history'),
      historyList: document.getElementById('history-list'),

      // UI helpers
      blockLoan: document.getElementById('block-loan'),
      sortInfo: document.getElementById('sort-info'),
      btnText: document.getElementById('btn-text'),
      btnSpinner: document.getElementById('btn-spinner'),
    };
  }

  setupEventListeners() {
    this.elements.modeRadios?.forEach(r => {
      r.addEventListener('change', () => this.handleModeChange());
    });

    this.elements.product?.addEventListener('change', () => this.loadInitialData());
    this.elements.btnRun?.addEventListener('click', () => this.runCalculation());
    this.elements.btnSave?.addEventListener('click', () => this.saveCalculation());
    this.elements.btnExportCSV?.addEventListener('click', () => this.exportToCSV());
    this.elements.btnExportJSON?.addEventListener('click', () => this.exportToJSON());
    this.elements.btnClearHistory?.addEventListener('click', () => this.clearCalculationHistory());

    // เลขล้วน + format
    const numeric = [
      'income','debt','incomeExtra','age','years','property','loanAmount'
    ].map(id => this.elements[id]).filter(Boolean);

    numeric.forEach(input => {
      input.addEventListener('input', e => { e.target.value = e.target.value.replace(/[^0-9]/g, ''); });
      input.addEventListener('blur', e => {
        const v = parseInt(e.target.value, 10) || 0;
        if (v > 0 && !['age','years'].includes(e.target.id)) {
          e.target.dataset.rawValue = v;
          e.target.value = v.toLocaleString();
        }
      });
      input.addEventListener('focus', e => {
        if (e.target.dataset.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    });

    // keyboard
    document.addEventListener('keydown', (e) => {
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'Enter') { e.preventDefault(); this.runCalculation(); }
      if (e.key === 's')     { e.preventDefault(); this.saveCalculation(); }
      if (e.key === 'e')     { e.preventDefault(); this.exportToCSV(); }
    });

    // auth listener -> refresh UI
    try {
      getAM()?.addAuthListener?.(() => this.updateAuthUI?.());
    } catch (_) {}
  }

  // -------------------- data/bootstrap --------------------
  async loadInitialData() {
    try {
      const productType = this.elements.product?.value || 'MORTGAGE';
      const [banks, promotions] = await Promise.all([
        DataManager.getBanks?.() ?? [],
        DataManager.getActivePromotions?.(productType) ?? []
      ]);

      if (this.elements.banksCount) this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.lastUpdated) this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (e) {
      console.warn('loadInitialData error:', e);
    }
  }

  // -------------------- run calculation --------------------
  async runCalculation() {
    if (this.isCalculating) return this.notify('กำลังคำนวณอยู่', 'warning');

    const params = this.getFormParameters();
    if (!this.validateParameters(params)) return;

    this.setCalculatingState(true);
    this.clearResults();

    try {
      const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
      let results = [];
      if (mode === 'max') results = await this.calculator.calculateMaxLoanAmount(params);
      else                results = await this.calculator.checkLoanAmount(params);

      this.currentResults = results;
      this.currentParams = { ...params, calculationMode: mode };

      this.displayResults(results, mode);
      this.updateStatistics(results);

      if (results.length) {
        await this.calculator.saveCalculation(params, results, mode);
        this.loadCalculationHistory();
      }
    } catch (e) {
      console.error(e);
      this.notify('เกิดข้อผิดพลาดในการคำนวณ', 'error');
    } finally {
      this.setCalculatingState(false);
    }
  }

  getFormParameters() {
    return {
      productType: this.elements.product?.value || 'MORTGAGE',
      income: this.getRaw(this.elements.income),
      debt: this.getRaw(this.elements.debt),
      incomeExtra: this.getRaw(this.elements.incomeExtra),
      age: parseInt(this.elements.age?.value, 10) || 30,
      years: parseInt(this.elements.years?.value, 10) || 20,
      propertyValue: this.getRaw(this.elements.property),
      propertyType: this.elements.propertyType?.value || null,
      homeNumber: parseInt(this.elements.homeNumber?.value, 10) || null,
      loanAmount: this.getRaw(this.elements.loanAmount)
    };
  }
  getRaw(el){ if(!el) return 0; return parseInt(el.dataset.rawValue || String(el.value).replace(/,/g,''),10)||0; }

  validateParameters(p){
    const errors = [];
    if (p.income <= 0) errors.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errors.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errors.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if (['MORTGAGE','REFINANCE'].includes(p.productType) && p.propertyValue <= 0) errors.push('กรุณากรอกมูลค่าหลักประกัน');

    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (mode === 'check' && p.loanAmount <= 0) errors.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errors.length){ this.notify(errors.join('<br>'),'error'); return false; }
    return true;
  }

  // -------------------- render --------------------
  displayResults(results, mode){
    if (!results || !results.length){ this.displayNoResults(); return; }
    const tbody = this.elements.offers; if (!tbody) return;
    tbody.innerHTML = '';
    results.forEach(r => {
      const tr = document.createElement('tr');
      tr.className = r.status === 'APPROVED' ? 'status-approved' : 'status-rejected';
      tr.innerHTML = `
        <td><strong>${r.bankShortName ?? '-'}</strong><div style="font-size:.8em;color:#666">${r.bankName ?? ''}</div></td>
        <td>${r.promotion ? `<div class="promo-badge">${r.promotion.title}</div><div style="font-size:.8em;color:#666">${r.promotion.description ?? ''}</div>` : '<span style="color:#999">ไม่มีโปรโมชัน</span>'}</td>
        <td><strong>${(r.interestRate ?? 0).toFixed(2)}%</strong>${r.promotion?.year1Rate ? `<div style="font-size:.8em;color:#666">ปี 1: ${r.promotion.year1Rate}%</div>`:''}</td>
        <td><strong>${this.money(r.monthlyPayment)}</strong></td>
        <td><strong>${this.money(r.maxLoanAmount ?? r.loanAmount)}</strong></td>
        <td><span class="${(r.dsr ?? 0) > 70 ? 'text-warning':'text-success'}">${(r.dsr ?? 0).toFixed(2)}%</span></td>
        <td><span class="${(r.ltv ?? 0) > 90 ? 'text-warning':'text-success'}">${(r.ltv ?? 0).toFixed(2)}%</span></td>
        <td><span class="status-${String(r.status||'').toLowerCase()}">${r.status==='APPROVED'?'✅ อนุมัติ':'❌ ไม่อนุมัติ'}</span>${r.reasons?`<div style="font-size:.8em;color:#dc3545">${r.reasons}</div>`:''}</td>
      `;
      tbody.appendChild(tr);
    });

    // summary
    const approved = results.filter(x=>x.status==='APPROVED');
    const best = approved[0];
    if (this.elements.summary){
      if (!best){ this.elements.summary.innerHTML = `<div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5"><h4 style="color:#dc3545">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4><p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p></div>`; }
      else {
        this.elements.summary.innerHTML = (mode==='max')
          ? `<div class="summary-highlight"><h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
              <div class="summary-grid"><div><strong>วงเงินสูงสุด:</strong> ${this.money(best.maxLoanAmount)}</div>
              <div><strong>ค่างวด/เดือน:</strong> ${this.money(best.monthlyPayment)}</div>
              <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate??0).toFixed(2)}%</div>
              <div><strong>DSR:</strong> ${(best.dsr??0).toFixed(2)}%</div>
              <div><strong>LTV:</strong> ${(best.ltv??0).toFixed(2)}%</div>
              ${best.promotion?`<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>`:''}</div></div>`
          : `<div class="summary-highlight"><h4>🎯 ข้อเสนอที่ดีที่สุด: ${best.bankShortName}</h4>
              <div class="summary-grid"><div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>
              <div><strong>ค่างวด/เดือน:</strong> ${this.money(best.monthlyPayment)}</div>
              <div><strong>อัตราดอกเบี้ย:</strong> ${(best.interestRate??0).toFixed(2)}%</div>
              <div><strong>DSR:</strong> ${(best.dsr??0).toFixed(2)}%</div>
              <div><strong>LTV:</strong> ${(best.ltv??0).toFixed(2)}%</div>
              ${best.promotion?`<div><strong>โปรโมชัน:</strong> ${best.promotion.title}</div>`:''}</div></div>`;
      }
    }

    this.showExportOptions(true);
  }

  displayNoResults(){
    if (this.elements.offers) {
      this.elements.offers.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">ไม่พบข้อเสนอที่เหมาะสม กรุณาคำนวณเพื่อดูผลลัพธ์</td></tr>`;
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    this.showExportOptions(false);
  }

  updateStatistics(results){
    const approved = results.filter(r=>r.status==='APPROVED');
    const rejected = results.filter(r=>r.status==='REJECTED');
    const rates = approved.map(r=>r.interestRate).filter(x=>x>0);
    const avg = rates.length ? (rates.reduce((a,b)=>a+b,0)/rates.length) : 0;

    if (this.elements.totalOffers) this.elements.totalOffers.textContent = results.length;
    if (this.elements.approvedOffers) this.elements.approvedOffers.textContent = approved.length;
    if (this.elements.rejectedOffers) this.elements.rejectedOffers.textContent = rejected.length;
    if (this.elements.avgRate) this.elements.avgRate.textContent = avg ? avg.toFixed(2) : '—';
  }

  // -------------------- history --------------------
  async loadCalculationHistory(){
    try{
      const items = await (DataManager.getUserCalculations?.(10) ?? []);
      if (!this.elements.calculationHistory || !this.elements.historyList) return;
      if (!items.length){ this.elements.calculationHistory.style.display = 'none'; return; }

      this.elements.calculationHistory.style.display = 'block';
      const list = this.elements.historyList; list.innerHTML='';
      items.forEach(c=>{
        const el = document.createElement('div');
        el.className = 'history-item';
        const t = new Date(c.created_at).toLocaleString('th-TH');
        const pText = this.productText(c.product_type);
        const modeText = c.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';
        el.innerHTML = `<div style="display:flex;justify-content:space-between;align-items:center">
          <div><strong>${pText}</strong> - ${modeText}
          <div style="font-size:.8em;color:#666">รายได้: ${this.money(c.income)}${c.loan_amount?` | วงเงิน: ${this.money(c.loan_amount)}`:''}</div></div>
          <div style="font-size:.8em;color:#999">${t}</div></div>`;
        el.addEventListener('click',()=>this.loadCalculationFromHistory(c));
        list.appendChild(el);
      });
    }catch(e){ console.warn('loadCalculationHistory error:', e); }
  }

  loadCalculationFromHistory(c){
    const set = (el, v)=>{ if (el) el.value = v ?? ''; };
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
    if (radio){ radio.checked = true; this.handleModeChange(); }

    if (c.results?.calculationResults){
      this.currentResults = c.results.calculationResults;
      this.displayResults(this.currentResults, c.calculation_mode);
      this.updateStatistics(this.currentResults);
    }
    this.notify('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว','success');
  }

  async clearCalculationHistory(){
    if (!confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;
    try{
      // ถ้าต้องการลบจริงให้ทำที่ DataManager; ตอนนี้ซ่อนใน UI ไว้ก่อน
      if (this.elements.calculationHistory) this.elements.calculationHistory.style.display='none';
      this.notify('ล้างประวัติเรียบร้อยแล้ว','info');
    }catch(_){ this.notify('ไม่สามารถล้างประวัติได้','error'); }
  }

  // -------------------- export/save --------------------
  async saveCalculation(){
    if (!this.currentResults.length) return this.notify('ไม่มีผลการคำนวณให้บันทึก','warning');
    try{
      await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      this.notify('บันทึกการคำนวณเรียบร้อยแล้ว','success');
      this.loadCalculationHistory();
    }catch(_){ this.notify('ไม่สามารถบันทึกได้','error'); }
  }
  exportToCSV(){
    if (!this.currentResults.length) return this.notify('ไม่มีข้อมูลให้ export','warning');
    try{
      const csv = LoanCalculator.exportToCSV(this.currentResults);
      this.download(csv,'loan-calculation.csv','text/csv');
      this.notify('Export CSV เรียบร้อยแล้ว','success');
    }catch(_){ this.notify('ไม่สามารถ export ได้','error'); }
  }
  exportToJSON(){
    if (!this.currentResults.length) return this.notify('ไม่มีข้อมูลให้ export','warning');
    try{
      const json = LoanCalculator.exportToJSON(this.currentResults, this.currentParams);
      this.download(json,'loan-calculation.json','application/json');
      this.notify('Export JSON เรียบร้อยแล้ว','success');
    }catch(_){ this.notify('ไม่สามารถ export ได้','error'); }
  }

  // -------------------- small utils --------------------
  handleModeChange(){
    const mode = document.querySelector('input[name="mode"]:checked')?.value || 'max';
    if (this.elements.blockLoan) this.elements.blockLoan.style.display = (mode==='check'?'block':'none');
    if (this.elements.sortInfo) this.elements.sortInfo.textContent = (mode==='check' ? '(เรียงตาม DSR ต่ำสุด)' : '(เรียงตามวงเงินสูงสุด)');
    this.clearResults();
  }
  setCalculatingState(b){
    this.isCalculating = b;
    if (this.elements.btnText) this.elements.btnText.textContent = b ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.elements.btnSpinner) this.elements.btnSpinner.style.display = b ? 'inline-block' : 'none';
    if (this.elements.btnRun) this.elements.btnRun.disabled = b;
  }
  clearResults(){
    this.currentResults = [];
    if (this.elements.offers) this.elements.offers.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:20px;color:#666">กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>`;
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    ['totalOffers','approvedOffers','rejectedOffers','avgRate'].forEach(k=>{ if (this.elements[k]) this.elements[k].textContent='—'; });
    this.showExportOptions(false);
  }
  showExportOptions(show){
    [this.elements.btnSave,this.elements.btnExportCSV,this.elements.btnExportJSON].forEach(b=>{ if (b) b.style.display = show?'inline-block':'none'; });
  }
  updateConnectionStatus(ok){
    if (!this.elements.connectionStatus) return;
    this.elements.connectionStatus.innerHTML = ok ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่สามารถเชื่อมต่อได้';
    this.elements.connectionStatus.style.color = ok ? '#28a745' : '#dc3545';
  }
  notify(msg,type='info',ms=3000){
    const div = document.createElement('div');
    const colors = {success:'bg-green-100 text-green-800 border-green-300',error:'bg-red-100 text-red-800 border-red-300',info:'bg-blue-100 text-blue-800 border-blue-300',warning:'bg-yellow-100 text-yellow-800 border-yellow-300'};
    div.className = `notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm ${colors[type]||colors.info}`;
    div.innerHTML = msg;
    document.body.appendChild(div);
    setTimeout(()=>div.remove(), ms);
  }
  money(n){ if(!n) return '—'; return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:0,maximumFractionDigits:0}).format(n); }
  productText(t){ return ({MORTGAGE:'สินเชื่อบ้าน',REFINANCE:'รีไฟแนนซ์',PERSONAL:'สินเชื่อส่วนบุคคล',SME:'สินเชื่อ SME'})[t] || t; }

  download(content, filename, mime){
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  // optional cleanup
  cleanup(){
    try{ this.calculator?.cleanup?.(); }catch(_){}
    try{ DataManager?.clearAllCache?.(); }catch(_){}
  }
}

// auto-cleanup
if (typeof window !== 'undefined'){
  window.addEventListener('beforeunload', ()=>{
    if (window.loanApp && typeof window.loanApp.cleanup === 'function'){
      window.loanApp.cleanup();
    }
  });
}

// helper สำหรับหน้าเก่าที่เรียกแบบฟังก์ชัน
export function runLoanPage(){
  const app = new LoanAppManager();
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', ()=> app.initialize());
  } else {
    app.initialize();
  }
  window.loanApp = app;
  return app;
}

export default LoanAppManager;
