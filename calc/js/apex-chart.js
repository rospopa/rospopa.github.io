// Global variable to hold the chart instance
let apexChartInstance = null;
// Global variable for the new range chart instance
let apexRangeChartInstance = null;
// Track if legend selection buttons have been added to each chart
const legendButtonsAdded = {
    amortizationChart: false,
    cumulativeRangeChart: false,
    rangeChartFromTable: false
};
// Store original cumulative data to apply percentage adjustments
let originalCumulativeData = null;
// Current adjustment percentage
let currentAdjustmentPercentage = 0;

// Function to handle the manual reset operations - doesn't need ApexCharts access
function handleChartReset(chart, chartDiv) {
    try {
        console.log('Manual reset handler called for chart', chartDiv ? chartDiv.id : 'unknown');
        
        if (!chart) {
            console.warn('Chart instance not available for reset');
            return;
        }
        
        // Reset ALL legends to show ALL series - this is what the reset button SHOULD do
        resetAllLegends(chart);
        
        // Reset slider and display if they exist
        try {
            // First try to find slider in the chart container
            const slider = document.querySelector('.cashflow-adjustment-slider');
            const percentageDisplay = document.querySelector('.cashflow-adjustment-display');
            
            console.log('Slider found:', !!slider, 'Display found:', !!percentageDisplay);
            
        if (slider) {
                console.log('Setting slider value to 0 directly');
            slider.value = 0;
                
                // Force fire input event for listeners
                try {
                    const inputEvent = new Event('input', { bubbles: true });
                    slider.dispatchEvent(inputEvent);
                    
                    // Also try change event
                    const changeEvent = new Event('change', { bubbles: true });
                    slider.dispatchEvent(changeEvent);
                    
                    console.log('Fired input and change events on slider');
                } catch (e) {
                    console.warn('Error dispatching slider events:', e);
                }
            }
            
        if (percentageDisplay) {
                console.log('Updating percentage display text directly');
            percentageDisplay.textContent = '0%';
                percentageDisplay.style.color = '#333';
            }
            
            // FORCE-RESET THE ADJUSTMENT PERCENTAGE
            currentAdjustmentPercentage = 0;
            console.log('Reset global adjustment percentage to 0');
        } catch (err) {
            console.error('Error in direct slider manipulation:', err);
        }
        
        // Use our adjustment function as a backup approach
        try {
            if (originalCumulativeData && typeof applyAdjustmentToData === 'function') {
                console.log('Applying direct 0% adjustment to data');
                applyAdjustmentToData(0);
                
                // Reset chart title
                if (chart === apexRangeChartInstance) {
                    try {
                        console.log('Updating chart title to default');
                        chart.updateOptions({
                            title: {
                                text: 'Monthly Cumulative Revenue, Expense & Cash Flow',
                                align: 'center',
                                style: {
                                    fontSize: '16px',
                                    fontWeight: 'bold'
                                }
                            }
                        }, false, false);
                    } catch (e) {
                        console.warn('Error updating chart title:', e);
                    }
                }
            } else {
                console.warn('Cannot apply adjustment - missing data or function');
            }
        } catch (err) {
            console.error('Error applying data adjustment:', err);
        }
        
        console.log('Chart reset completed');
    } catch (error) {
        console.error('Critical error in manual reset handler:', error);
    }
}

// Separate function to specifically reset all legends to visible
function resetAllLegends(chart) {
    if (!chart) return;
    
    try {
        // Reset all legends to show all series if the chart has series
        if (chart.w && chart.w.globals && chart.w.globals.seriesNames) {
            const seriesNames = chart.w.globals.seriesNames;
            if (seriesNames && seriesNames.length) {
                console.log('Showing all series:', seriesNames.length);
                seriesNames.forEach(seriesName => {
                    chart.showSeries(seriesName);
                });
            }
        }
    } catch (err) {
        console.error('Error resetting series visibility:', err);
    }
}

// Add reset button event listener manually
function addManualResetButtonListener(chartDiv, chartInstance, chartId) {
    // Skip if already added
    if (legendButtonsAdded[chartId]) {
        console.log(`Reset button listener already added for ${chartId}`);
        return;
    }
    
    console.log(`Setting up reset button listener for ${chartId}`, chartDiv.id);
    
    // Attach a click handler to the chart container itself to capture all clicks inside it
    chartDiv.addEventListener('click', (event) => {
        // Check if the clicked element is the reset button or contains the reset button
        const resetButton = event.target.closest('.apexcharts-reset-icon, .apexcharts-toolbar svg[data-event="reset"]');
    if (resetButton) {
            console.log(`Reset button clicked in ${chartId} (delegated handler)`);
            // Wait for the default zoom reset to complete
            setTimeout(() => {
                handleChartReset(chartInstance, chartDiv);
            }, 300);
        }
        });
    
    // Mark as added to prevent duplicate listeners
    legendButtonsAdded[chartId] = true;
    }

// Replace extendResetButtonFunctionality with the new approach
function extendResetButtonFunctionality(chartDiv, chartInstance, chartId) {
    addManualResetButtonListener(chartDiv, chartInstance, chartId);
}

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
        
        // Add our custom reset button listener
        addManualResetButtonListener(chartDiv, apexChartInstance, 'amortizationChart');
        
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
        
        // Extend reset button functionality to also reset legends
        extendResetButtonFunctionality(chartDiv, apexRangeChartInstance, 'cumulativeRangeChart');
        
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
     console.log('clearApexRangeChart: очистка графика начата');
     const chartDiv = document.querySelector("#apex_cumulative_range_chart");
     
     try {
     // Note: we don't need to clear cumulativeDataForChart here as that should be handled by clearCumulativeTable
     if (apexRangeChartInstance) {
             console.log('clearApexRangeChart: инстанс графика найден, выполняем очистку');
             
             // Clear the chart data safely
             try {
                 // First, try a safer method of clearing
                 apexRangeChartInstance.updateSeries([]);
                 console.log('clearApexRangeChart: серии очищены');
             } catch (err) {
                 console.warn('Ошибка при очистке серий:', err);
             }
             
             // Then update other options
             try {
         apexRangeChartInstance.updateOptions({
             noData: { text: 'Enter valid revenue/expense data and loan term.' }
                 }, false, false);
                 console.log('clearApexRangeChart: опции обновлены');
             } catch (err) {
                 console.warn('Ошибка при обновлении опций:', err);
             }
             
             // Reset the global adjustment percentage
             currentAdjustmentPercentage = 0;
             
             // Remove the slider if it exists
             const sliderContainer = document.querySelector('.cashflow-adjustment-container');
             if (sliderContainer) {
                 sliderContainer.remove();
                 console.log('clearApexRangeChart: слайдер удален');
             }
         } else if (chartDiv) {
             console.log('clearApexRangeChart: инстанс графика не найден, очищаем DOM');
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Enter valid revenue/expense data and loan term.</p>';
         } else {
             console.log('clearApexRangeChart: элемент графика не найден');
         }
         
         console.log('clearApexRangeChart: очистка выполнена успешно');
     } catch (err) {
         console.error('clearApexRangeChart: ошибка при очистке графика:', err);
         // Attempt to restore a consistent state
         if (chartDiv) {
             chartDiv.innerHTML = '<p style="text-align:center; padding: 20px;">Error clearing chart. Please refresh the page.</p>';
         }
         
         // Try to destroy and rebuild the chart instance in case of severe corruption
         if (apexRangeChartInstance) {
             try {
                 apexRangeChartInstance.destroy();
                 console.log('clearApexRangeChart: поврежденный инстанс уничтожен');
             } catch (e) {
                 console.error('clearApexRangeChart: не удалось уничтожить поврежденный инстанс:', e);
             }
             apexRangeChartInstance = null;
         }
     }
};

// Function to create and add the adjustment slider to the chart
function createCashFlowAdjustmentSlider(chartDiv) {
    // Check if slider already exists to avoid duplicates
    if (chartDiv.parentNode.querySelector('.cashflow-adjustment-container')) {
        // Reset slider to center position when recalculating
        const slider = chartDiv.parentNode.querySelector('.cashflow-adjustment-slider');
        if (slider) {
            slider.value = 0;
            updateAdjustmentDisplay(0);
        }
        return;
    }
    
    // Create container for the slider
    const sliderContainer = document.createElement('div');
    sliderContainer.className = 'cashflow-adjustment-container';
    sliderContainer.style.cssText = 'width: 100%; padding: 10px 20px; margin-top: 10px; margin-bottom: 20px; text-align: center;';
    
    // Add title/label for the slider
    const sliderTitle = document.createElement('div');
    sliderTitle.className = 'cashflow-adjustment-title';
    sliderTitle.textContent = 'Cash Flow Adjustment';
    sliderTitle.style.cssText = 'font-weight: bold; margin-bottom: 5px; font-size: 14px;';
    
    // Create flex container for percentage display and input field
    const adjustmentDisplayContainer = document.createElement('div');
    adjustmentDisplayContainer.style.cssText = 'display: flex; justify-content: center; align-items: center; margin-bottom: 5px;';
    
    // Create display for current percentage
    const percentageDisplay = document.createElement('div');
    percentageDisplay.className = 'cashflow-adjustment-display';
    percentageDisplay.textContent = '0%';
    percentageDisplay.style.cssText = 'font-weight: bold; font-size: 16px; color: #333; margin-right: 10px; cursor: pointer;';
    
    // Create input field for manual adjustment
    const manualInput = document.createElement('input');
    manualInput.type = 'number';
    manualInput.className = 'cashflow-adjustment-input';
    manualInput.min = -10;
    manualInput.max = 10;
    manualInput.step = 0.01;
    manualInput.value = '0';
    manualInput.style.cssText = 'width: 70px; padding: 3px 5px; border: 1px solid #ccc; border-radius: 4px; font-size: 14px; text-align: right; display: none;';
    
    // Add toggle functionality between display and input
    percentageDisplay.addEventListener('click', function() {
        percentageDisplay.style.display = 'none';
        manualInput.style.display = 'inline-block';
        manualInput.focus();
        manualInput.select();
    });
    
    // Handle manual input
    manualInput.addEventListener('blur', function() {
        applyManualAdjustment(this.value);
        percentageDisplay.style.display = 'inline-block';
        manualInput.style.display = 'none';
    });
    
    manualInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            applyManualAdjustment(this.value);
            percentageDisplay.style.display = 'inline-block';
            manualInput.style.display = 'none';
        }
    });
    
    // Function to apply manual adjustment
    function applyManualAdjustment(value) {
        // Parse and validate input
        let percentage = parseFloat(value);
        
        // Check if it's a valid number
        if (isNaN(percentage)) {
            percentage = 0;
        }
        
        // Clamp to allowed range
        percentage = Math.max(-10, Math.min(10, percentage));
        
        // Update the adjustment
        updateAdjustmentDisplay(percentage);
        applyAdjustmentToData(percentage);
    }
    
    // Add display and input to container
    adjustmentDisplayContainer.appendChild(percentageDisplay);
    adjustmentDisplayContainer.appendChild(manualInput);
    
    // Create the slider
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = -10;
    slider.max = 10;
    slider.step = 0.01;
    slider.value = 0;
    slider.className = 'cashflow-adjustment-slider';
    slider.style.cssText = 'width: 100%; margin: 10px 0; --zero-mark-color: #0d6efd;';
    
    // Додаємо CSS для виділення центру слайдера
    const sliderStyle = document.createElement('style');
    sliderStyle.textContent = `
        input.cashflow-adjustment-slider {
            background: linear-gradient(to right,
                #dc3545 0%, #dc3545 calc(50% - 3px),
                var(--zero-mark-color) calc(50% - 3px), var(--zero-mark-color) calc(50% + 3px),
                #28a745 calc(50% + 3px), #28a745 100%);
            height: 5px;
            outline: none;
            -webkit-appearance: none;
            appearance: none;
            transition: opacity 0.2s;
        }
        
        input.cashflow-adjustment-slider::-webkit-slider-thumb {
            -webkit-appearance: none;
            appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #4c4c4c;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
        
        input.cashflow-adjustment-slider::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: #4c4c4c;
            cursor: pointer;
            border: 2px solid white;
            box-shadow: 0 0 2px rgba(0,0,0,0.5);
        }
    `;
    document.head.appendChild(sliderStyle);
    
    // Add labels for min/center/max
    const labelsContainer = document.createElement('div');
    labelsContainer.style.cssText = 'display: flex; justify-content: space-between; width: 100%; font-size: 12px; margin-top: 5px;';
    
    const minLabel = document.createElement('span');
    minLabel.textContent = '-10%';
    minLabel.style.cssText = 'color: #666;';
    
    // Create center marker with click handler to reset to 0
    const centerLabel = document.createElement('span');
    centerLabel.textContent = '0%';
    centerLabel.style.cssText = 'color: #0d6efd; font-weight: bold; cursor: pointer; padding: 2px 10px; border-radius: 10px; background-color: #f8f9fa; border: 1px solid #dee2e6;';
    centerLabel.title = 'Click to reset to 0%';
    
    // Add event listener to center label for reset
    centerLabel.addEventListener('click', function() {
        slider.value = 0;
        manualInput.value = '0';
        updateAdjustmentDisplay(0);
        applyAdjustmentToData(0);
    });
    
    const maxLabel = document.createElement('span');
    maxLabel.textContent = '+10%';
    maxLabel.style.cssText = 'color: #666;';
    
    labelsContainer.appendChild(minLabel);
    labelsContainer.appendChild(centerLabel);
    labelsContainer.appendChild(maxLabel);
    
    // Add event listener to handle slider changes
    slider.addEventListener('input', function() {
        const percentage = parseFloat(this.value);
        updateAdjustmentDisplay(percentage);
        // Update manual input value as well
        manualInput.value = percentage.toFixed(2);
        applyAdjustmentToData(percentage);
        
        // Update center label color based on distance from zero
        if (Math.abs(percentage) < 0.1) {
            centerLabel.style.backgroundColor = '#e6f2ff';
        } else {
            centerLabel.style.backgroundColor = '#f8f9fa';
        }
    });
    
    // Assemble the slider container
    sliderContainer.appendChild(sliderTitle);
    sliderContainer.appendChild(adjustmentDisplayContainer);
    sliderContainer.appendChild(slider);
    sliderContainer.appendChild(labelsContainer);
    
    // Insert slider after the chart
    chartDiv.parentNode.insertBefore(sliderContainer, chartDiv.nextSibling);
    
    // Initialize display
    updateAdjustmentDisplay(0);
}

// Function to update the percentage display
function updateAdjustmentDisplay(percentage) {
    currentAdjustmentPercentage = percentage;
    console.log('updateAdjustmentDisplay: обновляем отображение на', percentage);
    
    // Find the display and input elements across the document
    const display = document.querySelector('.cashflow-adjustment-display');
    const manualInput = document.querySelector('.cashflow-adjustment-input');
    const slider = document.querySelector('.cashflow-adjustment-slider');
    
    // Update display if it exists
    if (display) {
        // Format with sign and 2 decimal places
        const formattedPercentage = (percentage >= 0 ? '+' : '') + percentage.toFixed(2) + '%';
        display.textContent = formattedPercentage;
        
        // Change color based on value
        if (percentage > 0) {
            display.style.color = '#28a745'; // Green for positive
        } else if (percentage < 0) {
            display.style.color = '#dc3545'; // Red for negative
        } else {
            display.style.color = '#333'; // Default for zero
        }
        console.log('updateAdjustmentDisplay: отображение обновлено на', formattedPercentage);
    } else {
        console.log('updateAdjustmentDisplay: элемент отображения не найден');
    }
    
    // Update manual input field if it exists
    if (manualInput && manualInput.value !== percentage.toFixed(2)) {
        manualInput.value = percentage.toFixed(2);
        console.log('updateAdjustmentDisplay: поле ввода обновлено на', percentage.toFixed(2));
    }
    
    // Update slider if it exists and value is different
    if (slider && parseFloat(slider.value) !== percentage) {
        slider.value = percentage;
        console.log('updateAdjustmentDisplay: слайдер обновлен на', percentage);
    }
}

// Function to apply the percentage adjustment to the data and update chart and table
function applyAdjustmentToData(percentage) {
    console.log('applyAdjustmentToData: застосовуємо коригування', percentage, '%');
    
    if (!originalCumulativeData || !originalCumulativeData.monthlyData || !originalCumulativeData.monthlyData.length) {
        console.warn('No original data to adjust');
        return;
    }
    
    // Validate and sanitize percentage (ensure it's a number and within range)
    percentage = parseFloat(percentage);
    if (isNaN(percentage)) {
        console.warn('Invalid percentage value, using 0');
        percentage = 0;
    }
    
    // Clamp to allowed range (-10 to 10)
    percentage = Math.max(-10, Math.min(10, percentage));
    
    // Update UI controls to reflect any adjusted value
    try {
        // Always update the global adjustment percentage first
        currentAdjustmentPercentage = percentage;
        
        // Use the dedicated function to update all displays
        updateAdjustmentDisplay(percentage);
    } catch (err) {
        console.error('Error updating UI controls:', err);
    }
    
    // Make a deep copy of the original data
    const adjustedData = JSON.parse(JSON.stringify(originalCumulativeData));
    
    // Apply the adjustment to each month's data
    adjustedData.monthlyData.forEach((month, index) => {
        const originalMonth = originalCumulativeData.monthlyData[index];
        
        // Calculate adjustment factor (e.g., 5% = 1.05, -5% = 0.95)
        const adjustmentFactor = 1 + (percentage / 100);
        
        // Adjust revenue values (increase/decrease by percentage)
        month.revenueMin = originalMonth.revenueMin * adjustmentFactor;
        month.revenueMax = originalMonth.revenueMax * adjustmentFactor;
        month.revenueAvg = originalMonth.revenueAvg * adjustmentFactor;
        
        // Adjust expense values (opposite direction for better cash flow effect)
        // Note: Expenses are negative, so reducing absolute value improves cash flow
        const expenseAdjustmentFactor = percentage >= 0 ? (1 - (percentage / 200)) : (1 + (Math.abs(percentage) / 200));
        month.expenseMin = originalMonth.expenseMin * expenseAdjustmentFactor;
        month.expenseMax = originalMonth.expenseMax * expenseAdjustmentFactor;
        month.expenseAvg = originalMonth.expenseAvg * expenseAdjustmentFactor;
        
        // Recalculate cash flow values
        month.flowMin = month.revenueMin + month.expenseMin;
        month.flowMax = month.revenueMax + month.expenseMax;
        month.flowAvg = month.revenueAvg + month.expenseAvg;
    });
    
    // Update the global data object with adjusted values
    window.cumulativeDataForChart = adjustedData;
    
    // Update the table and chart with the adjusted data
    try {
        // Update the table with the adjusted data
        updateCumulativeTable(adjustedData);
    } catch (err) {
        console.error('Error updating table:', err);
    }
    
    try {
        // Update the chart with the adjusted data
        updateChartWithAdjustedData(adjustedData);
    } catch (err) {
        console.error('Error updating chart:', err);
    }
    
    console.log('applyAdjustmentToData: коригування застосовано успішно');
}

// Function to update the cumulative table with adjusted data
function updateCumulativeTable(adjustedData) {
    // Check if the table exists and Google Charts is loaded
    const tableDiv = document.getElementById('google_cumulative_range_table');
    if (!tableDiv || !window.cumulativeDataTable || typeof google === 'undefined' || 
        typeof google.visualization === 'undefined' || typeof google.visualization.Table === 'undefined') {
        console.warn('Cumulative table not ready for update');
        // Continue with chart update even if table isn't ready
        updateChartWithAdjustedData(adjustedData);
        return;
    }
    
    try {
        // Create a new DataTable
        const data = new google.visualization.DataTable();
        
        // Define columns (same as in original table)
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
        data.addColumn('number', 'Year');
        
        // Loop through monthlyData and calculate monthly values from cumulative
        let prevMonth = null;
        adjustedData.monthlyData.forEach((month, index) => {
            // Calculate monthly values by finding difference with previous month
            let monthlyExpenseMin = month.expenseMin;
            let monthlyExpenseMax = month.expenseMax;
            let monthlyExpenseAvg = month.expenseAvg;
            let monthlyRevenueMin = month.revenueMin;
            let monthlyRevenueMax = month.revenueMax;
            let monthlyRevenueAvg = month.revenueAvg;
            
            if (index > 0) {
                prevMonth = adjustedData.monthlyData[index - 1];
                monthlyExpenseMin = month.expenseMin - prevMonth.expenseMin;
                monthlyExpenseMax = month.expenseMax - prevMonth.expenseMax;
                monthlyExpenseAvg = month.expenseAvg - prevMonth.expenseAvg;
                monthlyRevenueMin = month.revenueMin - prevMonth.revenueMin;
                monthlyRevenueMax = month.revenueMax - prevMonth.revenueMax;
                monthlyRevenueAvg = month.revenueAvg - prevMonth.revenueAvg;
            }
            
            const cashFlowMin = monthlyRevenueMin + monthlyExpenseMin;
            const cashFlowMax = monthlyRevenueMax + monthlyExpenseMax;
            const cashFlowAvg = monthlyRevenueAvg + monthlyExpenseAvg;
            
            // Add the row with all values
            data.addRow([
                month.date,
                monthlyExpenseMin,
                month.expenseMin,
                monthlyExpenseMax,
                month.expenseMax,
                monthlyExpenseAvg,
                month.expenseAvg,
                monthlyRevenueMin,
                month.revenueMin,
                monthlyRevenueMax,
                month.revenueMax,
                monthlyRevenueAvg,
                month.revenueAvg,
                cashFlowMin,
                cashFlowMax,
                cashFlowAvg,
                month.year
            ]);
        });
        
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
        
        // Get current view settings to maintain current year filter
        const currentYearElement = document.getElementById('year-indicator');
        const currentYear = currentYearElement ? parseInt(currentYearElement.textContent.replace(/\D/g, '')) : null;
        
        // Create a view with the year column hidden
        const view = new google.visualization.DataView(data);
        view.hideColumns([16]); // Hide the year column (index 16)
        
        // If we have a current year, filter by it
        if (currentYear !== null) {
            const rows = data.getFilteredRows([{column: 16, value: currentYear}]);
            view.setRows(rows);
        }
        
        // Define table options (same as original)
        const options = {
            showRowNumber: false, 
            width: '100%', 
            height: '400px',
            allowHtml: true,
            page: 'enable',
            pageSize: 12,
            cssClassNames: {
                headerRow: 'table-light sticky-top small',
                tableRow: 'small',
                oddTableRow: 'small bg-light',
                headerCell: 'text-center fw-bold',
                tableCell: 'text-end'
            }
        };
        
        // Update the table
        window.cumulativeDataTable.draw(view, options);
        
    } catch (err) {
        console.error("Error updating cumulative table with adjusted data:", err);
    }
}

// Function to update the chart with adjusted data
function updateChartWithAdjustedData(adjustedData) {
    console.log('updateChartWithAdjustedData: commences updating the chart');
    
    if (!apexRangeChartInstance) {
        console.warn('Range chart instance not found for update');
        return;
    }
    
    try {
        // Prepare data series from adjusted data
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
        
        // Transform the data for chart format
        adjustedData.monthlyData.forEach(month => {
            categories.push(month.date);
            
            // Revenue min/max/avg
            revenueMinData.push({
                x: month.date,
                y: isFinite(month.revenueMin) ? parseFloat(month.revenueMin.toFixed(2)) : 0
            });
            
            revenueMaxData.push({
                x: month.date,
                y: isFinite(month.revenueMax) ? parseFloat(month.revenueMax.toFixed(2)) : 0
            });
            
            revenueAvgData.push({
                x: month.date,
                y: isFinite(month.revenueAvg) ? parseFloat(month.revenueAvg.toFixed(2)) : 0
            });
            
            // Expense min/max/avg
            expenseMinData.push({
                x: month.date,
                y: isFinite(month.expenseMin) ? parseFloat(month.expenseMin.toFixed(2)) : 0
            });
            
            expenseMaxData.push({
                x: month.date,
                y: isFinite(month.expenseMax) ? parseFloat(month.expenseMax.toFixed(2)) : 0
            });
            
            expenseAvgData.push({
                x: month.date,
                y: isFinite(month.expenseAvg) ? parseFloat(month.expenseAvg.toFixed(2)) : 0
            });
            
            // Cash Flow min/max/avg
            cashFlowMinData.push({
                x: month.date,
                y: isFinite(month.flowMin) ? parseFloat(month.flowMin.toFixed(2)) : 0
            });
            
            cashFlowMaxData.push({
                x: month.date,
                y: isFinite(month.flowMax) ? parseFloat(month.flowMax.toFixed(2)) : 0
            });
            
            cashFlowAvgData.push({
                x: month.date,
                y: isFinite(month.flowAvg) ? parseFloat(month.flowAvg.toFixed(2)) : 0
            });
        });
        
        // ЗМІНЕНО: Зберігаємо стан видимості серій ДО оновлення даних
        // Створюємо масив для збереження індексів прихованих серій
        let hiddenSeriesIndices = [];
        
        if (apexRangeChartInstance.w && apexRangeChartInstance.w.globals) {
            // Отримуємо інформацію про згорнуті серії
            const collapsedSeries = apexRangeChartInstance.w.globals.collapsedSeries || [];
            const collapsedSeriesIndices = apexRangeChartInstance.w.globals.collapsedSeriesIndices || [];
            
            // Зберігаємо індекси прихованих серій
            hiddenSeriesIndices = [...collapsedSeriesIndices];
            
            console.log('Збережено стан видимості серій:', {
                hiddenCount: hiddenSeriesIndices.length,
                indices: hiddenSeriesIndices
            });
        }
        
        // Додаємо індикацію коригування в заголовок, якщо не 0%
        let chartTitle = 'Monthly Cumulative Revenue, Expense & Cash Flow';
        if (currentAdjustmentPercentage !== 0) {
            const sign = currentAdjustmentPercentage > 0 ? '+' : '';
            chartTitle += ` (${sign}${currentAdjustmentPercentage.toFixed(2)}% Adjusted)`;
        }
        
        // Оновлюємо заголовок графіка
        apexRangeChartInstance.updateOptions({
            title: {
                text: chartTitle,
                align: 'center',
                style: {
                    fontSize: '16px',
                    fontWeight: 'bold'
                }
            }
        }, false, false); // Не перемальовуємо і не анімуємо зміну заголовка
        
        // Оновлюємо дані серій
        console.log('Оновлюємо серії даних');
        apexRangeChartInstance.updateSeries([
            { name: 'Revenue Min', type: 'area', data: revenueMinData },
            { name: 'Expense Min', type: 'area', data: expenseMinData },
            { name: 'Cash Flow Min', type: 'area', data: cashFlowMinData },
            { name: 'Revenue Max', type: 'area', data: revenueMaxData },
            { name: 'Expense Max', type: 'area', data: expenseMaxData },
            { name: 'Cash Flow Max', type: 'area', data: cashFlowMaxData },
            { name: 'Revenue Forecast', type: 'line', data: revenueAvgData },
            { name: 'Expense Forecast', type: 'line', data: expenseAvgData },
            { name: 'Cash Flow Forecast', type: 'line', data: cashFlowAvgData }
        ], false); // Додаємо параметр false, щоб не перемальовувати графік повністю
        
        // ЗМІНЕНО: Відновлюємо видимість серій ПІСЛЯ оновлення даних з невеликою затримкою
        if (hiddenSeriesIndices.length > 0) {
            setTimeout(() => {
                try {
                    console.log('Відновлюємо стан видимості серій');
                    // Переховуємо серії за збереженими індексами
                    hiddenSeriesIndices.forEach(index => {
                        if (apexRangeChartInstance.w.globals.seriesNames[index]) {
                            const seriesName = apexRangeChartInstance.w.globals.seriesNames[index];
                            console.log(`Ховаємо серію #${index}: ${seriesName}`);
                            apexRangeChartInstance.toggleSeries(seriesName);
                        }
                    });
                    
                    // Примушуємо графік перемалювати легенду
                    apexRangeChartInstance.update();
                } catch (err) {
                    console.error('Помилка відновлення видимості серій:', err);
                }
            }, 50); // Невелика затримка для стабільності
        }
        
        console.log('updateChartWithAdjustedData: обновление графика завершено успешно');
        
    } catch (err) {
        console.error("Error updating chart with adjusted data:", err);
    }
}

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

    // Store the original data for slider adjustments
    originalCumulativeData = JSON.parse(JSON.stringify(window.cumulativeDataForChart));
    // Reset adjustment percentage
    currentAdjustmentPercentage = 0;
    
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
        
        // Add our custom reset button listener
        addManualResetButtonListener(chartDiv, apexRangeChartInstance, 'rangeChartFromTable');
        
        // Add the adjustment slider after rendering the chart
        createCashFlowAdjustmentSlider(chartDiv);
        
    } catch (err) {
        console.error("ApexCharts chart render/update error:", err);
        chartDiv.innerHTML = '<p style="text-align:center; padding: 20px; color: red;">Error rendering chart: ' + err.message + '</p>';
        if (apexRangeChartInstance && typeof apexRangeChartInstance.destroy === 'function') {
            try { apexRangeChartInstance.destroy(); } catch (e) {}
            apexRangeChartInstance = null;
        }
    }
};

// Function to override the ApexCharts reset functionality globally
function overrideApexResetFunction() {
    // This function is no longer needed - we're using manual button listeners instead
    console.warn('overrideApexResetFunction is deprecated - using direct event listeners instead');
    return false;
}

// Run once to set up the environment
(function initializeApexChartAdditions() {
    console.log('Initializing ApexChart extensions');
    // No special key handlers needed anymore - reset button will handle showing all legends
})();
