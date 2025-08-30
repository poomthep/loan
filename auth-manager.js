/*! auth-manager.js (Global build, only user_profiles, no-async)
 * Loan App – Authentication Manager
 * ใช้กับ: <script defer src="/auth-manager.js"></script>
 * ต้องมี window.supabase (จาก supabase-init.js) โหลดก่อน
 */
(function (global) {
  'use strict';

  // -----------------------------
  // Helpers
  // -----------------------------
  function getClient() {
    var sb = global && global.supabase;
    if (!sb || typeof sb.from !== 'function') {
      throw new Error('Supabase client not initialized');
    }
    return sb;
  }

  function mapSupabaseError(err) {
    try {
      if (!err) return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
      if (typeof err === 'string') return err;
      if (err.message) return err.message;
      if (err.error_description) return err.error_description;
      if (err.error) return err.error;
      return JSON.stringify(err);
    } catch (e) {
      return 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ';
    }
  }

  function isTableMissing(err) {
    if (!err) return false;
    var code = err.code ? String(err.code) : '';
    if (code.indexOf('PGRST2') === 0) return true; // 404 series
    var msg = err.message ? String(err.message).toLowerCase() : '';
    if (msg.indexOf('could not find the table') !== -1) return true;
    return false;
  }

  // -----------------------------
  // AuthManager (Global)
  // -----------------------------
  var AuthManager = {
    _inited: false,
    _listenerUnsub: null,
    _profileTableMissing: false, // user_profiles เท่านั้น
    currentUser: null,
    userProfile: null,
    authListeners: [],

    // ========= AUTH =========
    signInWithEmail: function (email, password) {
      try {
        var sb = getClient();
        return sb.auth.signInWithPassword({
          email: (email || '').trim(),
          password: password
        }).then(function (res) {
          if (res.error) throw res.error;
          AuthManager.currentUser = (res.data && res.data.user) ? res.data.user : null;
          return AuthManager.loadUserProfile().then(function () {
            AuthManager._notify('SIGNED_IN', AuthManager.currentUser);
            try { console.log('✅ Sign in successful:', AuthManager.currentUser ? AuthManager.currentUser.email : ''); } catch (e) {}
            return { success: true, user: AuthManager.currentUser };
          });
        }).catch(function (err) {
          console.error('❌ Sign in error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    signUp: function (email, password, userData) {
      userData = userData || {};
      try {
        var sb = getClient();
        return sb.auth.signUp({
          email: (email || '').trim(),
          password: password,
          options: { data: { full_name: (email || '').split('@')[0] } }
        }).then(function (res) {
          if (res.error) throw res.error;
          return {
            success: true,
            user: (res.data && res.data.user) ? res.data.user : null,
            needConfirmation: !(res.data && res.data.session)
          };
        }).catch(function (err) {
          console.error('❌ Sign up error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    signOut: function () {
      try {
        var sb = getClient();
        return sb.auth.signOut().then(function (res) {
          if (res.error) throw res.error;
          AuthManager.currentUser = null;
          AuthManager.userProfile = null;
          AuthManager._notify('SIGNED_OUT', null);
          try { console.log('✅ Sign out successful'); } catch (e) {}
          return { success: true };
        }).catch(function (err) {
          console.error('❌ Sign out error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    resetPassword: function (email) {
      try {
        var sb = getClient();
        return sb.auth.resetPasswordForEmail((email || '').trim(), {
          redirectTo: global.location.origin + '/reset-password'
        }).then(function (res) {
          if (res.error) throw res.error;
          try { console.log('✅ Password reset email sent'); } catch (e) {}
          return { success: true };
        }).catch(function (err) {
          console.error('❌ Password reset error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    updatePassword: function (newPassword) {
      try {
        var sb = getClient();
        return sb.auth.updateUser({ password: newPassword }).then(function (res) {
          if (res.error) throw res.error;
          try { console.log('✅ Password updated successfully'); } catch (e) {}
          return { success: true };
        }).catch(function (err) {
          console.error('❌ Password update error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    // ===== PROFILE: ใช้เฉพาะ user_profiles =====
    loadUserProfile: function () {
      if (!AuthManager.currentUser) return Promise.resolve(null);
      if (AuthManager._profileTableMissing) return Promise.resolve(null);

      var sb = getClient();
      return sb.from('user_profiles')
        .select('*')
        .eq('id', AuthManager.currentUser.id)
        .limit(1)
        .maybeSingle()    // ไม่พบ → data:null ไม่ error 406
        .then(function (res) {
          if (res.error) throw res.error;
          AuthManager.userProfile = res.data || null;
          return AuthManager.userProfile;
        })
        .catch(function (err) {
          if (isTableMissing(err)) {
            // ไม่มีตารางนี้ → ทำเครื่องหมายและหยุดยิงซ้ำ
            AuthManager._profileTableMissing = true;
            return null;
          }
          if ((err && (err.status === 406 || String(err.code) === '406')) || (err && err.code === 'PGRST116')) {
            return null;
          }
          console.error('Error loading user_profiles:', err);
          return null;
        });
    },

    updateUserProfile: function (updates) {
      if (!AuthManager.currentUser) {
        return Promise.reject(new Error('ต้องเข้าสู่ระบบก่อน'));
      }
      if (AuthManager._profileTableMissing) {
        return Promise.resolve({ success: false, error: 'ยังไม่ได้สร้างตาราง user_profiles ในฐานข้อมูล' });
      }

      var sb = getClient();
      return sb.from('user_profiles').upsert(
        Object.assign({ id: AuthManager.currentUser.id }, updates, {
          updated_at: new Date().toISOString()
        })
      ).select('*')
       .maybeSingle()
       .then(function (res) {
         if (res.error) throw res.error;
         if (!res.data) {
           return { success: false, error: 'ไม่สามารถอัปเดตโปรไฟล์ (อาจโดน RLS บล็อก)' };
         }
         AuthManager.userProfile = res.data;
         AuthManager._notify('PROFILE_UPDATED', res.data);
         try { console.log('✅ Profile updated (user_profiles)'); } catch (e) {}
         return { success: true, profile: res.data };
       })
       .catch(function (err) {
         if (isTableMissing(err)) {
           AuthManager._profileTableMissing = true;
           return { success: false, error: 'ยังไม่ได้สร้างตาราง user_profiles ในฐานข้อมูล' };
         }
         console.error('❌ Profile update error:', err);
         return { success: false, error: mapSupabaseError(err) };
       });
    },

    // ===== SESSION =====
    checkSession: function () {
      try {
        var sb = getClient();
        return sb.auth.getSession().then(function (res) {
          if (res.error) throw res.error;
          return (res.data && res.data.session) ? res.data.session : null;
        }).catch(function (err) {
          console.error('Error checking session:', err);
          return null;
        });
      } catch (e) {
        console.error('Error checking session:', e);
        return Promise.resolve(null);
      }
    },

    _setupAuthListener: function () {
      try {
        var sb = getClient();
        var ret = sb.auth.onAuthStateChange(function (event, session) {
          try { console.log('🔐 Auth state changed:', event); } catch (e) {}
          var user = (session && session.user) ? session.user : null;

          if (event === 'SIGNED_IN') {
            AuthManager.currentUser = user;
            AuthManager.loadUserProfile().then(function () {
              AuthManager._notify(event, user);
              updateAuthUI();
            });
          } else if (event === 'SIGNED_OUT') {
            AuthManager.currentUser = null;
            AuthManager.userProfile = null;
            AuthManager._notify(event, null);
            updateAuthUI();
          } else {
            AuthManager.currentUser = user;
            AuthManager._notify(event, user);
            updateAuthUI();
          }
        });

        AuthManager._listenerUnsub =
          (ret && ret.data && ret.data.subscription)
            ? function () { try { ret.data.subscription.unsubscribe(); } catch (e) {} }
            : null;

      } catch (e) {
        console.error('Auth listener setup failed:', e);
      }
    },

    addAuthListener: function (fn) {
      if (typeof fn === 'function') AuthManager.authListeners.push(fn);
    },

    removeAuthListener: function (fn) {
      var i = AuthManager.authListeners.indexOf(fn);
      if (i > -1) AuthManager.authListeners.splice(i, 1);
    },

    _notify: function (event, user) {
      for (var i = 0; i < AuthManager.authListeners.length; i++) {
        try { AuthManager.authListeners[i](event, user, AuthManager.userProfile); }
        catch (e) { console.error('Error in auth listener:', e); }
      }
    },

    isAuthenticated: function () { return !!AuthManager.currentUser; },
    isAdmin: function () {
      var p = AuthManager.userProfile || {};
      // ใช้ role จาก user_profiles เท่านั้น
      return !!(p.role && String(p.role).toLowerCase() === 'admin');
    },
    getCurrentUser: function () { return AuthManager.currentUser; },
    getUserProfile: function () { return AuthManager.userProfile; },
    getFullUserData: function () {
      return {
        user: AuthManager.currentUser,
        profile: AuthManager.userProfile,
        isAuthenticated: AuthManager.isAuthenticated(),
        isAdmin: AuthManager.isAdmin()
      };
    },

    cleanup: function () {
      if (AuthManager._listenerUnsub) { try { AuthManager._listenerUnsub(); } catch (e) {} }
      AuthManager._inited = false;
      AuthManager.currentUser = null;
      AuthManager.userProfile = null;
      AuthManager.authListeners = [];
    },

    // ===== INIT =====
    initialize: function () {
      if (AuthManager._inited) return Promise.resolve(AuthManager.currentUser);
      try {
        var sb = getClient();
        AuthManager._setupAuthListener();
        return sb.auth.getSession().then(function (res) {
          if (res.error) throw res.error;
          var session = (res.data && res.data.session) ? res.data.session : null;
          AuthManager.currentUser = session ? session.user : null;
          return AuthManager.loadUserProfile().then(function () {
            AuthManager._inited = true;
            updateAuthUI();
            return session;
          });
        }).catch(function (err) {
          console.error('Auth Manager initialization failed:', err);
          updateAuthUI();
          return null;
        });
      } catch (e) {
        console.error('Auth Manager initialization failed:', e);
        updateAuthUI();
        return Promise.resolve(null);
      }
    }
  };

  // -----------------------------
  // UI helpers
  // -----------------------------
  function updateAuthUI() {
    var data = AuthManager.getFullUserData();

    var userEmailEl = document.getElementById('user-email');
    if (userEmailEl) userEmailEl.textContent = (data.user && data.user.email) ? data.user.email : '—';

    var roleBadgeEl = document.getElementById('role-badge');
    if (roleBadgeEl) {
      if (data.isAdmin) {
        roleBadgeEl.textContent = 'ADMIN';
        roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-red-200 text-red-800';
      } else if (data.isAuthenticated) {
        roleBadgeEl.textContent = 'USER';
        roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-green-200 text-green-800';
      } else {
        roleBadgeEl.textContent = 'GUEST';
        roleBadgeEl.className = 'badge px-2 py-1 rounded-full text-xs font-semibold bg-gray-200';
      }
    }

    var loginFormWrap = document.getElementById('login-form');
    if (loginFormWrap) loginFormWrap.style.display = data.isAuthenticated ? 'none' : 'block';

    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = data.isAuthenticated ? 'block' : 'none';

    var adminLinks = document.querySelectorAll('[href="/admin.html"], [href="./admin.html"]');
    for (var i = 0; i < adminLinks.length; i++) {
      adminLinks[i].style.display = data.isAdmin ? 'inline-block' : 'none';
    }

    try {
      var emailEl = document.getElementById('email');
      var passEl = document.getElementById('password');
      if (emailEl && !emailEl.getAttribute('autocomplete')) emailEl.setAttribute('autocomplete', 'username');
      if (passEl && !passEl.getAttribute('autocomplete')) passEl.setAttribute('autocomplete', 'current-password');
    } catch (e) {}
  }

  function setupLoginForm() {
    var form = document.querySelector('#login-form form') || document.getElementById('login-form');
    if (!form || form.tagName.toLowerCase() !== 'form') return;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = document.getElementById('email') ? document.getElementById('email').value : '';
      var password = document.getElementById('password') ? document.getElementById('password').value : '';
      if (!email || !password) { showNotification('กรุณากรอกอีเมลและรหัสผ่าน', 'warning'); return; }

      var btn = form.querySelector('button[type="submit"]');
      var original = btn ? btn.textContent : '';
      if (btn) { btn.textContent = 'กำลังเข้าสู่ระบบ...'; btn.disabled = true; }

      AuthManager.signInWithEmail(email, password).then(function (res) {
        if (res && res.success) {
          try { form.reset(); } catch (e) {}
          updateAuthUI();
          showNotification('เข้าสู่ระบบสำเร็จ!', 'success');
        } else {
          showNotification((res && res.error) ? res.error : 'เข้าสู่ระบบไม่สำเร็จ', 'error');
        }
      }).finally(function () {
        if (btn) { btn.textContent = original; btn.disabled = false; }
      });
    });
  }

  function setupLogoutButton() {
    var btn = document.getElementById('btn-logout');
    if (!btn) return;
    btn.addEventListener('click', function (e) {
      e.preventDefault();
      var original = btn.textContent;
      btn.textContent = 'กำลังออกจากระบบ...';
      btn.disabled = true;

      AuthManager.signOut().then(function (res) {
        if (res && res.success) {
          updateAuthUI();
          showNotification('ออกจากระบบแล้ว', 'info');
        } else {
          showNotification((res && res.error) ? res.error : 'ออกจากระบบไม่สำเร็จ', 'error');
        }
      }).finally(function () {
        btn.textContent = original;
        btn.disabled = false;
      });
    });
  }

  function showNotification(message, type, duration) {
    type = type || 'info';
    duration = (typeof duration === 'number') ? duration : 3000;

    var classes = {
      success: 'bg-green-100 text-green-800 border-green-300',
      error:   'bg-red-100 text-red-800 border-red-300',
      info:    'bg-blue-100 text-blue-800 border-blue-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };

    var n = document.createElement('div');
    n.className = 'notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm ' + (classes[type] || classes.info);
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(function () { try { n.remove(); } catch (e) {} }, duration);
  }

  // -----------------------------
  // Expose & Auto-init
  // -----------------------------
  global.AuthManager = AuthManager;
  global.updateAuthUI = updateAuthUI;
  global.setupLoginForm = setupLoginForm;
  global.setupLogoutButton = setupLogoutButton;
  global.showNotification = showNotification;

  try { console.info('[AuthManager] ready:', !!global.AuthManager); } catch (e) {}

  if (!global.__AUTH_INIT_MANUAL__) {
    function runInit() {
      AuthManager.initialize().then(function () {
        updateAuthUI();
        setupLoginForm();
        setupLogoutButton();
        AuthManager.addAuthListener(function () { updateAuthUI(); });
      });
    }
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', runInit);
    } else {
      runInit();
    }
  }

})(typeof window !== 'undefined' ? window : this);
