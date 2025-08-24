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

// ชื่อไฟล์: app.js

// 🔴 วางทับฟังก์ชัน handleAnalysis เดิมทั้งหมด
function handleAnalysis() {
    // ... (ส่วนอ่านค่าจากฟอร์มและคำนวณเบื้องต้นเหมือนเดิม) ...
    const totalMonthlyIncome = userInfo.salary + (userInfo.bonus / 12) + (userInfo.otherIncome / 6);
    const isCalculatingMaxLoan = loanInfo.amount <= 0;

    const processedOffers = allPromotions.map(promo => {
        // ... (ส่วนตรวจสอบคุณสมบัติเบื้องต้นเหมือนเดิม) ...
        const maxAge = userInfo.profession === 'salaried' ? promo.max_age_salaried : promo.max_age_business;
        const maxAllowedTerm = (maxAge || 99) - userInfo.age;
        if (maxAllowedTerm < 1) return null;

        let finalLoanAmount = 0;
        let actualTerm = 0;
        let calculationDetails = {}; // Object ใหม่สำหรับเก็บรายละเอียด

        if (isCalculatingMaxLoan) {
            const promoDSRLimit = promo.dsr_limit || 70;
            const maxTotalDebtPayment = totalMonthlyIncome * (promoDSRLimit / 100);
            const maxAffordablePayment = maxTotalDebtPayment - userInfo.debt;
            if (maxAffordablePayment <= 0) return null;

            actualTerm = maxAllowedTerm;
            const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
            const avgInterest = calc.average(calc.parseFirst3Numeric(rates));
            if (isNaN(avgInterest)) return null;

            const calculatedMaxLoan = calc.pv(maxAffordablePayment, avgInterest, actualTerm * 12);
            finalLoanAmount = Math.min(calculatedMaxLoan, promo.max_loan_amount || Infinity);
            
            // ⭐ บันทึกรายละเอียดการคำนวณ
            calculationDetails = {
                totalMonthlyIncome,
                promoDSRLimit,
                maxTotalDebtPayment,
                existingDebt: userInfo.debt,
                maxAffordablePayment,
                avgInterest,
                actualTerm
            };
        } else {
            // ... (โค้ดสำหรับ Case 2 เหมือนเดิม) ...
        }

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
            calculationDetails, // ⭐ เพิ่มรายละเอียดเข้าไปในผลลัพธ์
        };

    }).filter(offer => offer !== null && offer.maxAffordableLoan > 0);

    // ... (ส่วนเรียงลำดับและส่งไปแสดงผลเหมือนเดิม) ...
}

// 🟢 เพิ่มโค้ดส่วนนี้เข้าไปใน app.js (แนะนำให้วางไว้ใกล้ๆ กับส่วน Event Listeners อื่นๆ)
document.addEventListener('DOMContentLoaded', () => {
    // ... (โค้ด DOMContentLoaded เดิมของคุณ) ...
    
    // --- Modal Control ---
    const modal = document.getElementById('details-modal');
    const modalContent = document.getElementById('modal-details-content');
    const closeModalBtn = modal.querySelector('.close-btn');

    function showModal(details) {
        modalContent.innerHTML = `
            <p><span>รายได้รวมต่อเดือน:</span> <span>${fmt.baht(details.totalMonthlyIncome)}</span></p>
            <p><span>เงื่อนไข DSR ของโปรโมชัน:</span> <span>ไม่เกิน ${details.promoDSRLimit}%</span></p>
            <p><span>ภาระหนี้สูงสุดที่แบกรับได้:</span> <span>${fmt.baht(details.maxTotalDebtPayment)}</span></p>
            <p><span>ภาระหนี้สินเดิม:</span> <span>-${fmt.baht(details.existingDebt)}</span></p>
            <p><span>ความสามารถในการผ่อนต่อเดือน:</span> <span>${fmt.baht(details.maxAffordablePayment)}</span></p>
            <p><span>อัตราดอกเบี้ยเฉลี่ย (3 ปี) ที่ใช้คำนวณ:</span> <span>${details.avgInterest.toFixed(2)}%</span></p>
            <p><span>ระยะเวลาที่ใช้คำนวณ:</span> <span>${details.actualTerm} ปี</span></p>
            <hr>
            <p><span>วงเงินกู้สูงสุดที่คำนวณได้:</span> <span>${fmt.baht(details.finalLoanAmount)}</span></p>
        `;
        modal.style.display = 'block';
    }

    function closeModal() {
        modal.style.display = 'none';
    }

    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => {
        if (event.target === modal) {
            closeModal();
        }
    });

    // Event Delegation for Details Button
    resultsContainer.addEventListener('click', (e) => {
        if (e.target.classList.contains('details-btn')) {
            const cardElement = e.target.closest('.result-card');
            const offerId = cardElement.dataset.id; // เราจะใช้ id ในการหาข้อมูล
            const offerData = processedOffers.find(o => o.id == offerId); // 'processedOffers' ต้องเป็นตัวแ แปรที่เข้าถึงได้

            if (offerData && offerData.calculationDetails) {
                 // เพิ่ม finalLoanAmount เข้าไปใน object เพื่อให้แสดงผลได้
                offerData.calculationDetails.finalLoanAmount = offerData.maxAffordableLoan;
                showModal(offerData.calculationDetails);
            }
        }
    });
});


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