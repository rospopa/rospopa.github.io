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
            showPDFPreview();
        } catch (error) {
            console.error('Error in PDF preview:', error);
        }
    });
});

function showPDFPreview() {
    // Create modal container if it doesn't exist
    let modal = document.getElementById('pdfPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pdfPreviewModal';
        modal.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0,0,0,0.5);
            display: flex;
            justify-content: center;
            align-items: center;
            z-index: 1000;
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white;
            padding: 15px;
            border-radius: 8px;
            max-width: 90%;
            max-height: 80vh;
            overflow-y: auto;
        `;

        const title = document.createElement('h3');
        title.textContent = 'Select Fields to Include in PDF';
        title.style.marginBottom = '15px';

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'pdfFieldsContainer';
        fieldsContainer.style.marginLeft = '20px';

        // Add buttons
        const buttonContainer = document.createElement('div');
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '15px';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.className = 'btn btn-secondary';
        selectAllBtn.onclick = () => {
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
        };

        const generateBtn = document.createElement('button');
        generateBtn.textContent = 'Generate PDF';
        generateBtn.className = 'btn btn-primary';
        generateBtn.onclick = () => {
            const selectedFields = {};
            modal.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                selectedFields[cb.value] = cb.checked;
            });
            generatePDF(selectedFields);
            modal.remove();
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-secondary';
        cancelBtn.onclick = () => modal.remove();

        buttonContainer.appendChild(selectAllBtn);
        buttonContainer.appendChild(cancelBtn);
        buttonContainer.appendChild(generateBtn);

        modalContent.appendChild(title);
        modalContent.appendChild(fieldsContainer);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Populate fields
        populatePDFFields(fieldsContainer);
    }
}

function populatePDFFields(container) {
    const sections = [
        {
            title: 'Loan Profile',
            inputs: [
                { id: 'autocomplete', label: 'Property Address' },
                { id: 'B1', label: 'Purchase Price' },
                { id: 'B2', label: 'Down Payment' },
                { id: 'B3', label: 'Down Payment Amount' },
                { id: 'B4', label: 'Closing Date' },
                { id: 'B5', label: 'Loan Amount' },
                { id: 'B6', label: 'Interest Rate' },
                { id: 'B7', label: 'Loan Term Period' },
                { id: 'B8', label: 'Payments per Year' },
                { id: 'B9', label: 'Total Payments' },
                { id: 'B10', label: 'Amount per Payment' },
                { id: 'B11', label: 'Total Loan Cost' },
                { id: 'B12', label: 'Interest Cost' },
                { id: 'B13', label: 'Closing Costs' },
                { id: 'B14', label: 'Inspection' },
                { id: 'B15', label: 'Down Payment + Closing Cost + Inspection - Tax Proration' },
                { id: 'Loan-Type', label: 'Loan Type' }
            ]
        },
        {
            title: 'Tax Proration',
            inputs: [
                { id: 'A4', label: 'Remain to Year End' },
                { id: 'A7', label: 'Annual Tax Amount' },
                { id: 'A9', label: 'Tax Proration Rate' },
                { id: 'A10', label: 'Tax Proration Amount' }
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
                { id: ['B28', 'C28', 'D28'], label: 'Vacancy Rate' },
                { id: ['VRB28', 'VRC28', 'VRD28'], label: 'Vacancy Risk' },
                { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance' },
                { id: ['B30', 'C30', 'D30'], label: 'Property Insurance' },
                { id: ['B31', 'C31', 'D31'], label: 'HOA' },
                { id: ['B32', 'C32', 'D32'], label: 'Property Management' }
            ]
        },
        {
            title: 'Custom Expenses',
            inputs: Array.from({ length: 9 }, (_, i) => i + 1).map(i => {
                const fieldName = document.getElementById(`CFN${i}`)?.value.trim();
                const hasValue = fieldName && (
                    document.getElementById(`CFB${i}`)?.value ||
                    document.getElementById(`CFC${i}`)?.value ||
                    document.getElementById(`CFD${i}`)?.value
                );
                return hasValue ? {
                    id: [`CFB${i}`, `CFC${i}`, `CFD${i}`],
                    label: fieldName
                } : null;
            }).filter(Boolean)
        },
        {
            title: 'Gross Revenue',
            inputs: [
                ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 33 + i;
                    const value = document.getElementById(`B${baseIndex}`)?.value;
                    return value && parseFloat(value.replace(/[^-0-9.]/g, '')) !== 0 ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Unit ${i + 1}`
                    } : null;
                }).filter(Boolean),
                ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 48 + i;
                    const value = document.getElementById(`B${baseIndex}`)?.value;
                    return value && parseFloat(value.replace(/[^-0-9.]/g, '')) !== 0 ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Parking ${i + 1}`
                    } : null;
                }).filter(Boolean)
            ]
        },
        {
            title: 'Total Cash Flow',
            inputs: [
                { id: ['B63', 'C63', 'D63'], label: 'Total Mortgage/Month' },
                { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month' },
                { id: ['B65', 'C65', 'D65'], label: 'Total Revenue/Month' },
                { id: ['B66', 'C66', 'D66'], label: 'Est Total Income/Month' }
            ]
        }
    ];

    sections.forEach((section, sectionIndex) => {
        const sectionDiv = document.createElement('div');
        sectionDiv.style.marginBottom = '20px';

        // Create section header div to hold title and checkbox
        const sectionHeaderDiv = document.createElement('div');
        sectionHeaderDiv.style.display = 'flex';
        sectionHeaderDiv.style.alignItems = 'center';
        sectionHeaderDiv.style.marginBottom = '5px';

        // Create section checkbox
        const sectionCheckbox = document.createElement('input');
        sectionCheckbox.type = 'checkbox';
        sectionCheckbox.id = `section_${sectionIndex}`;
        sectionCheckbox.checked = true;
        sectionCheckbox.style.marginRight = '8px';

        // Create section title
        const sectionTitle = document.createElement('h4');
        sectionTitle.textContent = section.title;
        sectionTitle.style.margin = '0';

        sectionHeaderDiv.appendChild(sectionCheckbox);
        sectionHeaderDiv.appendChild(sectionTitle);
        sectionDiv.appendChild(sectionHeaderDiv);

        const fieldsContainer = document.createElement('div');
        fieldsContainer.style.marginLeft = '20px';

        if (section.inputs) {
            // Create table for fields
            const table = document.createElement('table');
            table.style.width = '100%';
            table.style.borderCollapse = 'collapse';
            
            // Add event listener to section checkbox
            sectionCheckbox.addEventListener('change', (e) => {
                const checkboxes = table.querySelectorAll('input[type="checkbox"]');
                checkboxes.forEach(cb => cb.checked = e.target.checked);
            });

            section.inputs.forEach(input => {
                const row = document.createElement('tr');
                const cellLeft = document.createElement('td');
                const cellRight = document.createElement('td');
                cellRight.style.textAlign = 'right';
                cellRight.style.width = 'auto'; // Fixed width for values column

                const fieldDiv = document.createElement('div');
                fieldDiv.style.display = 'flex';
                fieldDiv.style.alignItems = 'center';

                const checkbox = document.createElement('input');
                checkbox.type = 'checkbox';
                checkbox.id = Array.isArray(input.id) ? `pdf_${input.id[0]}` : `pdf_${input.id}`;
                checkbox.value = input.id;
                checkbox.checked = true;
                checkbox.style.marginRight = '8px';

                // Add event listener to update section checkbox when field checkbox changes
                checkbox.addEventListener('change', () => {
                    const allFieldCheckboxes = table.querySelectorAll('input[type="checkbox"]');
                    const allChecked = Array.from(allFieldCheckboxes).every(cb => cb.checked);
                    const allUnchecked = Array.from(allFieldCheckboxes).every(cb => !cb.checked);
                    sectionCheckbox.checked = allChecked;
                    sectionCheckbox.indeterminate = !allChecked && !allUnchecked;
                });

                const label = document.createElement('label');
                label.htmlFor = checkbox.id;
                
                // Special handling for Tax Proration Amount label
                if (input.label === 'Tax Proration Amount') {
                    const isPercentageBased = document.getElementById('A8')?.checked;
                    label.textContent = `Tax Proration Amount (${isPercentageBased ? 'Percentage-Based' : 'Daily-Based'})`;
                    
                    document.getElementById('A8')?.addEventListener('change', (e) => {
                        label.textContent = `Tax Proration Amount (${e.target.checked ? 'Percentage-Based' : 'Daily-Based'})`;
                        updatePreviewValue();
                    });
                } else {
                    label.textContent = input.label;
                }

                // Function to update preview value
                const updatePreviewValue = () => {
                    let previewSpan = cellRight.querySelector('.preview-value');
                    if (!previewSpan) {
                        previewSpan = document.createElement('span');
                        previewSpan.className = 'preview-value';
                        cellRight.appendChild(previewSpan);
                    }

                    if (Array.isArray(input.id)) {
                        const values = input.id.map(id => document.getElementById(id)?.value || '').filter(val => val);
                        if (values.length > 0) {
                            const formattedValues = values.map(val => {
                                if (input.label.includes('Rate') || input.label.includes('Proration')) {
                                    return val + '%';
                                }
                                return '$' + parseFloat(val.replace(/[^-0-9.]/g, '')).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                            });
                            previewSpan.textContent = formattedValues.join(' / ');
                        }
                    } else {
                        const value = document.getElementById(input.id)?.value || '';
                        if (value) {
                            let formattedValue = value;
                            if (input.label.toLowerCase().includes('price') || 
                                input.label.toLowerCase().includes('amount') || 
                                input.label.toLowerCase().includes('cost') || 
                                (input.label.toLowerCase().includes('payment') && input.label !== 'Down Payment') ||
                                input.label.toLowerCase().includes('inspection')) {
                                formattedValue = '$' + parseFloat(value.replace(/[^-0-9.]/g, '')).toLocaleString('en-US', {
                                    minimumFractionDigits: 2,
                                    maximumFractionDigits: 2
                                });
                            } else if (input.label.toLowerCase().includes('rate') || 
                                     input.label === 'Down Payment' ||
                                     input.label === 'Closing Costs') {
                                formattedValue = value + '%';
                            } else if (input.label.toLowerCase().includes('remain to year end')) {
                                formattedValue = value + ' days';
                            }
                            previewSpan.textContent = formattedValue;
                        }
                    }
                };

                fieldDiv.appendChild(checkbox);
                fieldDiv.appendChild(label);
                cellLeft.appendChild(fieldDiv);
                updatePreviewValue(); // Initial update of preview value

                row.appendChild(cellLeft);
                row.appendChild(cellRight);
                table.appendChild(row);
            });

            fieldsContainer.appendChild(table);
        }

        sectionDiv.appendChild(fieldsContainer);
        container.appendChild(sectionDiv);
    });
}

function generatePDF(selectedFields) {
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

    const getLabelText = (input) => {
        if (typeof input.label === 'function') {
            return input.label();
        }
        return input.label;
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
                { id: 'B15', label: 'Down Payment + Closing Cost (% of Purchase Price) + Inspection - Tax Proration', format: formatCurrency },
                { id: 'Loan-Type', label: 'Loan Type', format: value => value }
            ]
        },
        {
            title: 'Tax Proration',
            inputs: [
                { id: 'A4', label: 'Remain to Year End', format: value => value + ' days' },
                { id: 'A7', label: 'Annual Tax Amount', format: formatCurrency },
                { id: 'A9', label: 'Tax Proration Rate', format: formatPercentage },
                { 
                    id: 'A10', 
                    label: () => {
                        const isPercentageBased = document.getElementById('A8')?.checked;
                        return `Tax Proration Amount (${isPercentageBased ? 'Percentage-Based' : 'Daily-Based'})`;
                    }, 
                    format: formatCurrency 
                }
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
                { id: ['VRB28', 'VRC28', 'VRD28'], label: 'Vacancy Risk', format: formatCurrency },
                { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance', format: formatCurrency },
                { id: ['B30', 'C30', 'D30'], label: 'Property Insurance', format: formatCurrency },
                { id: ['B31', 'C31', 'D31'], label: 'HOA', format: formatCurrency },
                { id: ['B32', 'C32', 'D32'], label: 'Property Management', format: formatCurrency }
            ]
        },
        {
            title: 'Custom Expenses',
            inputs: Array.from({ length: 9 }, (_, i) => i + 1).map(i => {
                const fieldName = document.getElementById(`CFN${i}`)?.value.trim();
                const hasValue = fieldName && (
                    document.getElementById(`CFB${i}`)?.value ||
                    document.getElementById(`CFC${i}`)?.value ||
                    document.getElementById(`CFD${i}`)?.value
                );
                return hasValue ? {
                    id: [`CFB${i}`, `CFC${i}`, `CFD${i}`],
                    label: fieldName,
                    format: formatCurrency
                } : null;
            }).filter(Boolean)
        },
        {
            title: 'Gross Revenue',
            inputs: [
                ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 33 + i;
                    const value = document.getElementById(`B${baseIndex}`)?.value;
                    return value && parseFloat(value.replace(/[^-0-9.]/g, '')) !== 0 ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Unit ${i + 1}`,
                        format: formatCurrency
                    } : null;
                }).filter(Boolean),
                ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 48 + i;
                    const value = document.getElementById(`B${baseIndex}`)?.value;
                    return value && parseFloat(value.replace(/[^-0-9.]/g, '')) !== 0 ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Parking ${i + 1}`,
                        format: formatCurrency
                    } : null;
                }).filter(Boolean)
            ]
        },
        {
            title: 'Total Cash Flow',
            inputs: [
                { id: ['B63', 'C63', 'D63'], label: 'Total Mortgage/Month' },
                { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month' },
                { id: ['B65', 'C65', 'D65'], label: 'Total Revenue/Month' },
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
            // Split inputs into units and parking
            const units = section.inputs.filter(input => input.label.startsWith('Unit'));
            const parking = section.inputs.filter(input => input.label.startsWith('Parking'));
            
            // Only add units subsection if there are units with values
            if (units.length > 0) {
                const tableData = [
                    [{ text: 'Units', style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                    [
                        { text: 'Unit', alignment: 'center', fillColor: '#90ee90', bold: true },
                        { text: 'Min', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Max', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Avg', alignment: 'center', fillColor: '#90ee90' }
                    ],
                    ...units.map(input => [
                        { text: input.label, fillColor: '#c1fdc1' },
                        { text: formatCurrency(getInputValue(input.id[0])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: formatCurrency(getInputValue(input.id[1])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: formatCurrency(getInputValue(input.id[2])), fillColor: '#c1fdc1', alignment: 'right' }
                    ])
                ];

                content.push({
                    table: {
                        widths: ['*', '*', '*', '*'],
                        body: tableData
                    },
                    layout: {
                        fillColor: function (rowIndex, node, columnIndex) {
                            return rowIndex === 0 ? '#ffffff' : null;
                        }
                    }
                });
            }

            // Only add parking subsection if there are parking spots with values
            if (parking.length > 0) {
                const tableData = [
                    [{ text: 'Parking', style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                    [
                        { text: 'Parking', alignment: 'center', fillColor: '#90ee90', bold: true },
                        { text: 'Min', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Max', alignment: 'center', fillColor: '#90ee90' },
                        { text: 'Avg', alignment: 'center', fillColor: '#90ee90' }
                    ],
                    ...parking.map(input => [
                        { text: input.label, fillColor: '#c1fdc1' },
                        { text: formatCurrency(getInputValue(input.id[0])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: formatCurrency(getInputValue(input.id[1])), fillColor: '#c1fdc1', alignment: 'right' },
                        { text: formatCurrency(getInputValue(input.id[2])), fillColor: '#c1fdc1', alignment: 'right' }
                    ])
                ];

                content.push({
                    table: {
                        widths: ['*', '*', '*', '*'],
                        body: tableData
                    },
                    layout: {
                        fillColor: function (rowIndex, node, columnIndex) {
                            return rowIndex === 0 ? '#ffffff' : null;
                        }
                    }
                });
            }
        } else if (section.title === 'Gross Expenses') {
            const tableData = [
                [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                [
                    { text: section.title, alignment: 'center', fillColor: '#f08080', bold: true },
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
                        // Remove currency symbol and commas, but keep negative sign and decimal point
                        return rawValue.replace(/[^-0-9.]/g, '');
                    }
                    return rawValue;
                });

                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input), fillColor: '#ffc8c8' },
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
        } else if (section.title === 'Custom Expenses') {
            // First check if there are any custom expenses with values
            const hasCustomExpenses = Array.from({ length: 9 }, (_, i) => i + 1).some(i => {
                const fieldName = document.getElementById(`CFN${i}`).value.trim();
                return fieldName && (
                    document.getElementById(`CFB${i}`).value ||
                    document.getElementById(`CFC${i}`).value ||
                    document.getElementById(`CFD${i}`).value
                );
            });

            if (hasCustomExpenses) {
                const tableData = [
                    [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                    [
                        { text: section.title, alignment: 'center', fillColor: '#f08080', bold: true },
                        { text: 'Min', alignment: 'center', fillColor: '#f08080' },
                        { text: 'Max', alignment: 'center', fillColor: '#f08080' },
                        { text: 'Avg', alignment: 'center', fillColor: '#f08080' }
                    ]
                ];

                section.inputs.forEach(input => {
                    const values = input.id.map(id => {
                        const rawValue = getInputValue(id);
                        const element = document.getElementById(id);
                        if (element && element.getAttribute('data-type') === 'currency') {
                            return rawValue.replace(/[^-0-9.]/g, '');
                        }
                        return rawValue;
                    });

                    if (values.some(v => v)) {
                        tableData.push([
                            { text: getLabelText(input), fillColor: '#ffc8c8' },
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
            }
        } else if (section.title === 'Total Cash Flow') {
            const tableData = [
                [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', margin: [0, 10, 0, 1] }, {}, {}, {}],
                [
                    { text: section.title, alignment: 'center', fillColor: '#d3d3d3', bold: true },
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
                        // Remove currency symbol and commas, but keep negative sign and decimal point
                        return rawValue.replace(/[^-0-9.]/g, '');
                    }
                    return rawValue;
                });

                if (values.some(v => v)) {
                    tableData.push([
                        { text: getLabelText(input), fillColor: '#dfdfdf' },
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
                    { text: section.title, alignment: 'center', bold: true },
                    { text: 'Value', alignment: 'center' }
                ]
            ];
            
            section.inputs.forEach(input => {
                const value = getInputValue(input.id);
                if (value && selectedFields[input.id]) {
                    const labelText = getLabelText(input);
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
