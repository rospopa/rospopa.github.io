// Utility functions Debounce (unchanged)
function debounce(func, wait) {
    let timeout;
    return function (...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Removes non-digit characters and adds commas (unchanged)
function formatNumber(n) {
    return n.replace(/\D/g, "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

// Formats input field as currency, handling negatives and decimals (unchanged)
function formatCurrency(input, blur) {
    let value = input.value;
    if (!value) {
        if (blur && input.dataset.isExpense === 'true' && value !== '-') {
             input.value = '';
        } else if (!blur && input.dataset.isExpense === 'true' && value === '') {
            // input.value = '-'; // Re-evaluate if this auto-minus is desired on empty focus
        }
        return;
    }
    const isNegative = value.startsWith('-');
    value = value.replace(/[^\d.]/g, "");
     if (value === '' && isNegative) {
        if (blur) {
             input.value = '';
        } else {
             input.value = '-';
        }
        return;
    }
     if (value === '') {
         input.value = '';
         return;
     }
    if (value.indexOf(".") >= 0) {
        let [left, right] = value.split(".");
        left = formatNumber(left);
        right = right.slice(0, 2);
        value = left + "." + right;
    } else {
        value = formatNumber(value);
        if (blur && value !== '') {
            value += ".00";
        }
    }
    if (input.dataset.isExpense === 'true' && value !== '' && value !== '0.00') {
        input.value = '-' + value.replace(/-/g, ''); // Ensure only one leading minus
    } else if (isNegative && value !== '' && value !== '0.00') {
         input.value = '-' + value.replace(/-/g, ''); // Ensure only one leading minus
     } else {
        input.value = value.replace(/-/g, ''); // Ensure no minus for positive
    }
}


// Formats percentage inputs (unchanged)
function formatPercentage(input, blur) {
    let value = input.value;
    if (!value) return;
    const number = parseFloat(value);
    if (!isNaN(number)) {
        input.value = blur ? number.toFixed(2) : number;
    } else {
        if (blur) input.value = '';
    }
}

// Formats calculated values for display (unchanged)
function formatCalculatedValue(value) {
    if (isNaN(value) || !isFinite(value)) return "0.00"; // Handle NaN and Infinity
    const absValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return value < 0 ? "-" + absValue : absValue;
}


// PMT function (unchanged)
function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    if (type === 1) {
        pmt /= (1 + rate);
    }
    return pmt;
}

// Helper function to sum range of inputs by ID prefix and numbers (unchanged)
function sumInputs(prefix, numbers) {
    let sum = 0;
    for (let i of numbers) {
        const element = document.getElementById(prefix + i);
        if (element && element.value) {
            const value = parseFloat(element.value.replace(/[^-\d.]/g, ''));
             if (!isNaN(value)) {
                sum += value;
            }
        }
    }
    return sum;
}

// Calculate row 65 (Monthly Revenue) - MODIFIED to return values
function calculateRow65() {
    const standardRange = Array.from({length: 30}, (_, i) => i + 33); // B33-B62, C33-C62
    const customRange = Array.from({length: 9}, (_, i) => i + 1); // CFRB1-9, CFRC1-9

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

// Calculate row 64 (Monthly Expenses, including Vacancy) - MODIFIED to receive revenue and return expenses
function calculateRow64(revenueResults) { // Takes revenue object as input
    const { b65, c65, d65 } = revenueResults; // Destructure needed revenue values

    // --- Calculate Averages first ('D' column for expenses) ---
    // Average expenses (Rows 19-32 & Custom CFB/CFC)
    for (let i = 19; i <= 32; i++) {
         if (i === 28) continue; // Skip Vacancy Rate % row (handled separately)
         // Handle B22 (Property Taxes) - it's calculated in calculateAll, ensure it's formatted before averaging
         const B = parseFloat(document.getElementById('B' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         const C = parseFloat(document.getElementById('C' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         document.getElementById('D' + i).value = formatCalculatedValue((B + C) / 2);
     }
     for (let i = 1; i <= 9; i++) { // Custom Expenses B/C -> D
         const CFB = parseFloat(document.getElementById('CFB' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         const CFC = parseFloat(document.getElementById('CFC' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
         document.getElementById('CFD' + i).value = formatCalculatedValue((CFB + CFC) / 2);
     }

     // Average Vacancy Rate % (Row 28)
     const b28_rate_val = parseFloat(document.getElementById('B28').value.replace(/,/g, '')) || 0;
     const c28_rate_val = parseFloat(document.getElementById('C28').value.replace(/,/g, '')) || 0;
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
    const customRange = Array.from({length: 9}, (_, i) => i + 1);    // CFB1-9, CFC1-9

    // Calculate base operating expenses using updated 'D' columns as well
    const b_base_expenses = sumInputs('B', standardRange1) + sumInputs('B', standardRange2) + sumInputs('CFB', customRange);
    const c_base_expenses = sumInputs('C', standardRange1) + sumInputs('C', standardRange2) + sumInputs('CFC', customRange);
    const d_base_expenses = sumInputs('D', standardRange1) + sumInputs('D', standardRange2) + sumInputs('CFD', customRange); // Sum the average column

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

// Calculate row 66 (Net Cash Flow = NOI - Monthly Payment) - MODIFIED to receive revenue, expenses, payment and return results
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

// Main calculation function triggered on input changes - MODIFIED Orchestration
function calculateAll() {
    try {
        // --- 1. Parse Input Values ---
        const B1_PurchasePrice = parseFloat(document.getElementById('B1').value.replace(/[^-\d.]/g, '')) || 0;
        const B2_DownPayRate = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) / 100 || 0;
        const B6_InterestRate = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0;
        const B7_LoanTermYears = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0;
        const B8_PaymentsPerYear = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0;
        const B13_ClosingCostRate = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0;
        const B14_Inspection = parseFloat(document.getElementById('B14').value.replace(/[^-\d.]/g, '')) || 0;
        const A5_AnnualTax = parseFloat(document.getElementById('A5').value.replace(/[^-\d.]/g, '')) || 0;
        const A7_Depreciation = parseFloat(document.getElementById('A7').value.replace(/[^-\d.]/g, '')) || 0; // Not cash
        const A8_TaxProration = parseFloat(document.getElementById('A8').value.replace(/[^-\d.]/g, '')) || 0;
        const A10_Escrow = parseFloat(document.getElementById('A10').value.replace(/[^-\d.]/g, '')) || 0;
        const A11_Encumbrances = parseFloat(document.getElementById('A11').value.replace(/[^-\d.]/g, '')) || 0;
        const A12_Allowances = parseFloat(document.getElementById('A12').value.replace(/[^-\d.]/g, '')) || 0;

        // --- 2. Calculate Intermediate Loan Profile Values ---
        const B3_DownPayAmount = B1_PurchasePrice * B2_DownPayRate;
        const B5_LoanAmount = B1_PurchasePrice - B3_DownPayAmount;
        const B9_TotalPayments = Math.round(B7_LoanTermYears * B8_PaymentsPerYear);
        const periodicRate = B6_InterestRate / B8_PaymentsPerYear;
        const B10_PaymentPerPeriod = (B5_LoanAmount > 0 && periodicRate >= 0 && B9_TotalPayments > 0) ? PMT(periodicRate, B9_TotalPayments, -B5_LoanAmount, 0) : 0; // Handle no loan case
        const B11_TotalLoanCost = B10_PaymentPerPeriod * B9_TotalPayments;
        const B12_InterestCost = B11_TotalLoanCost - B5_LoanAmount;

        // --- 3. Calculate B15 (Cash to Close) ---
        const closingCostsEst = B1_PurchasePrice * B13_ClosingCostRate;
        const B15_CashToClose = B3_DownPayAmount + closingCostsEst + Math.abs(B14_Inspection) + Math.abs(A10_Escrow) + Math.abs(A11_Encumbrances) - Math.abs(A8_TaxProration) - Math.abs(A12_Allowances);

        // --- 4. Calculate Other Base Values ---
        const B22_MonthlyTax = A5_AnnualTax / 12 * -1; // Monthly Property Tax Expense

        // --- 5. Update Display for Initial Calculated Inputs ---
        // Update these first as they might be needed visually or by logic in helpers (like B22 for D22 avg)
        document.getElementById('B3').value = formatCalculatedValue(B3_DownPayAmount);
        document.getElementById('B5').value = formatCalculatedValue(B5_LoanAmount);
        document.getElementById('B9').value = B9_TotalPayments.toLocaleString('en-US');
        document.getElementById('B10').value = formatCalculatedValue(B10_PaymentPerPeriod);
        document.getElementById('B11').value = formatCalculatedValue(B11_TotalLoanCost);
        document.getElementById('B12').value = formatCalculatedValue(B12_InterestCost);
        document.getElementById('B15').value = formatCalculatedValue(B15_CashToClose);
        document.getElementById('B22').value = formatCalculatedValue(B22_MonthlyTax); // Update B22 display

        // --- 6. Calculate Revenue, Expenses, Cash Flow by Calling Helpers ---
        // Note: Helpers now calculate and update their respective 'D' columns (averages) internally
        const revenueResults = calculateRow65();
        const expenseResults = calculateRow64(revenueResults); // Pass revenue for vacancy calc
        const cashFlowResults = calculateRow66(revenueResults, expenseResults, B10_PaymentPerPeriod); // Pass dependencies

        // --- 7. Extract Needed Results from Returned Objects ---
        const { b65, c65, d65 } = revenueResults;
        const { noiMin, noiMax, noiAvg, b66, c66, d66 } = cashFlowResults;
        const cashInvested = Math.abs(B15_CashToClose); // Use the calculated variable
        const annualDebtService = Math.abs(B10_PaymentPerPeriod * 12); // Use calculated variable

        // --- 8. Calculate and Display Summary Metrics ---

        // GRM (Gross Rental Multiplier = Annual Revenue / Purchase Price * 100)
        let grmMin = 0, grmMax = 0, grmAvg = 0;
        if (B1_PurchasePrice !== 0) {
            grmMin = B1_PurchasePrice / (b65 * 12);
            grmMax = B1_PurchasePrice / (c65 * 12);
            grmAvg = B1_PurchasePrice / (d65 * 12);
        }
        document.getElementById('GRM-min').value = isFinite(grmMin) ? grmMin.toFixed(2) : "0.00";
        document.getElementById('GRM-max').value = isFinite(grmMax) ? grmMax.toFixed(2) : "0.00";
        document.getElementById('GRM-avg').value = isFinite(grmAvg) ? grmAvg.toFixed(2) : "0.00";

        // NOI is already calculated and displayed within calculateRow66

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
             dscrMinDisp = isFinite(dscrMin) ? dscrMin.toFixed(2) : "0.00";
             dscrMaxDisp = isFinite(dscrMax) ? dscrMax.toFixed(2) : "0.00";
             dscrAvgDisp = isFinite(dscrAvg) ? dscrAvg.toFixed(2) : "0.00";
         } else { // Handle no debt case
             dscrMinDisp = (noiMin > 0) ? "N/A" : "0.00";
             dscrMaxDisp = (noiMax > 0) ? "N/A" : "0.00";
             dscrAvgDisp = (noiAvg > 0) ? "N/A" : "0.00";
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
        // Optionally display an error message to the user
    }
}

// --- Event Listener Setup --- (largely unchanged, focus on initial setup)
document.addEventListener('DOMContentLoaded', () => {
    // Configure input fields (IDs remain the same)
    const currencyInputs = [ /* ... list as before ... */ 'B1', 'B3', 'B5', 'B10', 'B11', 'B12', 'B14', 'B15', 'A5', 'A5_2', 'A7', 'A8', 'A10', 'A11', 'A12','B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32', 'D19', 'D20', 'D21', 'D22', 'D23', 'D24', 'D25', 'D26', 'D27', 'D29', 'D30', 'D31', 'D32', 'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9', 'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9', 'CFD1', 'CFD2', 'CFD3', 'CFD4', 'CFD5', 'CFD6', 'CFD7', 'CFD8', 'CFD9', 'B33', 'B34', 'B35', 'B36', 'B37', 'B38', 'B39', 'B40', 'B41', 'B42', 'B43', 'B44', 'B45', 'B46', 'B47', 'C33', 'C34', 'C35', 'C36', 'C37', 'C38', 'C39', 'C40', 'C41', 'C42', 'C43', 'C44', 'C45', 'C46', 'C47', 'D33', 'D34', 'D35', 'D36', 'D37', 'D38', 'D39', 'D40', 'D41', 'D42', 'D43', 'D44', 'D45', 'D46', 'D47', 'B48', 'B49', 'B50', 'B51', 'B52', 'B53', 'B54', 'B55', 'B56', 'B57', 'B58', 'B59', 'B60', 'B61', 'B62', 'C48', 'C49', 'C50', 'C51', 'C52', 'C53', 'C54', 'C55', 'C56', 'C57', 'C58', 'C59', 'C60', 'C61', 'C62', 'D48', 'D49', 'D50', 'D51', 'D52', 'D53', 'D54', 'D55', 'D56', 'D57', 'D58', 'D59', 'D60', 'D61', 'D62', 'CFRB1', 'CFRB2', 'CFRB3', 'CFRB4', 'CFRB5', 'CFRB6', 'CFRB7', 'CFRB8', 'CFRB9', 'CFRC1', 'CFRC2', 'CFRC3', 'CFRC4', 'CFRC5', 'CFRC6', 'CFRC7', 'CFRC8', 'CFRC9', 'CFRD1', 'CFRD2', 'CFRD3', 'CFRD4', 'CFRD5', 'CFRD6', 'CFRD7', 'CFRD8', 'CFRD9', 'VRB28', 'VRC28', 'VRD28', 'B64', 'C64', 'D64', 'B65', 'C65', 'D65', 'AE-min', 'AE-max', 'AE-avg', 'AR-min', 'AR-max', 'AR-avg', 'B66', 'C66', 'D66', 'NOI-min', 'NOI-max', 'NOI-avg', 'ROI-min', 'ROI-max', 'ROI-avg', 'IRR-min', 'IRR-max', 'IRR-avg' ];
    const percentageInputs = [ /* ... list as before ... */ 'B2', 'B6', 'B13', 'B28', 'C28', 'D28' ];
    const calculatedRateOutputs = [ /* ... list as before ... */ 'GRM-min', 'GRM-max', 'GRM-avg', 'CR-min', 'CR-max', 'CR-avg', 'CCR-min', 'CCR-max', 'CCR-avg' ];
    const calculatedNumericOutputs = [ /* ... list as before ... */ 'DSCR-min', 'DSCR-max', 'DSCR-avg' ];
    const textInputs = [ /* ... list as before ... */ 'autocomplete', 'CFN1', 'CFN2', 'CFN3', 'CFN4', 'CFN5', 'CFN6', 'CFN7', 'CFN8', 'CFN9', 'CFRN1', 'CFRN2', 'CFRN3', 'CFRN4', 'CFRN5', 'CFRN6', 'CFRN7', 'CFRN8', 'CFRN9' ];
    const integerInputs = [ /* ... list as before ... */ 'B7', 'B8', 'A4', 'A4_2' ];
    const expenseFields = [ /* ... list as before ... */ 'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32', 'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32', 'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9', 'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9', 'VRB28', 'VRC28', 'VRD28' ];

    // --- Apply Formatting and Listeners (Setup logic remains the same) ---
    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'currency');
            input.addEventListener('input', function(e) { formatCurrency(e.target, false); });
            input.addEventListener('blur', function(e) { formatCurrency(e.target, true); });
             // formatCurrency(input, true); // Optional initial format
        } else { console.warn(`Currency input element not found: ${id}`); }
    });
    percentageInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
             input.setAttribute('type', 'number');
             input.setAttribute('step', '0.01');
             input.addEventListener('blur', function(e) { formatPercentage(e.target, true); });
             // formatPercentage(input, true); // Optional initial format
         } else { console.warn(`Percentage input element not found: ${id}`); }
     });
     [...calculatedRateOutputs, ...calculatedNumericOutputs].forEach(id => {
         const input = document.getElementById(id);
         if (input) {
             input.setAttribute('type', 'number');
             input.setAttribute('readonly', true);
             input.setAttribute('step', '0.01');
         } else { console.warn(`Calculated output element not found: ${id}`); }
     });
     textInputs.forEach(id => {
         const input = document.getElementById(id);
         if (input) { input.setAttribute('type', 'text'); }
         else { console.warn(`Text input element not found: ${id}`); }
     });
     integerInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) { input.setAttribute('type', 'number'); input.setAttribute('step', '1'); }
          else { console.warn(`Integer input element not found: ${id}`); }
      });
    expenseFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.dataset.isExpense = 'true';
            if (!input.readOnly) {
                 input.addEventListener('focus', function() {
                    if (this.value === '') { this.value = '-'; }
                    else if (this.value === '0.00' || this.value === '0') { this.value = '-'; }
                    else if (!this.value.startsWith('-')) {
                         const num = parseFloat(this.value.replace(/[^-\d.]/g, ''));
                         if (!isNaN(num) && num !== 0) { this.value = '-' + Math.abs(num); formatCurrency(this, false); }
                    }
                });
                input.addEventListener('blur', function() {
                    if (this.value === '-') { this.value = ''; }
                    // formatCurrency called globally on blur will handle final negative state
                });
            }
        }
    });

    // Debounced calculation trigger (unchanged)
    const debouncedCalculateAll = debounce(calculateAll, 300);
    const allInputs = document.querySelectorAll('#calculator input[type="text"], #calculator input[type="number"], #calculator input[type="date"]');
    allInputs.forEach(input => {
        if (!input.readOnly) {
            input.addEventListener('input', debouncedCalculateAll);
            input.addEventListener('change', debouncedCalculateAll);
        }
    });

    // Date input listener (unchanged)
    const dateInput = document.getElementById('B4');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            const selectedDate = new Date(this.value);
            if (!isNaN(selectedDate.getTime())) {
                 calculateDates(selectedDate);
            } else {
                // Clear date fields if invalid date selected
                 document.getElementById('A4').value = "";
                 document.getElementById('A4_2').value = "";
            }
            // debouncedCalculateAll is already attached to 'change'
        });
        if(dateInput.value) {
             const initialDate = new Date(dateInput.value);
             if (!isNaN(initialDate.getTime())) {
                  calculateDates(initialDate);
             }
        }
    }

    // Initial calculation on page load (unchanged)
    calculateAll();

}); // End DOMContentLoaded

// Add new function for date calculations (unchanged)
function calculateDates(selectedDate) {
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        document.getElementById('A4').value = "";
        document.getElementById('A4_2').value = "";
        return;
    }
    const currentYear = selectedDate.getFullYear();
    const startOfYear = new Date(currentYear, 0, 1);
    const differenceFromStartOfYearTime = selectedDate.getTime() - startOfYear.getTime();
    const differenceFromStartOfYearDays = Math.floor(differenceFromStartOfYearTime / (1000 * 3600 * 24)) + 1;
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const totalDaysInYear = isLeap ? 366 : 365;
    const daysRemaining = totalDaysInYear - differenceFromStartOfYearDays;
    document.getElementById('A4').value = daysRemaining >= 0 ? daysRemaining : 0; // Ensure non-negative
    document.getElementById('A4_2').value = differenceFromStartOfYearDays;
}
