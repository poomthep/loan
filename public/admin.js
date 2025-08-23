// admin.js (Fixed event listener attachment timing)
import { supabase } from './supabase-client.js';
import { scheduleSessionRefresh, setupVisibilityHandlers } from './session-guard.js';

// --- DOM Elements ---
const views = { gate: document.getElementById('gate'), app: document.getElementById('app') };
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const promotionForm = document.getElementById('promotion-form');
const promotionsTableBody = document.querySelector('#promotions-table tbody');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const bankSelect = document.getElementById('bank_id');
const toast = document.getElementById('toast');
const searchInput = document.getElementById('search-input');
const ratesContainer = document.getElementById('interest-rates-container');
const addRateYearBtn = document.getElementById('add-rate-year-btn');
const confirmModal = document.getElementById('confirm-modal');
const modalText = document.getElementById('modal-text');
const modalConfirmBtn = document.getElementById('modal-confirm-btn');
const modalCancelBtn = document.getElementById('modal-cancel-btn');

// --- State & Utility Functions ---
let state = { isEditing: false, editingId: null, banks: [], promotions: [] };
let appBooted = false;
const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);
const D = (v) => (v === '' || v === null) ? null : v;
const showToast = (message, isError = false) => { toast.textContent = message; toast.className = isError ? 'error' : ''; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); };
const showView = (viewName) => { Object.values(views).forEach(v => v.classList.remove('active')); if (views[viewName]) views[viewName].classList.add('active'); };

// --- Core Application Logic ---
async function loadInitialData() { console.log('[DATA] Fetching initial data...'); await fetchBanks(); await fetchPromotions(); }
async function isAdminAuthenticated(session) { try { if (!session) { return false; } const user = session.user; const { data: profile, error: profileError } = await supabase.from('profiles').select('role, status').eq('id', user.id).single(); if (profileError) { throw profileError; } if (!profile || profile.role !== 'admin' || profile.status !== 'approved') { throw new Error('Access Denied'); } return true; } catch (error) { console.warn('[AUTH] Admin check failed:', error.message); await supabase.auth.signOut(); return false; } }

async function boot(session) {
    console.log('[BOOT] Initializing...');
    if (await isAdminAuthenticated(session)) {
        showView('app');
        await loadInitialData();
        // --- MOVED: Attach app-specific listeners only after authentication ---
        setupAppEventListeners();
    } else {
        showView('gate');
    }
}

// --- UI Rendering & Form Handling (No changes) ---
function renderInterestRateInputs(rates = [null, null, null, ""]) { ratesContainer.innerHTML = ''; rates.forEach((rate, index) => { const year = index + 1; const isLastRate = index === rates.length - 1; const isRemovable = rates.length > 3 && index < rates.length - 1; const row = document.createElement('div'); row.className = 'rate-year-row'; row.dataset.year = year; let labelText = `ปีที่ ${year} (%):`; let inputType = 'number'; let placeholder = 'เช่น 3.25'; if (isLastRate) { labelText = `ปีที่ ${year} เป็นต้นไป:`; inputType = 'text'; placeholder = 'เช่น MRR-1.50'; } row.innerHTML = ` <label for="rate_year_${year}">${labelText}</label> <input type="${inputType}" id="rate_year_${year}" class="rate-input" value="${rate ?? ''}" placeholder="${placeholder}" ${inputType === 'number' ? 'step="0.01"' : ''}> ${isRemovable ? `<button type="button" class="btn-danger remove-rate-year-btn" tabindex="-1">ลบ</button>` : ''} `; ratesContainer.appendChild(row); }); }
function renderPromotionsTable(promotions) { promotionsTableBody.innerHTML = ''; if (!promotions || promotions.length === 0) { promotionsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>'; return; } promotions.forEach(p => { const rates = p.interest_rates || []; const firstThreeRates = rates.slice(0, 3).map(r => typeof r === 'number' ? r : N(r)).filter(r => r !== null); const avg = firstThreeRates.length > 0 ? (firstThreeRates.reduce((a, b) => a + b, 0) / firstThreeRates.length).toFixed(2) : 'N/A'; const tr = document.createElement('tr'); tr.innerHTML = ` <td>${p.banks?.name || 'N/A'}</td> <td class="promo-name">${p.promotion_name}<small>${p.loan_type}</small></td> <td>${avg}</td> <td class="actions"> <button class="btn-secondary btn-sm edit-btn" data-id="${p.id}">แก้ไข</button> <button class="btn-danger btn-sm delete-btn" data-id="${p.id}">ลบ</button> </td>`; promotionsTableBody.appendChild(tr); }); }
async function fetchBanks() { const { data, error } = await supabase.from('banks').select('id, name').order('name'); if (error) { showToast('ไม่สามารถโหลดข้อมูลธนาคารได้', true); return; } state.banks = data; bankSelect.innerHTML = '<option value="">-- เลือกธนาคาร --</option>'; state.banks.forEach(bank => { const option = document.createElement('option'); option.value = bank.id; option.textContent = bank.name; bankSelect.appendChild(option); }); }
async function fetchPromotions() { const { data, error } = await supabase.from('promotions').select('*, banks(name)').order('created_at', { ascending: false }); if (error) { showToast('ไม่สามารถโหลดข้อมูลโปรโมชันได้', true); return; } state.promotions = data; renderPromotionsTable(data); }
function clearForm() { promotionForm.reset(); state.isEditing = false; state.editingId = null; saveBtn.textContent = 'บันทึกโปรโมชัน'; saveBtn.disabled = false; saveBtn.classList.replace('btn-secondary', 'btn-primary'); renderInterestRateInputs(); promotionForm.querySelector('input, select').focus(); }
function populateForm(promo) { clearForm(); Object.keys(promo).forEach(key => { const el = document.getElementById(key); if (el) { if (el.type === 'checkbox') el.checked = promo[key]; else if (el.type === 'date') el.value = promo[key] ? new Date(promo[key]).toISOString().split('T')[0] : ''; else el.value = promo[key] ?? ''; } }); renderInterestRateInputs(promo.interest_rates || [null, null, null, ""]); state.isEditing = true; state.editingId = promo.id; saveBtn.textContent = 'บันทึกการแก้ไข'; saveBtn.classList.replace('btn-primary', 'btn-secondary'); window.scrollTo(0, 0); }
async function handleFormSubmit(e) { e.preventDefault(); saveBtn.disabled = true; try { const { data: { session } } = await supabase.auth.getSession(); if (!await isAdminAuthenticated(session)) { showToast('Session ไม่ถูกต้อง, กรุณาล็อกอินใหม่', true); setTimeout(() => location.reload(), 2000); return; } const formData = new FormData(promotionForm); const promoData = {}; const formFields = ['bank_id', 'promotion_name', 'start_date', 'end_date', 'max_ltv', 'dsr_limit', 'income_per_million', 'min_living_expense', 'max_income', 'max_loan_amount', 'max_loan_tenure', 'max_age_salaried', 'max_age_business', 'notes']; formFields.forEach(field => { const el = document.getElementById(field); if (el && el.type === 'number') { promoData[field] = N(formData.get(field)); } else if (el) { promoData[field] = D(formData.get(field)); } }); promoData.waive_mortgage_fee = document.getElementById('waive_mortgage_fee').checked; promoData.has_mrta_option = document.getElementById('has_mrta_option').checked; const rateInputs = ratesContainer.querySelectorAll('.rate-input'); promoData.interest_rates = Array.from(rateInputs).map(input => (input.type === 'number' ? N(input.value) : D(input.value)) || null).filter(rate => rate !== null); const { error } = state.isEditing ? await supabase.from('promotions').update(promoData).eq('id', state.editingId) : await supabase.from('promotions').insert([promoData]); if (error) throw error; showToast(state.isEditing ? 'แก้ไขโปรโมชันสำเร็จ' : 'เพิ่มโปรโมชันสำเร็จ'); clearForm(); await fetchPromotions(); } catch (error) { console.error('Submit Error:', error); showToast(`เกิดข้อผิดพลาด: ${error.message}`, true); } finally { saveBtn.disabled = false; } }

// --- Event Listeners Setup ---
// NEW: This function only attaches listeners for the main app view
function setupAppEventListeners() {
    logoutBtn.addEventListener('click', () => supabase.auth.signOut());
    clearBtn.addEventListener('click', clearForm);
    promotionForm.addEventListener('submit', handleFormSubmit);
    addRateYearBtn.addEventListener('click', () => {
        const inputs = Array.from(ratesContainer.querySelectorAll('.rate-input'));
        const currentRates = inputs.map(input => input.type === 'number' ? N(input.value) : D(input.value));
        const lastRate = currentRates.pop();
        currentRates.push(null);
        currentRates.push(lastRate);
        renderInterestRateInputs(currentRates);
    });
    promotionsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            if (promo) populateForm(promo);
            else showToast('ไม่พบข้อมูลโปรโมชัน', true);
        }
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            modalText.textContent = `คุณต้องการลบโปรโมชัน "${promo?.promotion_name || 'รายการนี้'}" ใช่หรือไม่?`;
            confirmModal.classList.add('visible');
            modalConfirmBtn.onclick = async () => {
                confirmModal.classList.remove('visible');
                try {
                    const { data: { session } } = await supabase.auth.getSession();
                    if (!await isAdminAuthenticated(session)) {
                        showToast('Session ไม่ถูกต้อง, กรุณาล็อกอินใหม่', true);
                        setTimeout(() => location.reload(), 2000);
                        return;
                    }
                    const { error } = await supabase.from('promotions').delete().eq('id', id);
                    if (error) throw error;
                    showToast('ลบโปรโมชันสำเร็จแล้ว');
                    await fetchPromotions();
                } catch (error) {
                    console.error('Delete Error:', error);
                    showToast('ลบไม่สำเร็จ: ' + error.message, true);
                }
            };
        }
    });
    modalCancelBtn.addEventListener('click', () => { confirmModal.classList.remove('visible'); });
    confirmModal.addEventListener('click', (e) => { if (e.target === confirmModal) { confirmModal.classList.remove('visible'); } });
}

// This function attaches listeners that should always be active
function setupGlobalEventListeners() {
    loginForm.addEventListener('submit', async (e) => { e.preventDefault(); const loginBtn = document.getElementById('login-btn'); loginBtn.disabled = true; loginBtn.textContent = 'กำลังเข้าสู่ระบบ...'; const { error } = await supabase.auth.signInWithPassword({ email: loginForm.email.value, password: loginForm.password.value }); if (error) { showToast(error.message, true); } else { showToast('เข้าสู่ระบบสำเร็จ กำลังโหลดข้อมูล...'); } loginBtn.disabled = false; loginBtn.textContent = 'เข้าสู่ระบบ'; });
    
    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[AUTH] Event: ${event}, Session available:`, !!session);
        scheduleSessionRefresh(session);
        if (event === 'SIGNED_IN') {
            if (!appBooted) {
                appBooted = true;
                boot(session);
            }
        } else if (event === 'SIGNED_OUT') {
            appBooted = false;
            showView('gate');
            showToast('ออกจากระบบแล้ว');
        }
    });
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try { if (location.hash.includes('access_token')) { history.replaceState(null, '', location.origin + location.pathname); } } catch (e) { console.warn('Could not clean URL hash'); }
    
    setupGlobalEventListeners(); // Setup listeners for login and auth state
    setupVisibilityHandlers();
    
    // Don't render inputs or boot until we know the user's state
    const { data: { session } } = await supabase.auth.getSession();
    if (session) {
      boot(session);
    } else {
      showView('gate');
    }
});