import { supabase } from '../config/supabase-init.js';

export async function getLoanCapacity(salary, bonus, otherIncome, debt, dsr, rate, years){
  const { data, error } = await supabase.rpc('calculate_loan_capacity', {
    income_salary: salary,
    income_bonus: bonus,
    income_other: otherIncome,
    debt: debt,
    dsr_ratio: dsr,
    annual_rate: rate,
    years: years
  });
  if(error) throw error;
  return data;
}

export async function getInstallment(loanAmount, rate, years){
  const { data, error } = await supabase.rpc('calculate_installment', {
    loan_amount: loanAmount,
    annual_rate: rate,
    years: years
  });
  if(error) throw error;
  return data;
}

export async function getPromotions(){
  const { data, error } = await supabase.from('promotions').select('id, promo_name, rate_year1, rate_year2, rate_year3, final_rate_formula, conditions, banks(name)');
  if(error) throw error;
  return data;
}

export async function calculatePromotionInstallments(promos, loanAmount, years){
  return promos.map(p => {
    const year1Rate = p.rate_year1 || 0;
    const year2Rate = p.rate_year2 || year1Rate;
    const year3Rate = p.rate_year3 || year2Rate;
    const avg3yRate = (year1Rate + year2Rate + year3Rate) / 3;
    const monthlyRate1 = year1Rate/100/12;
    const monthlyRateAvg = avg3yRate/100/12;
    const months = years*12;
    const installmentYear1 = loanAmount*monthlyRate1/(1-Math.pow(1+monthlyRate1,-months));
    const installmentAvg3y = loanAmount*monthlyRateAvg/(1-Math.pow(1+monthlyRateAvg,-months));
    return { bank: p.banks?.name||'-', promo_name: p.promo_name, year1Rate, avg3yRate, installmentYear1, installmentAvg3y, conditions: p.conditions };
  });
}
