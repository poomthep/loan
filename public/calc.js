// calc.js - รวมฟังก์ชันการคำนวณทางการเงิน

/**
 * คำนวณค่างวดต่อเดือน (Principal + Interest)
 * @param {number} P - เงินต้น (Loan Amount)
 * @param {number} annualPct - อัตราดอกเบี้ยต่อปี (%)
 * @param {number} n - จำนวนงวดทั้งหมด (เดือน)
 * @returns {number} ค่างวดต่อเดือน
 */
function pmt(P, annualPct, n) {
    const annual = Number(annualPct);
    const r = (annual / 100) / 12; // อัตราดอกเบี้ยต่อเดือน
    if (!isFinite(r) || r === 0) return P / n;
    const a = Math.pow(1 + r, n);
    return P * r * a / (a - 1);
}

/**
 * ดึงตัวเลขดอกเบี้ย 3 ปีแรกออกมาจาก array
 * @param {Array<string|number>} rates - อาร์เรย์ของอัตราดอกเบี้ย
 * @returns {Array<number>} อาร์เรย์ของตัวเลขดอกเบี้ย 3 ค่าแรก
 */
function parseFirst3Numeric(rates) {
    if (!Array.isArray(rates)) return [];
    const nums = [];
    for (let i = 0; i < rates.length && nums.length < 3; i++) {
        const v = parseFloat(rates[i]);
        if (Number.isFinite(v)) nums.push(v);
    }
    return nums;
}


/**
 * คำนวณค่าเฉลี่ยของตัวเลขในอาร์เรย์
 * @param {Array<number>} arr - อาร์เรย์ของตัวเลข
 * @returns {number} ค่าเฉลี่ย
 */
function average(arr) {
    if (!arr || !arr.length) return NaN;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

/**
 * สร้างตารางตัดต้นตัดดอก (Amortization Schedule)
 * @param {number} P - เงินต้น
 * @param {number} annualPct - อัตราดอกเบี้ยต่อปี (%)
 * @param {number} years - จำนวนปีที่กู้
 * @param {number} [maxRows=24] - จำนวนแถวสูงสุดที่จะแสดงผล
 * @returns {{payment: number, rows: Array<object>}} อ็อบเจกต์ที่ประกอบด้วยค่างวดและข้อมูลตาราง
 */
function buildAmortization(P, annualPct, years, maxRows = 24) {
    const n = Math.max(12, Math.round(years * 12));
    const pay = pmt(P, annualPct, n);
    const r = (annualPct / 100) / 12;
    let bal = P;
    const rows = [];
    for (let i = 1; i <= n && rows.length < maxRows; i++) {
        const interest = bal * r;
        const principal = pay - interest;
        bal = Math.max(0, bal - principal);
        rows.push({ period: i, payment: pay, principal, interest, balance: bal });
    }
    return { payment: pay, rows };
}

export const calc = { pmt, parseFirst3Numeric, average, buildAmortization };