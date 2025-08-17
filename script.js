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
let currentResults = [];

function calculateMonthlyPayment(principal, annualRate, years) {
    const monthlyRate = (annualRate / 100) / 12;
    const numberOfPayments = years * 12;
    if (monthlyRate === 0 || numberOfPayments <= 0 || principal <= 0) return 0;
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

function renderComparisonTable(topResults) {
    if (topResults.length < 2) return '';
    const formatCurrency = (num) => num.toLocaleString('th-TH', { maximumFractionDigits: 0 });
    let tableHtml = `<div class="result-card" style="background-color: #f8f9fa;"><h2 style="text-align:center;">ตารางสรุปเปรียบเทียบ ${topResults.length} อันดับแรก</h2><table class="comparison-table" style="width: 100%; text-align: center;"><thead><tr><th style="text-align: left;">หัวข้อ</th>`;
    topResults.forEach(result => { tableHtml += `<th>${result.bank_name}</th>`; });
    tableHtml += `</tr></thead><tbody>`;
    tableHtml += `<tr><td style="text-align: left;">อัตราดอกเบี้ยเฉลี่ย 3 ปีแรก</td>`;
    topResults.forEach(result => { tableHtml += `<td><strong>${result.avgInterest3yr.toFixed(2)}%</strong></td>`; });
    tableHtml += `</tr>`;
    tableHtml += `<tr><td style="text-align: left;">ค่างวดประมาณ/เดือน</td>`;
    topResults.forEach(result => {
        const payment = calculateMonthlyPayment(result.loanAmountToCalculate, result.avgInterest3yr, result.finalLoanTerm);
        tableHtml += `<td>${formatCurrency(payment)}</td>`;
    });
    tableHtml += `</tr>`;
    tableHtml += `<tr><td style="text-align: left;">วงเงินกู้สูงสุด (ที่อนุมัติได้)</td>`;
    topResults.forEach(result => {
        tableHtml += `<td>${formatCurrency(result.finalMaxPossibleLoan)}</td>`;
    });
    tableHtml += `</tr>`;
    tableHtml += `<tr><td style="text-align: left;">ฟรีค่าจดจำนอง</td>`;
    topResults.forEach(result => { tableHtml += `<td>${result.waive_mortgage_fee ? '✅' : '❌'}</td>`; });
    tableHtml += `</tr>`;
    tableHtml += `</tbody></table></div>`;
    return tableHtml;
}

function renderResults(resultsToRender) {
    resultsContainer.innerHTML = ''; 
    const formatCurrency = (num) => num.toLocaleString('th-TH', { maximumFractionDigits: 0 });
    const topResults = resultsToRender.slice(0, 3);
    const comparisonTableHtml = renderComparisonTable(topResults);
    let offersHtml = '';
    resultsToRender.forEach((offer, index) => {
        const monthlyPayment = calculateMonthlyPayment(offer.loanAmountToCalculate, offer.avgInterest3yr, offer.finalLoanTerm);
        const totalPayments = offer.finalLoanTerm * 12;
        const totalPaid = monthlyPayment * totalPayments;
        const totalInterest = totalPaid - offer.loanAmountToCalculate;
        offersHtml += `<div class="result-card"><h3>ธนาคาร: ${offer.bank_name}</h3>${offer.eligibilityNote}<p>วงเงินกู้สูงสุดที่คาดว่าจะได้รับ: <strong>${formatCurrency(offer.finalMaxPossibleLoan)}</strong> บาท</p><p><strong>อัตราดอกเบี้ยเฉลี่ย 3 ปี: ${offer.avgInterest3yr.toFixed(2)} %</strong></p><ul><li>ปีที่ 1: ${offer.interest_rate_yr1.toFixed(2)}%</li><li>ปีที่ 2: ${offer.interest_rate_yr2.toFixed(2)}%</li><li>ปีที่ 3: ${offer.interest_rate_yr3.toFixed(2)}%</li><li>ปีต่อไป: ${offer.interest_rate_after}</li></ul><hr><p><strong>ค่างวดประมาณ (สำหรับ ${offer.finalLoanTerm} ปี): ${monthlyPayment.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท/เดือน</strong></p><p style="color: #dc3545; font-weight: bold;">จากวงเงิน ${formatCurrency(offer.loanAmountToCalculate)} บาท | ดอกเบี้ยทั้งหมด: ${formatCurrency(totalInterest)} บาท</p><div class="button-group" style="margin-top: 15px; display: flex; gap: 10px;"><button class="btn btn-secondary toggle-schedule-btn" data-target-id="table-container-${index}" data-amount="${offer.loanAmountToCalculate}" data-rate="${offer.avgInterest3yr}" data-term="${offer.finalLoanTerm}">แสดง/ซ่อนตารางผ่อน</button></div><div class="amortization-table-container" id="table-container-${index}"></div></div>`;
    });
    resultsContainer.innerHTML = comparisonTableHtml + offersHtml;
    if (resultsToRender.length === 0) {
        resultsContainer.innerHTML = `<div class="result-card"><p>ไม่พบโปรโมชันที่เหมาะสมกับคุณสมบัติของคุณ (อาจเนื่องมาจากอายุเกินเกณฑ์)</p></div>`;
    }
}

function analyzeAndFilterOffers() {
    const userAge = parseInt(userAgeInput.value);
    const profession = professionSelect.value;
    const monthlyIncome = parseFloat(monthlyIncomeInput.value);
    const monthlyDebt = parseFloat(monthlyDebtInput.value) || 0;
    const requestedLoanAmount = parseFloat(loanAmountInput.value);
    const requestedLoanTerm = parseInt(loanTermInput.value) || 0;
    if (isNaN(userAge) || isNaN(monthlyIncome) || isNaN(requestedLoanAmount)) {
        alert('กรุณากรอกข้อมูลผู้กู้ และข้อมูลสินเชื่อให้ครบถ้วน');
        return;
    }
    currentResults = [];
    allOffers.forEach(offer => {
        const dsrValue = (offer.dsr_limit || 40) / 100;
        const maxAffordablePayment = (monthlyIncome * dsrValue) - monthlyDebt;
        if (maxAffordablePayment <= 0) return;

        const maxLoanByDSR = maxAffordablePayment * 150;
        let maxLoanByIncome = Infinity; // ให้ค่าเป็น Infinity ถ้าไม่มีเกณฑ์นี้
        if (offer.income_per_million > 0) {
            const netIncomeAfterExpenses = monthlyIncome - (offer.min_living_expense || 0) - monthlyDebt;
            if (netIncomeAfterExpenses > 0) {
                maxLoanByIncome = (netIncomeAfterExpenses / offer.income_per_million) * 1000000;
            }
        }
        
        // --- ส่วนแก้ไขตรรกะที่สำคัญ ---
        // วงเงินกู้สูงสุดที่เป็นไปได้จริง คือค่าที่น้อยที่สุดระหว่าง 2 เกณฑ์
        const finalMaxPossibleLoan = Math.min(maxLoanByDSR, maxLoanByIncome);
        
        let eligibilityNote = '';
        let loanAmountToCalculate = requestedLoanAmount;
        if (requestedLoanAmount > finalMaxPossibleLoan) {
            loanAmountToCalculate = finalMaxPossibleLoan;
            eligibilityNote += `<p style="color: #856404;"><strong>ข้อควรระวัง:</strong> วงเงินที่ต้องการสูงเกินไป โปรแกรมจึงคำนวณจากวงเงินสูงสุดที่เป็นไปได้</p>`;
        }
        
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
        
        currentResults.push({ ...offer, finalLoanTerm, avgInterest3yr, requestedLoanTerm, loanAmountToCalculate, eligibilityNote, finalMaxPossibleLoan });
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