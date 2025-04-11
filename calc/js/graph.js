// Load the Google Charts Visualization API and the corechart package.
google.charts.load('current', {'packages':['corechart', 'table']});

// Flag to track if Google Charts library is loaded
let googleChartsLoaded = false;

// Global variables
let fullPeriodData = [];
let globalPaymentsPerYear = 12;
let globalStartCalendarYear = new Date().getFullYear(); // Store the base calendar year
let extraPayments = {}; // Object to store extra payments { paymentNumber: amount }
let cumulativeDataTable = null; // Table instance for cumulative data

// References to slider elements (initialized later)
let periodYearSlider, periodYearDisplay;
let paymentYearSlider, paymentYearDisplay;

// Set the callback function to run when Google Charts is loaded
google.charts.setOnLoadCallback(setChartsLoadedAndDraw);

/**
 * Function called by Google Charts once it's loaded.
 */
function setChartsLoadedAndDraw() {
    console.log("Google Charts library loaded.");
    googleChartsLoaded = true;
    // Initialize slider element references
    periodYearSlider = document.getElementById('period-year-slider');
    periodYearDisplay = document.getElementById('period-year-display');
    paymentYearSlider = document.getElementById('payment-year-slider');
    paymentYearDisplay = document.getElementById('payment-year-display');

    // Add event listeners
    if (periodYearSlider) {
        periodYearSlider.addEventListener('input', handlePeriodSliderInput);
    }
    if (paymentYearSlider) {
        paymentYearSlider.addEventListener('input', handlePaymentSliderInput);
    }

    // Trigger the first calculation AFTER charts are loaded and elements are referenced
    if (typeof window.calculateAll === 'function') {
        console.log("Triggering initial calculation from Google Charts callback.");
        // Use a minimal timeout to ensure the rest of the DOM/scripts might finish processing
        setTimeout(() => {
             try {
                 window.calculateAll();
             } catch (error) {
                  console.error("Error during initial calculation from charts callback:", error);
             }
        }, 0); // Timeout 0 ms to run after current execution context
    } else {
         console.error("calculateAll function not found when charts loaded.");
    }
}

// Event handlers to sync sliders
function handlePeriodSliderInput() {
    if (paymentYearSlider) paymentYearSlider.value = periodYearSlider.value;
    updateFilteredTables();
}
function handlePaymentSliderInput() {
    if (periodYearSlider) periodYearSlider.value = paymentYearSlider.value;
    updateFilteredTables();
}

/**
 * Helper function to format numbers as currency strings.
 */
function formatCurrencyForTable(value) {
    if (isNaN(value) || value === null || typeof value === 'undefined') {
        return "$0.00";
    }
    const options = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    const formatted = value.toLocaleString('en-US', options);
    return formatted === '-$0.00' ? '$0.00' : formatted;
}

/**
 * Helper function to format numbers as percentages.
 */
function formatPercentForTable(value) {
    if (isNaN(value) || value === null || typeof value === 'undefined' || !isFinite(value)) {
        return "N/A"; // Or "0.00%" or "-" depending on preference
    }
    // Multiply by 100 and format to 2 decimal places
    return (value * 100).toFixed(2) + "%";
}

/**
 * Calculates the period-by-period and annual amortization data,
 * incorporating extra payments.
 * @param {object} extraPaymentsMap - Object mapping payment number to extra payment amount.
 * All other params are the same.
 */
function calculateAmortizationData(loanAmount, annualRate, paymentsPerYear, totalPayments, paymentAmountInput, purchasePrice, extraPaymentsMap = {}) {
    const chartData = [];
    const periodData = [];
    const annualData = [];
    chartData.push(['Payment #', 'Remaining Balance', 'Cumulative Principal', 'Cumulative Interest']);

    if (loanAmount <= 0 || annualRate < 0 || paymentsPerYear <= 0) { // Simplified initial check
        chartData.push([0, 0, 0, 0]);
        return { chartData, periodData, annualData, actualTotalPayments: 0 };
    }

    let remainingBalance = loanAmount;
    let cumulativePrincipal = 0;
    let cumulativeInterest = 0;
    const periodicRate = annualRate / paymentsPerYear;
    let calculatedPayment = paymentAmountInput;
    // If payment amount is zero or negative (invalid), calculate it based on loan terms
    if (calculatedPayment <= 0 && periodicRate > 0) {
         calculatedPayment = PMT(periodicRate, totalPayments, -loanAmount, 0);
    } else if (calculatedPayment <= 0 && periodicRate === 0) {
         calculatedPayment = loanAmount / totalPayments;
    }
    // If still invalid after calculation (e.g., totalPayments=0), handle error case
     if (calculatedPayment <= 0 || !isFinite(calculatedPayment)) {
         console.error("Could not determine a valid payment amount.");
         chartData.push([0, 0, 0, 0]);
         return { chartData, periodData, annualData, actualTotalPayments: 0 };
     }


    const calculateLTV = (currentBalance) => {
        if (purchasePrice && purchasePrice > 0) {
            return currentBalance / purchasePrice;
        }
        return NaN;
    };

    chartData.push([0, parseFloat(remainingBalance.toFixed(2)), parseFloat(cumulativePrincipal.toFixed(2)), parseFloat(cumulativeInterest.toFixed(2))]);
    periodData.push({
        paymentNumber: 0, scheduledPayment: 0, extraPayment: 0, paymentAmount: 0,
        principal: 0, interest: 0, totalInterest: 0,
        balance: parseFloat(remainingBalance.toFixed(2)), ltv: calculateLTV(remainingBalance)
    });

    let yearInterest = 0;
    let yearPrincipal = 0;
    let yearExtra = 0; // Track annual extra payments
    let currentYear = 1;
    let actualTotalPayments = 0; // Track actual payments made

    for (let i = 1; i <= totalPayments; i++) {
         // Stop if balance is already zero or below
         if (remainingBalance <= 0.005) {
            break;
         }
         actualTotalPayments = i; // Increment actual payments count

        let interestForPeriod = remainingBalance * periodicRate;
        let scheduledPrincipal = calculatedPayment - interestForPeriod;
        let extraPaymentForPeriod = extraPaymentsMap[i] || 0;
        let totalPaymentForPeriod = calculatedPayment + extraPaymentForPeriod;

        // Adjust if scheduled principal is more than balance (before extra payment)
        if (scheduledPrincipal > remainingBalance + 0.005) {
            scheduledPrincipal = remainingBalance;
            calculatedPayment = scheduledPrincipal + interestForPeriod; // Adjusted scheduled payment for this period
            totalPaymentForPeriod = calculatedPayment + extraPaymentForPeriod;
        }

        let principalApplied = scheduledPrincipal + extraPaymentForPeriod;

        // If total payment (including extra) is more than remaining balance + interest,
        // cap the payment and principal
        if (totalPaymentForPeriod > remainingBalance + interestForPeriod + 0.005) {
             principalApplied = remainingBalance;
             totalPaymentForPeriod = principalApplied + interestForPeriod;
             // Recalculate extra payment based on the capped total payment
             extraPaymentForPeriod = totalPaymentForPeriod - calculatedPayment;
             if (extraPaymentForPeriod < 0) extraPaymentForPeriod = 0; // Ensure it doesn't go negative
        }

        remainingBalance -= principalApplied;

        if (remainingBalance < 0) {
            // Adjust applied principal back if overshot due to rounding
            principalApplied += remainingBalance;
            remainingBalance = 0;
        }

        cumulativePrincipal += principalApplied;
        cumulativeInterest += interestForPeriod;
        yearInterest += interestForPeriod;
        // Separate principal paid into scheduled and extra for potential reporting
        yearPrincipal += principalApplied; // Total principal for the year
        yearExtra += extraPaymentForPeriod; // Accumulate extra payments for the year

        chartData.push([
            i, parseFloat(remainingBalance.toFixed(2)),
            parseFloat(cumulativePrincipal.toFixed(2)), parseFloat(cumulativeInterest.toFixed(2))
        ]);
        periodData.push({
            paymentNumber: i,
            scheduledPayment: parseFloat(calculatedPayment.toFixed(2)), // Store the base scheduled payment
            extraPayment: parseFloat(extraPaymentForPeriod.toFixed(2)),
            paymentAmount: parseFloat(totalPaymentForPeriod.toFixed(2)), // Total amount paid this period
            principal: parseFloat(principalApplied.toFixed(2)),
            interest: parseFloat(interestForPeriod.toFixed(2)),
            totalInterest: parseFloat(cumulativeInterest.toFixed(2)),
            balance: parseFloat(remainingBalance.toFixed(2)),
            ltv: calculateLTV(remainingBalance)
        });

        if (i % paymentsPerYear === 0 || remainingBalance <= 0.005) {
            annualData.push({
                year: currentYear,
                interestPaid: parseFloat(yearInterest.toFixed(2)),
                principalPaid: parseFloat(yearPrincipal.toFixed(2)),
                extraPaid: parseFloat(yearExtra.toFixed(2)), // Include extra paid in annual summary
                totalPaid: parseFloat((yearInterest + yearPrincipal).toFixed(2)), // Base total + interest
                endingBalance: parseFloat(remainingBalance.toFixed(2)),
                ltv: calculateLTV(remainingBalance)
            });
            yearInterest = 0; yearPrincipal = 0; yearExtra = 0; currentYear++;
        }

         // Break after processing the period where balance hit zero
         if (remainingBalance <= 0.005) {
             break;
         }
    }

    // Final balance correction not strictly needed due to loop break condition

    return { chartData, periodData, annualData, actualTotalPayments };
}

/**
 * Updates the filtered Period and Payment tables based on the selected year.
 */
function updateFilteredTables() {
    if (!fullPeriodData || fullPeriodData.length <= 1) return; // No data
    if (!periodYearSlider || !paymentYearSlider || !periodYearDisplay || !paymentYearDisplay) {
        console.warn("Slider elements not yet initialized.");
        return;
    }

    const selectedLoanYearNum = parseInt(periodYearSlider.value);
    const displayCalendarYear = globalStartCalendarYear + selectedLoanYearNum - 1;
    periodYearDisplay.textContent = displayCalendarYear;
    paymentYearDisplay.textContent = displayCalendarYear;

    const startPaymentNum = (selectedLoanYearNum - 1) * globalPaymentsPerYear + 1;
    const endPaymentNum = selectedLoanYearNum * globalPaymentsPerYear;

    const filteredData = fullPeriodData.slice(1)
        .filter(row => row.paymentNumber >= startPaymentNum && row.paymentNumber <= endPaymentNum);

    const periodTableBody = document.getElementById('period_table_body');
    const paymentTableBody = document.getElementById('payment_table_body');
    const invalidDataMessage = '<tr><td colspan="%COLS%" class="text-center p-3">No data for selected year.</td></tr>';
    const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // --- Populate Filtered Period Table ---
    if (filteredData.length > 0) {
        let periodHTML = '';
        filteredData.forEach(row => {
            const paymentIndexWithinYear = (row.paymentNumber - 1) % globalPaymentsPerYear;
            const monthName = monthNames[paymentIndexWithinYear] || 'Err';
            const displayMonthYear = `${monthName} ${displayCalendarYear}`;
            // Get current extra payment value for this row to determine displayed total
            const currentExtra = extraPayments[row.paymentNumber] || 0;
            const displayTotalPayment = row.scheduledPayment + currentExtra;

            periodHTML += `
                <tr>
                    <td>${displayMonthYear}</td>
                    <td>${formatCurrencyForTable(row.scheduledPayment)}</td>
                    <td>${formatCurrencyForTable(row.interest)}</td>
                    <td>${formatCurrencyForTable(row.principal)}</td>
                    <td>
                         <input type="text" 
                                class="form-control form-control-sm total-payment-input" 
                                data-payment-number="${row.paymentNumber}" 
                                data-scheduled-payment="${row.scheduledPayment.toFixed(2)}"
                                value="${displayTotalPayment.toFixed(2)}" 
                                placeholder="${row.scheduledPayment.toFixed(2)}"
                                oninput="handleTotalPaymentInput(this)"
                                onblur="formatTotalPaymentBlur(this)"
                                style="min-width: 100px; text-align: right;">
                    </td>
                    <td>${formatPercentForTable(row.ltv)}</td>
                    <td>${formatCurrencyForTable(row.balance)}</td>
                </tr>
            `;
        });
        periodTableBody.innerHTML = periodHTML;
    } else {
        // Adjust colspan for new columns (7 columns now)
        periodTableBody.innerHTML = invalidDataMessage.replace('%COLS%', '7');
    }

    // --- Populate Filtered Payment Table ---
     if (filteredData.length > 0) {
        let paymentHTML = '';
        filteredData.forEach(row => {
             const paymentIndexWithinYear = (row.paymentNumber - 1) % globalPaymentsPerYear;
             const monthName = monthNames[paymentIndexWithinYear] || 'Err';
             const displayMonthYear = `${monthName} ${displayCalendarYear}`;
              // Get current extra payment value for this row
             const currentExtra = extraPayments[row.paymentNumber] || 0;
             const displayTotalPayment = row.scheduledPayment + currentExtra;
            paymentHTML += `
                <tr>
                    <td>${displayMonthYear}</td>
                    <td>${formatCurrencyForTable(row.scheduledPayment)}</td>
                    <!-- Removed extra payment column -->
                    <td>${formatCurrencyForTable(displayTotalPayment)}</td>
                    <td>${formatPercentForTable(row.ltv)}</td>
                    <td>${formatCurrencyForTable(row.balance)}</td>
                </tr>
            `;
        });
        paymentTableBody.innerHTML = paymentHTML;
    } else {
         // Adjust colspan for new columns (5 columns now)
        paymentTableBody.innerHTML = invalidDataMessage.replace('%COLS%', '5');
    }
}

// --- Handlers for Total Payment Input ---

// Debounce function
function debounceExtra(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Function to handle input, update storage, and trigger recalculation (debounced)
const handleTotalPaymentInput = debounceExtra((inputElement) => {
    const paymentNumber = parseInt(inputElement.dataset.paymentNumber);
    const scheduledPayment = parseFloat(inputElement.dataset.scheduledPayment) || 0;
    let enteredTotalValue = parseFloat(inputElement.value.replace(/[^\d.]/g, '')) || 0;

    if (enteredTotalValue < scheduledPayment) {
         enteredTotalValue = scheduledPayment; // Cannot pay less than scheduled
         inputElement.value = enteredTotalValue.toFixed(2); // Update input visually
    }

    const extraPayment = enteredTotalValue - scheduledPayment;

    if (!isNaN(paymentNumber)) {
         if (extraPayment > 0.005) { // Store only if there's a significant extra payment
            extraPayments[paymentNumber] = parseFloat(extraPayment.toFixed(2));
            inputElement.value = enteredTotalValue.toFixed(2); // Format input
        } else {
            delete extraPayments[paymentNumber]; // Remove if total equals scheduled (or less)
             // Reset field to scheduled payment if extra is effectively zero or negative
             inputElement.value = scheduledPayment.toFixed(2);
        }
        console.log("Extra Payments Updated (derived from total):", extraPayments);
        // Trigger full recalculation from calc.js
        if (typeof calculateAll === 'function') {
            calculateAll();
        } else {
            console.error("calculateAll function not found for recalculation.");
        }
    }
}, 750); // Debounce time

// Function to format on blur
function formatTotalPaymentBlur(inputElement) {
     const scheduledPayment = parseFloat(inputElement.dataset.scheduledPayment) || 0;
     let enteredTotalValue = parseFloat(inputElement.value.replace(/[^\d.]/g, '')) || 0;

     if (enteredTotalValue < scheduledPayment - 0.005) {
         // If value is less than scheduled on blur, reset to scheduled
         enteredTotalValue = scheduledPayment;
         // Also ensure extra payment is removed from storage
         const paymentNumber = parseInt(inputElement.dataset.paymentNumber);
         if (!isNaN(paymentNumber) && extraPayments[paymentNumber]) {
             delete extraPayments[paymentNumber];
             console.log("Extra Payments Updated (removed on blur due to underpayment):", extraPayments);
             // Optionally trigger recalculation again if needed, though debounce should handle it
         }
     }
     // Always format to 2 decimal places on blur
     inputElement.value = enteredTotalValue.toFixed(2);
}

// --- Global Variables for Summary Table ---

/**
 * Draws a detailed table showing monthly and cumulative data for expenses, revenue and cash flow.
 * @param {Date} startDate - The closing date (starting point for calculations)
 * @param {number} loanTermMonths - Number of months to display
 * @param {object} expenseData - Contains monthly expense data (b64, c65, d66)
 * @param {object} revenueData - Contains monthly revenue data (b67, c68, d69)
 */
window.drawCumulativeDataTable = function(startDate, loanTermMonths, expenseData, revenueData) {
    const tableDiv = document.getElementById('google_cumulative_range_table');
    if (!tableDiv) {
        console.error('Cumulative data table container div not found.');
        return;
    }

    // First, remove any existing pager divs to prevent duplication
    const existingPagerDivs = document.querySelectorAll('.table-pager');
    existingPagerDivs.forEach(div => {
        if (div.parentNode) {
            div.parentNode.removeChild(div);
        }
    });

    if (!googleChartsLoaded || typeof google.visualization === 'undefined' || typeof google.visualization.Table === 'undefined') {
        console.warn('Google Charts Visualization or Table package not ready for cumulative data table.');
        tableDiv.innerHTML = '<p class="text-center p-3">Google Charts loading...</p>';
        return;
    }

    // Extract monthly base values (ensure they are numbers)
    const monthlyExpenseMin = Number(expenseData?.b64) || 0;
    const monthlyExpenseMax = Number(expenseData?.c64) || 0;
    const monthlyExpenseAvg = Number(expenseData?.d64) || 0;
    const monthlyRevenueMin = Number(revenueData?.b65) || 0;
    const monthlyRevenueMax = Number(revenueData?.c65) || 0;
    const monthlyRevenueAvg = Number(revenueData?.d65) || 0;

    // Calculate monthly cash flow base values
    const monthlyFlowMin = monthlyRevenueMin + monthlyExpenseMin; // Expense is already negative
    const monthlyFlowMax = monthlyRevenueMax + monthlyExpenseMax; // Expense is already negative
    const monthlyFlowAvg = monthlyRevenueAvg + monthlyExpenseAvg; // Expense is already negative

    // Create data table
    const data = new google.visualization.DataTable();
    
    // Define columns
    data.addColumn('string', 'Date');
    data.addColumn('number', 'Monthly Expense [Min]');
    data.addColumn('number', 'Cumulative Expense [Min]');
    data.addColumn('number', 'Monthly Expense [Max]');
    data.addColumn('number', 'Cumulative Expense [Max]');
    data.addColumn('number', 'Monthly Expense [Avg]');
    data.addColumn('number', 'Cumulative Expense [Avg]');
    data.addColumn('number', 'Monthly Revenue [Min]');
    data.addColumn('number', 'Cumulative Revenue [Min]');
    data.addColumn('number', 'Monthly Revenue [Max]');
    data.addColumn('number', 'Cumulative Revenue [Max]');
    data.addColumn('number', 'Monthly Revenue [Avg]');
    data.addColumn('number', 'Cumulative Revenue [Avg]');
    data.addColumn('number', 'Cash Flow [Min]');
    data.addColumn('number', 'Cash Flow [Max]');
    data.addColumn('number', 'Cash Flow [Avg]');
    // Add hidden year column for grouping
    data.addColumn('number', 'Year');

    // Prepare starting date - always first day of the next month after closing date
    let currentDate = new Date(startDate);
    
    // Make sure we're working with a valid date
    if (isNaN(currentDate.getTime())) {
        console.warn('Invalid start date provided, using current date');
        currentDate = new Date();
    }
    
    console.log('Original start date:', currentDate.toISOString());
    
    // Calculate the first day of the next month
    // First move to the first day of the current month
    currentDate.setDate(1);
    // Then move to the next month
    currentDate.setMonth(currentDate.getMonth() + 1);
    
    console.log('Adjusted start date (1st of next month):', currentDate.toISOString());
    
    let cumulativeExpenseMin = 0;
    let cumulativeExpenseMax = 0;
    let cumulativeExpenseAvg = 0;
    let cumulativeRevenueMin = 0;
    let cumulativeRevenueMax = 0; 
    let cumulativeRevenueAvg = 0;
    let cumulativeFlowMin = 0;
    let cumulativeFlowMax = 0;
    let cumulativeFlowAvg = 0;

    // For each month in loan term
    let currentExpenseMin = monthlyExpenseMin;
    let currentExpenseMax = monthlyExpenseMax;
    let currentExpenseAvg = monthlyExpenseAvg;
    let currentRevenueMin = monthlyRevenueMin;
    let currentRevenueMax = monthlyRevenueMax;
    let currentRevenueAvg = monthlyRevenueAvg;
    
    // Get unique years from the date range for pagination
    const startYear = currentDate.getFullYear();
    const uniqueYears = [];
    let lastYearSeen = -1;
    
    // First pass - collect years and calculate year boundaries
    const yearData = {};
    let tempDate = new Date(currentDate); // Use the adjusted start date
    
    for (let i = 0; i < loanTermMonths; i++) {
        const year = tempDate.getFullYear();
        if (year !== lastYearSeen) {
            lastYearSeen = year;
            uniqueYears.push(year);
            yearData[year] = { startIndex: i, count: 1 };
        } else {
            yearData[year].count++;
        }
        tempDate.setMonth(tempDate.getMonth() + 1);
    }
    
    // Second pass - add actual data rows
    const cumulativeDataByMonth = []; // Store all monthly data points for the chart
    
    for (let i = 0; i < loanTermMonths; i++) {
        // Calculate current month's values
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        // Format date as MMM-YYYY (e.g., Jan-2023)
        const dateString = currentDate.toLocaleString('default', { month: 'short' }) + '-' + year;
        
        // Update cumulative values
        cumulativeExpenseMin += currentExpenseMin;
        cumulativeExpenseMax += currentExpenseMax;
        cumulativeExpenseAvg += currentExpenseAvg;
        cumulativeRevenueMin += currentRevenueMin;
        cumulativeRevenueMax += currentRevenueMax;
        cumulativeRevenueAvg += currentRevenueAvg;
        
        // Calculate current month's cash flow
        const cashFlowMin = currentRevenueMin + currentExpenseMin;
        const cashFlowMax = currentRevenueMax + currentExpenseMax;
        const cashFlowAvg = currentRevenueAvg + currentExpenseAvg;
        
        // Update cumulative cash flow
        cumulativeFlowMin += cashFlowMin;
        cumulativeFlowMax += cashFlowMax;
        cumulativeFlowAvg += cashFlowAvg;
        
        // Store the monthly data for the chart
        cumulativeDataByMonth.push({
            date: dateString,
            year: year,
            month: month,
            expenseMin: cumulativeExpenseMin,
            expenseMax: cumulativeExpenseMax,
            expenseAvg: cumulativeExpenseAvg,
            revenueMin: cumulativeRevenueMin,
            revenueMax: cumulativeRevenueMax,
            revenueAvg: cumulativeRevenueAvg,
            flowMin: cumulativeFlowMin,
            flowMax: cumulativeFlowMax,
            flowAvg: cumulativeFlowAvg
        });
        
        // Add row to data table with year as last column (for grouping)
        data.addRow([
            dateString,
            currentExpenseMin,
            cumulativeExpenseMin,
            currentExpenseMax,
            cumulativeExpenseMax,
            currentExpenseAvg,
            cumulativeExpenseAvg,
            currentRevenueMin,
            cumulativeRevenueMin,
            currentRevenueMax,
            cumulativeRevenueMax,
            currentRevenueAvg,
            cumulativeRevenueAvg,
            cashFlowMin,
            cashFlowMax,
            cashFlowAvg,
            year // Hidden column for year grouping
        ]);
        
        // Move to next month
        currentDate.setMonth(currentDate.getMonth() + 1);
        
        // Values remain constant (monthly growth removed)
    }

    // Store the monthly cumulative data globally so it can be used by the ApexChart
    window.cumulativeDataForChart = {
        monthlyData: cumulativeDataByMonth,
        years: uniqueYears
    };
    
    // If the ApexChart exists, update it with the new data
    if (typeof window.updateApexRangeChartFromTableData === 'function') {
        window.updateApexRangeChartFromTableData();
    }

    // Apply currency formatting to all numeric columns
    const currencyFormatter = new google.visualization.NumberFormat({
        prefix: '$', 
        pattern: '#,##0.00;(#,##0.00)', // Standard accounting format
        fractionDigits: 2
    });

    // Apply formatter to all numeric columns (indices 1 through 15)
    for (let i = 1; i <= 15; i++) {
        currencyFormatter.format(data, i);
    }

    // Create a view with the year column hidden
    const view = new google.visualization.DataView(data);
    view.hideColumns([16]); // Hide the year column (index 16)

    // Add page navigation controls
    const pagerDiv = document.createElement('div');
    pagerDiv.className = 'table-pager d-flex justify-content-between align-items-center my-2';
    pagerDiv.innerHTML = `
        <div>
            <button id="prev-year-btn" class="btn btn-sm btn-outline-secondary me-1">&laquo; Prev Year</button>
            <button id="next-year-btn" class="btn btn-sm btn-outline-secondary">Next Year &raquo;</button>
        </div>
        <div id="year-indicator" class="fw-bold"></div>
        <div class="year-selector">
            <select id="year-select" class="form-select form-select-sm" style="width: auto;">
                ${uniqueYears.map((year, idx) => `<option value="${idx}">${year}</option>`).join('')}
            </select>
        </div>
    `;
    
    // Insert pager before the table
    tableDiv.parentNode.insertBefore(pagerDiv, tableDiv);
    
    // Create a DataView to filter by year
    let currentYearIndex = 0;
    
    // Define table options
    const options = {
        showRowNumber: false, 
        width: '100%', 
        height: '400px',  // Increased height for larger table
        allowHtml: true,
        page: 'enable',   // Standard paging
        pageSize: 12,     // Default page size
        cssClassNames: {
            headerRow: 'table-light sticky-top small',
            tableRow: 'small',
            oddTableRow: 'small bg-light',
            headerCell: 'text-center fw-bold',
            tableCell: 'text-end'
        }
    };
    
    // Initialize the table instance
    cumulativeDataTable = new google.visualization.Table(tableDiv);
    
    // Function to update the view with the current year filter
    const updateYearFilter = () => {
        const currentYear = uniqueYears[currentYearIndex];
        
        // Create a new DataView that filters for the current year
        const view = new google.visualization.DataView(data);
        
        // Create a filter that shows only rows where the year column equals currentYear
        const rows = data.getFilteredRows([{column: 16, value: currentYear}]);
        view.setRows(rows);
        
        // Hide the year column (index 16)
        view.hideColumns([16]);
        
        // Update the year indicator text
        document.getElementById('year-indicator').textContent = `Year: ${currentYear}`;
        document.getElementById('year-select').value = currentYearIndex;
        
        // Update button states
        document.getElementById('prev-year-btn').disabled = currentYearIndex === 0;
        document.getElementById('next-year-btn').disabled = currentYearIndex === uniqueYears.length - 1;
        
        // Draw the table with the filtered view
        cumulativeDataTable.draw(view, options);
    };
    
    // Handle pager events
    document.getElementById('prev-year-btn').addEventListener('click', () => {
        if (currentYearIndex > 0) {
            currentYearIndex--;
            updateYearFilter();
        }
    });
    
    document.getElementById('next-year-btn').addEventListener('click', () => {
        if (currentYearIndex < uniqueYears.length - 1) {
            currentYearIndex++;
            updateYearFilter();
        }
    });
    
    document.getElementById('year-select').addEventListener('change', (e) => {
        const selectedPageIndex = parseInt(e.target.value);
        if (selectedPageIndex >= 0 && selectedPageIndex < uniqueYears.length) {
            currentYearIndex = selectedPageIndex;
            updateYearFilter();
        }
    });

    try {
        // Initial draw with the first year filtered
        updateYearFilter();
        
        console.log("Cumulative data table drawn with data grouped by years.");
    } catch (err) {
        console.error("Error drawing cumulative data table:", err);
        tableDiv.innerHTML = '<p class="text-center p-3 text-danger">Error drawing table: ' + err.message + '</p>';
        
        // Remove pager if there was an error
        if (pagerDiv.parentNode) {
            pagerDiv.parentNode.removeChild(pagerDiv);
        }
    }
};

/**
 * Clears the cumulative data table.
 */
window.clearCumulativeTable = function() {
     const tableDiv = document.getElementById('google_cumulative_range_table');
     // Remove all table-pager divs that might have been added
     const pagerDivs = document.querySelectorAll('.table-pager');
     pagerDivs.forEach(div => {
         if (div.parentNode) {
             div.parentNode.removeChild(div);
         }
     });
     
     // Clear the global data for the chart
     window.cumulativeDataForChart = null;
     
     if (tableDiv) {
         if (cumulativeDataTable) {
             try {
                 cumulativeDataTable.clearChart();
             } catch (e) {
                  console.error("Error clearing cumulative data table:", e);
             }
         }
         // Display a placeholder message
         tableDiv.innerHTML = '<p class="text-center p-3">Enter valid data to see the cumulative data.</p>';
     } else {
          console.warn("Cumulative data table container not found for clearing.");
     }
};

/**
 * Populates the Amortization Tables (now separated from chart drawing).
 */
window.drawAmortizationChart = function(startCalendarYear = new Date().getFullYear()) {
     globalStartCalendarYear = startCalendarYear;
     console.log("Attempting to update tables...");

    const annualTableBody = document.getElementById('annual_table_body');
    const periodTableBody = document.getElementById('period_table_body');
    const paymentTableBody = document.getElementById('payment_table_body');

    if (!periodYearSlider || !paymentYearSlider || !periodYearDisplay || !paymentYearDisplay) {
        console.warn("Slider elements not found yet, re-initializing...");
        setChartsLoadedAndDraw();
        if (!periodYearSlider || !paymentYearSlider) { 
             console.error("Required slider elements could not be initialized.");
        return;
        }
    }
    if (!annualTableBody || !periodTableBody || !paymentTableBody) {
        console.error("Required elements (table bodies) not found.");
        return []; // Return empty for error
    }

    // --- Get Data from HTML Inputs ---
    const safeParseCurrency = typeof parseCurrency === 'function' ? parseCurrency : (val) => parseFloat(String(val).replace(/[^-\d.]/g, '')) || 0;
    const loanAmount = safeParseCurrency(document.getElementById('B5')?.value) || 0;
    const annualRate = (parseFloat(document.getElementById('B6')?.value.replace(/,/g, '')) / 100) || 0;
    const totalPaymentsInput = parseInt(document.getElementById('B9')?.value.replace(/,/g, ''), 10) || 0;
    globalPaymentsPerYear = parseInt(document.getElementById('B8')?.value.replace(/,/g, ''), 10) || 12;
    const paymentAmountInput = safeParseCurrency(document.getElementById('B10')?.value) || 0;
    const purchasePrice = safeParseCurrency(document.getElementById('B1')?.value) || 0;

    // --- Clear previous content ---
    annualTableBody.innerHTML = '';
    periodTableBody.innerHTML = '';
    paymentTableBody.innerHTML = '';

    // --- Check for valid loan data ---
    const invalidDataMessage = '<tr><td colspan="%COLS%" class="text-center p-3">Enter valid loan details.</td></tr>';
    // Check base parameters needed for calculation
    if (loanAmount <= 0 || annualRate < 0 || globalPaymentsPerYear <= 0 || totalPaymentsInput <= 0) {
        // If base loan terms are invalid, display error and clear extra payments
        annualTableBody.innerHTML = invalidDataMessage.replace('%COLS%', '7'); // Annual still has 7 cols
        periodTableBody.innerHTML = invalidDataMessage.replace('%COLS%', '7'); // Period now has 7 cols
        paymentTableBody.innerHTML = invalidDataMessage.replace('%COLS%', '5'); // Payment now has 5 cols
        if(periodYearSlider) { periodYearSlider.max = 1; periodYearSlider.value = 1; }
        if(paymentYearSlider) { paymentYearSlider.max = 1; paymentYearSlider.value = 1; }
        if(periodYearDisplay) periodYearDisplay.textContent = globalStartCalendarYear;
        if(paymentYearDisplay) paymentYearDisplay.textContent = globalStartCalendarYear;
        fullPeriodData = [];
        extraPayments = {}; // Clear extra payments when loan details are invalid
        console.log("Invalid base loan data, cleared extra payments.");
        return [];
    }

    // --- Calculate Amortization Data (passing extraPayments) ---
    // Pass the *currently stored* extra payments to the calculation
    const { chartData, periodData, annualData, actualTotalPayments } = calculateAmortizationData(
        loanAmount, annualRate, globalPaymentsPerYear,
        totalPaymentsInput, // Use original total payments from input as max limit
        paymentAmountInput, purchasePrice, extraPayments
    );

    // --- Store full period data globally ---
    fullPeriodData = periodData;

    // --- Setup Sliders ---
    // Base the slider max on the *actual* number of years based on calculation
    const numberOfYears = annualData.length > 0 ? annualData[annualData.length - 1].year : 1;
    let currentPeriodSliderValue = periodYearSlider ? parseInt(periodYearSlider.value) : 1;
    let currentPaymentSliderValue = paymentYearSlider ? parseInt(paymentYearSlider.value) : 1;

    periodYearSlider.max = numberOfYears;
    paymentYearSlider.max = numberOfYears;

    // Keep current slider value if valid, otherwise reset to 1
    periodYearSlider.value = (currentPeriodSliderValue > 0 && currentPeriodSliderValue <= numberOfYears) ? currentPeriodSliderValue : 1;
    paymentYearSlider.value = (currentPaymentSliderValue > 0 && currentPaymentSliderValue <= numberOfYears) ? currentPaymentSliderValue : 1;

    // --- Populate Annual Table ---
    // Adjust colspan if extra paid column is added
    const annualColspan = 7;
    if (annualData.length > 0) {
        let annualHTML = '';
        // Add Extra Paid header if not already there (optional, could be done in HTML)
        // Assuming header is: Year | Interest | Principal | Extra | Total | LTV | Balance
        annualData.forEach(row => {
             const displayYear = globalStartCalendarYear + row.year - 1;
            annualHTML += `
                <tr>
                    <td>${displayYear}</td>
                    <td>${formatCurrencyForTable(row.interestPaid)}</td>
                    <td>${formatCurrencyForTable(row.principalPaid)}</td>
                     <td>${formatCurrencyForTable(row.extraPaid)}</td>
                     <td>${formatCurrencyForTable(row.totalPaid + row.extraPaid)}</td> 
                    <td>${formatPercentForTable(row.ltv)}</td>
                    <td>${formatCurrencyForTable(row.endingBalance)}</td>
                </tr>
            `;
        });
        annualTableBody.innerHTML = annualHTML;
    } else {
        annualTableBody.innerHTML = invalidDataMessage.replace('%COLS%', annualColspan);
    }

    // --- Trigger initial filtering and population of Period/Payment tables ---
    updateFilteredTables(); // This will now generate the editable Total Payment field

    console.log("Tables update finished.");
    return periodData; // Return the calculated data
}

// --- Resize Listener ---
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    // Only redraw tables on resize now, ApexCharts might handle its own resize
    resizeTimeout = setTimeout(() => {
        if (typeof window.drawAmortizationChart === 'function') {
             // Re-calculate and update tables
              window.drawAmortizationChart(globalStartCalendarYear);
         }
         // Potentially trigger ApexCharts redraw if needed, but often automatic
         // if (typeof apexChartInstance !== 'undefined' && apexChartInstance) {
         //     apexChartInstance.updateOptions({}); // Basic trigger
         // }
     }, 250);
});

// Helper function fallback for parseCurrency
if (typeof parseCurrency === 'undefined') {
function parseCurrency(valueString) {
    if (typeof valueString !== 'string') return 0;
    return parseFloat(valueString.replace(/[^-\d.]/g, '')) || 0;
    }
}
