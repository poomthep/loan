// js/auth-manager.js
// ========================================
// AUTHENTICATION MANAGER
// ========================================

import supabase, { handleSupabaseError } from './supabase-client.js';

/**
 * จัดการระบบ Authentication ทั้งหมด
 */
export class AuthManager {
  static currentUser = null;
  static userProfile = null;
  static authListeners = [];

  // ========================================
  // AUTHENTICATION METHODS
  // ========================================

  /**
   * เข้าสู่ระบบด้วยอีเมลและรหัสผ่าน
   */
  static async signInWithEmail(email, password) {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password: password
      });

      if (error) throw error;

      this.currentUser = data.user;
      await this.loadUserProfile();
      this.notifyAuthListeners('SIGNED_IN', data.user);

      console.log('✅ Sign in successful:', data.user.email);
      return { success: true, user: data.user };

    } catch (error) {
      console.error('❌ Sign in error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * สมัครสมาชิกใหม่
   */
  static async signUp(email, password, userData = {}) {
    try {
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(),
        password: password,
        options: {
          data: {
            full_name: userData.fullName || email.split('@')[0],
            ...userData
          }
        }
      });

      if (error) throw error;

      console.log('✅ Sign up successful:', data.user?.email);
      return { 
        success: true, 
        user: data.user,
        needConfirmation: !data.session
      };

    } catch (error) {
      console.error('❌ Sign up error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * ออกจากระบบ
   */
  static async signOut() {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      this.currentUser = null;
      this.userProfile = null;
      this.notifyAuthListeners('SIGNED_OUT', null);

      console.log('✅ Sign out successful');
      return { success: true };

    } catch (error) {
      console.error('❌ Sign out error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * รีเซ็ตรหัสผ่าน
   */
  static async resetPassword(email) {
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: window.location.origin + '/reset-password'
      });

      if (error) throw error;

      console.log('✅ Password reset email sent');
      return { success: true };

    } catch (error) {
      console.error('❌ Password reset error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  /**
   * อัพเดตรหัสผ่าน
   */
  static async updatePassword(newPassword) {
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });

      if (error) throw error;

      console.log('✅ Password updated successfully');
      return { success: true };

    } catch (error) {
      console.error('❌ Password update error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  // ========================================
  // USER PROFILE METHODS
  // ========================================

  /**
   * โหลดข้อมูลโปรไฟล์ผู้ใช้
   */
  static async loadUserProfile() {
    if (!this.currentUser) return null;

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', this.currentUser.id)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 = row not found
        throw error;
      }

      this.userProfile = data;
      return data;

    } catch (error) {
      console.error('Error loading user profile:', error);
      return null;
    }
  }

  /**
   * อัพเดตข้อมูลโปรไฟล์ผู้ใช้
   */
  static async updateUserProfile(updates) {
    if (!this.currentUser) {
      throw new Error('ต้องเข้าสู่ระบบก่อน');
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
  /**
   * อัพเดตข้อมูลโปรไฟล์ผู้ใช้
   */
  static async updateUserProfile(updates) {
    if (!this.currentUser) {
      throw new Error('ต้องเข้าสู่ระบบก่อน');
    }

    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .upsert({
          id: this.currentUser.id,
          ...updates,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) throw error;

      this.userProfile = data;
      this.notifyAuthListeners('PROFILE_UPDATED', data);

      console.log('✅ Profile updated successfully');
      return { success: true, profile: data };

    } catch (error) {
      console.error('❌ Profile update error:', error);
      return { 
        success: false, 
        error: handleSupabaseError(error)
      };
    }
  }

  // ========================================
  // SESSION & STATE MANAGEMENT
  // ========================================

  /**
   * ตรวจสอบ session ปัจจุบัน
   */
  static async checkSession() {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) throw error;

      if (session?.user) {
        this.currentUser = session.user;
        await this.loadUserProfile();
        this.notifyAuthListeners('SESSION_RESTORED', session.user);
        return session.user;
      }

      return null;

    } catch (error) {
      console.error('Error checking session:', error);
      return null;
    }
  }

  /**
   * ฟังการเปลี่ยนแปลง auth state
   */
  static setupAuthListener() {
    return supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('🔐 Auth state changed:', event);

      switch (event) {
        case 'SIGNED_IN':
          this.currentUser = session?.user || null;
          if (this.currentUser) {
            await this.loadUserProfile();
          }
          this.notifyAuthListeners(event, session?.user);
          break;

        case 'SIGNED_OUT':
        case 'TOKEN_REFRESHED':
          this.currentUser = session?.user || null;
          this.userProfile = session?.user ? this.userProfile : null;
          this.notifyAuthListeners(event, session?.user);
          break;

        case 'PASSWORD_RECOVERY':
          this.notifyAuthListeners(event, session?.user);
          break;
      }
    });
  }

  /**
   * เพิ่ม listener สำหรับการเปลี่ยนแปลง auth state
   */
  static addAuthListener(listener) {
    if (typeof listener === 'function') {
      this.authListeners.push(listener);
    }
  }

  /**
   * ลบ auth listener
   */
  static removeAuthListener(listener) {
    const index = this.authListeners.indexOf(listener);
    if (index > -1) {
      this.authListeners.splice(index, 1);
    }
  }

  /**
   * แจ้งเตือน listeners ทั้งหมด
   */
  static notifyAuthListeners(event, user) {
    this.authListeners.forEach(listener => {
      try {
        listener(event, user, this.userProfile);
      } catch (error) {
        console.error('Error in auth listener:', error);
      }
    });
  }

  // ========================================
  // UTILITY METHODS
  // ========================================

  /**
   * ตรวจสอบว่าผู้ใช้ล็อกอินอยู่หรือไม่
   */
  static isAuthenticated() {
    return !!this.currentUser;
  }

  /**
   * ตรวจสอบว่าผู้ใช้เป็น admin หรือไม่
   */
  static isAdmin() {
    return this.userProfile?.role === 'admin';
  }

  /**
   * ดึงข้อมูลผู้ใช้ปัจจุบัน
   */
  static getCurrentUser() {
    return this.currentUser;
  }

  /**
   * ดึงข้อมูลโปรไฟล์ปัจจุบัน
   */
  static getUserProfile() {
    return this.userProfile;
  }

  /**
   * ดึงข้อมูลผู้ใช้พร้อมโปรไฟล์
   */
  static getFullUserData() {
    return {
      user: this.currentUser,
      profile: this.userProfile,
      isAuthenticated: this.isAuthenticated(),
      isAdmin: this.isAdmin()
    };
  }

  // ========================================
  // INITIALIZATION
  // ========================================

  /**
   * เริ่มต้นระบบ Auth Manager
   */
  static async initialize() {
    try {
      console.log('🚀 Initializing Auth Manager...');

      // ตรวจสอบ session ที่มีอยู่
      await this.checkSession();

      // ตั้งค่า auth listener
      this.setupAuthListener();

      console.log('✅ Auth Manager initialized successfully');
      return true;

    } catch (error) {
      console.error('❌ Auth Manager initialization failed:', error);
      return false;
    }
  }

  /**
   * ล้างข้อมูลทั้งหมด
   */
  static cleanup() {
    this.currentUser = null;
    this.userProfile = null;
    this.authListeners = [];
  }
}

// ========================================
// UI HELPER FUNCTIONS
// ========================================

/**
 * อัพเดต UI ตาม auth state
 */
export function updateAuthUI() {
  const userData = AuthManager.getFullUserData();
  
  // อัพเดตข้อมูลผู้ใช้
  const userEmailEl = document.getElementById('user-email');
  if (userEmailEl) {
    userEmailEl.textContent = userData.user?.email || '—';
  }

  // อัพเดต role badge
  const roleBadgeEl = document.getElementById('role-badge');
  if (roleBadgeEl) {
    if (userData.isAdmin) {
      roleBadgeEl.textContent = 'ADMIN';
      roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-red-200 text-red-800';
    } else if (userData.isAuthenticated) {
      roleBadgeEl.textContent = 'USER';
      roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800';
    } else {
      roleBadgeEl.textContent = 'GUEST';
      roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-gray-200';
    }
  }

  // แสดง/ซ่อน login form
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.style.display = userData.isAuthenticated ? 'none' : 'block';
  }

  // แสดง/ซ่อนปุ่ม logout
  const logoutBtn = document.getElementById('btn-logout');
  if (logoutBtn) {
    logoutBtn.style.display = userData.isAuthenticated ? 'block' : 'none';
  }

  // แสดง/ซ่อนลิงก์ admin (เฉพาะ admin)
  const adminLinks = document.querySelectorAll('[href="/admin.html"]');
  adminLinks.forEach(link => {
    link.style.display = userData.isAdmin ? 'inline-block' : 'none';
  });
}

/**
 * จัดการ login form
 */
export function setupLoginForm() {
  const loginForm = document.querySelector('#login-form form');
  if (!loginForm) return;

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const email = document.getElementById('email')?.value;
    const password = document.getElementById('password')?.value;
    
    if (!email || !password) {
      alert('กรุณากรอกอีเมลและรหัสผ่าน');
      return;
    }

    // แสดง loading
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    const originalText = submitBtn.textContent;
    submitBtn.textContent = 'กำลังเข้าสู่ระบบ...';
    submitBtn.disabled = true;

    try {
      const result = await AuthManager.signInWithEmail(email, password);
      
      if (result.success) {
        // ล้างฟอร์ม
        loginForm.reset();
        updateAuthUI();
        
        // แสดงข้อความสำเร็จ
        showNotification('เข้าสู่ระบบสำเร็จ!', 'success');
        
      } else {
        showNotification(result.error, 'error');
      }
    } catch (error) {
      showNotification('เกิดข้อผิดพลาดในการเข้าสู่ระบบ', 'error');
    } finally {
      submitBtn.textContent = originalText;
      submitBtn.disabled = false;
    }
  });
}

/**
 * จัดการปุ่ม logout
 */
export function setupLogoutButton() {
  const logoutBtn = document.getElementById('btn-logout');
  if (!logoutBtn) return;

  logoutBtn.addEventListener('click', async (e) => {
    e.preventDefault();
    
    const originalText = logoutBtn.textContent;
    logoutBtn.textContent = 'กำลังออกจากระบบ...';
    logoutBtn.disabled = true;

    try {
      const result = await AuthManager.signOut();
      
      if (result.success) {
        updateAuthUI();
        showNotification('ออกจากระบบแล้ว', 'info');
      } else {
        showNotification(result.error, 'error');
      }
    } catch (error) {
      showNotification('เกิดข้อผิดพลาดในการออกจากระบบ', 'error');
    } finally {
      logoutBtn.textContent = originalText;
      logoutBtn.disabled = false;
    }
  });
}

/**
 * แสดงการแจ้งเตือน
 */
export function showNotification(message, type = 'info', duration = 3000) {
  // สร้าง notification element
  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  
  const colors = {
    success: 'bg-green-100 text-green-800 border-green-300',
    error: 'bg-red-100 text-red-800 border-red-300',
    info: 'bg-blue-100 text-blue-800 border-blue-300',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-300'
  };
  
  notification.className += ` ${colors[type] || colors.info} fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm`;
  notification.textContent = message;
  
  // เพิ่มใน DOM
  document.body.appendChild(notification);
  
  // ลบหลังจากเวลาที่กำหนด
  setTimeout(() => {
    notification.remove();
  }, duration);
}

// ========================================
// AUTO INITIALIZATION
// ========================================

// เริ่มต้น Auth Manager เมื่อโหลดหน้าเสร็จ
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', async () => {
      await AuthManager.initialize();
      updateAuthUI();
      setupLoginForm();
      setupLogoutButton();
      
      // เพิ่ม auth listener สำหรับอัพเดต UI อัตโนมัติ
      AuthManager.addAuthListener(() => {
        updateAuthUI();
      });
    });
  } else {
    // หากโหลดเสร็จแล้ว
    (async () => {
      await AuthManager.initialize();
      updateAuthUI();
      setupLoginForm();
      setupLogoutButton();
      
      AuthManager.addAuthListener(() => {
        updateAuthUI();
      });
    })();
  }
}