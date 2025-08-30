// ฟังก์ชันเข้าสู่ระบบที่ปรับปรุงพร้อมการแก้ไขปัญหา
async function handleLogin(email, password) {
  console.log('เริ่มกระบวนการเข้าสู่ระบบ...');
  console.log('Supabase URL:', supabase.supabaseUrl);
  console.log('อีเมล:', email);
  
  try {
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email,
      password: password,
    });

    if (error) {
      console.error('ข้อผิดพลาดการตรวจสอบสิทธิ์:', error);
      console.error('รหัสข้อผิดพลาด:', error.code);
      console.error('ชื่อข้อผิดพลาด:', error.name);
      console.error('ข้อความผิดพลาด:', error.message);
      console.error('สถานะข้อผิดพลาด:', error.status);
      
      // จัดการประเภทข้อผิดพลาดเฉพาะ
      if (error.code === 'invalid_credentials') {
        console.log('ข้อมูลประจำตัวไม่ถูกต้อง - ตรวจสอบว่าผู้ใช้มีอยู่และรหัสผ่านถูกต้อง');
        // ตรวจสอบว่าผู้ใช้มีอยู่หรือไม่
        const { data: users, error: userCheckError } = await supabase
          .from('auth.users')
          .select('email')
          .eq('email', email);
        
        if (userCheckError) {
          console.error('ข้อผิดพลาดในการตรวจสอบผู้ใช้:', userCheckError);
        } else {
          console.log('ผลการค้นหาผู้ใช้:', users);
        }
      }
      
      return { success: false, error };
    }

    console.log('เข้าสู่ระบบสำเร็จ!');
    console.log('ข้อมูลผู้ใช้:', data.user);
    console.log('เซสชัน:', data.session);
    
    return { success: true, data };
    
  } catch (err) {
    console.error('ข้อผิดพลาดที่ไม่คาดคิดขณะเข้าสู่ระบบ:', err);
    return { success: false, error: err };
  }
}

// ฟังก์ชันตรวจสอบการเชื่อมต่อ Supabase
async function checkSupabaseConnection() {
  try {
    console.log('กำลังทดสอบการเชื่อมต่อ Supabase...');
    
    // ทดสอบการเชื่อมต่อพื้นฐาน
    const { data, error } = await supabase
      .from('auth.users')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('การทดสอบการเชื่อมต่อล้มเหลว:', error);
      return false;
    }
    
    console.log('การเชื่อมต่อสำเร็จ!');
    return true;
    
  } catch (err) {
    console.error('ข้อผิดพลาดการทดสอบการเชื่อมต่อ:', err);
    return false;
  }
}

// ฟังก์ชันตรวจสอบการกำหนดค่าสภาพแวดล้อม
function checkEnvironmentConfig() {
  console.log('กำลังตรวจสอบการกำหนดค่าสภาพแวดล้อม...');
  
  const requiredVars = [
    'NEXT_PUBLIC_SUPABASE_URL',
    'NEXT_PUBLIC_SUPABASE_ANON_KEY'
    // เพิ่มตัวแปรสภาพแวดล้อมที่จำเป็นอื่นๆ
  ];
  
  const missing = requiredVars.filter(varName => !process.env[varName]);
  
  if (missing.length > 0) {
    console.error('ตัวแปรสภาพแวดล้อมที่หายไป:', missing);
    return false;
  }
  
  console.log('ตัวแปรสภาพแวดล้อมที่จำเป็นทั้งหมดได้ตั้งค่าแล้ว');
  
  // บันทึกค่า (ระวังอย่าเปิดเผยข้อมูลลับในโปรดักชัน)
  console.log('Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('API Key (10 ตัวอักษรแรก):', process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.substring(0, 10) + '...');
  
  return true;
}

// ตัวอย่างการใช้งาน
async function debugAuthIssue() {
  console.log('=== เซสชันแก้ไขปัญหา Supabase Auth ===');
  
  // ขั้นตอนที่ 1: ตรวจสอบสภาพแวดล้อม
  const envOk = checkEnvironmentConfig();
  if (!envOk) {
    console.error('พบปัญหาการกำหนดค่าสภาพแวดล้อม');
    return;
  }
  
  // ขั้นตอนที่ 2: ตรวจสอบการเชื่อมต่อ
  const connectionOk = await checkSupabaseConnection();
  if (!connectionOk) {
    console.error('พบปัญหาการเชื่อมต่อ Supabase');
    return;
  }
  
  // ขั้นตอนที่ 3: ทดสอบเข้าสู่ระบบ (แทนที่ด้วยข้อมูลประจำตัวจริงสำหรับการทดสอบ)
  // const result = await handleLogin('test@example.com', 'testpassword');
  
  console.log('=== เซสชันแก้ไขปัญหาเสร็จสิ้น ===');
}

// ยูทิลิตี้เพิ่มเติมเพื่อตรวจสอบการมีอยู่ของผู้ใช้
async function checkUserExists(email) {
  try {
    const { data, error } = await supabase.auth.admin.listUsers();
    
    if (error) {
      console.error('ข้อผิดพลาดในการแสดงรายการผู้ใช้:', error);
      return null;
    }
    
    const user = data.users.find(u => u.email === email);
    console.log(`ผู้ใช้ ${email} มีอยู่:`, !!user);
    
    if (user) {
      console.log('รายละเอียดผู้ใช้:', {
        id: user.id,
        email: user.email,
        email_confirmed_at: user.email_confirmed_at,
        created_at: user.created_at
      });
    }
    
    return user;
    
  } catch (err) {
    console.error('ข้อผิดพลาดในการตรวจสอบการมีอยู่ของผู้ใช้:', err);
    return null;
  }
}