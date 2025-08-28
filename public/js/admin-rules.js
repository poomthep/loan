import { getSupabase } from './supabaseClient.js';

function qs(sel) { return document.querySelector(sel); }
function qsa(sel) { return Array.from(document.querySelectorAll(sel)); }

async function loadBanksDropdown() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('banks').select('id, bank_name');
  if (error) throw error;

  const select = qs('#new-rule-bank');
  select.innerHTML = '<option value="">เลือกธนาคาร</option>';
  data.forEach(bank => {
    const opt = document.createElement('option');
    opt.value = bank.bank_name;
    opt.textContent = bank.bank_name;
    select.appendChild(opt);
  });
}

async function loadRules() {
  const supabase = await getSupabase();
  const { data, error } = await supabase.from('bank_rules').select('*');
  if (error) throw error;
  return data || [];
}

function renderRules(rows) {
  const body = qs('#rules-body');
  body.innerHTML = '';
  rows.forEach(row => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input value="${row.bank_name}" data-id="${row.id}" class="edit-bank" /></td>
      <td><input value="${row.product}" data-id="${row.id}" class="edit-product" /></td>
      <td><input value="${row.property_type}" data-id="${row.id}" class="edit-prop" /></td>
      <td><input value="${row.home_order}" data-id="${row.id}" class="edit-home" /></td>
      <td><input value="${row.dsr_cap}" data-id="${row.id}" class="edit-dsr" /></td>
      <td><input value="${row.ltv_cap}" data-id="${row.id}" class="edit-ltv" /></td>
      <td><input value="${row.max_years}" data-id="${row.id}" class="edit-years" /></td>
      <td><input value="${row.max_age}" data-id="${row.id}" class="edit-age" /></td>
      <td><input value="${row.min_income}" data-id="${row.id}" class="edit-income" /></td>
      <td><input value="${row.min_living_cost ?? ''}" data-id="${row.id}" class="edit-mlc" /></td>
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
        property_type: qs(`.edit-prop[data-id="${id}"]`).value,
        home_order: parseInt(qs(`.edit-home[data-id="${id}"]`).value),
        dsr_cap: parseFloat(qs(`.edit-dsr[data-id="${id}"]`).value),
        ltv_cap: parseFloat(qs(`.