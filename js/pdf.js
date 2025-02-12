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
        // For currency inputs, remove any existing formatting
        if (element.getAttribute('data-type') === 'currency') {
            return element.value.replace(/[^0-9.-]+/g, '') || '0';
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
        const num = parseFloat(value);
        if (isNaN(num)) return '$0.00';
        return '$' + num.toLocaleString('en-US', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2
        });
    };

    const formatPercentage = (value) => {
        if (!value) return '0%';
        const num = parseFloat(value);
        return isNaN(num) ? '0%' : num.toFixed(2) + '%';
    };

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
                { id: 'B6', label: 'Annual Interest Rate', format: formatPercentage },
                { id: 'B7', label: 'Loan Term Period', format: value => value + ' Years' },
                { id: 'B8', label: 'Payments per Period', format: value => value },
                { id: 'B9', label: 'Total Payments', format: value => value },
                { id: 'B10', label: 'Payment per Period', format: formatCurrency },
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
                { id: ['B19', 'C19', 'D19'], label: 'Refuse' },
                { id: ['B20', 'C20', 'D20'], label: 'Water' },
                { id: ['B21', 'C21', 'D21'], label: 'Sewer' },
                { id: ['B22', 'C22', 'D22'], label: 'Property Taxes' },
                { id: ['B23', 'C23', 'D23'], label: 'Electric' },
                { id: ['B24', 'C24', 'D24'], label: 'Gas' },
                { id: ['B25', 'C25', 'D25'], label: 'Internet' },
                { id: ['B26', 'C26', 'D26'], label: 'Lawn Care' },
                { id: ['B27', 'C27', 'D27'], label: 'Maintenance' },
                { id: ['B28', 'C28', 'D28'], label: 'Vacancy Rate', format: formatPercentage },
                { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance' },
                { id: ['B30', 'C30', 'D30'], label: 'Property Insurance' },
                { id: ['B31', 'C31', 'D31'], label: 'HOA' },
                { id: ['B32', 'C32', 'D32'], label: 'Property Management' }
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
                        { text: input.format(getInputValue(input.id[0])), fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[1])), fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[2])), fillColor: '#c1fdc1' }
                    ])
                ];

                content.push({
                    table: {
                        headerRows: 2,
                        widths: ['*', 'auto', 'auto', 'auto'],
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
                        { text: input.format(getInputValue(input.id[0])), fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[1])), fillColor: '#c1fdc1' },
                        { text: input.format(getInputValue(input.id[2])), fillColor: '#c1fdc1' }
                    ])
                ];

                content.push({
                    table: {
                        headerRows: 2,
                        widths: ['*', 'auto', 'auto', 'auto'],
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
                const values = input.id.map(id => getInputValue(id));
                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input.id[0]) || input.label, fillColor: '#ffc8c8' },
                        { text: input.label === 'Vacancy Rate' ? formatPercentage(values[0]) : formatCurrency(values[0]), fillColor: '#ffc8c8' },
                        { text: input.label === 'Vacancy Rate' ? formatPercentage(values[1]) : formatCurrency(values[1]), fillColor: '#ffc8c8' },
                        { text: input.label === 'Vacancy Rate' ? formatPercentage(values[2]) : formatCurrency(values[2]), fillColor: '#ffc8c8' }
                    ]);
                }
            });

            content.push({
                table: {
                    headerRows: 2,
                    widths: ['*', 'auto', 'auto', 'auto'],
                    body: tableData,
                    layout: getTableLayout()
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
                const values = input.id.map(id => getInputValue(id));
                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input.id[0]) || input.label, fillColor: '#dfdfdf' },
                        { text: formatCurrency(values[0]), fillColor: '#dfdfdf' },
                        { text: formatCurrency(values[1]), fillColor: '#dfdfdf' },
                        { text: formatCurrency(values[2]), fillColor: '#dfdfdf' }
                    ]);
                }
            });

            content.push({
                table: {
                    headerRows: 2,
                    widths: ['*', 'auto', 'auto', 'auto'],
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
                    const label = getLabelText(input.id) || input.label;
                    const formattedValue = input.format ? input.format(value) : formatCurrency(value);
                    tableData.push([label, formattedValue]);
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
