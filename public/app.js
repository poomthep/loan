import { supabase } from './supabase-client.js';
import { render } from './render.js';
import { calc } from './calc.js';
import { fmt } from './format.js';

// --- ADDED BACK: กำหนดค่า MRR อ้างอิง ---
const MRR = 7.3; // สมมติ MRR ปัจจุบันอยู่ที่ 7.3%

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

    const isCalculatingMaxLoan = loanInfo.amount <= 0;

    processedOffers = allPromotions.map(promo => {
        const bonusFactor = promo.bonus_factor ?? 0.70;
        const otherIncomeFactor = promo.other_income_factor ?? 0.50;
        const monthlyBonus = (userInfo.bonus / 12) * bonusFactor;
        const monthlyOtherIncome = (userInfo.otherIncome / 6) * otherIncomeFactor;
        const totalMonthlyIncome = userInfo.salary + monthlyBonus + monthlyOtherIncome;

        const assessmentFactor = promo.income_assessment_factor ?? 1.0;
        const assessedMonthlyIncome = totalMonthlyIncome * assessmentFactor;

        const maxAge = userInfo.profession === 'salaried' ? promo.max_age_salaried : promo.max_age_business;
        const maxAllowedTerm = (maxAge || 99) - userInfo.age;
        if (maxAllowedTerm < 1) {
            return null;
        }

        let finalLoanAmount = 0;
        let actualTerm = 0;
        let calculationDetails = {};
        let steppedPayments = [];

        const resolveRate = (rate) => {
            if (typeof rate === 'string' && rate.toUpperCase().includes('MRR')) {
                const parts = rate.toUpperCase().split(/[-+]/);
                const deduction = parseFloat(parts[1] || 0);
                return rate.includes('-') ? MRR - deduction : MRR + deduction;
            }
            return parseFloat(rate);
        };

        if (isCalculatingMaxLoan) {
            actualTerm = maxAllowedTerm;
            const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
            const avgInterest = calc.average(calc.parseFirst3Numeric(rates.map(resolveRate)));
            if (isNaN(avgInterest)) return null;

            const promoDSRLimit = promo.dsr_limit || 70;
            const maxTotalDebtPayment = assessedMonthlyIncome * (promoDSRLimit / 100);
            const maxAffordablePayment = maxTotalDebtPayment - userInfo.debt;
            if (maxAffordablePayment <= 0) return null;
            const maxLoanByPV = calc.pv(maxAffordablePayment, avgInterest, actualTerm * 12);

            const incomePerMillionReq = promo.income_per_million || 25000;
            const maxLoanByIncome = (assessedMonthlyIncome / incomePerMillionReq) * 1000000;

            finalLoanAmount = Math.min(maxLoanByPV, maxLoanByIncome, promo.max_loan_amount || Infinity);
            
            calculationDetails = {
                totalMonthlyIncome, assessmentFactor, assessedMonthlyIncome, promoDSRLimit, maxTotalDebtPayment,
                existingDebt: userInfo.debt, maxAffordablePayment, avgInterest, actualTerm,
                monthlyRate: (avgInterest / 100) / 12, totalMonths: actualTerm * 12, maxLoanByPV,
                maxLoanByIncome, incomePerMillionReq
            };
        } else {
            actualTerm = Math.min(loanInfo.term, maxAllowedTerm);
            const rates = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
            const avgInterest = calc.average(calc.parseFirst3Numeric(rates.map(resolveRate)));
            if (isNaN(avgInterest)) return null;

            const estPayment = calc.pmt(loanInfo.amount, avgInterest, actualTerm * 12);
            const userDSR = assessedMonthlyIncome > 0 ? ((userInfo.debt + estPayment) / assessedMonthlyIncome) * 100 : 100;
            const dsrCheck = userDSR < (promo.dsr_limit || 100);
            
            const minIncome = (promo.income_per_million || 0) * (loanInfo.amount / 1000000);
            const incomeCheck = assessedMonthlyIncome >= minIncome;

            if (!dsrCheck || !incomeCheck) return null;
            finalLoanAmount = loanInfo.amount;
        }
        
        // --- ADDED BACK: คำนวณค่างวดแบบขั้นบันได ---
        const ratesToCalc = userInfo.wantsMRTA && promo.has_mrta_option ? promo.interest_rates.mrta : promo.interest_rates.normal;
        if (ratesToCalc && ratesToCalc.length > 0 && finalLoanAmount > 0) {
            const rateGroups = [];
            let lastRate = null;
            ratesToCalc.forEach((rateStr, index) => {
                const numericRate = resolveRate(rateStr);
                if (numericRate !== lastRate || index === ratesToCalc.length - 1) { // Group consecutive same rates
                    rateGroups.push({ rate: numericRate, startYear: index + 1, endYear: index + 1 });
                    lastRate = numericRate;
                } else {
                    rateGroups[rateGroups.length - 1].endYear = index + 1;
                }
            });

            rateGroups.forEach((group, index) => {
                const isLastGroup = index === rateGroups.length - 1;
                const payment = calc.pmt(finalLoanAmount, group.rate, actualTerm * 12);
                
                let periodLabel = '';
                if(isLastGroup && group.startYear !== actualTerm) {
                    periodLabel = `ปีที่ ${group.startYear} เป็นต้นไป`;
                } else if (group.startYear === group.endYear) {
                    periodLabel = `ปีที่ ${group.startYear}`;
                } else {
                    periodLabel = `ปีที่ ${group.startYear}-${group.endYear}`;
                }
                steppedPayments.push({ period: periodLabel, amount: payment });
            });
        }

        const avgInterest3yr = calc.average(calc.parseFirst3Numeric(ratesToCalc.map(resolveRate)));
        
        return {
            ...promo,
            maxAffordableLoan: finalLoanAmount,
            avgInterest3yr: avgInterest3yr,
            ratesToDisplay: ratesToCalc,
            displayTerm: actualTerm,
            calculationDetails,
            steppedPayments // ส่งผลลัพธ์ใหม่ไปด้วย
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
    fetchAllPromotions();
    compareBtn.addEventListener('click', handleAnalysis);

    function showModal(details) {
        if (!details || Object.keys(details).length === 0) {
            modalContent.innerHTML = '<p>ไม่มีรายละเอียดการคำนวณสำหรับรายการนี้ (อาจเกิดจากการกรอกวงเงินกู้โดยตรง)</p>';
        } else {
            const assessmentFactorText = details.assessmentFactor < 1 ? `(ปรับลด ${((1 - details.assessmentFactor) * 100).toFixed(0)}%)` : '';
            modalContent.innerHTML = `
                <p><span>รายได้รวม (ก่อนปรับลด):</span> <span>${fmt.baht(details.totalMonthlyIncome)}</span></p>
                <p><span>รายได้ที่ใช้ประเมิน ${assessmentFactorText}:</span> <span>${fmt.baht(details.assessedMonthlyIncome)}</span></p>
                <p><span>หักภาระหนี้สินเดิม:</span> <span>-${fmt.baht(details.existingDebt)}</span></p>
                <p><span><b>รายได้สุทธิที่ใช้คำนวณ:</b></span> <span><b>${fmt.baht(details.netIncomeForCalculation)}</b></span></p>
                <hr>
                <p><span>ความสามารถในการผ่อนต่อเดือน:</span> <span>${fmt.baht(details.maxAffordablePayment)}</span></p>
                <p><span>อัตราดอกเบี้ยเฉลี่ย (3 ปี):</span> <span>${details.avgInterest.toFixed(2)}%</span></p>
                <p><span>ระยะเวลา:</span> <span>${details.actualTerm} ปี</span></p>
                <hr>
                <h4>วิธีคำนวณที่ 1: ตามภาระผ่อน (DSR)</h4>
                <div class="formula-display">
                  <p><span><b>สูตร:</b></span> <span>PV = PMT × [1-(1+r)<sup>-n</sup>]/r</span></p>
                  <hr>
                  <p><span><b>การแทนค่า:</b></span> <span></span></p>
                  <p><span>PMT (ค่างวด):</span> <span>${details.maxAffordablePayment.toLocaleString('th-TH')}</span></p>
                  <p><span>r (ดอกเบี้ย/เดือน):</span> <span>${details.monthlyRate.toFixed(8)} (${details.avgInterest.toFixed(2)}% / 12)</span></p>
                  <p><span>n (จำนวนงวด):</span> <span>${details.totalMonths} เดือน (${details.actualTerm} ปี)</span></p>
                  <hr>
                  <p><span><b>ผลลัพธ์:</b></span> <span><b>${fmt.baht(details.maxLoanByPV)}</b></span></p>
                </div>
                <hr>
                <h4>วิธีคำนวณที่ 2: ตามเกณฑ์รายได้</h4>
                 <div class="formula-display">
                  <p><span><b>สูตร:</b></span> <span>(รายได้สุทธิ / เกณฑ์) × 1 ล้าน</span></p>
                  <hr>
                  <p><span><b>การแทนค่า:</b></span> <span></span></p>
                  <p><span>รายได้สุทธิ:</span> <span>${fmt.baht(details.netIncomeForCalculation)}</span></p>
                  <p><span>เกณฑ์ (รายได้ต่อล้าน):</span> <span>${details.incomePerMillionReq.toLocaleString('th-TH')}</span></p>
                  <hr>
                  <p><span><b>ผลลัพธ์:</b></span> <span><b>${fmt.baht(details.maxLoanByIncome)}</b></span></p>
                </div>
                <hr>
                <p><span><b>วงเงินกู้สูงสุดที่เป็นไปได้ (ค่าที่น้อยกว่า):</b></span> <span><b>${fmt.baht(details.finalLoanAmount)}</b></span></p>
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
