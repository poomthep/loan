// admin-rates.js (clean build)
'use strict';
import { supabase } from './supabase-client.js';

const $ = (id) => document.getElementById(id);
const n3 = (v) => {
  if (v === '' || v === null || v === undefined) return null;
  const x = String(v).replace(/[^\d.]/g, '');
  const n = Number(x);
  if (!isFinite(n)) return null;
  return Number(n.toFixed(3));
};
const fmtRate = (n) => (n===null || n===undefined || !isFinite(Number(n))) ? '-' : Number(n).toFixed(3);
const fmtDate = (d) => { if(!d) return '-'; try { return new Date(d).toISOString().slice(0,10); } catch(e) { return d; } };

const state = { banks: [], history: [] };

async function fetchBanks(){
  const r = await supabase.from('banks').select('id,name,current_mrr,current_mlr,current_mor,base_updated_at').order('name', { ascending: true });
  if (r.error) throw r.error;
  state.banks = r.data || [];
  const sel = $('rates-bank-select');
  if (sel) sel.innerHTML = (state.banks||[]).map(b => `<option value="${b.id}">${b.name || ('Bank '+b.id)}</option>`).join('');
}

async function fetchHistory(bankId){
  const r = await supabase.from('base_rates').select('id,rate_type,rate,effective_from,source_url').eq('bank_id', bankId).order('effective_from', { ascending: false });
  if (r.error) throw r.error;
  state.history = r.data || [];
  renderHistory();
  renderLatestSummary(bankId);
}

function latestByType(){
  const out = { MRR:null, MLR:null, MOR:null };
  for (let i=0; i<state.history.length; i++){
    const row = state.history[i];
    if (!out[row.rate_type]) out[row.rate_type] = row;
  }
  return out;
}

function renderHistory(){
  const tb = $('rates-history-rows');
  if (!tb) return;
  tb.innerHTML = '';
  for (let i=0; i<state.history.length; i++){
    const r = state.history[i];
    const tr = document.createElement('tr');
    tr.innerHTML = `<td>${fmtDate(r.effective_from)}</td>`
      + `<td>${r.rate_type}</td>`
      + `<td class="num">${fmtRate(r.rate)}</td>`
      + `<td>${r.source_url ? `<a href="${r.source_url}" target="_blank" rel="noopener">link</a>` : '-'}</td>`;
    tb.appendChild(tr);
  }
}

function renderLatestSummary(bankId){
  const L = latestByType();
  const b = (state.banks||[]).find(x => Number(x.id) === Number(bankId));
  const el = $('latest-summary');
  if (!el) return;
  const parts = ['MRR','MLR','MOR'].map(t => {
    const r = L[t];
    return `${t}: ${r ? `${fmtRate(r.rate)}% (${fmtDate(r.effective_from)})` : '-'}`;
  });
  const cur = b ? ` | banks -> MRR ${fmtRate(b.current_mrr)}% / MLR ${fmtRate(b.current_mlr)}% / MOR ${fmtRate(b.current_mor)}% (updated ${b.base_updated_at || '-'})` : '';
  el.textContent = `Latest from base_rates -> ${parts.join(' | ')}${cur}`;
}

async function addHistory(){
  const bankId = Number($('rates-bank-select').value);
  const type   = $('rates-type-select').value;
  const value  = n3($('rates-value').value);
  const eff    = $('rates-date').value || new Date().toISOString().slice(0,10);
  const src    = $('rates-source').value || null;
  if (!bankId || !type || value === null){ alert('กรอกธนาคาร/ชนิด/อัตราให้ครบ'); return; }
  const r = await supabase.from('base_rates').insert({ bank_id: bankId, rate_type: type, rate: value, effective_from: eff, source_url: src });
  if (r.error){ alert('บันทึกไม่สำเร็จ: '+r.error.message); return; }
  await fetchHistory(bankId);
  $('rates-value').value = ''; $('rates-source').value = '';
}

async function applyLatestOne(){
  const bankId = Number($('rates-bank-select').value);
  await fetchHistory(bankId);
  const L = latestByType();
  const patch = {
    current_mrr: L.MRR ? L.MRR.rate : null,
    current_mlr: L.MLR ? L.MLR.rate : null,
    current_mor: L.MOR ? L.MOR.rate : null,
    base_updated_at: new Date().toISOString().slice(0,10)
  };
  const r = await supabase.from('banks').update(patch).eq('id', bankId);
  if (r.error){ alert('อัปเดตไม่สำเร็จ: '+r.error.message); return; }
  await fetchBanks();
  renderLatestSummary(bankId);
  alert('อัปเดตแล้ว');
}

async function applyLatestAll(){
  if (!confirm('อัปเดต current_* ของทุกธนาคารจาก base_rates ล่าสุด?')) return;
  await fetchBanks();
  for (let i=0; i<state.banks.length; i++){
    const b = state.banks[i];
    const r = await supabase.from('base_rates').select('rate_type,rate,effective_from').eq('bank_id', b.id).order('effective_from', { ascending: false });
    if (r.error){ console.error(r.error); continue; }
    const hist = r.data || [];
    const pick = (t) => { const row = hist.find(x => x.rate_type === t); return row ? row.rate : null; };
    const patch = {
      current_mrr: pick('MRR'),
      current_mlr: pick('MLR'),
      current_mor: pick('MOR'),
      base_updated_at: new Date().toISOString().slice(0,10)
    };
    await supabase.from('banks').update(patch).eq('id', b.id);
  }
  alert('อัปเดตครบแล้ว');
  await fetchBanks();
  const curId = Number($('rates-bank-select').value);
  renderLatestSummary(curId);
}

function attach(){
  const addBtn = $('rates-add-btn');
  const oneBtn = $('apply-latest-one');
  const allBtn = $('apply-latest-all');
  if (addBtn) addBtn.addEventListener('click', addHistory);
  if (oneBtn) oneBtn.addEventListener('click', applyLatestOne);
  if (allBtn) allBtn.addEventListener('click', applyLatestAll);
  const bankSel = $('rates-bank-select');
  if (bankSel) bankSel.addEventListener('change', e => fetchHistory(Number(e.target.value)));
  // mobile UX
  if (window.FormUX){
    window.FormUX.enableEnterNavigation();
    window.FormUX.enableNumericKeypad('#rates-value');
  }
}

document.addEventListener('DOMContentLoaded', async () => {
  try {
    await fetchBanks();
    const sel = $('rates-bank-select');
    if (sel && sel.options.length){ sel.value = sel.options[0].value; await fetchHistory(Number(sel.value)); }
  } catch (e) {
    console.error(e);
    alert('โหลดข้อมูลล้มเหลว: ' + e.message);
  }
  attach();
});
