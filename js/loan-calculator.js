import { getBanks, listPromotions } from './data-manager.js';

export class LoanCalculator {
  calculateMonthlyPayment(principal, annualRate, termInMonths) {
    if (annualRate === 0) return principal / termInMonths;
    const monthlyRate = annualRate / 12 / 100;
    return principal * monthlyRate * Math.pow(1 + monthlyRate, termInMonths) / (Math.pow(1 + monthlyRate, termInMonths) - 1);
  }

  async calculateAndRender() {
    const loanAmount = parseFloat(document.getElementById('loan-amount').value);
    const loanTermYears = parseInt(document.getElementById('loan-term').value);
    const productType = document.getElementById('product-type').value;

    if (isNaN(loanAmount) || loanAmount <= 0 || isNaN(loanTermYears) || loanTermYears <= 0) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    const container = document.getElementById('results-container');
    container.innerHTML = '<p class="muted center">กำลังคำนวณ...</p>';

    try {
      const banks = await getBanks();
      const allPromotions = await listPromotions();
      
      const promotions = allPromotions.filter(p => p.active && p.product_type === productType);
      const bankMap = new Map(banks.map(b => [b.id, b]));

      let resultsHtml = '';
      if (promotions.length === 0) {
        resultsHtml = `<p class="muted center">ไม่พบโปรโมชันสำหรับ ${productType} ในขณะนี้</p>`;
      } else {
        for (const promo of promotions) {
          const bank = bankMap.get(promo.bank_id);
          if (!bank) continue;

          const principal = loanAmount;
          const termInMonths = loanTermYears * 12;

          const rates = [promo.y1, promo.y2, promo.y3];
          const effectiveRates = rates.map((rate, index) => {
            let finalRate = rate;
            if (promo.base === 'MRR' && bank.mrr) {
              finalRate = parseFloat(bank.mrr) + (rate || 0);
            }
            return finalRate;
          });
          
          let outstandingBalance = principal;
          let totalInterestPaid = 0;
          
          for (let year = 0; year < loanTermYears; year++) {
            const annualRate = effectiveRates[Math.min(year, rates.length - 1)];
            const monthlyRate = annualRate / 12 / 100;
            const paymentsPerYear = 12;
            
            const payment = this.calculateMonthlyPayment(outstandingBalance, annualRate, (loanTermYears - year) * paymentsPerYear);
            
            let totalInterestThisYear = 0;
            for (let month = 0; month < paymentsPerYear; month++) {
              const interestThisMonth = outstandingBalance * monthlyRate;
              const principalThisMonth = payment - interestThisMonth;
              outstandingBalance -= principalThisMonth;
              totalInterestThisYear += interestThisMonth;
            }
            totalInterestPaid += totalInterestThisYear;
          }

          const monthlyPayment = this.calculateMonthlyPayment(principal, effectiveRates[0], termInMonths);
          const totalPayment = principal + totalInterestPaid;
          
          resultsHtml += `
            <div class="card" style="margin-bottom:10px">
              <h3>${bank.name || bank.short_name} - ${promo.title}</h3>
              <p><strong>ยอดผ่อนต่อเดือน (เฉลี่ย):</strong> ${monthlyPayment.toFixed(2)} บาท</p>
              <p><strong>ยอดดอกเบี้ยรวม:</strong> ${totalInterestPaid.toFixed(2)} บาท</p>
              <p><strong>ยอดชำระทั้งหมด:</strong> ${totalPayment.toFixed(2)} บาท</p>
              <p class="muted"><strong>อัตราดอกเบี้ย:</strong> ปีที่ 1: ${effectiveRates[0].toFixed(2)}%, ปีที่ 2: ${effectiveRates[1].toFixed(2)}%, ปีที่ 3: ${effectiveRates[2].toFixed(2)}%</p>
            </div>
          `;
        }
      }

      container.innerHTML = resultsHtml;

    } catch (e) {
      console.error(e);
      container.innerHTML = '<p class="muted center">เกิดข้อผิดพลาดในการดึงข้อมูล</p>';
    }
  }

  init() {
    const btnCalculate = document.getElementById('btn-calculate');
    btnCalculate.addEventListener('click', () => this.calculateAndRender());
  }
}

export const loanCalculator = new LoanCalculator();