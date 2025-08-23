
import { supabase } from './supabase-client.js';

const $ = (s, r=document)=> r.querySelector(s);
const on = (el, ev, fn)=> el && el.addEventListener(ev, fn);
const fmt = (n)=> (n==null||isNaN(n))? '' : (+n).toFixed(3);

function setAuthed(flag){ document.body.classList.toggle('authed', !!flag); }
function showGate(flag){ $('#gate').classList.toggle('active', flag); $('#app').classList.toggle('active', !flag); }

async function loadBanks(){
  const sel = $('#mrr-bank');
  sel.innerHTML = '<option value="">-- เลือกธนาคาร --</option>';
  const { data, error } = await supabase.from('banks').select('id,name').order('name');
  if(error) return console.error(error);
  data.forEach(b=> sel.insertAdjacentHTML('beforeend', `<option value="${b.id}">${b.name}</option>`));
}

async function addMRR(){
  const bank = $('#mrr-bank').value;
  const rate = parseFloat($('#mrr-value').value);
  const date = $('#mrr-date').value;
  const src = $('#mrr-source').value || null;
  if(!bank || isNaN(rate) || !date){ alert('กรอกข้อมูลให้ครบ'); return; }
  const { error } = await supabase.from('base_rates').insert({ bank_id: bank, type: 'MRR', rate, effective_date: date, source: src });
  if(error){ alert(error.message); return; }
  await loadMRRHistory();
  toast('เพิ่ม MRR แล้ว');
}

async function loadMRRHistory(){
  const bank = $('#mrr-bank').value;
  const tbody = $('#mrr-history-rows');
  const note = $('#mrr-latest');
  tbody.innerHTML=''; note.textContent='';
  if(!bank) return;
  const { data, error } = await supabase.from('base_rates')
    .select('rate,effective_date,source').eq('bank_id', bank).eq('type','MRR')
    .order('effective_date', { ascending:false }).limit(50);
  if(error){ console.error(error); return; }
  data.forEach(r=>{
    tbody.insertAdjacentHTML('beforeend', `<tr><td>${r.effective_date||''}</td><td class="num">${fmt(r.rate)}</td><td>${r.source? `<a href="${r.source}" target="_blank">ลิงก์</a>`:''}</td></tr>`);
  });
  if(data[0]) note.textContent = `ล่าสุด: ${fmt(data[0].rate)}% (มีผล ${data[0].effective_date})`;
}

async function applyLatestMRR(){
  const bank = $('#mrr-bank').value;
  if(!bank){ alert('เลือกธนาคาร'); return; }
  const { data, error } = await supabase.from('base_rates').select('rate,effective_date').eq('bank_id', bank).eq('type','MRR').order('effective_date', { ascending:false }).limit(1).maybeSingle();
  if(error){ alert(error.message); return; }
  if(!data){ alert('ยังไม่มีข้อมูล'); return; }
  const { error: e2 } = await supabase.from('banks').update({ current_mrr: data.rate }).eq('id', bank);
  if(e2){ alert(e2.message); return; }
  toast(`อัปเดต MRR ล่าสุดให้ธนาคารแล้ว (${fmt(data.rate)}%)`);
}

// toast
let tmr; function toast(msg, type=''){ const el=$('#toast'); el.textContent=msg; el.className='toast show'+(type?' '+type:''); clearTimeout(tmr); tmr=setTimeout(()=>el.classList.remove('show'),2000); }

// auth gate just for visibility; your existing admin.js (if any) can still manage auth too
(async ()=>{
  const { data:{ session } } = await supabase.auth.getSession();
  const authed = !!session;
  setAuthed(authed); showGate(!authed);
  if(authed){ await loadBanks(); }
  supabase.auth.onAuthStateChange(async (_e, s)=>{ setAuthed(!!s); showGate(!s); if(s) await loadBanks(); });
})();

// events
on($('#mrr-add'), 'click', addMRR);
on($('#mrr-apply-latest'), 'click', applyLatestMRR);
on($('#mrr-bank'), 'change', loadMRRHistory);
