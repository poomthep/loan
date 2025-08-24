// app.js (UPDATED to handle new interest_rates structure)
import { calc } from './calc.js';
import { render } from './render.js';
import { api } from './api.js';
import { storage } from './storage.js';
import { exportsUI } from './exports-ui.js';

const N = (v) => (v === '' || v === null || isNaN(parseFloat(v))) ? null : parseFloat(v);

function collectUserInputs() {
    const loanAmount = N(document.getElementById('loanAmount')?.value);
    const loanTermYears = N(document.getElementById('loanTerm')?.value) ?? 30;
    const wantsMRTA = document.getElementById('wantsMRTA')?.checked || false;
    return { loanAmount, loanTermYears, wantsMRTA };
}

function analyzeOffers(list, loanAmount, years, wantsMRTA) {
    const months = Math.max(12, Math.round((years ?? 30) * 12));
    const out = [];

    for (const o of list) {
        if (!o.interest_rates || !o.interest_rates.normal) continue;

        // Determine which set of rates to use
        let ratesToUse = o.interest_rates.normal;
        if (wantsMRTA && o.interest_rates.mrta && o.interest_rates.mrta.length > 0) {
            ratesToUse = o.interest_rates.mrta;
        }

        const first3 = calc.parseFirst3Numeric(ratesToUse);
        if (!first3.length) continue;

        const avgInterest3yr = calc.average(first3);
        const estMonthly = calc.pmt(loanAmount, avgInterest3yr, months);
        
        // Add the chosen rates to the final object for rendering
        out.push({ ...o, avgInterest3yr, estMonthly, ratesToDisplay: ratesToUse });
    }
    
    out.sort((a, b) => (a.avgInterest3yr ?? 999) - (b.avgInterest3yr ?? 999));
    return out;
}

async function doCompare() {
    const { loanAmount, loanTermYears, wantsMRTA } = collectUserInputs();
    if (!loanAmount || loanAmount < 100000) {
        render.setBanner('warn', 'กรุณาใส่วงเงินกู้ที่ต้องการ (เช่น 2,000,000)');
        return;
    }
    render.setBanner('info', 'กำลังดึงข้อมูลโปรโมชัน...');

    try {
        const { data, error } = await api.fetchPromotions();
        if (error) throw error;

        const analyzed = analyzeOffers(data || [], loanAmount, loanTermYears, wantsMRTA);
        render.renderResults(analyzed);
        storage.save({ analyzed, loanAmount, loanTermYears, wantsMRTA });

        if (!navigator.onLine) {
            render.setBanner('offline', 'โหมดออฟไลน์: แสดงผลจากแคชล่าสุด');
        } else {
            render.setBanner('info', 'ครบแล้ว! เลือกกดพิมพ์/ส่งออกด้านบนได้เลย');
        }
    } catch (e) {
        console.error("Comparison failed:", e);
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
    window.addEventListener('online', () => render.setBanner('info', 'กลับมาออนไลน์แล้วค่ะ'));
    window.addEventListener('offline', () => render.setBanner('offline', 'คุณออฟไลน์อยู่ แสดงผลจากแคชได้'));
}

function selfTests() { /* ... no changes here ... */ }

function boot() {
    attachEvents();
    selfTests();
    if (!navigator.onLine) {
        const cached = storage.load();
        if (cached) {
            render.renderResults(cached.analyzed);
            render.setBanner('offline', 'โหมดออฟไลน์: แสดงผลจากแคชล่าสุด');
        }
    }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
} else {
    boot();
}