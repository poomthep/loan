const bahtFormatter = new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
});

function formatBaht(num) {
    if (typeof num !== 'number' || !isFinite(num)) {
        return 'N/A';
    }
    return bahtFormatter.format(num).replace('฿', '').trim() + ' บาท';
}

export const fmt = {
    baht: formatBaht
};