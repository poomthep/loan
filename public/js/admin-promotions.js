// Admin Promotions (strict add + filter blanks)
import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';

const qs = (s)=>document.querySelector(s);
const qsa = (s)=>Array.from(document.querySelectorAll(s));

async function ensureAdmin() {
  const { role } = await getProfileRole();
  if (role !== 'admin') {
    alert('ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น');
    location.href = '/index.html';
    throw new Error('not admin');
  }
}

async function getDefaultBankId(){
  const sb = await getSupabase();
  const { data } = await sb.from('banks').select('id').order('bank_name',{ascending:true}).limit(1);
  return data && data[0] ? data[0].id : null;
}

async function fetchPromotions(){
  const sb = await getSupabase();
  const { data, error } = await sb.from('promotions')
    .select('id, title, detail, active, bank_id, product_type')
    .order('title', { ascending: true }).limit(500);
  if (error) throw error;
  return (data||[]);
}

function rowToObj(r){
  return {
    id: r.id,
    title: r.title ?? '',
    detail: r.detail ?? '',
    active: !!r.active,
    bank_id: r.bank_id ?? null,
    product_type: r.product_type ?? 'MORTGAGE'
  };
}

function renderPromotions(rows){
  const body = qs('#promo-body');
  if (!body) return;
  // Filter out blanks (both title and detail empty)
  const filtered = rows.map(rowToObj).filter(r => (r.title.trim() !== '' || r.detail.trim() !== ''));
  body.innerHTML = '';
  filtered.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input class="p-title" data-id="${r.id}" value="${r.title}" placeholder="ชื่อโปร"></td>
      <td><textarea class="p-detail" data-id="${r.id}" placeholder="รายละเอียด">${r.detail}</textarea></td>
      <td style="text-align:center"><input type="checkbox" class="p-active" data-id="${r.id}" ${r.active?'checked':''}></td>
      <td>
        <button class="btn p-save" data-id="${r.id}">บันทึก</button>
        <button class="btn outline p-del" data-id="${r.id}">ลบ</button>
      </td>
    `;
    body.appendChild(tr);
  });

  qsa('.p-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const payload = {
        id,
        title: qs(`.p-title[data-id="${id}"]`).value.trim(),
        detail: qs(`.p-detail[data-id="${id}"]`).value.trim(),
        active: qs(`.p-active[data-id="${id}"]`).checked,
      };
      // optional guard: prevent saving totally blank
      if (!payload.title && !payload.detail) { alert('กรอกชื่อโปรหรือรายละเอียดอย่างน้อย 1 อย่าง'); return; }
      btn.disabled = true;
      try{
        const sb = await getSupabase();
        const { error } = await sb.from('promotions').upsert(payload, { onConflict: 'id' });
        if (error) throw error;
        btn.textContent='บันทึกแล้ว'; setTimeout(()=>btn.textContent='บันทึก', 900);
      }catch(e){ alert(e.message || 'บันทึกไม่สำเร็จ'); }
      btn.disabled=false;
    });
  });

  qsa('.p-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('ยืนยันลบโปรนี้?')) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      try{
        const sb = await getSupabase();
        const { error } = await sb.from('promotions').delete().eq('id', id);
        if (error) throw error;
        btn.closest('tr')?.remove();
      }catch(e){ alert(e.message || 'ลบไม่สำเร็จ'); }
      btn.disabled = false;
    });
  });
}

async function addNew(){
  const title = (qs('#new-title')?.value || '').trim();
  const detail = (qs('#new-detail')?.value || '').trim();
  const active = qs('#new-active')?.checked ?? true;
  if (!title) { alert('กรุณากรอก "ชื่อโปร"'); return; }
  const payload = { title, detail, active, product_type: 'MORTGAGE' };
  const bank_id = await getDefaultBankId();
  if (bank_id) payload.bank_id = bank_id;

  const sb = await getSupabase();
  const { error } = await sb.from('promotions').insert([payload]);
  if (error) { alert(error.message || 'เพิ่มโปรไม่สำเร็จ'); return; }

  // clear inputs
  if (qs('#new-title')) qs('#new-title').value = '';
  if (qs('#new-detail')) qs('#new-detail').value = '';
  if (qs('#new-active')) qs('#new-active').checked = true;
  await refresh();
}

export async function refresh(){
  try{
    const rows = await fetchPromotions();
    renderPromotions(rows);
  }catch(e){
    console.error('load promotions failed', e);
  }
}

export async function initAdminPromotions(){
  await ensureAdmin();
  qs('#btn-promo-add')?.addEventListener('click', addNew);
  qs('#btn-promo-refresh')?.addEventListener('click', refresh);
  await refresh();
}
export async function initAdminPromotionsAdvanced(){ return initAdminPromotions(); }