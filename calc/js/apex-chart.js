// Global variable to hold the chart instance
let apexChartInstance = null;
// Global variable for the new range chart instance
let apexRangeChartInstance = null;

// --- Define currency formatter locally ---
const formatCurrencyForApex = function(value) {
    if (isNaN(value) || value === null || typeof value === 'undefined') {
        return "$0.00";
    }
    const options = { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: 2 };
    // Handle potential large negative numbers formatting incorrectly
    const absValue = Math.abs(value);
    let formatted = absValue.toLocaleString('en-US', options);
    // Remove potential negative sign added by toLocaleString on absolute value near zero
    formatted = formatted.replace(/^-$/, '$');
    // Re-add negative sign if original value was negative
    if (value < 0) {
        formatted = '-' + formatted;
    }
    // Ensure -$0.00 becomes $0.00
    if (formatted === '-$0.00') {
        formatted = '$0.00';
    }
    return formatted;
};

// Function to update or create the ApexCharts amortization chart
window.updateApexAmortizationChart = function(periodData, startYear, paymentsPerYear) {
    const chartDiv = document.querySelector("#apex_amortization_chart");
    if (!chartDiv) {
        console.error("ApexCharts container div '#apex_amortization_chart' not found.");
        return;
    }

    // Check if ApexCharts library is loaded
    if (typeof ApexCharts === 'undefined') {
        console.error("ApexCharts library is not loaded.");
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error: ApexCharts library not loaded.</p>';
        return;
    }

    // Handle empty or invalid data
    if (!periodData || periodData.length <= 1 || !startYear || !paymentsPerYear) {
         console.log("No valid data or missing params for ApexChart.");
         if (apexChartInstance) {
             apexChartInstance.updateOptions({
                 series: [],
                 xaxis: { categories: [] , type: 'numeric'}, // Reset xaxis type if cleared
                 noData: { text: 'Enter valid loan details.' }
             });
         } else {
             chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid loan details to see the chart.</p>';
         }
         return;
    }

    // --- Prepare data for ApexCharts (datetime format) ---
    const balanceData = [];
    const cumulativePrincipalData = [];
    const cumulativeInterestData = [];
    let currentCumulativePrincipal = 0;
    let currentCumulativeInterest = 0;

    // Calculate the date of the first payment (assuming end of first period)
    // We need the *actual* closing date to be precise, but we only have the year.
    // Let's assume the loan starts Jan 1st of startYear for simplicity in date calculation.
    const firstPaymentDate = new Date(Date.UTC(startYear, 0, 1)); // Jan 1st of start year (UTC)

    periodData.slice(1).forEach((row, index) => {
        currentCumulativePrincipal += row.principal;
        currentCumulativeInterest += row.interest;

        // Calculate the timestamp for the current payment
        // index represents months elapsed since first payment (0-indexed)
        const paymentDate = new Date(firstPaymentDate);
        paymentDate.setUTCMonth(firstPaymentDate.getUTCMonth() + index);
        const timestamp = paymentDate.getTime();

        balanceData.push([timestamp, parseFloat(row.balance.toFixed(2))]);
        cumulativePrincipalData.push([timestamp, parseFloat(currentCumulativePrincipal.toFixed(2))]);
        cumulativeInterestData.push([timestamp, parseFloat(currentCumulativeInterest.toFixed(2))]);
    });

    const series = [
        { name: 'Remaining Balance', data: balanceData },
        { name: 'Cumulative Principal', data: cumulativePrincipalData },
        { name: 'Cumulative Interest', data: cumulativeInterestData }
    ];

    // --- Define ApexCharts Options ---
    const options = {
        chart: {
            height: 400,
            type: 'line',
            zoom: { enabled: true, type: 'x', autoScaleYaxis: true }, // Enable x-axis zoom
            toolbar: {
                 show: true,
                 tools: {
                     download: true,
                     selection: true, // Enable selection zoom
                     zoom: true,
                     zoomin: true,
                     zoomout: true,
                     pan: true,
                     reset: true
                 }
            }
        },
        series: series,
        xaxis: {
            type: 'datetime',
            title: { text: 'Payment Date' },
            labels: {
                datetimeUTC: false, // Display dates in local time
                format: 'MMM yyyy', // Format like Jan 2025
                 style: {
                    fontSize: '10px' // Smaller font if needed
                }
            },
            tooltip: {
                enabled: true,
                format: 'MMMM yyyy' // Tooltip format for x-axis
            }
        },
        yaxis: {
            title: { text: 'Amount ($)' },
            labels: {
                formatter: function (value) {
                    return formatCurrencyForApex(value);
                }
            },
             min: 0
        },
        stroke: { curve: 'straight', width: 2 },
        tooltip: {
            enabled: true,
            shared: true,  // Show tooltip with all series for the hovered x-value
            intersect: false, // Tooltip appears when hovering the x-axis position
            x: {
                format: 'MMMM yyyy' // Date format in the tooltip header
            },
            y: {
                formatter: function (value) {
                    // Check if value exists before formatting
                    return value !== undefined ? formatCurrencyForApex(value) : '';
                }
            },
            marker: {
                 show: true // Show color marker in tooltip
            }
        },
        legend: { position: 'bottom', horizontalAlign: 'center', floating: false },
        colors: ['#008FFB', '#00E396', '#FEB019'], // Balance, Principal, Interest
        grid: { borderColor: '#f1f1f1' },
        markers: {
            size: 0, // Hide markers by default
            hover: {
                size: 5 // Show markers on hover
            }
        },
        annotations: { /* Empty annotations block */ },
        noData: { text: 'Loading chart data...' }
    };

    // --- Render or Update Chart ---
    try {
        if (apexChartInstance) {
            console.log("Updating existing ApexChart...");
            apexChartInstance.updateOptions(options, true, true); // Redraw, animate
        } else {
            console.log("Creating new ApexChart...");
            chartDiv.innerHTML = '';
            apexChartInstance = new ApexCharts(chartDiv, options);
            apexChartInstance.render();
        }
    } catch (err) {
        console.error("ApexCharts render/update error:", err);
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error rendering chart.</p>';
        // Destroy instance if creation failed partially
        if (apexChartInstance && typeof apexChartInstance.destroy === 'function') {
             try { apexChartInstance.destroy(); } catch (e) {}
             apexChartInstance = null;
        }
    }
};

// Optional: Function to clear the Apex chart
window.clearApexChart = function() {
     const chartDiv = document.querySelector("#apex_amortization_chart");
     if (apexChartInstance) {
         apexChartInstance.updateOptions({
             series: [],
             xaxis: { categories: [] , type: 'numeric'}, // Reset xaxis type
             noData: { text: 'Enter valid loan details.' }
         });
     } else if(chartDiv) {
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid loan details to see the chart.</p>';
     }
}

/**
 * Updates or creates the ApexCharts cumulative revenue/expense chart.
 * Uses 'line' type if min/max are the same, 'rangeArea' otherwise.
 * @param {number} ARmin - Minimum Annual Revenue.
 * @param {number} ARmax - Maximum Annual Revenue.
 * @param {number} AEmin - Minimum Annual Expense (should be negative).
 * @param {number} AEmax - Maximum Annual Expense (should be negative).
 * @param {number} loanTermYears - The total loan term in years.
 * @param {number} startCalendarYear - The calendar year the loan starts.
 */
window.updateApexCumulativeRangeChart = function(ARmin, ARmax, AEmin, AEmax, loanTermYears, startCalendarYear) {
    const chartDiv = document.querySelector("#apex_cumulative_range_chart");
    if (!chartDiv) {
        console.error("ApexCharts container div '#apex_cumulative_range_chart' not found.");
        return;
    }

    if (typeof ApexCharts === 'undefined') {
        console.error("ApexCharts library is not loaded.");
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error: ApexCharts library not loaded.</p>';
        return;
    }

    // Ensure numeric inputs
    ARmin = Number(ARmin) || 0;
    ARmax = Number(ARmax) || 0;
    AEmin = Number(AEmin) || 0;
    AEmax = Number(AEmax) || 0;
    loanTermYears = Number(loanTermYears) || 0;
    startCalendarYear = Number(startCalendarYear) || new Date().getFullYear();

    // --- Validate Data --- (Need at least some revenue/expense and term)
    if (loanTermYears <= 0 || (ARmin === 0 && ARmax === 0 && AEmin === 0 && AEmax === 0)) {
        console.log("No valid data for Apex Cumulative Range Chart.");
        if (apexRangeChartInstance) {
            apexRangeChartInstance.updateOptions({
                series: [],
                xaxis: { categories: [] },
                noData: { text: 'Enter valid revenue/expense data and loan term.' }
            });
        } else {
            chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid revenue/expense data and loan term.</p>';
        }
        return;
    }

    // --- Determine Series Types --- 
    const useLineForRevenue = Math.abs(ARmin - ARmax) < 0.01;
    const useLineForExpense = Math.abs(AEmin - AEmax) < 0.01;

    // --- Prepare Data Dynamically --- 
    const revenueData = [];
    const expenseData = [];
    let cumulativeARmin = 0;
    let cumulativeARmax = 0;
    let cumulativeAEmin = 0;
    let cumulativeAEmax = 0;
    const categories = [];

    for (let year = 1; year <= loanTermYears; year++) {
        cumulativeARmin += ARmin;
        cumulativeARmax += ARmax;
        cumulativeAEmin += AEmin;
        cumulativeAEmax += AEmax;

        const displayYear = startCalendarYear + year - 1;
        categories.push(displayYear);

        // Prepare Revenue Data Point
        const revValue = isFinite(cumulativeARmin) ? parseFloat(cumulativeARmin.toFixed(2)) : 0;
        const revValueMax = isFinite(cumulativeARmax) ? parseFloat(cumulativeARmax.toFixed(2)) : 0;
        if (useLineForRevenue) {
            revenueData.push({ x: displayYear, y: revValue });
        } else {
            revenueData.push({ x: displayYear, y: [revValue, revValueMax] });
        }

        // Prepare Expense Data Point
        const expValue = isFinite(cumulativeAEmin) ? parseFloat(cumulativeAEmin.toFixed(2)) : 0;
        const expValueMax = isFinite(cumulativeAEmax) ? parseFloat(cumulativeAEmax.toFixed(2)) : 0;
        if (useLineForExpense) {
            expenseData.push({ x: displayYear, y: expValue });
        } else {
            expenseData.push({ x: displayYear, y: [expValue, expValueMax] });
        }
    }

    // --- Define Chart Series Dynamically --- 
    const series = [];
    series.push({ 
        name: useLineForRevenue ? 'Revenue' : 'Revenue Range', 
        type: useLineForRevenue ? 'line' : 'rangeArea', 
        data: revenueData 
    });
    series.push({ 
        name: useLineForExpense ? 'Expense' : 'Expense Range', 
        type: useLineForExpense ? 'line' : 'rangeArea', 
        data: expenseData 
    });

    // --- Define Chart Options Dynamically --- 
    const options = {
        series: series,
        chart: {
            height: 350,
            type: 'line', // Default base type, will be overridden by series
            animations: { enabled: true },
            zoom: { enabled: true, type: 'x', autoScaleYaxis: true }, 
            toolbar: { 
                 show: true,
                 tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true } 
            }
        },
        // Dynamically set colors, fill, stroke, markers based on series types
        colors: [useLineForRevenue ? '#1A73E8' : '#2E93fA', useLineForExpense ? '#B32851' : '#F08080'], 
        fill: {
            // Opacity 1 for line, 0.4 for rangeArea
            opacity: [useLineForRevenue ? 1 : 0.4, useLineForExpense ? 1 : 0.4]
        },
        stroke: {
             curve: 'straight',
             // Width > 0 for line, 0 for rangeArea
             width: [useLineForRevenue ? 2 : 0, useLineForExpense ? 2 : 0]
        },
         markers: {
             // Size > 0 for line, 0 for rangeArea
             size: [useLineForRevenue ? 3 : 0, useLineForExpense ? 3 : 0],
             hover: { sizeOffset: 4 }
         },
        xaxis: {
            type: 'category',
            categories: categories,
            title: { text: 'Year' },
            tooltip: { enabled: false },
            axisTicks: { show: true, borderType: 'solid', color: '#78909C', height: 6, offsetX: 0, offsetY: 0 },
            tickPlacement: 'on',
            tickAmount: categories.length,
            labels: { hideOverlappingLabels: false }
        },
         yaxis: {
             title: { text: 'Cumulative Amount ($)' },
             labels: { formatter: function(val) { return formatCurrencyForApex(val); } }
         },
         legend: { position: 'top', horizontalAlign: 'center' },
         title: { text: 'Cumulative Revenue vs. Expense', align: 'center' }, // Simplified title
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            theme: 'light',
            style: {
                fontSize: '12px'
            },
            x: {
                show: true,
                format: 'MMM yyyy',
                formatter: undefined // Use default formatter for dates
            },
            y: {
                formatter: function(value) {
                    return formatCurrencyForApex(value);
                }
            },
            marker: { show: true },
            // Force the title to show correctly
            fixed: {
                enabled: false
            },
            onDatasetHover: {
                highlightDataSeries: true
            }
        },
        grid: {
             borderColor: '#f1f1f1',
             yaxis: { lines: { show: true } },
             xaxis: { lines: { show: false } }
        },
        noData: { text: 'Loading chart data...' }
    };

    // --- Render or Update Chart ---
    try {
        if (apexRangeChartInstance) {
            console.log("Updating existing Apex Cumulative Range Chart...");
            apexRangeChartInstance.updateOptions(options, true, true);
        } else {
            console.log("Creating new Apex Cumulative Range Chart...");
            chartDiv.innerHTML = ''; // Clear placeholder
            apexRangeChartInstance = new ApexCharts(chartDiv, options);
            apexRangeChartInstance.render();
        }
    } catch (err) {
        console.error("ApexCharts range chart render/update error:", err);
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error rendering range chart.</p>';
        if (apexRangeChartInstance && typeof apexRangeChartInstance.destroy === 'function') {
            try { apexRangeChartInstance.destroy(); } catch (e) {}
            apexRangeChartInstance = null;
        }
    }
};

// Function to clear the cumulative range chart
window.clearApexRangeChart = function() {
     const chartDiv = document.querySelector("#apex_cumulative_range_chart");
     // Note: we don't need to clear cumulativeDataForChart here as that should be handled by clearCumulativeTable
     if (apexRangeChartInstance) {
         apexRangeChartInstance.updateOptions({
             series: [],
             xaxis: { categories: [] },
             noData: { text: 'Enter valid revenue/expense data and loan term.' }
         });
     } else if(chartDiv) {
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid revenue/expense data and loan term.</p>';
     }
};

// Function to update the cumulative range chart using data from the table
window.updateApexRangeChartFromTableData = function() {
    // Check if the table data is available
    if (!window.cumulativeDataForChart) {
        console.warn("No cumulative data available from the table");
        return;
    }

    const chartDiv = document.querySelector("#apex_cumulative_range_chart");
    if (!chartDiv) {
        console.error("ApexCharts container div '#apex_cumulative_range_chart' not found.");
        return;
    }

    if (typeof ApexCharts === 'undefined') {
        console.error("ApexCharts library is not loaded.");
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error: ApexCharts library not loaded.</p>';
        return;
    }

    const { monthlyData, years } = window.cumulativeDataForChart;
    
    // Check if we have valid data
    if (!monthlyData || !monthlyData.length) {
        console.log("Insufficient data for Apex Cumulative Chart.");
        if (apexRangeChartInstance) {
            apexRangeChartInstance.updateOptions({
                series: [],
                xaxis: { categories: [] },
                noData: { text: 'No cumulative data available.' }
            });
        } else {
            chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid data to see the chart.</p>';
        }
        return;
    }

    // Prepare data for regular series instead of rangeArea
    const revenueMinData = [];
    const revenueMaxData = [];
    const revenueAvgData = [];
    const expenseMinData = [];
    const expenseMaxData = [];
    const expenseAvgData = [];
    const cashFlowMinData = [];
    const cashFlowMaxData = [];
    const cashFlowAvgData = [];
    const categories = [];

    // Collect data for each month
    monthlyData.forEach(monthData => {
        // Add the date to categories
        categories.push(monthData.date);
        
        // Revenue min/max/avg
        revenueMinData.push({
            x: monthData.date,
            y: isFinite(monthData.revenueMin) ? parseFloat(monthData.revenueMin.toFixed(2)) : 0
        });
        
        revenueMaxData.push({
            x: monthData.date,
            y: isFinite(monthData.revenueMax) ? parseFloat(monthData.revenueMax.toFixed(2)) : 0
        });
        
        revenueAvgData.push({
            x: monthData.date,
            y: isFinite(monthData.revenueAvg) ? parseFloat(monthData.revenueAvg.toFixed(2)) : 0
        });
        
        // Expense min/max/avg
        expenseMinData.push({
            x: monthData.date,
            y: isFinite(monthData.expenseMin) ? parseFloat(monthData.expenseMin.toFixed(2)) : 0
        });
        
        expenseMaxData.push({
            x: monthData.date,
            y: isFinite(monthData.expenseMax) ? parseFloat(monthData.expenseMax.toFixed(2)) : 0
        });
        
        expenseAvgData.push({
            x: monthData.date,
            y: isFinite(monthData.expenseAvg) ? parseFloat(monthData.expenseAvg.toFixed(2)) : 0
        });
        
        // Cash Flow min/max/avg
        cashFlowMinData.push({
            x: monthData.date,
            y: isFinite(monthData.flowMin) ? parseFloat(monthData.flowMin.toFixed(2)) : 0
        });
        
        cashFlowMaxData.push({
            x: monthData.date,
            y: isFinite(monthData.flowMax) ? parseFloat(monthData.flowMax.toFixed(2)) : 0
        });
        
        cashFlowAvgData.push({
            x: monthData.date,
            y: isFinite(monthData.flowAvg) ? parseFloat(monthData.flowAvg.toFixed(2)) : 0
        });
    });

    // Define series using regular area charts instead of rangeArea
    const series = [
        {
            name: 'Revenue Min',
            type: 'area',
            data: revenueMinData
        },
        {
            name: 'Expense Min',
            type: 'area',
            data: expenseMinData
        },
        {
            name: 'Cash Flow Min',
            type: 'area',
            data: cashFlowMinData
        },
        {
            name: 'Revenue Max',
            type: 'area',
            data: revenueMaxData
        },
        {
            name: 'Expense Max',
            type: 'area',
            data: expenseMaxData
        },
        {
            name: 'Cash Flow Max',
            type: 'area',
            data: cashFlowMaxData
        },
        {
            name: 'Revenue Forecast',
            type: 'line',
            data: revenueAvgData
        },
        {
            name: 'Expense Forecast',
            type: 'line',
            data: expenseAvgData
        },
        {
            name: 'Cash Flow Forecast',
            type: 'line',
            data: cashFlowAvgData
        }
    ];

    // Define chart options with enhanced styling
    const options = {
        series: series,
        chart: {
            height: 350,
            type: 'line',
            stacked: false,
            animations: { enabled: true },
            zoom: { enabled: true, type: 'x', autoScaleYaxis: true },
            toolbar: {
                show: true,
                tools: { download: true, selection: true, zoom: true, zoomin: true, zoomout: true, pan: true, reset: true }
            },
            fontFamily: 'Helvetica, Arial, sans-serif',
            background: '#fff'
        },
        colors: [
            'rgba(29, 105, 150, 0.2)',   // Revenue Min - light blue
            'rgba(220, 53, 69, 0.2)',    // Expense Min - light red
            'rgba(40, 167, 69, 0.2)',    // Cash Flow Min - light green
            'rgba(29, 105, 150, 0.8)',   // Revenue Max - dark blue
            'rgba(220, 53, 69, 0.8)',    // Expense Max - dark red
            'rgba(40, 167, 69, 0.8)',    // Cash Flow Max - dark green
            '#1a73e8',                   // Revenue Forecast - blue line
            '#b32851',                   // Expense Forecast - red line
            '#28a745'                    // Cash Flow Forecast - green line
        ],
        fill: {
            type: ['solid', 'solid', 'solid', 'solid', 'solid', 'solid', 'solid', 'solid', 'solid'],
            opacity: [0.1, 0.1, 0.1, 0.6, 0.6, 0.6, 1, 1, 1]
        },
        stroke: {
            curve: 'straight',
            width: [1, 1, 1, 1, 1, 1, 3, 3, 3],
            dashArray: [0, 0, 0, 0, 0, 0, 0, 0, 0]
        },
        markers: {
            size: [0, 0, 0, 0, 0, 0, 0, 0, 0], // Hide all markers by default - too many points for markers
            strokeWidth: [1, 1, 1, 1, 1, 1, 2, 2, 2],
            hover: { 
                size: 6
            }
        },
        xaxis: {
            type: 'category',
            categories: categories,
            title: { 
                text: 'Month',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            tooltip: { enabled: false },
            tickPlacement: 'on',
            labels: {
                rotate: -45,
                style: {
                    fontSize: '10px',
                    fontWeight: 500
                }
            },
            axisBorder: {
                show: true,
                color: '#78909C'
            },
            // Show only every 3rd month label to avoid overcrowding
            tickAmount: Math.min(20, Math.ceil(categories.length / 3))
        },
        yaxis: {
            title: { 
                text: 'Cumulative Amount ($)',
                style: {
                    fontSize: '12px',
                    fontWeight: 600
                }
            },
            labels: {
                formatter: function(val) { return formatCurrencyForApex(val); },
                style: {
                    fontSize: '12px'
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'center',
            fontSize: '13px',
            fontWeight: 500,
            markers: {
                width: 12,
                height: 12,
                strokeWidth: 0,
                radius: 2
            },
            itemMargin: {
                horizontal: 10,
                vertical: 5
            }
        },
        dataLabels: {
            enabled: false
        },
        title: {
            text: 'Monthly Cumulative Revenue, Expense & Cash Flow',
            align: 'center',
            style: {
                fontSize: '16px',
                fontWeight: 'bold'
            }
        },
        tooltip: {
            enabled: true,
            shared: true,
            intersect: false,
            theme: 'light',
            style: {
                fontSize: '12px'
            },
            x: {
                show: true,
                format: 'MMM yyyy',
                formatter: undefined // Use default formatter for dates
            },
            y: {
                formatter: function(value) {
                    return formatCurrencyForApex(value);
                }
            },
            marker: { show: true },
            // Force the title to show correctly
            fixed: {
                enabled: false
            },
            onDatasetHover: {
                highlightDataSeries: true
            }
        },
        grid: {
            borderColor: '#e0e0e0',
            strokeDashArray: 3,
            xaxis: { lines: { show: true } }, // Show vertical grid lines for months
            yaxis: { lines: { show: true } },
            padding: {
                top: 0,
                right: 10,
                bottom: 0,
                left: 10
            }
        },
        noData: { 
            text: 'Loading chart data...',
            align: 'center',
            verticalAlign: 'middle',
            style: {
                fontSize: '14px'
            }
        }
    };

    // Render or update chart
    try {
        if (apexRangeChartInstance) {
            console.log("Updating existing Apex Monthly Cumulative Chart...");
            apexRangeChartInstance.updateOptions(options, true, true);
        } else {
            console.log("Creating new Apex Monthly Cumulative Chart...");
            chartDiv.innerHTML = '';
            apexRangeChartInstance = new ApexCharts(chartDiv, options);
            apexRangeChartInstance.render();
        }
    } catch (err) {
        console.error("ApexCharts chart render/update error:", err);
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error rendering chart: ' + err.message + '</p>';
        if (apexRangeChartInstance && typeof apexRangeChartInstance.destroy === 'function') {
            try { apexRangeChartInstance.destroy(); } catch (e) {}
            apexRangeChartInstance = null;
        }
    }
};
