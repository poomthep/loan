import { getSupabase } from './supabaseClient.js';

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

async function loadBanksDropdown() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('banks').select('id, bank_name');
  if (error) throw error;

  const select = qs('#new-bank');
  select.innerHTML = '<option value="">เลือกธนาคาร</option>';
  data.forEach(bank => {
    const opt = document.createElement('option');
    opt.value = bank.bank_name;
    opt.textContent = bank.bank_name;
    select.appendChild(opt);
  });
}

async function loadPromotions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('promotions').select('*');
  if (error) throw error;
  return data || [];
}

function renderPromotions(rows) {
  const body = qs('#promo-body');
  body.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${row.bank_name}" data-id="${row.id}" class="edit-bank" /></td>
      <td><input value="${row.product}" data-id="${row.id}" class="edit-product" /></td>
      <td><input value="${row.title}" data-id="${row.id}" class="edit-title" /></td>
      <td><input value="${row.detail}" data-id="${row.id}" class="edit-detail" /></td>
      <td><input value="${row.discount_bps ?? ''}" data-id="${row.id}" class="edit-discount" /></td>
      <td><input value="${row.fixed_rate ?? ''}" data-id="${row.id}" class="edit-fixedrate" /></td>
      <td><input value="${row.fixed_months ?? ''}" data-id="${row.id}" class="edit-fixedmonths" /></td>
      <td><input value="${row.ltv_override ?? ''}" data-id="${row.id}" class="edit-ltv" /></td>
      <td>${row.start_date ?? '-'}</td>
      <td>${row.end_date ?? '-'}</td>
      <td><input type="checkbox" ${row.active ? 'checked' : ''} data-id="${row.id}" class="edit-active" /></td>
      <td>
        <button class="btn save-btn" data-id="${row.id}">💾</button>
        <button class="btn delete-btn" data-id="${row.id}">🗑️</button>
      </td>
    `;
    body.appendChild(tr);
  });

  qsa('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const supabase = await getSupabase();
      const updated = {
        bank_name: qs(`.edit-bank[data-id="${id}"]`).value,
        product: qs(`.edit-product[data-id="${id}"]`).value,
        title: qs(`.edit-title[data-id="${id}"]`).value,
        detail: qs(`.edit-detail[data-id="${id}"]`).value,
        discount_bps: parseFloat(qs(`.edit-discount[data-id="${id}"]`).value),
        fixed_rate: parseFloat(qs(`.edit-fixedrate[data-id="${id}"]`).value),
        fixed_months: parseInt(qs(`.edit-fixedmonths[data-id="${id}"]`).value),
        ltv_override: parseFloat(qs(`.edit-ltv[data-id="${id}"]`).value),
        active: qs(`.edit-active[data-id="${id}"]`).checked,
      };
      const { error } = await supabase.from('promotions').update(updated).eq('id', id);
      if (error) alert('บันทึกไม่สำเร็จ: ' + error.message);
      else await refreshPromotions();
    });
  });

  qsa('.delete-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      if (!confirm('คุณแน่ใจว่าต้องการลบโปรโมชันนี้?')) return;
      const supabase = await getSupabase();
      const { error } = await supabase.from('promotions').delete().eq('id', id);
      if (error) alert('ลบไม่สำเร็จ: ' + error.message);
      else await refreshPromotions();
    });
  });
}

async function addPromotion() {
  const supabase = await getSupabase();
  const newPromo = {
    bank_name: qs('#new-bank').value,
    title: qs('#new-title').value,
    detail: qs('#new-detail').value,
    product: qs('#new-product').value,
    active: qs('#new-active').checked,
    start_date: new Date().toISOString().split('T')[0],
  };
  const { error } = await supabase.from('promotions').insert([newPromo]);
  if (error) {
    alert('เพิ่มโปรโมชันไม่สำเร็จ: ' + error.message);
    return;
  }
  await refreshPromotions();
}

async function refreshPromotions() {
  const rows = await loadPromotions();
  renderPromotions(rows);
}

export async function initAdminPromotionsAdvanced() {
  qs('#btn-promo-refresh')?.addEventListener('click', refreshPromotions);
  qs('#btn-promo-add')?.addEventListener('click', addPromotion);
  await loadBanksDropdown();
  await refreshPromotions();
}