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
// ในไฟล์ app.js ให้แทนที่ฟังก์ชัน handleAnalysis เดิมด้วยฟังก์ชันนี้

function handleAnalysis() {
    // 1. อ่านค่าจากฟอร์มทั้งหมด
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
    if (userInfo.salary <= 0 || loanInfo.amount <= 0) {
        render.setBanner('warn', 'กรุณากรอกเงินเดือนและวงเงินกู้ที่ต้องการ');
        return;
    }

    // 3. คำนวณรายรับและ DSR ของผู้ใช้
    const totalMonthlyIncome = userInfo.salary + (userInfo.bonus / 12) + (userInfo.otherIncome / 6);
    // ป้องกันการหารด้วยศูนย์
    const userDSR = totalMonthlyIncome > 0 ? (userInfo.debt / totalMonthlyIncome) * 100 : 100;

    console.log(`User's Total Monthly Income: ${totalMonthlyIncome.toFixed(2)}`);
    console.log(`User's DSR: ${userDSR.toFixed(2)}%`);

    // 4. ประมวลผลและคัดกรองโปรโมชัน
    const eligibleOffers = allPromotions.filter(promo => {
        // --- ส่วนตรรกะการคัดกรอง ---
        // เช็ก DSR: DSR ของผู้ใช้ต้องไม่เกินที่โปรโมชันกำหนด
        const dsrCheck = userDSR < (promo.dsr_limit || 100);

        // เช็กอายุ: อายุของผู้ใช้รวมกับระยะเวลากู้ต้องไม่เกินที่โปรโมชันกำหนด
        const maxAge = userInfo.profession === 'salaried' ? promo.max_age_salaried : promo.max_age_business;
        const ageCheck = (userInfo.age + loanInfo.term) <= (maxAge || 99);
        
        // เช็กรายได้ขั้นต่ำ (ถ้ามี)
        const minIncome = (promo.income_per_million || 0) * (loanInfo.amount / 1000000);
        const incomeCheck = totalMonthlyIncome >= minIncome;

        // --- Log ผลการตรวจสอบของแต่ละโปรโมชัน ---
        console.log(`--- Checking: ${promo.promotion_name} ---`);
        console.log(`DSR Check: ${dsrCheck} (User ${userDSR.toFixed(2)}% <= Promo ${promo.dsr_limit}%)`);
        console.log(`Age Check: ${ageCheck} (User ${userInfo.age + loanInfo.term} <= Promo ${maxAge})`);
        console.log(`Income Check: ${incomeCheck} (User ${totalMonthlyIncome.toFixed(2)} >= Required ${minIncome.toFixed(2)})`);
        
        return dsrCheck && ageCheck && incomeCheck; // โปรโมชันจะผ่านเมื่อทุกเงื่อนไขเป็นจริง
    });

    // 5. คำนวณค่าอื่นๆ เพิ่มเติมสำหรับโปรโมชันที่ผ่าน
    const processedOffers = eligibleOffers.map(promo => {
        const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
        const numericRates = calc.parseFirst3Numeric(rates);
        const avgInterest = calc.average(numericRates);
        const estMonthly = calc.pmt(loanInfo.amount, avgInterest, loanInfo.term * 12);

        return {
            ...promo,
            maxAffordableLoan: loanInfo.amount, // สมมติว่าผ่านตามวงเงินที่ขอ
            estMonthly: estMonthly,
            avgInterest3yr: avgInterest,
            ratesToDisplay: rates,
        };
    });

    // 6. ส่งข้อมูลไปแสดงผล
    render.renderResults(processedOffers);
    if (processedOffers.length > 0) {
        render.setBanner('info', `พบ ${processedOffers.length} โปรโมชันที่ตรงตามคุณสมบัติของคุณ`);
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