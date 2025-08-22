// admin-rates.js — base_rates history + apply-latest to banks.current_*
import { supabase } from './supabase-client.js';

const el = (id) => document.getElementById(id);
const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : Number(parseFloat(v).toFixed(3));

const state = { banks: [], history: [] };

function fmtRate(n){ return (n==null || isNaN(n)) ? '-' : Number(n).toFixed(3); }
function fmtDate(d){ if (!d) return '-'; try { return new Date(d).toISOString().slice(0,10);} catch { return d; } }

async function fetchBanks(){
  const { data, error } = await supabase.from('banks')
    .select('id, name, current_mrr, current_mlr, current_mor, base_updated_at')
    .order('name', { ascending: true });
  if (error) throw error;
  state.banks = data || [];
  const sel = el('rates-bank-select');
  if (sel) sel.innerHTML = state.banks.map(b=>`<option value="${b.id}">${b.name ?? ('Bank '+b.id)}</option>`).join('');
}

async function fetchHistory(bankId){
  const { data, error } = await supabase.from('base_rates')
    .select('id, rate_type, rate, effective_from, source_url')
    .eq('bank_id', bankId)
    .order('effective_from', { ascending: false });
  if (error) throw error;
  state.history = data || [];
  renderHistory();
  renderLatestSummary(bankId);
}

function latestByType(){
  const latest = { MRR: null, MLR: null, MOR: null };
  for (const t of ['MRR','MLR','MOR']) latest[t] = state.history.find(r => r.rate_type === t) || null;
  return latest;
}

function renderHistory(){
  const tbody = el('rates-history-rows'); if (!tbody) return;
  tbody.innerHTML = '';
  for (const r of state.history) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${fmtDate(r.effective_from)}</td>
      <td>${r.rate_type}</td>
      <td class="num">${fmtRate(r.rate)}</td>
      <td>${r.source_url ? `<a href="${r.source_url}" target="_blank" rel="noopener">แหล่งที่มา</a>` : '-'}</td>`;
    tbody.appendChild(tr);
  }
}

function renderLatestSummary(bankId){
  const latest = latestByType();
  const b = state.banks.find(x => Number(x.id) === Number(bankId));
  const elSum = el('latest-summary'); if (!elSum) return;
  const parts = [];
  for (const t of ['MRR','MLR','MOR']) {
    const L = latest[t];
    parts.push(`${t}: ${L ? fmtRate(L.rate) + '% ('+fmtDate(L.effective_from)+')' : '-'}`);
  }
  const cur = b ? `| banks ปัจจุบัน → MRR ${fmtRate(b.current_mrr)}% / MLR ${fmtRate(b.current_mlr)}% / MOR ${fmtRate(b.current_mor)}% (อัปเดต ${b.base_updated_at || '-'})` : '';
  elSum.textContent = `ล่าสุดจาก base_rates → ${parts.join(' | ')} ${cur}`;
}

async function addHistory(){
  const bankId = Number(el('rates-bank-select').value);
  const type = el('rates-type-select').value;
  const value = N(el('rates-value').value);
  const eff = el('rates-date').value || new Date().toISOString().slice(0,10);
  const src = el('rates-source').value || null;
  if (!bankId || !type || value == null) { alert('กรอกธนาคาร/ชนิด/อัตราให้ครบ'); return; }
  const { error } = await supabase.from('base_rates').insert({ bank_id: bankId, rate_type: type, rate: value, effective_from: eff, source_url: src });
  if (error) { alert('บันทึกไม่สำเร็จ: '+error.message); return; }
  await fetchHistory(bankId);
  el('rates-value').value=''; el('rates-source').value='';
}

async function applyLatestOne(){
  const bankId = Number(el('rates-bank-select').value);
  await fetchHistory(bankId);
  const L = latestByType();
  const patch = {
    current_mrr: L.MRR?.rate ?? null,
    current_mlr: L.MLR?.rate ?? null,
    current_mor: L.MOR?.rate ?? null,
    base_updated_at: new Date().toISOString().slice(0,10)
  };
  const { error } = await supabase.from('banks').update(patch).eq('id', bankId);
  if (error) { alert('อัปเดตไม่สำเร็จ: '+error.message); return; }
  await fetchBanks();
  renderLatestSummary(bankId);
  alert('อัปเดตค่า current_* จากรายการล่าสุดแล้ว');
}

async function applyLatestAll(){
  if (!confirm('อัปเดตค่า current_* ของธนาคารทั้งหมด โดยใช้ base_rates ล่าสุด?')) return;
  await fetchBanks();
  for (const b of state.banks) {
    const { data, error } = await supabase.from('base_rates')
      .select('rate_type, rate, effective_from')
      .eq('bank_id', b.id)
      .order('effective_from', { ascending: false });
    if (error) { console.error(error); continue; }
    const hist = data || [];
    const pick = (t) => { const row = hist.find(r => r.rate_type === t); return row ? row.rate : null; };
    const patch = {
      current_mrr: pick('MRR'),
      current_mlr: pick('MLR'),
      current_mor: pick('MOR'),
      base_updated_at: new Date().toISOString().slice(0,10)
    };
    await supabase.from('banks').update(patch).eq('id', b.id);
  }
  alert('อัปเดตค่า current_* ของทุกธนาคารแล้ว');
  await fetchBanks();
  const curId = Number(el('rates-bank-select').value);
  renderLatestSummary(curId);
}

function attachEvents(){
  el('rates-add-btn')?.addEventListener('click', addHistory);
  el('apply-latest-one')?.addEventListener('click', applyLatestOne);
  el('apply-latest-all')?.addEventListener('click', applyLatestAll);
  el('rates-bank-select')?.addEventListener('change', (e)=> fetchHistory(Number(e.target.value)));
}

async function bootRates(){
  const today = new Date().toISOString().slice(0,10);
  if (el('rates-date')) el('rates-date').value = today;
  await fetchBanks();
  const sel = el('rates-bank-select');
  if (sel && sel.options.length) { sel.value = sel.options[0].value; await fetchHistory(Number(sel.value)); }
}

document.addEventListener('DOMContentLoaded', ()=>{
  attachEvents();
  document.getElementById('nav-rates-btn')?.addEventListener('click', () => { bootRates(); }, { once: true });
});
