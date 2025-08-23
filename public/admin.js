// admin.js (Added MRTA interest rate fields)
import { supabase } from './supabase-client.js';
import { scheduleSessionRefresh, setupVisibilityHandlers } from './session-guard.js';

// --- DOM Elements ---
const views = { gate: document.getElementById('gate'), app: document.getElementById('app') };
const toast = document.getElementById('toast');
const hasMrtaOptionCheckbox = document.getElementById('has_mrta_option');

// --- State & Utility Functions ---
let state = { isEditing: false, editingId: null, banks: [], promotions: [] };
let appBooted = false;
const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);
const D = (v) => (v === '' || v === null) ? null : v;
const showToast = (message, isError = false) => { toast.textContent = message; toast.className = isError ? 'error' : ''; toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 3000); };
const showView = (viewName) => { Object.values(views).forEach(v => v.classList.remove('active')); if (views[viewName]) views[viewName].classList.add('active'); };

// --- Core Application Logic ---
async function loadInitialData(appElements) {
    console.log('[DATA] Fetching initial data...');
    await fetchBanks(appElements.bankSelect);
    await fetchPromotions(appElements.promotionsTableBody);
}
async function isAdminAuthenticated(session) {
    try {
        if (!session) { return false; }
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        
        const { data: profile, error: profileError } = await supabase.from('profiles').select('role, status').eq('id', user.id).single();
        if (profileError) { throw profileError; }
        
        if (!profile || profile.role !== 'admin' || profile.status !== 'approved') {
            throw new Error('Access Denied');
        }
        return true;
    } catch (error) {
        console.warn('[AUTH] Admin check failed:', error.message);
        await supabase.auth.signOut();
        return false;
    }
}

// --- View Initializers ---
function initializeGateView() {
    const loginForm = document.getElementById('login-form');
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const loginBtn = document.getElementById('login-btn');
        loginBtn.disabled = true;
        loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
        const { error } = await supabase.auth.signInWithPassword({
            email: loginForm.email.value,
            password: loginForm.password.value
        });
        if (error) {
            showToast(error.message, true);
        } else {
            showToast('เข้าสู่ระบบสำเร็จ กำลังโหลดข้อมูล...');
        }
        loginBtn.disabled = false;
        loginBtn.textContent = 'เข้าสู่ระบบ';
    };
}

function initializeAppView() {
    const appElements = initAppElements();
    setupAppEventListeners(appElements);
    renderInterestRateInputs(appElements.ratesContainer); // Render initial state
    loadInitialData(appElements);
}

async function boot(session) {
    console.log('[BOOT] Initializing...');
    if (await isAdminAuthenticated(session)) {
        if (!appBooted) {
            appBooted = true;
            showView('app');
            initializeAppView();
        }
    } else {
        appBooted = false;
        showView('gate');
        initializeGateView();
    }
}

function initAppElements() {
    return {
        logoutBtn: document.getElementById('logout-btn'),
        promotionForm: document.getElementById('promotion-form'),
        promotionsTableBody: document.querySelector('#promotions-table tbody'),
        saveBtn: document.getElementById('save-btn'),
        clearBtn: document.getElementById('clear-btn'),
        bankSelect: document.getElementById('bank_id'),
        ratesContainer: document.getElementById('interest-rates-container'),
        addRateYearBtn: document.getElementById('add-rate-year-btn'),
        confirmModal: document.getElementById('confirm-modal'),
        modalText: document.getElementById('modal-text'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
    };
}

// --- UI Rendering ---
// UPDATED: renderInterestRateInputs to include MRTA fields
function renderInterestRateInputs(ratesContainer, rates = { normal: [null, null, null, ""], mrta: [null, null, null, ""] }) {
    ratesContainer.innerHTML = '';
    const showMrta = hasMrtaOptionCheckbox.checked;

    // Ensure we have rate structures, even if null
    const normalRates = rates?.normal || [null, null, null, ""];
    const mrtaRates = rates?.mrta || [null, null, null, ""];
    const numYears = Math.max(normalRates.length, mrtaRates.length);

    for (let i = 0; i < numYears; i++) {
        const year = i + 1;
        const isLastRate = i === numYears - 1;
        const normalRateValue = normalRates[i] ?? '';
        const mrtaRateValue = mrtaRates[i] ?? '';
        
        const row = document.createElement('div');
        row.className = 'rate-year-row';

        let labelText = `ปีที่ ${year}:`;
        let inputType = 'number';
        let placeholder = 'เช่น 3.25';
        if (isLastRate) {
            labelText = `ปีที่ ${year} เป็นต้นไป:`;
            inputType = 'text';
            placeholder = 'เช่น MRR-1.50';
        }

        row.innerHTML = `
            <label>${labelText}</label>
            <div class="rate-inputs-group">
                <input type="${inputType}" class="rate-input normal-rate" value="${normalRateValue}" placeholder="ปกติ (%)" title="อัตราดอกเบี้ยปกติ ปีที่ ${year}">
                <input type="${inputType}" class="rate-input mrta-rate" value="${mrtaRateValue}" placeholder="MRTA (%)" title="อัตราดอกเบี้ย MRTA ปีที่ ${year}" style="display: ${showMrta ? 'block' : 'none'};">
            </div>
        `;
        ratesContainer.appendChild(row);
    }
}

// ... other rendering and data fetching functions are the same ...
async function renderPromotionsTable(promotionsTableBody, promotions) { promotionsTableBody.innerHTML = ''; if (!promotions || promotions.length === 0) { promotionsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>'; return; } promotions.forEach(p => { const rates = p.interest_rates?.normal || []; const firstThreeRates = rates.slice(0, 3).map(r => N(r)).filter(r => r !== null); const avg = firstThreeRates.length > 0 ? (firstThreeRates.reduce((a, b) => a + b, 0) / firstThreeRates.length).toFixed(2) : 'N/A'; const tr = document.createElement('tr'); tr.innerHTML = ` <td>${p.banks?.name || 'N/A'}</td> <td class="promo-name">${p.promotion_name}<small>${p.loan_type}</small></td> <td>${avg}</td> <td class="actions"> <button class="btn-secondary btn-sm edit-btn" data-id="${p.id}">แก้ไข</button> <button class="btn-danger btn-sm delete-btn" data-id="${p.id}">ลบ</button> </td>`; promotionsTableBody.appendChild(tr); }); }
async function fetchBanks(bankSelect) { const { data, error } = await supabase.from('banks').select('id, name').order('name'); if (error) { showToast('ไม่สามารถโหลดข้อมูลธนาคารได้', true); return; } state.banks = data; bankSelect.innerHTML = '<option value="">-- เลือกธนาคาร --</option>'; state.banks.forEach(bank => { const option = document.createElement('option'); option.value = bank.id; option.textContent = bank.name; bankSelect.appendChild(option); }); }
async function fetchPromotions(promotionsTableBody) { const { data, error } = await supabase.from('promotions').select('*, banks(name)').order('created_at', { ascending: false }); if (error) { showToast('ไม่สามารถโหลดข้อมูลโปรโมชันได้', true); return; } state.promotions = data; renderPromotionsTable(promotionsTableBody, data); }

// --- Form Handling ---
function clearForm(appElements) {
    appElements.promotionForm.reset();
    state.isEditing = false;
    state.editingId = null;
    appElements.saveBtn.textContent = 'บันทึกโปรโมชัน';
    appElements.saveBtn.disabled = false;
    appElements.saveBtn.classList.replace('btn-secondary', 'btn-primary');
    // Reset checkbox and re-render inputs
    hasMrtaOptionCheckbox.checked = false;
    renderInterestRateInputs(appElements.ratesContainer);
    appElements.promotionForm.querySelector('input, select').focus();
}

function populateForm(appElements, promo) {
    clearForm(appElements);
    Object.keys(promo).forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = promo[key];
            } else if (el.type === 'date') {
                el.value = promo[key] ? new Date(promo[key]).toISOString().split('T')[0] : '';
            } else {
                el.value = promo[key] ?? '';
            }
        }
    });
    // Trigger change event for MRTA checkbox to show/hide fields
    hasMrtaOptionCheckbox.dispatchEvent(new Event('change'));
    renderInterestRateInputs(appElements.ratesContainer, promo.interest_rates);
    state.isEditing = true;
    state.editingId = promo.id;
    appElements.saveBtn.textContent = 'บันทึกการแก้ไข';
    appElements.saveBtn.classList.replace('btn-primary', 'btn-secondary');
    window.scrollTo(0, 0);
}

async function handleFormSubmit(e, appElements) {
    e.preventDefault();
    appElements.saveBtn.disabled = true;

    try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!await isAdminAuthenticated(session)) {
            showToast('Session ไม่ถูกต้อง, กรุณาล็อกอินใหม่', true);
            setTimeout(() => location.reload(), 2000);
            return;
        }

        const formData = new FormData(appElements.promotionForm);
        const promoData = {};
        const formFields = ['bank_id', 'promotion_name', 'start_date', 'end_date', 'max_ltv', 'dsr_limit', 'income_per_million', 'min_living_expense', 'max_income', 'max_loan_amount', 'max_loan_tenure', 'max_age_salaried', 'max_age_business', 'notes'];
        formFields.forEach(field => { const el = document.getElementById(field); if (el && el.type === 'number') { promoData[field] = N(formData.get(field)); } else if (el) { promoData[field] = D(formData.get(field)); } });
        promoData.waive_mortgage_fee = document.getElementById('waive_mortgage_fee').checked;
        promoData.has_mrta_option = hasMrtaOptionCheckbox.checked;

        const normalRates = [];
        const mrtaRates = [];
        const rateRows = appElements.ratesContainer.querySelectorAll('.rate-year-row');
        
        rateRows.forEach(row => {
            const normalInput = row.querySelector('.normal-rate');
            const mrtaInput = row.querySelector('.mrta-rate');
            
            normalRates.push(normalInput.type === 'number' ? N(normalInput.value) : D(normalInput.value));
            if (hasMrtaOptionCheckbox.checked) {
                mrtaRates.push(mrtaInput.type === 'number' ? N(mrtaInput.value) : D(mrtaInput.value));
            }
        });

        promoData.interest_rates = {
            normal: normalRates.filter(r => r !== null && r !== ""),
            mrta: hasMrtaOptionCheckbox.checked ? mrtaRates.filter(r => r !== null && r !== "") : []
        };
        
        const { error } = state.isEditing ? await supabase.from('promotions').update(promoData).eq('id', state.editingId) : await supabase.from('promotions').insert([promoData]);
        if (error) throw error;
        
        showToast(state.isEditing ? 'แก้ไขโปรโมชันสำเร็จ' : 'เพิ่มโปรโมชันสำเร็จ');
        clearForm(appElements);
        await fetchPromotions(appElements.promotionsTableBody);
    } catch (error) {
        console.error('Submit Error:', error);
        showToast(`เกิดข้อผิดพลาด: ${error.message}`, true);
    } finally {
        appElements.saveBtn.disabled = false;
    }
}

// --- Event Listeners Setup ---
function setupAppEventListeners(appElements) {
    appElements.logoutBtn.addEventListener('click', () => supabase.auth.signOut());
    appElements.clearBtn.addEventListener('click', () => clearForm(appElements));
    appElements.promotionForm.addEventListener('submit', (e) => handleFormSubmit(e, appElements));
    
    // Add listener for the MRTA checkbox to toggle fields
    hasMrtaOptionCheckbox.addEventListener('change', () => {
        const mrtaFields = appElements.ratesContainer.querySelectorAll('.mrta-rate');
        mrtaFields.forEach(field => {
            field.style.display = hasMrtaOptionCheckbox.checked ? 'block' : 'none';
        });
    });

    appElements.addRateYearBtn.addEventListener('click', () => {
        // This is complex now with two sets of rates. We will simplify by just re-rendering.
        const normalRates = Array.from(appElements.ratesContainer.querySelectorAll('.normal-rate')).map(input => input.type === 'number' ? N(input.value) : D(input.value));
        const mrtaRates = Array.from(appElements.ratesContainer.querySelectorAll('.mrta-rate')).map(input => input.type === 'number' ? N(input.value) : D(input.value));
        const lastNormal = normalRates.pop();
        const lastMrta = mrtaRates.pop();
        normalRates.push(null);
        mrtaRates.push(null);
        normalRates.push(lastNormal);
        mrtaRates.push(lastMrta);
        renderInterestRateInputs(appElements.ratesContainer, { normal: normalRates, mrta: mrtaRates });
    });
    
    appElements.promotionsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            if (promo) populateForm(appElements, promo);
            else showToast('ไม่พบข้อมูลโปรโมชัน', true);
        }
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            appElements.modalText.textContent = `คุณต้องการลบโปรโมชัน "${promo?.promotion_name || 'รายการนี้'}" ใช่หรือไม่?`;
            appElements.confirmModal.classList.add('visible');
            appElements.modalConfirmBtn.onclick = async () => {
                appElements.confirmModal.classList.remove('visible');
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
                    await fetchPromotions(appElements.promotionsTableBody);
                } catch (error) {
                    console.error('Delete Error:', error);
                    showToast('ลบไม่สำเร็จ: ' + error.message, true);
                }
            };
        }
    });
    appElements.modalCancelBtn.addEventListener('click', () => { appElements.confirmModal.classList.remove('visible'); });
    appElements.confirmModal.addEventListener('click', (e) => { if (e.target === appElements.confirmModal) { appElements.confirmModal.classList.remove('visible'); } });
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try { if (location.hash.includes('access_token')) { history.replaceState(null, '', location.origin + location.pathname); } } catch (e) { console.warn('Could not clean URL hash'); }
    
    setupVisibilityHandlers();

    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[AUTH] Event: ${event}`);
        boot(session);
    });

    const { data: { session } } = await supabase.auth.getSession();
    boot(session);
});