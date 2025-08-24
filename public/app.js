// app.js (Major upgrade for eligibility calculation)
import { calc } from './calc.js';
import { render } from './render.js';
import { api } from './api.js';
import { storage } from './storage.js';
import { exportsUI } from './exports-ui.js';

const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);

function collectUserInputs() {
    return {
        age: N(document.getElementById('userAge')?.value),
        salary: N(document.getElementById('monthlySalary')?.value),
        bonus: N(document.getElementById('annualBonus')?.value),
        otherIncome: N(document.getElementById('otherIncome6M')?.value),
        debt: N(document.getElementById('monthlyDebt')?.value),
        profession: document.getElementById('profession')?.value,
        wantsMRTA: document.getElementById('wantsMRTA')?.checked || false
    };
}

function calculateTotalIncome(inputs) {
    const salary = inputs.salary || 0;
    // Bonus: averaged over 12 months, 70% factor
    const bonusComponent = ((inputs.bonus || 0) / 12) * 0.70;
    // Other Income: averaged over 6 months, 50% factor
    const otherIncomeComponent = ((inputs.otherIncome || 0) / 6) * 0.50;
    return salary + bonusComponent + otherIncomeComponent;
}

async function analyzeAndFilterOffers() {
    const inputs = collectUserInputs();
    if (!inputs.age || !inputs.salary) {
        render.setBanner('warn', 'กรุณากรอกอายุและเงินเดือนเพื่อเริ่มการวิเคราะห์');
        return;
    }

    render.setBanner('info', 'กำลังวิเคราะห์คุณสมบัติและโปรโมชัน...');
    const totalIncome = calculateTotalIncome(inputs);

    try {
        const { data, error } = await api.fetchPromotions();
        if (error) throw error;

        const results = [];
        for (const offer of data) {
            // 1. Determine Max Loan Term
            const maxAge = inputs.profession === 'salaried' ? offer.max_age_salaried : offer.max_age_business;
            const termFromAge = (maxAge || 70) - inputs.age;
            const maxTerm = Math.min(offer.max_loan_tenure || 40, termFromAge);
            if (maxTerm <= 0) continue; // Ineligible due to age

            // 2. Calculate Repayment Ability
            const dsr = offer.dsr_limit || 80;
            const repaymentAbility = (totalIncome * (dsr / 100)) - (inputs.debt || 0);
            if (repaymentAbility <= 0) continue; // Ineligible due to debt

            // 3. Calculate Max Affordable Loan Amount
            const incomePerMillion = offer.income_per_million || 15000;
            const maxAffordableLoan = (repaymentAbility / incomePerMillion) * 1000000;
            
            // 4. Select Interest Rates
            let ratesToUse = offer.interest_rates?.normal;
            if (inputs.wantsMRTA && offer.interest_rates?.mrta?.length > 0) {
                ratesToUse = offer.interest_rates.mrta;
            }
            if (!ratesToUse || ratesToUse.length === 0) continue;

            // 5. Calculate 3-Year Average and Monthly Payment
            const first3 = calc.parseFirst3Numeric(ratesToUse);
            if (first3.length === 0) continue;
            const avgInterest3yr = calc.average(first3);
            const estMonthly = calc.pmt(maxAffordableLoan, avgInterest3yr, maxTerm * 12);

            results.push({
                ...offer,
                maxAffordableLoan,
                maxTerm,
                avgInterest3yr,
                estMonthly,
                ratesToDisplay: ratesToUse
            });
        }
        
        // Sort by highest affordable loan amount first
        results.sort((a, b) => (b.maxAffordableLoan || 0) - (a.maxAffordableLoan || 0));
        
        render.renderResults(results);
        render.setBanner('info', `วิเคราะห์เสร็จสิ้น! พบ ${results.length} โปรโมชันที่คุณอาจมีคุณสมบัติผ่าน`);

    } catch (e) {
        console.error("Analysis failed:", e);
        render.setBanner('error', 'เกิดข้อผิดพลาดในการดึงข้อมูลหรือวิเคราะห์');
    }
}

function attachEvents() {
    document.getElementById('compareBtn')?.addEventListener('click', analyzeAndFilterOffers);
    // ... (the rest of attachEvents is the same, just make sure renderSchedule gets the right data)
}

function boot() {
    attachEvents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}