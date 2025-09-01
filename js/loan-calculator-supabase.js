
// loan-calculator-supabase.js
// โมดูลคำนวณแบบง่าย + ให้ทั้ง named และ default export เพื่อแก้ปัญหา import ไม่ตรง
export class LoanCalculator{
  // คำนวณวงเงินสูงสุดแบบง่าย ๆ จากรายได้/หนี้/อายุ/ปีผ่อน
  calculateMaxLoanAmount(params){
    const { income=0, debt=0, years=20 } = params || {};
    const capacity = Math.max(0, income*0.7 - debt); // DSR 70%
    const monthlyRate = 0.06/12; // 6% สมมติ
    const n = Math.max(12, years*12);
    const maxLoan = capacity*( (1 - (1+monthlyRate)**(-n)) / monthlyRate );
    return Math.max(0, Math.round(maxLoan));
  }
  // ตรวจวงเงินที่ต้องการ
  checkLoanAmount(params){
    const { loanAmount=0, income=0, debt=0, years=20 } = params || {};
    const monthlyRate = 0.06/12;
    const n = Math.max(12, years*12);
    const payment = loanAmount*monthlyRate/(1-(1+monthlyRate)**(-n));
    const dsr = (payment + debt)/Math.max(1, income) * 100;
    return { payment: Math.round(payment), dsr: Math.round(dsr*100)/100 };
  }
  exportToCSV(rows){
    if(!rows) return '';
    if(!Array.isArray(rows)) rows = [rows];
    const header = ['label','value'];
    const body = rows.map(r => Object.entries(r).map(([k,v])=>`${k}=${v}`).join(';'));
    return [header.join(','), ...body].join('\n');
  }
  exportToJSON(rows,params){ return JSON.stringify({ rows, params }, null, 2); }
}
export default LoanCalculator;
