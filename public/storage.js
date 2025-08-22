// storage.js - จัดการ Local Storage สำหรับ Caching
const KEY = 'loan_results_cache_v1';

function save(payload) {
    try {
        localStorage.setItem(KEY, JSON.stringify({ ts: Date.now(), payload }));
    } catch (e) {
        console.warn("Failed to save to localStorage", e);
    }
}

function load() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const obj = JSON.parse(raw);
        return obj?.payload || null;
    } catch (e) {
        console.warn("Failed to load from localStorage", e);
        return null;
    }
}

export const storage = { save, load };