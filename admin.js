// --- admin.js (v12.1) ---
console.log("admin.js v12.1 loaded");

// ========== Supabase ==========
const SUPABASE_URL = 'https://kpsferwaplnkzrbqoghv.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwc2ZlcndhcGxua3pyYnFvZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTI1NjUsImV4cCI6MjA3MTA4ODU2NX0.FizC7Ia92dqvbtfuU5T3hymh-UX6OEqQRvQnB0oY96Y';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ========== Elements ==========
const promoForm = document.getElementById('promo-form');
const promoTableBody = document.getElementById('promo-table-body');
const promoIdInput = document.getElementById('promo-id');
const bankSelect = document.getElementById('bank_id');
const promotionNameInput = document.getElementById('promotion_name');
const loanTypeSelect = document.getElementById('loan_type');
const interestRateYr1Input = document.getElementById('interest_rate_yr1');
const interestRateYr2Input = document.getElementById('interest_rate_yr2');
const interestRateYr3Input = document.getElementById('interest_rate_yr3');
const maxLtvInput = document.getElementById('max_ltv');
const dsrLimitInput = document.getElementById('dsr_limit');
const incomePerMillionInput = document.getElementById('income_per_million');
const minLivingExpenseInput = document.getElementById('min_living_expense');
const maxLoanTenureInput = document.getElementById('max_loan_tenure');
const maxAgeSalariedInput = document.getElementById('max_age_salaried');
const maxAgeBusinessInput = document.getElementById('max_age_business');
const waiveMortgageFeeInput = document.getElementById('waive_mortgage_fee');
const notesInput = document.getElementById('notes');
const submitBtn = document.getElementById('submitBtn');
const clearBtn = document.getElementById('clearBtn');
const toast = document.getElementById('toast');
const app = document.getElementById('admin-app');
const gate = document.getElementById('auth-gate');
const loginBtn = document.getElementById('loginBtn');
const signOutBtn = document.getElementById('signOutBtn');
const loginForm = document.getElementById('loginForm');
const loader = document.getElementById('loader');
const startDateInput = document.getElementById('start_date');
const endDateInput = document.getElementById('end_date');
const hasMrtaOptionInput = document.getElementById('has_mrta_option');
const interestRateYr1MrtaInput = document.getElementById('interest_rate_yr1_mrta');
const interestRateYr2MrtaInput = document.getElementById('interest_rate_yr2_mrta');
const interestRateYr3MrtaInput = document.getElementById('interest_rate_yr3_mrta');
const mrtaFields = document.getElementById('mrta-fields');
const interestRateAfterValueRetailInput = document.getElementById('interest_rate_after_value_retail');
const interestRateAfterValueWelfareInput = document.getElementById('interest_rate_after_value_welfare');
const interestRateAfterValueMrtaRetailInput = document.getElementById('interest_rate_after_value_mrta_retail');
const interestRateAfterValueMrtaWelfareInput = document.getElementById('interest_rate_after_value_mrta_welfare');

// ========== Event Listeners ==========
hasMrtaOptionInput.addEventListener('change', () => {
  mrtaFields.style.display = hasMrtaOptionInput.checked ? 'grid' : 'none';
  mrtaFields.classList.toggle('mrta-wrap', !hasMrtaOptionInput.checked);
});
clearBtn.addEventListener('click', () => { clearForm(); });

// ========== Helpers ==========
const N = (v) => (v === '' || v === null || typeof v === 'undefined' ? null : Number(v));
const D = (v) => (v === '' || v === null ? null : v);
function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.style.background = ok ? '#111827' : '#b91c1c';
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 1800);
}
function showGate(){ loader.style.display='none'; app.style.display='none'; gate.style.display='grid'; }
function showApp(){ loader.style.display='none'; gate.style.display='none'; app.style.display='block'; }
function showLoader(){ loader.style.display='grid'; gate.style.display='none'; app.style.display='none'; }

// ========== App Logic ==========
async function loadAppData() {
  await populateBankSelect();
  await fetchPromotions();
}

// ========== Auth Gate ==========
async function requireAdmin() {
  console.log('requireAdmin(): Verifying session...');
  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) throw new Error('No active session found.');

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) throw new Error('Could not retrieve user for session.');
    console.log(`User found: ${user.email}`);

    await ensureSelfProfile();

    const { data: prof, error: profError } = await supabaseClient
      .from('profiles').select('role,status').eq('id', user.id).single();
    if (profError) throw profError;
    if (!prof || prof.role !== 'admin' || prof.status !== 'approved') {
      throw new Error('User is not an approved admin.');
    }

    console.log('Admin verified successfully.');
    showApp();
    return true;
  } catch (error) {
    console.error(`Admin verification failed: ${error.message}`);
    await supabaseClient.auth.signOut().catch(e => console.error("Sign out failed during cleanup", e));
    showGate();
    return false;
  }
}

// ========== Banks ==========
async function populateBankSelect() {
  const { data, error } = await supabaseClient
    .from('banks').select('id, bank_name').order('bank_name', { ascending:true });
  if (error) { console.error(error); showToast('โหลดรายชื่อธนาคารล้มเหลว', false); return; }
  bankSelect.innerHTML = '<option value="">-- กรุณาเลือกธนาคาร --</option>';
  (data || []).forEach(b => {
    const opt = document.createElement('option');
    opt.value = b.id;
    opt.textContent = b.bank_name;
    bankSelect.appendChild(opt);
  });
}

// ========== Profile bootstrap ==========
async function ensureSelfProfile() {
  const { data: { user } } = await supabaseClient.auth.getUser();
  if (!user) return;
  const { data: have } = await supabaseClient
    .from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (!have) {
    const payload = { id: user.id, email: user.email, role: 'user', status: 'pending' };
    const { error } = await supabaseClient.from('profiles').insert(payload);
    if (error) console.warn('[profile] insert error:', error.message);
  }
}

// ========== Utils ==========
function avg3y(p) {
  const nums = [p.interest_rate_yr1, p.interest_rate_yr2, p.interest_rate_yr3]
    .map(v => (v == null ? NaN : parseFloat(v)))
    .filter(Number.isFinite);
  if (!nums.length) return null;
  return (nums.reduce((a,b)=>a+b,0)/nums.length).toFixed(2);
}

// ========== Data (client-side join) ==========
async function fetchPromotions() {
  const [banksRes, promosRes] = await Promise.all([
    supabaseClient.from('banks').select('id, bank_name'),
    supabaseClient.from('promotions').select('*').order('id', { ascending: false })
  ]);
  if (banksRes.error) { console.error(banksRes.error); showToast('โหลดรายชื่อธนาคารล้มเหลว', false); return; }
  if (promosRes.error) { console.error(promosRes.error); showToast('โหลดโปรโมชันล้มเหลว', false); return; }
  const dict = new Map((banksRes.data || []).map(b => [b.id, b.bank_name]));
  const rows = (promosRes.data || []).map(p => ({ ...p, bank_name: dict.get(p.bank_id) ?? '-' }));
  renderPromotions(rows);
}

function renderPromotions(rows) {
  promoTableBody.innerHTML = (rows || []).map(p => `
    <tr>
      <td>${p.bank_name ?? '-'}</td>
      <td>${p.promotion_name ?? '-'}<br><small class="muted">${p.loan_type ?? 'ทั่วไป'}</small></td>
      <td>${avg3y(p) ?? '-'}</td>
      <td class="toolbar">
        <button class="btn warning edit-btn" data-id="${p.id}">แก้ไข</button>
        <button class="btn danger delete-btn" data-id="${p.id}">ลบ</button>
      </td>
    </tr>
  `).join('');
}

function clearForm(){
  promoIdInput.value='';
  promoForm.reset();
  submitBtn.textContent='บันทึกโปรโมชัน';
  mrtaFields.style.display = 'none';
  mrtaFields.classList.add('mrta-wrap');
}

// ========== Form submit ==========
promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!bankSelect.value) return showToast('กรุณาเลือกธนาคาร', false);
  const payload = {
    bank_id: Number(bankSelect.value),
    promotion_name: promotionNameInput.value.trim(),
    loan_type: loanTypeSelect.value,
    interest_rate_yr1: N(interestRateYr1Input.value),
    interest_rate_yr2: N(interestRateYr2Input.value),
    interest_rate_yr3: N(interestRateYr3Input.value),
    max_ltv: N(maxLtvInput.value),
    dsr_limit: N(dsrLimitInput.value),
    income_per_million: N(incomePerMillionInput.value),
    min_living_expense: N(minLivingExpenseInput.value),
    max_loan_tenure: N(maxLoanTenureInput.value),
    max_age_salaried: N(maxAgeSalariedInput.value),
    max_age_business: N(maxAgeBusinessInput.value),
    waive_mortgage_fee: !!waiveMortgageFeeInput.checked,
    notes: notesInput.value.trim(),
    start_date: D(startDateInput.value),
    end_date: D(endDateInput.value),
    has_mrta_option: !!hasMrtaOptionInput.checked,
    interest_rate_yr1_mrta: N(interestRateYr1MrtaInput.value),
    interest_rate_yr2_mrta: N(interestRateYr2MrtaInput.value),
    interest_rate_yr3_mrta: N(interestRateYr3MrtaInput.value),
    interest_rate_after_value_retail: N(interestRateAfterValueRetailInput.value),
    interest_rate_after_value_welfare: N(interestRateAfterValueWelfareInput.value),
    interest_rate_after_value_mrta_retail: N(interestRateAfterValueMrtaRetailInput.value),
    interest_rate_after_value_mrta_welfare: N(interestRateAfterValueMrtaWelfareInput.value),
  };
  submitBtn.disabled = true;
  try {
    if (promoIdInput.value) {
      const id = Number(promoIdInput.value);
      const { error } = await supabaseClient.from('promotions').update(payload).eq('id', id);
      if (error) throw error;
      showToast('อัปเดตโปรโมชันสำเร็จ');
    } else {
      const { error } = await supabaseClient.from('promotions').insert(payload);
      if (error) throw error;
      showToast('บันทึกโปรโมชันสำเร็จ');
    }
    clearForm();
    await fetchPromotions();
  } catch (err) {
    console.error(err); showToast('บันทึกล้มเหลว', false);
  } finally { submitBtn.disabled = false; }
});

// ========== Row actions ==========
document.addEventListener('click', async (e) => {
  const btn = e.target.closest('button'); if (!btn) return;
  if (btn.classList.contains('edit-btn')) {
    const id = Number(btn.dataset.id);
    const { data: p, error } = await supabaseClient.from('promotions').select('*').eq('id', id).single();
    if (error) { console.error(error); return showToast('โหลดข้อมูลโปรโมชันล้มเหลว', false); }

    promoIdInput.value = p.id;
    bankSelect.value = p.bank_id;
    promotionNameInput.value = p.promotion_name || '';
    loanTypeSelect.value = p.loan_type || 'ทั่วไป';
    interestRateYr1Input.value = p.interest_rate_yr1 ?? '';
    interestRateYr2Input.value = p.interest_rate_yr2 ?? '';
    interestRateYr3Input.value = p.interest_rate_yr3 ?? '';
    maxLtvInput.value = p.max_ltv ?? '';
    dsrLimitInput.value = p.dsr_limit ?? '';
    incomePerMillionInput.value = p.income_per_million ?? '';
    minLivingExpenseInput.value = p.min_living_expense ?? '';
    maxLoanTenureInput.value = p.max_loan_tenure ?? '';
    maxAgeSalariedInput.value = p.max_age_salaried ?? '';
    maxAgeBusinessInput.value = p.max_age_business ?? '';
    waiveMortgageFeeInput.checked = !!p.waive_mortgage_fee;
    notesInput.value = p.notes ?? '';
    startDateInput.value = p.start_date ?? '';
    endDateInput.value = p.end_date ?? '';
    hasMrtaOptionInput.checked = !!p.has_mrta_option;
    interestRateYr1MrtaInput.value = p.interest_rate_yr1_mrta ?? '';
    interestRateYr2MrtaInput.value = p.interest_rate_yr2_mrta ?? '';
    interestRateYr3MrtaInput.value = p.interest_rate_yr3_mrta ?? '';
    interestRateAfterValueRetailInput.value = p.interest_rate_after_value_retail ?? '';
    interestRateAfterValueWelfareInput.value = p.interest_rate_after_value_welfare ?? '';
    interestRateAfterValueMrtaRetailInput.value = p.interest_rate_after_value_mrta_retail ?? '';
    interestRateAfterValueMrtaWelfareInput.value = p.interest_rate_after_value_mrta_welfare ?? '';

    mrtaFields.style.display = hasMrtaOptionInput.checked ? 'grid' : 'none';
    mrtaFields.classList.toggle('mrta-wrap', !hasMrtaOptionInput.checked);
    submitBtn.textContent = 'บันทึกการแก้ไข';
    promoForm.scrollIntoView({ behavior: 'smooth' });
  }
  if (btn.classList.contains('delete-btn')) {
    const id = Number(btn.dataset.id);
    if (!confirm('ลบโปรโมชันนี้ใช่ไหม?')) return;
    const { error } = await supabaseClient.from('promotions').delete().eq('id', id);
    if (error) { console.error(error); return showToast('ลบไม่สำเร็จ', false); }
    showToast('ลบสำเร็จ');
    await fetchPromotions();
  }
});

// ========== Auth: login/logout ==========
async function doLogin(email, password) {
  loginBtn.disabled = true;
  try {
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message) ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' : `ล็อกอินไม่สำเร็จ: ${error.message}`;
      showToast(msg, false);
    }
  } finally {
    loginBtn.disabled = false;
  }
}
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await doLogin(loginForm.email.value.trim(), loginForm.password.value);
});
signOutBtn?.addEventListener('click', async () => {
  showLoader();
  await supabaseClient.auth.signOut();
});

// ========== App Initializer ==========

// ตรวจครั้งแรกทันทีที่หน้าโหลด
async function boot() {
  console.log('boot(): checking initial session...');
  showLoader();
  const { data: { session } } = await supabaseClient.auth.getSession();
  if (session) {
    const ok = await requireAdmin();
    if (ok) await loadAppData();
  } else {
    showGate();
  }
}

// ฟังการเปลี่ยนสถานะถัดๆ ไป (SIGNED_IN / SIGNED_OUT)
supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log(`Auth event: ${event}`);
  if (!session) return showGate();
  const ok = await requireAdmin();
  if (ok) await loadAppData();
});

// เริ่มทำงาน
boot();
