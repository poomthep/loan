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

  window.AppAuth = { loginWithPassword, redirectAfterLogin };
})();
