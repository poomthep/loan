// app.js - ไฟล์หลักสำหรับ User-Facing App
import { calc } from './calc.js';
import { render } from './render.js';
import { api } from './api.js';
import { storage } from './storage.js';
import { exportsUI } from './exports-ui.js';

const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);

function collectUserInputs() {
    const loanAmount = N(document.getElementById('loanAmount')?.value);
    const loanTermYears = N(document.getElementById('loanTerm')?.value) ?? 30;
    return { loanAmount, loanTermYears };
}

function analyzeOffers(list, loanAmount, years) {
    const months = Math.max(12, Math.round((years ?? 30) * 12));
    const out = [];
    for (const o of list) {
        const first3 = calc.parseFirst3Numeric(o.interest_rates);
        if (!first3.length) continue;
        const avgInterest3yr = calc.average(first3);
        const estMonthly = calc.pmt(loanAmount, avgInterest3yr, months);
        out.push({ ...o, avgInterest3yr, estMonthly });
    }
    // Sort by lower average interest first
    out.sort((a, b) => (a.avgInterest3yr ?? 999) - (b.avgInterest3yr ?? 999));
    return out;
}

async function doCompare() {
    const { loanAmount, loanTermYears } = collectUserInputs();
    if (!loanAmount || loanAmount < 100000) {
        render.setBanner('warn', 'กรุณาใส่วงเงินกู้ที่ต้องการ (เช่น 2,000,000)');
        return;
    }
    render.setBanner('info', 'กำลังดึงข้อมูลโปรโมชัน...');

    try {
        const { data, error } = await api.fetchPromotions();
        if (error) throw error;
        const analyzed = analyzeOffers(data || [], loanAmount, loanTermYears);
        render.renderResults(analyzed);
        storage.save({ analyzed, loanAmount, loanTermYears });
        if (!navigator.onLine) {
            render.setBanner('offline', 'โหมดออฟไลน์: แสดงผลจากแคชล่าสุด');
        } else {
            render.setBanner('info', 'ครบแล้ว! เลือกกดพิมพ์/ส่งออกด้านบนได้เลย');
        }
    } catch (e) {
        const cached = storage.load();
        if (cached) {
            render.renderResults(cached.analyzed);
            render.setBanner('offline', 'เครือข่ายมีปัญหา แสดงผลจากแคชล่าสุด');
        } else {
            render.setBanner('error', 'ดึงข้อมูลไม่สำเร็จ และไม่มีข้อมูลแคชไว้');
        }
    }
}

function attachEvents() {
    document.getElementById('compareBtn')?.addEventListener('click', doCompare);
    document.getElementById('resultsContainer')?.addEventListener('click', (e) => {
        const t = e.target;
        if (t.classList.contains('toggle-schedule-btn')) {
            const card = t.closest('.result-card');
            const cont = card?.querySelector('.amortization-table-container');
            const avgText = card?.querySelector('.calculation-breakdown b')?.textContent || '';
            const loanAmount = N(document.getElementById('loanAmount')?.value) ?? 0;
            const years = N(document.getElementById('loanTerm')?.value) ?? 30;
            const avg = parseFloat(avgText);
            if (cont && Number.isFinite(avg) && loanAmount) {
                const show = cont.style.display === 'none';
                if (show) {
                    render.renderSchedule(cont, loanAmount, avg, years);
                    cont.style.display = 'block';
                } else {
                    cont.style.display = 'none';
                }
            }
        }
    });
    exportsUI.attach();
    exportsUI.ensureToolbar();

    // Connectivity hints
    window.addEventListener('online', () => render.setBanner('info', 'กลับมาออนไลน์แล้วค่ะ'));
    window.addEventListener('offline', () => render.setBanner('offline', 'คุณออฟไลน์อยู่ แสดงผลจากแคชได้'));
}

// Self tests (run with ?test=1 in the URL)
function selfTests() {
    const u = new URL(location.href);
    if (u.searchParams.get('test') !== '1') return;
    console.group('[SELF-TESTS]');
    const pmt = calc.pmt(2000000, 5, 360);
    console.log('PMT(2,000,000 @5% 30y) ≈', pmt.toFixed(2));
    console.assert(Math.abs(pmt - 10737.91) < 500, 'PMT sanity check');
    const avg = calc.average([3.25, 4.00, 5.00]);
    console.log('Avg(3.25,4,5)=', avg);
    console.assert(Math.abs(avg - 4.0833) < 0.1, 'Average sanity');
    console.groupEnd();
}

function boot() {
    attachEvents();
    selfTests();
    // If we have cache and the page just loaded while offline, render it for better UX
    if (!navigator.onLine) {
        const cached = storage.load();
        if (cached) {
            render.renderResults(cached.analyzed);
            render.setBanner('offline', 'โหมดออฟไลน์: แสดงผลจากแคชล่าสุด');
        }
    }
}

// Initialize the app
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}