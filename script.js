// ตั้งค่าการเชื่อมต่อกับ Supabase
const SUPABASE_URL = 'https://tswdqjnexuynkaagbvjb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2Rxam5leHV5bmthYWdidmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMjM2OTMsImV4cCI6MjA3MDg5OTY5M30.xbj60kwNOUixRxSjIOY9F2z7We1QXS4kK8F7P84EUTI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// อ้างอิง Element ทั้งหมด
const loanAmountInput = document.getElementById('loanAmount');
const loanTermInput = document.getElementById('loanTerm');
const compareBtn = document.getElementById('compareBtn');
const resultsContainer = document.getElementById('resultsContainer');
const loadingSpinner = document.getElementById('loading-spinner');
const filterBankInput = document.getElementById('filterBank');
const sortOrderSelect = document.getElementById('sortOrder');

// --- User Input Elements ---
const professionSelect = document.getElementById('profession');
const userAgeInput = document.getElementById('userAge');
const monthlyIncomeInput = document.getElementById('monthlyIncome');
const monthlyDebtInput = document.getElementById('monthlyDebt');

let allOffers = [];
let currentResults = []; // เก็บผลลัพธ์ปัจจุบันเพื่อใช้จัดเรียง

function calculateMonthlyPayment(principal, annualRate, years) {
    const monthlyRate = (annualRate / 100) / 12;
    const numberOfPayments = years * 12;
    if (monthlyRate === 0 || numberOfPayments <= 0) return Infinity;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
}

function generateAmortizationTable(principal, annualRate, years) {
    const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);
    const monthlyRate = (annualRate / 100) / 12;
    let remainingBalance = principal;
    let tableHtml = `<table><thead><tr><th>งวดที่</th><th>ดอกเบี้ย</th><th>เงินต้น</th><th>คงเหลือ</th></tr></thead><tbody>`;
    for (let i = 1; i <= years * 12; i++) {
        const interestForMonth = remainingBalance * monthlyRate;
        let principalForMonth = monthlyPayment - interestForMonth;
        if (i === years * 12) { principalForMonth = remainingBalance; }
        remainingBalance -= principalForMonth;
        if (remainingBalance < 0) remainingBalance = 0;
        tableHtml += `<tr><td>${i}</td><td>${interestForMonth.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td><td>${principalForMonth.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td><td>${remainingBalance.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td></tr>`;
    }
    tableHtml += `</tbody></table>`;
    return { tableHtml };
}

function renderResults(resultsToRender) {
    resultsContainer.innerHTML = ''; // เคลียร์ผลลัพธ์เก่า

    const requestedLoanAmount = parseFloat(loanAmountInput.value);
    const DSR = 0.40;
    const monthlyIncome = parseFloat(monthlyIncomeInput.value);
    const monthlyDebt = parseFloat(monthlyDebtInput.value) || 0;
    const maxAffordablePayment = (monthlyIncome * DSR) - monthlyDebt;
    const maxLoanByDSR = maxAffordablePayment * 150;
    const formatCurrency = (num) => num.toLocaleString('th-TH', { maximumFractionDigits: 0 });

    const dsrSummaryHtml = `<div class="result-card" style="text-align: center; background-color: #e2e3e5;"><p>คุณสามารถผ่อนได้สูงสุดประมาณ: <strong style="color: var(--success-color);">${formatCurrency(maxAffordablePayment)}</strong> บาท/เดือน</p><p>วงเงินกู้สูงสุดที่คุณจะได้รับ (ตามเกณฑ์ DSR 40%) คือประมาณ: <strong style="color: var(--success-color);">${formatCurrency(maxLoanByDSR)}</strong> บาท</p></div>`;
    
    let offersHtml = '';
    resultsToRender.forEach((offer, index) => {
        const monthlyPayment = calculateMonthlyPayment(requestedLoanAmount, offer.avgInterest3yr, offer.finalLoanTerm);
        let eligibilityNote = '';
        if (monthlyPayment > maxAffordablePayment) { eligibilityNote = `<p style="color: #856404;"><strong>ข้อควรระวัง:</strong> ค่างวดสูงกว่าความสามารถในการผ่อนของคุณ (${formatCurrency(maxAffordablePayment)} บาท/เดือน)</p>`; }
        if (offer.requestedLoanTerm > 0 && offer.finalLoanTerm < offer.requestedLoanTerm) { eligibilityNote += `<p style="color: #004085;"><em>หมายเหตุ: ระยะเวลากู้ถูกปรับเป็น ${offer.finalLoanTerm} ปี</em></p>`; } 
        else if (offer.requestedLoanTerm === 0) { eligibilityNote += `<p style="color: #004085;"><em>หมายเหตุ: โปรแกรมคำนวณระยะเวลากู้สูงสุดให้คุณคือ ${offer.finalLoanTerm} ปี</em></p>`; }
        
        let maxLoanByIncomeRuleText = '';
        if (offer.income_per_million > 0) {
            const netIncomeAfterExpenses = monthlyIncome - (offer.min_living_expense || 0) - monthlyDebt;
            if (netIncomeAfterExpenses > 0) {
                const maxLoanByIncome = (netIncomeAfterExpenses / offer.income_per_million) * 1000000;
                maxLoanByIncomeRuleText = `<p>วงเงินกู้สูงสุด (เกณฑ์ธนาคาร): <strong>${formatCurrency(maxLoanByIncome)}</strong> บาท</p>`;
            }
        }
        const totalPayments = offer.finalLoanTerm * 12;
        const totalPaid = monthlyPayment * totalPayments;
        const totalInterest = totalPaid - requestedLoanAmount;

        offersHtml += `<div class="result-card"><h3>ธนาคาร: ${offer.bank_name}</h3>${eligibilityNote}${maxLoanByIncomeRuleText}<p><strong>อัตราดอกเบี้ยเฉลี่ย 3 ปี: ${offer.avgInterest3yr.toFixed(2)} %</strong></p><ul><li>ปีที่ 1: ${offer.interest_rate_yr1.toFixed(2)}%</li><li>ปีที่ 2: ${offer.interest_rate_yr2.toFixed(2)}%</li><li>ปีที่ 3: ${offer.interest_rate_yr3.toFixed(2)}%</li><li>ปีต่อไป: ${offer.interest_rate_after}</li></ul><hr><p><strong>ค่างวดประมาณ (สำหรับ ${offer.finalLoanTerm} ปี): ${monthlyPayment.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท/เดือน</strong></p><p style="color: #dc3545; font-weight: bold;">ดอกเบี้ยที่จ่ายทั้งหมด (ตลอดสัญญา ${offer.finalLoanTerm} ปี): ${totalInterest.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท</p><div class="button-group" style="margin-top: 15px; display: flex; gap: 10px;"><button class="btn btn-secondary toggle-schedule-btn" data-target-id="table-container-${index}" data-amount="${requestedLoanAmount}" data-rate="${offer.avgInterest3yr}" data-term="${offer.finalLoanTerm}">แสดง/ซ่อนตารางผ่อน</button></div><div class="amortization-table-container" id="table-container-${index}"></div></div>`;
    });

    resultsContainer.innerHTML = dsrSummaryHtml + offersHtml;

    if (resultsToRender.length === 0) {
        resultsContainer.innerHTML += `<div class="result-card"><p>ไม่พบโปรโมชันที่เหมาะสมกับคุณสมบัติของคุณ (อาจเนื่องมาจากอายุเกินเกณฑ์)</p></div>`;
    }
}

function analyzeAndFilterOffers() {
    const userAge = parseInt(userAgeInput.value);
    const profession = professionSelect.value;
    const requestedLoanTerm = parseInt(loanTermInput.value) || 0;
    if (isNaN(userAge) || isNaN(parseFloat(monthlyIncomeInput.value)) || isNaN(parseFloat(loanAmountInput.value))) {
        alert('กรุณากรอกข้อมูลผู้กู้ และข้อมูลสินเชื่อให้ครบถ้วน');
        return;
    }

    currentResults = [];
    allOffers.forEach(offer => {
        const maxRepaymentAge = (profession === 'business' || profession === 'government') ? offer.max_age_business : offer.max_age_salaried;
        const tenureByAge = maxRepaymentAge - userAge;
        let finalLoanTerm;
        if (requestedLoanTerm > 0) {
            finalLoanTerm = Math.min(requestedLoanTerm, offer.max_loan_tenure, tenureByAge);
        } else {
            finalLoanTerm = Math.min(offer.max_loan_tenure, tenureByAge);
        }
        if (finalLoanTerm <= 0) return;
        
        const avgInterest3yr = (offer.interest_rate_yr1 + offer.interest_rate_yr2 + offer.interest_rate_yr3) / 3;
        currentResults.push({ ...offer, finalLoanTerm, avgInterest3yr, requestedLoanTerm });
    });

    sortAndRenderResults();
}

function sortAndRenderResults() {
    const filterText = filterBankInput.value.toLowerCase();
    let filteredResults = currentResults.filter(offer => offer.bank_name.toLowerCase().includes(filterText));

    const sortValue = sortOrderSelect.value;
    if (sortValue === 'rate_asc') {
        filteredResults.sort((a, b) => a.avgInterest3yr - b.avgInterest3yr);
    } else if (sortValue === 'rate_desc') {
        filteredResults.sort((a, b) => b.avgInterest3yr - a.avgInterest3yr);
    }
    
    renderResults(filteredResults);
}

async function fetchAndDisplayInitialData() {
    loadingSpinner.style.display = 'block';
    try {
        const { data, error } = await supabaseClient.from('loan_offers').select('*');
        if (error) { throw error; }
        allOffers = data;
    } catch (error) {
        console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error);
        resultsContainer.innerHTML = `<p style="color: red;">ไม่สามารถดึงข้อมูลได้</p>`;
    } finally {
        loadingSpinner.style.display = 'none';
    }
}

// ------ Event Listeners ------
compareBtn.addEventListener('click', analyzeAndFilterOffers);
sortOrderSelect.addEventListener('change', sortAndRenderResults);
filterBankInput.addEventListener('input', sortAndRenderResults);

resultsContainer.addEventListener('click', function(event) {
    const button = event.target;
    if (button.classList.contains('toggle-schedule-btn')) {
        const targetId = button.dataset.targetId;
        const tableContainer = document.getElementById(targetId);
        if (tableContainer.innerHTML.trim() === '') {
            const amount = parseFloat(button.dataset.amount);
            const rate = parseFloat(button.dataset.rate);
            const term = parseInt(button.dataset.term);
            const result = generateAmortizationTable(amount, rate, term);
            tableContainer.innerHTML = result.tableHtml;
            const printButton = document.createElement('button');
            printButton.className = 'btn btn-secondary print-table-btn';
            printButton.textContent = '🖨️ พิมพ์ตารางนี้';
            printButton.dataset.targetId = targetId;
            button.parentElement.appendChild(printButton);
        }
        tableContainer.classList.toggle('visible');
    }

    if (button.classList.contains('print-table-btn')) {
        const targetId = button.dataset.targetId;
        const tableContainer = document.getElementById(targetId);
        const tableToPrint = tableContainer.innerHTML;
        const bankName = button.closest('.result-card').querySelector('h3').textContent;
        const printWindow = window.open('', '_blank');
        printWindow.document.write(`<html><head><title>ตารางผ่อนชำระ - ${bankName}</title><link rel="stylesheet" href="style.css"><link rel="stylesheet" href="print.css"></head><body class="print-window"><div class="container"><h1>ตารางผ่อนชำระ</h1><h2>${bankName}</h2>${tableToPrint}</div></body></html>`);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500);
    }
});

fetchAndDisplayInitialData();