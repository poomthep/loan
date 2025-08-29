// js/loan-calculator-supabase.js
// ========================================
// ENHANCED LOAN CALCULATOR WITH SUPABASE
// ========================================

import DataManager from './data-manager.js';
import { AuthManager } from './auth-manager.js';

/**
 * เครื่องมือคำนวณสินเชื่อที่เชื่อมต่อกับ Supabase
 */
export class LoanCalculator {
  constructor() {
    this.banks = [];
    this.promotions = [];
    this.bankRules = [];
    this.mrrRates = [];
    this.subscriptions = [];
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * โหลดข้อมูลจาก Supabase
   */
  async loadData(productType) {
    try {
      console.log('🔄 Loading calculation data...');
      
      const data = await DataManager.getAllDataForCalculation(productType);
      
      this.banks = data.banks;
      this.promotions = data.promotions;
      this.bankRules = data.bankRules;
      this.mrrRates = data.mrrRates;

      console.log('✅ Data loaded:', {
        banks: this.banks.length,
        promotions: this.promotions.length,
        rules: this.bankRules.length,
        rates: this.mrrRates.length
      });

      return true;

    } catch (error) {
      console.error('❌ Error loading data:', error);
      return false;
    }
  }

  /**
   * ตั้งค่า Real-time subscriptions
   */
  setupRealTimeUpdates(onDataChange) {
    // Subscribe to promotions changes
    this.subscriptions.push(
      DataManager.subscribeToPromotions(() => {
        console.log('📡 Promotions updated, reloading...');
        this.loadData(this.currentProductType).then(() => {
          onDataChange && onDataChange('promotions');
        });
      })
    );

    // Subscribe to bank rules changes
    this.subscriptions.push(
      DataManager.subscribeToBankRules(() => {
        console.log('📡 Bank rules updated, reloading...');
        this.loadData(this.currentProductType).then(() => {
          onDataChange && onDataChange('rules');
        });
      })
    );

    // Subscribe to MRR rates changes
    this.subscriptions.push(
      DataManager.subscribeToMRRRates(() => {
        console.log('📡 MRR rates updated, reloading...');
        this.loadData(this.currentProductType).then(() => {
          onDataChange && onDataChange('rates');
        });
      })
    );
  }

  /**
   * ล้าง subscriptions
   */
  cleanup() {
    this.subscriptions.forEach(sub => {
      if (sub && typeof sub.unsubscribe === 'function') {
        sub.unsubscribe();
      }
    });
    this.subscriptions = [];
  }

  // ========================================
  // CORE CALCULATION METHODS
  // ========================================

  /**
   * คำนวณวงเงินสูงสุดที่สามารถกู้ได้
   */
  async calculateMaxLoanAmount(params) {
    const {
      productType,
      income,
      debt = 0,
      incomeExtra = 0,
      age,
      years,
      propertyValue,
      propertyType,
      homeNumber
    } = params;

    this.currentProductType = productType;
    await this.loadData(productType);

    const totalIncome = income + incomeExtra;
    const results = [];

    // คำนวณสำหรับแต่ละธนาคาร
    for (const bank of this.banks) {
      try {
        const result = await this.calculateForBank(bank, {
          productType,
          totalIncome,
          debt,
          age,
          years,
          propertyValue,
          propertyType,
          homeNumber,
          calculationMode: 'max'
        });

        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.warn(`Error calculating for ${bank.short_name}:`, error);
      }
    }

    // เรียงตามวงเงินสูงสุด
    results.sort((a, b) => (b.maxLoanAmount || 0) - (a.maxLoanAmount || 0));

    return results;
  }

  /**
   * ตรวจสอบวงเงินที่ต้องการกู้
   */
  async checkLoanAmount(params) {
    const {
      productType,
      income,
      debt = 0,
      incomeExtra = 0,
      age,
      years,
      propertyValue,
      propertyType,
      homeNumber,
      loanAmount
    } = params;

    this.currentProductType = productType;
    await this.loadData(productType);

    const totalIncome = income + incomeExtra;
    const results = [];

    // ตรวจสอบสำหรับแต่ละธนาคาร
    for (const bank of this.banks) {
      try {
        const result = await this.calculateForBank(bank, {
          productType,
          totalIncome,
          debt,
          age,
          years,
          propertyValue,
          propertyType,
          homeNumber,
          loanAmount,
          calculationMode: 'check'
        });

        if (result) {
          results.push(result);
        }
      } catch (error) {
        console.warn(`Error checking for ${bank.short_name}:`, error);
      }
    }

    // เรียงตาม DSR ต่ำสุด (ดีที่สุด)
    results.sort((a, b) => (a.dsr || 100) - (b.dsr || 100));

    return results;
  }

  /**
   * คำนวณสำหรับธนาคารหนึ่งธนาคาร
   */
  async calculateForBank(bank, params) {
    const {
      productType,
      totalIncome,
      debt,
      age,
      years,
      propertyValue,
      propertyType,
      homeNumber,
      loanAmount,
      calculationMode
    } = params;

    // หากฎเกณฑ์ธนาคาร
    const bankRules = await DataManager.getBankRulesByBank(
      bank.id, 
      productType, 
      propertyType, 
      homeNumber
    );

    if (!bankRules.length) {
      return null; // ไม่มีกฎเกณฑ์สำหรับธนาคารนี้
    }

    const rule = DataManager.findBestMatchingRule(bankRules, {
      propertyType,
      homeNumber
    });

    // ตรวจสอบเงื่อนไขพื้นฐาน
    if (!this.checkBasicEligibility(rule, { totalIncome, age, years })) {
      return {
        bankId: bank.id,
        bankName: bank.name,
        bankShortName: bank.short_name,
        status: 'REJECTED',
        reason: 'ไม่ผ่านเงื่อนไขพื้นฐาน'
      };
    }

    // หาโปรโมชันที่ดีที่สุด
    const promotions = await DataManager.getPromotionsByBank(bank.id, productType);
    const bestPromo = this.findBestPromotion(promotions);

    // หาอัตรา MRR
    const mrrRate = await DataManager.getMRRRate(bank.id, productType);
    if (!mrrRate) {
      return null; // ไม่มีอัตราดอกเบี้ย
    }

    // คำนวณอัตราดอกเบี้ยจริง
    const interestRate = this.calculateEffectiveRate(mrrRate.rate, bestPromo);

    // คำนวณตาม mode
    if (calculationMode === 'max') {
      return this.calculateMaxAmount(bank, rule, mrrRate, bestPromo, {
        totalIncome,
        debt,
        age,
        years,
        propertyValue,
        interestRate
      });
    } else {
      return this.checkLoanEligibility(bank, rule, mrrRate, bestPromo, {
        totalIncome,
        debt,
        age,
        years,
        propertyValue,
        loanAmount,
        interestRate
      });
    }
  }

  // ========================================
  // ELIGIBILITY CHECKS
  // ========================================

  /**
   * ตรวจสอบเงื่อนไขพื้นฐาน
   */
  checkBasicEligibility(rule, params) {
    const { totalIncome, age, years } = params;

    // ตรวจสอบรายได้ขั้นต่ำ
    if (rule.min_income && totalIncome < rule.min_income) {
      return false;
    }

    // ตรวจสอบอายุและระยะเวลาผ่อน
    if (rule.max_age_at_maturity && (age + years) > rule.max_age_at_maturity) {
      return false;
    }

    // ตรวจสอบระยะเวลาผ่อนสูงสุด
    if (rule.max_tenure_years && years > rule.max_tenure_years) {
      return false;
    }

    return true;
  }

  /**
   * หาโปรโมชันที่ดีที่สุด
   */
  findBestPromotion(promotions) {
    if (!promotions || !promotions.length) return null;

    // เรียงตามส่วนลดมากที่สุด
    return promotions
      .filter(promo => promo.active)
      .sort((a, b) => (b.discount_bps || 0) - (a.discount_bps || 0))[0];
  }

  /**
   * คำนวณอัตราดอกเบี้ยจริง
   */
  calculateEffectiveRate(baseRate, promotion) {
    if (!promotion) return baseRate;

    // ใช้อัตราจากโปรโมชัน หรือ MRR - ส่วนลด
    if (promotion.year1_rate) {
      return promotion.year1_rate; // อัตราปีแรก
    }

    if (promotion.discount_bps) {
      return baseRate - (promotion.discount_bps / 100);
    }

    return baseRate;
  }

  // ========================================
  // LOAN AMOUNT CALCULATIONS
  // ========================================

  /**
   * คำนวณวงเงินสูงสุด
   */
  calculateMaxAmount(bank, rule, mrrRate, promotion, params) {
    const { totalIncome, debt, propertyValue, interestRate, years } = params;

    // คำนวณวงเงินสูงสุดจาก DSR
    const maxDsr = rule.dsr_cap / 100;
    const availableIncome = (totalIncome * maxDsr) - debt;
    const monthlyRate = interestRate / 100 / 12;
    const totalPayments = years * 12;

    let maxLoanFromDSR = 0;
    if (monthlyRate > 0) {
      maxLoanFromDSR = availableIncome * ((1 - Math.pow(1 + monthlyRate, -totalPayments)) / monthlyRate);
    } else {
      maxLoanFromDSR = availableIncome * totalPayments;
    }

    // คำนวณวงเงินสูงสุดจาก LTV
    const maxLtv = (promotion?.ltv_override || rule.ltv_cap) / 100;
    const maxLoanFromLTV = propertyValue * maxLtv;

    // เลือกวงเงินที่น้อยกว่า
    const maxLoanAmount = Math.min(maxLoanFromDSR, maxLoanFromLTV);

    // คำนวณค่างวด
    const monthlyPayment = this.calculateMonthlyPayment(maxLoanAmount, interestRate, years);
    
    // คำนวณ DSR จริง
    const actualDSR = ((monthlyPayment + debt) / totalIncome) * 100;

    // คำนวณ LTV จริง
    const actualLTV = (maxLoanAmount / propertyValue) * 100;

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankShortName: bank.short_name,
      maxLoanAmount: Math.floor(maxLoanAmount),
      monthlyPayment: Math.ceil(monthlyPayment),
      interestRate,
      dsr: Math.round(actualDSR * 100) / 100,
      ltv: Math.round(actualLTV * 100) / 100,
      promotion: promotion ? {
        title: promotion.title,
        description: promotion.description,
        discountBps: promotion.discount_bps,
        year1Rate: promotion.year1_rate,
        finalRate: promotion.final_rate
      } : null,
      status: maxLoanAmount > 0 ? 'APPROVED' : 'REJECTED',
      constraints: {
        dsrLimit: rule.dsr_cap,
        ltvLimit: promotion?.ltv_override || rule.ltv_cap,
        maxFromDSR: Math.floor(maxLoanFromDSR),
        maxFromLTV: Math.floor(maxLoanFromLTV)
      }
    };
  }

  /**
   * ตรวจสอบวงเงินที่ต้องการ
   */
  checkLoanEligibility(bank, rule, mrrRate, promotion, params) {
    const { totalIncome, debt, loanAmount, propertyValue, interestRate, years } = params;

    // คำนวณค่างวด
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, years);
    
    // คำนวณ DSR
    const dsr = ((monthlyPayment + debt) / totalIncome) * 100;
    
    // คำนวณ LTV
    const ltv = (loanAmount / propertyValue) * 100;

    // ตรวจสอบเงื่อนไข DSR
    const dsrPass = dsr <= rule.dsr_cap;
    
    // ตรวจสอบเงื่อนไข LTV
    const maxLtv = promotion?.ltv_override || rule.ltv_cap;
    const ltvPass = ltv <= maxLtv;

    // กำหนดสถานะ
    let status = 'APPROVED';
    let reasons = [];

    if (!dsrPass) {
      status = 'REJECTED';
      reasons.push(`DSR ${dsr.toFixed(2)}% เกิน ${rule.dsr_cap}%`);
    }

    if (!ltvPass) {
      status = 'REJECTED';
      reasons.push(`LTV ${ltv.toFixed(2)}% เกิน ${maxLtv}%`);
    }

    return {
      bankId: bank.id,
      bankName: bank.name,
      bankShortName: bank.short_name,
      loanAmount,
      monthlyPayment: Math.ceil(monthlyPayment),
      interestRate,
      dsr: Math.round(dsr * 100) / 100,
      ltv: Math.round(ltv * 100) / 100,
      promotion: promotion ? {
        title: promotion.title,
        description: promotion.description,
        discountBps: promotion.discount_bps,
        year1Rate: promotion.year1_rate,
        finalRate: promotion.final_rate
      } : null,
      status,
      reasons: reasons.join(', '),
      constraints: {
        dsrLimit: rule.dsr_cap,
        ltvLimit: maxLtv,
        dsrPass,
        ltvPass
      }
    };
  }

  /**
   * คำนวณค่างวดรายเดือน
   */
  calculateMonthlyPayment(principal, annualRate, years) {
    const monthlyRate = annualRate / 100 / 12;
    const numberOfPayments = years * 12;

    if (monthlyRate === 0) {
      return principal / numberOfPayments;
    }

    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / 
           (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
  }

  /**
   * คำนวณยอดคงเหลือตามเดือน
   */
  calculateLoanSchedule(principal, annualRate, years, monthlyPayment = null) {
    if (!monthlyPayment) {
      monthlyPayment = this.calculateMonthlyPayment(principal, annualRate, years);
    }

    const monthlyRate = annualRate / 100 / 12;
    const schedule = [];
    let balance = principal;

    for (let month = 1; month <= years * 12; month++) {
      const interestPayment = balance * monthlyRate;
      const principalPayment = monthlyPayment - interestPayment;
      balance -= principalPayment;

      schedule.push({
        month,
        monthlyPayment: Math.ceil(monthlyPayment),
        interestPayment: Math.ceil(interestPayment),
        principalPayment: Math.ceil(principalPayment),
        balance: Math.max(0, Math.ceil(balance))
      });

      if (balance <= 0) break;
    }

    return schedule;
  }

  // ========================================
  // ADVANCED CALCULATIONS
  // ========================================

  /**
   * คำนวณ Total Cost of Ownership
   */
  calculateTotalCost(loanAmount, interestRate, years, fees = {}) {
    const monthlyPayment = this.calculateMonthlyPayment(loanAmount, interestRate, years);
    const totalPayments = monthlyPayment * years * 12;
    const totalInterest = totalPayments - loanAmount;

    const costs = {
      loanAmount,
      monthlyPayment: Math.ceil(monthlyPayment),
      totalPayments: Math.ceil(totalPayments),
      totalInterest: Math.ceil(totalInterest),
      processingFee: fees.processingFee || 0,
      stampDuty: fees.stampDuty || 0,
      insurancePremium: fees.insurancePremium || 0,
      otherFees: fees.otherFees || 0
    };

    costs.totalCost = costs.totalPayments + costs.processingFee + 
                     costs.stampDuty + costs.insurancePremium + costs.otherFees;

    costs.effectiveRate = ((costs.totalCost - loanAmount) / loanAmount / years) * 100;

    return costs;
  }

  /**
   * เปรียบเทียบโปรโมชันแบบขั้นบันได
   */
  calculateTieredPromotion(loanAmount, promotion, years) {
    if (!promotion.year1_rate) {
      return this.calculateTotalCost(loanAmount, promotion.final_rate || 0, years);
    }

    let totalPayments = 0;
    let remainingBalance = loanAmount;
    const schedule = [];

    // ปี 1
    if (promotion.year1_rate && promotion.year1_months) {
      const year1Payment = this.calculateMonthlyPayment(loanAmount, promotion.year1_rate, years);
      const year1Payments = Math.min(promotion.year1_months, years * 12);
      
      for (let i = 0; i < year1Payments; i++) {
        const interest = remainingBalance * (promotion.year1_rate / 100 / 12);
        const principal = year1Payment - interest;
        remainingBalance -= principal;
        totalPayments += year1Payment;
        
        schedule.push({
          month: i + 1,
          rate: promotion.year1_rate,
          payment: year1Payment,
          balance: remainingBalance
        });
      }
    }

    // ปี 2
    if (promotion.year2_rate && promotion.year2_months && schedule.length < years * 12) {
      const remainingMonths = years * 12 - schedule.length;
      const year2Payment = this.calculateMonthlyPayment(remainingBalance, promotion.year2_rate, remainingMonths / 12);
      const year2Payments = Math.min(promotion.year2_months, remainingMonths);
      
      for (let i = 0; i < year2Payments; i++) {
        const interest = remainingBalance * (promotion.year2_rate / 100 / 12);
        const principal = year2Payment - interest;
        remainingBalance -= principal;
        totalPayments += year2Payment;
        
        schedule.push({
          month: schedule.length + 1,
          rate: promotion.year2_rate,
          payment: year2Payment,
          balance: remainingBalance
        });
      }
    }

    // ปี 3 และต่อไป
    if (schedule.length < years * 12) {
      const remainingMonths = years * 12 - schedule.length;
      const finalRate = promotion.year3_rate || promotion.final_rate || 0;
      const finalPayment = this.calculateMonthlyPayment(remainingBalance, finalRate, remainingMonths / 12);
      
      for (let i = 0; i < remainingMonths; i++) {
        const interest = remainingBalance * (finalRate / 100 / 12);
        const principal = finalPayment - interest;
        remainingBalance -= principal;
        totalPayments += finalPayment;
        
        schedule.push({
          month: schedule.length + 1,
          rate: finalRate,
          payment: finalPayment,
          balance: Math.max(0, remainingBalance)
        });
      }
    }

    return {
      loanAmount,
      totalPayments: Math.ceil(totalPayments),
      totalInterest: Math.ceil(totalPayments - loanAmount),
      averageRate: ((totalPayments - loanAmount) / loanAmount / years) * 100,
      schedule
    };
  }

  // ========================================
  // SAVE CALCULATION HISTORY
  // ========================================

  /**
   * บันทึกผลการคำนวณ
   */
  async saveCalculation(params, results, calculationType) {
    try {
      const calculationData = {
        product_type: params.productType,
        income: params.income || 0,
        debt: params.debt || 0,
        income_extra: params.incomeExtra || 0,
        age: params.age,
        tenure_years: params.years,
        property_value: params.propertyValue,
        property_type: params.propertyType,
        home_number: params.homeNumber,
        loan_amount: params.loanAmount,
        calculation_mode: calculationType,
        results: {
          timestamp: new Date().toISOString(),
          inputParams: params,
          calculationResults: results,
          totalOffers: results.length,
          bestOffer: results.length > 0 ? results[0] : null
        }
      };

      const result = await DataManager.saveCalculation(calculationData);
      
      if (result.success) {
        console.log('✅ Calculation saved to history');
        return result.data;
      } else {
        console.warn('⚠️ Failed to save calculation:', result.error);
      }

    } catch (error) {
      console.error('Error saving calculation:', error);
    }

    return null;
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * จัดรูปแบบตัวเลขเป็นสกุลเงินไทย
   */
  static formatCurrency(amount, options = {}) {
    const defaults = {
      style: 'currency',
      currency: 'THB',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    };

    try {
      return new Intl.NumberFormat('th-TH', { ...defaults, ...options }).format(amount);
    } catch (error) {
      return `฿${amount.toLocaleString()}`;
    }
  }

  /**
   * จัดรูปแบบเปอร์เซ็นต์
   */
  static formatPercentage(value, decimals = 2) {
    return `${value.toFixed(decimals)}%`;
  }

  /**
   * สร้าง summary ของการคำนวณ
   */
  static createCalculationSummary(results, calculationType) {
    if (!results || !results.length) {
      return {
        totalOffers: 0,
        approvedOffers: 0,
        rejectedOffers: 0,
        bestOffer: null,
        averageRate: 0,
        rateRange: null
      };
    }

    const approved = results.filter(r => r.status === 'APPROVED');
    const rejected = results.filter(r => r.status === 'REJECTED');
    
    const rates = approved.map(r => r.interestRate).filter(r => r > 0);
    const averageRate = rates.length > 0 ? rates.reduce((sum, rate) => sum + rate, 0) / rates.length : 0;
    
    return {
      totalOffers: results.length,
      approvedOffers: approved.length,
      rejectedOffers: rejected.length,
      bestOffer: approved.length > 0 ? approved[0] : null,
      averageRate: Math.round(averageRate * 100) / 100,
      rateRange: rates.length > 0 ? {
        min: Math.min(...rates),
        max: Math.max(...rates)
      } : null,
      calculationType
    };
  }

  // ========================================
  // EXPORT UTILITIES
  // ========================================

  /**
   * Export ผลการคำนวณเป็น JSON
   */
  static exportToJSON(results, params) {
    return JSON.stringify({
      exportDate: new Date().toISOString(),
      inputParameters: params,
      calculationResults: results,
      summary: this.createCalculationSummary(results, params.calculationMode || 'unknown')
    }, null, 2);
  }

  /**
   * สร้างข้อมูลสำหรับ CSV export
   */
  static exportToCSV(results) {
    if (!results || !results.length) return '';

    const headers = [
      'ธนาคาร',
      'สถานะ',
      'วงเงิน (บาท)',
      'ค่างวด/เดือน (บาท)',
      'อัตราดอกเบี้ย (%)',
      'DSR (%)',
      'LTV (%)',
      'โปรโมชัน',
      'หมายเหตุ'
    ];

    const rows = results.map(result => [
      result.bankShortName,
      result.status === 'APPROVED' ? 'อนุมัติ' : 'ไม่อนุมัติ',
      result.maxLoanAmount || result.loanAmount || 0,
      result.monthlyPayment || 0,
      result.interestRate || 0,
      result.dsr || 0,
      result.ltv || 0,
      result.promotion?.title || '-',
      result.reasons || '-'
    ]);

    return [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');
  }
}

// ========================================
// EXPORT DEFAULT
// ========================================

export default LoanCalculator;