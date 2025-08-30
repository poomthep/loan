/* ============================================================================
 * loan-app-manager.js  (ESM, conservative, no dot-access to .default)
 * ========================================================================== */
'use strict';

// --------- Safe resolve for default/named exports (no dot-access) ----------
import * as __DataManagerNS from './data-manager.js';
import * as __LoanCalcNS   from './loan-calculator-supabase.js';

// /js/data-manager.js
export * from './data-manager.fix.js';
import * as NS from './data-manager.fix.js';
export default (NS.default ?? NS);


function resolveModule(ns) {
  try {
    if (ns && typeof ns === 'object') {
      var hasDef = false;
      try { hasDef = Object.prototype.hasOwnProperty.call(ns, 'default'); } catch (e) {}
      if (hasDef) {
        var d = null;
        try { d = ns['default']; } catch (e) {}
        if (d) return d;
      }
      // บางบันเดิลใส่ __esModule ไว้
      try {
        if (ns['__esModule'] && ns['default']) return ns['default'];
      } catch (e) {}
    }
  } catch (e) {}
  return ns;
}

var DataManager        = resolveModule(__DataManagerNS);
var LoanCalculatorCtor = resolveModule(__LoanCalcNS);

// --------- AuthManager helpers (read from window) ----------
function getAM() {
  if (typeof window !== 'undefined' && window.AuthManager) return window.AuthManager;
  throw new Error('AuthManager ยังไม่พร้อม');
}

function waitForAuthManager(timeoutMs) {
  timeoutMs = typeof timeoutMs === 'number' ? timeoutMs : 4000;
  return new Promise(function (resolve, reject) {
    var start = Date.now();
    (function loop() {
      if (typeof window !== 'undefined' && window.AuthManager) {
        try {
          var am = window.AuthManager;
          if (typeof am.initialize === 'function') {
            am.initialize().then(function(){ resolve(am); }).catch(function(){ resolve(am); });
          } else {
            resolve(am);
          }
        } catch (e) { resolve(window.AuthManager); }
        return;
      }
      if (Date.now() - start >= timeoutMs) return reject(new Error('AuthManager ยังไม่พร้อม'));
      setTimeout(loop, 60);
    })();
  });
}

// ==========================================================================
// Main
// ==========================================================================
export class LoanAppManager {
  constructor() {
    try {
      this.calculator = (typeof LoanCalculatorCtor === 'function')
        ? new LoanCalculatorCtor()
        : LoanCalculatorCtor;
    } catch (e) {
      this.calculator = LoanCalculatorCtor;
    }

    this.currentResults = [];
    this.currentParams  = {};
    this.isCalculating  = false;
    this.elements = {};
  }

  async initialize() {
    console.log('🚀 Initializing Loan App...');
    await waitForAuthManager();

    this.bindElements();
    this.setupEventListeners();

    try {
      var ok = true;
      if (DataManager && typeof DataManager.checkDatabaseConnection === 'function') {
        ok = await DataManager.checkDatabaseConnection();
      }
      this.updateConnectionStatus(!!ok);
    } catch (e) {
      console.warn('checkDatabaseConnection error:', e);
      this.updateConnectionStatus(false);
    }

    await this.loadInitialData();
    await this.loadCalculationHistory();

    try {
      var am = getAM();
      if (am && typeof am.addAuthListener === 'function') {
        var self = this;
        am.addAuthListener(function(){ if (typeof self.updateAuthUI === 'function') self.updateAuthUI(); });
      }
    } catch (e) {}

    console.log('✅ Loan App ready');
  }

  // -------------------- DOM --------------------
  bindElements() {
    var $ = function(id){ return document.getElementById(id); };
    this.elements = {
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

      btnRun:         $('btn-run'),
      btnSave:        $('btn-save-calculation'),
      btnExportCSV:   $('btn-export-csv'),
      btnExportJSON:  $('btn-export-json'),
      btnClearHistory:$('btn-clear-history'),

      offers:   $('offers'),
      summary:  $('caps'),

      totalOffers:    $('total-offers'),
      approvedOffers: $('approved-offers'),
      rejectedOffers: $('rejected-offers'),
      avgRate:        $('avg-rate'),

      connectionStatus: $('connection-status'),
      banksCount:       $('banks-count'),
      promotionsCount:  $('promotions-count'),
      lastUpdated:      $('last-updated'),

      calculationHistory: $('calculation-history'),
      historyList:        $('history-list'),

      blockLoan:  $('block-loan'),
      sortInfo:   $('sort-info'),
      btnText:    $('btn-text'),
      btnSpinner: $('btn-spinner')
    };
  }

  setupEventListeners() {
    var self = this;

    if (this.elements.modeRadios && this.elements.modeRadios.forEach) {
      this.elements.modeRadios.forEach(function(r){
        r.addEventListener('change', function(){ self.handleModeChange(); });
      });
    }

    if (this.elements.product) {
      this.elements.product.addEventListener('change', function(){ self.loadInitialData(); });
    }

    if (this.elements.btnRun)        this.elements.btnRun.addEventListener('click', function(){ self.runCalculation(); });
    if (this.elements.btnSave)       this.elements.btnSave.addEventListener('click', function(){ self.saveCalculation(); });
    if (this.elements.btnExportCSV)  this.elements.btnExportCSV.addEventListener('click', function(){ self.exportToCSV(); });
    if (this.elements.btnExportJSON) this.elements.btnExportJSON.addEventListener('click', function(){ self.exportToJSON(); });
    if (this.elements.btnClearHistory) this.elements.btnClearHistory.addEventListener('click', function(){ self.clearCalculationHistory(); });

    // numeric/format
    var ids = ['income','debt','incomeExtra','age','years','property','loanAmount'];
    for (var i=0;i<ids.length;i++) {
      var el = this.elements[ids[i]];
      if (!el) continue;
      el.addEventListener('input', function(e){ e.target.value = String(e.target.value).replace(/[^0-9]/g,''); });
      el.addEventListener('blur', function(e){
        var v = parseInt(e.target.value,10)||0;
        if (v>0 && e.target.id !== 'age' && e.target.id !== 'years') {
          if (!e.target.dataset) e.target.dataset = {};
          e.target.dataset.rawValue = v;
          e.target.value = v.toLocaleString();
        }
      });
      el.addEventListener('focus', function(e){
        if (e.target.dataset && e.target.dataset.rawValue) e.target.value = e.target.dataset.rawValue;
      });
    }

    // keyboard
    document.addEventListener('keydown', function(e){
      if (!e.ctrlKey && !e.metaKey) return;
      if (e.key === 'Enter') { e.preventDefault(); self.runCalculation(); }
      if (e.key === 's')     { e.preventDefault(); self.saveCalculation(); }
      if (e.key === 'e')     { e.preventDefault(); self.exportToCSV(); }
    });
  }

  // -------------------- initial data --------------------
  async loadInitialData() {
    try {
      var productType = (this.elements.product && this.elements.product.value) ? this.elements.product.value : 'MORTGAGE';

      var banks = [];
      var promotions = [];
      if (DataManager && typeof DataManager.getBanks === 'function') {
        banks = await DataManager.getBanks();
      }
      if (DataManager && typeof DataManager.getActivePromotions === 'function') {
        promotions = await DataManager.getActivePromotions(productType);
      }

      if (this.elements.banksCount)      this.elements.banksCount.textContent = banks.length;
      if (this.elements.promotionsCount) this.elements.promotionsCount.textContent = promotions.length;
      if (this.elements.lastUpdated)     this.elements.lastUpdated.textContent = new Date().toLocaleString('th-TH');
    } catch (e) {
      console.warn('loadInitialData error:', e);
    }
  }

  // -------------------- run calculation --------------------
  async runCalculation() {
    if (this.isCalculating) { this.notify('กำลังคำนวณอยู่', 'warning'); return; }

    var params = this.getFormParameters();
    if (!this.validateParameters(params)) return;

    this.setCalculatingState(true);
    this.clearResults();

    try {
      var modeRadio = document.querySelector('input[name="mode"]:checked');
      var mode = modeRadio ? modeRadio.value : 'max';

      var results = [];
      if (mode === 'max') {
        results = await this.calculator.calculateMaxLoanAmount(params);
      } else {
        results = await this.calculator.checkLoanAmount(params);
      }

      this.currentResults = results;
      this.currentParams  = { 
        productType: params.productType,
        income: params.income, debt: params.debt, incomeExtra: params.incomeExtra,
        age: params.age, years: params.years,
        propertyValue: params.propertyValue, propertyType: params.propertyType, homeNumber: params.homeNumber,
        loanAmount: params.loanAmount,
        calculationMode: mode
      };

      this.displayResults(results, mode);
      this.updateStatistics(results);

      try {
        if (results && results.length && this.calculator && typeof this.calculator.saveCalculation === 'function') {
          await this.calculator.saveCalculation(params, results, mode);
          await this.loadCalculationHistory();
        }
      } catch (e) { console.warn('saveCalculation error:', e); }

    } catch (e) {
      console.error(e);
      this.notify('เกิดข้อผิดพลาดในการคำนวณ', 'error');
    } finally {
      this.setCalculatingState(false);
    }
  }

  getFormParameters() {
    return {
      productType: (this.elements.product && this.elements.product.value) ? this.elements.product.value : 'MORTGAGE',
      income:      this.getRaw(this.elements.income),
      debt:        this.getRaw(this.elements.debt),
      incomeExtra: this.getRaw(this.elements.incomeExtra),
      age:   parseInt(this.elements.age && this.elements.age.value,10)   || 30,
      years: parseInt(this.elements.years && this.elements.years.value,10)|| 20,
      propertyValue: this.getRaw(this.elements.property),
      propertyType:  this.elements.propertyType ? this.elements.propertyType.value : null,
      homeNumber:    parseInt(this.elements.homeNumber && this.elements.homeNumber.value,10) || null,
      loanAmount:    this.getRaw(this.elements.loanAmount)
    };
  }
  getRaw(el){ if(!el) return 0; var s = (el && el.dataset && el.dataset.rawValue) ? el.dataset.rawValue : String(el.value||'').replace(/,/g,''); var n = parseInt(s,10); return isNaN(n)?0:n; }

  validateParameters(p){
    var errs = [];
    if (p.income <= 0) errs.push('กรุณากรอกรายได้');
    if (p.age < 18 || p.age > 80) errs.push('อายุต้องอยู่ระหว่าง 18-80 ปี');
    if (p.years < 1 || p.years > 35) errs.push('ระยะเวลาผ่อนต้องอยู่ระหว่าง 1-35 ปี');
    if ((p.productType === 'MORTGAGE' || p.productType === 'REFINANCE') && p.propertyValue <= 0) errs.push('กรุณากรอกมูลค่าหลักประกัน');

    var modeEl = document.querySelector('input[name="mode"]:checked');
    var mode = modeEl ? modeEl.value : 'max';
    if (mode === 'check' && p.loanAmount <= 0) errs.push('กรุณากรอกวงเงินที่ต้องการกู้');

    if (errs.length){ this.notify(errs.join('<br>'),'error'); return false; }
    return true;
  }

  // -------------------- render --------------------
  displayResults(results, mode){
    if (!results || !results.length){ this.displayNoResults(); return; }

    var tbody = this.elements.offers;
    if (!tbody) return;
    tbody.innerHTML = '';

    for (var i=0;i<results.length;i++){
      var r = results[i];
      var tr = document.createElement('tr');
      tr.className = (r.status === 'APPROVED') ? 'status-approved' : 'status-rejected';
      tr.innerHTML =
        '<td><strong>'+(r.bankShortName||'-')+'</strong><div style="font-size:.8em;color:#666">'+(r.bankName||'')+'</div></td>'+
        '<td>'+(r.promotion
          ? ('<div class="promo-badge">'+r.promotion.title+'</div><div style="font-size:.8em;color:#666">'+(r.promotion.description||'')+'</div>')
          : '<span style="color:#999">ไม่มีโปรโมชัน</span>')+'</td>'+
        '<td><strong>'+((r.interestRate||0).toFixed(2))+'%</strong>'+(r.promotion&&r.promotion.year1Rate
          ? ('<div style="font-size:.8em;color:#666">ปี 1: '+r.promotion.year1Rate+'%</div>')
          : '')+'</td>'+
        '<td><strong>'+this.money(r.monthlyPayment)+'</strong></td>'+
        '<td><strong>'+this.money((r.maxLoanAmount!=null?r.maxLoanAmount:r.loanAmount))+'</strong></td>'+
        '<td><span class="'+(((r.dsr||0)>70)?'text-warning':'text-success')+'">'+((r.dsr||0).toFixed(2))+'%</span></td>'+
        '<td><span class="'+(((r.ltv||0)>90)?'text-warning':'text-success')+'">'+((r.ltv||0).toFixed(2))+'%</span></td>'+
        '<td><span class="status-'+String(r.status||'').toLowerCase()+'">'+(r.status==='APPROVED'?'✅ อนุมัติ':'❌ ไม่อนุมัติ')+'</span>'+(r.reasons?'<div style="font-size:.8em;color:#dc3545">'+r.reasons+'</div>':'')+'</td>';
      tbody.appendChild(tr);
    }

    var approved = results.filter(function(x){ return x.status==='APPROVED'; });
    var best = approved[0];
    if (this.elements.summary){
      if (!best){
        this.elements.summary.innerHTML = '<div class="summary-highlight" style="border-color:#dc3545;background:#fff5f5"><h4 style="color:#dc3545">❌ ไม่มีธนาคารที่สามารถอนุมัติได้</h4><p>ลองปรับเงื่อนไข เช่น เพิ่มรายได้ ลดภาระหนี้ หรือลดวงเงินที่ต้องการ</p></div>';
      } else {
        this.elements.summary.innerHTML =
          (mode==='max'
            ? ('<div class="summary-highlight"><h4>🎯 ข้อเสนอที่ดีที่สุด: '+best.bankShortName+'</h4>'+
               '<div class="summary-grid">'+
               '<div><strong>วงเงินสูงสุด:</strong> '+this.money(best.maxLoanAmount)+'</div>'+
               '<div><strong>ค่างวด/เดือน:</strong> '+this.money(best.monthlyPayment)+'</div>'+
               '<div><strong>อัตราดอกเบี้ย:</strong> '+((best.interestRate||0).toFixed(2))+'%</div>'+
               '<div><strong>DSR:</strong> '+((best.dsr||0).toFixed(2))+'%</div>'+
               '<div><strong>LTV:</strong> '+((best.ltv||0).toFixed(2))+'%</div>'+
               (best.promotion?('<div><strong>โปรโมชัน:</strong> '+best.promotion.title+'</div>'):'')+
               '</div></div>')
            : ('<div class="summary-highlight"><h4>🎯 ข้อเสนอที่ดีที่สุด: '+best.bankShortName+'</h4>'+
               '<div class="summary-grid">'+
               '<div><strong>สถานะ:</strong> <span class="status-approved">อนุมัติ</span></div>'+
               '<div><strong>ค่างวด/เดือน:</strong> '+this.money(best.monthlyPayment)+'</div>'+
               '<div><strong>อัตราดอกเบี้ย:</strong> '+((best.interestRate||0).toFixed(2))+'%</div>'+
               '<div><strong>DSR:</strong> '+((best.dsr||0).toFixed(2))+'%</div>'+
               '<div><strong>LTV:</strong> '+((best.ltv||0).toFixed(2))+'%</div>'+
               (best.promotion?('<div><strong>โปรโมชัน:</strong> '+best.promotion.title+'</div>'):'')+
               '</div></div>')
          );
      }
    }

    this.showExportOptions(true);
  }

  displayNoResults(){
    if (this.elements.offers) {
      this.elements.offers.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#999">ไม่พบข้อเสนอที่เหมาะสม กรุณาคำนวณเพื่อดูผลลัพธ์</td></tr>';
    }
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    this.showExportOptions(false);
  }

  updateStatistics(results){
    var approved = results.filter(function(r){ return r.status==='APPROVED'; });
    var rejected = results.filter(function(r){ return r.status==='REJECTED'; });
    var rates = approved.map(function(r){ return r.interestRate; }).filter(function(x){ return x>0; });
    var avg = rates.length ? (rates.reduce(function(a,b){return a+b;},0)/rates.length) : 0;

    if (this.elements.totalOffers)    this.elements.totalOffers.textContent = results.length;
    if (this.elements.approvedOffers) this.elements.approvedOffers.textContent = approved.length;
    if (this.elements.rejectedOffers) this.elements.rejectedOffers.textContent = rejected.length;
    if (this.elements.avgRate)        this.elements.avgRate.textContent = avg ? avg.toFixed(2) : '—';
  }

  // -------------------- history --------------------
  async loadCalculationHistory(){
    try{
      var list = [];
      if (DataManager && typeof DataManager.getUserCalculations === 'function') {
        list = await DataManager.getUserCalculations(10);
      }
      if (!this.elements.calculationHistory || !this.elements.historyList) return;
      if (!list || !list.length){ this.elements.calculationHistory.style.display='none'; return; }

      this.elements.calculationHistory.style.display='block';
      var container = this.elements.historyList;
      container.innerHTML = '';
      for (var i=0;i<list.length;i++){
        var c = list[i];
        var div = document.createElement('div');
        div.className = 'history-item';
        var date = new Date(c.created_at).toLocaleString('th-TH');
        var ptext = this.productText(c.product_type);
        var mtext = c.calculation_mode === 'max' ? 'วงเงินสูงสุด' : 'ตรวจสอบวงเงิน';
        div.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center">'+
          '<div><strong>'+ptext+'</strong> - '+mtext+'<div style="font-size:.8em;color:#666">รายได้: '+this.money(c.income)+(c.loan_amount?(' | วงเงิน: '+this.money(c.loan_amount)):'')+'</div></div>'+
          '<div style="font-size:.8em;color:#999">'+date+'</div></div>';
        (function(cal, self){
          div.addEventListener('click', function(){ self.loadCalculationFromHistory(cal); });
        })(c, this);
        container.appendChild(div);
      }
    }catch(e){ console.warn('loadCalculationHistory error:', e); }
  }

  loadCalculationFromHistory(c){
    function set(el, v){ if (el) el.value = (v!=null?v:''); }
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

    var radio = document.querySelector('input[name="mode"][value="'+c.calculation_mode+'"]');
    if (radio){ radio.checked = true; this.handleModeChange(); }

    if (c.results && c.results.calculationResults){
      this.currentResults = c.results.calculationResults;
      this.displayResults(this.currentResults, c.calculation_mode);
      this.updateStatistics(this.currentResults);
    }
    this.notify('โหลดข้อมูลจากประวัติเรียบร้อยแล้ว','success');
  }

  async clearCalculationHistory(){
    if (!confirm('คุณต้องการล้างประวัติการคำนวณทั้งหมดหรือไม่?')) return;
    try{
      if (this.elements.calculationHistory) this.elements.calculationHistory.style.display='none';
      this.notify('ล้างประวัติเรียบร้อยแล้ว','info');
    }catch(e){ this.notify('ไม่สามารถล้างประวัติได้','error'); }
  }

  // -------------------- export/save --------------------
  async saveCalculation(){
    if (!this.currentResults.length) { this.notify('ไม่มีผลการคำนวณให้บันทึก','warning'); return; }
    try{
      if (this.calculator && typeof this.calculator.saveCalculation === 'function') {
        await this.calculator.saveCalculation(this.currentParams, this.currentResults, this.currentParams.calculationMode);
      }
      this.notify('บันทึกการคำนวณเรียบร้อยแล้ว','success');
      this.loadCalculationHistory();
    }catch(e){ this.notify('ไม่สามารถบันทึกได้','error'); }
  }
  exportToCSV(){
    if (!this.currentResults.length) { this.notify('ไม่มีข้อมูลให้ export','warning'); return; }
    try{
      var csv = (LoanCalculatorCtor && typeof LoanCalculatorCtor.exportToCSV === 'function')
        ? LoanCalculatorCtor.exportToCSV(this.currentResults)
        : '';
      this.download(csv,'loan-calculation.csv','text/csv');
      this.notify('Export CSV เรียบร้อยแล้ว','success');
    }catch(e){ this.notify('ไม่สามารถ export ได้','error'); }
  }
  exportToJSON(){
    if (!this.currentResults.length) { this.notify('ไม่มีข้อมูลให้ export','warning'); return; }
    try{
      var json = (LoanCalculatorCtor && typeof LoanCalculatorCtor.exportToJSON === 'function')
        ? LoanCalculatorCtor.exportToJSON(this.currentResults, this.currentParams)
        : JSON.stringify({results:this.currentResults, params:this.currentParams}, null, 2);
      this.download(json,'loan-calculation.json','application/json');
      this.notify('Export JSON เรียบร้อยแล้ว','success');
    }catch(e){ this.notify('ไม่สามารถ export ได้','error'); }
  }

  // -------------------- misc utils --------------------
  handleModeChange(){
    var modeEl = document.querySelector('input[name="mode"]:checked');
    var mode = modeEl ? modeEl.value : 'max';
    if (this.elements.blockLoan) this.elements.blockLoan.style.display = (mode==='check'?'block':'none');
    if (this.elements.sortInfo)  this.elements.sortInfo.textContent  = (mode==='check'?'(เรียงตาม DSR ต่ำสุด)':'(เรียงตามวงเงินสูงสุด)');
    this.clearResults();
  }

  setCalculatingState(b){
    this.isCalculating = b;
    if (this.elements.btnText)    this.elements.btnText.textContent = b ? 'กำลังคำนวณ...' : 'คำนวณ';
    if (this.elements.btnSpinner) this.elements.btnSpinner.style.display = b ? 'inline-block' : 'none';
    if (this.elements.btnRun)     this.elements.btnRun.disabled = b;
  }

  clearResults(){
    this.currentResults = [];
    if (this.elements.offers)  this.elements.offers.innerHTML = '<tr><td colspan="8" style="text-align:center;padding:20px;color:#666">กรุณาคำนวณเพื่อดูข้อเสนอ</td></tr>';
    if (this.elements.summary) this.elements.summary.innerHTML = '';
    var keys = ['totalOffers','approvedOffers','rejectedOffers','avgRate'];
    for (var i=0;i<keys.length;i++){ if (this.elements[keys[i]]) this.elements[keys[i]].textContent='—'; }
    this.showExportOptions(false);
  }

  showExportOptions(show){
    var btns = [this.elements.btnSave,this.elements.btnExportCSV,this.elements.btnExportJSON];
    for (var i=0;i<btns.length;i++){ if (btns[i]) btns[i].style.display = show ? 'inline-block' : 'none'; }
  }

  updateConnectionStatus(ok){
    if (!this.elements.connectionStatus) return;
    this.elements.connectionStatus.innerHTML = ok ? '🟢 เชื่อมต่อแล้ว' : '🔴 ไม่สามารถเชื่อมต่อได้';
    this.elements.connectionStatus.style.color = ok ? '#28a745' : '#dc3545';
  }

  notify(message, type, duration){
    type = type || 'info';
    duration = typeof duration === 'number' ? duration : 3000;
    var colors = {
      success:'bg-green-100 text-green-800 border-green-300',
      error:'bg-red-100 text-red-800 border-red-300',
      info:'bg-blue-100 text-blue-800 border-blue-300',
      warning:'bg-yellow-100 text-yellow-800 border-yellow-300'
    };
    var n = document.createElement('div');
    n.className = 'notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm '+(colors[type]||colors.info);
    n.innerHTML = message;
    document.body.appendChild(n);
    setTimeout(function(){ try{ n.remove(); }catch(e){} }, duration);
    n.addEventListener('click', function(){ try{ n.remove(); }catch(e){} });
  }

  money(amount){
    if (!amount) return '—';
    try {
      return new Intl.NumberFormat('th-TH',{style:'currency',currency:'THB',minimumFractionDigits:0,maximumFractionDigits:0}).format(amount);
    } catch (e) {
      return String(amount);
    }
  }

  productText(t){
    var map = { MORTGAGE:'สินเชื่อบ้าน', REFINANCE:'รีไฟแนนซ์', PERSONAL:'สินเชื่อส่วนบุคคล', SME:'สินเชื่อ SME' };
    return map[t] || t;
  }

  download(content, filename, mime){
    var blob = new Blob([content], { type: mime });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = filename;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  cleanup(){
    try{ if (this.calculator && typeof this.calculator.cleanup === 'function') this.calculator.cleanup(); }catch(e){}
    try{ if (DataManager && typeof DataManager.clearAllCache === 'function') DataManager.clearAllCache(); }catch(e){}
  }
}

// auto-clean
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', function () {
    if (window.loanApp && typeof window.loanApp.cleanup === 'function') {
      window.loanApp.cleanup();
    }
  });
}

// สำหรับหน้าเก่าที่เรียกแบบฟังก์ชัน
export function runLoanPage(){
  var app = new LoanAppManager();
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', function(){ app.initialize(); });
  } else {
    app.initialize();
  }
  window.loanApp = app;
  return app;
}

export default LoanAppManager;
