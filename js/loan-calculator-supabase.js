// คำนวณวงเงินสูงสุด/ตรวจสอบวงเงิน, ทำ CSV/JSON export
import { getBanks, getActivePromotions } from './data-manager.js';

function pmt(ratePerPeriod, numberOfPayments, presentValue) {
  // monthly payment (simple annuity), ratePerPeriod is monthly rate
  if (ratePerPeriod === 0) return presentValue / numberOfPayments;
  const r = ratePerPeriod;
  return (presentValue * r) / (1 - Math.pow(1 + r, -numberOfPayments));
}

function money(n) { return Math.max(0, Math.round(n || 0)); }

export class LoanCalculator {
  async calculateMaxLoanAmount(params) {
    const banks = await getBanks();
    const promos = await getActivePromotions(params.productType || 'MORTGAGE');
    const res = [];

    // สมมุติ interest base ถ้า bank ไม่มี field rate
    for (const b of banks) {
      const annualRate = (b.base_rate || 6.5) / 100;
      const monthlyRate = annualRate / 12;
      const n = (params.years || 20) * 12;

      // วงเงินสูงสุดจาก DSR: ใช้ค่างวดไม่เกิน 40% ของ (รายได้ - ภาระหนี้ + รายได้เสริม)
      const income = (params.income || 0) + (params.incomeExtra || 0);
      const dsrCap = Math.max(0, income - (params.debt || 0)) * 0.4;
      // กลับจากค่างวดเป็นวงเงิน
      const maxLoanByDSR = monthlyRate === 0
        ? dsrCap * n
        : dsrCap * (1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate;

      // LTV cap (90% ของมูลค่าทรัพย์)
      const ltvCap = (params.propertyValue || 0) * 0.9;

      const loan = Math.min(maxLoanByDSR, ltvCap);
      const pay = pmt(monthlyRate, n, loan);

      const promo = promos.find(p => p.bank_id === b.id);
      const dsr = income ? ((pay + (params.debt || 0)) / income) * 100 : 0;
      const ltv = (params.propertyValue || 0) ? (loan / params.propertyValue) * 100 : 0;

      res.push({
        bankId: b.id,
        bankShortName: b.short_name || b.name || 'BANK',
        bankName: b.name || '',
        promotion: promo || null,
        interestRate: (promo?.yearly_rate || b.base_rate || 6.5),
        monthlyPayment: money(pay),
        maxLoanAmount: money(loan),
        dsr,
        ltv,
        status: loan > 0 ? 'APPROVED' : 'REJECTED',
        reasons: loan > 0 ? '' : 'รายได้/หลักประกันไม่เพียงพอ'
      });
    }

    // เรียงวงเงินมาก -> น้อย
    res.sort((a, b) => (b.maxLoanAmount || 0) - (a.maxLoanAmount || 0));
    return res;
  }

  async checkLoanAmount(params) {
    // ตรวจสอบวงเงินที่ผู้ใช้ระบุ
    const target = money(params.loanAmount || 0);
    const banks = await getBanks();
    const promos = await getActivePromotions(params.productType || 'MORTGAGE');
    const res = [];
    const n = (params.years || 20) * 12;

    for (const b of banks) {
      const annualRate = (b.base_rate || 6.5) / 100;
      const monthlyRate = annualRate / 12;
      const pay = pmt(monthlyRate, n, target);
      const income = (params.income || 0) + (params.incomeExtra || 0);
      const dsr = income ? ((pay + (params.debt || 0)) / income) * 100 : 0;
      const ltv = (params.propertyValue || 0) ? (target / params.propertyValue) * 100 : 0;
      const ok = dsr <= 70 && ltv <= 90; // กติกาเบื้องต้น

      const promo = promos.find(p => p.bank_id === b.id);
      res.push({
        bankId: b.id,
        bankShortName: b.short_name || b.name || 'BANK',
        bankName: b.name || '',
        promotion: promo || null,
        interestRate: (promo?.yearly_rate || b.base_rate || 6.5),
        monthlyPayment: money(pay),
        loanAmount: target,
        dsr,
        ltv,
        status: ok ? 'APPROVED' : 'REJECTED',
        reasons: ok ? '' : 'DSR/LTV เกินเกณฑ์'
      });
    }

    // เรียง DSR จากน้อยไปมาก
    res.sort((a, b) => (a.dsr || 0) - (b.dsr || 0));
    return res;
  }

  static exportToCSV(results) {
    if (!results?.length) return '';
    const cols = [
      'bankShortName','bankName','interestRate','monthlyPayment',
      'maxLoanAmount','loanAmount','dsr','ltv','status'
    ];
    const header = cols.join(',');
    const lines = results.map(r => cols.map(k => (r[k] ?? '')).join(','));
    return [header, ...lines].join('\n');
  }

  static exportToJSON(results, params) {
    return JSON.stringify({ results, params }, null, 2);
  }
}
