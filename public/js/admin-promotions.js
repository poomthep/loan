
// Admin Promotions (advanced) — exports BOTH initAdminPromotionsAdvanced and initAdminPromotions (alias)
import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';

const PRODUCTS = ['MORTGAGE','PERSONAL','SME'];
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

async function loadBanks() {
  const sb = await getSupabase();
  const tries = ['id, bank_name', 'id, name', 'id, bank'];
  for (const sel of tries) {
    const { data, error } = await sb.from('banks').select(sel).order('bank_name', { ascending: true });
    if (!error) return (data||[]).map(r => ({ id: r.id, name: r.bank_name ?? r.name ?? r.bank }));
  }
  return [];
}

async function loadPromotions() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('promotions')
    .select('id, bank_id, product_type, title, detail, active, rate_discount_bps, fixed_rate, fixed_months, max_ltv_override, start_date, end_date')
    .order('title', { ascending: true }).limit(200);
  if (error) throw error;
  return data || [];
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

function renderPromotions(rows, banks) {
  const body = qs('#promo-body');
  if (!body) return;
  body.innerHTML = '';
  const bankOptions = banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="p-bank" data-id="${r.id}">${bankOptions}</select></td>
      <td><select class="p-prod" data-id="${r.id}">${PRODUCTS.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></td>
      <td><input class="p-title" data-id="${r.id}" value="${r.title||''}" placeholder="ชื่อโปร"></td>
      <td><textarea class="p-detail" data-id="${r.id}" placeholder="รายละเอียด">${r.detail||''}</textarea></td>
      <td><input class="p-discount" data-id="${r.id}" type="number" step="1" placeholder="bps" value="${r.rate_discount_bps ?? ''}"></td>
      <td><input class="p-fixedrate" data-id="${r.id}" type="number" step="0.01" placeholder="ดอกคงที่ (%)" value="${r.fixed_rate ?? ''}"></td>
      <td><input class="p-fixedmonths" data-id="${r.id}" type="number" step="1" placeholder="เดือนคงที่" value="${r.fixed_months ?? ''}"></td>
      <td><input class="p-ltvo" data-id="${r.id}" type="number" step="0.01" placeholder="LTV override (0-1)" value="${r.max_ltv_override ?? ''}"></td>
      <td><input class="p-start" data-id="${r.id}" type="date" value="${r.start_date ?? ''}"></td>
      <td><input class="p-end" data-id="${r.id}" type="date" value="${r.end_date ?? ''}"></td>
      <td style="text-align:center"><input type="checkbox" class="p-active" data-id="${r.id}" ${r.active ? 'checked':''}></td>
      <td>
        <button class="btn p-save" data-id="${r.id}">บันทึก</button>
        <button class="btn outline p-del" data-id="${r.id}">ลบ</button>
      </td>
    `;
    body.appendChild(tr);
    tr.querySelector(`.p-bank[data-id="${r.id}"]`).value = r.bank_id || '';
    tr.querySelector(`.p-prod[data-id="${r.id}"]`).value = r.product_type || 'MORTGAGE';
  });

  qsa('.p-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const payload = {
        id,
        bank_id: qs(`.p-bank[data-id="${id}"]`).value || null,
        product_type: qs(`.p-prod[data-id="${id}"]`).value || 'MORTGAGE',
        title: qs(`.p-title[data-id="${id}"]`).value.trim(),
        detail: qs(`.p-detail[data-id="${id}"]`).value.trim(),
        rate_discount_bps: parseInt(qs(`.p-discount[data-id="${id}"]`).value || '0', 10) || null,
        fixed_rate: parseFloat(qs(`.p-fixedrate[data-id="${id}"]`).value || '') || null,
        fixed_months: parseInt(qs(`.p-fixedmonths[data-id="${id}"]`).value || '0', 10) || null,
        max_ltv_override: parseFloat(qs(`.p-ltvo[data-id="${id}"]`).value || '') || null,
        start_date: qs(`.p-start[data-id="${id}"]`).value || null,
        end_date: qs(`.p-end[data-id="${id}"]`).value || null,
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

async function addNewPromo(){
  const sb = await getSupabase();
  const { error } = await sb.from('promotions').insert([ { active: true, product_type: 'MORTGAGE' } ]);
  if (error) return alert(error.message || 'เพิ่มโปรไม่สำเร็จ');
  await refresh();
}

async function refresh(){
  const [banks, promos] = await Promise.all([loadBanks(), loadPromotions()]);
  renderPromotions(promos, banks);
}

export async function initAdminPromotionsAdvanced(){
  await ensureAdmin();
  document.querySelector('#btn-promo-add')?.addEventListener('click', addNewPromo);
  document.querySelector('#btn-promo-refresh')?.addEventListener('click', refresh);
  await refresh();
}

// Backward compatible export (alias)
export async function initAdminPromotions(){
  return initAdminPromotionsAdvanced();
}
