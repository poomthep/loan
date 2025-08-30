/*! loan-calculator-supabase.js
 * Loan App – Core Calculator (ES Module)
 * - ใช้ AuthManager แบบ global (window.AuthManager)
 * - รองรับ data-manager.fix.js ทั้งแบบ default/named export
 */

/* ===== Helpers: ใช้ AuthManager แบบ global โดยไม่ import ===== */
const AM = (typeof window !== 'undefined' && window.AuthManager)
  ? window.AuthManager
  : null;

function getAM() {
  if (AM) return AM;
  if (typeof window !== 'undefined' && window.AuthManager) return window.AuthManager;
  throw new Error('AuthManager ยังไม่พร้อม');
}

/* ===== Data Layer =====
   เปลี่ยนเป็น import แบบครอบคลุมทุกกรณี แล้วทำ fallback ให้เป็นอ็อบเจกต์เดียวชื่อ DataManager */
import * as DM from './data-manager.fix.js';
const DataManager = DM.default || DM.DataManager || DM;

/* ===== Utilities (คำนวณทางการเงินพื้นฐาน) ===== */
function pmtRatePerMonth(annualRate) {
  const r = Number(annualRate || 0) / 100;
  return r > 0 ? r / 12 : 0;
}

function calcMonthlyPayment(annualRatePercent, years, principal) {
  const n = (Number(years) || 0) * 12;
  const i = pmtRatePerMonth(annualRatePercent);
  const P = Number(principal) || 0;

  if (n <= 0 || P <= 0) return 0;
  if (i === 0) return P / n;

  const factor = Math.pow(1 + i, n);
  return (P * i * factor) / (factor - 1);
}

/* ===== Core Calculator ===== */
export default class LoanCalculator {
  constructor() {
    this._unsubRealtime = null;
    this.DEFAULT_RATE = 6.5;     // (% ต่อปี)
    this.DEFAULT_DSR_LIMIT = 70; // (%)
    this.DEFAULT_LTV_LIMIT = 90; // (%)
  }

  /* ================= Realtime ================= */
  // ✅ ใช้แทนของเดิมทั้งฟังก์ชัน
  setupRealTimeUpdates(onChange) {
    try {
      if (DataManager && typeof DataManager.subscribeDataChanges === 'function') {
        const unsub = DataManager.subscribeDataChanges((type) => {
          if (typeof onChange === 'function') onChange(type);
        });
        this._unsubRealtime = typeof unsub === 'function' ? unsub : null;
      }
    } catch (e) {
      console.warn('[LoanCalculator] setupRealTimeUpdates skipped:', e?.message || e);
    }
  }

  cleanup() {
    try { if (this._unsubRealtime) this._unsubRealtime(); } catch (_) {}
    this._unsubRealtime = null;
  }

  /* ================ Main APIs ================ */
  async calculateMaxLoanAmount(params) {
    const productType = params?.productType || 'MORTGAGE';
    const [banks, promotions] = await Promise.all([
      DataManager.getBanks(),
      DataManager.getActivePromotions(productType)
    ]);

    const offers = banks.map((bank) =>
      this._buildOfferForBank(bank, params, promotions, 'max')
    );

    offers.sort((a, b) => {
      const ok = (x) => (x.status === 'APPROVED' ? 1 : 0);
      if (ok(a) !== ok(b)) return ok(b) - ok(a);
      return (b.maxLoanAmount || 0) - (a.maxLoanAmount || 0);
    });

    return offers;
  }

  async checkLoanAmount(params) {
    const productType = params?.productType || 'MORTGAGE';
    const [banks, promotions] = await Promise.all([
      DataManager.getBanks(),
      DataManager.getActivePromotions(productType)
    ]);

    const offers = banks.map((bank) =>
      this._buildOfferForBank(bank, params, promotions, 'check')
    );

    offers.sort((a, b) => {
      const ok = (x) => (x.status === 'APPROVED' ? 1 : 0);
      if (ok(a) !== ok(b)) return ok(b) - ok(a);
      return (a.dsr || 999) - (b.dsr || 999);
    });

    return offers;
  }

  // ✅ ใช้แทนของเดิมทั้งฟังก์ชัน
  async saveCalculation(params, results, mode) {
    try {
      const am = getAM();
      const user =
        (typeof am.getCurrentUser === 'function' && am.getCurrentUser()) ||
        (await am.checkSession())?.user ||
        null;

      if (!user) {
        console.info('[LoanCalculator] skip save: guest user');
        return { success: true, skipped: true };
      }

      if (DataManager && typeof DataManager.saveCalculation === 'function') {
        return await DataManager.saveCalculation(params, results, mode);
      }
      return { success: false, error: 'DataManager.saveCalculation() ไม่พร้อม' };
    } catch (err) {
      console.error('[LoanCalculator] saveCalculation error:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  /* ================ Export ================ */
  static exportToCSV(results) {
    if (!Array.isArray(results) || results.length === 0) {
      return 'bank_short,bank_name,promo,rate,monthly,amount,dsr,ltv,status\n';
    }

    const header = [
      'bank_short','bank_name','promo','rate','monthly','amount','dsr','ltv','status'
    ].join(',');

    const lines = results.map((r) => {
      const promo = r.promotion?.title || '';
      const rate = typeof r.interestRate === 'number' ? r.interestRate.toFixed(2) : '';
      const monthly = r.monthlyPayment || r.estimatedMonthly || 0;
      const amount = r.maxLoanAmount || r.loanAmount || 0;
      const dsr = typeof r.dsr === 'number' ? r.dsr.toFixed(2) : '';
      const ltv = typeof r.ltv === 'number' ? r.ltv.toFixed(2) : '';
      return [
        safeCSV(r.bankShortName),
        safeCSV(r.bankName),
        safeCSV(promo),
        rate,
        monthly,
        amount,
        dsr,
        ltv,
        r.status || ''
      ].join(',');
    });

    return header + '\n' + lines.join('\n') + '\n';

    function safeCSV(s) {
      if (s == null) return '';
      const str = String(s);
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
    }
  }

  static exportToJSON(results, params) {
    const payload = {
      generated_at: new Date().toISOString(),
      params: params || null,
      calculationResults: results || []
    };
    return JSON.stringify(payload, null, 2);
  }

  /* ================ Internals ================ */
  _pickPromotionForBank(bank, promotions) {
    if (!promotions || promotions.length === 0) return null;
    const byBank = promotions.find((p) => p.bank_id === bank.id);
    return byBank || promotions[0] || null;
  }

  _getLimits(productType, promo) {
    let dsrLimit = this.DEFAULT_DSR_LIMIT;
    let ltvLimit = this.DEFAULT_LTV_LIMIT;

    if (promo && typeof promo.max_dsr === 'number') dsrLimit = promo.max_dsr;
    if (promo && typeof promo.max_ltv === 'number') ltvLimit = promo.max_ltv;

    if (productType === 'PERSONAL') ltvLimit = 100;

    return { dsrLimit, ltvLimit };
  }

  _calcForCheckMode(params, bank, promo, rate) {
    const {
      income = 0,
      incomeExtra = 0,
      debt = 0,
      years = 20,
      propertyValue = 0,
      loanAmount = 0
    } = params || {};

    const monthlyIncome = Number(income) + Number(incomeExtra);
    const monthlyPayment = calcMonthlyPayment(rate, years, loanAmount);

    const totalDebt = Number(debt || 0) + Number(monthlyPayment || 0);
    const dsr = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 999;

    const ltv = propertyValue > 0 ? (loanAmount / propertyValue) * 100 : 999;

    return { monthlyPayment, dsr, ltv };
  }

  _calcForMaxMode(params, bank, promo, rate, limits) {
    const {
      income = 0,
      incomeExtra = 0,
      debt = 0,
      years = 20,
      propertyValue = 0
    } = params || {};

    const monthlyIncome = Number(income) + Number(incomeExtra);
    const dsrRoom = Math.max(limits.dsrLimit, 0);
    const ltvRoom = Math.max(limits.ltvLimit, 0);

    const maxTotalDebt = monthlyIncome * (dsrRoom / 100);
    const maxNewInstallment = Math.max(maxTotalDebt - Number(debt || 0), 0);

    let lo = 0, hi = 100_000_000; // 100 ล้านบาท
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      const pmt = calcMonthlyPayment(rate, years, mid);
      if (pmt > maxNewInstallment) hi = mid;
      else lo = mid;
    }
    const maxByDSR = lo;

    const maxByLTV = (Number(propertyValue) || 0) * (ltvRoom / 100);

    const maxLoanAmount = Math.max(Math.min(maxByDSR, maxByLTV), 0);

    const monthlyPayment = calcMonthlyPayment(rate, years, maxLoanAmount);
    const totalDebt = Number(debt || 0) + monthlyPayment;
    const dsr = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 999;
    const ltv = propertyValue > 0 ? (maxLoanAmount / propertyValue) * 100 : 999;

    return { monthlyPayment, dsr, ltv, maxLoanAmount };
  }

  _buildOfferForBank(bank, params, promotions, mode) {
    const productType = params?.productType || 'MORTGAGE';
    const promo = this._pickPromotionForBank(bank, promotions);

    const interestRate =
      (promo && typeof promo.year1Rate === 'number' && promo.year1Rate > 0)
        ? promo.year1Rate
        : this.DEFAULT_RATE;

    const limits = this._getLimits(productType, promo);

    let monthlyPayment = 0;
    let dsr = 999;
    let ltv = 999;
    let maxLoanAmount = 0;
    let loanAmount = Number(params?.loanAmount || 0);

    if (mode === 'check') {
      const res = this._calcForCheckMode(params, bank, promo, interestRate);
      monthlyPayment = res.monthlyPayment;
      dsr = res.dsr;
      ltv = res.ltv;
    } else {
      const res = this._calcForMaxMode(params, bank, promo, interestRate, limits);
      monthlyPayment = res.monthlyPayment;
      dsr = res.dsr;
      ltv = res.ltv;
      maxLoanAmount = res.maxLoanAmount;
      loanAmount = maxLoanAmount;
    }

    const pass = (dsr <= limits.dsrLimit + 1e-6) && (ltv <= limits.ltvLimit + 1e-6);
    const status = pass ? 'APPROVED' : 'REJECTED';

    return {
      bankId: bank.id,
      bankName: bank.name || bank.bank_name || '',
      bankShortName: bank.short_name || bank.name || '',
      promotion: promo
        ? {
            id: promo.id,
            title: promo.title || '',
            description: promo.description || '',
            year1Rate: promo.year1Rate ?? null
          }
        : null,
      interestRate,
      monthlyPayment: Math.round(monthlyPayment),
      loanAmount: Math.round(loanAmount) || 0,
      maxLoanAmount: Math.round(maxLoanAmount) || 0,
      dsr: Number.isFinite(dsr) ? dsr : null,
      ltv: Number.isFinite(ltv) ? ltv : null,
      status
    };
  }
}
