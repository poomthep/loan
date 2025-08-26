
// Bank Rules CRUD — exports initAdminRules
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
async function loadRules() {
  const sb = await getSupabase();
  const { data, error } = await sb.from('bank_rules').select('*').limit(500);
  if (error) throw error;
  return data || [];
}
async function upsertRule(payload) {
  const sb = await getSupabase();
  const { error } = await sb.from('bank_rules').upsert(payload, { onConflict: 'id' });
  if (error) throw error;
}
async function deleteRule(id) {
  const sb = await getSupabase();
  const { error } = await sb.from('bank_rules').delete().eq('id', id);
  if (error) throw error;
}

function render(rules, banks){
  const body = qs('#rules-body');
  if (!body) return;
  body.innerHTML = '';
  const bankOptions = banks.map(b => `<option value="${b.id}">${b.name}</option>`).join('');
  rules.forEach(r => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><select class="br-bank" data-id="${r.id}">${bankOptions}</select></td>
      <td><select class="br-product" data-id="${r.id}">${PRODUCTS.map(p=>`<option value="${p}">${p}</option>`).join('')}</select></td>
      <td><input class="br-dti" data-id="${r.id}" type="number" step="0.01" placeholder="0.45" value="${r.dti_cap ?? ''}"></td>
      <td><input class="br-ltv" data-id="${r.id}" type="number" step="0.01" placeholder="0.95" value="${r.ltv_cap ?? ''}"></td>
      <td><input class="br-tenor" data-id="${r.id}" type="number" step="1" placeholder="30" value="${r.max_tenor_years ?? ''}"></td>
      <td><input class="br-age" data-id="${r.id}" type="number" step="1" placeholder="60" value="${r.max_age_at_maturity ?? ''}"></td>
      <td><input class="br-mininc" data-id="${r.id}" type="number" step="1000" placeholder="15000" value="${r.min_income ?? ''}"></td>
      <td><button class="btn br-save" data-id="${r.id}">บันทึก</button> <button class="btn outline br-del" data-id="${r.id}">ลบ</button></td>
    `;
    body.appendChild(tr);
    tr.querySelector(`.br-bank[data-id="${r.id}"]`).value = r.bank_id || '';
    tr.querySelector(`.br-product[data-id="${r.id}"]`).value = r.product_type || 'MORTGAGE';
  });

  qsa('.br-save').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = btn.dataset.id;
      const payload = {
        id,
        bank_id: qs(`.br-bank[data-id="${id}"]`).value || null,
        product_type: qs(`.br-product[data-id="${id}"]`).value || 'MORTGAGE',
        dti_cap: parseFloat(qs(`.br-dti[data-id="${id}"]`).value) || null,
        ltv_cap: parseFloat(qs(`.br-ltv[data-id="${id}"]`).value) || null,
        max_tenor_years: parseInt(qs(`.br-tenor[data-id="${id}"]`).value) || null,
        max_age_at_maturity: parseInt(qs(`.br-age[data-id="${id}"]`).value) || null,
        min_income: parseFloat(qs(`.br-mininc[data-id="${id}"]`).value) || null
      };
      btn.disabled=true;
      try{ await upsertRule(payload); }catch(e){ alert(e.message || 'บันทึกไม่สำเร็จ'); }
      btn.disabled=false;
    });
  });
  qsa('.br-del').forEach(btn => {
    btn.addEventListener('click', async () => {
      if(!confirm('ยืนยันลบกติกา?')) return;
      const id = btn.dataset.id;
      btn.disabled=true;
      try{ await deleteRule(id); btn.closest('tr')?.remove(); }catch(e){ alert(e.message || 'ลบไม่สำเร็จ'); }
      btn.disabled=false;
    });
  });
}

async function addNew(){
  const sb = await getSupabase();
  const { error } = await sb.from('bank_rules').insert([{ product_type: 'MORTGAGE' }]);
  if (error) return alert(error.message || 'เพิ่มไม่สำเร็จ');
  await refresh();
}
async function refresh(){
  const [banks, rules] = await Promise.all([loadBanks(), loadRules()]);
  render(rules, banks);
}

export async function initAdminRules(){
  await ensureAdmin();
  document.querySelector('#btn-rules-add')?.addEventListener('click', addNew);
  document.querySelector('#btn-rules-refresh')?.addEventListener('click', refresh);
  await refresh();
}
