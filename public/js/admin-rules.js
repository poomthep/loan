import { getSupabase } from './supabaseClient.js';
const qs=(s)=>document.querySelector(s); const qsa=(s)=>Array.from(document.querySelectorAll(s));
const PRODUCTS=['MORTGAGE','REFINANCE','PERSONAL','SME']; const PROPS=['','HOUSE','TOWNHOME','CONDO','LAND+HOUSE']; const HOMES=['','1','2','3'];

async function banks(){ const sb=await getSupabase(); const {data}=await sb.from('banks').select('id, bank_name').order('bank_name'); return (data||[]).map(r=>({id:r.id,name:r.bank_name})); }
async function list(){ const sb=await getSupabase(); const {data}=await sb.from('bank_rules').select('*').order('product_type'); return data||[]; }
async function save(payload){ const sb=await getSupabase(); const {error}=await sb.from('bank_rules').upsert(payload,{onConflict:'id'}); if(error) throw error; }
async function removeRow(id){ const sb=await getSupabase(); const {error}=await sb.from('bank_rules').delete().eq('id',id); if(error) throw error; }
async function add(){ const sb=await getSupabase(); await sb.from('bank_rules').insert([{product_type:'MORTGAGE'}]); await refresh(); }

function rowHTML(r,bks){
  return `<tr>
  <td><select class="br-bank" data-id="${r.id}">${bks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('')}</select></td>
  <td class="col-product"><select class="br-product" data-id="${r.id}">${PRODUCTS.map(p=>`<option>${p}</option>`).join('')}</select></td>
  <td class="col-prop"><select class="br-prop" data-id="${r.id}">${PROPS.map(p=>`<option value="${p}">${p||'-'}</option>`).join('')}</select></td>
  <td class="col-home"><select class="br-home" data-id="${r.id}">${HOMES.map(h=>`<option value="${h}">${h||'-'}</option>`).join('')}</select></td>
  <td><input class="br-dti" data-id="${r.id}" type="number" step="0.01" value="${r.dti_cap??''}"/></td>
  <td class="col-ltv"><input class="br-ltv" data-id="${r.id}" type="number" step="0.01" value="${r.ltv_cap??''}"/></td>
  <td><input class="br-tenor" data-id="${r.id}" type="number" step="1" value="${r.max_tenor_years??''}"/></td>
  <td><input class="br-age" data-id="${r.id}" type="number" step="1" value="${r.max_age_at_maturity??''}"/></td>
  <td class="col-mininc"><input class="br-mininc" data-id="${r.id}" type="number" step="1000" value="${r.min_income??''}"/></td>
  <td class="col-mlc"><input class="br-mlc" data-id="${r.id}" type="number" step="100" value="${r.min_living_cost??''}"/></td>
  <td><button class="btn br-save" data-id="${r.id}">บันทึก</button> <button class="btn secondary br-del" data-id="${r.id}">ลบ</button></td>`;
}

function render(rows,bks){
  const body=qs('#rules-body'); body.innerHTML='';
  rows.forEach(r=>{
    const tr=document.createElement('tr'); tr.innerHTML=rowHTML(r,bks); body.appendChild(tr);
    tr.querySelector(`.br-bank[data-id="${r.id}"]`).value=r.bank_id||'';
    tr.querySelector(`.br-product[data-id="${r.id}"]`).value=r.product_type||'MORTGAGE';
    tr.querySelector(`.br-prop[data-id="${r.id}"]`).value=r.property_type||'';
    tr.querySelector(`.br-home[data-id="${r.id}"]`).value=r.home_number?.toString()||'';
  });
  qsa('.br-save').forEach(btn=>btn.addEventListener('click', async()=>{
    const id=btn.dataset.id; const pick=(c)=>document.querySelector(`.${c}[data-id="${id}"]`);
    const payload={
      id,
      bank_id: pick('br-bank').value||null,
      product_type: pick('br-product').value||'MORTGAGE',
      property_type: pick('br-prop').value||null,
      home_number: parseInt(pick('br-home').value||'')||null,
      dti_cap: parseFloat(pick('br-dti').value)||null,
      ltv_cap: parseFloat(pick('br-ltv').value)||null,
      max_tenor_years: parseInt(pick('br-tenor').value||'')||null,
      max_age_at_maturity: parseInt(pick('br-age').value||'')||null,
      min_income: parseFloat(pick('br-mininc').value)||null,
      min_living_cost: parseFloat(pick('br-mlc').value)||null
    };
    await save(payload);
  }));
  qsa('.br-del').forEach(btn=>btn.addEventListener('click', async()=>{ if(confirm('ลบกติกานี้?')){ await removeRow(btn.dataset.id); btn.closest('tr')?.remove(); } }));
}

export async function refresh(){ const [bks,rows]=await Promise.all([banks(),list()]); render(rows,bks); }
export async function initAdminRules(){
  document.getElementById('btn-rules-add')?.addEventListener('click', add);
  document.getElementById('btn-rules-refresh')?.addEventListener('click', refresh);
  await refresh();
}
