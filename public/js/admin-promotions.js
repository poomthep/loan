import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';

function qs(sel){ return document.querySelector(sel); }
function qsa(sel){ return Array.from(document.querySelectorAll(sel)); }

async function ensureAdmin() {
  const { role } = await getProfileRole();
  if (role !== 'admin') {
    alert('ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น');
    location.href = '/index.html';
    throw new Error('not admin');
  }
}

async function loadPromotions() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('promotions').select('id, title, detail, active').order('title', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function upsertPromotion(payload) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('promotions').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}

async function deletePromotion(id) {
  const supabase = await getSupabase();
  const { error } = await supabase.from('promotions').delete().eq('id', id);
  if (error) throw error;
}

function renderPromotions(rows) {
  const body = qs('#promo-body');
  body.innerHTML = '';

  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-3 py-2 border-b"><input class="p-title w-64 border rounded px-2 py-1" data-id="${r.id}" value="${r.title || ''}" /></td>
      <td class="px-3 py-2 border-b"><textarea class="p-detail w-80 border rounded px-2 py-1" data-id="${r.id}">${r.detail || ''}</textarea></td>
      <td class="px-3 py-2 border-b" style="text-align:center"><input type="checkbox" class="p-active" data-id="${r.id}" ${r.active ? 'checked':''}></td>
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
      const title = qs(`.p-title[data-id="${id}"]`).value.trim();
      const detail = qs(`.p-detail[data-id="${id}"]`).value.trim();
      const active = qs(`.p-active[data-id="${id}"]`).checked;
      btn.disabled = true;
      try {
        await upsertPromotion({ id, title, detail, active });
        btn.textContent = 'บันทึกแล้ว';
        setTimeout(() => { btn.textContent = 'บันทึก'; btn.disabled = false; }, 1000);
      } catch (e) {
        alert(e.message || 'บันทึกไม่สำเร็จ');
        btn.disabled = false;
      }
    });
  });

  qsa('.p-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!confirm('ยืนยันลบโปรนี้?')) return;
      const id = btn.dataset.id;
      btn.disabled = true;
      try {
        await deletePromotion(id);
        btn.closest('tr')?.remove();
      } catch (e) {
        alert(e.message || 'ลบไม่สำเร็จ');
        btn.disabled = false;
      }
    });
  });
}

async function addNew() {
  const title = qs('#new-title').value.trim();
  const detail = qs('#new-detail').value.trim();
  const active = qs('#new-active').checked;
  if (!title) return alert('กรอกชื่อโปรก่อน');

  try {
    await upsertPromotion({ title, detail, active });
    await refresh();
    qs('#new-title').value = '';
    qs('#new-detail').value = '';
    qs('#new-active').checked = true;
  } catch (e) {
    alert(e.message || 'เพิ่มโปรไม่สำเร็จ');
  }
}

async function refresh() {
  const rows = await loadPromotions();
  renderPromotions(rows);
}

export async function initAdminPromotions() {
  await ensureAdmin();
  qs('#btn-promo-add')?.addEventListener('click', addNew);
  qs('#btn-promo-refresh')?.addEventListener('click', refresh);
  await refresh();
}