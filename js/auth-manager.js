
// auth-manager.js
// ตัวจัดการ auth + role (user_profiles.id -> uuid, role -> 'user'|'admin')
import { getSupabase } from './supabase-init.js';

const SB = () => getSupabase();

async function getRole(userId){
  try{
    const { data, error } = await SB().from('user_profiles').select('role').eq('id', userId).single();
    if(error){ console.warn('getRole error', error); return 'user'; }
    return (data && data.role) || 'user';
  }catch(e){ console.warn(e); return 'user'; }
}

export const AuthManager = {
  async signInWithPassword(email, password){
    const { data, error } = await SB().auth.signInWithPassword({ email, password });
    if(error) throw error;
    const user = data.user;
    return { user, role: await getRole(user.id) };
  },
  async signUp(email, password){
    const { data, error } = await SB().auth.signUp({ email, password });
    if(error) throw error;
    return data;
  },
  async signOut(){
    await SB().auth.signOut();
  },
  async getUser(){
    const { data } = await SB().auth.getUser();
    if(!data?.user) return null;
    const role = await getRole(data.user.id);
    return { user: data.user, role };
  },
  async requireRole(allowed){
    const info = await this.getUser();
    if(!info){ window.location.href='/' ; return null; }
    const roles = Array.isArray(allowed)? allowed : [allowed];
    if(!roles.includes(info.role)){
      // ผู้ใช้ทั่วไป → ส่งไปหน้า /loan/
      window.location.href = '/loan/';
      return null;
    }
    return info;
  },
  onAuthStateChange(cb){
    return SB().auth.onAuthStateChange(cb);
  }
};

if(typeof window!=='undefined') window.AuthManager = AuthManager;
export default AuthManager;
