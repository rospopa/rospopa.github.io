// Utility functions Debounce
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
    
    // Preserve minus sign if present
    const isNegative = value.startsWith('-');
    // Remove all non-digit characters except decimal point
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
    
    // Add back the minus sign if it was present
    input.value = isNegative ? '-' + value : value;
}

function formatPercentage(input, blur) {
    let value = input.value;
    
    // If empty, do nothing
    if (!value) return;
    
    // For number input, we get a numeric value directly
    const number = parseFloat(value);
    
    // If it's a valid number, format it
    if (!isNaN(number)) {
        // Only format with decimals on blur
        input.value = blur ? number.toFixed(2) : number;
    }
}

function formatCalculatedValue(value) {
    if (isNaN(value)) return "0.00";
    // Format the absolute value and add minus sign if negative
    const absValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? "-" + absValue : absValue;
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
        const value = parseFloat(document.getElementById(prefix + i).value.replace(/,/g, ''));
        if (!isNaN(value)) {
            sum += value;
        }
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
    const d28 = parseFloat(document.getElementById('D28').value.replace(/,/g, '')) / 100 || 0;
    
    // Sum the ranges for expenses (B20:B27 and B29:B32)
    let b64Sum = 0, c64Sum = 0, d64Sum = 0;
    
    // Sum range 19-27
    for(let i = 19; i <= 27; i++) {
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

    // Sum range Custom Expense 1-9
    for(let i = 1; i <= 9; i++) {
        b64Sum += parseFloat(document.getElementById('CFB' + i).value.replace(/,/g, '')) || 0;
        c64Sum += parseFloat(document.getElementById('CFC' + i).value.replace(/,/g, '')) || 0;
        d64Sum += parseFloat(document.getElementById('CFD' + i).value.replace(/,/g, '')) || 0;
    }

    // Calculate final values with vacancy rate
    const b64 = b64Sum + (row65Values.b65 * b28 * -1);
    const c64 = c64Sum + (row65Values.c65 * c28 * -1);
    const d64 = d64Sum + (row65Values.d65 * d28 * -1); // Uses B65 and B28 as per original formula

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
        const A10 = parseFloat(document.getElementById('A10').value.replace(/,/g, '')) || 0;
        const A7 = parseFloat(document.getElementById('A7').value.replace(/,/g, '')) || 0;

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
        // B15 = (((B1*B2)+(B1*B13))*-1)-B14+A10
        const B15 = (((B1 * B2) + (B1 * B13)) * -1) - B14 + A10;
        // B22 = A7 / 12 (Monthly Tax)
        const B22 = -(A7 / 12);

        // Update calculated values
        document.getElementById('B3').value = formatCalculatedValue(B3);
        document.getElementById('B5').value = formatCalculatedValue(B5);
        document.getElementById('B9').value = B9.toLocaleString('en-US'); // Format integer with commas but no decimals
        document.getElementById('B10').value = formatCalculatedValue(B10);
        document.getElementById('B11').value = formatCalculatedValue(B11);
        document.getElementById('B12').value = formatCalculatedValue(B12);
        document.getElementById('B15').value = formatCalculatedValue(B15);
        document.getElementById('B22').value = formatCalculatedValue(B22);

        // Calculate row 65 first (sum of rows 33-62)
        const row65Values = calculateRow65();
        
        // Calculate VRB28, VRC28, VRD28 using the updated row65Values
        const B28 = parseFloat(document.getElementById('B28').value.replace(/,/g, '')) / 100 || 0;
        const C28 = parseFloat(document.getElementById('C28').value.replace(/,/g, '')) / 100 || 0;

        const VRB28 = B28 * row65Values.b65 * -1;
        const VRC28 = C28 * row65Values.c65 * -1;
        const VRD28 = (VRB28 + VRC28) / 2; // Average of VRB28 and VRC28

        document.getElementById('VRB28').value = formatCalculatedValue(VRB28);
        document.getElementById('VRC28').value = formatCalculatedValue(VRC28);
        document.getElementById('VRD28').value = formatCalculatedValue(VRD28);

        // Calculate averages for all rows from 19 to 62
        for (let i = 19; i <= 62; i++) {
            const B = parseFloat(document.getElementById('B' + i).value.replace(/,/g, '')) || 0;
            const C = parseFloat(document.getElementById('C' + i).value.replace(/,/g, '')) || 0;
            const avg = (B + C) / 2;
            document.getElementById('D' + i).value = formatCalculatedValue(avg);
        }
        
        // Calculate averages for all Custom Expanse rows from 1 to 9
        for (let i = 1; i <= 9; i++) {
            const CFB = parseFloat(document.getElementById('CFB' + i).value.replace(/,/g, '')) || 0;
            const CFC = parseFloat(document.getElementById('CFC' + i).value.replace(/,/g, '')) || 0;
            const avg = (CFB + CFC) / 2;
            document.getElementById('CFD' + i).value = formatCalculatedValue(avg);
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

// Tax Proration Calculation
function calculateTaxProration() {
    const yearDaysRemain = parseFloat(document.getElementById('A4').value.replace(/,/g, '')) || 0;
    const annualTaxAmount = parseFloat(document.getElementById('A7').value.replace(/,/g, '')) || 0;
    const isPercentageBased = document.getElementById('A8').checked;
    const taxProrationRate = parseFloat(document.getElementById('A9').value) / 100 || 0;
    let prorationAmount;

    if (isPercentageBased) {
        prorationAmount = annualTaxAmount * taxProrationRate;
    } else {
        prorationAmount = (annualTaxAmount / 365) * yearDaysRemain;
    }

    document.getElementById('A10').value = formatCalculatedValue(prorationAmount);
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Expense fields that should have minus sign behavior
    const expenseFields = [
        'B19', 'C19', 'D19', 'B20', 'C20', 'D20', 'B21', 'C21', 'D21', 'B22', 'C22', 'D22',
        'B23', 'C23', 'D23', 'B24', 'C24', 'D24', 'B25', 'C25', 'D25',
        'B26', 'C26', 'D26', 'B27', 'C27', 'D27', 'B29', 'C29', 'D29',
        'B30', 'C30', 'D30', 'B31', 'C31', 'D31', 'B32', 'C32', 'D32',
        'CFB1', 'CFC1', 'CFD1', 'CFB2', 'CFC2', 'CFD2', 'CFB3', 'CFC3', 'CFD3', 
        'CFB4', 'CFC4', 'CFD4', 'CFB5', 'CFC5', 'CFD5', 'CFB6', 'CFC6', 'CFD6', 
        'CFB7', 'CFC7', 'CFD7', 'CFB8', 'CFC8', 'CFD8', 'CFB9', 'CFC9', 'CFD9'
    ];

    // Gross Expenses fields (B and C columns only)
    const grossExpenseFields = [
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32',
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9',
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32',
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9'
    ];
    
    // Add focus and blur events for expense fields
    expenseFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Remove the currency data-type if it exists
            input.removeAttribute('data-type');
            input.addEventListener('focus', function() {
                let value = this.value.replace(/,/g, '');
                if (!value || value === '0.00') {
                    this.value = '-';
                } else {
                    // Remove formatting but keep the minus sign if present
                    value = value.replace(/[^\d.-]/g, '');
                    // Ensure there's a minus sign
                    if (!value.startsWith('-')) {
                        value = '-' + value;
                    }
                    this.value = value;
                }
            });

            input.addEventListener('input', function(e) {
                let value = this.value;
                // Remove any existing minus signs
                value = value.replace(/-/g, '');
                // Always add a minus sign at the start
                value = '-' + value;
                
                // If this is a gross expense field, apply formatting while typing
                if (grossExpenseFields.includes(this.id)) {
                    // Remove non-digits except decimal point
                    value = value.replace(/[^\d.-]/g, '');
                    
                    // Format with commas if there are digits
                    if (value !== '-') {
                        const parts = value.substring(1).split('.');
                        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                        value = '-' + parts.join('.');
                    }
                }
                
                this.value = value;
            });

            input.addEventListener('blur', function() {
                let value = this.value.replace(/,/g, '');
                // Only remove minus sign if it's the only character
                if (value === '-') {
                    this.value = '';
                } else if (value) {
                    // Format the value while ensuring it stays negative
                    value = value.replace(/[^\d.-]/g, '');
                    // Make sure the value is negative
                    value = -Math.abs(parseFloat(value) || 0);
                    this.value = formatCalculatedValue(value);
                }
                calculateAll();
            });

            // Initial formatting to ensure negative values
            const currentValue = input.value.replace(/,/g, '');
            if (currentValue && currentValue !== '0.00') {
                input.value = formatCalculatedValue(-Math.abs(parseFloat(currentValue)));
            }
        }
    });

    // Set up event listeners for currency inputs
    const currencyInputs = document.querySelectorAll('input[type="text"]');
    currencyInputs.forEach(input => {
        // Skip percentage fields and custom field name inputs
        if (!['B2', 'B6', 'B13', 'B28', 'C28', 'autocomplete'].includes(input.id) && 
            !input.id.startsWith('CFN')) {  // Exclude CFN1-CFN9 inputs
            input.addEventListener('input', () => formatCurrency(input, false));
            input.addEventListener('blur', () => formatCurrency(input, true));
        }
    });

    // Set up event listeners for percentage inputs
    const percentageInputs = ['B2', 'B6', 'B13', 'B28', 'C28'];
    percentageInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Set attributes for number input
            input.setAttribute('type', 'number');
            input.setAttribute('step', '0.01');
            input.setAttribute('min', '0');
            input.setAttribute('max', '100');
            
            input.addEventListener('input', function() {
                calculateAll();
            });
            
            input.addEventListener('blur', function() {
                if (this.value) {
                    this.value = parseFloat(this.value).toFixed(2);
                }
                calculateAll();
            });
        }
    });

    // Remove any formatting from custom field name inputs
    const customFieldNames = ['CFN1', 'CFN2', 'CFN3', 'CFN4', 'CFN5', 'CFN6', 'CFN7', 'CFN8', 'CFN9', 'autocomplete'];
    customFieldNames.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'text');
        }
    });

    const debouncedCalculateAll = debounce(calculateAll, 300);
    const allInputs = document.querySelectorAll('#calculator input');
    allInputs.forEach(input => {
        input.addEventListener('input', debouncedCalculateAll);
    });

    // Tax Proration Fields Setup
    const yearDaysRemainInput = document.getElementById('A4');
    const annualTaxInput = document.getElementById('A7');
    const taxProrationCheckbox = document.getElementById('A8');
    const taxProrationRateInput = document.getElementById('A9');

    if (yearDaysRemainInput) {
        yearDaysRemainInput.addEventListener('input', debounce(() => {
            const value = yearDaysRemainInput.value.replace(/,/g, '');
            yearDaysRemainInput.value = formatNumber(value);
            calculateTaxProration();
        }, 300));
    }

    if (annualTaxInput) {
        annualTaxInput.addEventListener('input', debounce((e) => {
            formatCurrency(annualTaxInput, false);
            calculateTaxProration();
        }, 300));
        annualTaxInput.addEventListener('blur', (e) => {
            formatCurrency(annualTaxInput, true);
            calculateTaxProration();
        });
    }

    if (taxProrationRateInput) {
        taxProrationRateInput.addEventListener('input', debounce((e) => {
            formatPercentage(taxProrationRateInput, false);
            calculateTaxProration();
        }, 300));
        taxProrationRateInput.addEventListener('blur', (e) => {
            formatPercentage(taxProrationRateInput, true);
            calculateTaxProration();
        });
    }

    if (taxProrationCheckbox) {
        taxProrationCheckbox.addEventListener('change', calculateTaxProration);
    }

    calculateAll(); // Initial calculation
});
