import { getSupabase } from './supabaseClient.js';
const qs=(s)=>document.querySelector(s); const qsa=(s)=>Array.from(document.querySelectorAll(s));
const PRODUCTS=['MORTGAGE','REFINANCE','PERSONAL','SME'];

async function banks(){
  const sb=await getSupabase();
  const {data}=await sb.from('banks').select('id, bank_name').order('bank_name',{ascending:true});
  return (data||[]).map(x=>({id:x.id,name:x.bank_name}));
}
async function list(){
  const sb=await getSupabase();
  const {data,error}=await sb.from('promotions').select(`
    id, bank_id, product_type, title, detail, active,
    rate_discount_bps, fixed_rate, fixed_months, max_ltv_override,
    y1_rate, y1_months, y2_rate, y2_months, y3_rate, y3_months, later_mrr_minus_bps,
    start_date, end_date
  `).order('title',{ascending:true}).limit(500);
  if(error) throw error; return data||[];
}
async function save(payload){ const sb=await getSupabase(); const {error}=await sb.from('promotions').upsert(payload,{onConflict:'id'}); if(error) throw error; }
async function removeRow(id){ const sb=await getSupabase(); const {error}=await sb.from('promotions').delete().eq('id',id); if(error) throw error; }

function rowHTML(r,bankOpts){
  return `<tr>
    <td class="col-bank"><select class="p-bank" data-id="${r.id}">${bankOpts}</select></td>
    <td class="col-product"><select class="p-product" data-id="${r.id}">${PRODUCTS.map(p=>`<option>${p}</option>`).join('')}</select></td>
    <td class="col-title"><input class="p-title" data-id="${r.id}" value="${r.title||''}"/></td>
    <td class="col-detail"><textarea class="p-detail" data-id="${r.id}">${r.detail||''}</textarea></td>
    <td class="col-discount"><input class="p-discount" data-id="${r.id}" type="number" step="1" value="${r.rate_discount_bps??''}"/></td>
    <td class="col-fixedRate"><input class="p-fixedrate" data-id="${r.id}" type="number" step="0.01" value="${r.fixed_rate??''}"/></td>
    <td class="col-fixedMonths"><input class="p-fixedmonths" data-id="${r.id}" type="number" step="1" value="${r.fixed_months??''}"/></td>
    <td class="col-y1"><input class="p-y1" data-id="${r.id}" type="number" step="0.01" value="${r.y1_rate??''}"/></td>
    <td class="col-y1m"><input class="p-y1m" data-id="${r.id}" type="number" step="1" value="${r.y1_months??''}"/></td>
    <td class="col-y2"><input class="p-y2" data-id="${r.id}" type="number" step="0.01" value="${r.y2_rate??''}"/></td>
    <td class="col-y2m"><input class="p-y2m" data-id="${r.id}" type="number" step="1" value="${r.y2_months??''}"/></td>
    <td class="col-y3"><input class="p-y3" data-id="${r.id}" type="number" step="0.01" value="${r.y3_rate??''}"/></td>
    <td class="col-y3m"><input class="p-y3m" data-id="${r.id}" type="number" step="1" value="${r.y3_months??''}"/></td>
    <td class="col-later"><input class="p-later" data-id="${r.id}" type="number" step="1" value="${r.later_mrr_minus_bps??''}"/></td>
    <td class="col-ltv"><input class="p-ltv" data-id="${r.id}" type="number" step="0.01" value="${r.max_ltv_override??''}"/></td>
    <td class="col-start"><input class="p-start" data-id="${r.id}" type="date" value="${r.start_date??''}"/></td>
    <td class="col-end"><input class="p-end" data-id="${r.id}" type="date" value="${r.end_date??''}"/></td>
    <td class="col-active" style="text-align:center"><input type="checkbox" class="p-active" data-id="${r.id}" ${r.active?'checked':''}></td>
    <td class="col-actions"><button class="p-save btn" data-id="${r.id}">บันทึก</button> <button class="p-del btn secondary" data-id="${r.id}">ลบ</button></td>
  </tr>`;
}

function render(rows,bks){
  const body = qs('#promo-body'); body.innerHTML='';
  const bankOpts=bks.map(b=>`<option value="${b.id}">${b.name}</option>`).join('');
  rows.forEach(r=>{
    const tr=document.createElement('tr'); tr.innerHTML=rowHTML(r,bankOpts); body.appendChild(tr);
    tr.querySelector(`.p-bank[data-id="${r.id}"]`).value=r.bank_id||'';
    tr.querySelector(`.p-product[data-id="${r.id}"]`).value=r.product_type||'MORTGAGE';
  });
  qsa('.p-save').forEach(btn=>btn.onclick=async()=>{
    const id=btn.dataset.id;
    const pick=(cls)=>qs(`.${cls}[data-id="${id}"]`);
    const payload={
      id,
      bank_id: pick('p-bank').value||null, product_type: pick('p-product').value||'MORTGAGE',
      title: pick('p-title').value.trim(), detail: pick('p-detail').value.trim(),
      rate_discount_bps: parseInt(pick('p-discount').value||'')||null,
      fixed_rate: parseFloat(pick('p-fixedrate').value||'')||null,
      fixed_months: parseInt(pick('p-fixedmonths').value||'')||null,
      y1_rate: parseFloat(pick('p-y1').value||'')||null, y1_months: parseInt(pick('p-y1m').value||'')||null,
      y2_rate: parseFloat(pick('p-y2').value||'')||null, y2_months: parseInt(pick('p-y2m').value||'')||null,
      y3_rate: parseFloat(pick('p-y3').value||'')||null, y3_months: parseInt(pick('p-y3m').value||'')||null,
      later_mrr_minus_bps: parseInt(pick('p-later').value||'')||null,
      max_ltv_override: parseFloat(pick('p-ltv').value||'')||null,
      start_date: pick('p-start').value||null, end_date: pick('p-end').value||null,
      active: qs(`.p-active[data-id="${id}"]`).checked
    };
    if(!payload.title) return alert('กรุณากรอกชื่อโปร');
    await save(payload);
  });
  qsa('.p-del').forEach(btn=>btn.onclick=async()=>{ if(confirm('ลบโปรนี้?')){ await removeRow(btn.dataset.id); btn.closest('tr')?.remove(); } });
}


async function loadBanksToNewSelect(){
  const sb = await getSupabase();
  const { data } = await sb.from('banks').select('id, bank_name').order('bank_name',{ascending:true});
  const sel = qs('#new-bank');
  sel.innerHTML = (data||[]).map(b => `<option value="${b.id}">${b.bank_name}</option>`).join('');
}

async function addNew(){
  const sb = await getSupabase();
  const title   = (qs('#new-title')?.value || '').trim();
  if (!title){ alert('กรุณากรอกชื่อโปร'); return; }
  const detail  = (qs('#new-detail')?.value || '').trim();
  const product = qs('#new-product')?.value || 'MORTGAGE';
  const bankId  = qs('#new-bank')?.value || null; // ต้องไม่เป็น null ถ้า bank_id NOT NULL
  const active  = qs('#new-active')?.checked ?? true;

  if (!bankId){ alert('กรุณาเลือกธนาคาร'); return; }

  const { error } = await sb.from('promotions')
    .insert([{ bank_id: bankId, title, detail, product_type: product, active }], { returning: 'minimal' });

  if (error){ console.error(error); alert(error.message || 'บันทึกไม่สำเร็จ'); return; }
  qs('#new-title').value=''; qs('#new-detail').value='';
  await refresh();
}

export async function initAdminPromotionsAdvanced(){
  qs('#btn-promo-add')?.addEventListener('click', addNew);
  qs('#btn-promo-refresh')?.addEventListener('click', refresh);
  await loadBanksToNewSelect();
  await refresh();
}