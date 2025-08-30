// js/admin.js
// ========================================
// Admin Panel Controller for admin.html
// ========================================

import { AuthManager, showNotification } from './modules/auth-manager.js';
import AdminManager from './modules/admin-manager.js';

/**
 * Main application class to manage the admin page.
 */
class AdminAppManager {
  constructor() {
    this.adminManager = new AdminManager();
    this.bindElements();
  }

  /**
   * Binds DOM elements.
   */
  bindElements() {
    this.elements = {
      statBanks: document.getElementById('stat-banks'),
      statPromotions: document.getElementById('stat-promotions'),
      statRules: document.getElementById('stat-rules'),
      statCalculations: document.getElementById('stat-calculations'),
      promoBody: document.getElementById('promo-body'),
      rulesBody: document.getElementById('rules-body'),
      mrrBody: document.getElementById('mrr-body'),
      newPromoBank: document.getElementById('new-bank'),
      newRuleBank: document.getElementById('new-rule-bank'),
      newMrrBank: document.getElementById('new-mrr-bank'),
    };
  }

  /**
   * Initializes the admin app.
   */
  async initialize() {
    console.log('🔧 Initializing Admin App...');

    // Check if user is an admin
    await AuthManager.checkSession();
    if (!AuthManager.isAdmin()) {
      showNotification('คุณไม่มีสิทธิ์เข้าถึงหน้านี้', 'error');
      setTimeout(() => window.location.href = './index.html', 2000);
      return;
    }

    // Initialize AdminManager
    await this.adminManager.initialize();

    // Setup event listeners
    this.setupEventListeners();

    console.log('✅ Admin App initialized successfully');
  }

  /**
   * Sets up event listeners.
   */
  setupEventListeners() {
    // Buttons in the tool section
    document.getElementById('btn-promo-add')?.addEventListener('click', () => this.adminManager.addPromotion());
    document.getElementById('btn-promo-refresh')?.addEventListener('click', () => this.adminManager.refreshAllData());
    document.getElementById('btn-promo-export')?.addEventListener('click', () => this.adminManager.exportData('promotions'));
    
    document.getElementById('btn-rules-add')?.addEventListener('click', () => this.adminManager.addBankRule());
    document.getElementById('btn-rules-refresh')?.addEventListener('click', () => this.adminManager.refreshAllData());
    document.getElementById('btn-rules-export')?.addEventListener('click', () => this.adminManager.exportData('rules'));
    
    document.getElementById('btn-mrr-add')?.addEventListener('click', () => this.adminManager.addMrrRate());
    document.getElementById('btn-mrr-refresh')?.addEventListener('click', () => this.adminManager.refreshAllData());

    // Other tool buttons
    document.querySelector('.admin-card button.btn-admin[onclick*="exportAllData"]')
      ?.addEventListener('click', () => this.adminManager.exportAllData());
    document.querySelector('.admin-card button.btn-admin[onclick*="refreshAll"]')
      ?.addEventListener('click', () => this.adminManager.refreshAllData());

    // Quick actions
    document.getElementById('quick-bank-name')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.adminManager.quickAddBank();
    });
    document.getElementById('quick-promo-title')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') this.adminManager.quickAddPromotion();
    });
  }

  /**
   * Updates statistics on the admin page.
   */
  updateStats(stats) {
    if (this.elements.statBanks) this.elements.statBanks.textContent = stats.banks;
    if (this.elements.statPromotions) this.elements.statPromotions.textContent = stats.promotions;
    if (this.elements.statRules) this.elements.statRules.textContent = stats.rules;
    if (this.elements.statCalculations) this.elements.statCalculations.textContent = stats.calculations;
  }

  /**
   * Renders promotions table.
   */
  renderPromotions(promotions) {
    if (!this.elements.promoBody) return;
    this.elements.promoBody.innerHTML = promotions.map(promo => `
      <tr>
        <td>${promo.bank?.short_name || '—'}</td>
        <td>${promo.product_type}</td>
        <td>${promo.title}</td>
        <td>${promo.description || '—'}</td>
        <td>${promo.discount_bps || '—'}</td>
        <td>${promo.year1_rate || '—'}</td>
        <td>${promo.year1_months || '—'}</td>
        <td>${promo.year2_rate || '—'}</td>
        <td>${promo.year2_months || '—'}</td>
        <td>${promo.year3_rate || '—'}</td>
        <td>${promo.year3_months || '—'}</td>
        <td>${promo.final_rate || '—'}</td>
        <td>${promo.ltv_override || '—'}</td>
        <td>${new Date(promo.valid_from).toLocaleDateString()}</td>
        <td>${new Date(promo.valid_until).toLocaleDateString()}</td>
        <td><span class="status-badge ${promo.active ? 'active' : 'inactive'}">${promo.active ? '✅' : '❌'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="adminApp.adminManager.editPromotion('${promo.id}')">✏️</button>
            <button class="btn-small btn-delete" onclick="adminApp.adminManager.deletePromotion('${promo.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Renders bank rules table.
   */
  renderBankRules(rules) {
    if (!this.elements.rulesBody) return;
    this.elements.rulesBody.innerHTML = rules.map(rule => `
      <tr>
        <td>${rule.bank?.short_name || '—'}</td>
        <td>${rule.product_type}</td>
        <td>${rule.property_type || '—'}</td>
        <td>${rule.home_number || '—'}</td>
        <td>${rule.dsr_cap || '—'}%</td>
        <td>${rule.ltv_cap || '—'}%</td>
        <td>${rule.max_tenure_years || '—'}</td>
        <td>${rule.max_age_at_maturity || '—'}</td>
        <td>${rule.min_income || '—'}</td>
        <td>${rule.mlc_per_month || '—'}</td>
        <td>${rule.priority || '—'}</td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="adminApp.adminManager.editBankRule('${rule.id}')">✏️</button>
            <button class="btn-small btn-delete" onclick="adminApp.adminManager.deleteBankRule('${rule.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  /**
   * Renders MRR rates table.
   */
  renderMrrRates(rates) {
    if (!this.elements.mrrBody) return;
    this.elements.mrrBody.innerHTML = rates.map(rate => `
      <tr>
        <td>${rate.bank?.short_name || '—'}</td>
        <td>${rate.product_type}</td>
        <td>${rate.rate || '—'}%</td>
        <td>${new Date(rate.effective_date).toLocaleDateString()}</td>
        <td><span class="status-badge ${rate.active ? 'active' : 'inactive'}">${rate.active ? '✅' : '❌'}</span></td>
        <td>
          <div class="action-buttons">
            <button class="btn-small btn-edit" onclick="adminApp.adminManager.editMrrRate('${rate.id}')">✏️</button>
            <button class="btn-small btn-delete" onclick="adminApp.adminManager.deleteMrrRate('${rate.id}')">🗑️</button>
          </div>
        </td>
      </tr>
    `).join('');
  }
}

// Auto-initialize when the DOM is ready
document.addEventListener('DOMContentLoaded', () => {
  const app = new AdminAppManager();
  app.initialize();
  window.adminApp = app; // For debugging
});