import { getSupabase } from './supabaseClient.js';

function fmtMoney(n){
  return (n ?? 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
}
function qs(sel){ return document.querySelector(sel); }

function pmt(rateMonthly, nMonths, principal) {
  if (rateMonthly === 0) return principal / nMonths;
  const r = rateMonthly;
  const pow = Math.pow(1+r, nMonths);
  return principal * r * pow / (pow - 1);
}

async function loadBanks() {
  const supabase = await getSupabase();
  // allow flexible column names like earlier
  const tries = ['id, bank_name, mrr', 'id, name, mrr', 'id, bank, mrr', 'id, mrr'];
  for (const cols of tries) {
    const { data, error } = await supabase.from('banks').select(cols).order('mrr', { ascending: true }).limit(10);
    if (!error) {
      return (data || []).map(r => ({
        name: r.bank_name ?? r.name ?? r.bank ?? '(ไม่ระบุ)',
        mrr: Number(r.mrr)
      })).filter(x => !Number.isNaN(x.mrr));
    }
  }
  return [];
}

async function loadPromotions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('promotions').select('id, title, detail, active').eq('active', true).order('title');
  if (error) return [];
  return data || [];
}

export async function runLoanPage(){
  const inputAmount = qs('#loan-amount');
  const inputYears = qs('#loan-years');
  const inputIncome = qs('#income');
  const inputDebt = qs('#debt');
  const btnCalc = qs('#btn-calc');
  const tbody = qs('#compare-body');
  const summary = qs('#summary');
  const promoList = qs('#promo-list');

  const banks = await loadBanks();
  const promos = await loadPromotions();
  promoList.innerHTML = '';
  promos.forEach(p => {
    const li = document.createElement('li');
    li.textContent = `${p.title} — ${p.detail || ''}`;
    promoList.appendChild(li);
  });

  async function render(){
    const amount = Number(inputAmount.value || 0);
    const years = Number(inputYears.value || 1);
    const income = Number(inputIncome.value || 0);
    const debt = Number(inputDebt.value || 0);
    const n = years * 12;

    tbody.innerHTML = '';
    let best = null;

    banks.forEach(b => {
      const rMonthly = (Number(b.mrr) / 100) / 12;
      const pay = pmt(rMonthly, n, amount);
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${b.name}</td><td>${Number(b.mrr).toFixed(2)}</td><td>${fmtMoney(pay)}</td>`;
      tbody.appendChild(tr);
      if (!best || pay < best.pay) best = { bank: b.name, mrr: b.mrr, pay };
    });

    if (best) {
      const dti = income > 0 ? ((debt + best.pay) / income) * 100 : 0;
      summary.innerHTML = `ธนาคารที่ค่างวดต่ำสุด: <strong>${best.bank}</strong> (MRR ${best.mrr.toFixed(2)}%)  
ค่างวดประมาณ <strong>${fmtMoney(best.pay)}</strong> บาท/เดือน • DTI ~ <strong>${dti.toFixed(1)}%</strong>`;
    } else {
      summary.textContent = 'ยังไม่มีข้อมูลธนาคารหรือ MRR ในฐานข้อมูล';
    }
  }

  btnCalc.addEventListener('click', render);
  render();
}