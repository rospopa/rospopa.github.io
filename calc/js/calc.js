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
        // Remove minus sign if field is empty on blur and it's marked as an expense
        if (blur && input.dataset.isExpense === 'true' && value !== '-') {
             input.value = '';
        } else if (!blur && input.dataset.isExpense === 'true' && value === '') {
            // If focusing an empty expense field, prepopulate with '-'
            // input.value = '-'; // Re-evaluate if this auto-minus is desired on empty focus
        }
        return;
    }

    // Preserve minus sign if present at the start
    const isNegative = value.startsWith('-');
    // Remove all non-digit characters except decimal point (and keep the initial minus if isNegative)
    value = value.replace(/[^\d.]/g, "");

    // If value becomes empty after stripping non-digits (e.g., was just "-"), handle it
     if (value === '' && isNegative) {
        if (blur) {
             input.value = ''; // Clear on blur if only '-' remains
        } else {
             // Keep '-' while typing
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
        left = formatNumber(left); // Format integer part
        right = right.slice(0, 2); // Keep only two decimal places
        value = left + "." + right;
    } else {
        value = formatNumber(value); // Format integer part
        // Only add .00 on blur if it has a value
        if (blur && value !== '') {
            value += ".00";
        }
    }

    // Re-apply minus sign based on expense flag OR if it was initially negative
    if (input.dataset.isExpense === 'true' && value !== '' && value !== '0.00') {
         // Ensure expenses are negative unless zero
        input.value = '-' + value;
    } else if (isNegative && value !== '' && value !== '0.00') {
         // Keep minus sign if it was entered, even for non-expense fields
         input.value = '-' + value;
     } else {
        input.value = value; // Handle positive numbers or zero
    }
}

// Formats percentage inputs (assuming they are type="number")
function formatPercentage(input, blur) {
    let value = input.value;
    if (!value) return; // Do nothing if empty

    const number = parseFloat(value);
    if (!isNaN(number)) {
        // Only format with two decimals on blur
        input.value = blur ? number.toFixed(2) : number;
    } else {
        // If somehow it's not a number (though type=number should prevent this)
        if (blur) input.value = '';
    }
}

// Formats calculated values for display (currency style)
function formatCalculatedValue(value) {
    if (isNaN(value)) return "0.00"; // Return "0.00" for NaN results

    // Format the absolute value with commas and 2 decimal places
    const absValue = Math.abs(value).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

    // Add minus sign if the original value was negative
    return value < 0 ? "-" + absValue : absValue;
}

// PMT function (seems standard)
function PMT(rate, nper, pv, fv = 0, type = 0) {
    if (rate === 0) return -(pv + fv) / nper;
    const pvif = Math.pow(1 + rate, nper);
    let pmt = rate / (pvif - 1) * -(pv * pvif + fv);
    if (type === 1) {
        pmt /= (1 + rate);
    }
    return pmt;
}

// Helper function to sum range of inputs by ID prefix and numbers
function sumInputs(prefix, numbers) {
    let sum = 0;
    for (let i of numbers) {
        // Attempt to get value, replace commas, parse as float
        const element = document.getElementById(prefix + i);
        if (element && element.value) {
             // Remove commas and currency symbols for calculation
            const value = parseFloat(element.value.replace(/[^-\d.]/g, ''));
             if (!isNaN(value)) {
                sum += value;
            }
        }
    }
    return sum;
}

// Calculate row 65 (Total Revenue)
function calculateRow65() {
    // Range for standard revenue fields (Units, Parking)
    const standardRange = Array.from({length: 30}, (_, i) => i + 33); // B33-B62, C33-C62
    // Range for custom revenue fields
    const customRange = Array.from({length: 9}, (_, i) => i + 1); // CFRB1-9, CFRC1-9

    // Sum values for each column
    const b65 = sumInputs('B', standardRange) + sumInputs('CFRB', customRange);
    const c65 = sumInputs('C', standardRange) + sumInputs('CFRC', customRange);
    const d65 = sumInputs('D', standardRange) + sumInputs('CFRD', customRange); // Avg column

    // Update the display fields
    document.getElementById('B65').value = formatCalculatedValue(b65);
    document.getElementById('C65').value = formatCalculatedValue(c65);
    document.getElementById('D65').value = formatCalculatedValue(d65);

    // Return the calculated values for use in other functions
    return { b65, c65, d65 };
}

// Calculate row 64 (Total Expenses, including Vacancy)
function calculateRow64() {
    // First, ensure Row 65 (Total Revenue) is calculated to get vacancy base
    const row65Values = calculateRow65();

    // Get vacancy rates from percentage inputs
    const b28_rate = parseFloat(document.getElementById('B28').value.replace(/,/g, '')) / 100 || 0;
    const c28_rate = parseFloat(document.getElementById('C28').value.replace(/,/g, '')) / 100 || 0;
    const d28_rate = parseFloat(document.getElementById('D28').value.replace(/,/g, '')) / 100 || 0;

    // Calculate vacancy loss (as a negative value)
    const vacancyLossB = row65Values.b65 * b28_rate * -1;
    const vacancyLossC = row65Values.c65 * c28_rate * -1;
    const vacancyLossD = row65Values.d65 * d28_rate * -1; // Avg vacancy loss

    // Update Vacancy Risk display fields (VRB28, VRC28, VRD28)
    document.getElementById('VRB28').value = formatCalculatedValue(vacancyLossB);
    document.getElementById('VRC28').value = formatCalculatedValue(vacancyLossC);
    document.getElementById('VRD28').value = formatCalculatedValue(vacancyLossD);

    // Sum the standard operating expense ranges (remember expenses are negative)
    const standardRange1 = Array.from({length: 9}, (_, i) => i + 19); // 19-27
    const standardRange2 = Array.from({length: 4}, (_, i) => i + 29); // 29-32
    // Sum custom expense ranges
    const customRange = Array.from({length: 9}, (_, i) => i + 1);    // CFB1-9, CFC1-9

    // Calculate base operating expenses for each column
    const b_base_expenses = sumInputs('B', standardRange1) + sumInputs('B', standardRange2) + sumInputs('CFB', customRange);
    const c_base_expenses = sumInputs('C', standardRange1) + sumInputs('C', standardRange2) + sumInputs('CFC', customRange);
    const d_base_expenses = sumInputs('D', standardRange1) + sumInputs('D', standardRange2) + sumInputs('CFD', customRange); // Avg column

    // Calculate final Total Expense (Base Expenses + Vacancy Loss)
    const b64 = b_base_expenses + vacancyLossB;
    const c64 = c_base_expenses + vacancyLossC;
    const d64 = d_base_expenses + vacancyLossD; // Use average vacancy loss for average column

    // Update Total Expense display fields
    document.getElementById('B64').value = formatCalculatedValue(b64);
    document.getElementById('C64').value = formatCalculatedValue(c64);
    document.getElementById('D64').value = formatCalculatedValue(d64);

    // Return calculated values
    return { b64, c64, d64 };
}

// Calculate row 66 (Net Cash Flow = NOI - Monthly Payment)
function calculateRow66() {
    // Calculate Total Expenses (Row 64) first, which also calculates Total Revenue (Row 65)
    const row64Values = calculateRow64(); // This now returns {b64, c64, d64}
    // We also need Row 65 values (Total Revenue), which are calculated inside calculateRow64
    // Let's re-fetch them directly from the DOM after calculateRow64 runs
    const b65 = parseFloat(document.getElementById('B65').value.replace(/[^-\d.]/g, '')) || 0;
    const c65 = parseFloat(document.getElementById('C65').value.replace(/[^-\d.]/g, '')) || 0;
    const d65 = parseFloat(document.getElementById('D65').value.replace(/[^-\d.]/g, '')) || 0;

    // Get the calculated monthly loan payment (Principal + Interest)
    const monthlyPayment = parseFloat(document.getElementById('B10').value.replace(/[^-\d.]/g, '')) || 0;
    // Ensure monthly payment is treated as an expense (positive value to be subtracted)
    const paymentExpense = Math.abs(monthlyPayment);

    // Calculate Net Operating Income (NOI = Revenue + Expenses [since expenses are negative])
    const noiMin = b65 + row64Values.b64;
    const noiMax = c65 + row64Values.c64;
    const noiAvg = d65 + row64Values.d64;

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

    // Return NOI and CashFlow values for potential use in other summary calculations
     return { noiMin, noiMax, noiAvg, b66, c66, d66 };
}

// Main calculation function triggered on input changes
function calculateAll() {
    try {
        // --- 1. Parse Input Values ---
        // Property & Loan Base Inputs
        const B1 = parseFloat(document.getElementById('B1').value.replace(/[^-\d.]/g, '')) || 0; // Purchase Price
        const B2 = parseFloat(document.getElementById('B2').value.replace(/,/g, '')) / 100 || 0; // Down Payment %
        const B6 = parseFloat(document.getElementById('B6').value.replace(/,/g, '')) / 100 || 0; // Annual Interest Rate %
        const B7 = parseFloat(document.getElementById('B7').value.replace(/,/g, '')) || 0; // Loan Term Period #
        const B8 = parseFloat(document.getElementById('B8').value.replace(/,/g, '')) || 0; // Payments per Period #
        const B13 = parseFloat(document.getElementById('B13').value.replace(/,/g, '')) / 100 || 0; // Closing Cost %
        const B14 = parseFloat(document.getElementById('B14').value.replace(/[^-\d.]/g, '')) || 0; // Inspection $
        // Tax Inputs
        const A5 = parseFloat(document.getElementById('A5').value.replace(/[^-\d.]/g, '')) || 0; // Annual Tax Amount $
        const A7_Depreciation = parseFloat(document.getElementById('A7').value.replace(/[^-\d.]/g, '')) || 0; // Tax Depreciation $ (NOTE: Not cash!)
        const A8_Proration = parseFloat(document.getElementById('A8').value.replace(/[^-\d.]/g, '')) || 0; // Tax Proration Amount $ (Credit or Debit?)
        // Cash to Close Inputs
        const A10_Escrow = parseFloat(document.getElementById('A10').value.replace(/[^-\d.]/g, '')) || 0; // Escrow $
        const A11_Encumbrances = parseFloat(document.getElementById('A11').value.replace(/[^-\d.]/g, '')) || 0; // Encumbrances $
        const A12_Allowances = parseFloat(document.getElementById('A12').value.replace(/[^-\d.]/g, '')) || 0; // Allowances $

        // --- 2. Calculate Intermediate Loan Profile Values ---
        const B3 = B1 * B2;                          // Down Payment $
        const B5 = B1 - B3;                          // Loan Amount $
        const B9 = Math.round(B7 * B8);              // Total Payments # (Rounded)
        const periodicRate = B6 / B8;                // Interest Rate per Payment Period
        const B10 = PMT(periodicRate, B9, -B5, 0);   // Amount per Payment $ (PV is negative)
        const B11 = B10 * B9;                        // Total Loan Cost (Sum of Payments) $
        const B12 = B11 - B5;                        // Interest Cost $ (Total Paid - Loan Amount)

        // --- 3. Calculate B15 (Cash to Close) ---
        // !! WARNING: This B15 calculation is a simplification based ONLY on available fields.
        // !! It does NOT include many standard closing costs (title, lender fees) and
        // !! makes assumptions about Prorations/Allowances/Escrow signs.
        // !! A7 (Tax Depreciation) is correctly EXCLUDED as it's non-cash.
        const closingCostsEst = B1 * B13; // Estimated closing costs from %
        const B15 = B3 + closingCostsEst + Math.abs(B14) + Math.abs(A10_Escrow) + Math.abs(A11_Encumbrances) - Math.abs(A8_Proration) - Math.abs(A12_Allowances);
        // Calculation: Down Payment + Closing Cost Est + Inspection + Escrow + Encumbrances - Proration Credit - Allowance Credit

        // --- 4. Calculate Other Base Values ---
        const B22 = A5 / 12 * -1;                     // Monthly Property Tax Expense $

        // --- 5. Update Display for Calculated Inputs ---
        document.getElementById('B3').value = formatCalculatedValue(B3);
        document.getElementById('B5').value = formatCalculatedValue(B5);
        document.getElementById('B9').value = B9.toLocaleString('en-US'); // Format integer
        document.getElementById('B10').value = formatCalculatedValue(B10);
        document.getElementById('B11').value = formatCalculatedValue(B11);
        document.getElementById('B12').value = formatCalculatedValue(B12);
        document.getElementById('B15').value = formatCalculatedValue(B15); // Display calculated Cash to Close
        document.getElementById('B22').value = formatCalculatedValue(B22); // Display calculated monthly tax

        // --- 6. Calculate Averages for Min/Max Columns (D Columns) ---
        // Average expenses (Rows 19-32 & Custom CFB/CFC)
        for (let i = 19; i <= 32; i++) {
             // Skip row 28 (Vacancy Rate %)
            if (i === 28) continue;
            const B = parseFloat(document.getElementById('B' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            const C = parseFloat(document.getElementById('C' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            document.getElementById('D' + i).value = formatCalculatedValue((B + C) / 2);
        }
        for (let i = 1; i <= 9; i++) { // Custom Expenses
            const CFB = parseFloat(document.getElementById('CFB' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            const CFC = parseFloat(document.getElementById('CFC' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            document.getElementById('CFD' + i).value = formatCalculatedValue((CFB + CFC) / 2);
        }
         // Average revenues (Rows 33-62 & Custom CFRB/CFRC)
         for (let i = 33; i <= 62; i++) {
            const B = parseFloat(document.getElementById('B' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            const C = parseFloat(document.getElementById('C' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            document.getElementById('D' + i).value = formatCalculatedValue((B + C) / 2);
        }
        for (let i = 1; i <= 9; i++) { // Custom Revenues
            const CFRB = parseFloat(document.getElementById('CFRB' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            const CFRC = parseFloat(document.getElementById('CFRC' + i)?.value.replace(/[^-\d.]/g, '')) || 0;
            document.getElementById('CFRD' + i).value = formatCalculatedValue((CFRB + CFRC) / 2);
        }

        // --- 7. Calculate Totals and Key Metrics (Rows 64, 65, 66 & Summary) ---
        // Calculate Row 66 (Cash Flow), which internally calculates Rows 64 (Expenses) & 65 (Revenue) & NOI
        const { noiMin, noiMax, noiAvg, b66, c66, d66 } = calculateRow66();
        // We now have:
        // row64Values (implicit from calculateRow66 call) -> b64, c64, d64 (Total Expenses)
        // row65Values (implicit from calculateRow66 call) -> b65, c65, d65 (Total Revenue)
        // noiMin, noiMax, noiAvg (Monthly NOI)
        // b66, c66, d66 (Monthly Cash Flow)

        // Fetch required values again after calculations for summary metrics
        const b65 = parseFloat(document.getElementById('B65').value.replace(/[^-\d.]/g, '')) || 0;
        const c65 = parseFloat(document.getElementById('C65').value.replace(/[^-\d.]/g, '')) || 0;
        const d65 = parseFloat(document.getElementById('D65').value.replace(/[^-\d.]/g, '')) || 0;
        const b15Value = parseFloat(document.getElementById('B15').value.replace(/[^-\d.]/g, '')) || 0; // Cash To Close


        // --- 8. Calculate Summary Metrics ---

        // GRM (Gross Rental Multiplier = Annual Revenue / Purchase Price * 100) - Based on provided definition
        if (B1 !== 0) {
            const grmMin = (b65 * 12) / B1 * 100;
            const grmMax = (c65 * 12) / B1 * 100;
            const grmAvg = (d65 * 12) / B1 * 100;
            document.getElementById('GRM-min').value = grmMin.toFixed(2);
            document.getElementById('GRM-max').value = grmMax.toFixed(2);
            document.getElementById('GRM-avg').value = grmAvg.toFixed(2);
        } else {
            document.getElementById('GRM-min').value = "0.00";
            document.getElementById('GRM-max').value = "0.00";
            document.getElementById('GRM-avg').value = "0.00";
        }

        // NOI is already calculated and displayed within calculateRow66

        // Cap Rate (CR = Annual NOI / Purchase Price * 100)
        if (B1 !== 0) {
            const crMin = (noiMin * 12) / B1 * 100;
            const crMax = (noiMax * 12) / B1 * 100;
            const crAvg = (noiAvg * 12) / B1 * 100;
            document.getElementById('CR-min').value = crMin.toFixed(2);
            document.getElementById('CR-max').value = crMax.toFixed(2);
            document.getElementById('CR-avg').value = crAvg.toFixed(2);
        } else {
            document.getElementById('CR-min').value = "0.00";
            document.getElementById('CR-max').value = "0.00";
            document.getElementById('CR-avg').value = "0.00";
        }

        // Cash-on-Cash Return (CCR = Annual Cash Flow / Cash Invested * 100)
        // Using B15 as Cash Invested. Using absolute value as B15 formula might be incorrect sign-wise.
        const cashInvested = Math.abs(b15Value);
        if (cashInvested !== 0) {
            const ccrMin = (b66 * 12) / cashInvested * 100;
            const ccrMax = (c66 * 12) / cashInvested * 100;
            const ccrAvg = (d66 * 12) / cashInvested * 100;
            document.getElementById('CCR-min').value = ccrMin.toFixed(2);
            document.getElementById('CCR-max').value = ccrMax.toFixed(2);
            document.getElementById('CCR-avg').value = ccrAvg.toFixed(2);
        } else {
            document.getElementById('CCR-min').value = "0.00";
            document.getElementById('CCR-max').value = "0.00";
            document.getElementById('CCR-avg').value = "0.00";
        }

         // DSCR (Debt Service Coverage Ratio = Annual NOI / Annual Debt Service)
        const annualDebtService = Math.abs(B10 * 12); // Annual P&I payment
        if (annualDebtService !== 0) {
            const dscrMin = (noiMin * 12) / annualDebtService;
            const dscrMax = (noiMax * 12) / annualDebtService;
            const dscrAvg = (noiAvg * 12) / annualDebtService;
            // Display DSCR (format as number, not currency)
            document.getElementById('DSCR-min').value = dscrMin.toFixed(2);
            document.getElementById('DSCR-max').value = dscrMax.toFixed(2);
            document.getElementById('DSCR-avg').value = dscrAvg.toFixed(2);
        } else {
            // Handle case with no debt (infinite DSCR technically, display 0 or N/A)
             document.getElementById('DSCR-min').value = (noiMin > 0) ? "N/A" : "0.00"; // Or just 0.00
             document.getElementById('DSCR-max').value = (noiMax > 0) ? "N/A" : "0.00";
             document.getElementById('DSCR-avg').value = (noiAvg > 0) ? "N/A" : "0.00";
        }

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

// --- Event Listener Setup ---
document.addEventListener('DOMContentLoaded', () => {
    // Configure input fields

    // Currency Inputs (Formatted with $ and commas)
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
        'B64', 'C64', 'D64', // Total Expenses (Readonly)
        'B65', 'C65', 'D65', // Total Revenue (Readonly)
        'B66', 'C66', 'D66', // Cash Flow (Readonly)
        'NOI-min', 'NOI-max', 'NOI-avg', // NOI Summary (Readonly)
        'ROI-min', 'ROI-max', 'ROI-avg', // ROI Summary (Readonly - N/A)
        'IRR-min', 'IRR-max', 'IRR-avg'  // IRR Summary (Readonly - N/A)
    ];

    // Percentage Inputs (Handle as numbers, format on blur)
    const percentageInputs = [
        'B2', 'B6', 'B13', 'B28', 'C28', 'D28' // D28 is readonly but might need initial format
        // Add A20, A21, A22 if Market section is used
    ];

     // Readonly Percentage/Ratio Outputs (Calculated, formatted with .toFixed(2))
     const calculatedRateOutputs = [
        'GRM-min', 'GRM-max', 'GRM-avg',
        'CR-min', 'CR-max', 'CR-avg',
        'CCR-min', 'CCR-max', 'CCR-avg'
     ];

    // Readonly Numeric Outputs (Calculated, formatted with .toFixed(2))
     const calculatedNumericOutputs = [
         'DSCR-min', 'DSCR-max', 'DSCR-avg'
     ];

    // Text Inputs (No special formatting needed by this script)
    const textInputs = [
        'autocomplete', 'CFN1', 'CFN2', 'CFN3', 'CFN4', 'CFN5', 'CFN6', 'CFN7', 'CFN8', 'CFN9',
        'CFRN1', 'CFRN2', 'CFRN3', 'CFRN4', 'CFRN5', 'CFRN6', 'CFRN7', 'CFRN8', 'CFRN9'
    ];

     // Integer Inputs (Formatted without decimals, but allow number input)
     const integerInputs = [
        'B7', 'B8', 'A4', 'A4_2' // B9 is calculated/readonly formatted int
     ];

    // --- Apply Formatting and Listeners ---

    currencyInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            // Set input type to text to allow manual formatting including '$', ',', '-'
            input.setAttribute('type', 'text');
            input.setAttribute('data-type', 'currency'); // Custom attribute for identification
            input.addEventListener('input', function(e) {
                formatCurrency(e.target, false); // Format as user types
            });
            input.addEventListener('blur', function(e) {
                formatCurrency(e.target, true); // Final format on blur (e.g., add .00)
            });
            // Initial format on load if value exists
            // formatCurrency(input, true); // Optional: format existing values on load
        } else {
            console.warn(`Currency input element not found: ${id}`);
        }
    });

    percentageInputs.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.setAttribute('type', 'number');
            input.setAttribute('step', '0.01'); // Allow decimal input
             // Min/Max can be useful but might conflict with specific logic if negative % were needed
             // input.setAttribute('min', '0');
             // input.setAttribute('max', '100');
             input.addEventListener('blur', function(e) {
                 formatPercentage(e.target, true); // Format to 2 decimals on blur
             });
             // Initial format on load
             // formatPercentage(input, true); // Optional: format existing values on load
         } else {
             console.warn(`Percentage input element not found: ${id}`);
         }
     });

     // Set calculated rate/numeric outputs to type number for consistency, but make readonly
     [...calculatedRateOutputs, ...calculatedNumericOutputs].forEach(id => {
         const input = document.getElementById(id);
         if (input) {
             input.setAttribute('type', 'number'); // Use number for alignment/consistency
             input.setAttribute('readonly', true); // Make sure they are not user-editable
             input.setAttribute('step', '0.01');
         } else {
              console.warn(`Calculated output element not found: ${id}`);
         }
     });


     // No specific formatting for text inputs needed here
     textInputs.forEach(id => {
         const input = document.getElementById(id);
         if (input) {
             input.setAttribute('type', 'text');
         } else {
             console.warn(`Text input element not found: ${id}`);
         }
     });

      // Integer inputs: set type to number, step 1
     integerInputs.forEach(id => {
          const input = document.getElementById(id);
          if (input) {
              input.setAttribute('type', 'number');
              input.setAttribute('step', '1');
          } else {
               console.warn(`Integer input element not found: ${id}`);
          }
     });


    // Mark Expense Fields
    const expenseFields = [
        'B19', 'B20', 'B21', 'B22', 'B23', 'B24', 'B25', 'B26', 'B27', 'B29', 'B30', 'B31', 'B32',
        'C19', 'C20', 'C21', 'C22', 'C23', 'C24', 'C25', 'C26', 'C27', 'C29', 'C30', 'C31', 'C32',
        'CFB1', 'CFB2', 'CFB3', 'CFB4', 'CFB5', 'CFB6', 'CFB7', 'CFB8', 'CFB9',
        'CFC1', 'CFC2', 'CFC3', 'CFC4', 'CFC5', 'CFC6', 'CFC7', 'CFC8', 'CFC9',
        // Add D column expenses if they become editable, B64/C64/D64 are calculated
        'VRB28', 'VRC28', 'VRD28' // Vacancy Risk is calculated expense
    ];
    expenseFields.forEach(id => {
        const input = document.getElementById(id);
        if (input) {
            input.dataset.isExpense = 'true'; // Mark for formatCurrency function

            // Add focus/blur logic for the minus sign on *user-editable* expense fields
            if (!input.readOnly) {
                 input.addEventListener('focus', function() {
                     // If empty, add a minus sign to guide user
                    if (this.value === '') {
                        this.value = '-';
                    } else if (this.value === '0.00' || this.value === '0') {
                        // If zero, clear it and add minus to start entering negative
                         this.value = '-';
                    } else if (!this.value.startsWith('-')) {
                        // If it has a positive value, make it negative on focus
                         const num = parseFloat(this.value.replace(/[^-\d.]/g, ''));
                         if (!isNaN(num) && num !== 0) {
                            this.value = '-' + Math.abs(num);
                            formatCurrency(this, false); // Reformat after sign change
                         }
                    }
                });
                input.addEventListener('blur', function() {
                    // If the only character is '-', clear the field
                    if (this.value === '-') {
                        this.value = '';
                    }
                    // formatCurrency (called on blur for all currency fields) will handle final formatting
                });
            }
        }
    });

    // Debounced calculation trigger for all relevant inputs
    const debouncedCalculateAll = debounce(calculateAll, 300);
    const allInputs = document.querySelectorAll('#calculator input[type="text"], #calculator input[type="number"], #calculator input[type="date"]');
    allInputs.forEach(input => {
        // Add listener to non-readonly fields
        if (!input.readOnly) {
            input.addEventListener('input', debouncedCalculateAll);
            // Also trigger on change (e.g., for date picker)
             input.addEventListener('change', debouncedCalculateAll);
        }
    });

    // Add date input listener specifically for date calculations
    const dateInput = document.getElementById('B4');
    if (dateInput) {
        dateInput.addEventListener('change', function() {
            const selectedDate = new Date(this.value);
            calculateDates(selectedDate);
            // calculateAll(); // calculation is already triggered by the general 'change' listener above
        });
        // Initial date calculation if date is pre-filled
        if(dateInput.value) {
             calculateDates(new Date(dateInput.value));
        }
    }

    // Initial calculation on page load
    calculateAll();

}); // End DOMContentLoaded

// Add new function for date calculations (Days remaining/passed in year)
function calculateDates(selectedDate) {
    // Ensure selectedDate is a valid Date object
    if (!selectedDate || !(selectedDate instanceof Date) || isNaN(selectedDate.getTime())) {
        document.getElementById('A4').value = ""; // Days Remain
        document.getElementById('A4_2').value = ""; // Days Passed
        return;
    }

    const currentYear = selectedDate.getFullYear();

    // Calculate days remaining to end of year (inclusive of the selected day needs adjustment?)
    // Let's calculate based on start of next day to end of year for clarity
    const dayAfterSelected = new Date(selectedDate);
    dayAfterSelected.setDate(selectedDate.getDate() + 1);
    const lastDayOfYear = new Date(currentYear, 11, 31); // December 31st
    let differenceToEndOfYearDays = 0;
    if (dayAfterSelected <= lastDayOfYear) {
         const differenceToEndOfYearTime = lastDayOfYear.getTime() - dayAfterSelected.getTime();
          // Add 1 to include the last day fully. Use floor after dividing.
         differenceToEndOfYearDays = Math.floor(differenceToEndOfYearTime / (1000 * 3600 * 24)) + 1;
          // Also need to consider the selected day itself if calculation is "days remaining *including* today"
         // Re-think: Simpler might be total days in year - days passed.
     }


    // Calculate days passed from start of year (inclusive of the selected day)
    const startOfYear = new Date(currentYear, 0, 1); // January 1st
    const differenceFromStartOfYearTime = selectedDate.getTime() - startOfYear.getTime();
    // Add 1 day to include the start date
    const differenceFromStartOfYearDays = Math.floor(differenceFromStartOfYearTime / (1000 * 3600 * 24)) + 1;

    // Calculate total days in the year (handles leap years)
    const isLeap = (currentYear % 4 === 0 && currentYear % 100 !== 0) || (currentYear % 400 === 0);
    const totalDaysInYear = isLeap ? 366 : 365;

    // Calculate days remaining using total days - days passed
     const daysRemaining = totalDaysInYear - differenceFromStartOfYearDays;


    document.getElementById('A4').value = daysRemaining; // Days Remain
    document.getElementById('A4_2').value = differenceFromStartOfYearDays; // Days Passed
}
