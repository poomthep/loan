// admin-manager-supabase.js
// ใช้กับ /admin/index.html (ที่มี id ของ element ตามนี้):
// banks:     #banks-table, #btn-save-mrr
// promos:    #promotions-table, #btn-add-promotion, #btn-update-promotion
// fields:    #promo_id, #promo_bank_id, #promo_product_type, #promo_title, #promo_desc,
//            name="promo_base" (fixed/mrr), #promo_year1, #promo_year2, #promo_year3, #promo_active

import './supabase-init.js';

// === สำคัญ: alias function จาก data-manager.js ป้องกันชนชื่อ ===
import {
  getBanks as dmGetBanks,
  updateBankMRR as dmUpdateBankMRR,
  listPromotions as dmListPromotions,
  createPromotion as dmCreatePromotion,
  updatePromotion as dmUpdatePromotion,
  deletePromotion as dmDeletePromotion,
} from './data-manager.js';

// ====== utilities ======
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

function formatNumber(n, digits = 2) {
  if (n === null || n === undefined || n === '') return '';
  const x = Number(n);
  if (Number.isNaN(x)) return '';
  return x.toFixed(digits);
}

function notify(msg, type = 'info', timeout = 2200) {
  const colors = {
    success: 'background:#065f46;color:#ecfdf5;border:1px solid #064e3b;',
    error: 'background:#7f1d1d;color:#fee2e2;border:1px solid #7f1d1d;',
    info: 'background:#0b1220;color:#cbd5e1;border:1px solid #1f2937;',
    warning: 'background:#7c2d12;color:#ffedd5;border:1px solid #7c2d12;',
  };
  const n = document.createElement('div');
  n.style.cssText =
    'position:fixed;top:16px;right:16px;padding:10px 12px;border-radius:10px;z-index:9999;font-size:.95rem;' +
    (colors[type] || colors.info);
  n.textContent = msg;
  document.body.appendChild(n);
  setTimeout(() => n.remove(), timeout);
}

// ====== Admin Manager ======
export class AdminManager {
  constructor() {
    // elements
    this.tblBanks = $('#banks-table');
    this.btnSaveMRR = $('#btn-save-mrr');

    this.tblPromos = $('#promotions-table');
    this.btnAddPromo = $('#btn-add-promotion');
    this.btnUpdatePromo = $('#btn-update-promotion');

    // form fields
    this.inputPromoId = $('#promo_id');
    this.inputBankId = $('#promo_bank_id');
    this.inputProduct = $('#promo_product_type');
    this.inputTitle = $('#promo_title');
    this.inputDesc = $('#promo_desc');
    this.inputYear1 = $('#promo_year1');
    this.inputYear2 = $('#promo_year2');
    this.inputYear3 = $('#promo_year3');
    this.chkActive = $('#promo_active');
  }

  async init() {
    await this.loadBanks();
    await this.loadPromotions();
    this.wireEvents();
  }

  wireEvents() {
    if (this.btnSaveMRR) {
      this.btnSaveMRR.addEventListener('click', () => this.saveAllMRR());
    }

    if (this.btnAddPromo) {
      this.btnAddPromo.addEventListener('click', () => this.handleCreatePromotion());
    }

    if (this.btnUpdatePromo) {
      this.btnUpdatePromo.addEventListener('click', () => this.handleUpdatePromotion());
    }

    // action buttons in promotions table (edit/delete)
    if (this.tblPromos) {
      this.tblPromos.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id) return;

        if (action === 'edit') {
          this.fillPromotionFormFromRow(id);
        } else if (action === 'delete') {
          this.deletePromotion(id);
        }
      });
    }
  }

  // ===== Banks (MRR) =====
  async loadBanks() {
    try {
      const banks = await dmGetBanks(); // คาดว่า [{id, short_name, name, mrr, mrr_effective_date}, ...]
      this.renderBankTable(banks || []);
    } catch (e) {
      console.error('loadBanks error:', e);
      notify('โหลดข้อมูลธนาคารไม่สำเร็จ', 'error');
    }
  }

  renderBankTable(banks) {
    if (!this.tblBanks) return;
    const tbody = this.tblBanks.querySelector('tbody');
    if (!tbody) return;

    if (!Array.isArray(banks) || banks.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" class="muted">ไม่พบข้อมูล</td></tr>`;
      return;
    }

    const rows = banks
      .map((b) => {
        const mrrVal = b.mrr ?? '';
        const eff = (b.mrr_effective_date || '').slice(0, 10);
        return `
          <tr data-bank-id="${b.id}">
            <td>${b.short_name || ''}</td>
            <td>${b.name || ''}</td>
            <td style="max-width:120px;">
              <input type="number" step="0.01" class="mrr-input" value="${mrrVal !== '' ? Number(mrrVal) : ''}" />
            </td>
            <td style="max-width:160px;">
              <input type="date" class="mrr-date" value="${eff}" />
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.innerHTML = rows || `<tr><td colspan="4" class="muted">ไม่พบข้อมูล</td></tr>`;
  }

  async saveAllMRR() {
    if (!this.tblBanks) return;
    const tbody = this.tblBanks.querySelector('tbody');
    if (!tbody) return;

    const rows = Array.from(tbody.querySelectorAll('tr[data-bank-id]'));
    if (!rows.length) return;

    let success = 0;
    for (const tr of rows) {
      const bankId = Number(tr.dataset.bankId);
      const mrrInput = tr.querySelector('.mrr-input');
      const dateInput = tr.querySelector('.mrr-date');

      const mrr = mrrInput?.value ? Number(mrrInput.value) : null;
      const effective = dateInput?.value || null;

      try {
        // สมมติ signature: updateBankMRR(bankId, mrr, effective_from)
        await dmUpdateBankMRR(bankId, mrr, effective);
        success++;
      } catch (e) {
        console.warn('update MRR fail:', bankId, e);
      }
    }

    if (success) {
      notify(`บันทึก MRR แล้ว ${success} รายการ`, 'success');
      await this.loadBanks();
    } else {
      notify('ไม่สามารถบันทึก MRR ได้', 'error');
    }
  }

  // ===== Promotions =====
  async loadPromotions() {
    try {
      // สมมติ listPromotions() คืนทั้งหมดสำหรับแอดมิน
      const promos = await dmListPromotions();
      this.renderPromotionsTable(promos || []);
    } catch (e) {
      console.error('loadPromotions error:', e);
      notify('โหลดโปรโมชันไม่สำเร็จ', 'error');
    }
  }

  renderPromotionsTable(promos) {
    if (!this.tblPromos) return;
    const tbody = this.tblPromos.querySelector('tbody');
    if (!tbody) return;

    if (!Array.isArray(promos) || promos.length === 0) {
      tbody.innerHTML = `<tr><td colspan="10" class="muted">ไม่พบโปรโมชัน</td></tr>`;
      return;
    }

    const rows = promos
      .map((p) => {
        // คาดคีย์มาตรฐาน: id, bank_short_name/bank_id, product_type, title, base ('fixed'|'mrr'),
        // year1, year2, year3, active(boolean)
        const base = p.base || 'fixed';
        const y1 = formatNumber(p.year1 ?? p.year1_rate ?? p.year1_spread ?? '');
        const y2 = formatNumber(p.year2 ?? p.year2_rate ?? p.year2_spread ?? '');
        const y3 = formatNumber(p.year3 ?? p.year3_rate ?? p.year3_spread ?? '');
        const bankLabel = p.bank_short_name || p.bank_name || p.bank_id || '';

        return `
          <tr data-promo='${encodeURIComponent(JSON.stringify(p))}'>
            <td>${p.id}</td>
            <td>${bankLabel}</td>
            <td>${p.product_type || ''}</td>
            <td>${p.title || ''}</td>
            <td>${base}</td>
            <td>${y1}</td>
            <td>${y2}</td>
            <td>${y3}</td>
            <td>${p.active ? '<span class="badge ok">active</span>' : '<span class="badge no">off</span>'}</td>
            <td>
              <button class="btn" data-action="edit" data-id="${p.id}">แก้ไข</button>
              <button class="btn" data-action="delete" data-id="${p.id}">ลบ</button>
            </td>
          </tr>
        `;
      })
      .join('');

    tbody.innerHTML = rows || `<tr><td colspan="10" class="muted">ไม่พบโปรโมชัน</td></tr>`;
  }

  collectPromotionPayload() {
    const id = this.inputPromoId?.value ? Number(this.inputPromoId.value) : null;
    const bank_id = this.inputBankId?.value ? Number(this.inputBankId.value) : null;
    const product_type = this.inputProduct?.value || null;
    const title = this.inputTitle?.value?.trim() || '';
    const description = this.inputDesc?.value?.trim() || '';

    const base = ($$('input[name="promo_base"]:checked')[0]?.value || 'fixed').toLowerCase();
    const year1 = this.inputYear1?.value ? Number(this.inputYear1.value) : null;
    const year2 = this.inputYear2?.value ? Number(this.inputYear2.value) : null;
    const year3 = this.inputYear3?.value ? Number(this.inputYear3.value) : null;
    const active = !!this.chkActive?.checked;

    // payload แบบกลางให้ data-manager ตีความ
    const payload = {
      bank_id,
      product_type,
      title,
      description,
      base,           // 'fixed' หรือ 'mrr'
      year1, year2, year3,
      active,
    };

    return { id, payload };
  }

  async handleCreatePromotion() {
    const { payload } = this.collectPromotionPayload();

    // ตรวจง่าย ๆ
    if (!payload.bank_id || !payload.product_type || !payload.title) {
      notify('กรอก Bank ID / Product / ชื่อโปร ให้ครบ', 'warning');
      return;
    }

    try {
      await dmCreatePromotion(payload);
      notify('เพิ่มโปรโมชันแล้ว', 'success');
      this.clearPromotionForm();
      await this.loadPromotions();
    } catch (e) {
      console.error('create promo error:', e);
      notify('เพิ่มโปรไม่สำเร็จ', 'error');
    }
  }

  async handleUpdatePromotion() {
    const { id, payload } = this.collectPromotionPayload();
    if (!id) {
      notify('ยังไม่ได้เลือกโปรเพื่อแก้ไข', 'warning');
      return;
    }

    try {
      await dmUpdatePromotion(id, payload);
      notify('บันทึกการแก้ไขแล้ว', 'success');
      this.clearPromotionForm();
      await this.loadPromotions();
    } catch (e) {
      console.error('update promo error:', e);
      notify('บันทึกการแก้ไขไม่สำเร็จ', 'error');
    }
  }

  clearPromotionForm() {
    if (this.inputPromoId) this.inputPromoId.value = '';
    if (this.inputBankId) this.inputBankId.value = '';
    if (this.inputProduct) this.inputProduct.value = '';
    if (this.inputTitle) this.inputTitle.value = '';
    if (this.inputDesc) this.inputDesc.value = '';
    if (this.inputYear1) this.inputYear1.value = '';
    if (this.inputYear2) this.inputYear2.value = '';
    if (this.inputYear3) this.inputYear3.value = '';
    if (this.chkActive) this.chkActive.checked = true;
    const baseFixed = $$('input[name="promo_base"]').find((x) => x.value === 'fixed');
    if (baseFixed) baseFixed.checked = true;
  }

  fillPromotionFormFromRow(id) {
    const tr = this.tblPromos?.querySelector(`button[data-action="edit"][data-id="${id}"]`)?.closest('tr');
    if (!tr) return;

    const raw = tr.getAttribute('data-promo');
    if (!raw) return;

    let p;
    try {
      p = JSON.parse(decodeURIComponent(raw));
    } catch (e) {
      console.warn('parse promo row failed:', e);
      return;
    }

    // map -> form
    if (this.inputPromoId) this.inputPromoId.value = p.id ?? '';
    if (this.inputBankId) this.inputBankId.value = p.bank_id ?? '';
    if (this.inputProduct) this.inputProduct.value = p.product_type ?? '';
    if (this.inputTitle) this.inputTitle.value = p.title ?? '';
    if (this.inputDesc) this.inputDesc.value = p.description ?? '';
    if (this.chkActive) this.chkActive.checked = !!p.active;

    const baseVal = (p.base || 'fixed').toLowerCase();
    const baseInput = $$('input[name="promo_base"]').find((x) => x.value === baseVal);
    if (baseInput) baseInput.checked = true;

    // รองรับได้ทั้ง year*_rate / year*_spread / year*
    const y1 = p.year1 ?? p.year1_rate ?? p.year1_spread ?? '';
    const y2 = p.year2 ?? p.year2_rate ?? p.year2_spread ?? '';
    const y3 = p.year3 ?? p.year3_rate ?? p.year3_spread ?? '';

    if (this.inputYear1) this.inputYear1.value = y1 !== '' ? Number(y1) : '';
    if (this.inputYear2) this.inputYear2.value = y2 !== '' ? Number(y2) : '';
    if (this.inputYear3) this.inputYear3.value = y3 !== '' ? Number(y3) : '';
  }

  async deletePromotion(id) {
    if (!confirm('ต้องการลบโปรนี้ใช่หรือไม่?')) return;
    try {
      await dmDeletePromotion(Number(id));
      notify('ลบโปรแล้ว', 'success');
      await this.loadPromotions();
    } catch (e) {
      console.error('delete promo error:', e);
      notify('ลบโปรไม่สำเร็จ', 'error');
    }
  }
}

// เผื่อโค้ดเก่าต้องการเรียกผ่าน window
if (typeof window !== 'undefined') {
  window.AdminManager = AdminManager;
}
