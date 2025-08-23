// exports-ui.js - จัดการฟังก์ชัน Export เป็น PDF/CSV

function openPrintWindow(innerHTML, title = 'Export') {
    const w = window.open('', '_blank');
    if (!w) { alert('โปรดอนุญาตป๊อปอัปเพื่อพิมพ์/บันทึก PDF'); return; }
    const css = `
      <link rel="stylesheet" href="style.css">
      <link rel="stylesheet" href="print.css" media="print">
      <style>body{padding: 16px}</style>
    `;
    w.document.open();
    w.document.write(`<!doctype html><html lang="th"><head><meta charset="utf-8"><title>${title}</title>${css}</head><body class="print-window">${innerHTML}</body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w.print(); } catch (e) { } }, 100);
}

function exportAllPDF() {
    const results = document.getElementById('resultsContainer');
    if (!results || !results.children.length) { alert('ยังไม่มีผลลัพธ์ให้พิมพ์ค่ะ'); return; }
    const title = `สรุปเปรียบเทียบสินเชื่อ_${new Date().toISOString().slice(0, 10)}`;
    openPrintWindow(`<h1>${title}</h1>${results.innerHTML}`, title);
}

function toNumber(text) {
    if (text == null) return null;
    const n = parseFloat(String(text).replace(/[^\d.-]+/g, ''));
    return Number.isFinite(n) ? n : null;
}

function collectRow(card) {
    const bank = card.querySelector('h3')?.textContent?.trim() || '';
    const promo = card.querySelector('.calculation-breakdown p')?.textContent?.trim() || '';
    const bolds = card.querySelectorAll('.calculation-breakdown b');
    const avgStr = bolds[0]?.textContent || '';
    const payStr = bolds[1]?.textContent || '';
    const avg = toNumber(avgStr);
    const pay = toNumber(payStr);
    const lis = Array.from(card.querySelectorAll('.calculation-breakdown li'));
    const rates = lis.map(li => toNumber(li.textContent)).filter(v => v != null).slice(0, 3);
    const [y1, y2, y3] = [rates[0] ?? '', rates[1] ?? '', rates[2] ?? ''];
    return [bank, promo, y1, y2, y3, avg ?? '', pay ?? ''];
}

function exportCSV() {
    const cards = document.querySelectorAll('.result-card');
    if (!cards.length) { alert('ยังไม่มีผลลัพธ์ให้ส่งออกค่ะ'); return; }
    const header = ['ธนาคาร', 'โปรโมชัน', 'ปี1(%)', 'ปี2(%)', 'ปี3(%)', 'เฉลี่ย3ปี(%)', 'งวด/เดือน(บาท)'];
    const rows = [header];
    cards.forEach(c => rows.push(collectRow(c)));
    const csv = rows.map(r => r.map(x => {
        const s = (x == null) ? '' : String(x);
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = Object.assign(document.createElement('a'), { href: url, download: `loan-comparison_${new Date().toISOString().slice(0, 10)}.csv` });
    document.body.appendChild(a); a.click();
    setTimeout(() => { URL.revokeObjectURL(url); a.remove(); }, 100);
}

function printSingleCard(card) {
    const title = `รายละเอียดโปรโมชัน_${new Date().toISOString().slice(0, 10)}`;
    openPrintWindow(card.outerHTML, title);
}

function attach() {
    document.addEventListener('click', (e) => {
        const btn = e.target.closest('.print-table-btn');
        if (btn) {
            const card = btn.closest('.result-card');
            if (card) printSingleCard(card);
        }
        if (e.target.id === 'exportAllPDFBtn') exportAllPDF();
        if (e.target.id === 'exportCSVBtn') exportCSV();
    });
}

function ensureToolbar() {
    const bar = document.getElementById('exportToolbar');
    if (!bar) return;
    bar.innerHTML = `
      <button class="btn btn-secondary" id="exportAllPDFBtn" aria-label="พิมพ์/บันทึก PDF ทั้งหมด">พิมพ์ทั้งหมด (PDF)</button>
      <button class="btn" id="exportCSVBtn" aria-label="ส่งออกตารางเป็น CSV">ส่งออก CSV</button>
    `;
}

export const exportsUI = { attach, ensureToolbar };