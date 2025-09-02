import { loginWithPassword, redirectAfterLogin } from './auth-manager.js';
import { getSession } from './supabase-init.js';
import { AppConfig } from './supabase-config.js';

const $ = (s, r = document) => r.querySelector(s);
const msg = (t) => { document.getElementById('msg').textContent = t || ''; };

async function checkSessionAndRedirect() {
  const session = await getSession();
  if (session) {
    msg("มีเซสชันอยู่, กำลังเปลี่ยนเส้นทาง...");
    await redirectAfterLogin();
  }
}

document.getElementById('btn-login').addEventListener('click', async () => {
  msg('กำลังเข้าสู่ระบบ...');
  const email = $('#email').value.trim();
  const password = $('#password').value;
  try {
    await loginWithPassword(email, password);
    await redirectAfterLogin();
  } catch (e) {
    console.error(e);
    msg('เข้าสู่ระบบไม่สำเร็จ: ' + (e.message || e));
  }
});

document.getElementById('btn-check').addEventListener('click', async () => {
  const sess = await getSession();
  msg(sess ? 'มีเซสชัน' : 'ไม่มีเซสชัน');
});

checkSessionAndRedirect();