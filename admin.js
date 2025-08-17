// ตั้งค่าการเชื่อมต่อกับ Supabase
const SUPABASE_URL = 'https://tswdqjnexuynkaagbvjb.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRzd2Rxam5leHV5bmthYWdidmpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTUzMjM2OTMsImV4cCI6MjA3MDg5OTY5M30.xbj60kwNOUixRxSjIOY9F2z7We1QXS4kK8F7P84EUTI';

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// อ้างอิง element ทั้งหมด
const promoForm = document.getElementById('promo-form');
const promoTableBody = document.getElementById('promo-table-body');
const promoIdInput = document.getElementById('promo-id');
const submitBtn = document.getElementById('submit-btn');
const clearBtn = document.getElementById('clear-btn');
const bankNameInput = document.getElementById('bank_name');
const interestRateYr1Input = document.getElementById('interest_rate_yr1');
const interestRateYr2Input = document.getElementById('interest_rate_yr2');
const interestRateYr3Input = document.getElementById('interest_rate_yr3');
const interestRateAfterValueInput = document.getElementById('interest_rate_after_value'); 
const maxLtvInput = document.getElementById('max_ltv');
const notesInput = document.getElementById('notes');
const waiveMortgageFeeInput = document.getElementById('waive_mortgage_fee');
const maxLoanTenureInput = document.getElementById('max_loan_tenure');
const maxAgeSalariedInput = document.getElementById('max_age_salaried');
const maxAgeBusinessInput = document.getElementById('max_age_business');
const incomePerMillionInput = document.getElementById('income_per_million');
const minLivingExpenseInput = document.getElementById('min_living_expense');
const dsrLimitInput = document.getElementById('dsr_limit');

async function fetchPromotions() {
    const { data, error } = await supabaseClient.from('loan_offers').select('*').order('id', { ascending: true });
    if (error) { console.error('เกิดข้อผิดพลาดในการดึงข้อมูล:', error); return; }
    promoTableBody.innerHTML = '';
    for (const promo of data) {
        const row = `<tr id="promo-row-${promo.id}"><td data-label="ธนาคาร">${promo.bank_name}</td><td data-label="ปีที่ 1">${promo.interest_rate_yr1.toFixed(2)}%</td><td data-label="ปีที่ 2">${promo.interest_rate_yr2.toFixed(2)}%</td><td data-label="ปีที่ 3">${promo.interest_rate_yr3.toFixed(2)}%</td><td data-label="ปีต่อไป">${promo.interest_rate_after}</td><td data-label="LTV (%)">${promo.max_ltv}%</td><td data-label="ฟรีค่าจดฯ">${promo.waive_mortgage_fee ? '✅' : '❌'}</td><td data-label="จัดการ"><button class="btn btn-warning" data-promo='${JSON.stringify(promo)}'>แก้ไข</button><button class="btn btn-danger" data-id="${promo.id}">ลบ</button></td></tr>`;
        promoTableBody.innerHTML += row;
    }
}

function clearForm() {
    promoForm.reset();
    promoIdInput.value = '';
    submitBtn.textContent = 'เพิ่มโปรโมชัน';
    submitBtn.classList.remove('btn-primary');
    submitBtn.classList.add('btn-success');
}

promoForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    const rateAfterValue = parseFloat(interestRateAfterValueInput.value);
    const interestRateAfterText = `MRR - ${rateAfterValue.toFixed(2)}%`;
    const promoData = {
        bank_name: bankNameInput.value.trim(),
        interest_rate_yr1: parseFloat(interestRateYr1Input.value),
        interest_rate_yr2: parseFloat(interestRateYr2Input.value),
        interest_rate_yr3: parseFloat(interestRateYr3Input.value),
        interest_rate_after: interestRateAfterText,
        max_ltv: parseInt(maxLtvInput.value),
        notes: notesInput.value.trim(),
        waive_mortgage_fee: waiveMortgageFeeInput.checked,
        max_loan_tenure: parseInt(maxLoanTenureInput.value),
        max_age_salaried: parseInt(maxAgeSalariedInput.value),
        max_age_business: parseInt(maxAgeBusinessInput.value),
        income_per_million: parseInt(incomePerMillionInput.value),
        min_living_expense: parseInt(minLivingExpenseInput.value),
        dsr_limit: parseInt(dsrLimitInput.value),
    };
    const promoId = promoIdInput.value;
    let error;
    if (promoId) {
        const { error: updateError } = await supabaseClient.from('loan_offers').update(promoData).eq('id', promoId);
        error = updateError;
    } else {
        const { error: insertError } = await supabaseClient.from('loan_offers').insert([promoData]);
        error = insertError;
    }
    if (error) {
        console.error('เกิดข้อผิดพลาด:', error);
        alert('ไม่สามารถบันทึกข้อมูลได้');
    } else {
        console.log('บันทึกข้อมูลสำเร็จ!');
        clearForm();
        fetchPromotions();
    }
});

promoTableBody.addEventListener('click', async (event) => {
    const target = event.target;
    if (target.classList.contains('btn-danger')) {
        const promoId = target.dataset.id;
        if (confirm('คุณแน่ใจหรือไม่ว่าต้องการลบโปรโมชันนี้?')) {
            const { error } = await supabaseClient.from('loan_offers').delete().eq('id', promoId);
            if (error) console.error('เกิดข้อผิดพลาดในการลบข้อมูล:', error);
            else {
                 const rowToRemove = document.getElementById(`promo-row-${promoId}`);
                 if(rowToRemove) rowToRemove.remove();
            }
        }
    }
    if (target.classList.contains('btn-warning')) {
        const promo = JSON.parse(target.dataset.promo);
        promoIdInput.value = promo.id;
        bankNameInput.value = promo.bank_name;
        interestRateYr1Input.value = promo.interest_rate_yr1;
        interestRateYr2Input.value = promo.interest_rate_yr2;
        interestRateYr3Input.value = promo.interest_rate_yr3;
        maxLtvInput.value = promo.max_ltv;
        notesInput.value = promo.notes;
        waiveMortgageFeeInput.checked = promo.waive_mortgage_fee;
        maxLoanTenureInput.value = promo.max_loan_tenure;
        maxAgeSalariedInput.value = promo.max_age_salaried;
        maxAgeBusinessInput.value = promo.max_age_business;
        incomePerMillionInput.value = promo.income_per_million;
        minLivingExpenseInput.value = promo.min_living_expense;
        dsrLimitInput.value = promo.dsr_limit;
        const rateAfterString = promo.interest_rate_after || '';
        const numericValue = rateAfterString.replace(/[^0-9.]/g, '');
        interestRateAfterValueInput.value = numericValue;
        submitBtn.textContent = 'บันทึกการแก้ไข';
        submitBtn.classList.remove('btn-success');
        submitBtn.classList.add('btn-primary');
        promoForm.scrollIntoView({ behavior: 'smooth' });
    }
});

clearBtn.addEventListener('click', clearForm);
fetchPromotions();