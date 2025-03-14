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
        const A8 = parseFloat(document.getElementById('A8').value.replace(/,/g, '')) || 0;
        const A5 = parseFloat(document.getElementById('A5').value.replace(/,/g, '')) || 0;

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
        // B15 = (((B1*B2)+(B1*B13))*-1)-B14+A8
        const B15 = (((B1 * B2) + (B1 * B13)) * -1) - B14 + A8;
        // B22 = A5 / 12 (Monthly Tax)
        const B22 = -(A5 / 12);

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
function calculateA5_2() {
    const a5 = parseFloat(document.getElementById('A5').value.replace(/,/g, '')) || 0;
    const a4 = parseFloat(document.getElementById('A4').value) || 0;
    const a4_2 = parseFloat(document.getElementById('A4_2').value) || 0;
    
    const result = a5 / (a4 + a4_2);
    document.getElementById('A5_2').value = formatCalculatedValue(result);
    return result;
}

function calculateA8() {
    const dateInputB4 = document.getElementById('B4');
    const selectedDateB4 = new Date(dateInputB4.value);
    const radioArrears = document.getElementById('Arrears');
    const radioAdvance = document.getElementById('Advance');
    const dateInputA10 = document.getElementById('A10');
    const dateInputA14 = document.getElementById('A14');
    let selectedDateCompare;
    let result = 0;

    const a5 = parseFloat(document.getElementById('A5').value.replace(/,/g, '')) || 0;
    const a4 = parseFloat(document.getElementById('A4').value) || 0;
    const a4_2 = parseFloat(document.getElementById('A4_2').value) || 0;
    const a7 = document.getElementById('A7').value === '' ? 0 : (parseFloat(document.getElementById('A7').value) / 100 || 0);
    const a11 = parseFloat(document.getElementById('A11').value.replace(/,/g, '')) || 0;

    if (radioArrears.checked) {
        selectedDateCompare = new Date(dateInputA10.value);
        if (!isNaN(selectedDateB4) && !isNaN(selectedDateCompare)) {
            const diffDays = (selectedDateCompare - selectedDateB4) / (1000 * 3600 * 24);
            result = ((a5 / (a4 + a4_2)) * diffDays) * a7 + a11;
            result = Math.abs(result);
        }
    } else if (radioAdvance.checked) {
        selectedDateCompare = new Date(dateInputA14.value);
        if (!isNaN(selectedDateB4) && !isNaN(selectedDateCompare)) {
            const diffDays = (selectedDateCompare - selectedDateB4) / (1000 * 3600 * 24);
            if (selectedDateCompare.getFullYear() === selectedDateB4.getFullYear()) {
                result = (a5 / (a4 + a4_2)) * diffDays + a11;
            } else {
                result = (a5 / (a4 + a4_2)) * diffDays * a7 + a11;
            }
            result = -Math.abs(result);
        }
    }

    document.getElementById('A8').value = formatCalculatedValue(result);
    calculateAll(); // Trigger full recalculation
}

// Add new function for date calculations
function calculateDates(selectedDate) {
    if (isNaN(selectedDate)) {
        document.getElementById('A4').value = "";
        document.getElementById('A4_2').value = "";
        return;
    }

    const currentYear = selectedDate.getFullYear();
    
    // Calculate days to end of year
    const lastDayOfYear = new Date(currentYear, 11, 31);
    const differenceToEndOfYearTime = lastDayOfYear.getTime() - selectedDate.getTime();
    const differenceToEndOfYearDays = Math.ceil(differenceToEndOfYearTime / (1000 * 3600 * 24));
    document.getElementById('A4').value = differenceToEndOfYearDays;

    // Calculate days from start of year
    const startOfYear = new Date(currentYear, 0, 1);
    const differenceFromStartOfYearTime = selectedDate.getTime() - startOfYear.getTime();
    const differenceFromStartOfYearDays = Math.ceil(differenceFromStartOfYearTime / (1000 * 3600 * 24));
    document.getElementById('A4_2').value = differenceFromStartOfYearDays;
}

function calculateDateDifference() {
    const dateInputB4 = document.getElementById('B4');
    const selectedDateB4 = new Date(dateInputB4.value);
    const radioArrears = document.getElementById('Arrears');
    const radioAdvance = document.getElementById('Advance');
    const dateInputA10 = document.getElementById('A10');
    const dateInputA14 = document.getElementById('A14');
    const resultInputA10_2 = document.getElementById('A10_2');

    let selectedDateCompare;

    if (radioArrears.checked) {
        selectedDateCompare = new Date(dateInputA10.value);
    } else if (radioAdvance.checked) {
        selectedDateCompare = new Date(dateInputA14.value);
    } else {
        resultInputA10_2.value = "";
        return;
    }

    if (isNaN(selectedDateB4) || isNaN(selectedDateCompare)) {
        resultInputA10_2.value = "";
        return;
    }

    const differenceInTime = selectedDateCompare.getTime() - selectedDateB4.getTime();
    const differenceInDays = Math.abs(Math.ceil(differenceInTime / (1000 * 3600 * 24)));
    resultInputA10_2.value = differenceInDays;
}

// Set up event listeners
document.addEventListener('DOMContentLoaded', () => {
    // Configure input fields
    const currencyInputs = [
        'B1', 'B3', 'B5', 'B10', 'B11', 'B12', 'B14', 'B15', 'A5', 'A5_2', 'A8',
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32',
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32',
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9',
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9'
    ];

    // Configure percentage inputs
    const percentageInputs = [
        'B2', 'B6', 'B13', 'B28', 'C28', 'D28', 'A7',
    ];
    
    // Set up calculation triggers
    const calculationTriggers = [
        'B1', 'B2', 'B6', 'B7', 'B8', 'B13', 'B14', 'A4', 'A4_2', 'A5', 'A5_2', 'A7', 'A8',
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32',
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32',
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9',
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9'
    ];

    // Configure input elements
    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'currency');
            if (id === 'A8') {
                input.readOnly = true;
            }
            input.addEventListener('input', function(e) {
                formatCurrency(e.target);
            });
            input.addEventListener('blur', function(e) {
                formatCurrency(e.target, true);
            });
        }
    });

    // Set up percentage inputs
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
    const annualTaxInput = document.getElementById('A5');
    const taxProrationRateInput = document.getElementById('A7');
    const dateInput = document.getElementById('B4');

    if (yearDaysRemainInput) {
        yearDaysRemainInput.addEventListener('input', debounce(() => {
            const value = yearDaysRemainInput.value.replace(/,/g, '');
            yearDaysRemainInput.value = formatNumber(value);
            calculateTaxProration();
        }, 300));
    }

    if (annualTaxInput) {
        // Function to reset tooltip and styles
        const resetTooltipAndStyles = () => {
            const tooltip = document.getElementById('date-tooltip');
            if (tooltip) {
                tooltip.style.display = 'none';
            }
            dateInput.style.backgroundColor = '';
            dateInput.style.borderColor = '';
        };

        annualTaxInput.addEventListener('input', debounce((e) => {
            const yearDaysRemainInput = document.getElementById('A4');
            
            // Check if A4 is empty and A5 has a value
            if (!yearDaysRemainInput.value && annualTaxInput.value) {
                dateInput.style.backgroundColor = '#fff3cd';
                dateInput.style.borderColor = '#ffeeba';
                
                // Create tooltip element if it doesn't exist
                let tooltip = document.getElementById('date-tooltip');
                if (!tooltip) {
                    tooltip = document.createElement('div');
                    tooltip.id = 'date-tooltip';
                    document.body.appendChild(tooltip);
                    
                    // Add tooltip styles if they don't exist
                    if (!document.getElementById('tooltip-styles')) {
                        const style = document.createElement('style');
                        style.id = 'tooltip-styles';
                        style.textContent = `
                            #date-tooltip {
                                position: fixed;
                                background: #333;
                                color: white;
                                padding: 5px 10px;
                                border-radius: 4px;
                                font-size: 14px;
                                pointer-events: none;
                                z-index: 1000;
                                display: none;
                            }
                        `;
                        document.head.appendChild(style);
                    }
                }
                
                // Position and show tooltip
                const rect = dateInput.getBoundingClientRect();
                tooltip.style.left = rect.left + (rect.width / 2) - (tooltip.offsetWidth / 2) + 'px';
                tooltip.style.top = (rect.top - 30) + 'px';
                tooltip.textContent = 'Please select a date first';
                tooltip.style.display = 'block';
                
                // Reset A5 value
                annualTaxInput.value = '';
                return;
            } else {
                resetTooltipAndStyles();
            }
            
            formatCurrency(annualTaxInput, false);
        }, 300));

        // Add blur event handler
        annualTaxInput.addEventListener('blur', resetTooltipAndStyles);
    }

    if (taxProrationRateInput) {
        taxProrationRateInput.addEventListener('input', debounce((e) => {
            formatPercentage(taxProrationRateInput, false);
        }, 300));
        taxProrationRateInput.addEventListener('blur', (e) => {
            formatPercentage(taxProrationRateInput, true);
        });
    }

    ['A4', 'A4_2', 'A5'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', debounce(() => {
                calculateA5_2();
                calculateA8();
                calculateAll();
            }, 500));
        }
    });

    ['A7'].forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('input', debounce(() => {
                calculateA8();
                calculateAll();
            }, 500));
        }
    });

    // Add new event listeners for date and tax calculations
    const dateInputB4 = document.getElementById('B4');
    if (dateInputB4) {
        dateInputB4.addEventListener('change', function() {
            calculateDates(new Date(this.value));
            calculateA8();
        });
    }

    const dateInputs = ['A10', 'A14'];
    dateInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.addEventListener('change', function() {
                calculateDateDifference();
                calculateA8();
            });
        }
    });

    const radioButtons = ['Arrears', 'Advance'];
    radioButtons.forEach(id => {
        const radio = document.getElementById(id);
        if (radio) {
            radio.addEventListener('change', function() {
                calculateDateDifference();
                calculateA8();
            });
        }
    });

    // Add event listener for A11 (if it exists)
    const inputA11 = document.getElementById('A11');
    if (inputA11) {
        inputA11.addEventListener('input', calculateA8);
    }

    calculateAll(); // Initial calculation
});
