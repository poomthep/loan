// index-manager.js
async function checkSession() {
  const { data: { user } } = await window.__supabase__.auth.getUser();
  if (user) {
    console.log("Logged in:", user.email);
  } else {
    console.log("ยังไม่ได้เข้าสู่ระบบ");
  }
}

document.getElementById("loginForm").addEventListener("submit", async (e) => {
  e.preventDefault();
  const email = document.getElementById("email").value;
  const password = document.getElementById("password").value;

  const { data, error } = await window.__supabase__.auth.signInWithPassword({
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
