// /js/auth-manager.js  (ESM)
import { SUPABASE_URL, SUPABASE_ANON_KEY, REDIRECTS as R } from './supabase-config.js';
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// ให้ไฟล์อื่นใช้ร่วมได้ (เช่นหน้า loan) ผ่านตัวแปรโกลบอล
window.supabaseClient = supabase;

const REDIRECTS = R ?? { afterLogin: '/loan/', afterAdmin: '/admin/', afterLogout: '/' };

// ====== logic ตัวอย่าง (ถ้ามีฟอร์ม #login-form) ======
const form = document.querySelector('#login-form');
if (form) {
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = form.querySelector('input[name="email"]').value.trim();
    const password = form.querySelector('input[name="password"]').value;

    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message || 'เข้าสู่ระบบไม่สำเร็จ');
      return;
    }

    // ตรวจ role จากตาราง user_profiles (คอลัมน์ id = auth.uid())
    let isAdmin = false;
    try {
      const uid = data.user.id;
      const { data: prof } = await supabase
        .from('user_profiles')
        .select('role')
        .eq('id', uid)
        .single();
      isAdmin = (prof?.role || '').toLowerCase() === 'admin';
    } catch (_) {}

    location.href = isAdmin ? REDIRECTS.afterAdmin : REDIRECTS.afterLogin;
  });
}

// ปุ่มออกจากระบบ (ถ้ามี)
const logoutBtn = document.querySelector('#btn-logout');
if (logoutBtn) {
  logoutBtn.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.href = REDIRECTS.afterLogout;
  });
}
