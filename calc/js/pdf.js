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

// --- Helper functions needed within pdf.js scope ---

// Simplified version to get input value for PDF/Preview
function pdf_getInputValue(id) {
    const element = document.getElementById(id);
    return element ? element.value : '';
}

// Simplified currency formatting for PDF/Preview
function pdf_formatCurrency(value) {
    if (!value || value === '' || value === '-') return '$0.00';
    const isNegative = value.toString().startsWith('-');
    const cleanValue = value.toString().replace(/[^-\d.]/g, '');
    const num = parseFloat(cleanValue);
    if (isNaN(num)) return '$0.00';
    const formatted = Math.abs(num).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
    return (isNegative || num < 0 ? '-$' : '$') + formatted;
}

// Simplified percentage formatting for PDF/Preview
function pdf_formatPercentage(value) {
    if (!value) return '0.00%';
    const num = parseFloat(value);
    return isNaN(num) ? '0.00%' : num.toFixed(2) + '%';
}
// --- End Helper Functions ---


function showPDFPreview() {
    // Create modal container if it doesn't exist
    let modal = document.getElementById('pdfPreviewModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'pdfPreviewModal';
        modal.style.cssText = `
            position: fixed; top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.6); display: flex; justify-content: center;
            align-items: center; z-index: 1050; /* Ensure high z-index */
            overflow-y: auto; /* Allow modal scroll if content is tall */
            padding: 20px 0; /* Add padding top/bottom */
        `;

        const modalContent = document.createElement('div');
        modalContent.style.cssText = `
            background: white; padding: 10px; border-radius: 8px;
            width: 90%; /* Adjust width */
            max-width: 600px; /* Max width */
            max-height: 90vh; /* Max height */
            overflow-y: auto; /* Allow content scroll */
            box-shadow: 0 5px 15px rgba(0,0,0,0.2);
        `;

        const title = document.createElement('h3');
        title.textContent = 'Select Fields to Include in PDF';
        title.style.marginBottom = '5px';
        title.style.textAlign = 'center';

        const fieldsContainer = document.createElement('div');
        fieldsContainer.id = 'pdfFieldsContainer';
        fieldsContainer.style.maxHeight = '60vh'; // Limit height of fields area
        fieldsContainer.style.overflowY = 'auto'; // Scroll within fields area
        fieldsContainer.style.border = '1px solid #ccc';
        fieldsContainer.style.padding = '5px';
		fieldsContainer.style.paddingRight = '10px';
        fieldsContainer.style.marginBottom = '5px';


        // Add image upload section
        const imageSection = document.createElement('div');
        imageSection.style.marginBottom = '5px';
        imageSection.style.padding = '5px';
        imageSection.style.border = '1px dashed #ccc';

        const imageLabel = document.createElement('label');
        imageLabel.htmlFor = 'user_file';
        imageLabel.textContent = 'Add Optional Image to PDF:';
        imageLabel.style.display = 'block';
        imageLabel.style.marginBottom = '5px';
        imageLabel.style.fontWeight = 'bold';

        const imageInput = document.createElement('input');
        imageInput.id = 'user_file';
        imageInput.type = 'file';
        imageInput.name = 'file_upload';
        imageInput.accept = 'image/*';

        imageSection.appendChild(imageLabel);
        imageSection.appendChild(imageInput);

        // Add image embed code section
        const embedCodeSection = document.createElement('div');
        embedCodeSection.style.marginBottom = '5px';
        embedCodeSection.style.padding = '5px';
        embedCodeSection.style.border = '1px dashed #ccc';

        const embedCodeLabel = document.createElement('label');
        embedCodeLabel.htmlFor = 'imageEmbedCodeInput';
        embedCodeLabel.textContent = 'Or paste image embed code (e.g., <img> tag):';
        embedCodeLabel.style.display = 'block';
        embedCodeLabel.style.marginBottom = '5px';
        embedCodeLabel.style.fontWeight = 'bold';

        const embedCodeInput = document.createElement('textarea');
        embedCodeInput.id = 'imageEmbedCodeInput';
        embedCodeInput.placeholder = '<img width="800" height="600" src="https://example.com/image.jpg" />';
        embedCodeInput.style.width = '100%';
        embedCodeInput.style.minHeight = '60px';
        embedCodeInput.style.resize = 'vertical';
        embedCodeInput.style.padding = '5px';
        embedCodeInput.style.border = '1px solid #ccc';
        embedCodeInput.style.borderRadius = '4px';

        embedCodeSection.appendChild(embedCodeLabel);
        embedCodeSection.appendChild(embedCodeInput);

        // Add buttons
        const buttonContainer = document.createElement('div');
		buttonContainer.id = 'pdf_prv_btn';
        buttonContainer.style.display = 'flex';
        buttonContainer.style.justifyContent = 'space-between';
        buttonContainer.style.marginTop = '0px';
        buttonContainer.style.paddingTop = '10px';
        buttonContainer.style.borderTop = '1px solid #eee';

        const selectAllBtn = document.createElement('button');
        selectAllBtn.textContent = 'Select All';
        selectAllBtn.className = 'btn btn-sm btn-secondary'; // Smaller button
        selectAllBtn.onclick = () => {
            const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => cb.checked = true);
             // Also update section checkboxes/indeterminate state if needed (optional)
             updateSectionCheckboxes(fieldsContainer);
        };

        const deselectAllBtn = document.createElement('button');
         deselectAllBtn.textContent = 'Deselect All';
         deselectAllBtn.className = 'btn btn-sm btn-secondary'; // Smaller button
         deselectAllBtn.onclick = () => {
             const checkboxes = modal.querySelectorAll('input[type="checkbox"]');
             checkboxes.forEach(cb => cb.checked = false);
             updateSectionCheckboxes(fieldsContainer);
         };

        const generateBtn = document.createElement('button');
        generateBtn.textContent = 'Generate';
        generateBtn.className = 'btn btn-sm btn-primary'; // Smaller button
        generateBtn.onclick = () => {
            const selectedFields = {};
            modal.querySelectorAll('input[type="checkbox"][data-field-id]').forEach(cb => {
                selectedFields[cb.dataset.fieldId] = cb.checked; // Use data attribute
            });
            generatePDF(selectedFields); // Pass the map of selected fields
            modal.remove(); // Close modal after generating
        };

        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'btn btn-sm btn-danger'; // Smaller button
        cancelBtn.onclick = () => modal.remove();

        const leftButtons = document.createElement('div');
        leftButtons.appendChild(selectAllBtn);
        leftButtons.appendChild(deselectAllBtn);

        const rightButtons = document.createElement('div');
        rightButtons.appendChild(cancelBtn);
        rightButtons.appendChild(generateBtn);


        buttonContainer.appendChild(leftButtons);
        buttonContainer.appendChild(rightButtons);


        modalContent.appendChild(title);
        modalContent.appendChild(imageSection);
        modalContent.appendChild(fieldsContainer);
        modalContent.appendChild(buttonContainer);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);

        // Populate fields
        populatePDFFields(fieldsContainer);
    }
}
function updateSectionCheckboxes(container) {
     container.querySelectorAll('.pdf-section').forEach(sectionDiv => {
         const sectionCheckbox = sectionDiv.querySelector('input.section-checkbox');
         const fieldCheckboxes = sectionDiv.querySelectorAll('input[data-field-id]');
         if (!sectionCheckbox || fieldCheckboxes.length === 0) return;

         const allChecked = Array.from(fieldCheckboxes).every(cb => cb.checked);
         const someChecked = Array.from(fieldCheckboxes).some(cb => cb.checked);

         sectionCheckbox.checked = allChecked;
         sectionCheckbox.indeterminate = someChecked && !allChecked;
     });
 }


function populatePDFFields(container) {
    // Structure matching calc.js and calc.html
    const sections = [
        {
            title: 'Property',
            inputs: [
                { id: 'autocomplete', label: 'Address' },
                { id: 'B1', label: 'Purchase Price', format: pdf_formatCurrency },
                { id: 'B4', label: 'Closing Date' },
                { id: 'A4', label: 'Remain Days' },
                { id: 'A4_2', label: 'Passed Days' }
            ]
        },
        {
            title: 'Loan Profile',
            inputs: [
                { id: 'B2', label: 'Down Payment %', format: pdf_formatPercentage },
                { id: 'B3', label: 'Down Payment $', format: pdf_formatCurrency },
                { id: 'Loan-Type', label: 'Loan Type' },
                { id: 'B5', label: 'Loan Amount', format: pdf_formatCurrency },
                { id: 'B7', label: 'Loan Term Period' },
                { id: 'B8', label: 'Payments per Period' }, // Consider adding Term Period dynamically?
                { id: 'B6', label: 'Annual Interest Rate', format: pdf_formatPercentage },
                { id: 'B9', label: 'Total Payments #' },
                { id: 'B10', label: 'Amount per Payment $', format: pdf_formatCurrency },
                { id: 'B12', label: 'Interest Cost $', format: pdf_formatCurrency },
                { id: 'B11', label: 'Total Loan Cost $', format: pdf_formatCurrency }
            ]
        },
        {
            title: 'Taxes',
            inputs: [
                { id: 'A5', label: 'Annual Tax Amount', format: pdf_formatCurrency },
                { id: 'A5_2', label: 'Daily Tax Amount', format: pdf_formatCurrency },
                { id: 'A8', label: 'Tax Proration Amount', format: pdf_formatCurrency },
                { id: 'A7', label: 'Tax Depreciation', format: pdf_formatCurrency } // Note: Non-cash
            ]
        },
        {
            title: 'Cash To Close', // Remind user B15 is simplified
            inputs: [
                { id: 'A10', label: 'Escrow', format: pdf_formatCurrency },
                { id: 'A12', label: 'Allowances', format: pdf_formatCurrency },
                { id: 'B13', label: 'Closing Cost %', format: pdf_formatPercentage },
                { id: 'B14', label: 'Inspection $', format: pdf_formatCurrency },
                { id: 'A11', label: 'Encumbrances $', format: pdf_formatCurrency },
                { id: 'B15', label: 'Est. Cash to Close $', format: pdf_formatCurrency }
            ]
        },
        {
            title: 'Expenses', // Combined Standard and Custom
            multiColumn: true, // Flag for multi-column table structure
            inputs: [
                // Standard Expenses
                { id: ['B19', 'C19', 'D19'], label: 'Refuse', format: pdf_formatCurrency },
                { id: ['B20', 'C20', 'D20'], label: 'Water', format: pdf_formatCurrency },
                { id: ['B21', 'C21', 'D21'], label: 'Sewer', format: pdf_formatCurrency },
                { id: ['B22', 'C22', 'D22'], label: 'Property Taxes', format: pdf_formatCurrency },
                { id: ['B23', 'C23', 'D23'], label: 'Electric', format: pdf_formatCurrency },
                { id: ['B24', 'C24', 'D24'], label: 'Gas', format: pdf_formatCurrency },
                { id: ['B25', 'C25', 'D25'], label: 'Internet', format: pdf_formatCurrency },
                { id: ['B26', 'C26', 'D26'], label: 'Lawn Care', format: pdf_formatCurrency },
                { id: ['B27', 'C27', 'D27'], label: 'Maintenance', format: pdf_formatCurrency },
                { id: ['B28', 'C28', 'D28'], label: 'Vacancy Rate', format: pdf_formatPercentage }, // Note: Rate is %, Risk is $
                { id: ['VRB28', 'VRC28', 'VRD28'], label: 'Vacancy Risk ($)', format: pdf_formatCurrency },
                { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance', format: pdf_formatCurrency },
                { id: ['B30', 'C30', 'D30'], label: 'Property Insurance', format: pdf_formatCurrency },
                { id: ['B31', 'C31', 'D31'], label: 'HOA', format: pdf_formatCurrency },
                { id: ['B32', 'C32', 'D32'], label: 'Property Management', format: pdf_formatCurrency },
                 // Custom Expenses (Dynamically add if name exists and ANY value exists)
                ...Array.from({ length: 9 }, (_, i) => i + 1).map(i => {
                    const name = pdf_getInputValue(`CFN${i}`).trim();
                    const valB = pdf_getInputValue(`CFB${i}`);
                    const valC = pdf_getInputValue(`CFC${i}`);
                    const valD = pdf_getInputValue(`CFD${i}`);
                    // Include if name is present AND at least one value field is not empty/zero
                    return (name && (valB || valC || valD)) ? {
                        id: [`CFB${i}`, `CFC${i}`, `CFD${i}`],
                        label: name, // Use dynamic name
                        format: pdf_formatCurrency
                    } : null;
                }).filter(Boolean) // Remove null entries
            ]
        },
        {
            title: 'Revenue', // Combined Units, Parking, Custom
            multiColumn: true,
            inputs: [
                // Units (Dynamically add if ANY value exists)
                 ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 33 + i;
                    const valB = pdf_getInputValue(`B${baseIndex}`);
                    const valC = pdf_getInputValue(`C${baseIndex}`);
                    const valD = pdf_getInputValue(`D${baseIndex}`);
                    return (valB !== '0.00' && valC !== '0.00' && valD !== '0.00') ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Unit ${i + 1}`,
                        format: pdf_formatCurrency
                    } : null;
                }).filter(Boolean),
                // Parking (Dynamically add if ANY value exists)
                 ...Array.from({ length: 15 }, (_, i) => {
                    const baseIndex = 48 + i;
                    const valB = pdf_getInputValue(`B${baseIndex}`);
                    const valC = pdf_getInputValue(`C${baseIndex}`);
                    const valD = pdf_getInputValue(`D${baseIndex}`);
                    return (valB !== '0.00' && valC !== '0.00' && valD !== '0.00') ? {
                        id: [`B${baseIndex}`, `C${baseIndex}`, `D${baseIndex}`],
                        label: `Parking ${i + 1}`,
                        format: pdf_formatCurrency
                    } : null;
                }).filter(Boolean),
                // Custom Revenue (Dynamically add if name exists and ANY value exists)
                 ...Array.from({ length: 9 }, (_, i) => i + 1).map(i => {
                     const name = pdf_getInputValue(`CFRN${i}`).trim();
                     const valB = pdf_getInputValue(`CFRB${i}`);
                     const valC = pdf_getInputValue(`CFRC${i}`);
                     const valD = pdf_getInputValue(`CFRD${i}`);
                     return (name && (valB || valC || valD)) ? {
                        id: [`CFRB${i}`, `CFRC${i}`, `CFRD${i}`],
                        label: name,
                        format: pdf_formatCurrency
                    } : null;
                }).filter(Boolean)
            ]
        },
         {
            title: 'Totals & Summary',
            multiColumn: true, // Display totals and summary metrics in table format
            inputs: [
                 // Totals
                { id: ['B65', 'C65', 'D65'], label: 'Total Revenue/Month', format: pdf_formatCurrency },
                { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month', format: pdf_formatCurrency },
                // Individual Metrics (mostly calculated, B10 is from loan profile)
                { id: ['B10', 'B10', 'B10'], label: 'Monthly P&I Payment', format: pdf_formatCurrency }, // Repeat B10 for consistency in table
                { id: ['NOI-min', 'NOI-max', 'NOI-avg'], label: 'Monthly NOI ($)', format: pdf_formatCurrency },
                { id: ['B66', 'C66', 'D66'], label: 'Monthly Cash Flow ($)', format: pdf_formatCurrency },
                // Ratios / Rates (%) - Make sure IDs match calc.html
                { id: ['GRM-min', 'GRM-max', 'GRM-avg'], label: 'GRM (Ratio)', format: pdf_formatPercentage }, // Based on provided formula (Rev/Price*100)
                { id: ['CR-min', 'CR-max', 'CR-avg'], label: 'Cap Rate (Ratio)', format: pdf_formatPercentage },
                { id: ['CCR-min', 'CCR-max', 'CCR-avg'], label: 'CoC Return (Ratio)', format: pdf_formatPercentage },
                { id: ['DSCR-min', 'DSCR-max', 'DSCR-avg'], label: 'DSCR (Ratio)', format: (val) => parseFloat(val).toFixed(2) }, // Format as number
                // Add placeholders for non-implemented ones
                 { id: ['ROI-min', 'ROI-max', 'ROI-avg'], label: 'ROI', format: () => 'N/A' },
                 { id: ['IRR-min', 'IRR-max', 'IRR-avg'], label: 'IRR', format: () => 'N/A' }
            ]
        },
        {
            title: 'Charts',
            inputs: [
                { id: 'apex_amortization_chart', label: 'Amortization Chart', type: 'chart' },
                { id: 'apex_cumulative_range_chart', label: 'Cumulative Revenue/Expense Chart', type: 'chart' }
            ]
        }
    ];

    container.innerHTML = ''; // Clear previous content

    sections.forEach((section, sectionIndex) => {
        if (!section.inputs || section.inputs.length === 0) return; // Skip empty sections

        const sectionDiv = document.createElement('div');
        sectionDiv.className = 'pdf-section';
        sectionDiv.style.marginBottom = '15px';
        sectionDiv.style.paddingBottom = '10px';
        sectionDiv.style.borderBottom = '1px solid #eee';

        const sectionHeaderDiv = document.createElement('div');
        sectionHeaderDiv.style.display = 'flex';
        sectionHeaderDiv.style.alignItems = 'center';
        sectionHeaderDiv.style.marginBottom = '8px';

        const sectionCheckbox = document.createElement('input');
        sectionCheckbox.type = 'checkbox';
        sectionCheckbox.id = `section_${sectionIndex}`;
        sectionCheckbox.checked = true;
        sectionCheckbox.className = 'section-checkbox';
        sectionCheckbox.style.marginRight = '8px';

        const sectionTitle = document.createElement('h5');
        sectionTitle.textContent = section.title;
        sectionTitle.style.margin = '0';
        sectionTitle.style.cursor = 'pointer';
        sectionTitle.onclick = () => sectionCheckbox.click();

        sectionHeaderDiv.appendChild(sectionCheckbox);
        sectionHeaderDiv.appendChild(sectionTitle);
        sectionDiv.appendChild(sectionHeaderDiv);

        const fieldsGrid = document.createElement('div');
        fieldsGrid.style.marginLeft = '25px';
        fieldsGrid.style.display = 'grid';
        fieldsGrid.style.gridTemplateColumns = '1fr';
        fieldsGrid.style.gap = '5px 15px';

        section.inputs.forEach(input => {
            const fieldContainer = document.createElement('div');
            fieldContainer.style.display = 'flex';
            fieldContainer.style.alignItems = 'center';
            fieldContainer.style.justifyContent = 'space-between'; // Add this to push value to the right

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            const fieldId = Array.isArray(input.id) ? input.id.join(',') : input.id;
            checkbox.id = `pdf_field_${fieldId.replace(/[^a-zA-Z0-9]/g, '_')}`;
            checkbox.dataset.fieldId = fieldId;
            checkbox.checked = true;
            checkbox.style.marginRight = '8px';
            checkbox.style.flexShrink = '0';

            const labelContainer = document.createElement('div');
            labelContainer.style.display = 'flex';
            labelContainer.style.alignItems = 'center';
            labelContainer.style.flex = '1'; // Take up remaining space
            labelContainer.style.cursor = 'pointer';
            labelContainer.onclick = () => checkbox.click();

            const labelText = document.createElement('span');
            labelText.textContent = input.label;
            labelText.style.marginRight = '5px';

            // Value preview container
            const valuePreview = document.createElement('span');
            valuePreview.style.fontSize = '0.85em';
            valuePreview.style.color = '#555';
            valuePreview.style.textAlign = 'right';
            valuePreview.style.whiteSpace = 'nowrap';
            valuePreview.style.overflow = 'hidden';
            valuePreview.style.textOverflow = 'ellipsis';
            valuePreview.style.minWidth = '120px'; // Add minimum width for values

            try {
                if (Array.isArray(input.id)) {
                    const values = input.id.map(id => {
                        const raw = pdf_getInputValue(id);
                        return input.format ? input.format(raw) : raw;
                    }).filter(Boolean);
                    valuePreview.textContent = values.join(' / ');
                } else {
                    const raw = pdf_getInputValue(input.id);
                    valuePreview.textContent = (input.format ? input.format(raw) : raw) || 'empty';
                }
            } catch (e) {
                console.warn("Error formatting preview for", input.label, e);
                valuePreview.textContent = "(error)";
            }

            labelContainer.appendChild(labelText);
            fieldContainer.appendChild(checkbox);
            fieldContainer.appendChild(labelContainer);
            fieldContainer.appendChild(valuePreview);
            fieldsGrid.appendChild(fieldContainer);

            checkbox.addEventListener('change', () => {
                updateSectionCheckboxes(container);
            });
        });

        sectionDiv.appendChild(fieldsGrid);
        container.appendChild(sectionDiv);

        sectionCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            fieldsGrid.querySelectorAll('input[type="checkbox"]').forEach(cb => {
                cb.checked = isChecked;
            });
        });
    });
    updateSectionCheckboxes(container);
}


function generatePDF(selectedFields) { // Accept map of selected fields
    try {
        showLoadingState();

        const imageInput = document.getElementById('user_file');
        const embedCodeInput = document.getElementById('imageEmbedCodeInput');

        const processImageFile = new Promise((resolve) => {
            if (imageInput && imageInput.files && imageInput.files[0]) {
                const reader = new FileReader();
                reader.onload = function(e) {
                    resolve({ image: e.target.result, width: 500 });
                };
                reader.readAsDataURL(imageInput.files[0]);
            } else {
                resolve(null);
            }
        });

        const processImageEmbed = new Promise(async (resolve) => {
            if (embedCodeInput && embedCodeInput.value.trim() !== '') {
                const embedCode = embedCodeInput.value.trim();
                const imgMatch = embedCode.match(/<img[^>]+src="([^"]+)"[^>]*width="(\d+)"[^>]*height="(\d+)"[^>]*\/?>/i);

                if (imgMatch && imgMatch[1]) {
                    const src = imgMatch[1];
                    const width = parseInt(imgMatch[2]) || 500; // Default width if not found
                    const height = parseInt(imgMatch[3]) || 300; // Default height if not found

                    try {
                        const response = await fetch(src);
                        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                        const blob = await response.blob();

                        const reader = new FileReader();
                        reader.onload = function(e) {
                            resolve({ image: e.target.result, width: width, height: height });
                        };
                        reader.readAsDataURL(blob);
                    } catch (error) {
                        console.error('Error fetching image from embed code:', error);
                        resolve(null);
                    }
                } else {
                    resolve(null);
                }
            } else {
                resolve(null);
            }
        });

        Promise.all([
            processImageFile,
            processImageEmbed,
            selectedFields['apex_amortization_chart'] ? captureChartAsImage('apex_amortization_chart') : Promise.resolve(null),
            selectedFields['apex_cumulative_range_chart'] ? captureChartAsImage('apex_cumulative_range_chart') : Promise.resolve(null)
        ]).then(([fileImageData, embedImageData, amortizationChartImage, cumulativeChartImage]) => {
            const content = [
                { text: 'Investment Property Analysis', style: 'header' },
                // Add address if available and selected
                { text: selectedFields['autocomplete'] ? pdf_getInputValue('autocomplete') : '', style: 'subheader', alignment: 'center', margin: [0, 0, 0, 10] }
            ];

            // Prioritize embed image if both are provided
            const finalImageData = embedImageData || fileImageData;

            if (finalImageData) {
                // Calculate aspect ratio to maintain proportions
                const originalWidth = finalImageData.width;
                const originalHeight = finalImageData.height;
                const maxWidth = 520; // Max width for PDF page
                let displayWidth = originalWidth;
                let displayHeight = originalHeight;

                if (originalWidth > maxWidth) {
                    displayWidth = maxWidth;
                    displayHeight = (originalHeight / originalWidth) * maxWidth;
                }

                content.push({
                    image: finalImageData.image,
                    width: displayWidth,
                    height: displayHeight, // Set height based on aspect ratio
                    alignment: 'center',
                    margin: [0, 5, 0, 15] // Add margin after image
                });
            }

            if (amortizationChartImage) {
                content.push({
                    text: 'Loan Amortization Chart',
                    style: 'chartHeader',
                    margin: [0, 10, 0, 5]
                });
                content.push({
                    image: amortizationChartImage,
                    width: 520, // Adjust width as needed for PDF
                    alignment: 'center',
                    margin: [0, 0, 0, 15]
                });
            }

            if (cumulativeChartImage) {
                content.push({
                    text: 'Cumulative Revenue/Expense Chart',
                    style: 'chartHeader',
                    margin: [0, 10, 0, 5]
                });
                content.push({
                    image: cumulativeChartImage,
                    width: 520, // Adjust width as needed for PDF
                    alignment: 'center',
                    margin: [0, 0, 0, 15]
                });
            }

            // Helper to check if any field in a section is selected
            const isSectionSelected = (sectionInputs) => {
                return sectionInputs.some(input => {
                    const fieldId = Array.isArray(input.id) ? input.id.join(',') : input.id;
                    return selectedFields[fieldId];
                });
            };

             // --- Define PDF Content Structure ---
             const pdfSections = [
                {
                    title: 'Property',
                     include: isSectionSelected([{id: 'B1'}, {id: 'B4'}, {id: 'A4'}, {id: 'A4_2'}]), // Check relevant fields
                    layout: 'singleColumn', // Two column table
                    inputs: [
                         { id: 'B1', label: 'Purchase Price', format: pdf_formatCurrency },
                         { id: 'B4', label: 'Closing Date' },
                         { id: 'A4', label: 'Remain Days' },
                         { id: 'A4_2', label: 'Passed Days' }
                    ]
                 },
                 {
                     title: 'Loan Profile',
                     include: isSectionSelected([{id:'B2'}, {id:'B3'}, {id:'Loan-Type'}, {id:'B5'}, {id:'B7'}, {id:'B8'}, {id:'B6'}, {id:'B9'}, {id:'B10'}, {id:'B12'}, {id:'B11'}]),
                     layout: 'singleColumn',
                     inputs: [
                         { id: 'B2', label: 'Down Payment %', format: pdf_formatPercentage },
                         { id: 'B3', label: 'Down Payment $', format: pdf_formatCurrency },
                         { id: 'Loan-Type', label: 'Loan Type' },
                         { id: 'B5', label: 'Loan Amount', format: pdf_formatCurrency },
                         { id: 'B7', label: 'Loan Term Period' },
                         { id: 'B8', label: 'Payments per Period' },
                         { id: 'B6', label: 'Annual Interest Rate', format: pdf_formatPercentage },
                         { id: 'B9', label: 'Total Payments #' },
                         { id: 'B10', label: 'Amount per Payment $', format: pdf_formatCurrency },
                         { id: 'B12', label: 'Interest Cost $', format: pdf_formatCurrency },
                         { id: 'B11', label: 'Total Loan Cost $', format: pdf_formatCurrency }
                     ]
                 },
                 {
                     title: 'Taxes',
                      include: isSectionSelected([{id:'A5'}, {id:'A5_2'}, {id:'A8'}, {id:'A7'}]),
                     layout: 'singleColumn',
                     inputs: [
                         { id: 'A5', label: 'Annual Tax Amount', format: pdf_formatCurrency },
                         { id: 'A5_2', label: 'Daily Tax Amount', format: pdf_formatCurrency },
                         { id: 'A8', label: 'Tax Proration Amount', format: pdf_formatCurrency },
                         { id: 'A7', label: 'Tax Depreciation', format: pdf_formatCurrency }
                     ]
                 },
                 {
                    title: 'Cash To Close',
                    include: isSectionSelected([{id:'A10'}, {id:'A12'}, {id:'B13'}, {id:'B14'}, {id:'A11'}, {id:'B15'}]),
                    layout: 'singleColumn',
                    inputs: [
                        { id: 'A10', label: 'Escrow', format: pdf_formatCurrency },
                        { id: 'A12', label: 'Allowances', format: pdf_formatCurrency },
                        { id: 'B13', label: 'Closing Cost %', format: pdf_formatPercentage },
                        { id: 'B14', label: 'Inspection $', format: pdf_formatCurrency },
                        { id: 'A11', label: 'Encumbrances $', format: pdf_formatCurrency },
                        { id: 'B15', label: 'Est. Cash to Close $', format: pdf_formatCurrency } // Label clarifies estimate
                    ]
                },
                {
                    title: 'Expenses',
                     // Dynamically check if any expense field is selected
                     include: (() => {
                         const expenseIds = [ /* list all expense field IDs/arrays here */
                            ['B19','C19','D19'], ['B20','C20','D20'], ['B21','C21','D21'], ['B22','C22','D22'],
                            ['B23','C23','D23'], ['B24','C24','D24'], ['B25','C25','D25'], ['B26','C26','D26'],
                            ['B27','C27','D27'], ['B28','C28','D28'], ['VRB28','VRC28','VRD28'], ['B29','C29','D29'],
                            ['B30','C30','D30'], ['B31','C31','D31'], ['B32','C32','D32'],
                            ...Array.from({length: 9}, (_, i) => [`CFB${i+1}`, `CFC${i+1}`, `CFD${i+1}`])
                         ];
                         return expenseIds.some(id => selectedFields[Array.isArray(id) ? id.join(',') : id]);
                     })(),
                    layout: 'multiColumn',
                    fillColor: '#ffebeb', // Light red background
                    headerColor: '#ffcccc', // Slightly darker red header
                    inputs: [ // Same inputs as populatePDFFields
                         { id: ['B19', 'C19', 'D19'], label: 'Refuse', format: pdf_formatCurrency },
                         { id: ['B20', 'C20', 'D20'], label: 'Water', format: pdf_formatCurrency },
                         // ... (rest of standard expenses) ...
                         { id: ['B21', 'C21', 'D21'], label: 'Sewer', format: pdf_formatCurrency },
                         { id: ['B22', 'C22', 'D22'], label: 'Property Taxes', format: pdf_formatCurrency },
                         { id: ['B23', 'C23', 'D23'], label: 'Electric', format: pdf_formatCurrency },
                         { id: ['B24', 'C24', 'D24'], label: 'Gas', format: pdf_formatCurrency },
                         { id: ['B25', 'C25', 'D25'], label: 'Internet', format: pdf_formatCurrency },
                         { id: ['B26', 'C26', 'D26'], label: 'Lawn Care', format: pdf_formatCurrency },
                         { id: ['B27', 'C27', 'D27'], label: 'Maintenance', format: pdf_formatCurrency },
                         { id: ['B28', 'C28', 'D28'], label: 'Vacancy Rate', format: pdf_formatPercentage },
                         { id: ['VRB28', 'VRC28', 'VRD28'], label: 'Vacancy Risk ($)', format: pdf_formatCurrency },
                         { id: ['B29', 'C29', 'D29'], label: 'Mortgage Insurance', format: pdf_formatCurrency },
                         { id: ['B30', 'C30', 'D30'], label: 'Property Insurance', format: pdf_formatCurrency },
                         { id: ['B31', 'C31', 'D31'], label: 'HOA', format: pdf_formatCurrency },
                         { id: ['B32', 'C32', 'D32'], label: 'Property Management', format: pdf_formatCurrency },
                         ...Array.from({ length: 9 }, (_, i) => i + 1).map(i => {
                             const name = pdf_getInputValue(`CFN${i}`).trim();
                             const valB = pdf_getInputValue(`CFB${i}`); const valC = pdf_getInputValue(`CFC${i}`); const valD = pdf_getInputValue(`CFD${i}`);
                             return (name && (valB || valC || valD)) ? { id: [`CFB${i}`, `CFC${i}`, `CFD${i}`], label: name, format: pdf_formatCurrency } : null;
                         }).filter(Boolean)
                    ]
                 },
                {
                    title: 'Revenue',
                     include: (() => { // Dynamically check if any revenue field is selected
                         const revenueIds = [
                              ...Array.from({length: 15}, (_, i) => [`B${33+i}`, `C${33+i}`, `D${33+i}`]), // Units
                              ...Array.from({length: 15}, (_, i) => [`B${48+i}`, `C${48+i}`, `D${48+i}`]), // Parking
                              ...Array.from({length: 9}, (_, i) => [`CFRB${i+1}`, `CFRC${i+1}`, `CFRD${i+1}`]) // Custom
                         ];
                         return revenueIds.some(id => selectedFields[Array.isArray(id) ? id.join(',') : id]);
                     })(),
                    layout: 'multiColumn',
                    fillColor: '#e6f7ff', // Light blue background
                    headerColor: '#cceeff', // Slightly darker blue header
                    inputs: [ // Same inputs as populatePDFFields
                        ...Array.from({ length: 15 }, (_, i) => { const idx = 33 + i; const vB=pdf_getInputValue(`B${idx}`);const vC=pdf_getInputValue(`C${idx}`);const vD=pdf_getInputValue(`D${idx}`); return (vB||vC||vD) ? { id: [`B${idx}`, `C${idx}`, `D${idx}`], label: `Unit ${i + 1}`, format: pdf_formatCurrency } : null; }).filter(Boolean),
                        ...Array.from({ length: 15 }, (_, i) => { const idx = 48 + i; const vB=pdf_getInputValue(`B${idx}`);const vC=pdf_getInputValue(`C${idx}`);const vD=pdf_getInputValue(`D${idx}`); return (vB||vC||vD) ? { id: [`B${idx}`, `C${idx}`, `D${idx}`], label: `Parking ${i + 1}`, format: pdf_formatCurrency } : null; }).filter(Boolean),
                        ...Array.from({ length: 9 }, (_, i) => i + 1).map(i => { const name = pdf_getInputValue(`CFRN${i}`).trim(); const vB=pdf_getInputValue(`CFRB${i}`);const vC=pdf_getInputValue(`CFRC${i}`);const vD=pdf_getInputValue(`CFRD${i}`); return (name&&(vB||vC||vD)) ? { id: [`CFRB${i}`, `CFRC${i}`, `CFRD${i}`], label: name, format: pdf_formatCurrency } : null; }).filter(Boolean)
                    ]
                 },
                  {
                     title: 'Totals & Summary',
                     // Check if any summary field is selected
                      include: isSectionSelected([ { id: ['B65','C65','D65'] }, { id: ['B64','C64','D64'] }, /* ... other summary IDs ... */ ]),
                     layout: 'multiColumn',
                     fillColor: '#f0f0f0', // Light grey background
                     headerColor: '#e0e0e0', // Darker grey header
                     inputs: [ // Same inputs as populatePDFFields
                         { id: ['B65', 'C65', 'D65'], label: 'Total Revenue/Month', format: pdf_formatCurrency },
                         { id: ['B64', 'C64', 'D64'], label: 'Total Expenses/Month', format: pdf_formatCurrency },
                         { id: ['B10', 'B10', 'B10'], label: 'Monthly P&I Payment', format: pdf_formatCurrency },
                         { id: ['NOI-min', 'NOI-max', 'NOI-avg'], label: 'Monthly NOI ($)', format: pdf_formatCurrency },
                         { id: ['B66', 'C66', 'D66'], label: 'Monthly Cash Flow ($)', format: pdf_formatCurrency },
                         { id: ['GRM-min', 'GRM-max', 'GRM-avg'], label: 'GRM (%)', format: pdf_formatPercentage },
                         { id: ['CR-min', 'CR-max', 'CR-avg'], label: 'Cap Rate (%)', format: pdf_formatPercentage },
                         { id: ['CCR-min', 'CCR-max', 'CCR-avg'], label: 'CoC Return (%)', format: pdf_formatPercentage },
                         { id: ['DSCR-min', 'DSCR-max', 'DSCR-avg'], label: 'DSCR (Ratio)', format: (val) => parseFloat(val).toFixed(2) },
                         { id: ['ROI-min', 'ROI-max', 'ROI-avg'], label: 'ROI', format: () => 'N/A' },
                         { id: ['IRR-min', 'IRR-max', 'IRR-avg'], label: 'IRR', format: () => 'N/A' }
                     ]
                 }
             ];


             // --- Generate PDF Content ---
             pdfSections.forEach(section => {
                 if (!section.include || !section.inputs || section.inputs.length === 0) return; // Skip section if not included or empty

                 if (section.layout === 'singleColumn') {
                     const tableBody = [
                         // Section Title Header Row
                         [{ text: section.title, style: 'sectionHeader', colSpan: 2, alignment: 'left', border: [false, false, false, true], margin: [0, 8, 0, 2] }, {}]
                         // Optional: Add 'Field'/'Value' headers if desired
                         // [{ text: 'Field', bold: true }, { text: 'Value', bold: true, alignment: 'right' }]
                     ];

                     section.inputs.forEach(input => {
                          const fieldId = input.id; // Single ID for this layout
                         if (selectedFields[fieldId]) { // Check if this specific field is selected
                             const rawValue = pdf_getInputValue(fieldId);
                             const formattedValue = input.format ? input.format(rawValue) : rawValue;
                             tableBody.push([
                                 { text: input.label, border: [false, false, false, false] }, // No borders for data rows
                                 { text: formattedValue, alignment: 'right', border: [false, false, false, false] }
                             ]);
                         }
                     });

                      if (tableBody.length > 1) { // Only add table if there's data besides header
                         content.push({
                             table: {
                                 widths: ['*', 'auto'],
                                 body: tableBody
                             },
                             layout: 'noBorders', // Use layout without cell borders
                             style: 'tableMargin'
                         });
                      }

                 } else if (section.layout === 'multiColumn') {
                      const tableBody = [
                         // Section Title Header Row
                         [{ text: section.title, style: 'sectionHeader', colSpan: 4, alignment: 'left', fillColor: section.headerColor || null, border: [true, true, true, true], margin:[0, 4, 0, 2] }, {}, {}, {}],
                         // Column Headers
                         [
                             { text: 'Metric', bold: true, fillColor: section.headerColor || null },
                             { text: 'Min', bold: true, alignment: 'center', fillColor: section.headerColor || null },
                             { text: 'Max', bold: true, alignment: 'center', fillColor: section.headerColor || null },
                             { text: 'Avg', bold: true, alignment: 'center', fillColor: section.headerColor || null }
                         ]
                     ];

                     section.inputs.forEach(input => {
                          const fieldId = input.id.join(','); // Joined ID for multi-column
                          if (selectedFields[fieldId]) { // Check if this row is selected
                              const values = input.id.map(id => pdf_getInputValue(id));
                              // Apply formatting to each value
                              const formattedValues = values.map(val => input.format ? input.format(val) : val);

                              tableBody.push([
                                  { text: input.label, fillColor: section.fillColor || null },
                                  { text: formattedValues[0], alignment: 'right', fillColor: section.fillColor || null },
                                  { text: formattedValues[1], alignment: 'right', fillColor: section.fillColor || null },
                                  { text: formattedValues[2], alignment: 'right', fillColor: section.fillColor || null }
                              ]);
                          }
                      });

                     if (tableBody.length > 2) { // Only add table if data exists besides headers
                         content.push({
                             table: {
                                 headerRows: 2,
                                 widths: ['*', 90, 90, 90], // Adjust widths as needed
                                 body: tableBody,
                             },
                             layout: { // Customize borders and padding
                                 hLineWidth: (i, node) => (i === 0 || i === 1 || i === 2 || i === node.table.body.length) ? 1 : 0.5, // Thicker top/header/bottom lines
                                 vLineWidth: (i, node) => (i === 0 || i === node.table.widths.length) ? 1 : 0.5,
                                 hLineColor: (i, node) => (i === 0 || i === 1 || i === 2 || i === node.table.body.length) ? '#666666' : '#cccccc',
                                 vLineColor: (i, node) => (i === 0 || i === node.table.widths.length) ? '#666666' : '#cccccc',
                                 paddingLeft: (i) => 5,
                                 paddingRight: (i) => 5,
                                 paddingTop: (i) => 4,
                                 paddingBottom: (i) => 4,
                             },
                             style: 'tableMargin'
                         });
                      }
                 }
             });


            // Document definition
            const docDefinition = {
                pageSize: 'A4',
                pageMargins: [30, 30, 30, 30], // Margins [left, top, right, bottom]
                content: content,
                styles: {
                    header: { fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 5] },
                    subheader: { fontSize: 12, alignment: 'center', margin: [0, 0, 0, 10], color: '#444' },
                    sectionHeader: { fontSize: 13, bold: true, margin: [0, 10, 0, 4] }, // Slightly smaller section headers
                    chartHeader: { fontSize: 12, bold: true, alignment: 'center', margin: [0, 0, 0, 5] }, // New style for chart headers
                    tableMargin: { margin: [0, 0, 0, 15] } // Add margin below tables
                },
                defaultStyle: { fontSize: 10 } // Smaller default font size
            };

            // Generate and download
            const address = pdf_getInputValue('autocomplete');
            const purchasePrice = pdf_getInputValue('B1');
            let fileName = 'property-analysis.pdf';
             if (address && address.trim() !== '') {
                 fileName = address.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '_analysis.pdf';
             } else if (purchasePrice && purchasePrice.trim() !== '') {
                 fileName = 'property_' + purchasePrice.replace(/[^0-9.]/g, '') + '_analysis.pdf';
             }

            try {
                pdfMake.createPdf(docDefinition).download(fileName);
                resetLoadingState();
            } catch (error) {
                console.error('Error generating PDF with pdfmake:', error);
                resetLoadingState();
            }
        }); // End processImage.then
    } catch (error) {
        console.error('Error in PDF generation setup:', error);
        resetLoadingState();
    }
}

// Add loading indicator during PDF generation
function showLoadingState() {
    const generateBtn = document.querySelector('#pdfPreviewModal button.btn-primary'); // Target button inside modal
    if (generateBtn) {
        generateBtn.disabled = true;
        generateBtn.dataset.originalText = generateBtn.textContent; // Store original text
        generateBtn.innerHTML = `<span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span> Generating...`;
    }
     // Also disable the main PDF button if needed
     const mainPdfButton = document.getElementById('savepdf');
      if (mainPdfButton) mainPdfButton.disabled = true;
}

function resetLoadingState() {
    const generateBtn = document.querySelector('#pdfPreviewModal button.btn-primary');
    if (generateBtn) {
        generateBtn.disabled = false;
        generateBtn.innerHTML = generateBtn.dataset.originalText || 'Generate PDF';
    }
    const mainPdfButton = document.getElementById('savepdf');
     if (mainPdfButton) mainPdfButton.disabled = false;
}

/**
 * Captures an HTML element (like a chart) as an image data URL using html2canvas.
 * @param {string} elementId The ID of the HTML element to capture.
 * @returns {Promise<string|null>} A promise that resolves with the data URL of the captured image, or null if the element is not found or capture fails.
 */
async function captureChartAsImage(elementId) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.warn(`Chart element with ID "${elementId}" not found.`);
        return null;
    }

    // Temporarily make the element visible if it's hidden, to ensure it renders correctly for html2canvas
    const originalDisplay = element.style.display;
    const originalVisibility = element.style.visibility;
    const originalPosition = element.style.position;

    element.style.display = 'block';
    element.style.visibility = 'visible';
    element.style.position = 'absolute'; // Take it out of flow to prevent layout shifts during capture

    try {
        const canvas = await html2canvas(element, {
            useCORS: true, // Important for images loaded from other origins
            allowTaint: true, // Allow tainting the canvas if cross-origin images are used
            backgroundColor: '#ffffff', // Set a background color for transparent areas
            scale: 2, // Increase scale for better resolution in PDF
            logging: false // Disable html2canvas logging
        });
        return canvas.toDataURL('image/png');
    } catch (error) {
        console.error(`Error capturing chart "${elementId}":`, error);
        return null;
    } finally {
        // Restore original styles
        element.style.display = originalDisplay;
        element.style.visibility = originalVisibility;
        element.style.position = originalPosition;
    }
}
