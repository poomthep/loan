// --- admin.js v6 (client-side join; no PostgREST embed) ---
console.log("admin.js v6 loaded");

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
const interestRateYr1Input = document.getElementById('interest_rate_yr1');
const interestRateYr2Input = document.getElementById('interest_rate_yr2');
const interestRateYr3Input = document.getElementById('interest_rate_yr3');
const interestRateAfterValueInput = document.getElementById('interest_rate_after_value');
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

// ========== Helpers ==========
const N = (v) => (v === '' || v === null || typeof v === 'undefined' ? null : Number(v));
function showToast(msg, ok = true) {
  toast.textContent = msg;
  toast.style.background = ok ? '#111827' : '#b91c1c';
  toast.style.display = 'block';
  setTimeout(() => (toast.style.display = 'none'), 1800);
}
function showGate(){ app.style.display='none'; gate.style.display='block'; }
function showApp(){ gate.style.display='none'; app.style.display='block'; }

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
async function waitForSessionClear(maxMs = 4000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return true;
    await sleep(120);
  }
  return false;
}

// ใช้ flag กันเคส SIGNED_OUT ดีเลย์
let logoutIntent = false;

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

// ========== Auth gate ==========
async function requireAdmin() {
  console.log('1. requireAdmin(): start');
  showGate(); // กันจอขาวขณะรอ async

  try {
    const { data: { session } } = await supabaseClient.auth.getSession();
    console.log('1.1 getSession:', !!session);
    if (!session) return { ok:false, reason:'no-session' };

    const { data: { user }, error: userErr } = await supabaseClient.auth.getUser();
    console.log('1.2 getUser:', user?.email || '(none)', userErr?.message || 'ok');
    if (!user || userErr) return { ok:false, reason:'no-user' };

    await ensureSelfProfile();

    const { data: prof, error: profErr } = await supabaseClient
      .from('profiles').select('role,status').eq('id', user.id).single();
    console.log('1.3 profile:', prof, profErr?.message || 'ok');

    if (profErr || !prof || prof.role !== 'admin' || prof.status !== 'approved') {
      await supabaseClient.auth.signOut();
      showToast('สิทธิ์ไม่เพียงพอ หรือยังไม่อนุมัติ', false);
      showGate();
      return { ok:false, reason:'no-permission' };
    }

    console.log('1.4 admin verified → show app');
    showApp();
    return { ok:true };

  } catch (e) {
    console.error('requireAdmin error:', e);
    showGate();
    return { ok:false, reason:e.message || 'unknown' };
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
  // ดึง banks และ promotions แยกกัน แล้ว map เอาเอง — เลี่ยง PGRST201
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
      <td>${p.promotion_name ?? '-'}</td>
      <td>${avg3y(p) ?? '-'}</td>
      <td class="toolbar">
        <button class="btn warning edit-btn" data-id="${p.id}">แก้ไข</button>
        <button class="btn danger delete-btn" data-id="${p.id}">ลบ</button>
      </td>
    </tr>
  `).join('');
}

function clearForm(){ promoIdInput.value=''; promoForm.reset(); submitBtn.textContent='บันทึกโปรโมชัน'; }

// ========== Form submit ==========
promoForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!bankSelect.value) return showToast('กรุณาเลือกธนาคาร', false);

  const payload = {
    bank_id: Number(bankSelect.value),
    promotion_name: promotionNameInput.value.trim(),
    interest_rate_yr1: N(interestRateYr1Input.value),
    interest_rate_yr2: N(interestRateYr2Input.value),
    interest_rate_yr3: N(interestRateYr3Input.value),
    interest_rate_after: `MRR - ${N(interestRateAfterValueInput.value)?.toFixed(2) ?? '0.00'}%`,
    max_ltv: N(maxLtvInput.value),
    dsr_limit: N(dsrLimitInput.value),
    income_per_million: N(incomePerMillionInput.value),
    min_living_expense: N(minLivingExpenseInput.value),
    max_loan_tenure: N(maxLoanTenureInput.value),
    max_age_salaried: N(maxAgeSalariedInput.value),
    max_age_business: N(maxAgeBusinessInput.value),
    waive_mortgage_fee: !!waiveMortgageFeeInput.checked,
    notes: notesInput.value.trim()
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
    const { data, error } = await supabaseClient.from('promotions').select('*').eq('id', id).single();
    if (error) { console.error(error); return showToast('โหลดข้อมูลโปรโมชันล้มเหลว', false); }
    const p = data;
    promoIdInput.value = p.id;
    bankSelect.value = p.bank_id;
    promotionNameInput.value = p.promotion_name || '';
    interestRateYr1Input.value = p.interest_rate_yr1 ?? '';
    interestRateYr2Input.value = p.interest_rate_yr2 ?? '';
    interestRateYr3Input.value = p.interest_rate_yr3 ?? '';
    const m = (p.interest_rate_after || '').match(/([0-9]+(?:\.[0-9]+)?)/);
    interestRateAfterValueInput.value = m ? m[1] : '';
    maxLtvInput.value = p.max_ltv ?? '';
    dsrLimitInput.value = p.dsr_limit ?? '';
    incomePerMillionInput.value = p.income_per_million ?? '';
    minLivingExpenseInput.value = p.min_living_expense ?? '';
    maxLoanTenureInput.value = p.max_loan_tenure ?? '';
    maxAgeSalariedInput.value = p.max_age_salaried ?? '';
    maxAgeBusinessInput.value = p.max_age_business ?? '';
    waiveMortgageFeeInput.checked = !!p.waive_mortgage_fee;
    notesInput.value = p.notes ?? '';
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
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) { showToast('คุณเข้าสู่ระบบอยู่แล้ว'); return; }

    console.log('[login] attempt', email);
    const { error } = await supabaseClient.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'อีเมลหรือรหัสผ่านไม่ถูกต้อง'
        : `ล็อกอินไม่สำเร็จ: ${error.message}`;
      showToast(msg, false);
      return;
    }
    showToast('ล็อกอินสำเร็จ');
  } finally {
    loginBtn.disabled = false;
  }
}

loginBtn?.addEventListener('click', async (e) => {
  e.preventDefault();
  await doLogin(
    document.getElementById('loginEmail').value.trim(),
    document.getElementById('loginPassword').value
  );
});
loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  await doLogin(loginForm.email.value.trim(), loginForm.password.value);
});

signOutBtn?.addEventListener('click', async () => {
  try {
    logoutIntent = true;
    signOutBtn.disabled = true;
    await supabaseClient.auth.signOut();
    await waitForSessionClear(4000);
  } finally {
    signOutBtn.disabled = false;
    showGate();
  }
});

// ========== Bootstrap ==========
let bootstrapping = false;
async function bootstrap(reason='manual') {
  if (bootstrapping) { console.log('[bootstrap] skip (busy), reason=', reason); return; }
  bootstrapping = true;
  try {
    const { ok, reason: r } = await requireAdmin();
    console.log('[bootstrap] result:', ok, r || '', 'reason=', reason);
    if (ok) {
      await populateBankSelect();
      await fetchPromotions();
    }
  } finally { bootstrapping = false; }
}

supabaseClient.auth.onAuthStateChange(async (event, session) => {
  console.log('[auth] event:', event, 'session?', !!session);

  if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
    await bootstrap(event);
    return;
  }

  if (event === 'SIGNED_OUT') {
    if (!logoutIntent) {
      const { data: { session: now } } = await supabaseClient.auth.getSession();
      if (now) { console.log('[auth] ignore SIGNED_OUT (late; session present)'); return; }
      console.log('[auth] ignore SIGNED_OUT (no intent)'); return;
    }
    showGate();
    logoutIntent = false;
    return;
  }

  if (event === 'INITIAL_SESSION') return; // เราเรียกเองด้านล่าง
});

// เรียกรอบแรก
bootstrap('initial');
