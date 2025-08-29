// js/supabase-client.js
// ========================================
// SUPABASE CLIENT CONFIGURATION - UPDATED
// ========================================

// 🔧 กำหนดค่าการเชื่อมต่อ Supabase
// ⚠️ กรุณาแทนที่ค่าด้านล่างด้วยข้อมูลจาก Supabase Dashboard ของคุณ
const SUPABASE_CONFIG = {
  // 👉 ไปที่ https://supabase.com/dashboard/project/[your-project]/settings/api
  url: 'https://kpsferwaplnkzrbqoghv.supabase.co', // Project URL
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imtwc2ZlcndhcGxua3pyYnFvZ2h2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTU1MTI1NjUsImV4cCI6MjA3MTA4ODU2NX0.FizC7Ia92dqvbtfuU5T3hymh-UX6OEqQRvQnB0oY96Y', // anon/public key (ยาวมาก)
  
  // การตั้งค่าเพิ่มเติม
  options: {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    realtime: {
      params: {
        eventsPerSecond: 10
      }
    }
  }
};

// 📋 วิธีการ Setup Supabase:
// 1. ไปที่ https://supabase.com และสร้าง Project ใหม่
// 2. รอให้ Database สร้างเสร็จ (ประมาณ 2-3 นาที)
// 3. ไปที่ Settings > API และคัดลอก:
//    - Project URL (ใส่ในตัวแปร url)
//    - anon public key (ใส่ในตัวแปร anonKey)
// 4. ไปที่ SQL Editor และรัน SQL จากไฟล์ supabase_setup_sql
// 5. แทนที่ค่าในไฟล์นี้และเริ่มใช้งาน

// สร้าง Supabase client instance
let supabase;

try {
  if (typeof window !== 'undefined' && window.supabase) {
    // ใช้ supabase จาก CDN
    supabase = window.supabase.createClient(
      SUPABASE_CONFIG.url,
      SUPABASE_CONFIG.anonKey,
      SUPABASE_CONFIG.options
    );
    
    console.log('✅ Supabase client initialized');
  } else {
    console.error('❌ Supabase library not loaded. Please include it in your HTML:');
    console.error('<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>');
  }
} catch (error) {
  console.error('❌ Failed to initialize Supabase client:', error);
}

// ========================================
// QUICK SETUP GUIDE
// ========================================

/**
 * 🚀 คู่มือ Setup อย่างรวดเร็ว
 * 
 * ขั้นตอนที่ 1: สร้าง Supabase Project
 * 1. ไปที่ https://supabase.com และ Sign up/Login
 * 2. กด "New project"
 * 3. เลือก Organization และตั้งชื่อ Project
 * 4. เลือก Region (แนะนำ Southeast Asia)
 * 5. ตั้ง Database Password (จำไว้ให้ดี)
 * 6. กด "Create new project" และรอ 2-3 นาที
 * 
 * ขั้นตอนที่ 2: รัน Database Schema
 * 1. ไปที่ Dashboard > SQL Editor
 * 2. คัดลอก SQL จากไฟล์ supabase_setup_sql
 * 3. Paste และกด "Run"
 * 4. ตรวจสอบว่าไม่มี Error
 * 
 * ขั้นตอนที่ 3: ดึง API Keys
 * 1. ไปที่ Settings > API
 * 2. คัดลอก Project URL
 * 3. คัดลอก anon public key
 * 
 * ขั้นตอนที่ 4: อัพเดตไฟล์นี้
 * 1. แทนที่ SUPABASE_CONFIG.url ด้วย Project URL
 * 2. แทนที่ SUPABASE_CONFIG.anonKey ด้วย anon key
 * 3. Save และ refresh หน้าเว็บ
 * 
 * ขั้นตอนที่ 5: ทดสอบ
 * 1. เปิด Browser Console (F12)
 * 2. พิมพ์: testSupabaseConnection()
 * 3. ควรเห็นข้อความ "✅ Supabase connection successful"
 */

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * ตรวจสอบการเชื่อมต่อกับ Supabase
 */
export async function testSupabaseConnection() {
  try {
    console.log('🔍 Testing Supabase connection...');
    
    // ตรวจสอบ client
    if (!supabase) {
      throw new Error('Supabase client not initialized');
    }
    
    // ทดสอบการเชื่อมต่อ Database
    const { data, error } = await supabase
      .from('banks')
      .select('count')
      .limit(1);
    
    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }
    
    console.log('✅ Supabase connection successful');
    console.log('🏦 Database accessible');
    
    return true;
    
  } catch (error) {
    console.error('❌ Supabase connection failed:');
    console.error('Error:', error.message);
    console.error('');
    console.error('🛠️ Troubleshooting:');
    console.error('1. Check if URL and API key are correct');
    console.error('2. Make sure database schema is created');
    console.error('3. Verify RLS policies are set up');
    console.error('4. Check browser network tab for errors');
    
    return false;
  }
}

/**
 * ดึงข้อมูลผู้ใช้ปัจจุบัน
 */
export async function getCurrentUser() {
  try {
    if (!supabase) return null;
    
    const { data: { user }, error } = await supabase.auth.getUser();
    if (error) throw error;
    
    return user;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * ดึง session ID สำหรับ guest users
 */
export function getSessionId() {
  let sessionId = localStorage.getItem('loan_session_id');
  if (!sessionId) {
    sessionId = 'guest_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    localStorage.setItem('loan_session_id', sessionId);
  }
  return sessionId;
}

/**
 * จัดการ error responses
 */
export function handleSupabaseError(error) {
  console.error('Supabase error:', error);
  
  // Error messages mapping
  const errorMessages = {
    'Invalid API key': 'การตั้งค่า API key ไม่ถูกต้อง - กรุณาตรวจสอบ anon key',
    'Row level security': 'ไม่มีสิทธิ์เข้าถึงข้อมูล - ตรวจสอบ RLS policies',
    'duplicate key': 'ข้อมูลซ้ำ - มีข้อมูลนี้อยู่แล้ว',
    'foreign key': 'ข้อมูลอ้างอิงไม่ถูกต้อง - ตรวจสอบความสัมพันธ์ของข้อมูล',
    'not found': 'ไม่พบข้อมูล - ตารางหรือข้อมูลไม่มีอยู่',
    'Network error': 'ปัญหาการเชื่อมต่อเครือข่าย - ตรวจสอบอินเทอร์เน็ต',
    'connection': 'ไม่สามารถเชื่อมต่อ Supabase ได้ - ตรวจสอบ URL',
    'JWT': 'ปัญหาการยืนยันตัวตน - ลองเข้าสู่ระบบใหม่'
  };
  
  // หาข้อความ error ที่เหมาะสม
  for (const [key, message] of Object.entries(errorMessages)) {
    if (error.message?.toLowerCase().includes(key.toLowerCase())) {
      return message;
    }
  }
  
  // Default error message
  return error.message || 'เกิดข้อผิดพลาดไม่ทราบสาเหตุ';
}

/**
 * Retry mechanism สำหรับ requests ที่ล้มเหลว
 */
export async function retrySupabaseRequest(requestFn, maxRetries = 3, delay = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await requestFn();
    } catch (error) {
      lastError = error;
      console.warn(`🔄 Request attempt ${i + 1}/${maxRetries} failed:`, error.message);
      
      if (i < maxRetries - 1) {
        console.log(`⏳ Retrying in ${delay * (i + 1)}ms...`);
        await new Promise(resolve => setTimeout(resolve, delay * (i + 1)));
      }
    }
  }
  
  throw lastError;
}

/**
 * ตรวจสอบสถานะการเชื่อมต่อ
 */
export function setupConnectionMonitor() {
  if (typeof window === 'undefined') return;
  
  // ตรวจสอบการเชื่อมต่ออินเทอร์เน็ต
  window.addEventListener('online', () => {
    console.log('🌐 Internet connection restored');
    testSupabaseConnection();
  });
  
  window.addEventListener('offline', () => {
    console.warn('📴 Internet connection lost');
  });
  
  // ทดสอบการเชื่อมต่อ Supabase ทุก 5 นาที
  setInterval(async () => {
    if (navigator.onLine) {
      const connected = await testSupabaseConnection();
      if (!connected) {
        console.warn('🔄 Supabase connection lost, check your configuration');
      }
    }
  }, 5 * 60 * 1000);
}

// ========================================
// CONFIGURATION VALIDATION
// ========================================

/**
 * ตรวจสอบการตั้งค่า
 */
function validateConfiguration() {
  const issues = [];
  
  // ตรวจสอบ URL
  if (SUPABASE_CONFIG.url === 'https://your-project-id.supabase.co') {
    issues.push('❌ Project URL ยังไม่ได้อัพเดต - กรุณาใส่ URL จริงจาก Supabase Dashboard');
  }
  
  // ตรวจสอบ API Key
  if (SUPABASE_CONFIG.anonKey.startsWith('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...')) {
    issues.push('❌ API Key ยังไม่ได้อัพเดต - กรุณาใส่ anon key จริงจาก Supabase Dashboard');
  }
  
  // ตรวจสอบ URL format
  if (!SUPABASE_CONFIG.url.includes('.supabase.co')) {
    issues.push('⚠️ URL format อาจไม่ถูกต้อง - ต้องเป็น https://xxx.supabase.co');
  }
  
  // ตรวจสอบ API Key format
  if (!SUPABASE_CONFIG.anonKey.startsWith('eyJ')) {
    issues.push('⚠️ API Key format อาจไม่ถูกต้อง - ต้องขึ้นต้นด้วย eyJ');
  }
  
  if (issues.length > 0) {
    console.warn('🔧 Configuration Issues Found:');
    issues.forEach(issue => console.warn(issue));
    console.warn('');
    console.warn('📚 Setup Guide: https://supabase.com/docs/guides/getting-started');
    return false;
  }
  
  return true;
}

// ========================================
// EXPORT SUPABASE CLIENT
// ========================================

export default supabase;

// สำหรับ backward compatibility
export { supabase };

// ========================================
// INITIALIZATION
// ========================================

// ตรวจสอบการตั้งค่าและเริ่ม connection monitor เมื่อโหลดเสร็จ
if (typeof window !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const configValid = validateConfiguration();
      if (configValid) {
        setupConnectionMonitor();
        testSupabaseConnection();
      }
    });
  } else {
    const configValid = validateConfiguration();
    if (configValid) {
      setupConnectionMonitor();
      testSupabaseConnection();
    }
  }
}

// ========================================
// DEVELOPMENT HELPERS
// ========================================

// เฉพาะใน development mode
if (typeof window !== 'undefined' && (
  window.location.hostname === 'localhost' || 
  window.location.hostname === '127.0.0.1' ||
  window.location.hostname.includes('local')
)) {
  // Export supabase client ไปยัง window object สำหรับ debugging
  window.supabaseClient = supabase;
  
  // Helper functions สำหรับ console testing
  window.testSupabaseConnection = testSupabaseConnection;
  
  window.testSupabaseQuery = async (table, query = {}) => {
    try {
      console.log(`🔍 Testing query on ${table}:`, query);
      
      if (!supabase) {
        throw new Error('Supabase client not initialized');
      }
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(5);
        
      if (error) throw error;
      
      console.log('✅ Query result:', data);
      console.log(`📊 Found ${data.length} records`);
      
      return data;
    } catch (error) {
      console.error('❌ Query failed:', error.message);
      return null;
    }
  };
  
  window.checkSupabaseStatus = async () => {
    console.log('🔍 Checking Supabase status...');
    console.log('URL:', SUPABASE_CONFIG.url);
    console.log('API Key (first 20 chars):', SUPABASE_CONFIG.anonKey.substring(0, 20) + '...');
    
    try {
      const { data, error } = await supabase.auth.getSession();
      console.log('Auth session:', data.session ? 'Active' : 'None');
      
      const connected = await testSupabaseConnection();
      console.log('Database connection:', connected ? 'OK' : 'Failed');
      
      return { auth: !!data.session, database: connected };
    } catch (error) {
      console.error('Status check failed:', error);
      return { auth: false, database: false };
    }
  };
  
  // Quick setup commands
  window.quickSetupGuide = () => {
    console.log('%c🚀 Supabase Quick Setup Guide', 'color: #00ff00; font-size: 16px; font-weight: bold;');
    console.log('');
    console.log('1️⃣ Create Project: https://supabase.com/dashboard');
    console.log('2️⃣ Get API Keys: Project Settings > API');
    console.log('3️⃣ Run SQL Schema: Copy from supabase_setup_sql artifact');
    console.log('4️⃣ Update Config: Edit js/supabase-client.js');
    console.log('5️⃣ Test Connection: testSupabaseConnection()');
    console.log('');
    console.log('%cCommands Available:', 'color: #ffff00; font-weight: bold;');
    console.log('• testSupabaseConnection() - Test database connection');
    console.log('• testSupabaseQuery("table_name") - Test table query');
    console.log('• checkSupabaseStatus() - Check overall status');
    console.log('• quickSetupGuide() - Show this guide');
  };
  
  console.log('🔧 Development mode: Supabase helpers loaded');
  console.log('💡 Type quickSetupGuide() for setup instructions');
  console.log('🧪 Type checkSupabaseStatus() to verify setup');
}

// ========================================
// ERROR BOUNDARY
// ========================================

// Global error handler for Supabase-related errors
if (typeof window !== 'undefined') {
  window.addEventListener('error', (event) => {
    if (event.error?.message?.includes('supabase') || 
        event.error?.message?.includes('postgresql')) {
      console.error('🚨 Supabase-related error detected:', event.error);
      console.error('💡 Try running checkSupabaseStatus() for diagnosis');
    }
  });
  
  // Handle unhandled promise rejections from Supabase
  window.addEventListener('unhandledrejection', (event) => {
    if (event.reason?.message?.includes('supabase') ||
        event.reason?.message?.includes('postgresql')) {
      console.error('🚨 Unhandled Supabase promise rejection:', event.reason);
      console.error('💡 Check your database connection and API keys');
      
      // Prevent the error from appearing in console (optional)
      // event.preventDefault();
    }
  });
}

// ========================================
// ENVIRONMENT DETECTION
// ========================================

/**
 * ตรวจจับ environment และแสดงข้อมูลที่เหมาะสม
 */
function detectEnvironment() {
  const hostname = window.location.hostname;
  let env = 'production';
  
  if (hostname === 'localhost' || hostname === '127.0.0.1') {
    env = 'development';
  } else if (hostname.includes('staging') || hostname.includes('test')) {
    env = 'staging';
  }
  
  console.log(`🌍 Environment: ${env}`);
  
  // แสดงข้อมูลเพิ่มเติมใน development
  if (env === 'development') {
    console.log('🔧 Development features enabled');
    console.log('📊 Supabase URL:', SUPABASE_CONFIG.url);
  }
  
  return env;
}

// Run environment detection
if (typeof window !== 'undefined') {
  detectEnvironment();
}

// ========================================
// SUPABASE PROJECT TEMPLATES
// ========================================

/**
 * Template สำหรับสร้าง Supabase project ใหม่
 */
export const SUPABASE_PROJECT_TEMPLATE = {
  // SQL Commands สำหรับ quick setup
  createTablesSQL: `
    -- Run this in Supabase SQL Editor after creating your project
    -- Copy the full SQL from the supabase_setup_sql artifact
    
    -- Basic test to verify connection
    SELECT 'Supabase is working!' as message;
  `,
  
  // RLS Policies template
  rlsPoliciesSQL: `
    -- Enable RLS and create basic policies
    ALTER TABLE banks ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "Public read access" ON banks FOR SELECT USING (true);
  `,
  
  // Sample data for testing
  sampleDataSQL: `
    -- Insert sample data for testing
    INSERT INTO banks (name, short_name) VALUES 
    ('ธนาคารทดสอบ', 'TEST') 
    ON CONFLICT (short_name) DO NOTHING;
  `
};

// ========================================
// FINAL VALIDATION
// ========================================

// ตรวจสอบครั้งสุดท้ายว่าทุกอย่างพร้อมใช้งาน
if (typeof window !== 'undefined' && supabase) {
  // ทดสอบ basic functionality
  setTimeout(async () => {
    try {
      const { data } = await supabase.auth.getSession();
      console.log('🔐 Auth system:', data.session ? 'Active session' : 'No session (OK)');
    } catch (error) {
      console.warn('⚠️ Auth system check failed:', error.message);
    }
  }, 1000);
}