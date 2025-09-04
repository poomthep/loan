import { supabase } from "../config/supabase-init.js";

async function checkSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    window.location.href = "./loan.html";
  }
}

document.getElementById("loginForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
  } else {
    window.location.href = "./loan.html";
  }
});

export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) alert("ออกจากระบบไม่สำเร็จ: " + error.message);
  else window.location.href = "./index.html";
}

window.checkSession = checkSession;
window.logout = logout;
