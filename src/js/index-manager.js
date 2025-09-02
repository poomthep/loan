import { supabase } from "../config/supabase-init.js";

// ตรวจสอบเซสชันเมื่อโหลดหน้า
async function checkSession() {
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    console.log("มีการเข้าสู่ระบบแล้ว:", user.email);
    window.location.href = "/loan.html"; // redirect ไป loan.html
  } else {
    console.log("ยังไม่ได้เข้าสู่ระบบ");
  }
}

// จัดการ Login
document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    alert("เข้าสู่ระบบไม่สำเร็จ: " + error.message);
  } else {
    alert("เข้าสู่ระบบสำเร็จ");
    window.location.href = "/loan.html";
  }
});

// ปุ่ม Logout (สำหรับ loan.html หรือ admin.html)
export async function logout() {
  const { error } = await supabase.auth.signOut();
  if (error) {
    alert("ออกจากระบบไม่สำเร็จ: " + error.message);
  } else {
    alert("ออกจากระบบแล้ว");
    window.location.href = "/index.html";
  }
}

// export ฟังก์ชันไว้ใช้งานใน HTML
window.checkSession = checkSession;
window.logout = logout;
