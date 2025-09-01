// /js/data-manager.js
// เวอร์ชันล่าสุด: รองรับงานฝั่ง Admin + หน้าใช้งานหลัก
// ฟังก์ชันหลักที่หน้า /admin ต้องใช้: 
//   getBanks, updateBankMRR, listPromotions, createPromotion, updatePromotion, deletePromotion
// ฟังก์ชันเสริมที่หน้าใช้งานใช้:
//   checkDatabaseConnection, getActivePromotions (product_type), (stubs) saveCalculation/getUserCalculations

// ---- Supabase client --------------------------------------------------------
import { supabase as importedSupabase } from './supabase-init.js';

// ดึงจาก import ถ้ามี; ถ้าไม่มีลองจาก window (กันกรณีเซ็ตไว้เป็น global)
function ensureClient() {
  const sb = importedSupabase || (typeof window !== 'undefined' ? window.supabase : null);
  if (!sb) throw new Error('Supabase client is required. Please check supabase-init.js');
  return sb;
}

// helper สำหรับ throw error ที่อ่านง่าย
function assertNoError({ error, data }, msg) {
  if (error) {
    const e = new Error(msg || error.message);
    e.cause = error;
    throw e;
  }
  return data;
}

// แปลงค่า number ที่มาจาก input ให้เป็น number/null
function toNumOrNull(v) {
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

// ---- Health check -----------------------------------------------------------
export async function checkDatabaseConnection() {
  const sb = ensureClient();
  // พยายาม select เบาๆ จากตาราง banks
  const res = await sb.from('banks').select('id').limit(1);
  if (res.error && res.error.code === '42P01') {
    // ตารางยังไม่มี
    return false;
  }
  if (res.error) return false;
  return true;
}

// ---- Banks ------------------------------------------------------------------
/**
 * ดึงธนาคารทั้งหมด (สำหรับแสดง/แก้ MRR)
 * คืน [{ id, short_name, name, mrr, mrr_effective_from, created_at? }]
 */
export async function getBanks() {
  const sb = ensureClient();
  const { data, error } = await sb
    .from('banks')
    .select('id, short_name, name, mrr, mrr_effective_from, created_at')
    .order('id', { ascending: true });

  return assertNoError({ data, error }, 'ไม่สามารถดึงรายชื่อธนาคารได้');
}

/**
 * อัปเดตค่า MRR ของธนาคาร
 * @param {number|string} bankId
 * @param {number} mrr ค่า MRR เช่น 6.85
 * @param {string|null} effectiveDate 'YYYY-MM-DD' หรือ null
 */
export async function updateBankMRR(bankId, mrr, effectiveDate = null) {
  const sb = ensureClient();
  const payload = {
    mrr: toNumOrNull(mrr),
    mrr_effective_from: effectiveDate || null,
  };

  const { data, error } = await sb
    .from('banks')
    .update(payload)
    .eq('id', bankId)
    .select()
    .single();

  return assertNoError({ data, error }, 'อัปเดต MRR ไม่สำเร็จ');
}

// ---- Promotions (Admin) -----------------------------------------------------
/**
 * ดึงโปรโมชันที่ active ทั้งหมด (เพื่อแสดงในตาราง admin)
 */
export async function listPromotions() {
  const sb = ensureClient();
  const { data, error } = await sb
    .from('promotions')
    .select('id, bank_id, product_type, title, description, base, year1, year2, year3, active, created_at')
    .eq('active', true)
    .order('id', { ascending: true });

  return assertNoError({ data, error }, 'ไม่สามารถดึงโปรโมชันได้');
}

/**
 * สร้างโปรโมชันใหม่
 * payload: { bank_id, product_type, title, description?, base?, year1?, year2?, year3?, active? }
 */
export async function createPromotion(payload) {
  const sb = ensureClient();
  const row = {
    bank_id: payload.bank_id,
    product_type: payload.product_type,
    title: payload.title,
    description: payload.description ?? null,
    base: payload.base ?? null,      // 'MRR' | 'MLR' | 'MOR' | null
    year1: toNumOrNull(payload.year1),
    year2: toNumOrNull(payload.year2),
    year3: toNumOrNull(payload.year3),
    active: payload.active ?? true,
  };
  const { data, error } = await sb
    .from('promotions')
    .insert(row)
    .select()
    .single();

  return assertNoError({ data, error }, 'สร้างโปรโมชันไม่สำเร็จ');
}

/**
 * อัปเดตโปรโมชันเดิมตาม id
 * payload: ฟิลด์เดียวกับ createPromotion (id จะถูกส่งแยก)
 */
export async function updatePromotion(id, payload) {
  const sb = ensureClient();
  const row = {
    bank_id: payload.bank_id,
    product_type: payload.product_type,
    title: payload.title,
    description: payload.description ?? null,
    base: payload.base ?? null,
    year1: toNumOrNull(payload.year1),
    year2: toNumOrNull(payload.year2),
    year3: toNumOrNull(payload.year3),
    active: payload.active ?? true,
  };
  const { data, error } = await sb
    .from('promotions')
    .update(row)
    .eq('id', id)
    .select()
    .single();

  return assertNoError({ data, error }, 'อัปเดตโปรโมชันไม่สำเร็จ');
}

/**
 * ลบโปรโมชันตาม id
 */
export async function deletePromotion(id) {
  const sb = ensureClient();
  const { data, error } = await sb
    .from('promotions')
    .delete()
    .eq('id', id)
    .select()
    .single();

  return assertNoError({ data, error }, 'ลบโปรโมชันไม่สำเร็จ');
}

// ---- Promotions (หน้าใช้งาน) ----------------------------------------------
/**
 * สำหรับหน้าใช้งาน: ดึงโปร active ตาม product_type (ถ้าไม่ส่ง จะดึงทั้งหมด)
 * @param {string|null} productType 'MORTGAGE' | 'REFINANCE' | 'PERSONAL' | 'SME' | null
 */
export async function getActivePromotions(productType = null) {
  const sb = ensureClient();
  let q = sb
    .from('promotions')
    .select('id, bank_id, product_type, title, description, base, year1, year2, year3, active')
    .eq('active', true);

  if (productType) q = q.eq('product_type', productType);

  const { data, error } = await q.order('id', { ascending: true });

  return assertNoError({ data, error }, 'ไม่สามารถดึงโปรโมชัน (หน้าใช้งาน) ได้');
}

// ---- Stubs สำหรับประวัติการคำนวณ (ถ้ายังไม่มีตาราง) -----------------------
/**
 * บันทึกการคำนวณ (ถ้ามีตารางรองรับ เช่น user_calculations)
 * โครงสร้างคาดหวัง: (id, user_id, product_type, params jsonb, results jsonb, calculation_mode, created_at)
 */
export async function saveCalculation(params, results, mode = 'max') {
  try {
    const sb = ensureClient();
    const payload = {
      product_type: params?.productType || null,
      params,
      results: { calculationResults: results },
      calculation_mode: mode,
    };
    const { data, error } = await sb
      .from('user_calculations')
      .insert(payload)
      .select()
      .single();

    // ถ้าไม่มีตาราง / สิทธิ์ไม่อนุญาต จะถูก catch และไม่ throw ให้หน้าใช้งานล่ม
    if (error) throw error;
    return data;
  } catch (e) {
    // log ไว้เฉย ๆ ไม่ให้หน้าใช้งานพัง
    console.warn('saveCalculation (noop):', e?.message || e);
    return null;
  }
}

/**
 * ดึงประวัติการคำนวณล่าสุดของผู้ใช้ (ถ้ามีตาราง)
 */
export async function getUserCalculations(limit = 10) {
  try {
    const sb = ensureClient();
    const { data, error } = await sb
      .from('user_calculations')
      .select('id, created_at, product_type, calculation_mode, income, loan_amount, results')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  } catch (e) {
    console.warn('getUserCalculations (noop):', e?.message || e);
    return [];
  }
}

// ---- default export (object) -----------------------------------------------
const DataManager = {
  // health
  checkDatabaseConnection,

  // banks
  getBanks,
  updateBankMRR,

  // promotions (admin)
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,

  // promotions (app)
  getActivePromotions,

  // stubs
  saveCalculation,
  getUserCalculations,
};

export default DataManager;
