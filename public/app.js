// ชื่อไฟล์: app.js (ฉบับสมบูรณ์)

import { supabase } from './supabase-client.js';
import { render } from './render.js';
import { calc } from './calc.js';
import { fmt } from './format.js'; // Import fmt เข้ามาด้วย

// --- 1. DOM Elements ---
const compareBtn = document.getElementById('compareBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingSpinner = document.getElementById('loading-spinner');
const modal = document.getElementById('details-modal');
const modalContent = document.getElementById('modal-details-content');
const closeModalBtn = modal.querySelector('.close-btn');

// --- 2. State ของโปรแกรม (ย้าย processedOffers มาไว้ข้างนอก) ---
let allPromotions = [];
let processedOffers = []; // <--- FIX: ย้ายมาประกาศที่นี่

// --- 3. ฟังก์ชันหลัก ---

async function fetchAllPromotions() {
    loadingSpinner.style.display = 'block';
    render.clearResults();
    
    const { data, error } = await supabase.from('promotions').select('*, banks(name)');

    if (error) {
        console.error('Error fetching promotions:', error);
        render.setBanner('error', 'ไม่สามารถโหลดข้อมูลโปรโมชันได้');
        allPromotions = [];
    } else {
        allPromotions = data;
        render.setBanner('info', `พบ ${allPromotions.length} โปรโมชัน, กรุณากรอกข้อมูลเพื่อวิเคราะห์`);
    }
    loadingSpinner.style.display = 'none';
}

function handleAnalysis() {
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

    if (userInfo.salary <= 0) {
        render.setBanner('warn', 'กรุณากรอกข้อมูลรายได้อย่างน้อย (เงินเดือน)');
        return;
    }

    const totalMonthlyIncome = userInfo.salary + (userInfo.bonus / 12) + (userInfo.otherIncome / 6);
    const isCalculatingMaxLoan = loanInfo.amount <= 0;

    // FIX: เปลี่ยนจาก const เป็นการ assign ค่าให้ตัวแปรที่อยู่ข้างนอก
    processedOffers = allPromotions.map(promo => {
        const maxAge = userInfo.profession === 'salaried' ? promo.max_age_salaried : promo.max_age_business;
        const maxAllowedTerm = (maxAge || 99) - userInfo.age;
        if (maxAllowedTerm < 1) return null;

        let finalLoanAmount = 0;
        let actualTerm = 0;
        let calculationDetails = {};

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
            
            calculationDetails = {
                totalMonthlyIncome, promoDSRLimit, maxTotalDebtPayment,
                existingDebt: userInfo.debt, maxAffordablePayment, avgInterest, actualTerm
            };
        } else {
            actualTerm = Math.min(loanInfo.term, maxAllowedTerm);
            const userDSR = totalMonthlyIncome > 0 ? ((userInfo.debt + calc.pmt(loanInfo.amount, calc.average(calc.parseFirst3Numeric(promo.interest_rates.normal)), actualTerm * 12)) / totalMonthlyIncome) * 100 : 100;
            const dsrCheck = userDSR < (promo.dsr_limit || 100);
            const minIncome = (promo.income_per_million || 0) * (loanInfo.amount / 1000000);
            const incomeCheck = totalMonthlyIncome >= minIncome;

            if (!dsrCheck || !incomeCheck) return null;
            finalLoanAmount = loanInfo.amount;
        }

        const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
        const avgInterest = calc.average(calc.parseFirst3Numeric(rates));
        const estMonthly = calc.pmt(finalLoanAmount, avgInterest, actualTerm * 12);
        
        return {
            ...promo, maxAffordableLoan: finalLoanAmount, estMonthly, avgInterest3yr: avgInterest,
            ratesToDisplay: rates, displayTerm: actualTerm, calculationDetails,
        };
    }).filter(offer => offer !== null && offer.maxAffordableLoan > 0);

    const sortedOffers = processedOffers.sort((a, b) => b.maxAffordableLoan - a.maxAffordableLoan);
    render.renderResults(sortedOffers);
    
    if (sortedOffers.length > 0) {
        render.setBanner('info', `พบ ${sortedOffers.length} โปรโมชันที่ตรงตามคุณสมบัติของคุณ`);
    } else {
        render.setBanner('warn', 'ไม่พบโปรโมชันที่ตรงตามเงื่อนไข หรือความสามารถในการกู้ไม่เพียงพอ');
    }
}

// --- 4. Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAllPromotions(); // โหลดข้อมูลโปรโมชันเมื่อหน้าเว็บพร้อม
    compareBtn.addEventListener('click', handleAnalysis);

    // --- Modal Control ---
    function showModal(details) {
        if (!details || Object.keys(details).length === 0) {
            modalContent.innerHTML = '<p>ไม่มีรายละเอียดการคำนวณสำหรับรายการนี้</p>';
        } else {
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
        }
        modal.style.display = 'block';
    }

    function closeModal() { modal.style.display = 'none'; }
    closeModalBtn.addEventListener('click', closeModal);
    window.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });

    resultsContainer.addEventListener('click', (e) => {
        const detailsButton = e.target.closest('.details-btn');
        if (detailsButton) {
            const cardElement = e.target.closest('.result-card');
            const offerId = cardElement.dataset.id;
            const offerData = processedOffers.find(o => o.id == offerId);

            if (offerData && offerData.calculationDetails) {
                offerData.calculationDetails.finalLoanAmount = offerData.maxAffordableLoan;
                showModal(offerData.calculationDetails);
            } else {
                showModal({}); // แสดง Modal ว่างๆ ถ้าไม่มี details
            }
        }
    });
});