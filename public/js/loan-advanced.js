
// Loan calculator with validations + DSR/LTV/age-tenor limits + promo effects
import { getSupabase } from './supabaseClient.js';

const qs = (s)=>document.querySelector(s);
const qsa = (s)=>Array.from(document.querySelectorAll(s));

const PRODUCTS = ['MORTGAGE','REFINANCE','PERSONAL','SME'];

function pmt(r, n, P){ if (!r) return P/n; const x = Math.pow(1+r,n); return P*r*x/(x-1); }
function fmt(n, d=0){ return (n??0).toLocaleString('th-TH', { maximumFractionDigits: d }); }
function clamp(n, min, max){ return Math.max(min, Math.min(max, n)); }

async function loadBanks(){
  const sb = await getSupabase();
  const tries = ['id, bank_name, mrr', 'id, name, mrr', 'id, bank, mrr'];
  for(const sel of tries){
    const { data, error } = await sb.from('banks').select(sel).order('bank_name',{ascending:true});
    if(!error){
      return (data||[]).map(r=>({ id:r.id, name:r.bank_name ?? r.name ?? r.bank ?? '-', mrr: Number(r.mrr)||0 }));
    }
  }
  return [];
}
async function loadRules(){
  const sb = await getSupabase();
  const { data, error } = await sb.from('bank_rules').select('*').limit(1000);
  if (error) return [];
  return data||[];
}
async function loadPromos(prod){
  const sb = await getSupabase();
  const today = new Date().toISOString().slice(0,10);
  const { data, error } = await sb.from('promotions').select('*')
    .eq('active', true).eq('product_type', prod)
    .or(`start_date.is.null,end_date.is.null,and(start_date.lte.${today},end_date.gte.${today})`).limit(1000);
  if (error) return [];
  return data||[];
}

function bestPromoFor(promos, bankId){
  // pick bank-specific first, otherwise global; prefer larger discount or lower fixed_rate
  const cand = promos.filter(p => !p.bank_id || p.bank_id===bankId);
  if (!cand.length) return null;
  cand.sort((a,b)=>{
    const da = (a.rate_discount_bps||0), db=(b.rate_discount_bps||0);
    const fa = (a.fixed_rate??99), fb = (b.fixed_rate??99);
    return (fb - da) - (fa - db); // heuristic
  });
  return cand[0];
}

function ruleMatch(rule, req){
  if (!rule) return true;
  if (rule.product_type && rule.product_type !== req.product) return false;
  if (rule.property_type && rule.property_type !== (req.property_type||null)) return false;
  if (rule.home_number && rule.home_number !== (req.home_number||null)) return false;
  return true;
}

export async function runLoanPage(){
  const elProd = qs('#product');
  const elIncome = qs('#income');
  const elExtra = qs('#income-extra');
  const elDebt = qs('#debt');
  const elAge = qs('#age');
  const elYears = qs('#years');
  const elProperty = qs('#property');
  const elPropertyType = qs('#property-type');
  const elHome = qs('#home-number');
  const elLoan = qs('#loan-amount');
  const btn = qs('#btn-run');
  const caps = qs('#caps');
  const offersBody = qs('#offers');
  const note = qs('#note');
  const modeRadio = ()=> (document.querySelector('input[name="mode"]:checked')?.value || 'max');

  function toggleBlocks(){
    const mort = (elProd.value==='MORTGAGE' || elProd.value==='REFINANCE');
    qs('#block-property').style.display = mort ? 'block' : 'none';
    qs('#block-prop-meta').style.display = mort ? 'block' : 'none';
    qs('#block-home').style.display = mort ? 'block' : 'none';
    qs('#block-loan').style.display = modeRadio()==='check' ? 'block' : 'none';
  }
  qsa('input[name="mode"]').forEach(r=>r.addEventListener('change', toggleBlocks));
  elProd.addEventListener('change', toggleBlocks);
  toggleBlocks();

  const banks = await loadBanks();
  const allRules = await loadRules();

  function validate(req){
    const errs = [];
    if (!req.income) errs.push('กรอก "รายได้สุทธิ/เดือน"');
    if (['MORTGAGE','REFINANCE'].includes(req.product) && !req.property_value) errs.push('กรอก "มูลค่าหลักประกัน"');
    if (modeRadio()==='check' && !req.amount) errs.push('กรอก "วงเงินที่ต้องการกู้"');
    return errs;
  }

  async function compute(){
    const req = {
      product: elProd.value,
      income: Number(elIncome.value||0) + Number(elExtra.value||0),
      debt: Number(elDebt.value||0),
      age: clamp(Number(elAge.value||0), 18, 80),
      years: clamp(Number(elYears.value||1), 1, 40),
      property_value: Number(elProperty.value||0),
      property_type: elPropertyType.value || null,
      home_number: elHome.value ? Number(elHome.value) : null,
      amount: Number(elLoan.value||0)
    };
    const errors = validate(req);
    if (errors.length){ caps.innerHTML = `<span class="warn">${errors.join(' • ')}</span>`; offersBody.innerHTML=''; return; }

    const rules = allRules.filter(r => ruleMatch(r, req));
    const promos = await loadPromos(req.product);

    // Determine caps with a "typical" rate baseline (median MRR)
    const mrrs = banks.map(b=>b.mrr).sort((a,b)=>a-b);
    const baseRate = (mrrs[Math.floor(mrrs.length/2)]||7)/100/12;

    // adjust tenor by typical rule (take the loosest among matches for baseline)
    const maxTenor = Math.min(req.years, Math.max(1, ...rules.map(r=>r.max_tenor_years||req.years)));
    const maxAge = Math.min(...rules.map(r=>r.max_age_at_maturity||99));
    let useYears = req.years;
    if (maxAge<99) useYears = Math.min(useYears, Math.max(1, maxAge - req.age));
    useYears = Math.min(useYears, maxTenor);
    const n = useYears*12;

    const dtiCap = Math.max(...rules.map(r=>r.dti_cap||0.45));
    const ltvCap = Math.max(...rules.map(r=>r.ltv_cap||0.9));
    const payMax = Math.max(0, dtiCap*req.income - req.debt);
    const PmaxDSR = payMax>0 ? payMax * (1 - Math.pow(1+baseRate, -n)) / baseRate : 0;
    const PmaxLTV = ['MORTGAGE','REFINANCE'].includes(req.product) ? req.property_value * ltvCap : Infinity;
    const Pcap = Math.min(PmaxDSR||Infinity, PmaxLTV||Infinity);

    // If max mode => set amount to cap (rough)
    const amount = (modeRadio()==='max') ? (Pcap===Infinity?0:Pcap) : req.amount;
    caps.innerHTML = `
      เพดานตาม DSR: <b>${fmt(PmaxDSR)}</b> • LTV: <b>${PmaxLTV===Infinity?'ไม่เกี่ยว':fmt(PmaxLTV)}</b>
      • ใช้ผ่อน(ปี): <span class="pill">${useYears}</span> • วงเงินเสนอ: <b>${fmt(amount)}</b>
    `;

    // Build offers per bank
    const offers = [];
    for(const b of banks){
      // find most relevant rule (prefer exact property/home match)
      const rule = rules.find(r=>r.bank_id===b.id && r.product_type===req.product &&
                                  (r.property_type??null) === (req.property_type??null) &&
                                  (r.home_number??null) === (req.home_number??null))
                 || rules.find(r=>r.bank_id===b.id && r.product_type===req.product)
                 || {};
      let years = req.years;
      if (rule.max_tenor_years) years = Math.min(years, rule.max_tenor_years);
      if (rule.max_age_at_maturity) years = Math.min(years, Math.max(1, rule.max_age_at_maturity - req.age));
      const nBank = years*12;

      const promo = bestPromoFor(promos, b.id);
      const rateEff = Math.max(0, (b.mrr||0) - (promo?.rate_discount_bps||0)/100);
      const rEff = rateEff/100/12;

      // PMT with promo fixed phase (conservative: take max of two-phase payments)
      let pay = pmt(rEff, nBank, amount);
      let pay1=null, pay2=null;
      if (promo?.fixed_rate && promo?.fixed_months){
        const r1 = (promo.fixed_rate)/100/12;
        pay1 = pmt(r1, promo.fixed_months, amount);
        pay2 = pmt(rEff, Math.max(1, nBank - promo.fixed_months), amount);
        pay = Math.max(pay1, pay2);
      }

      const dti = req.income>0 ? ((req.debt + pay)/req.income) : 999;
      const ltvRef = promo?.max_ltv_override ?? rule.ltv_cap ?? ltvCap;
      const ltvOk = ['MORTGAGE','REFINANCE'].includes(req.product) ? (amount <= req.property_value * (ltvRef || 0)) : true;
      const dtiOk = rule.dti_cap ? (dti <= (rule.dti_cap*100)) : (dti <= (dtiCap*100));
      const status = `${dtiOk?'DSR✔':'DSR✖'} • ${ltvOk?'LTV✔':'LTV✖'} • ผ่อน ${years} ปี`;

      offers.push({
        bank: b.name,
        promoTxt: promo ? (promo.title || 'โปรพิเศษ') : '-',
        rateTxt: `${rateEff.toFixed(2)}%`,
        payTxt: pay.toFixed(0) + (pay1? ` (ช่วงโปร~${fmt(pay1)} หลังโปร~${fmt(pay2)})` : ''),
        dtiTxt: dti.toFixed(1) + '%',
        status,
        ok: dtiOk && ltvOk,
        payVal: pay
      });
    }
    offers.sort((a,b)=>a.payVal - b.payVal);
    offersBody.innerHTML = '';
    offers.slice(0,12).forEach(o=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `<td>${o.bank}</td><td>${o.promoTxt}</td><td>${o.rateTxt}</td><td>${fmt(o.payVal)}</td><td>${o.dtiTxt}</td><td>${o.status}</td>`;
      offersBody.appendChild(tr);
    });
    note.textContent = 'ผลลัพธ์เป็นการประมาณการตาม MRR/โปร/กติกาที่ตั้งไว้ อาจต่างจากอนุมัติจริง';
  }

  btn.addEventListener('click', compute);
  compute();
}
