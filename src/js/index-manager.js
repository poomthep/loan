import { supabase } from "../config/supabase-init.js";

async function login(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
  } else {
    // ✅ redirect ไป loan.html
    window.location.href = "/loan.html";
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;
  await login(email, password);
});
