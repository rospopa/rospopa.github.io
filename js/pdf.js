// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const pdfButton = document.getElementById('savepdf');
    if (!pdfButton) {
        console.error('PDF button not found');
        return;
    }

    pdfButton.addEventListener('click', function() {
        try {
            console.log('PDF button clicked');
            generatePDF();
        } catch (error) {
            console.error('Error in PDF generation:', error);
        }
    });
});

function generatePDF() {
    // Helper functions
    const getInputValue = (id) => {
        const element = document.getElementById(id);
        if (!element) {
            console.log('Element not found:', id);
            return '';
        }
        
        // For currency inputs, remove any existing formatting but keep negative signs
        if (element.getAttribute('data-type') === 'currency') {
            const rawValue = element.value;
            console.log('Raw value for ' + id + ':', rawValue);
            
            // First, check if the value is already a clean number
            if (!isNaN(rawValue) && rawValue !== '') {
                console.log('Clean number value:', rawValue);
                return rawValue;
            }
            
            // Remove currency symbol and commas, but keep negative sign and decimal point
            let cleanValue = rawValue.replace(/[^-0-9.]/g, '');
            
            // Handle empty or invalid values
            if (!cleanValue || isNaN(cleanValue)) {
                console.log('Invalid/empty value, returning 0');
                return '0';
            }
            
            console.log('Cleaned value:', cleanValue);
            return cleanValue;
        }
        return element.value || '';
    };

    const getLabelText = (id) => {
        const label = document.querySelector(`label[for="${id}"]`);
        if (!label) return '';
        
        // Get the text content without the tooltip
        const labelText = Array.from(label.childNodes)
            .filter(node => node.nodeType === 3) // Text nodes only
            .map(node => node.textContent.trim())
            .join('')
            .trim();
            
        return labelText || '';
    };

    const formatCurrency = (value) => {
        // Handle empty or invalid values
        if (!value || value === '') return '$0.00';
        
        // Clean the input value - remove everything except numbers, decimal point and minus sign
        const cleanValue = value.toString().replace(/[^-0-9.]/g, '');
        
        // Convert to number
        const num = parseFloat(cleanValue);
        if (isNaN(num)) return '$0.00';
        
        // Format with proper commas and decimals
        const formatted = Math.abs(num).toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
        
        // Add negative sign if needed
        return (num < 0 ? '-$' : '$') + formatted;
    };

    const formatPercentage = (value) => {
        if (!value) return '0%';
        const num = parseFloat(value);
        return isNaN(num) ? '0%' : num.toFixed(2) + '%';
    };

    const termsPeriod = document.getElementById('TermsPeriod').value || 'Year';
    // Define sections for the PDF
    const sections = [
        {
            title: 'Loan Profile',
            inputs: [
                { id: 'autocomplete', label: 'Property Address', format: value => value },
                { id: 'B1', label: 'Purchase Price', format: formatCurrency },
                { id: 'B2', label: 'Down Payment', format: formatPercentage },
                { id: 'B3', label: 'Down Payment Amount', format: formatCurrency },
                { id: 'B4', label: 'Closing Date', format: value => value },
                { id: 'B5', label: 'Loan Amount', format: formatCurrency },
                { id: 'B6', label: 'Interest Rate', format: formatPercentage },
                { id: 'B7', label: 'Loan Term Period', format: value => value + ' ' + termsPeriod + '(s)' },
                { id: 'B8', label: (termsPeriod) => `Payments per ${termsPeriod}`, format: value => value + ' ' + 'payment(s) per ' + termsPeriod },
                { id: 'B9', label: 'Total Payments', format: value => value },
                { id: 'B10', label: 'Amount per Payment', format: formatCurrency },
                { id: 'B11', label: 'Total Loan Cost', format: formatCurrency },
                { id: 'B12', label: 'Interest Cost', format: formatCurrency },
                { id: 'B13', label: 'Closing Costs', format: formatPercentage },
                { id: 'B14', label: 'Inspection', format: formatCurrency },
                { id: 'B15', label: 'Down Payment + Closing Cost (% of Purchase Price) + Inspection', format: formatCurrency },
		{ id: 'Loan-Type', label: 'Loan Type', format: value => value }
            ]
        },
        {
            title: 'Gross Expenses',
            inputs: [
                { id: ['B19', 'C19', 'D19'], label: 'Refuse', format: formatCurrency },
                { id: ['B20', 'C20', 'D20'], label: 'Water', format: formatCurrency },
                { id: ['B21', 'C21', 'D21'], label: 'Sewer', format: formatCurrency },
                { id: ['B22', 'C22', 'D22'], label: 'Property Taxes', format: formatCurrency },
                { id: ['B23', 'C23', 'D23'], label: 'Electric', format: formatCurrency },
                { id: ['B24', 'C24', 'D24'], label: 'Gas', format: formatCurrency },
                { id: ['B25', 'C25', 'D25'], label: 'Internet', format: formatCurrency },
                { id: ['B26', 'C26', 'D26'], label: 'Lawn Care', format: formatCurrency },
                { id: ['B27', 'C27', 'D27'], label: 'Maintenance', format: formatCurrency },
                { id: ['B28', 'C28', 'D28'], label: 'Vacancy Rate', format: formatPercentage },
                { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance', format: formatCurrency },
                { id: ['B30', 'C30', 'D30'], label: 'Property Insurance', format: formatCurrency },
                { id: ['B31', 'C31', 'D31'], label: 'HOA', format: formatCurrency },
                { id: ['B32', 'C32', 'D32'], label: 'Property Management', format: formatCurrency }
            ]
        },
        {
            title: 'Gross Revenue',
            getInputs: () => {
                const units = [];
                const parking = [];
                
                // Check units
                for (let i = 1; i <= 15; i++) {
                    const baseIndex = 32 + i;
                    const value = getInputValue(`B${baseIndex}`);
                    if (value && parseFloat(value) !== 0) {
                        units.push({
                            id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                            label: `Unit ${i}`,
                            format: formatCurrency
                        });
                    }
                }
                
                // Check parking
                for (let i = 1; i <= 15; i++) {
                    const baseIndex = 47 + i;
                    const value = getInputValue(`B${baseIndex}`);
                    if (value && parseFloat(value) !== 0) {
                        parking.push({
                            id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                            label: `Parking ${i}`,
                            format: formatCurrency
                        });
                    }
                }
                
                return { units, parking };
            }
        },
        {
            title: 'Total Cash Flow',
            inputs: [
                { id: ['B63', 'C63', 'D63'], label: 'Total Mortgage/Month' },
                { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month' },
                { id: ['B65', 'C65', 'D65'], label: 'Gross Revenue/Month' },
                { id: ['B66', 'C66', 'D66'], label: 'Est Total Income/Month' }
            ]
        }
    ];

    // Build document content
    const content = [
        { text: 'Investment Property Calculator', style: 'header' }
    ];

    // Add each section
    sections.forEach((section, index) => {
        // Special handling for Gross Revenue section
        if (section.title === 'Gross Revenue') {
            const { units, parking } = section.getInputs();
            
            // Only add units subsection if there are units with values
            if (units.length > 0) {
                const tableData = [
                    [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                    [
                        { text: 'Item', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Min', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Max', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Avg', alignment: 'center', fillColor: '#90ee90' }
                    ],
                    ...units.map(input => [
                        { text: input.label, fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[0])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: input.format(getInputValue(input.id[1])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: input.format(getInputValue(input.id[2])), fillColor: '#c1fdc1', alignment: 'right' }
                    ])
                ];

                content.push({
                    table: {
                        headerRows: 2,
                        widths: ['*', 100, 100, 100],
                        body: tableData,
                        layout: getTableLayout()
                    }
                });
            }
            
            // Only add parking subsection if there are parking spaces with values
            if (parking.length > 0) {
                const tableData = [
                    [{ text: 'Parking', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                    [
                        { text: 'Item', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Min', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Max', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Avg', alignment: 'center', fillColor: '#90ee90' }
                    ],
                    ...parking.map(input => [
                        { text: input.label, fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[0])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: input.format(getInputValue(input.id[1])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: input.format(getInputValue(input.id[2])), fillColor: '#c1fdc1', alignment: 'right' }
                    ])
                ];

                content.push({
                    table: {
                        headerRows: 2,
                        widths: ['*', 100, 100, 100],
                        body: tableData,
                        layout: getTableLayout()
                    }
                });
            }
        } else if (section.title === 'Gross Expenses') {
            const tableData = [
                [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                [
                    { text: 'Item', alignment: 'center', fillColor: '#f08080' },
                    { text: 'Min', alignment: 'center', fillColor: '#f08080' },
                    { text: 'Max', alignment: 'center', fillColor: '#f08080' },
                    { text: 'Avg', alignment: 'center', fillColor: '#f08080' }
                ]
            ];
            
            section.inputs.forEach(input => {
                const values = input.id.map(id => {
                    const rawValue = getInputValue(id);
                    // For currency fields, ensure we're getting the numeric value
                    const element = document.getElementById(id);
                    if (element && element.getAttribute('data-type') === 'currency') {
                        // Remove any existing formatting but keep negative signs and decimals
                        return rawValue.replace(/[^-0-9.]/g, '');
                    }
                    return rawValue;
                });

                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input.id[0]) || input.label, fillColor: '#ffc8c8' },
                        { text: input.format(values[0]), fillColor: '#ffc8c8', alignment: 'right' },
                        { text: input.format(values[1]), fillColor: '#ffc8c8', alignment: 'right' },
                        { text: input.format(values[2]), fillColor: '#ffc8c8', alignment: 'right' }
                    ]);
                }
            });

            content.push({
                table: {
                    headerRows: 2,
                    widths: ['*', 100, 100, 100],
                    body: tableData,
                    layout: getTableLayout(true)
                }
            });
        } else if (section.title === 'Total Cash Flow') {
            const tableData = [
                [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                [
                    { text: 'Item', alignment: 'center', fillColor: '#d3d3d3' },
                    { text: 'Min', alignment: 'center', fillColor: '#d3d3d3' },
                    { text: 'Max', alignment: 'center', fillColor: '#d3d3d3' },
                    { text: 'Avg', alignment: 'center', fillColor: '#d3d3d3' }
                ]
            ];

            const inputs = [
                { id: ['B63', 'C63', 'D63'], label: 'Total Mortgage/Month' },
                { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month' },
                { id: ['B65', 'C65', 'D65'], label: 'Gross Revenue/Month' },
                { id: ['B66', 'C66', 'D66'], label: 'Est Total Income/Month' }
            ];

            inputs.forEach(input => {
                const values = input.id.map(id => {
                    const rawValue = getInputValue(id);
                    // For currency fields, ensure we're getting the numeric value
                    const element = document.getElementById(id);
                    if (element && element.getAttribute('data-type') === 'currency') {
                        // Remove any existing formatting but keep negative signs and decimals
                        return rawValue.replace(/[^-0-9.]/g, '');
                    }
                    return rawValue;
                });

                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input.id[0]) || input.label, fillColor: '#dfdfdf' },
                        { text: formatCurrency(values[0]), fillColor: '#dfdfdf', alignment: 'right' },
                        { text: formatCurrency(values[1]), fillColor: '#dfdfdf', alignment: 'right' },
                        { text: formatCurrency(values[2]), fillColor: '#dfdfdf', alignment: 'right' }
                    ]);
                }
            });

            content.push({
                table: {
                    headerRows: 2,
                    widths: ['*', 100, 100, 100],
                    body: tableData,
                    layout: getTableLayout()
                }
            });
        } else {
            // Regular section handling for Loan Profile
            const tableData = [
                [{ text: section.title, style: 'sectionHeader', colSpan: 2, alignment: 'left', margin: [0, 10, 0, 1] }, {}],
                [
                    { text: 'Item', alignment: 'center' },
                    { text: 'Value', alignment: 'center' }
                ]
            ];
            
            section.inputs.forEach(input => {
                const value = getInputValue(input.id);
                if (value) {
                    const labelText = typeof input.label === 'function' ? input.label(termsPeriod) : (getLabelText(input.id) || input.label);
                    const formattedValue = input.format ? input.format(value) : formatCurrency(value);
                    tableData.push([labelText, formattedValue]);
                }
            });

            content.push({
                table: {
                    headerRows: 2,
                    widths: ['*', 'auto'],
                    body: tableData,
                    layout: getTableLayout()
                }
            });
        }
    });

    // Helper function for consistent table layout
    function getTableLayout(isExpenses = false) {
        return {
            hLineWidth: function(i, node) {
                return (i === 0 || i === node.table.body.length) ? 2 : 1;
            },
            vLineWidth: function(i, node) {
                return (i === 0 || i === node.table.widths.length) ? 2 : 1;
            },
            hLineColor: function(i, node) {
                return (i === 0 || i === node.table.body.length) ? '#666' : '#999';
            },
            vLineColor: function(i, node) {
                return (i === 0 || i === node.table.widths.length) ? '#666' : '#999';
            },
            fillColor: function(i, node) {
                if (isExpenses && i > 0 && i % 2 === 1) { // Skip header row (i=0) and do every other row
                    return '#ffc8c8';
                }
                return null;
            },
            paddingLeft: function(i) { return 8; },
            paddingRight: function(i) { return 8; },
            paddingTop: function(i) { return 6; },
            paddingBottom: function(i) { return 6; }
        };
    }

    // Document definition
    const docDefinition = {
        pageSize: 'A4',
        pageMargins: [20, 20, 20, 20], // [left, top, right, bottom] in points (72 points = 1 inch)
        content: content,
        styles: {
            header: {
                fontSize: 18,
                bold: true,
                alignment: 'center',
                margin: [0, 0, 0, 10]
            },
            sectionHeader: {
                fontSize: 14,
                bold: true,
                margin: [0, 10, 0, 5]
            },
            subheader: {
                fontSize: 12,
                bold: true,
                margin: [0, 5, 0, 3]
            }
        },
        defaultStyle: {
            fontSize: 12
        }
    };

    // Generate and download the PDF
    const address = getInputValue('autocomplete');
    const purchasePrice = getInputValue('B1');
    
    let fileName = 'property-calculator.pdf';
    if (address && address.trim() !== '') {
        // Clean the address to make it file-name safe
        fileName = address.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.pdf';
    } else if (purchasePrice && purchasePrice.trim() !== '') {
        // Use purchase price if address is not available
        fileName = 'property_' + purchasePrice.replace(/[^0-9.]/g, '') + '.pdf';
    }

    pdfMake.createPdf(docDefinition).download(fileName);
}
