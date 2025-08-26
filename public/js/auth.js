import { getSupabase } from './supabaseClient.js';

export async function getProfileRole() {
  const supabase = await getSupabase();
  const { data: userData } = await supabase.auth.getUser();
  const uid = userData?.user?.id;
  if (!uid) return { role: null, user: null };
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', uid)
    .maybeSingle();
  if (error) {
    console.warn('getProfileRole error', error);
    return { role: null, user: userData.user };
  }
  return { role: data?.role || null, user: userData.user };
}

export async function handleAuthUI() {
  const supabase = await getSupabase();

  const elLogin = document.getElementById('login-form');
  const elLogout = document.getElementById('btn-logout');
  const elEmail = document.getElementById('email');
  const elPass = document.getElementById('password');
  const elRoleBadge = document.getElementById('role-badge');
  const elUser = document.getElementById('user-email');

  // Hydrate current session
  const { data: sessionData } = await supabase.auth.getSession();
  if (sessionData?.session?.user) {
    elLogin?.classList.add('hidden');
    elLogout?.classList.remove('hidden');
    elUser && (elUser.textContent = sessionData.session.user.email || 'user');
  } else {
    elLogin?.classList.remove('hidden');
    elLogout?.classList.add('hidden');
  }

  const renderRole = async () => {
    const { role } = await getProfileRole();
    if (elRoleBadge) {
      elRoleBadge.textContent = role ? role.toUpperCase() : 'GUEST';
      elRoleBadge.className = 'px-2 py-1 rounded-full text-xs font-semibold ' +
        (role === 'admin' ? 'bg-green-600 text-white' : role ? 'bg-gray-200 text-gray-800' : 'bg-gray-200 text-gray-800');
    }
  };

  await renderRole();

  elLogin?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = elEmail?.value?.trim();
    const password = elPass?.value?.trim();
    if (!email || !password) return alert('กรอกอีเมลและรหัสผ่าน');

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      alert(error.message || 'ล็อกอินล้มเหลว');
      return;
    }
    location.reload();
  });

  elLogout?.addEventListener('click', async () => {
    await supabase.auth.signOut();
    location.reload();
  });
}