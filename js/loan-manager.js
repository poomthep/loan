import { ensureLogin, logout } from './auth-manager.js';
import { LoanCalculator } from './loan-calculator-supabase.js';

ensureLogin();

const $ = s => document.querySelector(s);

const calc = new LoanCalculator();
const btnCalculate = $('#btn-calculate');
const logoutBtn = $('#btn-logout');

logoutBtn?.addEventListener('click', () => logout());

btnCalculate?.addEventListener('click', async () => {
  const loanAmount = parseFloat($('#loan-amount').value);
  const loanTermYears = parseInt($('#loan-term').value);
  const productType = $('#product-type').value;

  if (isNaN(loanAmount) || loanAmount <= 0 || isNaN(loanTermYears) || loanTermYears <= 0) {
    alert('กรุณากรอกข้อมูลให้ครบถ้วน');
    return;
  }

  const container = $('#results-container');
  container.innerHTML = '<p class="muted center">กำลังคำนวณ...</p>';

  try {
    const rows = await calc.checkLoanAmount({
      loanAmount: loanAmount,
      years: loanTermYears,
      productType: productType
    });

    let resultsHtml = '';
    if (!rows || !rows.length) {
      resultsHtml = `<p class="muted center">ไม่พบข้อมูล</p>`;
    } else {
      resultsHtml = `
        <table>
          <thead>
            <tr>
              <th style="width:120px">ธนาคาร</th>
              <th>โปรโมชัน</th>
              <th style="width:80px">ดอกเบี้ย</th>
              <th style="width:100px">ผ่อนต่อเดือน</th>
              <th style="width:100px">วงเงิน</th>
              <th style="width:80px">DSR</th>
              <th style="width:80px">LTV</th>
              <th style="width:100px">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(r => `
              <tr>
                <td><strong>${r.bankShortName || '-'}</strong><div class="note">${r.bankName || ''}</div></td>
                <td>${r.promotion ? `<div class="badge">${r.promotion.title}</div>` : '<span class="muted">—</span>'}</td>
                <td>${(r.interestRate || 0).toFixed(2)}%</td>
                <td>${fmt(r.monthlyPayment)}</td>
                <td>${fmt(r.loanAmount)}</td>
                <td>${(r.dsr || 0).toFixed(2)}%</td>
                <td>${(r.ltv || 0).toFixed(2)}%</td>
                <td>${r.status === 'APPROVED' ? '✅ อนุมัติ' : '❌ ไม่อนุมัติ'}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `;
    }
    container.innerHTML = resultsHtml;

  } catch (e) {
    console.error(e);
    container.innerHTML = '<p class="muted center">เกิดข้อผิดพลาดในการคำนวณ</p>';
  }
});

function fmt(n) {
  return n == null ? '—' : new Intl.NumberFormat('th-TH').format(Math.round(n));
}