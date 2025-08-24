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
    // Use the ratesToDisplay array passed from app.js
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
    const payStr = Number.isFinite(offer.estMonthly) ? fmt.baht(offer.estMonthly) : '';

    return `
      <div class="result-card">
        <h3>${bankName}</h3>
        <div class="calculation-breakdown">
          <p>${promoName}</p>
          <ul>${ratesList}</ul>
          <div>ดอกเบี้ยเฉลี่ย 3 ปี: <b>${avgStr}%</b></div>
          ${payStr ? `<div>ค่างวดประมาณการ/เดือน: <b>${payStr} บาท</b></div>` : ''}
        </div>
        <div class="button-group">
          <button class="toggle-schedule-btn btn btn-secondary" aria-label="ตารางผ่อนรายเดือน" data-id="${offer.id}">ตารางผ่อนรายเดือน</button>
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
        wrap.innerHTML = '<div class="result-card">ยังไม่มีผลลัพธ์</div>';
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

export const render = { setBanner, renderResults, renderSchedule };