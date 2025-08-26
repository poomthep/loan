function pmt(P, annualPct, n) {
    const annual = Number(annualPct);
    const r = (annual / 100) / 12; // monthly interest rate
    if (!isFinite(r) || r === 0 || n <= 0) return P / n;
    const a = Math.pow(1 + r, n);
    return P * r * a / (a - 1);
}

function pv(PMT, annualPct, n) {
    const annual = Number(annualPct);
    const r = (annual / 100) / 12; // monthly interest rate
    if (!isFinite(r) || r === 0 || n <= 0) return PMT * n;
    const a = Math.pow(1 + r, n);
    return PMT * (a - 1) / (r * a);
}

function parseFirst3Numeric(rates) {
    if (!Array.isArray(rates)) return [];
    const nums = [];
    for (let i = 0; i < rates.length && nums.length < 3; i++) {
        const v = parseFloat(rates[i]);
        if (Number.isFinite(v)) nums.push(v);
    }
    return nums;
}

function average(arr) {
    if (!arr || !arr.length) return NaN;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function buildAmortization(P, annualPct, years, maxRows = 24) {
    const n = Math.max(12, Math.round(years * 12));
    const pay = pmt(P, annualPct, n);
    const r = (annualPct / 100) / 12;
    let bal = P;
    const rows = [];
    for (let i = 1; i <= n && rows.length < maxRows; i++) {
        const interest = bal * r;
        const principal = pay - interest;
        bal = Math.max(0, bal - principal);
        rows.push({ period: i, payment: pay, principal, interest, balance: bal });
    }
    return { payment: pay, rows };
}

export const calc = { pmt, pv, parseFirst3Numeric, average, buildAmortization };