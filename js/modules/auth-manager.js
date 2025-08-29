// js/modules/auth-manager.js
import { supabase } from './supabase-client.js';

export class AuthManager {
  constructor() {
    this.session = null;
    this.user = null;
    this.setupAuthListener();
  }

  async setupAuthListener() {
    supabase.auth.onAuthStateChange((event, session) => {
      this.session = session;
      this.user = session?.user || null;
      this.updateUI();
      if (event === 'SIGNED_OUT') {
        window.location.href = '/index.html';
      }
    });
  }
  
  async signIn(email, password) {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { data, error };
  }
  
  async signOut() {
    const { error } = await supabase.auth.signOut();
    return { error };
  }
  
  updateUI() {
    const userEmailEl = document.getElementById('user-email');
    const roleBadgeEl = document.getElementById('role-badge');
    const btnLogoutEl = document.getElementById('btn-logout');
    const loginFormEl = document.getElementById('login-form');

    if (this.user) {
      const email = this.user.email;
      userEmailEl.textContent = email;
      btnLogoutEl.style.display = 'block';
      loginFormEl.style.display = 'none';

      // เช็คว่าเป็น admin หรือไม่
      if (email.includes('admin')) {
        roleBadgeEl.textContent = 'ADMIN';
        roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-red-200 text-red-800';
      } else {
        roleBadgeEl.textContent = 'USER';
        roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-blue-200 text-blue-800';
      }
    } else {
      userEmailEl.textContent = '—';
      roleBadgeEl.textContent = 'GUEST';
      roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-gray-200';
      btnLogoutEl.style.display = 'none';
      loginFormEl.style.display = 'block';
    }
  }
}