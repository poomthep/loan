function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `fixed bottom-4 right-4 px-4 py-2 rounded shadow text-white z-50 
                     ${type === 'error' ? 'bg-red-500' : 'bg-green-500'}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), 2500);
}

async function saveBank(id, mrr) {
  if (isNaN(mrr) || mrr < 0) {
    showToast('กรุณากรอกตัวเลข MRR ที่ถูกต้อง', 'error');
    return;
  }
  const supabase = await getSupabase();
  const { error } = await supabase
    .from('banks')
    .update({ mrr })
    .eq('id', id);
  if (error) {
    console.error(error);
    showToast(error.message || 'บันทึกไม่สำเร็จ', 'error');
    return;
  }
  showToast('บันทึกเรียบร้อย');
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
        <button class="save-btn border rounded px-3 py-1 bg-blue-500 text-white hover:bg-blue-600" data-id="${r.id}">
          บันทึก
        </button>
      </td>
    `;
    body.appendChild(tr);
  });

  // ผูก event ให้ปุ่มบันทึก
  qsa('.save-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const input = qs(`input.mrr-input[data-id="${id}"]`);
      const mrr = parseFloat(input.value);
      btn.disabled = true;
      await saveBank(id, mrr);
      btn.disabled = false;
    });
  });

  // รองรับกด Enter ในช่องกรอก
  qsa('.mrr-input').forEach(input => {
    input.addEventListener('keypress', async e => {
      if (e.key === 'Enter') {
        const id = input.dataset.id;
        const mrr = parseFloat(input.value);
        await saveBank(id, mrr);
      }
    });
  });
}