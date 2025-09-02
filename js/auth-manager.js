// Auth flows without modules. Depends on window.sb and window.AppConfig and window.DM
(function(){
  if (!window.sb) return;

  async function loginWithPassword(email, password) {
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data.user;
  }

  async function roleAfterLogin() {
    try {
      const role = await DM.getMyRole();
      return role || "user";
    } catch(e) {
      console.warn("cannot query role, fallback user", e);
      return "user";
    }
  }

  async function redirectAfterLogin() {
    const role = await roleAfterLogin();
    if (role === "admin") window.location.assign(AppConfig.REDIRECTS.afterLoginAdmin);
    else window.location.assign(AppConfig.REDIRECTS.afterLoginUser);
  }

  // เพิ่มฟังก์ชันนี้เพื่อตรวจสอบว่าผู้ใช้ล็อกอินหรือไม่
  async function ensureLogin() {
    const session = await getSession();
    if (!session) {
      window.location.assign(AppConfig.REDIRECTS.afterLogout);
      return false;
    }
    return true;
  }

  window.AppAuth = { loginWithPassword, redirectAfterLogin, ensureLogin };
})();