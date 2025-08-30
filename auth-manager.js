/*! auth-manager.js (Global build, no-async)
 * Loan App – Authentication Manager
 * ใช้กับ: <script defer src="/auth-manager.js"></script>
 * ต้องมี window.supabase (จาก supabase-init.js) โหลดมาก่อน
 */
(function (global) {
  'use strict';

  // ---------------------------------
  // Helpers
  // ---------------------------------
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
    // PGRST20x / 404 จาก PostgREST หรือข้อความ "Could not find the table ..."
    return !!(err && (
      (err.code && String(err.code).startsWith('PGRST2')) ||
      (err.message && /Could not find the table/i.test(err.message))
    ));
  }

  // ---------------------------------
  // AuthManager (Global object)
  // ---------------------------------
  var AuthManager = {
    _inited: false,
    _listenerUnsub: null,
    _profileTablesMissing: { profiles: false, user_profiles: false },
    currentUser: null,
    userProfile: null,
    authListeners: [],

    // ========== AUTH METHODS ==========
    signInWithEmail: function (email, password) {
      try {
        var sb = getClient();
        return sb.auth.signInWithPassword({
          email: (email || '').trim(),
          password: password
        }).then(function (res) {
          if (res.error) throw res.error;
          AuthManager.currentUser = res.data && res.data.user || null;
          return AuthManager.loadUserProfile().then(function () {
            AuthManager._notify('SIGNED_IN', AuthManager.currentUser);
            console.log('✅ Sign in successful:', AuthManager.currentUser && AuthManager.currentUser.email);
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
          options: {
            data: Object.assign({ full_name: (email || '').split('@')[0] }, userData)
          }
        }).then(function (res) {
          if (res.error) throw res.error;
          console.log('✅ Sign up successful:', res.data && res.data.user && res.data.user.email);
          return {
            success: true,
            user: res.data && res.data.user || null,
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
          console.log('✅ Sign out successful');
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
          console.log('✅ Password reset email sent');
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
          console.log('✅ Password updated successfully');
          return { success: true };
        }).catch(function (err) {
          console.error('❌ Password update error:', err);
          return { success: false, error: mapSupabaseError(err) };
        });
      } catch (e) {
        return Promise.resolve({ success: false, error: mapSupabaseError(e) });
      }
    },

    // ======= USER PROFILE METHODS =======
    // โหลดโปรไฟล์แบบ "ทน 404" (ไม่มีตารางก็ไม่พัง/ไม่ยิงซ้ำ)
    loadUserProfile: function () {
      if (!AuthManager.currentUser) return Promise.resolve(null);

      var sb = getClient();

      function tryProfiles() {
        if (AuthManager._profileTablesMissing.profiles) return Promise.resolve(null);
        return sb.from('profiles')
          .select('*')
          .eq('user_id', AuthManager.currentUser.id)
          .single()
          .then(function (res) {
            if (res.error) throw res.error;
            return res.data || null;
          })
          .catch(function (err) {
            if (isTableMissing(err)) {
              AuthManager._profileTablesMissing.profiles = true;
              return null;
            }
            if (err && err.code === 'PGRST116') return null; // row not found
            console.error('Error loading profiles:', err);
            return null;
          });
      }

      function tryUserProfiles() {
        if (AuthManager._profileTablesMissing.user_profiles) return Promise.resolve(null);
        return sb.from('user_profiles')
          .select('*')
          .eq('id', AuthManager.currentUser.id)
          .single()
          .then(function (res) {
            if (res.error) throw res.error;
            return res.data || null;
          })
          .catch(function (err) {
            if (isTableMissing(err)) {
              AuthManager._profileTablesMissing.user_profiles = true;
              return null;
            }
            if (err && err.code === 'PGRST116') return null; // row not found
            console.error('Error loading user_profiles:', err);
            return null;
          });
      }

      return tryProfiles().then(function (p) {
        if (p) {
          AuthManager.userProfile = p;
          return p;
        }
        return tryUserProfiles().then(function (up) {
          AuthManager.userProfile = up || null;
          return AuthManager.userProfile;
        });
      });
    },

    // อัปเดตโปรไฟล์แบบ "ทน 404" (ถ้าไม่มีตารางจะไม่พัง)
    updateUserProfile: function (updates) {
      if (!AuthManager.currentUser) {
        return Promise.reject(new Error('ต้องเข้าสู่ระบบก่อน'));
      }

      var sb = getClient();

      function upsertProfiles() {
        if (AuthManager._profileTablesMissing.profiles) return Promise.resolve(null);
        return sb.from('profiles').upsert(
          Object.assign({ user_id: AuthManager.currentUser.id }, updates, {
            updated_at: new Date().toISOString()
          })
        ).select('*').single().then(function (res) {
          if (res.error) throw res.error;
          return res.data || null;
        }).catch(function (err) {
          if (isTableMissing(err)) {
            AuthManager._profileTablesMissing.profiles = true;
            return null;
          }
          throw err;
        });
      }

      function upsertUserProfiles() {
        if (AuthManager._profileTablesMissing.user_profiles) return Promise.resolve(null);
        return sb.from('user_profiles').upsert(
          Object.assign({ id: AuthManager.currentUser.id }, updates, {
            updated_at: new Date().toISOString()
          })
        ).select('*').single().then(function (res) {
          if (res.error) throw res.error;
          return res.data || null;
        }).catch(function (err) {
          if (isTableMissing(err)) {
            AuthManager._profileTablesMissing.user_profiles = true;
            return null;
          }
          throw err;
        });
      }

      return upsertProfiles().then(function (p) {
        if (p) {
          AuthManager.userProfile = p;
          AuthManager._notify('PROFILE_UPDATED', p);
          console.log('✅ Profile updated (profiles)');
          return { success: true, profile: p };
        }
        return upsertUserProfiles().then(function (up) {
          if (up) {
            AuthManager.userProfile = up;
            AuthManager._notify('PROFILE_UPDATED', up);
            console.log('✅ Profile updated (user_profiles)');
            return { success: true, profile: up };
          }
          return {
            success: false,
            error: 'ยังไม่ได้สร้างตารางโปรไฟล์ (profiles หรือ user_profiles) ในฐานข้อมูล'
          };
        });
      }).catch(function (err) {
        console.error('❌ Profile update error:', err);
        return { success: false, error: mapSupabaseError(err) };
      });
    },

    // ===== SESSION & STATE MANAGEMENT ====
    checkSession: function () {
      try {
        var sb = getClient();
        return sb.auth.getSession().then(function (res) {
          if (res.error) throw res.error;
          return (res.data && res.data.session) || null;
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
          console.log('🔐 Auth state changed:', event);
          var user = session && session.user || null;

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
            // TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY ฯลฯ
            AuthManager.currentUser = user;
            AuthManager._notify(event, user);
            updateAuthUI();
          }
        });

        // v2 -> { data: { subscription } }
        AuthManager._listenerUnsub = ret && ret.data && ret.data.subscription
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
      // รองรับทั้ง profiles.is_admin (boolean) และ user_profiles.role === 'admin'
      return !!(p.is_admin || p.isAdmin || (p.role && String(p.role).toLowerCase() === 'admin'));
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

    // ============ INITIALIZE ============
    initialize: function () {
      if (AuthManager._inited) return Promise.resolve(AuthManager.currentUser);
      try {
        var sb = getClient();
        AuthManager._setupAuthListener();
        return sb.auth.getSession().then(function (res) {
          if (res.error) throw res.error;
          var session = res.data && res.data.session || null;
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

  // ---------------------------------
  // UI helpers (global functions)
  // ---------------------------------
  function updateAuthUI() {
    var data = AuthManager.getFullUserData();

    // อีเมลผู้ใช้
    var userEmailEl = document.getElementById('user-email');
    if (userEmailEl) userEmailEl.textContent = (data.user && data.user.email) || '—';

    // role badge
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

    // แสดง/ซ่อน login form
    var loginFormWrap = document.getElementById('login-form');
    if (loginFormWrap) loginFormWrap.style.display = data.isAuthenticated ? 'none' : 'block';

    // ปุ่ม logout
    var logoutBtn = document.getElementById('btn-logout');
    if (logoutBtn) logoutBtn.style.display = data.isAuthenticated ? 'block' : 'none';

    // ลิงก์ admin (เฉพาะ admin)
    var adminLinks = document.querySelectorAll('[href="/admin.html"], [href="./admin.html"]');
    for (var i = 0; i < adminLinks.length; i++) {
      adminLinks[i].style.display = data.isAdmin ? 'inline-block' : 'none';
    }

    // เติม autocomplete ให้ช่องรหัสผ่านตามคำเตือน DOM
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
      var email = document.getElementById('email') && document.getElementById('email').value;
      var password = document.getElementById('password') && document.getElementById('password').value;
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
          showNotification(res && res.error || 'เข้าสู่ระบบไม่สำเร็จ', 'error');
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
          showNotification(res && res.error || 'ออกจากระบบไม่สำเร็จ', 'error');
        }
      }).finally(function () {
        btn.textContent = original;
        btn.disabled = false;
      });
    });
  }

  function showNotification(message, type, duration) {
    type = type || 'info';
    duration = typeof duration === 'number' ? duration : 3000;

    var colors = {
      success: 'bg-green-100 text-green-800 border-green-300',
      error:   'bg-red-100 text-red-800 border-red-300',
      info:    'bg-blue-100 text-blue-800 border-blue-300',
      warning: 'bg-yellow-100 text-yellow-800 border-yellow-300'
    };

    var n = document.createElement('div');
    n.className = 'notification fixed top-4 right-4 px-4 py-2 rounded border z-50 max-w-sm ' + (colors[type] || colors.info);
    n.textContent = message;
    document.body.appendChild(n);
    setTimeout(function () { try { n.remove(); } catch (e) {} }, duration);
  }

  // ---------------------------------
  // Expose globals
  // ---------------------------------
  global.AuthManager = AuthManager;
  global.updateAuthUI = updateAuthUI;
  global.setupLoginForm = setupLoginForm;
  global.setupLogoutButton = setupLogoutButton;
  global.showNotification = showNotification;

  console.info('[AuthManager] ready:', !!global.AuthManager);

  // Auto-init (ถ้าไม่ได้สั่งให้ manual)
  if (!global.__AUTH_INIT_MANUAL__) {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', function () {
        AuthManager.initialize().then(function () {
          updateAuthUI(); setupLoginForm(); setupLogoutButton();
          AuthManager.addAuthListener(function () { updateAuthUI(); });
        });
      });
    } else {
      AuthManager.initialize().then(function () {
        updateAuthUI(); setupLoginForm(); setupLogoutButton();
        AuthManager.addAuthListener(function () { updateAuthUI(); });
      });
    }
  }

})(typeof window !== 'undefined' ? window : this);
