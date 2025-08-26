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
const showView = (viewName) => { 
    Object.values(views).forEach(v => v.style.display = 'none');
    if (views[viewName]) views[viewName].style.display = 'block';
};

// --- Bank (MRR) Management ---
function renderBankManagement(banks) {
    const container = document.getElementById('bank-management-container');
    if (!container) return;
    container.innerHTML = '<h3>ค่า MRR ของแต่ละธนาคาร</h3>';
    banks.forEach(bank => {
        const div = document.createElement('div');
        div.className = 'bank-mrr-row';
        div.innerHTML = `
            <label for="mrr-${bank.id}">${bank.name}</label>
            <input type="number" class="mrr-input" id="mrr-${bank.id}" value="${bank.mrr_rate || ''}" step="0.01" placeholder="เช่น 7.3">
            <button class="btn btn-secondary btn-sm save-mrr-btn" data-id="${bank.id}">บันทึก</button>
        `;
        container.appendChild(div);
    });
}

// --- Core Application Logic ---
async function loadInitialData(appElements) {
    await fetchBanks(appElements.bankSelect);
    await fetchPromotions(appElements.promotionsTableBody);
}

async function isAdminAuthenticated(session) {
    try {
        if (!session) return false;
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return false;
        const { data: profile, error } = await supabase.from('profiles').select('role, status').eq('id', user.id).single();
        if (error) throw error;
        if (!profile || profile.role !== 'admin' || profile.status !== 'approved') throw new Error('Access Denied');
        return true;
    } catch (error) {
        console.warn('[AUTH] Admin check failed:', error.message);
        await supabase.auth.signOut();
        return false;
    }
}

function initializeGateView() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;
    loginForm.onsubmit = async (e) => {
        e.preventDefault();
        const loginBtn = document.getElementById('login-btn');
        loginBtn.disabled = true; loginBtn.textContent = 'กำลังเข้าสู่ระบบ...';
        const { error } = await supabase.auth.signInWithPassword({ email: loginForm.email.value, password: loginForm.password.value });
        if (error) { showToast(error.message, true); }
        else { showToast('เข้าสู่ระบบสำเร็จ กำลังโหลดข้อมูล...'); }
        loginBtn.disabled = false; loginBtn.textContent = 'เข้าสู่ระบบ';
    };
}

function initializeAppView() {
    const appElements = initAppElements();
    setupAppEventListeners(appElements);
    renderInterestRateInputs(appElements.ratesContainer, { normal: ["", "", ""], mrta: ["", "", ""] });
    loadInitialData(appElements);
}

async function boot(session) {
    if (await isAdminAuthenticated(session)) {
        if (!appBooted) {
            appBooted = true;
            showView('app');
            initializeAppView();
            scheduleSessionRefresh(session);
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
        confirmModal: document.getElementById('confirm-modal'),
        modalText: document.getElementById('modal-text'),
        modalConfirmBtn: document.getElementById('modal-confirm-btn'),
        modalCancelBtn: document.getElementById('modal-cancel-btn'),
    };
}

// --- REWRITTEN: UI Rendering for Interest Rates ---
function renderInterestRateInputs(ratesContainer, rates = { normal: [""], mrta: [""] }) {
    ratesContainer.innerHTML = ''; // Clear previous content
    const showMrta = hasMrtaOptionCheckbox.checked;
    const normalRates = rates?.normal || [];
    const mrtaRates = rates?.mrta || [];
    
    const numYears = Math.max(normalRates.length, 1);
    while (normalRates.length < numYears) normalRates.push("");
    while (mrtaRates.length < numYears) mrtaRates.push("");

    for (let i = 0; i < numYears; i++) {
        const year = i + 1;
        const isLastRate = i === numYears - 1;
        const isRemovable = numYears > 1;
        
        const normalRateValue = normalRates[i] ?? "";
        const mrtaRateValue = mrtaRates[i] ?? "";
        
        const row = document.createElement('div');
        row.className = 'rate-year-row';
        row.dataset.yearIndex = i;

        let labelText = `ปีที่ ${year}:`;
        let normalInputHTML, mrtaInputHTML;

        if (isLastRate) {
            labelText = `ปีที่ ${year} เป็นต้นไป:`;
            const mrrValue = (typeof normalRateValue === 'string' && normalRateValue.includes('MRR-')) ? N(normalRateValue.split('-')[1]) : '';
            const mrrMrtaValue = (typeof mrtaRateValue === 'string' && mrtaRateValue.includes('MRR-')) ? N(mrtaRateValue.split('-')[1]) : '';
            
            normalInputHTML = `<div class="mrr-group"><span>MRR -</span><input type="number" class="rate-input normal-rate" value="${mrrValue}" placeholder="1.50" step="0.01"><span>%</span></div>`;
            mrtaInputHTML = `<div class="mrr-group" style="display: ${showMrta ? 'flex' : 'none'}"><span>MRR -</span><input type="number" class="rate-input mrta-rate" value="${mrrMrtaValue}" placeholder="1.75" step="0.01"><span>%</span></div>`;
        } else {
            normalInputHTML = `<input type="number" class="rate-input normal-rate" value="${normalRateValue}" placeholder="เช่น 3.25" step="0.01">`;
            mrtaInputHTML = `<input type="number" class="rate-input mrta-rate" value="${mrtaRateValue}" placeholder="เช่น 3.15" step="0.01" style="display: ${showMrta ? 'block' : 'none'}">`;
        }
        
        const removeButtonHTML = isRemovable ? `<button type="button" class="btn btn-danger btn-sm remove-rate-year-btn" data-year-index="${i}">ลบ</button>` : '';

        row.innerHTML = `
            <label>${labelText}</label>
            <div class="rate-inputs-group ${showMrta ? 'has-mrta' : ''}">
                ${normalInputHTML}
                ${mrtaInputHTML}
            </div>
            ${removeButtonHTML}
        `;
        ratesContainer.appendChild(row);
    }

    // Add control buttons at the end
    const controls = document.createElement('div');
    controls.className = 'rate-controls';
    controls.innerHTML = `<button type="button" id="add-rate-year-btn" class="btn btn-secondary btn-sm">เพิ่มปี</button>`;
    ratesContainer.appendChild(controls);
}

async function renderPromotionsTable(promotionsTableBody, promotions) { 
    promotionsTableBody.innerHTML = '<tr><td colspan="4" style="text-align:center;">ยังไม่มีข้อมูล</td></tr>'; 
    if (!promotions || promotions.length === 0) return;
    promotionsTableBody.innerHTML = ''; 
    promotions.forEach(p => { 
        const rates = p.interest_rates?.normal || []; 
        const firstThreeRates = rates.slice(0, 3).map(r => (typeof r === 'number' ? r : 0)); 
        const avg = firstThreeRates.length > 0 ? (firstThreeRates.reduce((a, b) => a + b, 0) / firstThreeRates.length).toFixed(2) : 'N/A'; 
        const tr = document.createElement('tr'); 
        tr.innerHTML = `<td>${p.banks?.name || 'N/A'}</td><td class="promo-name">${p.promotion_name}</td><td>${avg}</td><td class="actions"><button class="btn-secondary btn-sm edit-btn" data-id="${p.id}">แก้ไข</button><button class="btn-danger btn-sm delete-btn" data-id="${p.id}">ลบ</button></td>`; 
        promotionsTableBody.appendChild(tr); 
    }); 
}

// --- DATA FETCHING ---
async function fetchBanks(bankSelect) { 
    const { data, error } = await supabase.from('banks').select('id, name, mrr_rate').order('name'); 
    if (error) { showToast('ไม่สามารถโหลดข้อมูลธนาคารได้', true); return; } 
    state.banks = data; 
    bankSelect.innerHTML = '<option value="">-- เลือกธนาคาร --</option>'; 
    state.banks.forEach(bank => { 
        const option = document.createElement('option'); option.value = bank.id; option.textContent = bank.name; bankSelect.appendChild(option); 
    });
    renderBankManagement(state.banks);
}

async function fetchPromotions(promotionsTableBody) { 
    const { data, error } = await supabase.from('promotions').select('*, banks(name)').order('created_at', { ascending: false }); 
    if (error) { showToast('ไม่สามารถโหลดข้อมูลโปรโมชันได้', true); return; } 
    state.promotions = data; 
    renderPromotionsTable(promotionsTableBody, data); 
}

// --- Form Handling ---
function clearForm(appElements) {
    appElements.promotionForm.reset();
    state.isEditing = false;
    state.editingId = null;
    appElements.saveBtn.textContent = 'บันทึกโปรโมชัน';
    appElements.saveBtn.disabled = false;
    document.getElementById('bonus_factor').value = 70;
    document.getElementById('other_income_factor').value = 50;
    document.getElementById('income_assessment_factor').value = 100;
    document.getElementById('payment_multiplier').value = 150;
    document.getElementById('min_living_expense').value = 15000;
    hasMrtaOptionCheckbox.checked = false;
    renderInterestRateInputs(appElements.ratesContainer, { normal: ["", "", ""], mrta: ["", "", ""] });
    appElements.promotionForm.querySelector('select').focus();
}

function populateForm(appElements, promo) {
    clearForm(appElements);
    Object.keys(promo).forEach(key => {
        const el = document.getElementById(key);
        if (el) {
            if (key === 'bonus_factor' || key === 'other_income_factor' || key === 'income_assessment_factor') {
                el.value = (promo[key] ?? 0) * 100;
            } else if (el.type === 'checkbox') {
                el.checked = promo[key];
            } else if (el.type === 'date') {
                el.value = promo[key] ? new Date(promo[key]).toISOString().split('T')[0] : '';
            } else {
                el.value = promo[key] ?? '';
            }
        }
    });
    hasMrtaOptionCheckbox.dispatchEvent(new Event('change'));
    renderInterestRateInputs(appElements.ratesContainer, promo.interest_rates);
    state.isEditing = true;
    state.editingId = promo.id;
    appElements.saveBtn.textContent = 'บันทึกการแก้ไข';
    window.scrollTo(0, 0);
}

async function handleFormSubmit(e, appElements) {
    e.preventDefault();
    appElements.saveBtn.disabled = true;
    try {
        const formData = new FormData(appElements.promotionForm);
        const promoData = {};
        const formFields = ['bank_id', 'promotion_name', 'start_date', 'end_date', 'dsr_limit', 'income_per_million', 'payment_multiplier', 'min_living_expense', 'notes'];
        formFields.forEach(field => { 
            const el = document.getElementById(field);
            if (el && el.type === 'number') { promoData[field] = N(formData.get(field)); } 
            else if (el) { promoData[field] = D(formData.get(field)); }
        });
        promoData.bonus_factor = N(formData.get('bonus_factor')) / 100;
        promoData.other_income_factor = N(formData.get('other_income_factor')) / 100;
        promoData.income_assessment_factor = N(formData.get('income_assessment_factor')) / 100;
        promoData.has_mrta_option = hasMrtaOptionCheckbox.checked;
        const normalRates = [];
        const mrtaRates = [];
        const rateRows = appElements.ratesContainer.querySelectorAll('.rate-year-row');
        rateRows.forEach((row, index) => {
            const isLastRate = index === rateRows.length - 1;
            const normalInput = row.querySelector('.normal-rate');
            const normalValue = N(normalInput.value);
            if (isLastRate && normalValue !== null) { normalRates.push(`MRR-${normalValue}`); } 
            else { normalRates.push(normalValue); }
            if (hasMrtaOptionCheckbox.checked) {
                const mrtaInput = row.querySelector('.mrta-rate');
                const mrtaValue = N(mrtaInput.value);
                if (isLastRate && mrtaValue !== null) { mrtaRates.push(`MRR-${mrtaValue}`); } 
                else { mrtaRates.push(mrtaValue); }
            }
        });
        promoData.interest_rates = {
            normal: normalRates.filter(r => r !== null),
            mrta: hasMrtaOptionCheckbox.checked ? mrtaRates.filter(r => r !== null) : []
        };
        const { error } = state.isEditing 
            ? await supabase.from('promotions').update(promoData).eq('id', state.editingId) 
            : await supabase.from('promotions').insert([promoData]);
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

// --- REWRITTEN: Event Listeners Setup ---
function setupAppEventListeners(appElements) {
    appElements.logoutBtn.addEventListener('click', () => supabase.auth.signOut());
    appElements.clearBtn.addEventListener('click', () => clearForm(appElements));
    appElements.promotionForm.addEventListener('submit', (e) => handleFormSubmit(e, appElements));
    
    const bankContainer = document.getElementById('bank-management-container');
    bankContainer.addEventListener('click', async (e) => {
        if (e.target.classList.contains('save-mrr-btn')) {
            const btn = e.target;
            btn.disabled = true;
            const bankId = btn.dataset.id;
            const mrrInput = document.getElementById(`mrr-${bankId}`);
            const newMrrRate = N(mrrInput.value);
            if (newMrrRate === null) {
                showToast('กรุณาใส่ค่า MRR ที่ถูกต้อง', true);
                btn.disabled = false;
                return;
            }
            const { error } = await supabase.from('banks').update({ mrr_rate: newMrrRate }).eq('id', bankId);
            if (error) { showToast('อัปเดต MRR ไม่สำเร็จ: ' + error.message, true); } 
            else { showToast('อัปเดต MRR สำเร็จ'); }
            btn.disabled = false;
        }
    });

    const toggleBankManagerBtn = document.getElementById('toggle-bank-manager-btn');
    toggleBankManagerBtn.addEventListener('click', () => {
        if (bankContainer.style.display === 'none') {
            bankContainer.style.display = 'block';
            toggleBankManagerBtn.textContent = 'ซ่อนส่วนจัดการ MRR';
        } else {
            bankContainer.style.display = 'none';
            toggleBankManagerBtn.textContent = 'แก้ไข MRR ธนาคาร';
        }
    });

    const togglePromoFormBtn = document.getElementById('toggle-promo-form-btn');
    const promoForm = document.getElementById('promotion-form');
    togglePromoFormBtn.addEventListener('click', () => {
        if (promoForm.style.display === 'none') {
            promoForm.style.display = 'grid';
            togglePromoFormBtn.textContent = 'ซ่อนฟอร์ม';
        } else {
            promoForm.style.display = 'none';
            togglePromoFormBtn.textContent = 'แสดงฟอร์ม';
        }
    });

    const ratesContainer = appElements.ratesContainer;
    
    const getCurrentRatesFromDOM = () => {
        const rateRows = Array.from(ratesContainer.querySelectorAll('.rate-year-row'));
        const normalRates = rateRows.map((row, index) => {
            const input = row.querySelector('.normal-rate');
            const isLastRate = index === rateRows.length - 1;
            const value = N(input.value);
            return isLastRate && value !== null ? `MRR-${value}` : value;
        });
        const mrtaRates = rateRows.map((row, index) => {
            const input = row.querySelector('.mrta-rate');
            const isLastRate = index === rateRows.length - 1;
            const value = N(input.value);
            return isLastRate && value !== null ? `MRR-${value}` : value;
        });
        return { normal: normalRates, mrta: mrtaRates };
    };

    hasMrtaOptionCheckbox.addEventListener('change', () => {
        const currentRates = getCurrentRatesFromDOM();
        renderInterestRateInputs(ratesContainer, currentRates);
    });

    ratesContainer.addEventListener('click', (e) => {
        if (e.target.id === 'add-rate-year-btn') {
            const currentRates = getCurrentRatesFromDOM();
            const lastNormal = currentRates.normal.pop();
            const lastMrta = currentRates.mrta.pop();
            currentRates.normal.push(""); // Add an empty string for the new year
            currentRates.mrta.push("");
            currentRates.normal.push(lastNormal); // Add the 'MRR-' rate back at the end
            currentRates.mrta.push(lastMrta);
            renderInterestRateInputs(ratesContainer, currentRates);
        }
        if (e.target.classList.contains('remove-rate-year-btn')) {
            const indexToRemove = parseInt(e.target.dataset.yearIndex, 10);
            const currentRates = getCurrentRatesFromDOM();
            currentRates.normal.splice(indexToRemove, 1);
            currentRates.mrta.splice(indexToRemove, 1);
            renderInterestRateInputs(ratesContainer, currentRates);
        }
    });
    
    appElements.promotionsTableBody.addEventListener('click', async (e) => {
        const target = e.target;
        if (target.classList.contains('edit-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            if (promo) {
                if(promoForm.style.display === 'none') { togglePromoFormBtn.click(); }
                populateForm(appElements, promo);
            } else { showToast('ไม่พบข้อมูลโปรโมชัน', true); }
        }
        if (target.classList.contains('delete-btn')) {
            const id = target.dataset.id;
            const promo = state.promotions.find(p => p.id == id);
            appElements.modalText.textContent = `คุณต้องการลบโปรโมชัน "${promo?.promotion_name || 'รายการนี้'}" ใช่หรือไม่?`;
            appElements.confirmModal.style.display = 'block';
            appElements.modalConfirmBtn.onclick = async () => {
                appElements.confirmModal.style.display = 'none';
                try {
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

    const closeModal = () => appElements.confirmModal.style.display = 'none';
    appElements.modalCancelBtn.addEventListener('click', closeModal);
    appElements.confirmModal.querySelector('.close-btn').addEventListener('click', closeModal);
    appElements.confirmModal.addEventListener('click', (e) => { 
        if (e.target === appElements.confirmModal) { closeModal(); } 
    });
}

// --- App Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
    try { 
        if (location.hash.includes('access_token')) { 
            history.replaceState(null, '', location.origin + location.pathname); 
        } 
    } catch (e) { console.warn('Could not clean URL hash'); }
    setupVisibilityHandlers();
    const { data: { session } } = await supabase.auth.getSession();
    boot(session);
    supabase.auth.onAuthStateChange((event, session) => {
        console.log(`[AUTH] Event: ${event}`);
        boot(session);
    });
});