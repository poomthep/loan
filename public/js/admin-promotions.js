// Admin Promotions (full, compatible with simple admin.html)
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

async function getDefaultBankId() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('banks').select('id').order('bank_name', { ascending: true }).limit(1);
  if (error) return null;
  return data && data[0] ? data[0].id : null;
}

async function loadPromotions() {
  const sb = await getSupabase();
  const selects = [
    'id, title, detail, active, bank_id, product_type',
    'id, title, detail, active, bank_id',
    'id, name, detail, active, bank_id',
    'id, name, description, active, bank_id'
  ];
  for (const sel of selects) {
    const { data, error } = await sb.from('promotions').select(sel).order('title', { ascending: true }).limit(200);
    if (!error) {
      return (data||[]).map(r => ({
        id: r.id,
        title: r.title ?? r.name ?? '',
        detail: r.detail ?? r.description ?? '',
        active: r.active ?? true,
        bank_id: r.bank_id ?? null,
        product_type: r.product_type ?? 'MORTGAGE',
      }));
    }
  }
  return [];
}

async function upsertPromotion(payload) {
  const sb = await getSupabase();
  const { error } = await sb.from('promotions').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function deletePromotion(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('promotions').delete().eq('id', id);
  if (error) throw error;
}

function renderPromotions(rows) {
  const body = qs('#promo-body');
  if (!body) return;
  body.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-3 py-2 border-b"><input class="p-title w-64 border rounded px-2 py-1" data-id="${r.id}" value="${r.title||''}" placeholder="ชื่อโปร"></td>
      <td class="px-3 py-2 border-b"><textarea class="p-detail w-96 border rounded px-2 py-1" data-id="${r.id}" placeholder="รายละเอียด">${r.detail||''}</textarea></td>
      <td class="px-3 py-2 border-b" style="text-align:center">
        <input type="checkbox" class="p-active" data-id="${r.id}" ${r.active ? 'checked':''}>
      </td>
      <td class="px-3 py-2 border-b">
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
        active: qs(`.p-active[data-id="${id}"]`).checked
      };
      btn.disabled = true;
      try { await upsertPromotion(payload); btn.textContent='บันทึกแล้ว'; setTimeout(()=>btn.textContent='บันทึก', 900); }
      catch(e){ alert(e.message || 'บันทึกไม่สำเร็จ'); }
      btn.disabled = false;
    });
  });

  qsa('.p-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('ยืนยันลบโปรนี้?')) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      try { await deletePromotion(id); btn.closest('tr')?.remove(); }
      catch(e){ alert(e.message || 'ลบไม่สำเร็จ'); }
      btn.disabled = false;
    });
  });
}

async function addNewPromo() {
  const title = qs('#new-title')?.value?.trim() || '';
  const detail = qs('#new-detail')?.value?.trim() || '';
  const active = qs('#new-active')?.checked ?? true;

  // bank_id to satisfy NOT NULL (if enforced)
  const bank_id = await getDefaultBankId();

  const payload = { title, detail, active, product_type: 'MORTGAGE' };
  if (bank_id) payload.bank_id = bank_id;

  try {
    await upsertPromotion(payload);
    // clear inputs
    if (qs('#new-title')) qs('#new-title').value = '';
    if (qs('#new-detail')) qs('#new-detail').value = '';
    if (qs('#new-active')) qs('#new-active').checked = true;
    await refresh();
  } catch (e) {
    alert(e.message || 'เพิ่มโปรไม่สำเร็จ');
  }
}

export async function refresh(){
  const rows = await loadPromotions();
  renderPromotions(rows);
}

export async function initAdminPromotions(){
  await ensureAdmin();
  qs('#btn-promo-add')?.addEventListener('click', addNewPromo);
  qs('#btn-promo-refresh')?.addEventListener('click', refresh);
  await refresh();
}

// alias for compatibility with newer admin pages
export async function initAdminPromotionsAdvanced(){
  return initAdminPromotions();
}