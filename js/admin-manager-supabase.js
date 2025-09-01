
// admin-manager-supabase.js
import './supabase-config.js';
import './supabase-init.js';
import Auth from './auth-manager.js';
import Data from './data-manager.js';

async function init(){
  const me = await Auth.requireRole('admin');
  if(!me) return;
  document.querySelector('#me').textContent = `${me.user.email} (admin)`;
  // Load data
  try{
    const banks = await Data.getBanks();
    const promos = await Data.getActivePromotions('MORTGAGE');
    const tb1 = document.querySelector('#banks tbody');
    const tb2 = document.querySelector('#promos tbody');
    tb1.innerHTML = banks.map(b => `<tr><td>${b.short_name||''}</td><td>${b.name||''}</td></tr>`).join('') || '<tr><td colspan="2" class="note">ไม่มีข้อมูล</td></tr>';
    tb2.innerHTML = promos.map(p => `<tr><td>${p.bank_short||''}</td><td>${p.title||''}</td></tr>`).join('') || '<tr><td colspan="2" class="note">ไม่มีข้อมูล</td></tr>';
  }catch(e){
    console.error(e);
    document.querySelector('#err').textContent = e.message || String(e);
    document.querySelector('#err').classList.remove('hidden');
  }
}
window.addEventListener('DOMContentLoaded', init);
