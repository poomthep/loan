// render.js - จัดการการแสดงผลบนหน้าจอ (DOM manipulation)

import { fmt } from './format.js';
import { calc } from './calc.js';

function ensureBanner() {
    let b = document.getElementById('statusBanner');
    if (b) return b;
    b = document.createElement('div');
    b.id = 'statusBanner';
    b.style.cssText = 'position:sticky;top:0;z-index:9999;margin:0 0 10px 0;padding:10px;border-radius:10px;display:none';
    const container = document.querySelector('.container') || document.body;
    container.prepend(b);
    return b;
}

function setBanner(type, message) {
    const b = ensureBanner();
    const styles = {
        info: 'background:#e7f1ff;color:#0c58a0;border:1px solid #b7d3ff',
        warn: 'background:#fff4e5;color:#8a5100;border:1px solid #ffd9a8',
        error: 'background:#fde8e8;color:#b42318;border:1px solid #f1aeb5',
        offline: 'background:#eefaf0;color:#116044;border:1px solid #b7e4c7'
    };
    b.style.cssText += ';' + (styles[type] || styles.info);
    b.textContent = message;
    b.style.display = message ? 'block' : 'none';
}

function clearResults() {
    const wrap = document.getElementById('resultsContainer');
    if (wrap) wrap.innerHTML = '';
}

function cardHTML(offer) {
    let ratesList = '';
    if (Array.isArray(offer.ratesToDisplay)) {
        const last = offer.ratesToDisplay.length - 1;
        offer.ratesToDisplay.forEach((r, i) => {
            const num = parseFloat(r);
            if (i === last || Number.isNaN(num)) {
                ratesList += `<li>ปีที่ ${i + 1} เป็นต้นไป: ${r}</li>`;
            } else {
                ratesList += `<li>ปีที่ ${i + 1}: ${num.toFixed(2)}%</li>`;
            }
        });
    }
    
    const bankName = offer.banks?.name ?? 'ไม่ระบุธนาคาร';
    const promoName = offer.promotion_name ?? '';
    const avgStr = Number.isFinite(offer.avgInterest3yr) ? offer.avgInterest3yr.toFixed(2) : 'N/A';
    const payStr = Number.isFinite(offer.estMonthly) ? fmt.baht(offer.estMonthly) : 'N/A';
    const maxLoanStr = Number.isFinite(offer.maxAffordableLoan) ? fmt.baht(offer.maxAffordableLoan) : 'คุณสมบัติไม่ผ่าน';
    const termText = `(ระยะเวลา ${offer.displayTerm} ปี)`;

    let maxLoanDetailsHTML = '';
    if (offer.calculationDetails && offer.calculationDetails.maxLoanByPV) {
        maxLoanDetailsHTML = `
            <div class="loan-details">
                <p><span>ตามภาระผ่อน (DSR):</span> <span>${fmt.baht(offer.calculationDetails.maxLoanByPV)}</span></p>
                <p><span>ตามเกณฑ์รายได้:</span> <span>${fmt.baht(offer.calculationDetails.maxLoanByIncome)}</span></p>
            </div>
        `;
    }

    return `
      <div class="result-card" data-id="${offer.id}">
        <h3>${bankName}</h3>
        <div class="calculation-breakdown">
          <p>${promoName}</p>
          <ul>${ratesList}</ul>
          <div>ดอกเบี้ยเฉลี่ย 3 ปี: <b>${avgStr}%</b></div>
          ${maxLoanDetailsHTML}
          <div class="highlight">วงเงินกู้สูงสุด (ที่เป็นไปได้): <b>${maxLoanStr}</b></div>
          ${Number.isFinite(offer.maxAffordableLoan) ? `<div>ค่างวดประมาณการ/เดือน: <b>${payStr}</b> <small>${termText}</small></div>` : ''}
        </div>
        <div class="button-group">
            ${(offer.calculationDetails && Object.keys(offer.calculationDetails).length > 0) ? `<button class="details-btn btn btn-secondary" aria-label="ดูรายละเอียดการคำนวณ">ดูรายละเอียด</button>` : ''}
            <button class="toggle-schedule-btn btn" aria-label="ตารางผ่อนรายเดือน">ตารางผ่อน</button>
            <button class="print-table-btn btn" aria-label="พิมพ์การ์ดนี้">พิมพ์</button>
        </div>
        <div class="amortization-table-container" style="display:none"></div>
      </div>
    `;
}

function renderResults(list) {
    const wrap = document.getElementById('resultsContainer');
    if (!wrap) return;
    clearResults();
    if (!list || !list.length) {
        wrap.innerHTML = '<div class="result-card">ไม่พบโปรโมชันที่ตรงตามเงื่อนไข</div>';
        return;
    }
    const frag = document.createDocumentFragment();
    list.forEach(o => {
        const div = document.createElement('div');
        div.innerHTML = cardHTML(o);
        frag.appendChild(div.firstElementChild);
    });
    wrap.appendChild(frag);
}

function renderSchedule(container, loanAmount, avgRate, years) {
    const data = calc.buildAmortization(loanAmount, avgRate, years, 24);
    const t = document.createElement('table');
    t.className = 'comparison-table';
    t.innerHTML = `
      <thead><tr><th>งวด</th><th>ค่างวด</th><th>ตัดเงินต้น</th><th>ดอกเบี้ย</th><th>คงเหลือ</th></tr></thead>
      <tbody>
        ${data.rows.map(r => `
          <tr>
            <td style="text-align:center">${r.period}</td>
            <td>${fmt.baht(r.payment)}</td>
            <td>${fmt.baht(r.principal)}</td>
            <td>${fmt.baht(r.interest)}</td>
            <td>${fmt.baht(r.balance)}</td>
          </tr>
        `).join('')}
      </tbody>
    `;
    container.innerHTML = '';
    container.appendChild(t);
}

export const render = { setBanner, clearResults, renderResults, renderSchedule };