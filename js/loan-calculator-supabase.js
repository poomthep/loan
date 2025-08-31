
import supabase from './supabase-init.js'; import * as DM from './data-manager.js';
export default class LoanCalculator{
  constructor(){ this._subs=[]; }
  _effectiveRate(p){ if(!p) return 6.5; if(p.year1_rate) return p.year1_rate; if(p.base_rate!=null&&p.spread!=null) return Number(p.base_rate)+Number(p.spread); return 6.5; }
  _pmt(rYear,years,principal){ const r=(rYear/100)/12, n=years*12; if(r===0) return principal/n; return principal*r/(1-Math.pow(1+r,-n)); }
  _dsr(monthlyDebt,income){ if(!income) return 100; return (monthlyDebt/income)*100; }
  async calculateMaxLoanAmount(params){
    const productType=params.productType||'MORTGAGE'; const banks=await DM.getBanks(); const promos=await DM.getActivePromotions(productType);
    const monthlyIncome=(params.income||0)+(params.incomeExtra||0); const maxDsr=70; const capacity=Math.max(0, monthlyIncome*(maxDsr/100)-(params.debt||0));
    const out=[];
    for(const b of banks){
      const promo=promos.find(p=>p.bank_id===b.id)||null; const eff=this._effectiveRate(promo);
      const principalCap = capacity>0 ? Math.round(this._solvePrincipal(eff, params.years||20, capacity)) : 0;
      const ltvCap = (params.homeNumber&&Number(params.homeNumber)>1) ? 90 : 100;
      const principalByLtv = params.propertyValue ? Math.min(principalCap, Math.floor(params.propertyValue*(ltvCap/100))) : principalCap;
      const monthlyPayment=this._pmt(eff, params.years||20, principalByLtv); const dsr=this._dsr((params.debt||0)+monthlyPayment, monthlyIncome);
      out.push({bankId:b.id, bankShortName:b.short_name, bankName:b.name,
        promotion: promo?{id:promo.id,title:promo.title,description:promo.description||'',year1Rate:promo.year1_rate,baseRate:promo.base_rate,spread:promo.spread}:null,
        interestRate:eff, monthlyPayment:Math.round(monthlyPayment), maxLoanAmount:principalByLtv,
        dsr:Number(dsr.toFixed(2)), ltv:Number((params.propertyValue?(principalByLtv/params.propertyValue)*100:0).toFixed(2)),
        status: (principalByLtv>0 && dsr<=maxDsr)?'APPROVED':'REJECTED',
        reasons: principalByLtv<=0?'ความสามารถผ่อนไม่พอ':(dsr>maxDsr?'DSR เกินเกณฑ์':'')
      });
    }
    out.sort((a,b)=>(b.maxLoanAmount||0)-(a.maxLoanAmount||0)); return out;
  }
  async checkLoanAmount(params){
    const productType=params.productType||'MORTGAGE', desired=Number(params.loanAmount||0), banks=await DM.getBanks(), promos=await DM.getActivePromotions(productType);
    const monthlyIncome=(params.income||0)+(params.incomeExtra||0), maxDsr=70; const out=[];
    for(const b of banks){
      const promo=promos.find(p=>p.bank_id===b.id)||null; const eff=this._effectiveRate(promo);
      const pmt=this._pmt(eff, params.years||20, desired); const dsr=this._dsr((params.debt||0)+pmt, monthlyIncome);
      const ltv=params.propertyValue?(desired/params.propertyValue)*100:0; const ltvCap=(params.homeNumber&&Number(params.homeNumber)>1)?90:100; const passLtv=ltv<=ltvCap;
      const status=(dsr<=maxDsr && passLtv)?'APPROVED':'REJECTED'; const reasons=[dsr>maxDsr?'DSR เกินเกณฑ์':'', !passLtv?`LTV เกิน ${ltvCap}%`:'' ].filter(Boolean).join(' / ');
      out.push({bankId:b.id,bankShortName:b.short_name,bankName:b.name,promotion:promo?{id:promo.id,title:promo.title,description:promo.description||'',year1Rate:promo.year1_rate,baseRate:promo.base_rate,spread:promo.spread}:null,
        interestRate:eff, monthlyPayment:Math.round(pmt), loanAmount:desired, dsr:Number(dsr.toFixed(2)), ltv:Number(ltv.toFixed(2)), status, reasons});
    }
    out.sort((a,b)=>(a.dsr||0)-(b.dsr||0)); return out;
  }
  _solvePrincipal(rYear,years,targetPmt){ const r=(rYear/100)/12, n=years*12; if(r===0) return targetPmt*n; return targetPmt*(1-Math.pow(1+r,-n))/r; }
  async saveCalculation(params,results,mode){
    const payload={ product_type:params.productType||'MORTGAGE', income:params.income||0, debt:params.debt||0, income_extra:params.incomeExtra||0, age:params.age||0, tenure_years:params.years||0, property_value:params.propertyValue||0, property_type:params.propertyType||null, home_number:params.homeNumber||null, loan_amount:params.loanAmount||null, calculation_mode:mode, results:{ calculationResults:results } };
    const { error }=await supabase.from('calculations').insert(payload); return { error };
  }
  setupRealTimeUpdates(cb){ try{ const ch=supabase.channel('promotions-ch').on('postgres_changes',{event:'*',schema:'public',table:'promotions'},()=>{ try{cb&&cb('promotions')}catch(e){} }).subscribe(); this._subs.push(ch);}catch(e){} }
  cleanup(){ try{ for(const ch of this._subs){ try{ ch.unsubscribe(); }catch(e){} } }catch(e){} this._subs=[]; }
  static exportToCSV(rows){ if(!Array.isArray(rows)||!rows.length) return ''; const cols=['bankShortName','bankName','interestRate','monthlyPayment','maxLoanAmount','loanAmount','dsr','ltv','status']; const header=cols.join(','); return [header, ...rows.map(r=> cols.map(c=> JSON.stringify(r[c]??'')).join(','))].join('\n'); }
  static exportToJSON(rows,params){ return JSON.stringify({ params, results: rows }, null, 2); }
}
