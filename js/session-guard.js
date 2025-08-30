// js/session-guard.js
// ========================================
// SESSION GUARD - Legacy Compatibility
// ========================================

/**
 * Session Guard สำหรับ backward compatibility
 * ระบบใหม่ใช้ AuthManager แทน แต่เก็บไว้เพื่อไม่ให้ error
 */

export function startSessionGuard() {
  console.log('🔐 Session Guard started (legacy compatibility mode)');
  console.log('💡 Using AuthManager for actual session management');
  
  // ไม่ทำอะไรจริงๆ เพราะ AuthManager จัดการให้หมดแล้ว
  return true;
}

/**
 * Check session status (legacy function)
 */
export function checkSession() {
  // ถ้ามี AuthManager ให้ใช้แทน
  if (typeof window !== 'undefined' && window.AuthManager) {
    return window.AuthManager.isAuthenticated();
  }
  
  // Fallback: ตรวจสอบจาก localStorage
  return !!localStorage.getItem('loan_session_id');
}

/**
 * Get current user (legacy function)
 */
export function getCurrentUser() {
  if (typeof window !== 'undefined' && window.AuthManager) {
    return window.AuthManager.getCurrentUser();
  }
  
  return null;
}

/**
 * Session timeout handler (legacy)
 */
export function handleSessionTimeout() {
  console.warn('Session timeout handled by AuthManager');
  
  if (typeof window !== 'undefined' && window.AuthManager) {
    window.AuthManager.signOut();
  }
}

// Export for backward compatibility
export default {
  startSessionGuard,
  checkSession,
  getCurrentUser,
  handleSessionTimeout
};