// Debounce Function
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

function formatNumber(n) {
    return n.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatCurrency(input, blur) {
    let value = input.value;

    if (!value) return;

    value = value.replace(/[^\d.]/g, ""); // Remove non-numeric characters except .

    if (value.indexOf(".") >= 0) {
        let [left, right] = value.split(".");
        left = formatNumber(left);
        right = right.slice(0, 2); // Limit to 2 decimal places
        value = left + "." + right;
    } else {
        value = formatNumber(value);
        if (blur) {
            value += ".00";
        }
    }

    input.value = value;
}

function formatCalculatedValue(value) {
    if (isNaN(value)) return "0.00";
    return Number(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}


document.addEventListener('DOMContentLoaded', () => {
    const currencyInputs = document.querySelectorAll('[data-type="currency"]');

    currencyInputs.forEach(input => {
        input.addEventListener('input', () => formatCurrency(input));
        input.addEventListener('blur', () => formatCurrency(input, true));
    });
});

// Main Calculation Logic
function calculateAll() {
    // Loan Profile Calculations
    const B1 = parseFloat(document.getElementById('B1').value.replace(/,/g, '')) || 0;
    const B2 = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) / 100 || 0;
    const B6 = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0;
    const B7 = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0;
    const B8 = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0;
    const B13 = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0;
    const B14 = parseFloat(document.getElementById('B14').value.replace(/,/g, '')) || 0;

    const B3 = B1 * B2;
    const B5 = B1 - B3;
    const B9 = B7 * B8;
    const B15 = -(((B1 * B2) + (B1 * B13))) - B14;

    const PMT = (rate, nper, pv, fv = 0, type = 0) => {
        if (rate === 0) return -(pv + fv) / nper;
        const pvif = Math.pow(1 + rate, nper);
        let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
        if (type === 1) {
            pmt /= (1 + rate);
        }
        return pmt;
    };

    const B10 = PMT(B6 / B8, B9, -B5);
    const B11 = B10 * B9;
    const B12 = B11 - B5;

    // Format calculated values
    document.getElementById('B3').value = formatCalculatedValue(B3);
    document.getElementById('B5').value = formatCalculatedValue(B5);
    document.getElementById('B9').value = B9; // No formatting for non-currency values
    document.getElementById('B10').value = formatCalculatedValue(B10);
    document.getElementById('B11').value = formatCalculatedValue(B11);
    document.getElementById('B12').value = formatCalculatedValue(B12);
    document.getElementById('B15').value = formatCalculatedValue(B15);

    // Expenses Portion Calculations
    const B22 = parseFloat(document.getElementById('B22').value.replace(/,/g, '')) || 0;
    const C22 = parseFloat(document.getElementById('C22').value.replace(/,/g, '')) || 0;

    // Calculate Averages
    for (let i = 20; i <= 42; i++) {
        calculateAvg(i);
    }

    // Total Cash Flow Calculations
    const B15Value = parseFloat(document.getElementById('B15').value.replace(/,/g, '')) || 0;
    document.getElementById('B43').value = document.getElementById('C43').value = document.getElementById('D43').value = formatCalculatedValue(B15Value);

    // Calculate Total Revenue
    let B45 = 0, C45 = 0, D45 = 0;
    for (let i = 33; i <= 42; i++) {
        B45 += parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
        C45 += parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
        D45 += parseFloat(document.getElementById('D' + i).value.replace(/,/g, '')) || 0;
    }
    document.getElementById('B45').value = formatCalculatedValue(B45);
    document.getElementById('C45').value = formatCalculatedValue(C45);
    document.getElementById('D45').value = formatCalculatedValue(D45);

    // Calculate Total Expenses
    let BExpenses = 0, CExpenses = 0, DExpenses = 0;
    for (let i = 20; i <= 27; i++) {
        BExpenses += parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
        CExpenses += parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
        DExpenses += parseFloat(document.getElementById('D' + i).value.replace(/,/g, '')) || 0;
    }
    for (let i = 29; i <= 32; i++) {
        BExpenses += parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
        CExpenses += parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
        DExpenses += parseFloat(document.getElementById('D' + i).value.replace(/,/g, '')) || 0;
    }

    const vacancyRateB = parseFloat(document.getElementById('B28').value.replace(/,/g, '')) / 100 || 0;
    const vacancyRateC = parseFloat(document.getElementById('C28').value.replace(/,/g, '')) / 100 || 0;
    const vacancyRateD = parseFloat(document.getElementById('D28').value.replace(/,/g, '')) / 100 || 0;

    const B44 = BExpenses - (B45 * vacancyRateB);
    const C44 = CExpenses - (C45 * vacancyRateC);
    const D44 = DExpenses - (D45 * vacancyRateD);

    document.getElementById('B44').value = formatCalculatedValue(B44);
    document.getElementById('C44').value = formatCalculatedValue(C44);
    document.getElementById('D44').value = formatCalculatedValue(D44);

    // Calculate Est Total Income
    const B46 = (parseFloat(document.getElementById('B43').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('B44').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('B45').value.replace(/,/g, '')) || 0);
    const C46 = (parseFloat(document.getElementById('C43').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('C44').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('C45').value.replace(/,/g, '')) || 0);
    const D46 = (parseFloat(document.getElementById('D43').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('D44').value.replace(/,/g, '')) || 0) + (parseFloat(document.getElementById('D45').value.replace(/,/g, '')) || 0);
    document.getElementById('B46').value = formatCalculatedValue(B46);
    document.getElementById('C46').value = formatCalculatedValue(C46);
    document.getElementById('D46').value = formatCalculatedValue(D46);
}

function calculateAvg(rowNum) {
    const minVal = parseFloat(document.getElementById('B' + rowNum).value.replace(/,/g, '')) || 0;
    const maxVal = parseFloat(document.getElementById('C' + rowNum).value.replace(/,/g, '')) || 0;
    const avgVal = (minVal + maxVal) / 2;
    document.getElementById('D' + rowNum).value = formatCalculatedValue(avgVal);
}

// Add Event Listeners with Debounced Calculation
const debouncedCalculateAll = debounce(calculateAll, 300);
const allInputs = document.querySelectorAll('#calculator input');
allInputs.forEach(input => {
    input.addEventListener('input', debouncedCalculateAll);
});

debouncedCalculateAll(); // Initial calculation
