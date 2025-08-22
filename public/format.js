// format.js - รวมฟังก์ชันการจัดรูปแบบตัวเลขและสกุลเงิน

const nf = new Intl.NumberFormat('th-TH');
const pf = new Intl.NumberFormat('th-TH', { maximumFractionDigits: 2, minimumFractionDigits: 0 });

/**
 * จัดรูปแบบตัวเลขเป็นสกุลเงินบาท (ปัดเศษและใส่จุลภาค)
 * @param {number} x - ตัวเลข
 * @returns {string} ข้อความที่จัดรูปแบบแล้ว
 */
function baht(x) {
    return nf.format(Math.round(x));
}

/**
 * จัดรูปแบบตัวเลขเป็นเปอร์เซ็นต์ (ทศนิยม 2 ตำแหน่ง)
 * @param {number} x - ตัวเลข
 * @returns {string} ข้อความเปอร์เซ็นต์
 */
function pct(x) {
    return Number.isFinite(x) ? (x.toFixed(2) + '%') : 'N/A';
}

export const fmt = { baht, pct, nf, pf };