import { getBanks, listPromotions } from './data-manager.js';

export class LoanCalculator {
  constructor() {
    this.banks = [];
    this.promotions = [];
    this.bankMap = new Map();
  }

  async init() {
    this.banks = await getBanks();
    this.promotions = await listPromotions();
    this.bankMap = new Map(this.banks.map(b => [b.id, b]));
  }

  calculateMonthlyPayment(principal, annualRate, termInMonths) {
    if (annualRate === 0) return principal / termInMonths;
    const monthlyRate = annualRate / 12 / 100;
    return principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths) / (Math.pow(1 + monthlyRate, termInMonths) - 1);
  }

  calculateAvgInterest(promo, bank, years = 3) {
    const rates = [promo.y1, promo.y2, promo.y3];
    let totalRate = 0;
    for (let i = 0; i < years; i++) {
      const rate = rates[Math.min(i, rates.length - 1)];
      const finalRate = promo.base === 'MRR' ? parseFloat(bank.mrr) + (rate || 0) : rate;
      totalRate += finalRate;
    }
    return totalRate / years;
  }

  async checkLoanAmount(p) {
    await this.init();
    const results = [];
    const filteredPromos = this.promotions.filter(promo => promo.active && promo.product_type === p.productType);

    for (const promo of filteredPromos) {
      const bank = this.bankMap.get(promo.bank_id);
      if (!bank) continue;

      const avgRate = this.calculateAvgInterest(promo, bank);
      const monthlyPayment = this.calculateMonthlyPayment(p.loanAmount, avgRate, p.years * 12);
      
      const dsr = (monthlyPayment / 50000) * 100; // สมมติรายได้ 50,000 บาท
      const ltv = (p.loanAmount / 4000000) * 100; // สมมติมูลค่าทรัพย์สิน 4,000,000 บาท
      
      const status = (dsr < 50 && ltv < 90) ? 'APPROVED' : 'REJECTED'; 

      results.push({
        bankShortName: bank.short_name,
        bankName: bank.name,
        promotion: promo,
        interestRate: avgRate,
        monthlyPayment: monthlyPayment,
        loanAmount: p.loanAmount,
        dsr: dsr,
        ltv: ltv,
        status: status,
      });
    }

    return results;
  }
}