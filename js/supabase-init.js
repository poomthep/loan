(function(){
  const cfg = (window && window.SUPABASE_CONFIG) || null;
  if (!cfg || !cfg.url || !cfg.anonKey) {
    console.warn('AppConfig missing: กรุณาแก้ js/supabase-config.js ให้ครบถ้วน');
    return;
  }
  if (!window.supabase || !window.supabase.createClient){
    console.error('ไม่พบ Supabase UMD (ตรวจสอบการโหลด CDN)');
    return;
  }
  const client = window.SUPABASE = window.supabase.createClient(cfg.url, cfg.anonKey);

  window.getSession = async function(){
    try{
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      return data.session || null;
    }catch(e){
      console.warn('getSession() error:', e);
      return null;
    }
  };

  window.logout = async function(){
    try{ await client.auth.signOut(); }catch(e){ console.warn(e); }
    // ถ้าอยากให้เด้งไปหน้าแรกให้ปรับเป็น path ของคุณ
    try{ window.location.reload(); }catch(_){}
  };

  // แจ้งเตือนว่า ready
  try { window.dispatchEvent(new Event('supabase:ready')); } catch(_) {}
})();