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

// --- User Input Elements ---
const professionSelect = document.getElementById('profession');
const userAgeInput = document.getElementById('userAge');
const monthlyIncomeInput = document.getElementById('monthlyIncome');
const monthlyDebtInput = document.getElementById('monthlyDebt');
const extraPaymentInput = document.getElementById('extraPayment');

let allOffers = [];

function calculateMonthlyPayment(principal, annualRate, years) {
    const monthlyRate = (annualRate / 100) / 12;
    const numberOfPayments = years * 12;
    if (monthlyRate === 0 || numberOfPayments <= 0) return Infinity;
    return principal * (monthlyRate * Math.pow(1 + monthlyRate, numberOfPayments)) / (Math.pow(1 + monthlyRate, numberOfPayments) - 1);
}

function generateAmortizationTable(principal, annualRate, years, extraPayment = 0) {
    const monthlyPayment = calculateMonthlyPayment(principal, annualRate, years);
    const monthlyRate = (annualRate / 100) / 12;
    let remainingBalance = principal;
    let totalInterestPaid = 0;
    let months = 0;
    
    let tableHtml = `<table><thead><tr><th>งวดที่</th><th>ดอกเบี้ย</th><th>เงินต้น</th><th>โปะเพิ่ม</th><th>คงเหลือ</th></tr></thead><tbody>`;

    while (remainingBalance > 0 && months < years * 12 * 2) {
        months++;
        const interestForMonth = remainingBalance * monthlyRate;
        totalInterestPaid += interestForMonth;

        let principalForMonth = monthlyPayment - interestForMonth;
        let actualExtraPayment = extraPayment;

        if ((principalForMonth + actualExtraPayment) >= remainingBalance) {
            principalForMonth = remainingBalance;
            actualExtraPayment = 0;
            remainingBalance = 0;
        } else {
            remainingBalance -= (principalForMonth + actualExtraPayment);
        }

        tableHtml += `
            <tr>
                <td>${months}</td>
                <td>${interestForMonth.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
                <td>${principalForMonth.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
                <td>${actualExtraPayment.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
                <td>${remainingBalance.toLocaleString('th-TH', { maximumFractionDigits: 2 })}</td>
            </tr>
        `;
    }

    tableHtml += `</tbody></table>`;
    
    return {
        tableHtml: tableHtml,
        totalMonths: months,
        totalInterest: totalInterestPaid
    };
}

function displayOffers() {
    // (ฟังก์ชันนี้เหมือนเดิมทั้งหมด)
    const userAge = parseInt(userAgeInput.value);
    const profession = professionSelect.value;
    const monthlyIncome = parseFloat(monthlyIncomeInput.value);
    const monthlyDebt = parseFloat(monthlyDebtInput.value) || 0;
    const requestedLoanAmount = parseFloat(loanAmountInput.value);
    const requestedLoanTerm = parseInt(loanTermInput.value);
    if (isNaN(userAge) || isNaN(monthlyIncome) || isNaN(requestedLoanAmount) || isNaN(requestedLoanTerm)) {
        alert('กรุณากรอกข้อมูลผู้กู้ และข้อมูลสินเชื่อให้ครบถ้วน');
        return;
    }
    const maxAffordablePayment = (monthlyIncome * 0.40) - monthlyDebt;
    if (maxAffordablePayment <= 0) {
        resultsContainer.innerHTML = `<div class="result-card" style="background-color: #fff3cd;"><p><strong>ข้อควรทราบ:</strong> รายได้ของคุณอาจไม่เพียงพอต่อการขอสินเชื่อหลังหักภาระหนี้สินแล้ว</p></div>`;
        return;
    }
    resultsContainer.innerHTML = '';
    allOffers.forEach((offer, index) => {
        const maxRepaymentAge = (profession === 'business') ? offer.max_age_business : offer.max_age_salaried;
        const tenureByAge = maxRepaymentAge - userAge;
        const finalLoanTerm = Math.min(requestedLoanTerm, offer.max_loan_tenure, tenureByAge);
        if (finalLoanTerm <= 0) return;
        const avgInterest3yr = (offer.interest_rate_yr1 + offer.interest_rate_yr2 + offer.interest_rate_yr3) / 3;
        const monthlyPayment = calculateMonthlyPayment(requestedLoanAmount, avgInterest3yr, finalLoanTerm);
        let eligibilityNote = '';
        if (monthlyPayment > maxAffordablePayment) {
            eligibilityNote = `<p style="color: #856404;"><strong>ข้อควรระวัง:</strong> ค่างวดอาจสูงกว่าความสามารถในการผ่อนของคุณ</p>`;
        }
        if (finalLoanTerm < requestedLoanTerm) {
            eligibilityNote += `<p style="color: #004085;"><em>หมายเหตุ: ระยะเวลากู้ถูกปรับเป็น ${finalLoanTerm} ปี ตามเกณฑ์อายุของคุณและธนาคาร</em></p>`;
        }
        const totalPayments = finalLoanTerm * 12;
        const totalPaid = monthlyPayment * totalPayments;
        const totalInterest = totalPaid - requestedLoanAmount;

        const card = `
            <div class="result-card">
                <h3>ธนาคาร: ${offer.bank_name}</h3>
                ${eligibilityNote}
                <p><strong>อัตราดอกเบี้ยเฉลี่ย 3 ปี: ${avgInterest3yr.toFixed(2)} %</strong></p>
                <ul>
                    <li>ปีที่ 1: ${offer.interest_rate_yr1.toFixed(2)}%</li>
                    <li>ปีที่ 2: ${offer.interest_rate_yr2.toFixed(2)}%</li>
                    <li>ปีที่ 3: ${offer.interest_rate_yr3.toFixed(2)}%</li>
                    <li>ปีต่อไป: ${offer.interest_rate_after}</li>
                </ul>
                <hr>
                <p><strong>ค่างวดประมาณ (สำหรับ ${finalLoanTerm} ปี): ${monthlyPayment.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท/เดือน</strong></p>
                <p style="color: #dc3545; font-weight: bold;">ดอกเบี้ยที่จ่ายทั้งหมด (ตลอดสัญญา ${finalLoanTerm} ปี): ${totalInterest.toLocaleString('th-TH', { maximumFractionDigits: 0 })} บาท</p>
                
                <div class="button-group" style="margin-top: 15px; display: flex; gap: 10px;">
                    <button class="btn btn-secondary toggle-schedule-btn" data-target-id="table-container-${index}" data-amount="${requestedLoanAmount}" data-rate="${avgInterest3yr}" data-term="${finalLoanTerm}" data-original-interest="${totalInterest}">
                        แสดง/ซ่อนตารางผ่อน
                    </button>
                    </div>

                <div class="amortization-table-container" id="table-container-${index}"></div> 
            </div>
        `;
        resultsContainer.innerHTML += card;
    });
    if (resultsContainer.innerHTML === '') {
        resultsContainer.innerHTML = `<div class="result-card"><p>ไม่พบโปรโมชันที่เหมาะสมกับคุณสมบัติของคุณ (อาจเนื่องมาจากอายุเกินเกณฑ์)</p></div>`;
    }
}

async function fetchAndDisplayInitialData() {
    loadingSpinner.style.display = 'block';
    resultsContainer.innerHTML = '';
    resultsContainer.appendChild(loadingSpinner);

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


compareBtn.addEventListener('click', displayOffers);

resultsContainer.addEventListener('click', function(event) {
    const button = event.target;
    const targetId = button.dataset.targetId;
    const tableContainer = document.getElementById(targetId);

    // --- Logic for Toggle Button ---
    if (button.classList.contains('toggle-schedule-btn')) {
        if (tableContainer.innerHTML.trim() === '') {
            const amount = parseFloat(button.dataset.amount);
            const rate = parseFloat(button.dataset.rate);
            const term = parseInt(button.dataset.term);
            const extraPayment = parseFloat(extraPaymentInput.value) || 0;
            let summaryHtml = '';

            if (extraPayment > 0) {
                const originalInterest = parseFloat(button.dataset.originalInterest);
                const resultWithExtra = generateAmortizationTable(amount, rate, term, extraPayment);
                const years = Math.floor(resultWithExtra.totalMonths / 12);
                const months = resultWithExtra.totalMonths % 12;
                const interestSaved = originalInterest - resultWithExtra.totalInterest;
                summaryHtml = `<div class="print-summary" style="background-color: #d4edda; padding: 10px; border-radius: 5px; margin-top: 10px;"><p><strong>สรุปผลการโปะเพิ่ม:</strong></p><p>ระยะเวลาผ่อนใหม่: <strong>${years} ปี ${months} เดือน</strong></p><p style="color: var(--success-color);">ประหยัดดอกเบี้ยได้: <strong>${interestSaved.toLocaleString('th-TH', { maximumFractionDigits: 0 })}</strong> บาท</p></div>`;
                tableContainer.innerHTML = summaryHtml + resultWithExtra.tableHtml;
            } else {
                const result = generateAmortizationTable(amount, rate, term, 0);
                tableContainer.innerHTML = result.tableHtml;
            }
            
            // Add Print button after generating the table
            const printButton = document.createElement('button');
            printButton.className = 'btn btn-secondary print-table-btn';
            printButton.textContent = '🖨️ พิมพ์ตารางนี้';
            printButton.dataset.targetId = targetId;
            button.parentElement.appendChild(printButton);
        }
        tableContainer.classList.toggle('visible');
    }

    // --- Logic for Print Button ---
    if (button.classList.contains('print-table-btn')) {
        const tableToPrint = tableContainer.innerHTML;
        const bankName = button.closest('.result-card').querySelector('h3').textContent;

        const printWindow = window.open('', '_blank');
        printWindow.document.write(`
            <html>
                <head>
                    <title>ตารางผ่อนชำระ - ${bankName}</title>
                    <link rel="stylesheet" href="style.css">
                    <link rel="stylesheet" href="print.css">
                </head>
                <body>
                    <div class="container">
                        <h1>ตารางผ่อนชำระ</h1>
                        <h2>${bankName}</h2>
                        ${tableToPrint}
                    </div>
                </body>
            </html>
        `);
        printWindow.document.close();
        printWindow.focus();
        setTimeout(() => { printWindow.print(); }, 500); // Wait for styles to load
    }
});

fetchAndDisplayInitialData();