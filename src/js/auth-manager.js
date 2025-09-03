import { supabase } from '../config/supabase-init.js';

export async function checkAdminAccess() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.location.href = './index.html';
    return;
  }
  const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (error || !data || data.role !== 'admin') {
    alert('Access denied: Admin only');
    window.location.href = './index.html';
  }
}
checkAdminAccess();
