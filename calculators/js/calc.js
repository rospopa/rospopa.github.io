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
        // Clear field if empty on blur, unless it's an expense field starting with '-' OR it's B3
        if (blur && !(input.dataset.isExpense === 'true' && value === '-') && input.id !== 'B3') {
             input.value = ''; // Don't clear B3, let placeholder show
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
         if (input.id !== 'B3') { // Don't clear B3
            input.value = '';
         }
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

// Formats Rate outputs (GRM, CR, CCR, DSCR, ROI, IRR)
// Always positive, max 2 decimals, no trailing zeros (e.g., 1.7, 2, 3.45)
function formatRateOutput(value) {
    // Check for NaN, null, undefined, or Infinity
    if (isNaN(value) || value === null || typeof value === 'undefined' || !isFinite(value)) {
        // Caller should handle specific 'N/A' cases before calling if needed (e.g., DSCR with no debt)
        return "0"; // Default return for invalid numbers
    }

    const absValue = Math.abs(value);

    // Format to max 2 decimal places, then parse to remove trailing zeros
    const formatted = parseFloat(absValue.toFixed(2));

    // Convert back to string for display
    return formatted.toString();
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

// **Helper function** to parse currency string to number
function parseCurrency(valueString) {
    if (typeof valueString !== 'string') return 0;
    return parseFloat(valueString.replace(/[^-\d.]/g, '')) || 0;
}

// Calculate row 65 (Monthly Revenue) - Returns calculated values
function calculateRow65() {
    const standardRange = Array.from({length: 30}, (_, i) => i + 33); // Units B33-B62, Parking C33-C62
    const customRange = Array.from({length: 9}, (_, i) => i + 1); // Custom Rev CFRB1-9, CFRC1-9

    // --- Calculate Averages first ('D' column) ---
    for (let i = 33; i <= 62; i++) { // Standard Revenue Rows B/C -> D
        const B = parseCurrency(document.getElementById('B' + i)?.value);
        const C = parseCurrency(document.getElementById('C' + i)?.value);
        document.getElementById('D' + i).value = formatCalculatedValue((B + C) / 2);
    }
    for (let i = 1; i <= 9; i++) { // Custom Revenue Rows B/C -> D
        const CFRB = parseCurrency(document.getElementById('CFRB' + i)?.value);
        const CFRC = parseCurrency(document.getElementById('CFRC' + i)?.value);
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

    // Return calculated values (both monthly and annual)
    return { b65, c65, d65, ARmin, ARmax, ARavg }; // Return numeric values
}

// Calculate row 64 (Monthly Expenses, including Vacancy) - Receives revenue, returns expenses
function calculateRow64(revenueResults) { // Takes revenue object as input
    const { b65, c65, d65 } = revenueResults; // Destructure needed monthly revenue values

    // --- Calculate Averages for individual expense lines ('D' column) ---
    for (let i = 19; i <= 32; i++) {
         if (i === 28) continue; // Skip Vacancy Rate % row (handled separately below)

         const bInput = document.getElementById('B' + i);
         const cInput = document.getElementById('C' + i);
         const dInput = document.getElementById('D' + i);

         if (dInput) { // Check if D input exists
            const B = parseCurrency(bInput?.value);
            const C = parseCurrency(cInput?.value);
            // Apply AVG(B, C) formula to all D expense fields (D19-D27, D29-D32)
            dInput.value = formatCalculatedValue((B + C) / 2);
         }
     }
     // Custom Expenses Averages (CFD1-9)
     for (let i = 1; i <= 9; i++) {
         const CFB = parseCurrency(document.getElementById('CFB' + i)?.value);
         const CFC = parseCurrency(document.getElementById('CFC' + i)?.value);
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

    // Calculate vacancy loss (as a negative value) using passed-in monthly revenues
    const vacancyLossB = b65 * b28_rate * -1;
    const vacancyLossC = c65 * c28_rate * -1;
    const vacancyLossD = d65 * d28_rate * -1; // Use average revenue and average rate

    // Update Vacancy Risk display fields
    document.getElementById('VRB28').value = formatCalculatedValue(vacancyLossB);
    document.getElementById('VRC28').value = formatCalculatedValue(vacancyLossC);
    document.getElementById('VRD28').value = formatCalculatedValue(vacancyLossD);

    // --- Sum MIN/MAX Monthly Expenses ---
    const standardRange1 = Array.from({length: 9}, (_, i) => i + 19); // 19-27
    const standardRange2 = Array.from({length: 4}, (_, i) => i + 29); // 29-32
    const customRange = Array.from({length: 9}, (_, i) => i + 1);    // CFB1-9, CFC1-9

    // Calculate base operating expenses for MIN (B) and MAX (C) columns
    const b_base_expenses = sumInputs('B', standardRange1) + sumInputs('B', standardRange2) + sumInputs('CFB', customRange);
    const c_base_expenses = sumInputs('C', standardRange1) + sumInputs('C', standardRange2) + sumInputs('CFC', customRange);

    // Calculate final MIN (B64) and MAX (C64) Monthly Expense (Base Expenses + Vacancy Loss)
    const b64 = b_base_expenses + vacancyLossB;
    const c64 = c_base_expenses + vacancyLossC;

    // Update B64 and C64 display fields
    document.getElementById('B64').value = formatCalculatedValue(b64);
    document.getElementById('C64').value = formatCalculatedValue(c64);

    // --- Calculate AVG Monthly Expense (D64) based on B64 and C64 ---
    const d64 = (b64 + c64) / 2;
    document.getElementById('D64').value = formatCalculatedValue(d64); // Update D64 display

    // --- Calculate Annual Expenses ---
    const AEmin = b64 * 12;
    const AEmax = c64 * 12;
    // Calculate AVG Annual Expense (AE-avg) based on AEmin and AEmax
    const AEavg = (AEmin + AEmax) / 2;

    // Update Annual Expense display fields
    document.getElementById('AE-min').value = formatCalculatedValue(AEmin);
    document.getElementById('AE-max').value = formatCalculatedValue(AEmax);
    document.getElementById('AE-avg').value = formatCalculatedValue(AEavg); // Update AE-avg display

    // Return calculated expense values (both monthly and annual)
    return { b64, c64, d64, AEmin, AEmax, AEavg }; // Return numeric values
}

// Calculate row 66 (Monthly Net Cash Flow = Monthly Revenue + Monthly Expenses - Monthly Payment)
// Returns only monthly cash flow values
function calculateRow66(revenueResults, expenseResults, monthlyPayment) {
    const { b65, c65, d65 } = revenueResults; // Monthly Revenues
    const { b64, c64, d64 } = expenseResults; // Monthly Expenses (negative)

    // Ensure monthly payment is treated as an expense (positive value to be subtracted)
    const paymentExpense = Math.abs(monthlyPayment);

    // Calculate Monthly Net Operating Income (NOI = Monthly Revenue + Monthly Expenses)
    const noiMonthlyMin = b65 + b64;
    const noiMonthlyMax = c65 + c64;
    const noiMonthlyAvg = d65 + d64; // Uses the D64 calculated as AVG(B64, C64)

    // Calculate Monthly Cash Flow (Monthly NOI - Monthly Payment)
    const b66 = noiMonthlyMin - paymentExpense;
    const c66 = noiMonthlyMax - paymentExpense;
    const d66 = noiMonthlyAvg - paymentExpense;

    // Update Monthly Cash Flow display fields
    document.getElementById('B66').value = formatCalculatedValue(b66);
    document.getElementById('C66').value = formatCalculatedValue(c66);
    document.getElementById('D66').value = formatCalculatedValue(d66);

    // Return only Monthly CashFlow values
     return { b66, c66, d66 }; // Return numeric values
}

// Main calculation function triggered on input changes - Handles B2/B3 two-way calculation
function calculateAll() {
    try {
        // --- 1. Parse Input Values ---
        const B1_PurchasePrice = parseCurrency(document.getElementById('B1').value);
        // --- Read both B2 and B3 ---
        let B2_DownPayRate_Input = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) || 0; // Read raw number
        let B3_DownPayAmount_Input = parseCurrency(document.getElementById('B3').value);

        // --- >>> B2 / B3 Two-Way Calculation <<< ---
        let B2_DownPayRate; // Rate (e.g., 0.20)
        let B3_DownPayAmount; // Amount

        const b2Input = document.getElementById('B2');
        const b3Input = document.getElementById('B3');

        if (lastEditedDownPaymentField === 'B2') {
            // User edited Rate (B2), calculate Amount (B3)
            B2_DownPayRate = B2_DownPayRate_Input / 100; // Convert percentage input to rate
            B3_DownPayAmount = B1_PurchasePrice * B2_DownPayRate;
            const currentB3Formatted = formatCalculatedValue(B3_DownPayAmount);
            if (B3_DownPayAmount !== 0 || (b3Input.value && b3Input.value !== '0.00')) {
                if (b3Input.value !== currentB3Formatted) {
                    b3Input.value = currentB3Formatted;
                }
            } else if (B3_DownPayAmount === 0 && b3Input.value && b3Input.value !== '0.00') {
                 b3Input.value = '';
            }
        } else if (lastEditedDownPaymentField === 'B3') {
            // User edited Amount (B3), calculate Rate (B2)
            B3_DownPayAmount = B3_DownPayAmount_Input;
            B2_DownPayRate = (B1_PurchasePrice !== 0) ? (B3_DownPayAmount / B1_PurchasePrice) : 0;
            const b2ValueToSet = B2_DownPayRate * 100;
            const currentB2Parsed = parseFloat(b2Input.value.replace(/,/g, ''));
            if (isNaN(currentB2Parsed) || Math.abs(currentB2Parsed - b2ValueToSet) > 0.001) {
                 b2Input.value = b2ValueToSet.toFixed(2);
            }
        } else {
            // Default case (e.g., initial load, reset) - Prefer B2 if available
             B2_DownPayRate = B2_DownPayRate_Input / 100;
             B3_DownPayAmount = B1_PurchasePrice * B2_DownPayRate;
             if (B1_PurchasePrice !== 0 && B3_DownPayAmount === 0 && B3_DownPayAmount_Input !== 0) {
                 // If B2 was 0 or empty, but B3 had a value, calculate B2 from B3 instead
                 B3_DownPayAmount = B3_DownPayAmount_Input;
                 B2_DownPayRate = B3_DownPayAmount / B1_PurchasePrice;
                 b2Input.value = (B2_DownPayRate * 100).toFixed(2);
                 b3Input.value = formatCalculatedValue(B3_DownPayAmount); // Update B3 display
             } else {
                  const currentB3Formatted = formatCalculatedValue(B3_DownPayAmount);
                   if (B3_DownPayAmount !== 0 || (b3Input.value && b3Input.value !== '0.00')) {
                       if (b3Input.value !== currentB3Formatted) {
                           b3Input.value = currentB3Formatted;
                       }
                   } else if (B3_DownPayAmount === 0 && !b3Input.value) {
                       // DO NOTHING if calculated is 0 and field is empty (placeholder showing).
                   } else if (B3_DownPayAmount === 0 && b3Input.value) {
                       b3Input.value = ''; // Clear if calculated is 0 but field has a value
                   }
             }
        }
        // Ensure B3_DownPayAmount reflects the final state after potential adjustments
        B3_DownPayAmount = parseCurrency(b3Input.value); // Re-parse in case it was cleared or changed

        // --- >>> END B2 / B3 Two-Way Calculation <<< ---

        // --- Continue with other parsing ---
        const B6_InterestRate = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0;
        const B7_LoanTermYears = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0;
        const B8_PaymentsPerYear = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0;
        const B13_ClosingCostRate = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0;
        const B14_Inspection = parseCurrency(document.getElementById('B14').value);
        const A5_AnnualTax = parseCurrency(document.getElementById('A5').value);
        const A8_TaxProration = parseCurrency(document.getElementById('A8').value);
        const A10_Escrow = parseCurrency(document.getElementById('A10').value);
        const A11_Encumbrances = parseCurrency(document.getElementById('A11').value);
        const A12_Allowances = parseCurrency(document.getElementById('A12').value);

        // --- 2. Calculate Intermediate Loan Profile Values ---
        const B5_LoanAmount = B1_PurchasePrice - B3_DownPayAmount;
        const B9_TotalPayments = Math.round(B7_LoanTermYears * B8_PaymentsPerYear);
        const periodicRate = (B8_PaymentsPerYear > 0) ? B6_InterestRate / B8_PaymentsPerYear : 0;
        const B10_PaymentPerPeriod = (B5_LoanAmount > 0 && B9_TotalPayments > 0) ? PMT(periodicRate, B9_TotalPayments, -B5_LoanAmount, 0) : 0; // Handle no loan case
        const B11_TotalLoanCost = B10_PaymentPerPeriod * B9_TotalPayments;
        const B12_InterestCost = (B11_TotalLoanCost >= B5_LoanAmount) ? B11_TotalLoanCost - B5_LoanAmount : 0;

        // --- 3. Calculate B15 (Cash to Close) ---
        const closingCostsEst = B1_PurchasePrice * B13_ClosingCostRate;
        const B15_CashToClose = B3_DownPayAmount + closingCostsEst + Math.abs(B14_Inspection) + Math.abs(A10_Escrow) + Math.abs(A11_Encumbrances) - Math.abs(A8_TaxProration) - Math.abs(A12_Allowances);

        // --- 4. Calculate Other Base Values ---
        const B22_MonthlyTax = (A5_AnnualTax / 12) * -1; // Monthly Property Tax Expense

        // --- 5. Update Display for Initial Calculated Inputs ---
        document.getElementById('B5').value = formatCalculatedValue(B5_LoanAmount);
        document.getElementById('B9').value = B9_TotalPayments.toLocaleString('en-US');
        document.getElementById('B10').value = formatCalculatedValue(B10_PaymentPerPeriod);
        document.getElementById('B11').value = formatCalculatedValue(B11_TotalLoanCost);
        document.getElementById('B12').value = formatCalculatedValue(B12_InterestCost);
        document.getElementById('B15').value = formatCalculatedValue(B15_CashToClose);
        document.getElementById('B22').value = formatCalculatedValue(B22_MonthlyTax); // B22 is calculated monthly tax

        // --- 6. Calculate Revenue, Expenses, Cash Flow by Calling Helpers ---
        const revenueResults = calculateRow65(); // Gets { b65, c65, d65, ARmin, ARmax, ARavg }
        const expenseResults = calculateRow64(revenueResults); // Gets { b64, c64, d64, AEmin, AEmax, AEavg }
        const cashFlowResults = calculateRow66(revenueResults, expenseResults, B10_PaymentPerPeriod); // Gets { b66, c66, d66 }

        // --- 7. Extract Needed Results & Calculate Annual Figures ---
        const { ARmin, ARmax, ARavg } = revenueResults;
        const { AEmin, AEmax, AEavg } = expenseResults; // Annual Expenses (negative), AEavg now AVG(AEmin, AEmax)
        const { b66, c66, d66 } = cashFlowResults; // Monthly Cash Flow

        // --- Calculate Annual NOI ---
        const noiAnnMin = ARmin + AEmin; // AR is positive, AE is negative
        const noiAnnMax = ARmax + AEmax;
        const noiAnnAvg = ARavg + AEavg; // AEavg is now AVG(AEmin,AEmax)

        // --- Update Annual NOI Display ---
        document.getElementById('NOI-min').value = formatCalculatedValue(noiAnnMin);
        document.getElementById('NOI-max').value = formatCalculatedValue(noiAnnMax);
        document.getElementById('NOI-avg').value = formatCalculatedValue(noiAnnAvg);

        // --- Calculate Annual Cash Flow ---
        const cashFlowAnnMin = b66 * 12;
        const cashFlowAnnMax = c66 * 12;
        const cashFlowAnnAvg = d66 * 12;

        // --- Other variables needed for summary metrics ---
        const cashInvested = Math.abs(B15_CashToClose);
        const annualDebtService = Math.abs(B10_PaymentPerPeriod * 12);

        // --- 8. Calculate and Display Summary Metrics ---

        // GRM
        let grmMin = 0, grmMax = 0, grmAvg = 0;
        if (ARmin !== 0) grmMin = B1_PurchasePrice / ARmin;
        if (ARmax !== 0) grmMax = B1_PurchasePrice / ARmax;
        if (ARavg !== 0) grmAvg = B1_PurchasePrice / ARavg;
        document.getElementById('GRM-min').value = formatRateOutput(grmMin);
        document.getElementById('GRM-max').value = formatRateOutput(grmMax);
        document.getElementById('GRM-avg').value = formatRateOutput(grmAvg);

        // Cap Rate (CR = Annual NOI / Purchase Price * 100)
        let crMin = 0, crMax = 0, crAvg = 0;
        if (B1_PurchasePrice !== 0) {
            crMin = (noiAnnMin / B1_PurchasePrice) * 100;
            crMax = (noiAnnMax / B1_PurchasePrice) * 100;
            crAvg = (noiAnnAvg / B1_PurchasePrice) * 100;
        }
        document.getElementById('CR-min').value = formatRateOutput(crMin);
        document.getElementById('CR-max').value = formatRateOutput(crMax);
        document.getElementById('CR-avg').value = formatRateOutput(crAvg);

        // Cash-on-Cash Return (CCR = Annual Cash Flow / Cash Invested * 100)
        let ccrMin = 0, ccrMax = 0, ccrAvg = 0;
        if (cashInvested !== 0) {
            ccrMin = (cashFlowAnnMin / cashInvested) * 100 * -1;
            ccrMax = (cashFlowAnnMax / cashInvested) * 100 * -1;
            ccrAvg = (cashFlowAnnAvg / cashInvested) * 100 * -1;
        }
        document.getElementById('CCR-min').value = formatRateOutput(ccrMin);
        document.getElementById('CCR-max').value = formatRateOutput(ccrMax);
        document.getElementById('CCR-avg').value = formatRateOutput(ccrAvg);

         // DSCR (Debt Service Coverage Ratio = Annual NOI / Annual Debt Service)
         let dscrMin = 0, dscrMax = 0, dscrAvg = 0;
         let dscrMinDisp = "0", dscrMaxDisp = "0", dscrAvgDisp = "0";
         if (annualDebtService !== 0) {
             dscrMin = noiAnnMin / annualDebtService;
             dscrMax = noiAnnMax / annualDebtService;
             dscrAvg = noiAnnAvg / annualDebtService; // Uses noiAnnAvg calculated from AEavg = AVG(AEmin,AEmax)
             dscrMinDisp = isFinite(dscrMin) ? formatRateOutput(dscrMin) : "N/A";
             dscrMaxDisp = isFinite(dscrMax) ? formatRateOutput(dscrMax) : "N/A";
             dscrAvgDisp = isFinite(dscrAvg) ? formatRateOutput(dscrAvg) : "N/A";
         } else {
             dscrMinDisp = (noiAnnMin > 0 && isFinite(noiAnnMin)) ? "N/A" : "0";
             dscrMaxDisp = (noiAnnMax > 0 && isFinite(noiAnnMax)) ? "N/A" : "0";
             dscrAvgDisp = (noiAnnAvg > 0 && isFinite(noiAnnAvg)) ? "N/A" : "0";
         }
         document.getElementById('DSCR-min').value = dscrMinDisp;
         document.getElementById('DSCR-max').value = dscrMaxDisp;
         document.getElementById('DSCR-avg').value = dscrAvgDisp;

        // ROI - Not Implemented
        document.getElementById('ROI-min').value = formatRateOutput(0);
        document.getElementById('ROI-max').value = formatRateOutput(0);
        document.getElementById('ROI-avg').value = formatRateOutput(0);

        // IRR - Not Implemented
        document.getElementById('IRR-min').value = formatRateOutput(0);
        document.getElementById('IRR-max').value = formatRateOutput(0);
        document.getElementById('IRR-avg').value = formatRateOutput(0);

        // --- 9. Trigger Graph and Table Update ---
        // Get starting calendar year from closing date (B4) or default to current year
        const closingDateValue = document.getElementById('B4')?.value;
        let startCalendarYear = new Date().getFullYear(); // Default to current year
        if (closingDateValue) {
            // Try parsing as YYYY-MM-DD first
            const dateParts = closingDateValue.split('-');
            let closingDate;
            if (dateParts.length === 3) {
                // Construct date carefully to avoid timezone interpretation issues if possible
                 closingDate = new Date(Date.UTC(parseInt(dateParts[0]), parseInt(dateParts[1]) - 1, parseInt(dateParts[2])));
            } else {
                // Fallback to direct parsing if not YYYY-MM-DD
                closingDate = new Date(closingDateValue + 'T00:00:00');
            }

            if (closingDate && !isNaN(closingDate.getTime())) {
                startCalendarYear = closingDate.getUTCFullYear(); // Use UTC year to be consistent
            }
        }

        let currentPeriodData = []; // Initialize with empty array
        if (typeof window.drawAmortizationChart === 'function') {
            currentPeriodData = window.drawAmortizationChart(startCalendarYear); // Get data back
        } else {
            console.warn("drawAmortizationChart function not found when trying to update visuals.");
        }

        // Call ApexCharts update function (from apex-chart.js) - requires periodData
        // We pass fullPeriodData (made global by drawAmortizationChart), start year, and payments/year
        if (typeof window.updateApexAmortizationChart === 'function') {
            // Pass the data received from drawAmortizationChart
            window.updateApexAmortizationChart(currentPeriodData, startCalendarYear, globalPaymentsPerYear);
        } else {
            console.warn("updateApexAmortizationChart function not found.");
        }

        // First call the Google Table function for the summary, which will then update the chart
        if (typeof window.drawCumulativeDataTable === 'function') {
             // Get closing date from B4 field or use current date as fallback
             const closingDateStr = document.getElementById('B4')?.value;
             // Make sure we parse the date properly to avoid timezone issues
             let closingDate;
             if (closingDateStr) {
                 closingDate = new Date(closingDateStr + 'T00:00:00');
                 if (isNaN(closingDate.getTime())) {
                     console.warn("Invalid closing date format, using current date instead");
                     closingDate = new Date();
                 }
             } else {
                 closingDate = new Date();
             }
             
             console.log("Using closing date for cumulative table:", closingDate.toISOString());
             
             // Calculate loan term in months
             const loanTermMonths = B7_LoanTermYears * 12;
             
             window.drawCumulativeDataTable(
                 closingDate,    // Start date (closing date)
                 loanTermMonths, // Number of months to display
                 expenseResults, // Contains monthly expense data
                 revenueResults  // Contains monthly revenue data
             );
          } else {
             console.warn("drawCumulativeDataTable function not found.");
          }

    } catch (error) {
        console.error('Calculation error:', error);
    }
}

// --- Event Listener Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Reset the tracker on load
    lastEditedDownPaymentField = 'B2';

    // --- Define Input Groups ---
    const currencyInputs = [
        'B1', 'B3', 'B5', 'B10', 'B11', 'B12', 'B14', 'B15', 'A5', 'A5_2', 'A7', 'A8', 'A10', 'A11', 'A12',
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32', // Standard Expenses B
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32', // Standard Expenses C
        'D19', 'D20', 'D21', 'D22', 'D23', 'D24', 'D25', 'D26', 'D27', 'D29', 'D30', 'D31', 'D32', // Standard Expenses D (Avg - Readonly)
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
    ];
    const percentageInputs = [
        'B2', 'B6', 'B13', // Base percentages
        'B28', 'C28', 'D28', // Vacancy rates (D28 is readonly avg)
        'A20', 'A21', 'A22' // Market rates (if used)
    ];
     const rateOutputFields = [
         'GRM-min', 'GRM-max', 'GRM-avg',
         'CR-min', 'CR-max', 'CR-avg',
         'CCR-min', 'CCR-max', 'CCR-avg',
         'DSCR-min', 'DSCR-max', 'DSCR-avg',
         'ROI-min', 'ROI-max', 'ROI-avg',
         'IRR-min', 'IRR-max', 'IRR-avg'
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
        'VRB28', 'VRC28', 'VRD28' // Vacancy Risk is calculated expense
    ];

    // --- Apply Formatting and Listeners ---

    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'currency');
            input.addEventListener('input', function(e) { formatCurrency(e.target, false); });
            input.addEventListener('blur', function(e) { formatCurrency(e.target, true); });
            if (input.id === 'B3' && !input.value) {
                 // Skip initial formatting for B3 if empty
             } else if (!input.readOnly || input.value) {
                formatCurrency(input, true);
             }
        } else { console.warn(`Currency input element not found: ${id}`); }
    });

    percentageInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'number');
            input.setAttribute('step', '0.01');
            input.addEventListener('blur', function(e) { formatPercentage(e.target, true); });
            if (!input.readOnly || input.value) formatPercentage(input, true);
         } else { console.warn(`Percentage input element not found: ${id}`); }
     });

     rateOutputFields.forEach(id => {
         const input = document.getElementById(id);
         if (input) {
             input.setAttribute('type', 'text');
             input.setAttribute('readonly', true);
         } else { console.warn(`Rate output element not found: ${id}`); }
     });

    textInputs.forEach(id => {
         const input = document.getElementById(id);
         if (input) { input.setAttribute('type', 'text'); }
         else { console.warn(`Text input element not found: ${id}`); }
     });

     integerInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) {
              input.setAttribute('type', 'number');
              input.setAttribute('step', '1');
              if (id === 'B9' || id === 'A4' || id === 'A4_2') {
                  input.setAttribute('readonly', true);
              }
          } else { console.warn(`Integer input element not found: ${id}`); }
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
                         const num = parseCurrency(this.value);
                         if (!isNaN(num) && num !== 0) {
                            this.value = '-' + Math.abs(num);
                            formatCurrency(this, false);
                         }
                    }
                });
            }
        }
    });

    // --- Setup Calculation Triggers ---

    const debouncedCalculateAll = debounce(calculateAll, 300);

    const b2Input = document.getElementById('B2');
    const b3Input = document.getElementById('B3');

    if (b2Input) {
        b2Input.addEventListener('input', () => { lastEditedDownPaymentField = 'B2'; debouncedCalculateAll(); });
    }
    if (b3Input) {
        b3Input.addEventListener('input', () => { lastEditedDownPaymentField = 'B3'; debouncedCalculateAll(); });
    }

    const allOtherInputs = document.querySelectorAll(
        '#calculator input[type="text"]:not(#B3):not([readonly]), ' +
        '#calculator input[type="number"]:not(#B2):not([readonly]), ' +
        '#calculator input[type="date"]:not([readonly])'
    );

    allOtherInputs.forEach(input => {
        input.addEventListener('input', debouncedCalculateAll);
         if (input.type === 'date') {
             input.addEventListener('change', debouncedCalculateAll);
         }
    });

    // --- Date Input Specific Logic ---
    const dateInput = document.getElementById('B4');
    if (dateInput) {
        const updateDates = () => {
            const selectedDateValue = dateInput.value;
            if (selectedDateValue) {
                 const selectedDate = new Date(selectedDateValue + 'T00:00:00');
                 if (!isNaN(selectedDate.getTime())) { calculateDates(selectedDate); }
                 else { clearDateFields(); }
            } else { clearDateFields(); }
            // Always recalculate all after date change as it affects taxes/proration
            calculateAll();
        };
        const clearDateFields = () => {
             document.getElementById('A4').value = "";
             document.getElementById('A4_2').value = "";
             calculateDailyTax(); // Recalculate daily tax (will use default 365 days)
        };
        dateInput.addEventListener('change', updateDates);
        if(dateInput.value) { updateDates(); }
        else { calculateDailyTax(); } // Initial daily tax calc if no date
    } else {
         calculateDailyTax(); // Initial daily tax calc if no date input
    }

    // Listener for Annual Tax (A5)
    const annualTaxInput = document.getElementById('A5');
    if (annualTaxInput) {
        annualTaxInput.addEventListener('input', debounce(() => {
            calculateDailyTax(); // Update daily tax first
            calculateAll(); // Recalculate everything
        }, 300));
    } else {
         // If A5 doesn't exist, still call calculateAll on dependency changes (like B4)
         // This might be redundant depending on other listeners, but ensures updates
         // if B4 changes and A5 isn't present.
         // debounce(calculateAll, 300)(); // Consider if needed
    }

    // Add listener for loan term year changes (B7) as it directly impacts the range chart x-axis
     const loanTermInput = document.getElementById('B7');
     if (loanTermInput) {
         loanTermInput.addEventListener('input', debouncedCalculateAll);
     }

    // --- Clear Charts on Invalid Data --- (Add range chart and table clearing)
    const clearCharts = () => {
        console.log("clearCharts: начало очистки графиков");
        
        try {
            if (typeof window.clearApexChart === 'function') {
                console.log("clearCharts: вызов clearApexChart");
                window.clearApexChart();
            }
            
            if (typeof window.clearApexRangeChart === 'function') {
                console.log("clearCharts: вызов clearApexRangeChart");
                try {
                    window.clearApexRangeChart();
                } catch (e) {
                    console.error("clearCharts: ошибка при очистке range chart:", e);
                    // Handle error - attempt to reset the chart instance
                    const chartDiv = document.querySelector("#apex_cumulative_range_chart");
                    if (chartDiv) {
                        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Error clearing chart. Please refresh the page.</p>';
                    }
                    if (window.apexRangeChartInstance) {
                        try {
                            window.apexRangeChartInstance.destroy();
                        } catch (destroyError) {
                            console.error("Failed to destroy corrupted chart instance:", destroyError);
                        }
                        window.apexRangeChartInstance = null;
                    }
                }
            }
            
            // Clear the summary Google Table
            if (typeof window.clearCumulativeTable === 'function') {
                console.log("clearCharts: вызов clearCumulativeTable");
                try {
                    window.clearCumulativeTable();
                } catch (e) {
                    console.error("clearCharts: ошибка при очистке таблицы:", e);
                }
            }
            
            console.log("clearCharts: очистка графиков завершена");
            
            // Potentially clear Google Chart AMORTIZATION tables if they weren't handled by drawAmortizationChart returning empty
            // document.getElementById('annual_table_body').innerHTML = '<tr><td colspan="7" class="text-center p-3">Enter valid loan details.</td></tr>';
        } catch (error) {
            console.error("clearCharts: критическая ошибка при очистке:", error);
        }
    };

    // Trigger clearCharts when calculateAll detects invalid base data
    // Modify the beginning of calculateAll to include this
    const originalCalculateAll = calculateAll; // Store original function
    window.calculateAll = function() { // Override global calculateAll
        const B1_PurchasePrice = parseCurrency(document.getElementById('B1')?.value);
        const B6_InterestRate = (parseFloat(document.getElementById('B6')?.value.replace(/,/g, '')) / 100) || 0;
        const B7_LoanTermYears = parseFloat(document.getElementById('B7')?.value.replace(/,/g, '')) || 0;
        // Check for essential data validity before proceeding
         if (B1_PurchasePrice <= 0 || B7_LoanTermYears <= 0) {
             console.log("Essential data (Price or Term) invalid, clearing charts.");
             clearCharts();
             // Optionally reset some calculated fields display if needed
             document.getElementById('B5').value = formatCalculatedValue(0);
             document.getElementById('B9').value = '0';
             // ... etc.
             // Reset summary fields
             const summaryFields = ['GRM-min', 'GRM-max', 'GRM-avg', 'CR-min', 'CR-max', 'CR-avg', 'CCR-min', 'CCR-max', 'CCR-avg', 'DSCR-min', 'DSCR-max', 'DSCR-avg', 'ROI-min', 'ROI-max', 'ROI-avg', 'IRR-min', 'IRR-max', 'IRR-avg', 'NOI-min', 'NOI-max', 'NOI-avg'];
             summaryFields.forEach(id => { const el = document.getElementById(id); if(el) el.value = '0'; });
             return; // Stop further calculation
         }

        // If data seems valid enough to start, call the original calculation logic
        originalCalculateAll.apply(this, arguments);
    };


    // --- Initial Calculation --- (REMOVED - Now triggered by Google Charts callback in graph.js)
    /*
     setTimeout(() => {
         if (typeof google !== 'undefined' && google.charts && google.charts.loaded) {
             console.log("Triggering initial calculation after chart load confirmation.");
             calculateAll();
         } else {
             console.warn("Google Charts not ready yet, initial calculation might be delayed or fail.");
             // Fallback or retry logic might be needed here
              // For now, attempt calculation anyway, graph.js has internal checks
              calculateAll();
         }
     }, 100); // Small delay to ensure DOM elements and potentially graph.js setup are ready
    */

}); // End DOMContentLoaded

// Function for calculating days remaining/passed in year AND daily tax
function calculateDates(selectedDate) {
    let totalDaysInYear = 365; // Default
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        document.getElementById('A4').value = "";
        document.getElementById('A4_2').value = "";
    } else {
        const currentYear = selectedDate.getFullYear();
        const startOfYear = new Date(currentYear, 0, 1);
        const differenceFromStartOfYearTime = Date.UTC(selectedDate.getFullYear(), selectedDate.getMonth(), selectedDate.getDate()) - Date.UTC(startOfYear.getFullYear(), startOfYear.getMonth(), startOfYear.getDate());
        const differenceFromStartOfYearDays = Math.floor(differenceFromStartOfYearTime / (1000 * 3600 * 24)) + 1;

        const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
        totalDaysInYear = isLeap ? 366 : 365;
        const daysRemaining = totalDaysInYear - differenceFromStartOfYearDays;

        document.getElementById('A4').value = daysRemaining >= 0 ? daysRemaining : 0;
        document.getElementById('A4_2').value = differenceFromStartOfYearDays;
    }
    calculateDailyTax(totalDaysInYear);
}

// Separate function to calculate Daily Tax Amount (A5_2)
function calculateDailyTax(daysInYear = null) {
    const annualTax = parseCurrency(document.getElementById('A5')?.value);
    let dailyTax = 0;

    if (daysInYear === null) {
        const dateInput = document.getElementById('B4');
        const selectedDateValue = dateInput ? dateInput.value : null;
        if (selectedDateValue) {
            const selectedDate = new Date(selectedDateValue + 'T00:00:00');
            if (!isNaN(selectedDate.getTime())) {
                 const currentYear = selectedDate.getFullYear();
                 const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
                 daysInYear = isLeap ? 366 : 365;
            }
        }
    }
    if (daysInYear === null || daysInYear <= 0) { daysInYear = 365; }

    if (annualTax !== 0 && daysInYear > 0) { dailyTax = annualTax / daysInYear; }

    const dailyTaxInput = document.getElementById('A5_2');
    if (dailyTaxInput) { dailyTaxInput.value = formatCalculatedValue(dailyTax); }
}
