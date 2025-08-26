
import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';
const qs = (s)=>document.querySelector(s);
const qsa = (s)=>Array.from(document.querySelectorAll(s));
const PRODUCTS=['MORTGAGE','PERSONAL','SME','REFINANCE'];
const PROPS=['','HOUSE','TOWNHOME','CONDO','LAND+HOUSE'];
const HOMES=['','1','2','3'];

async function ensureAdmin(){ const { role } = await getProfileRole(); if(role!=='admin'){ alert('ต้องเป็นผู้ดูแลระบบเท่านั้น'); location.href='/index.html'; throw new Error('not admin'); } }
async function listBanks(){ const sb=await getSupabase(); const {data}=await sb.from('banks').select('id, bank_name').order('bank_name',{ascending:true}); return (data||[]).map(r=>({id:r.id,name:r.bank_name})); }
async function fetchRules(){ const sb=await getSupabase(); const {data}=await sb.from('bank_rules').select('*').order('product_type',{ascending:true}).limit(500); return data||[]; }
async function upsertRule(payload){ const sb=await getSupabase(); const {error}=await sb.from('bank_rules').upsert(payload,{onConflict:'id'}); if(error) throw error; }
async function deleteRule(id){ const sb=await getSupabase(); const {error}=await sb.from('bank_rules').delete().eq('id',id); if(error) throw error; }

function renderRules(rows,banks){
  const body=qs('#rules-body'); body.innerHTML=''; const bankOpts=banks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
  rows.forEach(r=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`
      <td><select class="br-bank" data-id="${r.id}">${bankOpts}</select></td>
      <td class="col-product"><select class="br-product" data-id="${r.id}">${PRODUCTS.map(p=>`<option>${p}</option>`).join('')}</select></td>
      <td class="col-prop"><select class="br-prop" data-id="${r.id}">${PROPS.map(p=>`<option value="${p}">${p||'-'}</option>`).join('')}</select></td>
      <td class="col-home"><select class="br-home" data-id="${r.id}">${HOMES.map(h=>`<option value="${h}">${h||'-'}</option>`).join('')}</select></td>
      <td><input class="br-dti" data-id="${r.id}" type="number" step="0.01" placeholder="0.45" value="${r.dti_cap??''}"/></td>
      <td class="col-ltv"><input class="br-ltv" data-id="${r.id}" type="number" step="0.01" placeholder="0.95" value="${r.ltv_cap??''}"/></td>
      <td><input class="br-tenor" data-id="${r.id}" type="number" step="1" placeholder="30" value="${r.max_tenor_years??''}"/></td>
      <td><input class="br-age" data-id="${r.id}" type="number" step="1" placeholder="60" value="${r.max_age_at_maturity??''}"/></td>
      <td class="col-mininc"><input class="br-mininc" data-id="${r.id}" type="number" step="1000" placeholder="15000" value="${r.min_income??''}"/></td>
      <td><button class="btn br-save" data-id="${r.id}">บันทึก</button> <button class="btn outline br-del" data-id="${r.id}">ลบ</button></td>`;
    body.appendChild(tr);
    tr.querySelector(`.br-bank[data-id="${r.id}"]`).value=r.bank_id||'';
    tr.querySelector(`.br-product[data-id="${r.id}"]`).value=r.product_type||'MORTGAGE';
    tr.querySelector(`.br-prop[data-id="${r.id}"]`).value=r.property_type||'';
    tr.querySelector(`.br-home[data-id="${r.id}"]`).value=r.home_number?.toString()||'';
  });
  qsa('.br-save').forEach(btn=>btn.addEventListener('click', async ()=>{
    const id=btn.dataset.id;
    const payload={
      id,
      bank_id: qs(`.br-bank[data-id="${id}"]`).value||null,
      product_type: qs(`.br-product[data-id="${id}"]`).value||'MORTGAGE',
      property_type: qs(`.br-prop[data-id="${id}"]`).value||null,
      home_number: parseInt(qs(`.br-home[data-id="${id}"]`).value||'')||null,
      dti_cap: parseFloat(qs(`.br-dti[data-id="${id}"]`).value)||null,
      ltv_cap: parseFloat(qs(`.br-ltv[data-id="${id}"]`).value)||null,
      max_tenor_years: parseInt(qs(`.br-tenor[data-id="${id}"]`).value)||null,
      max_age_at_maturity: parseInt(qs(`.br-age[data-id="${id}"]`).value)||null,
      min_income: parseFloat(qs(`.br-mininc[data-id="${id}"]`).value)||null
    };
    btn.disabled=true; try{ await upsertRule(payload); }catch(e){ alert(e.message||'บันทึกไม่สำเร็จ'); } btn.disabled=false;
  }));
  qsa('.br-del').forEach(btn=>btn.addEventListener('click', async ()=>{
    if(!confirm('ยืนยันลบกติกา?')) return;
    btn.disabled=true; try{ await deleteRule(btn.dataset.id); btn.closest('tr')?.remove(); }catch(e){ alert(e.message||'ลบไม่สำเร็จ'); } btn.disabled=false;
  }));
}

async function addNewRule(){ const sb=await getSupabase(); const {error}=await sb.from('bank_rules').insert([{product_type:'MORTGAGE'}]); if(error) alert(error.message||'เพิ่มไม่สำเร็จ'); await refresh(); }
export async function refresh(){ const [banks,rules]=await Promise.all([listBanks(),fetchRules()]); renderRules(rules,banks); }
export async function initAdminRules(){ await ensureAdmin(); qs('#btn-rules-add')?.addEventListener('click',addNewRule); qs('#btn-rules-refresh')?.addEventListener('click',refresh); await refresh(); }
