import {getBanks,getActivePromotions,saveCalculation}from './data-manager.js';
export class LoanCalculator{
	
	// js/loan-calculator-supabase.js
// export class LoanCalculator { ... } ของคุณคงมีอยู่แล้ว
// เพิ่ม helper ด้านล่าง และปรับจุดคำนวณ interestRate ให้เรียก resolvePromotionRate()

function resolvePromotionRate(promo, bank, year = 1) {
  const mrr = Number(bank?.mrr ?? 0);
  const base = (promo?.base || 'fixed').toLowerCase();

  const field = (year === 2) ? 'year2_rate' : (year === 3 ? 'year3_rate' : 'year1_rate');
  const v = promo?.[field];
  if (v == null) return null;

  if (base === 'mrr') {
    // yearX_rate = spread บน MRR (เช่น -1.00 => MRR-1.00)
    return mrr + Number(v);
  }
  // fixed
  return Number(v);
}

// เลือกอัตราใช้งานจริงสำหรับการคำนวณ (ตัวอย่าง: ใช้ปีแรก ถ้ามี; ไม่มีก็ใช้ปีถัดไป)
function pickEffectiveRate(promo, bank) {
  return (
    resolvePromotionRate(promo, bank, 1) ??
    resolvePromotionRate(promo, bank, 2) ??
    resolvePromotionRate(promo, bank, 3) ??
    null
  );
}

// ในส่วนที่คุณประกอบผลลัพธ์ธนาคาร/โปร ให้เปลี่ยนมุมมอง interestRate
// ตัวอย่างภายใน calculateMaxLoanAmount / checkLoanAmount:
async function decorateOffersWithRates(offers, banksById) {
  // offers: [{ bankId, promotion, ... }]
  for (const o of offers) {
    const bank = banksById[o.bankId];
    const promo = o.promotion || null;
    const effectiveRate = promo ? pickEffectiveRate(promo, bank) : null;
    // fallback: ถ้าไม่มีโปร ให้ใช้อะไรดี? -> เลือก MRR ปัจจุบันเป็น default ก็ได้
    o.interestRate = (effectiveRate != null)
      ? effectiveRate
      : Number(bank?.mrr ?? 0);

    // ถ้าคุณมี yearX_rate อยากแสดงผลเพิ่ม:
    o.__rates = {
      year1: resolvePromotionRate(promo, bank, 1),
      year2: resolvePromotionRate(promo, bank, 2),
      year3: resolvePromotionRate(promo, bank, 3),
    };
  }
  return offers;
}

// เรียกใช้หลังดึง banks/promotions แล้ว
// ตัวอย่างการใช้งาน (ใส่ไว้ใน flow เดิมของคุณ):
// const banks = await DataManager.getBanks();
// const banksById = Object.fromEntries(banks.map(b => [b.id, b]));
// const offers = ... (ประกอบจาก promotions/banks ของคุณ)
// await decorateOffersWithRates(offers, banksById);
// แล้วค่อยไปคำนวณค่างวด/วงเงินต่อ ด้วย o.interestRate

	
	async calculateMaxLoanAmount(p){
		const banks=await getBanks();
		const promos=await getActivePromotions(p.productType);
		const dsrLimit=.7;const maxMonthly=Math.max(0,(p.income+p.incomeExtra-p.debt)*dsrLimit);
		const rate=.055;
		const n=p.years*12;
		const maxLoan=maxMonthly>0?Math.round(maxMonthly*((1-Math.pow(1+rate/12,-n))/(rate/12))):0;
		const rows=banks.map(b=>({bankShortName:b.short_name||b.name,bankName:b.name,interestRate:rate*100,monthlyPayment:Math.round(maxMonthly),maxLoanAmount:maxLoan,dsr:((p.debt+maxMonthly)/Math.max(1,(p.income+p.incomeExtra)))*100,ltv:p.propertyValue?(maxLoan/p.propertyValue)*100:0,promotion:promos.find(pr=>pr.bank_id===b.id)||null,status:maxLoan>0?'APPROVED':'REJECTED'}));
		return rows.sort((a,b)=>(b.maxLoanAmount||0)-(a.maxLoanAmount||0))
		}
		async checkLoanAmount(p){
			const banks=await getBanks();
			const promos=await getActivePromotions(p.productType);
			const rate=.055;const n=p.years*12;
			const A=p.loanAmount>0?(p.loanAmount*(rate/12))/(1-Math.pow(1+rate/12,-n)):0;
			const dsr=((p.debt+A)/Math.max(1,(p.income+p.incomeExtra)))*100;
			const rows=banks.map(b=>({bankShortName:b.short_name||b.name,bankName:b.name,interestRate:rate*100,monthlyPayment:Math.round(A),loanAmount:p.loanAmount,dsr,ltv:p.propertyValue?(p.loanAmount/p.propertyValue)*100:0,promotion:promos.find(pr=>pr.bank_id===b.id)||null,status:(dsr<=70&&(!p.propertyValue||(p.loanAmount<=p.propertyValue*.9)))?'APPROVED':'REJECTED'}));
			return rows.sort((a,b)=>(a.dsr)-(b.dsr))
		}
		
		async saveCalculation(params,results,mode){await saveCalculation(params,results,mode)}static exportToCSV(rows){if(!rows||!rows.length)return'';
			const cols=Object.keys(rows[0]);
			const esc=s=>`"${String(s).replace(/"/g,'""')}"`;
			const lines=[cols.join(',')].concat(rows.map(r=>cols.map(c=>esc(r[c]??'')).join(',')));
			return lines.join('\n')}static exportToJSON(rows,params){return JSON.stringify({params,results:rows},null,2)
		}
}