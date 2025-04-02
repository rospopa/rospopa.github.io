// Global variable to track the last edited down payment field
let lastEditedDownPaymentField = 'B2'; // Default to rate being the driver

// Utility functions Debounce
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Removes non-digit characters and adds commas
function formatNumber(n) {
    return n.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Formats input field as currency, handling negatives and decimals
function formatCurrency(input, blur) {
    let value = input.value;
    if (!value) {
        // Clear field if empty on blur, unless it's an expense field starting with '-'
        if (blur && !(input.dataset.isExpense === 'true' && value === '-')) {
             input.value = '';
        }
        return;
    }
    const isNegative = value.startsWith('-');
    // Remove all non-digit characters except decimal point
    value = value.replace(/[^\d.]/g, "");

     // Handle cases where only '-' remains or value is empty after stripping
     if (value === '' && isNegative) {
        if (blur) {
             input.value = ''; // Clear on blur if only '-' remains
        } else {
             input.value = '-'; // Keep '-' while typing
        }
        return;
    }
     if (value === '') { // Value became empty after stripping non-digits
         input.value = '';
         return;
     }

    // Format number with commas and handle decimals
    if (value.indexOf(".") >= 0) {
        let [left, right] = value.split(".");
        left = formatNumber(left);
        right = right.slice(0, 2);
        value = left + "." + right;
    } else {
        value = formatNumber(value);
        // Add .00 on blur only if there's a value and it's not just "-"
        if (blur && value !== '') {
            value += ".00";
        }
    }

    // Re-apply minus sign consistently
    if (input.dataset.isExpense === 'true' && value !== '' && value !== '0.00') {
        input.value = '-' + value.replace(/-/g, ''); // Ensure only one leading minus for expenses
    } else if (isNegative && value !== '' && value !== '0.00') {
         input.value = '-' + value.replace(/-/g, ''); // Ensure only one leading minus if originally negative
     } else {
        input.value = value.replace(/-/g, ''); // Ensure no minus sign for positive values
    }
}


// Formats percentage inputs (assuming they are type="number")
function formatPercentage(input, blur) {
    let value = input.value;
    if (!value) {
        if(blur) input.value = ''; // Clear if empty on blur
        return;
    }

    const number = parseFloat(value);
    if (!isNaN(number)) {
        // Only format with two decimals on blur
        input.value = blur ? number.toFixed(2) : number;
    } else {
        // If somehow it's not a number
        if (blur) input.value = '';
    }
}

// Formats calculated values for display (currency style)
function formatCalculatedValue(value) {
    // Check for NaN, null, undefined, or Infinity
    if (isNaN(value) || value === null || typeof value === 'undefined' || !isFinite(value)) {
        return "0.00"; // Return "0.00" for invalid results
    }

    // Format the absolute value with commas and 2 decimal places
    const absValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Add minus sign if the original value was negative (and not zero)
    return (value < 0) ? "-" + absValue : absValue;
}


// PMT function (standard loan payment calculation)
function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) {
        // Handle zero interest rate scenario
        return (nper === 0) ? 0 : -(pv + fv) / nper;
    }
    // Calculate payment using the standard formula
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    // Adjust if payments are due at the beginning of the period
    if (type === 1) {
        pmt /= (1 + rate);
    }
    return pmt;
}

// Helper function to sum range of inputs by ID prefix and numbers
function sumInputs(prefix, numbers) {
    let sum = 0;
    for (let i of numbers) {
        const element = document.getElementById(prefix + i);
        if (element && element.value) {
             // Remove commas and currency symbols ($) for calculation, keep minus sign and decimal
            const value = parseFloat(element.value.replace(/[^-\d.]/g, ''));
             if (!isNaN(value)) {
                sum += value;
            }
        }
    }
    return sum;
}

// Calculate row 65 (Monthly Revenue) - Returns calculated values
function calculateRow65() {
    const standardRange = Array.from({length: 30}, (_, i) => i + 33); // Units B33-B62, Parking C33-C62
    const customRange = Array.from({length: 9}, (_, i) => i + 1); // Custom Rev CFRB1-9, CFRC1-9

    // --- Calculate Averages first ('D' column) ---
    for (let i = 33; i <= 62; i++) { // Standard Revenue Rows B/C -> D
        const B = parseFloat(document.getElementById('B' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
        const C = parseFloat(document.getElementById('C' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
        document.getElementById('D' + i).value = formatCalculatedValue((B + C) / 2);
    }
    for (let i = 1; i <= 9; i++) { // Custom Revenue Rows B/C -> D
        const CFRB = parseFloat(document.getElementById('CFRB' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
        const CFRC = parseFloat(document.getElementById('CFRC' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
        document.getElementById('CFRD' + i).value = formatCalculatedValue((CFRB + CFRC) / 2);
    }

    // --- Sum values for each column ---
    const b65 = sumInputs('B', standardRange) + sumInputs('CFRB', customRange);
    const c65 = sumInputs('C', standardRange) + sumInputs('CFRC', customRange);
    const d65 = sumInputs('D', standardRange) + sumInputs('CFRD', customRange); // Use calculated D column

    const ARmin = b65 * 12;
    const ARmax = c65 * 12;
    const ARavg = d65 * 12;

    // Update Monthly Revenue display fields
    document.getElementById('B65').value = formatCalculatedValue(b65);
    document.getElementById('C65').value = formatCalculatedValue(c65);
    document.getElementById('D65').value = formatCalculatedValue(d65);
    // Update Annual Revenue display fields
    document.getElementById('AR-min').value = formatCalculatedValue(ARmin);
    document.getElementById('AR-max').value = formatCalculatedValue(ARmax);
    document.getElementById('AR-avg').value = formatCalculatedValue(ARavg);

    // Return calculated values
    return { b65, c65, d65, ARmin, ARmax, ARavg }; // Return numeric values
}

// Calculate row 64 (Monthly Expenses, including Vacancy) - Receives revenue, returns expenses
function calculateRow64(revenueResults) { // Takes revenue object as input
    const { b65, c65, d65 } = revenueResults; // Destructure needed revenue values

    // --- Calculate Averages first ('D' column for expenses) ---
    for (let i = 19; i <= 32; i++) {
         if (i === 28) continue; // Skip Vacancy Rate % row (handled separately)
         const B_val = document.getElementById('B' + i)?.value;
         const C_val = document.getElementById('C' + i)?.value;
         // Check if B22 is readonly, if so, don't average based on B/C
         const bInput = document.getElementById('B' + i);
         const cInput = document.getElementById('C' + i);
         const dInput = document.getElementById('D' + i);

         // Only average if the target D field is not readonly itself
         if (dInput && !dInput.readOnly) {
            const B = parseFloat(B_val?.replace(/[^-\d.]/g, '')) || 0;
            const C = parseFloat(C_val?.replace(/[^-\d.]/g, '')) || 0;
            dInput.value = formatCalculatedValue((B + C) / 2);
         } else if (i === 22 && dInput) {
             // Specifically handle D22 (Avg Property Tax) - it should mirror B22 if B22 is calculated/readonly
             const B22_input = document.getElementById('B22');
             if (B22_input) {
                 dInput.value = B22_input.value; // Make D22 match B22 (already formatted)
             }
         }
     }
     for (let i = 1; i <= 9; i++) { // Custom Expenses B/C -> D
         const CFB = parseFloat(document.getElementById('CFB' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         const CFC = parseFloat(document.getElementById('CFC' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         document.getElementById('CFD' + i).value = formatCalculatedValue((CFB + CFC) / 2);
     }

     // Average Vacancy Rate % (Row 28)
     const b28_rate_val = parseFloat(document.getElementById('B28')?.value.replace(/,/g, '')) || 0;
     const c28_rate_val = parseFloat(document.getElementById('C28')?.value.replace(/,/g, '')) || 0;
     const avg_rate_val = (b28_rate_val + c28_rate_val) / 2;
     document.getElementById('D28').value = avg_rate_val.toFixed(2); // Update display for D28

     const b28_rate = b28_rate_val / 100;
     const c28_rate = c28_rate_val / 100;
     const d28_rate = avg_rate_val / 100; // Use the calculated average rate

    // Calculate vacancy loss (as a negative value) using passed-in revenues
    const vacancyLossB = b65 * b28_rate * -1;
    const vacancyLossC = c65 * c28_rate * -1;
    const vacancyLossD = d65 * d28_rate * -1; // Use average revenue and average rate

    // Update Vacancy Risk display fields
    document.getElementById('VRB28').value = formatCalculatedValue(vacancyLossB);
    document.getElementById('VRC28').value = formatCalculatedValue(vacancyLossC);
    document.getElementById('VRD28').value = formatCalculatedValue(vacancyLossD);

    // Sum the standard operating expense ranges
    const standardRange1 = Array.from({length: 9}, (_, i) => i + 19); // 19-27
    const standardRange2 = Array.from({length: 4}, (_, i) => i + 29); // 29-32
    const customRange = Array.from({length: 9}, (_, i) => i + 1);    // CFB1-9, CFC1-9, CFD1-9

    // Calculate base operating expenses using updated 'D' columns as well
    const b_base_expenses = sumInputs('B', standardRange1) + sumInputs('B', standardRange2) + sumInputs('CFB', customRange);
    const c_base_expenses = sumInputs('C', standardRange1) + sumInputs('C', standardRange2) + sumInputs('CFC', customRange);
    // Sum D column (average column) - includes D22 mirroring B22
    const d_base_expenses = sumInputs('D', standardRange1) + sumInputs('D', standardRange2) + sumInputs('CFD', customRange);

    // Calculate final Monthly Expense (Base Expenses + Vacancy Loss)
    const b64 = b_base_expenses + vacancyLossB;
    const c64 = c_base_expenses + vacancyLossC;
    const d64 = d_base_expenses + vacancyLossD; // Use average base expense + average vacancy loss
    const AEmin = b64 * 12;
    const AEmax = c64 * 12;
    const AEavg = d64 * 12;

    // Update Monthly Expense display fields
    document.getElementById('B64').value = formatCalculatedValue(b64);
    document.getElementById('C64').value = formatCalculatedValue(c64);
    document.getElementById('D64').value = formatCalculatedValue(d64);
    // Update Annual Expense display fields
    document.getElementById('AE-min').value = formatCalculatedValue(AEmin);
    document.getElementById('AE-max').value = formatCalculatedValue(AEmax);
    document.getElementById('AE-avg').value = formatCalculatedValue(AEavg);

    // Return calculated expense values
    return { b64, c64, d64, AEmin, AEmax, AEavg }; // Return numeric values
}

// Calculate row 66 (Net Cash Flow = NOI - Monthly Payment) - Receives dependencies, returns results
function calculateRow66(revenueResults, expenseResults, monthlyPayment) {
    const { b65, c65, d65 } = revenueResults;
    const { b64, c64, d64 } = expenseResults;

    // Ensure monthly payment is treated as an expense (positive value to be subtracted)
    const paymentExpense = Math.abs(monthlyPayment);

    // Calculate Net Operating Income (NOI = Revenue + Expenses [since expenses are negative])
    const noiMin = b65 + b64;
    const noiMax = c65 + c64;
    const noiAvg = d65 + d64;

    // Update NOI display fields
    document.getElementById('NOI-min').value = formatCalculatedValue(noiMin);
    document.getElementById('NOI-max').value = formatCalculatedValue(noiMax);
    document.getElementById('NOI-avg').value = formatCalculatedValue(noiAvg);

    // Calculate Cash Flow (NOI - Monthly Payment)
    const b66 = noiMin - paymentExpense;
    const c66 = noiMax - paymentExpense;
    const d66 = noiAvg - paymentExpense;

    // Update Cash Flow display fields
    document.getElementById('B66').value = formatCalculatedValue(b66);
    document.getElementById('C66').value = formatCalculatedValue(c66);
    document.getElementById('D66').value = formatCalculatedValue(d66);

    // Return NOI and CashFlow values
     return { noiMin, noiMax, noiAvg, b66, c66, d66 }; // Return numeric values
}

// Main calculation function triggered on input changes - Handles B2/B3 two-way calculation
function calculateAll() {
    try {
        // --- 1. Parse Input Values ---
        const B1_PurchasePrice = parseFloat(document.getElementById('B1').value.replace(/[^-\d.]/g, '')) || 0;
        // --- Read both B2 and B3 ---
        let B2_DownPayRate_Input = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) || 0; // Read raw number
        let B3_DownPayAmount_Input = parseFloat(document.getElementById('B3').value.replace(/[^-\d.]/g, '')) || 0;

        // --- >>> B2 / B3 Two-Way Calculation <<< ---
        let B2_DownPayRate; // Rate (e.g., 0.20)
        let B3_DownPayAmount; // Amount

        const b2Input = document.getElementById('B2');
        const b3Input = document.getElementById('B3');

        if (lastEditedDownPaymentField === 'B2') {
            // User edited Rate (B2), calculate Amount (B3)
            B2_DownPayRate = B2_DownPayRate_Input / 100; // Convert percentage input to rate
            B3_DownPayAmount = B1_PurchasePrice * B2_DownPayRate;
            // Update B3 display *without* triggering loop
            const currentB3Formatted = formatCalculatedValue(B3_DownPayAmount);
            if (b3Input.value !== currentB3Formatted) { // Avoid unnecessary DOM updates
                b3Input.value = currentB3Formatted;
            }
        } else if (lastEditedDownPaymentField === 'B3') {
            // User edited Amount (B3), calculate Rate (B2)
            B3_DownPayAmount = B3_DownPayAmount_Input;
            B2_DownPayRate = (B1_PurchasePrice !== 0) ? (B3_DownPayAmount / B1_PurchasePrice) : 0;
            // Update B2 display *without* triggering loop
            const b2ValueToSet = B2_DownPayRate * 100; // Store the percentage value
            // Check against current parsed value to prevent jitter from minor floating point diffs
            const currentB2Parsed = parseFloat(b2Input.value.replace(/,/g, ''));
            if (isNaN(currentB2Parsed) || Math.abs(currentB2Parsed - b2ValueToSet) > 0.001) {
                 b2Input.value = b2ValueToSet.toFixed(2); // Set with 2 decimals initially for consistency
            }
             // Let the blur listener handle final formatting if needed (though .toFixed(2) might suffice)
        } else {
            // Default case (e.g., initial load, reset) - Prefer B2 if available
             B2_DownPayRate = B2_DownPayRate_Input / 100;
             B3_DownPayAmount = B1_PurchasePrice * B2_DownPayRate;
             if (B1_PurchasePrice !== 0 && B3_DownPayAmount === 0 && B3_DownPayAmount_Input !== 0) {
                 // If B2 was 0 or empty, but B3 had a value, calculate B2 from B3 instead
                 B3_DownPayAmount = B3_DownPayAmount_Input;
                 B2_DownPayRate = B3_DownPayAmount / B1_PurchasePrice;
                 b2Input.value = (B2_DownPayRate * 100).toFixed(2);
                 b3Input.value = formatCalculatedValue(B3_DownPayAmount); // Update B3 display as well
             } else {
                  // Update B3 based on B2 (or both are 0)
                 const currentB3Formatted = formatCalculatedValue(B3_DownPayAmount);
                 if (b3Input.value !== currentB3Formatted) {
                    b3Input.value = currentB3Formatted;
                 }
             }
        }
        // --- >>> END B2 / B3 Two-Way Calculation <<< ---

        // --- Continue with other parsing ---
        const B6_InterestRate = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0;
        const B7_LoanTermYears = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0;
        const B8_PaymentsPerYear = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0;
        const B13_ClosingCostRate = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0;
        const B14_Inspection = parseFloat(document.getElementById('B14').value.replace(/[^-\d.]/g, '')) || 0;
        const A5_AnnualTax = parseFloat(document.getElementById('A5').value.replace(/[^-\d.]/g, '')) || 0;
        // const A7_Depreciation = parseFloat(document.getElementById('A7').value.replace(/[^-\d.]/g, '')) || 0; // Not used in calcs
        const A8_TaxProration = parseFloat(document.getElementById('A8').value.replace(/[^-\d.]/g, '')) || 0;
        const A10_Escrow = parseFloat(document.getElementById('A10').value.replace(/[^-\d.]/g, '')) || 0;
        const A11_Encumbrances = parseFloat(document.getElementById('A11').value.replace(/[^-\d.]/g, '')) || 0;
        const A12_Allowances = parseFloat(document.getElementById('A12').value.replace(/[^-\d.]/g, '')) || 0;

        // --- 2. Calculate Intermediate Loan Profile Values ---
        // Use the determined B3_DownPayAmount
        const B5_LoanAmount = B1_PurchasePrice - B3_DownPayAmount;
        const B9_TotalPayments = Math.round(B7_LoanTermYears * B8_PaymentsPerYear);
        const periodicRate = (B8_PaymentsPerYear > 0) ? B6_InterestRate / B8_PaymentsPerYear : 0;
        const B10_PaymentPerPeriod = (B5_LoanAmount > 0 && B9_TotalPayments > 0) ? PMT(periodicRate, B9_TotalPayments, -B5_LoanAmount, 0) : 0; // Handle no loan case
        const B11_TotalLoanCost = B10_PaymentPerPeriod * B9_TotalPayments;
        // Ensure Interest Cost isn't negative due to rounding or edge cases
        const B12_InterestCost = (B11_TotalLoanCost >= B5_LoanAmount) ? B11_TotalLoanCost - B5_LoanAmount : 0;

        // --- 3. Calculate B15 (Cash to Close) ---
        // Use the determined B3_DownPayAmount
        const closingCostsEst = B1_PurchasePrice * B13_ClosingCostRate;
        // Simplified: Assumes Proration/Allowances are credits (-) and others are costs (+)
        const B15_CashToClose = B3_DownPayAmount + closingCostsEst + Math.abs(B14_Inspection) + Math.abs(A10_Escrow) + Math.abs(A11_Encumbrances) - Math.abs(A8_TaxProration) - Math.abs(A12_Allowances);

        // --- 4. Calculate Other Base Values ---
        const B22_MonthlyTax = (A5_AnnualTax / 12) * -1; // Monthly Property Tax Expense

        // --- 5. Update Display for Initial Calculated Inputs ---
        // B3 and B2 were potentially updated above. Update the rest.
        document.getElementById('B5').value = formatCalculatedValue(B5_LoanAmount);
        document.getElementById('B9').value = B9_TotalPayments.toLocaleString('en-US');
        document.getElementById('B10').value = formatCalculatedValue(B10_PaymentPerPeriod);
        document.getElementById('B11').value = formatCalculatedValue(B11_TotalLoanCost);
        document.getElementById('B12').value = formatCalculatedValue(B12_InterestCost);
        document.getElementById('B15').value = formatCalculatedValue(B15_CashToClose);
        document.getElementById('B22').value = formatCalculatedValue(B22_MonthlyTax); // Update B22 display

        // --- 6. Calculate Revenue, Expenses, Cash Flow by Calling Helpers ---
        const revenueResults = calculateRow65();
        const expenseResults = calculateRow64(revenueResults);
        const cashFlowResults = calculateRow66(revenueResults, expenseResults, B10_PaymentPerPeriod);

        // --- 7. Extract Needed Results from Returned Objects ---
        const { b65, c65, d65 } = revenueResults;
        const { noiMin, noiMax, noiAvg, b66, c66, d66 } = cashFlowResults;
        const cashInvested = Math.abs(B15_CashToClose); // Use the calculated variable
        const annualDebtService = Math.abs(B10_PaymentPerPeriod * 12); // Use calculated variable

        // --- 8. Calculate and Display Summary Metrics ---

        // GRM (Gross Rental Multiplier = Annual Revenue / Purchase Price * 100)
        let grmMin = 0, grmMax = 0, grmAvg = 0;
        if (B1_PurchasePrice !== 0) {
            grmMin = (b65 * 12) / B1_PurchasePrice * 100;
            grmMax = (c65 * 12) / B1_PurchasePrice * 100;
            grmAvg = (d65 * 12) / B1_PurchasePrice * 100;
        }
        document.getElementById('GRM-min').value = isFinite(grmMin) ? grmMin.toFixed(2) : "0.00";
        document.getElementById('GRM-max').value = isFinite(grmMax) ? grmMax.toFixed(2) : "0.00";
        document.getElementById('GRM-avg').value = isFinite(grmAvg) ? grmAvg.toFixed(2) : "0.00";

        // Cap Rate (CR = Annual NOI / Purchase Price * 100)
        let crMin = 0, crMax = 0, crAvg = 0;
        if (B1_PurchasePrice !== 0) {
            crMin = (noiMin * 12) / B1_PurchasePrice * 100;
            crMax = (noiMax * 12) / B1_PurchasePrice * 100;
            crAvg = (noiAvg * 12) / B1_PurchasePrice * 100;
        }
        document.getElementById('CR-min').value = isFinite(crMin) ? crMin.toFixed(2) : "0.00";
        document.getElementById('CR-max').value = isFinite(crMax) ? crMax.toFixed(2) : "0.00";
        document.getElementById('CR-avg').value = isFinite(crAvg) ? crAvg.toFixed(2) : "0.00";

        // Cash-on-Cash Return (CCR = Annual Cash Flow / Cash Invested * 100)
        let ccrMin = 0, ccrMax = 0, ccrAvg = 0;
        if (cashInvested !== 0) {
            ccrMin = (b66 * 12) / cashInvested * 100;
            ccrMax = (c66 * 12) / cashInvested * 100;
            ccrAvg = (d66 * 12) / cashInvested * 100;
        }
        document.getElementById('CCR-min').value = isFinite(ccrMin) ? ccrMin.toFixed(2) : "0.00";
        document.getElementById('CCR-max').value = isFinite(ccrMax) ? ccrMax.toFixed(2) : "0.00";
        document.getElementById('CCR-avg').value = isFinite(ccrAvg) ? ccrAvg.toFixed(2) : "0.00";

         // DSCR (Debt Service Coverage Ratio = Annual NOI / Annual Debt Service)
         let dscrMin = 0, dscrMax = 0, dscrAvg = 0;
         let dscrMinDisp = "0.00", dscrMaxDisp = "0.00", dscrAvgDisp = "0.00";
         if (annualDebtService !== 0) {
             dscrMin = (noiMin * 12) / annualDebtService;
             dscrMax = (noiMax * 12) / annualDebtService;
             dscrAvg = (noiAvg * 12) / annualDebtService;
             dscrMinDisp = isFinite(dscrMin) ? dscrMin.toFixed(2) : "N/A"; // Display N/A if calculation results in infinity
             dscrMaxDisp = isFinite(dscrMax) ? dscrMax.toFixed(2) : "N/A";
             dscrAvgDisp = isFinite(dscrAvg) ? dscrAvg.toFixed(2) : "N/A";
         } else { // Handle no debt case explicitly
             dscrMinDisp = (noiMin > 0 && isFinite(noiMin)) ? "N/A" : "0.00"; // If NOI is positive, DSCR is infinite (N/A)
             dscrMaxDisp = (noiMax > 0 && isFinite(noiMax)) ? "N/A" : "0.00";
             dscrAvgDisp = (noiAvg > 0 && isFinite(noiAvg)) ? "N/A" : "0.00";
         }
         document.getElementById('DSCR-min').value = dscrMinDisp;
         document.getElementById('DSCR-max').value = dscrMaxDisp;
         document.getElementById('DSCR-avg').value = dscrAvgDisp;

        // ROI - Not Implemented
        document.getElementById('ROI-min').value = "N/A";
        document.getElementById('ROI-max').value = "N/A";
        document.getElementById('ROI-avg').value = "N/A";

        // IRR - Not Implemented
        document.getElementById('IRR-min').value = "N/A";
        document.getElementById('IRR-max').value = "N/A";
        document.getElementById('IRR-avg').value = "N/A";

    } catch (error) {
        console.error('Calculation error:', error);
        // Consider adding user-facing error display here
    }
}

// --- Event Listener Setup --- (Handles B2/B3 linkage)
document.addEventListener('DOMContentLoaded', () => {
    // Reset the tracker on load
    lastEditedDownPaymentField = 'B2';

    // --- Define Input Groups ---
    // **IMPORTANT**: Ensure B3 is included here and REMOVE readonly from calc.html for B3
    const currencyInputs = [
        'B1', 'B3', 'B5', 'B10', 'B11', 'B12', 'B14', 'B15', 'A5', 'A5_2', 'A7', 'A8', 'A10', 'A11', 'A12',
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32', // Standard Expenses B
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32', // Standard Expenses C
        'D19', 'D20', 'D21', 'D22', 'D23', 'D24', 'D25', 'D26', 'D27', 'D29', 'D30', 'D31', 'D32', // Standard Expenses D (Avg - Mostly Readonly)
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9', // Custom Expenses B
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9', // Custom Expenses C
        'CFD1', 'CFD2', 'CFD3', 'CFD4', 'CFD5', 'CFD6', 'CFD7', 'CFD8', 'CFD9', // Custom Expenses D (Avg - Readonly)
        'B33', 'B34', 'B35', 'B36', 'B37', 'B38', 'B39', 'B40', 'B41', 'B42', 'B43', 'B44', 'B45', 'B46', 'B47', // Revenue B (Units)
        'C33', 'C34', 'C35', 'C36', 'C37', 'C38', 'C39', 'C40', 'C41', 'C42', 'C43', 'C44', 'C45', 'C46', 'C47', // Revenue C (Units)
        'D33', 'D34', 'D35', 'D36', 'D37', 'D38', 'D39', 'D40', 'D41', 'D42', 'D43', 'D44', 'D45', 'D46', 'D47', // Revenue D (Units - Avg Readonly)
        'B48', 'B49', 'B50', 'B51', 'B52', 'B53', 'B54', 'B55', 'B56', 'B57', 'B58', 'B59', 'B60', 'B61', 'B62', // Revenue B (Parking)
        'C48', 'C49', 'C50', 'C51', 'C52', 'C53', 'C54', 'C55', 'C56', 'C57', 'C58', 'C59', 'C60', 'C61', 'C62', // Revenue C (Parking)
        'D48', 'D49', 'D50', 'D51', 'D52', 'D53', 'D54', 'D55', 'D56', 'D57', 'D58', 'D59', 'D60', 'D61', 'D62', // Revenue D (Parking - Avg Readonly)
        'CFRB1', 'CFRB2', 'CFRB3', 'CFRB4', 'CFRB5', 'CFRB6', 'CFRB7', 'CFRB8', 'CFRB9', // Custom Revenue B
        'CFRC1', 'CFRC2', 'CFRC3', 'CFRC4', 'CFRC5', 'CFRC6', 'CFRC7', 'CFRC8', 'CFRC9', // Custom Revenue C
        'CFRD1', 'CFRD2', 'CFRD3', 'CFRD4', 'CFRD5', 'CFRD6', 'CFRD7', 'CFRD8', 'CFRD9', // Custom Revenue D (Avg - Readonly)
        'VRB28', 'VRC28', 'VRD28', // Vacancy Risk (Readonly)
        'B64', 'C64', 'D64', // Monthly Expenses (Readonly)
        'B65', 'C65', 'D65', // Monthly Revenue (Readonly)
        'AE-min', 'AE-max', 'AE-avg', // Annual Expenses (Readonly)
        'AR-min', 'AR-max', 'AR-avg', // Annual Revenue (Readonly)
        'B66', 'C66', 'D66', // Cash Flow (Readonly)
        'NOI-min', 'NOI-max', 'NOI-avg' // NOI Summary (Readonly)
        // ROI and IRR are readonly but handled differently (set to N/A)
    ];
    const percentageInputs = [
        'B2', 'B6', 'B13', // Base percentages
        'B28', 'C28', 'D28', // Vacancy rates (D28 is readonly avg)
        'A20', 'A21', 'A22' // Market rates (if used)
    ];
    const calculatedRateOutputs = [
        'GRM-min', 'GRM-max', 'GRM-avg',
        'CR-min', 'CR-max', 'CR-avg',
        'CCR-min', 'CCR-max', 'CCR-avg'
    ];
    const calculatedNumericOutputs = [
         'DSCR-min', 'DSCR-max', 'DSCR-avg'
         // Add ROI, IRR here if they become calculated numeric values instead of 'N/A'
    ];
    const textInputs = [
        'autocomplete',
        'CFN1', 'CFN2', 'CFN3', 'CFN4', 'CFN5', 'CFN6', 'CFN7', 'CFN8', 'CFN9',
        'CFRN1', 'CFRN2', 'CFRN3', 'CFRN4', 'CFRN5', 'CFRN6', 'CFRN7', 'CFRN8', 'CFRN9'
    ];
    const integerInputs = [
        'B7', 'B8', 'A4', 'A4_2', 'B9' // Loan Term, Payments/Yr, Days, Total Payments
    ];
    const expenseFields = [ // Fields to mark for negative formatting logic
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32',
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32',
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9',
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9',
        // D column expenses if they become editable, B64/C64/D64 are calculated totals
        'VRB28', 'VRC28', 'VRD28' // Vacancy Risk is calculated expense
    ];

    // --- Apply Formatting and Listeners ---

    // Currency Inputs
    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Ensure type is text for formatting symbols ($ , - .)
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'currency'); // Custom attribute for identification
            input.addEventListener('input', function(e) { formatCurrency(e.target, false); });
            input.addEventListener('blur', function(e) { formatCurrency(e.target, true); });
            // formatCurrency(input, true); // Optional: format existing values on load
        } else { console.warn(`Currency input element not found: ${id}`); }
    });

    // Percentage Inputs
    percentageInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'number');
            input.setAttribute('step', '0.01'); // Allow decimal input
            // Add min/max if appropriate (e.g., 0-100 for some rates)
            // input.setAttribute('min', '0');
            input.addEventListener('blur', function(e) { formatPercentage(e.target, true); });
            // formatPercentage(input, true); // Optional: format existing values on load
         } else { console.warn(`Percentage input element not found: ${id}`); }
     });

     // Calculated Rate/Numeric Outputs (Readonly)
     [...calculatedRateOutputs, ...calculatedNumericOutputs].forEach(id => {
         const input = document.getElementById(id);
         if (input) {
             input.setAttribute('type', 'number'); // Use number for consistency
             input.setAttribute('readonly', true);
             input.setAttribute('step', '0.01'); // Allow decimals
             // Add N/A fields here if they should be text
             if (id.startsWith('ROI-') || id.startsWith('IRR-')) {
                 input.setAttribute('type', 'text'); // Set ROI/IRR to text for "N/A"
                 input.removeAttribute('step');
             }
         } else { console.warn(`Calculated output element not found: ${id}`); }
     });

    // Text Inputs
     textInputs.forEach(id => {
         const input = document.getElementById(id);
         if (input) { input.setAttribute('type', 'text'); }
         else { console.warn(`Text input element not found: ${id}`); }
     });

      // Integer Inputs
     integerInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) {
              input.setAttribute('type', 'number');
              input.setAttribute('step', '1');
               // Make B9 readonly as it's calculated
              if (id === 'B9') {
                  input.setAttribute('readonly', true);
              }
          } else { console.warn(`Integer input element not found: ${id}`); }
      });

    // Mark Expense Fields for Formatting Logic
    expenseFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.dataset.isExpense = 'true'; // Mark for formatCurrency function
            // Add focus/blur logic for the minus sign on *user-editable* expense fields
            if (!input.readOnly) {
                 input.addEventListener('focus', function() {
                     // If empty, add a minus sign to guide user
                    if (this.value === '') { this.value = '-'; }
                    // If zero, clear it and add minus to start entering negative
                    else if (this.value === '0.00' || this.value === '0') { this.value = '-'; }
                    // If it has a positive value, make it negative on focus
                    else if (!this.value.startsWith('-')) {
                         const num = parseFloat(this.value.replace(/[^-\d.]/g, ''));
                         if (!isNaN(num) && num !== 0) {
                            this.value = '-' + Math.abs(num);
                            // formatCurrency(this, false); // Reformat instantly if needed
                         }
                    }
                });
                // Blur listener (handled by the main currency blur listener) ensures final state
            }
        }
    });

    // --- Setup Calculation Triggers ---

    // Debounced calculation function
    const debouncedCalculateAll = debounce(calculateAll, 300);

    // Specific Listeners for B2 and B3 (two-way binding)
    const b2Input = document.getElementById('B2');
    const b3Input = document.getElementById('B3'); // B3 is now editable

    if (b2Input) {
        b2Input.addEventListener('input', () => {
            lastEditedDownPaymentField = 'B2'; // Track which field initiated the change
            debouncedCalculateAll();
        });
        // Blur listener for formatting is attached in percentageInputs loop
    }
    if (b3Input) {
        b3Input.addEventListener('input', () => {
            lastEditedDownPaymentField = 'B3'; // Track which field initiated the change
            debouncedCalculateAll();
        });
         // Blur listener for formatting is attached in currencyInputs loop
    }

    // General Listener for *other* editable fields
    // Select all relevant input types within the calculator, EXCLUDING B2 and B3
    const allOtherInputs = document.querySelectorAll(
        '#calculator input[type="text"]:not(#B3), ' +
        '#calculator input[type="number"]:not(#B2), ' +
        '#calculator input[type="date"]'
    );
    allOtherInputs.forEach(input => {
        // Add listener only to non-readonly fields that aren't B2 or B3
        if (!input.readOnly) {
            input.addEventListener('input', debouncedCalculateAll);
             // Use 'change' for elements like date picker where 'input' might not fire reliably
             if (input.type === 'date') {
                 input.addEventListener('change', debouncedCalculateAll);
             }
        }
    });

    // --- Date Input Specific Logic ---
    const dateInput = document.getElementById('B4');
    if (dateInput) {
        const updateDates = () => {
            const selectedDate = new Date(dateInput.value);
             if (!isNaN(selectedDate.getTime())) {
                  calculateDates(selectedDate);
             } else {
                 // Clear date-derived fields if invalid date selected
                  document.getElementById('A4').value = "";
                  document.getElementById('A4_2').value = "";
             }
        };
        dateInput.addEventListener('change', updateDates); // Fires after selection
        // Initial date calculation if date is pre-filled on load
        if(dateInput.value) {
            updateDates();
        }
    }

    // --- Initial Calculation ---
    calculateAll(); // Run once on page load to process defaults/initial state

}); // End DOMContentLoaded

// Function for calculating days remaining/passed in year
function calculateDates(selectedDate) {
    // Ensure selectedDate is a valid Date object
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        document.getElementById('A4').value = ""; // Days Remain
        document.getElementById('A4_2').value = ""; // Days Passed
        return;
    }

    const currentYear = selectedDate.getFullYear();

    // Calculate days passed from start of year (inclusive of the selected day)
    const startOfYear = new Date(currentYear, 0, 1); // January 1st
    // Use UTC methods to avoid timezone issues with date differences
    const differenceFromStartOfYearTime = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) - Date.UTC(startOfYear.getFullYear(), startOfYear.getMonth(), startOfYear.getDate());
    const differenceFromStartOfYearDays = Math.floor(differenceFromStartOfYearTime / (1000 * 3600 * 24)) + 1;

    // Calculate total days in the year (handles leap years)
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const totalDaysInYear = isLeap ? 366 : 365;

    // Calculate days remaining using total days - days passed
     const daysRemaining = totalDaysInYear - differenceFromStartOfYearDays;

    document.getElementById('A4').value = daysRemaining >= 0 ? daysRemaining : 0; // Ensure non-negative
    document.getElementById('A4_2').value = differenceFromStartOfYearDays;
}
