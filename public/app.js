// ชื่อไฟล์: app.js (ฉบับสมบูรณ์ อัปเดตล่าสุด)

import { supabase } from './supabase-client.js';
import { render } from './render.js';
import { calc } from './calc.js';
import { fmt } from './format.js';

// --- 1. DOM Elements ---
const compareBtn = document.getElementById('compareBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingSpinner = document.getElementById('loading-spinner');
const modal = document.getElementById('details-modal');
const modalContent = document.getElementById('modal-details-content');
const closeModalBtn = modal.querySelector('.close-btn');

// --- 2. State ของโปรแกรม ---
let allPromotions = [];
let processedOffers = [];

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

// ชื่อไฟล์: app.js (เฉพาะฟังก์ชัน handleAnalysis)

function handleAnalysis() {
    // ... (ส่วนอ่านค่าจากฟอร์มและคำนวณรายได้รวม เหมือนเดิม) ...
    const totalMonthlyIncome = userInfo.salary + (userInfo.bonus / 12) + (userInfo.otherIncome / 6);
    const isCalculatingMaxLoan = loanInfo.amount <= 0;

    processedOffers = allPromotions.map(promo => {
        // ... (ส่วนตรวจสอบคุณสมบัติเบื้องต้น เหมือนเดิม) ...
        const maxAllowedTerm = (maxAge || 99) - userInfo.age;
        if (maxAllowedTerm < 1) return null;

        let finalLoanAmount = 0;
        let actualTerm = 0;
        let calculationDetails = {};

        if (isCalculatingMaxLoan) {
            // --- คำนวณวงเงินกู้สูงสุด ---
            actualTerm = maxAllowedTerm;
            const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
            const avgInterest = calc.average(calc.parseFirst3Numeric(rates));
            if (isNaN(avgInterest)) return null;

            // --- วิธีที่ 1: คำนวณจาก DSR (PV Formula) ---
            const promoDSRLimit = promo.dsr_limit || 70;
            const maxTotalDebtPayment = totalMonthlyIncome * (promoDSRLimit / 100);
            const maxAffordablePayment = maxTotalDebtPayment - userInfo.debt;
            if (maxAffordablePayment <= 0) return null;
            const maxLoanByPV = calc.pv(maxAffordablePayment, avgInterest, actualTerm * 12);

            // --- วิธีที่ 2: คำนวณจากเกณฑ์รายได้ต่อล้าน ---
            const incomePerMillionReq = promo.income_per_million || 25000; // ใช้ค่ากลางๆ เป็น default
            const maxLoanByIncome = (totalMonthlyIncome / incomePerMillionReq) * 1000000;

            // --- ผลลัพธ์สุดท้ายคือค่าที่ "น้อยกว่า" ระหว่าง 2 วิธี และไม่เกินเพดานของโปรโมชัน ---
            finalLoanAmount = Math.min(maxLoanByPV, maxLoanByIncome, promo.max_loan_amount || Infinity);
            
            calculationDetails = {
                // ... (รายละเอียดเดิม) ...
                maxLoanByPV,      // ⭐ เพิ่มผลลัพธ์วิธีที่ 1
                maxLoanByIncome   // ⭐ เพิ่มผลลัพธ์วิธีที่ 2
            };
        } else {
            // ... (โค้ดสำหรับ Case 2 เหมือนเดิม) ...
        }

        // ... (ส่วนคำนวณ estMonthly และ return object เหมือนเดิม) ...
        return {
            ...promo, maxAffordableLoan: finalLoanAmount, estMonthly, avgInterest3yr: avgInterest,
            ratesToDisplay: rates, displayTerm: actualTerm, calculationDetails,
        };
    }).filter(offer => offer !== null && offer.maxAffordableLoan > 0);

    // ... (ส่วนเรียงลำดับและส่งไปแสดงผลเหมือนเดิม) ...
}

// --- 4. Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    fetchAllPromotions();
    compareBtn.addEventListener('click', handleAnalysis);

    function showModal(details) {
        if (!details || Object.keys(details).length === 0) {
            modalContent.innerHTML = '<p>ไม่มีรายละเอียดการคำนวณสำหรับรายการนี้</p>';
        } else {
            // ⭐ เพิ่มส่วนแสดงสูตรและการแทนค่า
            modalContent.innerHTML = `
                <p><span>รายได้รวมต่อเดือน:</span> <span>${fmt.baht(details.totalMonthlyIncome)}</span></p>
                <p><span>เงื่อนไข DSR ของโปรโมชัน:</span> <span>ไม่เกิน ${details.promoDSRLimit}%</span></p>
                <p><span>ภาระหนี้สูงสุดที่แบกรับได้:</span> <span>${fmt.baht(details.maxTotalDebtPayment)}</span></p>
                <p><span>ภาระหนี้สินเดิม:</span> <span>-${fmt.baht(details.existingDebt)}</span></p>
                <p><span>ความสามารถในการผ่อนต่อเดือน:</span> <span>${fmt.baht(details.maxAffordablePayment)}</span></p>
                <p><span>อัตราดอกเบี้ยเฉลี่ย (3 ปี) ที่ใช้คำนวณ:</span> <span>${details.avgInterest.toFixed(2)}%</span></p>
                <p><span>ระยะเวลาที่ใช้คำนวณ:</span> <span>${details.actualTerm} ปี</span></p>
                <hr>
                <div class="formula-display">
                  <h4>สูตรที่ใช้: PV = PMT × [1 - (1 + r)<sup>-n</sup>] / r</h4>
                  <p><span><b>การแทนค่า:</b></span> <span></span></p>
                  <p><span>PMT (ค่างวด):</span> <span>${fmt.baht(details.maxAffordablePayment)}</span></p>
                  <p><span>r (ดอกเบี้ย/เดือน):</span> <span>${details.monthlyRate.toFixed(6)}</span></p>
                  <p><span>n (จำนวนงวด):</span> <span>${details.totalMonths}</span></p>
                </div>
                <hr>
                <p><span><b>วงเงินกู้สูงสุดที่คำนวณได้:</b></span> <span><b>${fmt.baht(details.finalLoanAmount)}</b></span></p>
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
                showModal({});
            }
        }
    });
});