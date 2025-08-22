'use strict';
// admin-rates.js (ASCII-only) - clean UI + base_rates history + apply-latest
// No Unicode, no optional chaining, no nullish coalescing.
import { supabase } from './supabase-client.js';

/* CSS injection to hide other sections when "rates" tab is active */
(function(){
  var css = [
    '#app.show-rates .container:not(#rates-panel),',
    '#app.show-rates section:not(#rates-panel){display:none !important;}',
    '#app.show-promotions #rates-panel{display:none !important;}',
    '.admin-nav button.active{outline:2px solid #3c6df0;background:rgba(60,109,240,.12);}'
  ].join('\n');
  var s = document.createElement('style');
  s.textContent = css;
  document.head.appendChild(s);
})();

function getEl(id){ return document.getElementById(id); }
function toNum3(v){
  if (v === '' || v === null || v === undefined) return null;
  var n = Number(v);
  if (!isFinite(n)) return null;
  return Number(n.toFixed(3));
}
function fmtRate(n){ return (n === null || n === undefined || !isFinite(Number(n))) ? '-' : Number(n).toFixed(3); }
function fmtDate(d){
  if (!d) return '-';
  try { return new Date(d).toISOString().slice(0,10); } catch(e){ return d; }
}

/* Tabs */
function showPromotions(){
  var app = getEl('app'); if (!app) return;
  app.classList.add('show-promotions');
  app.classList.remove('show-rates');
  var a = getEl('nav-promotions-btn'); if (a) a.classList.add('active');
  var b = getEl('nav-rates-btn'); if (b) b.classList.remove('active');
}
function showRates(){
  var app = getEl('app'); if (!app) return;
  app.classList.add('show-rates');
  app.classList.remove('show-promotions');
  var a = getEl('nav-promotions-btn'); if (a) a.classList.remove('active');
  var b = getEl('nav-rates-btn'); if (b) b.classList.add('active');
  var panel = getEl('rates-panel'); if (panel) panel.style.display = '';
}

/* State */
var state = { banks: [], history: [] };

/* Data ops */
async function fetchBanks(){
  var res = await supabase.from('banks')
    .select('id, name, current_mrr, current_mlr, current_mor, base_updated_at')
    .order('name', { ascending: true });
  if (res.error) throw res.error;
  state.banks = res.data || [];
  var sel = getEl('rates-bank-select');
  if (sel) sel.innerHTML = (state.banks || []).map(function(b){
    return '<option value="'+b.id+'">'+(b.name || ('Bank '+b.id))+'</option>';
  }).join('');
}
async function fetchHistory(bankId){
  var res = await supabase.from('base_rates')
    .select('id, rate_type, rate, effective_from, source_url')
    .eq('bank_id', bankId)
    .order('effective_from', { ascending: false });
  if (res.error) throw res.error;
  state.history = res.data || [];
  renderHistory();
  renderLatestSummary(bankId);
}

/* Render */
function latestByType(){
  var out = { MRR:null, MLR:null, MOR:null };
  var i, r;
  for (i=0; i<state.history.length; i++){
    r = state.history[i];
    if ((r.rate_type === 'MRR' || r.rate_type === 'MLR' || r.rate_type === 'MOR') && !out[r.rate_type]) {
      out[r.rate_type] = r;
    }
  }
  return out;
}
function renderHistory(){
  var tbody = getEl('rates-history-rows'); if (!tbody) return;
  tbody.innerHTML = '';
  var i, r, tr;
  for (i=0; i<state.history.length; i++){
    r = state.history[i];
    tr = document.createElement('tr');
    tr.innerHTML = '<td>'+fmtDate(r.effective_from)+'</td>' +
      '<td>'+r.rate_type+'</td>' +
      '<td class="num">'+fmtRate(r.rate)+'</td>' +
      '<td>'+(r.source_url ? '<a href="'+r.source_url+'" target="_blank" rel="noopener">source</a>' : '-')+'</td>';
    tbody.appendChild(tr);
  }
}
function renderLatestSummary(bankId){
  var L = latestByType();
  var b = (state.banks || []).find(function(x){ return Number(x.id) === Number(bankId); });
  var el = getEl('latest-summary'); if (!el) return;
  var parts = ['MRR','MLR','MOR'].map(function(t){
    var r = L[t];
    return t+': '+(r ? (fmtRate(r.rate)+'% ('+fmtDate(r.effective_from)+')') : '-');
  });
  var cur = b ? (' | banks current -> MRR '+fmtRate(b.current_mrr)+'% / MLR '+fmtRate(b.current_mlr)+'% / MOR '+fmtRate(b.current_mor)+'% (updated '+(b.base_updated_at || '-')+')') : '';
  el.textContent = 'Latest from base_rates -> ' + parts.join(' | ') + cur;
}

/* Actions */
async function addHistory(){
  var bankId = Number(getEl('rates-bank-select').value);
  var type = getEl('rates-type-select').value;
  var value = toNum3(getEl('rates-value').value);
  var eff = getEl('rates-date').value || new Date().toISOString().slice(0,10);
  var src = getEl('rates-source').value || null;
  if (!bankId || !type || value === null){ alert('Please fill bank / type / rate'); return; }
  var res = await supabase.from('base_rates').insert({ bank_id: bankId, rate_type: type, rate: value, effective_from: eff, source_url: src });
  if (res.error){ alert('Insert failed: '+res.error.message); return; }
  await fetchHistory(bankId);
  getEl('rates-value').value=''; getEl('rates-source').value='';
}
async function applyLatestOne(){
  var bankId = Number(getEl('rates-bank-select').value);
  await fetchHistory(bankId);
  var L = latestByType();
  var patch = {
    current_mrr: L.MRR ? L.MRR.rate : null,
    current_mlr: L.MLR ? L.MLR.rate : null,
    current_mor: L.MOR ? L.MOR.rate : null,
    base_updated_at: new Date().toISOString().slice(0,10)
  };
  var res = await supabase.from('banks').update(patch).eq('id', bankId);
  if (res.error){ alert('Update failed: '+res.error.message); return; }
  await fetchBanks();
  renderLatestSummary(bankId);
  alert('Updated current_* from latest base_rates.');
}
async function applyLatestAll(){
  if (!confirm('Apply latest base_rates to all banks?')) return;
  await fetchBanks();
  var i, b, res, hist, pick, patch;
  for (i=0; i<state.banks.length; i++){
    b = state.banks[i];
    res = await supabase.from('base_rates')
      .select('rate_type, rate, effective_from').eq('bank_id', b.id)
      .order('effective_from', { ascending: false });
    if (res.error){ console.error(res.error); continue; }
    hist = res.data || [];
    pick = function(t){ var j; for(j=0;j<hist.length;j++){ if(hist[j].rate_type===t) return hist[j].rate; } return null; };
    patch = {
      current_mrr: pick('MRR'),
      current_mlr: pick('MLR'),
      current_mor: pick('MOR'),
      base_updated_at: new Date().toISOString().slice(0,10)
    };
    await supabase.from('banks').update(patch).eq('id', b.id);
  }
  alert('Updated current_* for all banks.');
  await fetchBanks();
  var curId = Number(getEl('rates-bank-select').value);
  renderLatestSummary(curId);
}

/* Boot */
function attachEvents(){
  var a1 = getEl('rates-add-btn'); if (a1) a1.addEventListener('click', addHistory);
  var a2 = getEl('apply-latest-one'); if (a2) a2.addEventListener('click', applyLatestOne);
  var a3 = getEl('apply-latest-all'); if (a3) a3.addEventListener('click', applyLatestAll);
  var sel = getEl('rates-bank-select'); if (sel) sel.addEventListener('change', function(e){ fetchHistory(Number(e.target.value)); });
  var btnP = getEl('nav-promotions-btn'); if (btnP) btnP.addEventListener('click', showPromotions);
  var btnR = getEl('nav-rates-btn'); if (btnR) btnR.addEventListener('click', function(){
    showRates();
    if (!state.banks.length){
      var d = getEl('rates-date'); if (d) d.value = new Date().toISOString().slice(0,10);
      fetchBanks().then(function(){
        var s = getEl('rates-bank-select');
        if (s && s.options.length){ s.value = s.options[0].value; fetchHistory(Number(s.value)); }
      });
    }
  }, { once: true });
}
document.addEventListener('DOMContentLoaded', function(){ attachEvents(); showPromotions(); console.log('[RATES] ascii module loaded'); });
