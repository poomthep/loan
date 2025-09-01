import {requireLogin,logout}from '../js/auth-manager.js';
import {getBanks,getActivePromotions}from '../js/data-manager.js';await requireLogin('admin');
const $=s=>document.querySelector(s);$('#btn-logout')?.addEventListener('click',()=>logout());
	async function load(){const banks=await getBanks();const promos=await getActivePromotions();
		const bt=$('#tbl-banks tbody');bt.innerHTML='';banks.forEach(b=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${b.id}</td><td>${b.short_name||''}</td><td>${b.name||''}</td>`;bt.appendChild(tr)});
		const pt=$('#tbl-promos tbody');pt.innerHTML='';promos.forEach(p=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${p.id}</td><td>${p.bank_id}</td><td>${p.product_type||''}</td><td>${p.title||''}</td><td>${p.year1_rate??''}</td><td>${p.base_rate??''}+${p.spread??''}</td><td>${p.is_active?'✅':''}</td>`;pt.appendChild(tr)})}load()
		
		// js/admin-manager-supabase.js
import {
  getBanks, updateBankMRR,
  listPromotions, createPromotion, updatePromotion, deletePromotion
} from './data-manager.js';

export class AdminManager {
  constructor() {
    this.banks = [];
    this.promotions = [];
  }

  async init() {
    await this.loadBanks();
    await this.loadPromotions();

    // bind events
    const btnSaveMRR = document.getElementById('btn-save-mrr');
    if (btnSaveMRR) btnSaveMRR.addEventListener('click', () => this.onSaveMRR());

    const btnAddPromo = document.getElementById('btn-add-promotion');
    if (btnAddPromo) btnAddPromo.addEventListener('click', () => this.onAddPromotion());
  }

  async loadBanks() {
    this.banks = await getBanks();
    const tbody = document.querySelector('#banks-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.banks.forEach(b => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${b.short_name || ''}</td>
        <td>${b.name || ''}</td>
        <td><input type="number" step="0.01" class="mrr-input" data-id="${b.id}" value="${b.mrr ?? ''}" style="width:8rem"></td>
        <td><input type="date" class="mrr-date" data-id="${b.id}" value="${b.mrr_effective_date || ''}"></td>
      `;
      tbody.appendChild(tr);
    });
  }

  async onSaveMRR() {
    const inputs = document.querySelectorAll('#banks-table .mrr-input');
    const dateInputs = document.querySelectorAll('#banks-table .mrr-date');

    const dates = {};
    dateInputs.forEach(d => { dates[d.dataset.id] = d.value || null; });

    const tasks = [];
    inputs.forEach(inp => {
      const id = inp.dataset.id;
      const mrr = inp.value ? Number(inp.value) : null;
      const eff = dates[id] || null;
      tasks.push(updateBankMRR(id, mrr, eff));
    });
    await Promise.all(tasks);
    alert('บันทึก MRR เรียบร้อยแล้ว');
    await this.loadBanks();
  }

  async loadPromotions() {
    this.promotions = await listPromotions(); // เห็นทั้งหมด (admin)
    const tbody = document.querySelector('#promotions-table tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    this.promotions.forEach(p => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${p.id}</td>
        <td>${p.bank_id}</td>
        <td>${p.product_type || ''}</td>
        <td>${p.title || ''}</td>
        <td>${p.base}</td>
        <td>${p.year1_rate ?? ''}</td>
        <td>${p.year2_rate ?? ''}</td>
        <td>${p.year3_rate ?? ''}</td>
        <td>${p.active ? '✅' : '❌'}</td>
        <td>
          <button class="btn-edit" data-id="${p.id}">แก้ไข</button>
          <button class="btn-del" data-id="${p.id}">ลบ</button>
        </td>
      `;
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => this.openEditPromo(btn.dataset.id));
    });
    tbody.querySelectorAll('.btn-del').forEach(btn => {
      btn.addEventListener('click', () => this.onDeletePromo(btn.dataset.id));
    });
  }

  collectPromoForm() {
    // ฟอร์มตัวอย่าง (ต้องมี input id ตามนี้)
    return {
      bank_id: Number(document.getElementById('promo_bank_id').value),
      product_type: document.getElementById('promo_product_type').value || null,
      title: document.getElementById('promo_title').value || null,
      description: document.getElementById('promo_desc').value || null,
      base: (document.querySelector('input[name="promo_base"]:checked')?.value || 'fixed'),
      year1_rate: this.numOrNull(document.getElementById('promo_year1').value),
      year2_rate: this.numOrNull(document.getElementById('promo_year2').value),
      year3_rate: this.numOrNull(document.getElementById('promo_year3').value),
      active: document.getElementById('promo_active').checked
    };
  }
  numOrNull(v) { const n = Number(v); return Number.isFinite(n) ? n : null; }

  async onAddPromotion() {
    const payload = this.collectPromoForm();
    await createPromotion(payload);
    alert('เพิ่มโปรเรียบร้อย');
    await this.loadPromotions();
  }

  async openEditPromo(id) {
    const p = this.promotions.find(x => String(x.id) === String(id));
    if (!p) return alert('ไม่พบโปร');

    // เติมค่าลงฟอร์ม
    document.getElementById('promo_id').value = p.id;
    document.getElementById('promo_bank_id').value = p.bank_id;
    document.getElementById('promo_product_type').value = p.product_type || '';
    document.getElementById('promo_title').value = p.title || '';
    document.getElementById('promo_desc').value = p.description || '';
    document.querySelectorAll('input[name="promo_base"]').forEach(r => {
      r.checked = (r.value === p.base);
    });
    document.getElementById('promo_year1').value = p.year1_rate ?? '';
    document.getElementById('promo_year2').value = p.year2_rate ?? '';
    document.getElementById('promo_year3').value = p.year3_rate ?? '';
    document.getElementById('promo_active').checked = !!p.active;

    // ปุ่มบันทึกแก้ไข
    const btn = document.getElementById('btn-update-promotion');
    if (btn && !btn.dataset.binded) {
      btn.dataset.binded = '1';
      btn.addEventListener('click', async () => {
        const pid = Number(document.getElementById('promo_id').value);
        const patch = this.collectPromoForm();
        await updatePromotion(pid, patch);
        alert('แก้ไขโปรเรียบร้อย');
        await this.loadPromotions();
      });
    }
  }

  async onDeletePromo(id) {
    if (!confirm('ต้องการลบโปรนี้หรือไม่?')) return;
    await deletePromotion(Number(id));
    await this.loadPromotions();
  }
}

if (typeof window !== 'undefined') {
  window.AdminManager = AdminManager;
}
