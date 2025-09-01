
// loan-app-manager.js
import './supabase-config.js'; // optional override
import './supabase-init.js';
import Auth from './auth-manager.js';
import Data from './data-manager.js';
import * as LCNS from './loan-calculator-supabase.js';
const LoanCalculator = LCNS.LoanCalculator || LCNS.default;

class LoanAppManager{
  constructor(){ this.calculator = new LoanCalculator(); }
  async init(){
    // require signed-in (user or admin)
    this.me = await Auth.requireRole(['user','admin']);
    if(!this.me) return;

    // Bind form
    this.bindUI();
    // show connection
    const ok = await Data.checkConnection();
    const el = document.querySelector('#conn');
    if(el){ el.textContent = ok? 'เชื่อมต่อฐานข้อมูลพร้อม ✔' : 'เชื่อมต่อฐานข้อมูลมีปัญหา ✖'; el.className = 'alert '+(ok?'ok':'err'); }
  }
  bindUI(){
    const $ = (s)=>document.querySelector(s);
    const runBtn = $('#btn-run');
    const modeRadios = document.querySelectorAll('input[name="mode"]');
    const resBox = $('#result');
    const params = ()=>{
      return {
        income: +($('#income').value.replace(/,/g,''))||0,
        debt: +($('#debt').value.replace(/,/g,''))||0,
        years: +($('#years').value)||20,
        loanAmount: +($('#loanAmount').value.replace(/,/g,''))||0,
      }
    };
    const render = (obj)=>{ resBox.textContent = JSON.stringify(obj,null,2); }
    const run = ()=>{
      const p = params();
      const mode = [...modeRadios].find(r=>r.checked)?.value || 'max';
      if(mode==='max'){
        const max = this.calculator.calculateMaxLoanAmount(p);
        render({ mode, maxLoan: max });
        Data.saveCalculation({ mode, params:p, result:{max} });
      }else{
        const r = this.calculator.checkLoanAmount(p);
        render({ mode, ...r });
        Data.saveCalculation({ mode, params:p, result:r });
      }
    };
    runBtn?.addEventListener('click', run);
  }
}

window.addEventListener('DOMContentLoaded', ()=> new LoanAppManager().init());
