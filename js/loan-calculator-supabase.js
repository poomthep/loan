/*! loan-calculator-supabase.js
 * Loan App – Core Calculator (ES Module)
 * - ใช้ AuthManager แบบ global (window.AuthManager)
 * - ใช้ DataManager จาก data-manager.fix.js
 */

//
// ===== Helpers: ใช้ AuthManager แบบ global โดยไม่ import =====
//
const AM = (typeof window !== 'undefined' && window.AuthManager)
  ? window.AuthManager
  : null;

function getAM() {
  if (AM) return AM;
  if (typeof window !== 'undefined' && window.AuthManager) return window.AuthManager;
  throw new Error('AuthManager ยังไม่พร้อม');
}

//
// ===== Data Layer =====
//  * เปลี่ยน path ให้ตรงกับไฟล์ที่มีจริง (เพื่อแก้ 404)
//
import DataManager from './data-manager.fix.js';

//
// ===== Utilities (คำนวณทางการเงินพื้นฐาน) =====
//
function pmtRatePerMonth(annualRate) {
  // รับเป็น % (เช่น 6.5) -> คืนค่าอัตราต่อเดือนแบบทศนิยม
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

function fmtNumber(n) {
  return new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2 }).format(n || 0);
}

//
// ===== Core Calculator =====
//
export default class LoanCalculator {
  constructor() {
    this._unsubRealtime = null;

    // defaults / สมมติฐานทั่วไป (ปรับได้)
    this.DEFAULT_RATE = 6.5;     // ดอกเบี้ยเฉลี่ยกรณีไม่มีข้อมูลจากโปรโมชัน (% ต่อปี)
    this.DEFAULT_DSR_LIMIT = 70; // สัดส่วนหนี้ต่อรายได้สูงสุด (%)
    this.DEFAULT_LTV_LIMIT = 90; // LTV สูงสุดเริ่มต้น (%)
  }

  //
  // ========= Realtime =========
  //
  setupRealTimeUpdates(onChange) {
    try {
      if (typeof DataManager.subscribeDataChanges === 'function') {
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
    try {
      if (this._unsubRealtime) this._unsubRealtime();
    } catch (_) {}
    this._unsubRealtime = null;
  }

  //
  // ========= Main APIs =========
  //
  /**
   * คำนวณ "วงเงินสูงสุด" ที่กู้ได้ต่อธนาคาร
   */
  async calculateMaxLoanAmount(params) {
    const productType = params?.productType || 'MORTGAGE';
    const [banks, promotions] = await Promise.all([
      DataManager.getBanks(),
      DataManager.getActivePromotions(productType)
    ]);

    const offers = banks.map((bank) =>
      this._buildOfferForBank(bank, params, promotions, /*mode*/ 'max')
    );

    // อนุมัติขึ้นก่อน แล้วเรียงตามวงเงินสูงสุดมาก→น้อย
    offers.sort((a, b) => {
      const ok = (x) => (x.status === 'APPROVED' ? 1 : 0);
      if (ok(a) !== ok(b)) return ok(b) - ok(a);
      return (b.maxLoanAmount || 0) - (a.maxLoanAmount || 0);
    });

    return offers;
  }

  /**
   * ตรวจสอบ "วงเงินที่ต้องการกู้" ว่าผ่าน/ไม่ผ่าน
   */
  async checkLoanAmount(params) {
    const productType = params?.productType || 'MORTGAGE';
    const [banks, promotions] = await Promise.all([
      DataManager.getBanks(),
      DataManager.getActivePromotions(productType)
    ]);

    const offers = banks.map((bank) =>
      this._buildOfferForBank(bank, params, promotions, /*mode*/ 'check')
    );

    // อนุมัติขึ้นก่อน แล้วเรียงตาม DSR ต่ำ→สูง
    offers.sort((a, b) => {
      const ok = (x) => (x.status === 'APPROVED' ? 1 : 0);
      if (ok(a) !== ok(b)) return ok(b) - ok(a);
      return (a.dsr || 999) - (b.dsr || 999);
    });

    return offers;
  }

  /**
   * บันทึกผลการคำนวณ (ถ้าไม่ล็อกอินจะข้ามแบบนิ่มนวล)
   */
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

      // ฝาก DataManager บันทึก (ให้มีฟังก์ชันนี้ใน data-manager)
      return await DataManager.saveCalculation(params, results, mode);
    } catch (err) {
      console.error('[LoanCalculator] saveCalculation error:', err);
      return { success: false, error: err?.message || String(err) };
    }
  }

  //
  // ========= Export =========
  //
  static exportToCSV(results) {
    if (!Array.isArray(results) || results.length === 0) {
      return 'bank_short,bank_name,promo,rate,monthly,amount,dsr,ltv,status\n';
    }

    const header = [
      'bank_short',
      'bank_name',
      'promo',
      'rate',
      'monthly',
      'amount',
      'dsr',
      'ltv',
      'status'
    ].join(',');

    const lines = results.map((r) => {
      const promo = r.promotion?.title || '';
      const rate = typeof r.interestRate === 'number' ? r.interestRate.toFixed(2) : '';
      const monthly = r.monthlyPayment || r.estimatedMonthly || 0;
      const amount = r.maxLoanAmount || r.loanAmount || 0;
      const dsr = typeof r.dsr === 'number' ? r.dsr.toFixed(2) : '';
      const ltv = typeof r.ltv === 'number' ? r.ltv.toFixed(2) : '';
      const row = [
        safeCSV(r.bankShortName),
        safeCSV(r.bankName),
        safeCSV(promo),
        rate,
        monthly,
        amount,
        dsr,
        ltv,
        r.status || ''
      ];
      return row.join(',');
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

  //
  // ========= Internals =========
  //
  _pickPromotionForBank(bank, promotions) {
    if (!promotions || promotions.length === 0) return null;
    // เลือกโปรฯ ที่ bank_id ตรง (ถ้ามี) ไม่งั้นคืนโปรฯ แรก ๆ ไปก่อน
    const byBank = promotions.find((p) => p.bank_id === bank.id);
    return byBank || promotions[0] || null;
  }

  _getLimits(productType, promo) {
    // กำหนดค่าเพดานเบื้องต้น แล้วใช้ค่าจากโปรฯ ถ้ามี
    let dsrLimit = this.DEFAULT_DSR_LIMIT;
    let ltvLimit = this.DEFAULT_LTV_LIMIT;

    if (promo && typeof promo.max_dsr === 'number') {
      dsrLimit = promo.max_dsr;
    }
    if (promo && typeof promo.max_ltv === 'number') {
      ltvLimit = promo.max_ltv;
    }

    // อาจปรับเพิ่มตามประเภทผลิตภัณฑ์ (ถ้าต้องการ)
    if (productType === 'PERSONAL') {
      ltvLimit = 100; // ไม่มีหลักประกันชัดเจน ใช้ 100 ไว้ก่อน
    }

    return { dsrLimit, ltvLimit };
  }

  _calcForCheckMode(params, bank, promo, rate) {
    const {
      income = 0,
      incomeExtra = 0,
      debt = 0, // monthly existing debt
      years = 20,
      propertyValue = 0,
      loanAmount = 0
    } = params || {};

    const monthlyIncome = Number(income) + Number(incomeExtra);
    const monthlyPayment = calcMonthlyPayment(rate, years, loanAmount);

    // DSR: (หนี้ต่อเดือนทั้งหมด / รายได้ต่อเดือนทั้งหมด) x 100
    const totalDebt = Number(debt || 0) + Number(monthlyPayment || 0);
    const dsr = monthlyIncome > 0 ? (totalDebt / monthlyIncome) * 100 : 999;

    // LTV: (วงเงินกู้ / มูลค่าหลักประกัน) x 100
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
    const dsrRoom = Math.max(limits.dsrLimit, 0); // %
    const ltvRoom = Math.max(limits.ltvLimit, 0); // %

    // 1) เพดานจาก DSR -> หา "ค่างวดที่จ่ายได้" แล้วย้อนกลับเป็นวงเงิน
    //    totalDebt = debt + monthlyPayment <= (monthlyIncome * dsrRoom/100)
    const maxTotalDebt = monthlyIncome * (dsrRoom / 100);
    const maxNewInstallment = Math.max(maxTotalDebt - Number(debt || 0), 0);

    // หา principal ที่ทำให้ PMT(rate, years, principal) = maxNewInstallment
    // ใช้การค้นหาแบบ binary search แบบหยาบ ๆ พอใช้งานจริง
    const n = (Number(years) || 0) * 12;
    const i = pmtRatePerMonth(rate);
    let lo = 0;
    let hi = 100_000_000; // 100 ล้านบาท (เพดานค้นหา)
    for (let k = 0; k < 40; k++) {
      const mid = (lo + hi) / 2;
      const pmt = calcMonthlyPayment(rate, years, mid);
      if (pmt > maxNewInstallment) hi = mid;
      else lo = mid;
    }
    const maxByDSR = lo;

    // 2) เพดานจาก LTV
    const maxByLTV = (Number(propertyValue) || 0) * (ltvRoom / 100);

    // วงเงินสูงสุดจริง = min(ตาม DSR, ตาม LTV)
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

    // เลือกดอกเบี้ยจากโปรโมชัน ถ้าไม่มีใช้ default
    // (สมมติใช้ year1Rate เป็นอัตราคร่าว ๆ ถ้าไม่มี field นี้)
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
      // ให้ loanAmount = maxLoanAmount เพื่อให้ตารางดูง่ายในโหมด max
      loanAmount = maxLoanAmount;
    }

    // ตัดสินสถานะอนุมัติแบบคร่าว ๆ ตามเพดาน
    const pass = (dsr <= limits.dsrLimit + 1e-6) && (ltv <= limits.ltvLimit + 1e-6);
    const status = pass ? 'APPROVED' : 'REJECTED';

    return {
      // bank
      bankId: bank.id,
      bankName: bank.name || bank.bank_name || '',
      bankShortName: bank.short_name || bank.name || '',
      // promo
      promotion: promo
        ? {
            id: promo.id,
            title: promo.title || '',
            description: promo.description || '',
            year1Rate: promo.year1Rate ?? null
          }
        : null,
      // numbers
      interestRate,          // %
      monthlyPayment: Math.round(monthlyPayment),
      loanAmount: Math.round(loanAmount) || 0,
      maxLoanAmount: Math.round(maxLoanAmount) || 0,
      dsr: Number.isFinite(dsr) ? dsr : null, // %
      ltv: Number.isFinite(ltv) ? ltv : null, // %
      // result
      status
    };
  }
}
