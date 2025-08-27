import { getSupabase } from './supabaseClient.js';
import { getProfileRole } from './auth.js';

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }
function fmt(x) { return x ?? ''; }

async function ensureAdminOrBounce() {
  const { role } = await getProfileRole();
  if (role !== 'admin') {
    alert('ต้องเป็นผู้ดูแลระบบ (admin) เท่านั้น');
    location.href = '/index.html';
    throw new Error('not admin');
  }
}

async function loadBanks() {
  const supabase = await getSupabase();
  const { data, error } = await supabase
    .from('banks')
    .select('id, bank_name, mrr')
    .order('bank_name', { ascending: true });
  if (error) throw error;
  return data || [];
}

async function saveBank(id, mrr) {
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('banks')
    .update({ mrr })
    .eq('id', id);
  if (error) throw error;
}

function renderBanks(rows) {
  const body = qs('#banks-body');
  body.innerHTML = '';
  rows.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="px-3 py-2 border-b">${fmt(r.bank_name)}</td>
      <td class="px-3 py-2 border-b">
        <input type="number" step="0.01" value="${fmt(r.mrr) || ''}" data-id="${r.id}"
               class="mrr-input w-28 border rounded px-2 py-1" />
      </td>
      <td class="px-3 py-2 border-b">
        <button class="save-btn border rounded px-3 py-1" data-id="${r.id}">บันทึก</button>
      </td>
    `;
    body.appendChild(tr);
  });

  qsa('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = qs(`input.mrr-input[data-id="${id}"]`);
      const mrr = parseFloat(input.value);
      btn.disabled = true;
      try {
        await saveBank(id, mrr);
        btn.textContent = 'บันทึกแล้ว';
        setTimeout(() => { btn.textContent = 'บันทึก'; btn.disabled = false; }, 1200);
      } catch (e) {
        alert(e.message || 'บันทึกไม่สำเร็จ');
        btn.disabled = false;
      }
    });
  });
}

async function refreshMRR() {
  qs('#btn-refresh-mrr').disabled = true;
  try {
    const rows = await loadBanks();
    renderBanks(rows);
  } catch (e) {
    alert(e.message || 'รีเฟรชไม่สำเร็จ');
  } finally {
    qs('#btn-refresh-mrr').disabled = false;
  }
}

export async function initAdminPage() {
  await ensureAdminOrBounce();
  await refreshMRR();
  qs('#btn-refresh-mrr')?.addEventListener('click', refreshMRR);
}