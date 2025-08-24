// ชื่อไฟล์: format.js

// ใช้ Intl.NumberFormat ซึ่งเป็นวิธีมาตรฐานในการจัดรูปแบบตัวเลขและสกุลเงิน
const bahtFormatter = new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

/**
 * จัดรูปแบบตัวเลขเป็นสกุลเงินบาท (เช่น 1,234,567 บาท)
 * @param {number} num - ตัวเลขที่ต้องการจัดรูปแบบ
 * @returns {string} ข้อความที่จัดรูปแบบแล้ว
 */
function formatBaht(num) {
    if (typeof num !== 'number' || !isFinite(num)) {
        return 'N/A';
    }
    // เราไม่ต้องการให้มีคำว่า "บาท" ต่อท้าย จึงตัดออก
    return bahtFormatter.format(num).replace('฿', '').trim() + ' บาท';
}

export const fmt = {
    baht: formatBaht
};