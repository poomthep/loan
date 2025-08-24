// ชื่อไฟล์: render.js

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

// ชื่อไฟล์: render.js

// ชื่อไฟล์: render.js

// ชื่อไฟล์: render.js

// ชื่อไฟล์: render.js (เฉพาะฟังก์ชัน cardHTML)

function cardHTML(offer) {
    // ... (ส่วนประกาศตัวแปรเหมือนเดิม) ...

    // --- NEW: สร้าง HTML สำหรับแสดงผล 2 วิธี ---
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
          ${maxLoanDetailsHTML} {/* ⭐ แสดงรายละเอียดวงเงิน 2 วิธี */}
          <div class="highlight">วงเงินกู้สูงสุด (ที่เป็นไปได้): <b>${maxLoanStr}</b></div>
          ${Number.isFinite(offer.maxAffordableLoan) ? `<div>ค่างวดประมาณการ/เดือน: <b>${payStr}</b> <small>${termText}</small></div>` : ''}
        </div>
        {/* ... (ส่วนปุ่ม Button Group เหมือนเดิม) ... */}
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

// FIX: รวม export ทั้งหมดไว้ที่เดียวเพื่อป้องกัน Syntax Error
export const render = { setBanner, clearResults, renderResults, renderSchedule };