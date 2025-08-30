// การจัดการข้อผิดพลาดที่ปรับปรุงแล้วสำหรับแอป Loan App
class ErrorHandler {
  constructor() {
    this.setupGlobalErrorHandling();
  }

  // ตั้งค่าการจัดการข้อผิดพลาดทั่วไป
  setupGlobalErrorHandling() {
    // จัดการข้อผิดพลาด JavaScript ทั่วไป
    window.addEventListener('error', (event) => {
      console.error('Global error:', event.error);
      this.logError('JavaScript Error', event.error, event.filename, event.lineno);
    });

    // จัดการ unhandled promise rejections
    window.addEventListener('unhandledrejection', (event) => {
      console.error('Unhandled promise rejection:', event.reason);
      this.logError('Promise Rejection', event.reason);
    });
  }

  // บันทึกข้อผิดพลาด
  logError(type, error, filename = '', line = 0) {
    const errorInfo = {
      type: type,
      message: error.message || error,
      filename: filename,
      line: line,
      timestamp: new Date().toISOString(),
      userAgent: navigator.userAgent,
      url: window.location.href
    };

    // ส่งข้อผิดพลาดไปยัง logging service (เช่น Sentry, LogRocket)
    this.sendErrorToLoggingService(errorInfo);
  }

  // ส่งข้อผิดพลาดไปยัง logging service
  async sendErrorToLoggingService(errorInfo) {
    try {
      // แทนที่ด้วย logging service ของคุณ
      console.log('Error logged:', errorInfo);
      
      // ตัวอย่าง: ส่งไปยัง Supabase
      // await supabase
      //   .from('error_logs')
      //   .insert([errorInfo]);
    } catch (err) {
      console.error('Failed to log error:', err);
    }
  }

  // จัดการข้อผิดพลาด 404
  handle404Error(resource) {
    console.warn(`Resource not found (404): ${resource}`);
    
    // ไม่แสดงข้อผิดพลาดให้ผู้ใช้เห็นสำหรับ favicon และ resources ที่ไม่สำคัญ
    if (resource.includes('favicon') || resource.includes('apple-touch-icon')) {
      return;
    }

    // แสดงข้อความแจ้งเตือนสำหรับ resources ที่สำคัญ
    this.showUserFriendlyError('ไม่พบไฟล์ที่ต้องการ กรุณาลองใหม่อีกครั้ง');
  }

  // แสดงข้อผิดพลาดที่เป็นมิตรกับผู้ใช้
  showUserFriendlyError(message, duration = 5000) {
    // สร้าง toast notification
    const toast = document.createElement('div');
    toast.className = 'error-toast';
    toast.innerHTML = `
      <div class="toast-content">
        <span class="toast-icon">⚠️</span>
        <span class="toast-message">${message}</span>
        <button class="toast-close" onclick="this.parentElement.parentElement.remove()">×</button>
      </div>
    `;

    // เพิ่ม CSS styles
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 15px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      z-index: 10000;
      max-width: 400px;
      animation: slideIn 0.3s ease-out;
    `;

    // เพิ่ม CSS animation
    if (!document.getElementById('toast-styles')) {
      const style = document.createElement('style');
      style.id = 'toast-styles';
      style.textContent = `
        @keyframes slideIn {
          from { transform: translateX(100%); opacity: 0; }
          to { transform: translateX(0); opacity: 1; }
        }
        .toast-content {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .toast-close {
          background: none;
          border: none;
          color: white;
          font-size: 18px;
          cursor: pointer;
          margin-left: auto;
        }
      `;
      document.head.appendChild(style);
    }

    document.body.appendChild(toast);

    // ลบ toast หลังจากเวลาที่กำหนด
    setTimeout(() => {
      if (toast.parentElement) {
        toast.remove();
      }
    }, duration);
  }
}

// สร้าง instance ของ ErrorHandler
const errorHandler = new ErrorHandler();

// ฟังก์ชันจัดการข้อผิดพลาด Supabase เฉพาะ
class SupabaseErrorHandler {
  static handleAuthError(error) {
    console.error('Supabase Auth Error:', error);
    
    switch (error.code) {
      case 'invalid_credentials':
        return 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';
      
      case 'email_not_confirmed':
        return 'กรุณายืนยันอีเมลของคุณก่อนเข้าสู่ระบบ';
      
      case 'signup_disabled':
        return 'การลงทะเบียนถูกปิดใช้งานชั่วคราว';
      
      case 'weak_password':
        return 'รหัสผ่านของคุณไม่ปลอดภัยพอ กรุณาใช้รหัสผ่านที่แข็งแกร่งกว่านี้';
      
      case 'email_address_invalid':
        return 'รูปแบบอีเมลไม่ถูกต้อง';
      
      default:
        return 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ กรุณาลองใหม่อีกครั้ง';
    }
  }

  static handleDatabaseError(error) {
    console.error('Supabase Database Error:', error);
    
    if (error.code === 'PGRST116') {
      return 'ไม่มีข้อมูลที่ตรงกับเงื่อนไขที่ค้นหา';
    }
    
    if (error.code === '23505') {
      return 'ข้อมูลนี้มีอยู่ในระบบแล้ว';
    }
    
    return 'เกิดข้อผิดพลาดในการเข้าถึงฐานข้อมูล กรุณาลองใหม่อีกครั้ง';
  }
}

// ฟังก์ชันเพิ่มเติมสำหรับตรวจสอบสถานะเครือข่าย
function checkNetworkStatus() {
  if (!navigator.onLine) {
    errorHandler.showUserFriendlyError('ไม่มีการเชื่อมต่ออินเทอร์เน็ต กรุณาตรวจสอบการเชื่อมต่อของคุณ');
    return false;
  }
  return true;
}

// Event listeners สำหรับสถานะเครือข่าย
window.addEventListener('online', () => {
  console.log('เชื่อมต่ออินเทอร์เน็ตแล้ว');
});

window.addEventListener('offline', () => {
  errorHandler.showUserFriendlyError('การเชื่อมต่ออินเทอร์เน็ตขาดหาย บางฟีเจอร์อาจไม่ทำงาน', 10000);
});

// Export สำหรับใช้ในไฟล์อื่น
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { ErrorHandler, SupabaseErrorHandler, checkNetworkStatus };
}