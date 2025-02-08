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
    value = value.replace(/[^\d.]/g, "");
    if (value.indexOf(".") >= 0) {
        let [left, right] = value.split(".");
        left = formatNumber(left);
        right = right.slice(0, 2);
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

// PMT function
function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    if (type === 1) {
        pmt /= (1 + rate);
    }
    return pmt;
}

// Helper function to sum range of inputs
function sumInputs(prefix, numbers) {
    let sum = 0;
    for (let i of numbers) {
        const value = parseFloat(document.getElementById(prefix + i).value.replace(/,/g, '')) || 0;
        sum += value;
    }
    return sum;
}

// Calculate row 65 (sum of rows 33-62)
function calculateRow65() {
    const range = Array.from({length: 30}, (_, i) => i + 33);
    const b65 = sumInputs('B', range);
    const c65 = sumInputs('C', range);
    const d65 = sumInputs('D', range);

    document.getElementById('B65').value = formatCalculatedValue(b65);
    document.getElementById('C65').value = formatCalculatedValue(c65);
    document.getElementById('D65').value = formatCalculatedValue(d65);

    return { b65, c65, d65 };
}

// Calculate row 64
function calculateRow64() {
    const row65Values = calculateRow65();
    const b28 = parseFloat(document.getElementById('B28').value.replace(/,/g, '')) / 100 || 0;
    const c28 = parseFloat(document.getElementById('C28').value.replace(/,/g, '')) / 100 || 0;

    // Sum the ranges for expenses (B20:B27 and B29:B32)
    let b64Sum = 0, c64Sum = 0, d64Sum = 0;
    
    // Sum range 20-27
    for(let i = 20; i <= 27; i++) {
        b64Sum += parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
        c64Sum += parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
        d64Sum += parseFloat(document.getElementById('D' + i).value.replace(/,/g, '')) || 0;
    }
    
    // Sum range 29-32
    for(let i = 29; i <= 32; i++) {
        b64Sum += parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
        c64Sum += parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
        d64Sum += parseFloat(document.getElementById('D' + i).value.replace(/,/g, '')) || 0;
    }

    // Calculate final values with vacancy rate
    const b64 = (b64Sum + (row65Values.b65 * b28)) * -1;
    const c64 = (c64Sum + (row65Values.c65 * c28)) * -1;
    const d64 = (d64Sum + (row65Values.b65 * b28)) * -1; // Uses B65 and B28 as per original formula

    document.getElementById('B64').value = formatCalculatedValue(b64);
    document.getElementById('C64').value = formatCalculatedValue(c64);
    document.getElementById('D64').value = formatCalculatedValue(d64);

    return { b64, c64, d64 };
}

// Calculate row 66 (sum of rows 63-65)
function calculateRow66() {
    const row64Values = calculateRow64();
    const row65Values = calculateRow65();
    
    // Get B63/C63/D63 values (which are all equal to B10)
    const b63 = parseFloat(document.getElementById('B63').value.replace(/,/g, '')) || 0;
    const c63 = parseFloat(document.getElementById('C63').value.replace(/,/g, '')) || 0;
    const d63 = parseFloat(document.getElementById('D63').value.replace(/,/g, '')) || 0;

    // Simple sum of rows 63, 64, and 65
    const b66 = b63 + row64Values.b64 + row65Values.b65;
    const c66 = c63 + row64Values.c64 + row65Values.c65;
    const d66 = d63 + row64Values.d64 + row65Values.d65;

    document.getElementById('B66').value = formatCalculatedValue(b66);
    document.getElementById('C66').value = formatCalculatedValue(c66);
    document.getElementById('D66').value = formatCalculatedValue(d66);
}

function calculateAll() {
    try {
        // Loan Profile Calculations
        const B1 = parseFloat(document.getElementById('B1').value.replace(/,/g, '')) || 0;
        const B2 = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) / 100 || 0;
        const B6 = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0;
        const B7 = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0;
        const B8 = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0;
        const B13 = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0;
        const B14 = parseFloat(document.getElementById('B14').value.replace(/,/g, '')) || 0;

        // B3 = B1 * B2
        const B3 = B1 * B2;
        // B5 = B1 - (B1 * B2)
        const B5 = B1 - (B1 * B2);
        // B9 = B7 * B8
        const B9 = Math.round(B7 * B8); // Round to integer
        // B10 = PMT((B6/B8), B9, B5, 0)
        const B10 = PMT((B6/B8), B9, B5, 0);
        // B11 = B10 * B9
        const B11 = B10 * B9;
        // B12 = B11 + B5
        const B12 = B11 + B5;
        // B15 = (((B1 * B2) + (B1 * B13)) * -1) - B14
        const B15 = -(((B1 * B2) + (B1 * B13))) - B14;

        // Update calculated values
        document.getElementById('B3').value = formatCalculatedValue(B3);
        document.getElementById('B5').value = formatCalculatedValue(B5);
        document.getElementById('B9').value = B9.toLocaleString('en-US'); // Format integer with commas but no decimals
        document.getElementById('B10').value = formatCalculatedValue(B10);
        document.getElementById('B11').value = formatCalculatedValue(B11);
        document.getElementById('B12').value = formatCalculatedValue(B12);
        document.getElementById('B15').value = formatCalculatedValue(B15);

        // Calculate averages for all rows from 20 to 62
        for (let i = 20; i <= 62; i++) {
            const B = parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
            const C = parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
            const avg = (B + C) / 2;
            document.getElementById('D' + i).value = formatCalculatedValue(avg);
        }

        // B63, C63, D63 = B10
        document.getElementById('B63').value = formatCalculatedValue(B10);
        document.getElementById('C63').value = formatCalculatedValue(B10);
        document.getElementById('D63').value = formatCalculatedValue(B10);

        calculateRow66(); // This will trigger calculation of rows 64 and 65 as well

    } catch (error) {
        console.error('Calculation error:', error);
    }
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    const currencyInputs = document.querySelectorAll('[data-type="currency"]');
    currencyInputs.forEach(input => {
        input.addEventListener('input', () => formatCurrency(input));
        input.addEventListener('blur', () => formatCurrency(input, true));
    });

    const debouncedCalculateAll = debounce(calculateAll, 300);
    const allInputs = document.querySelectorAll('#calculator input');
    allInputs.forEach(input => {
        input.addEventListener('input', debouncedCalculateAll);
    });

    calculateAll(); // Initial calculation
});
