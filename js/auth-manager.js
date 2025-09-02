// auth-manager.js
async function checkAdminAccess() {
  const { data: { user } } = await __supabase__.auth.getUser();

  if (!user) {
    window.location.href = "/index.html";
    return;
  }

  const { data, error } = await __supabase__
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (error || !data || data.role !== "admin") {
    alert("Access denied: Admin only");
    window.location.href = "/index.html";
  }
}

// เรียกใช้ทันทีเมื่อโหลดหน้า admin
if (window.location.pathname.includes("admin.html")) {
  checkAdminAccess();
}
