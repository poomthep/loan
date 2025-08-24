// ชื่อไฟล์: app.js (โครงสร้างที่ถูกต้อง)

import { supabase } from './supabase-client.js';
import { render } from './render.js';
// ไฟล์อื่นๆ ที่อาจจะต้องใช้
// import { calc } from './calc.js';

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
function handleAnalysis() {
    // 3.1 อ่านค่าจากฟอร์ม
    const userInfo = {
        age: parseInt(userAgeInput.value) || 0,
        salary: parseFloat(monthlySalaryInput.value) || 0,
        // ... อ่านค่าอื่นๆ ...
    };
    const loanInfo = {
        amount: parseFloat(loanAmountInput.value) || 0,
        term: parseInt(loanTermInput.value) || 30,
    };

    // 3.2 ตรวจสอบข้อมูลเบื้องต้น
    if (userInfo.salary <= 0 || loanInfo.amount <= 0) {
        render.setBanner('warn', 'กรุณากรอกเงินเดือนและวงเงินกู้ที่ต้องการ');
        return;
    }

    // 3.3 ประมวลผลโปรโมชันแต่ละอัน (นี่คือส่วนที่ซับซ้อนที่สุด)
    const processedOffers = allPromotions.map(promo => {
		
		    // --- ส่วนดีบัก เริ่ม ---
    console.log("------------------------------");
    console.log("Checking Promo:", promo.promotion_name);
    console.log("Promo DSR Limit:", promo.dsr_limit);
    console.log("User's calculated DSR:", your_dsr_calculation_variable); // << ใส่ตัวแปร DSR ของผู้ใช้ที่คุณคำนวณได้
    // --- ส่วนดีบัก จบ ---
		
        // ทำการคำนวณคุณสมบัติและวงเงินกู้สูงสุดสำหรับโปรโมชันนี้
        // เช่น checkEligibility(userInfo, promo);
        // const maxLoan = calculateMaxLoan(userInfo, promo);
        // const monthlyPayment = calc.pmt(loanInfo.amount, avgInterest, loanInfo.term * 12);
        
        // *** ส่วนนี้คือ Logic หลักของแอปที่คุณต้องเขียนเพิ่ม ***
        // ตอนนี้จะ return ค่าสมมติไปก่อน
        return {
            ...promo, // คัดลอกข้อมูลโปรโมชันเดิมทั้งหมด
            maxAffordableLoan: 3000000, // << ผลลัพธ์สมมติ
            estMonthly: 15000, // << ผลลัพธ์สมมติ
            avgInterest3yr: 3.5, // << ผลลัพธ์สมมติ
            ratesToDisplay: promo.interest_rates.normal, // << ผลลัพธ์สมมติ
        };
    });

    // 3.4 เรียงลำดับและกรองผลลัพธ์ (ถ้ามี)
    const sortedOffers = processedOffers.sort((a, b) => a.avgInterest3yr - b.avgInterest3yr);

    // 3.5 ส่งข้อมูลไปให้ render.js เพื่อแสดงผล
    render.renderResults(sortedOffers);
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