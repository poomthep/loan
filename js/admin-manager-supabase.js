// หน้าจัดการโปรโมชัน — CRUD อย่างง่าย
import { listPromotions, upsertPromotion, deletePromotion } from './data-manager.js';

const $ = (sel) => document.querySelector(sel);

async function renderList() {
  const tbody = $('#admin-promotions');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:10px">Loading...</td></tr>';
  try {
    const rows = await listPromotions();
    if (!rows.length) { tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:10px;color:#777">No data</td></tr>'; return; }
    tbody.innerHTML = '';
    for (const r of rows) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.id}</td>
        <td>${r.bank_id}</td>
        <td>${r.product_type}</td>
        <td>${r.title || ''}</td>
        <td>${r.yearly_rate ?? ''}</td>
        <td>
          <button data-edit="${r.id}">แก้ไข</button>
          <button data-del="${r.id}" style="color:#c00">ลบ</button>
        </td>
      `;
      tbody.appendChild(tr);
    }
    tbody.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.del, 10);
        if (!confirm('ลบโปรโมชัน #' + id + ' ?')) return;
        await deletePromotion(id); renderList();
      });
    });
    tbody.querySelectorAll('[data-edit]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = parseInt(btn.dataset.edit, 10);
        const title = prompt('ชื่อโปรโมชันใหม่?');
        if (title == null) return;
        await upsertPromotion({ id, title });
        renderList();
      });
    });
  } catch (e) {
    console.error(e);
    tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:10px;color:#c00">โหลดข้อมูลไม่สำเร็จ</td></tr>';
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', renderList);
} else {
  renderList();
}
