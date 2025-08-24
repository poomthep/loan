// ชื่อไฟล์: app.js (โครงสร้างที่ถูกต้อง)

import { supabase } from './supabase-client.js';
import { render } from './render.js';
import { calc } from './calc.js';

// --- 1. ดึง DOM Elements ของหน้าเครื่องคิดเลข ---
const compareBtn = document.getElementById('compareBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingSpinner = document.getElementById('loading-spinner');

// Input fields
const userAgeInput = document.getElementById('userAge');
const monthlySalaryInput = document.getElementById('monthlySalary');
// ... ดึง input fields อื่นๆ ทั้งหมด ...
const loanAmountInput = document.getElementById('loanAmount');
const loanTermInput = document.getElementById('loanTerm');


// --- 2. State ของโปรแกรม ---
let allPromotions = []; // เก็บโปรโมชันทั้งหมดที่โหลดมาครั้งแรก


// --- 3. ฟังก์ชันหลัก ---

// ฟังก์ชันดึงข้อมูลโปรโมชันทั้งหมดจาก Supabase
async function fetchAllPromotions() {
    loadingSpinner.style.display = 'block';
    render.clearResults();
    
    const { data, error } = await supabase
        .from('promotions')
        .select('*, banks(name)'); // ดึงข้อมูลโปรโมชันพร้อมชื่อธนาคาร

    if (error) {
        console.error('Error fetching promotions:', error);
        render.setBanner('error', 'ไม่สามารถโหลดข้อมูลโปรโมชันได้');
        allPromotions = [];
    } else {
        allPromotions = data;
		
		console.log(allPromotions); // <--- เพิ่มบรรทัดนี้เข้าไป
		
        render.setBanner('info', `พบ ${allPromotions.length} โปรโมชัน, กรุณากรอกข้อมูลเพื่อวิเคราะห์`);
    }
    loadingSpinner.style.display = 'none';
}

// ฟังก์ชันหลักที่จะทำงานเมื่อกดปุ่ม "วิเคราะห์"
// ในไฟล์ app.js ให้แทนที่ฟังก์ชัน handleAnalysis เดิมด้วยฟังก์ชันนี้

// ชื่อไฟล์: app.js

// ชื่อไฟล์: app.js

function handleAnalysis() {
    // 1. อ่านค่าจากฟอร์มทั้งหมด (เหมือนเดิม)
    const userInfo = {
        age: parseInt(document.getElementById('userAge').value) || 0,
        salary: parseFloat(document.getElementById('monthlySalary').value) || 0,
        bonus: parseFloat(document.getElementById('annualBonus').value) || 0,
        otherIncome: parseFloat(document.getElementById('otherIncome6M').value) || 0,
        debt: parseFloat(document.getElementById('monthlyDebt').value) || 0,
        profession: document.getElementById('profession').value,
        wantsMRTA: document.getElementById('wantsMRTA').checked,
    };
    const loanInfo = {
        amount: parseFloat(document.getElementById('loanAmount').value) || 0,
        term: parseInt(document.getElementById('loanTerm').value) || 30,
    };

    // 2. ตรวจสอบข้อมูลเบื้องต้น
    if (userInfo.salary <= 0) {
        render.setBanner('warn', 'กรุณากรอกข้อมูลรายได้อย่างน้อย (เงินเดือน)');
        return;
    }

    // 3. คำนวณรายรับรวมของผู้ใช้
    const totalMonthlyIncome = userInfo.salary + (userInfo.bonus / 12) + (userInfo.otherIncome / 6);

    // 4. ตรวจสอบว่าเป็นเคส "คำนวณวงเงินสูงสุด" หรือไม่
    const isCalculatingMaxLoan = loanInfo.amount <= 0;

    // 5. ประมวลผลโปรโมชัน
    const processedOffers = allPromotions.map(promo => {
        // --- ตรวจสอบคุณสมบัติที่ไม่เกี่ยวกับวงเงินกู้ ---
        const maxAge = userInfo.profession === 'salaried' ? promo.max_age_salaried : promo.max_age_business;
        const maxAllowedTerm = (maxAge || 99) - userInfo.age;
        if (maxAllowedTerm < 1) return null; // อายุเกินเกณฑ์โดยสิ้นเชิง

        let finalLoanAmount = 0;
        let actualTerm = 0;

        if (isCalculatingMaxLoan) {
            // --- CASE 1: คำนวณวงเงินกู้สูงสุด ---
            const maxTotalDebtPayment = totalMonthlyIncome * ((promo.dsr_limit || 70) / 100);
            const maxAffordablePayment = maxTotalDebtPayment - userInfo.debt;

            if (maxAffordablePayment <= 0) return null; // หนี้สินปัจจุบันสูงเกินกว่าจะกู้เพิ่มได้

            actualTerm = maxAllowedTerm; // ใช้ระยะเวลากู้สูงสุดที่ทำได้
            const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
            const avgInterest = calc.average(calc.parseFirst3Numeric(rates));
            
            if (isNaN(avgInterest)) return null;

            // คำนวณวงเงินสูงสุดจากความสามารถในการผ่อน
            const calculatedMaxLoan = calc.pv(maxAffordablePayment, avgInterest, actualTerm * 12);
            // วงเงินต้องไม่เกินเพดานสูงสุดของโปรโมชัน (ถ้ามี)
            finalLoanAmount = Math.min(calculatedMaxLoan, promo.max_loan_amount || Infinity);

        } else {
            // --- CASE 2: ตรวจสอบคุณสมบัติตามวงเงินที่กรอก ---
            actualTerm = Math.min(loanInfo.term, maxAllowedTerm);
            
            const dsrCheck = (userInfo.debt / totalMonthlyIncome) * 100 < (promo.dsr_limit || 100);
            const minIncome = (promo.income_per_million || 0) * (loanInfo.amount / 1000000);
            const incomeCheck = totalMonthlyIncome >= minIncome;

            if (!dsrCheck || !incomeCheck) return null; // DSR หรือ รายได้ ไม่ผ่าน
            
            finalLoanAmount = loanInfo.amount;
        }

        // --- คำนวณผลลัพธ์สุดท้ายสำหรับโปรโมชันนี้ ---
        const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
        const avgInterest = calc.average(calc.parseFirst3Numeric(rates));
        const estMonthly = calc.pmt(finalLoanAmount, avgInterest, actualTerm * 12);
        
        return {
            ...promo,
            maxAffordableLoan: finalLoanAmount,
            estMonthly: estMonthly,
            avgInterest3yr: avgInterest,
            ratesToDisplay: rates,
            displayTerm: actualTerm,
        };

    }).filter(offer => offer !== null && offer.maxAffordableLoan > 0); // คัดกรองโปรโมชันที่ไม่ผ่านจริงๆ ออก

    // 6. เรียงลำดับและส่งไปแสดงผล
    const sortedOffers = processedOffers.sort((a, b) => b.maxAffordableLoan - a.maxAffordableLoan); // เรียงจากวงเงินสูงสุดไปน้อยสุด
    render.renderResults(sortedOffers);
    if (sortedOffers.length > 0) {
        render.setBanner('info', `พบ ${sortedOffers.length} โปรโมชันที่ตรงตามคุณสมบัติของคุณ`);
    } else {
        render.setBanner('warn', 'ไม่พบโปรโมชันที่ตรงตามเงื่อนไข หรือความสามารถในการกู้ไม่เพียงพอ');
    }
}


// --- 4. Event Listeners ---
// เมื่อหน้าเว็บโหลดเสร็จ ให้ดึงข้อมูลโปรโมชันมารอไว้เลย
document.addEventListener('DOMContentLoaded', fetchAllPromotions);

// เมื่อกดปุ่ม "วิเคราะห์"
compareBtn.addEventListener('click', handleAnalysis);

// อาจจะต้องมี event listener สำหรับ toggle ตารางผ่อน
resultsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('toggle-schedule-btn')) {
        const container = e.target.closest('.result-card').querySelector('.amortization-table-container');
        if (container.style.display === 'none') {
            // ดึงข้อมูลมาสร้างตาราง แล้วแสดงผล
            // const offerId = e.target.dataset.id;
            // ... find offer data ...
            // render.renderSchedule(container, loanAmount, avgRate, years);
            container.style.display = 'block';
        } else {
            container.style.display = 'none';
        }
    }
});