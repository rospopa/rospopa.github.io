// Wait for the document to be fully loaded
document.addEventListener('DOMContentLoaded', function() {
    const { jsPDF } = window.jspdf;
    
    const pdfButton = document.getElementById('savepdf');
    if (!pdfButton) {
        console.error('PDF button not found');
        return;
    }

    pdfButton.addEventListener('click', function() {
        try {
            console.log('PDF button clicked');
            const element = document.getElementById('calculator');
            if (!element) {
                console.error('Element with id "calculator" not found');
                return;
            }

            // Create new jsPDF instance
            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Use html2canvas to capture the calculator div
            html2canvas(element, {
                scale: 2,
                useCORS: true,
                logging: true,
                backgroundColor: '#ffffff'
            }).then(canvas => {
                const imgData = canvas.toDataURL('image/jpeg', 1.0);
                
                // Get page dimensions (A4)
                const pageWidth = doc.internal.pageSize.getWidth();
                const pageHeight = doc.internal.pageSize.getHeight();
                
                // Set margins
                const margin = 6; // 15mm margins
                const maxWidth = pageWidth - (margin * 2);
                const maxHeight = pageHeight - (margin * 2);
                
                // Calculate dimensions to fit within margins while maintaining aspect ratio
                let imgWidth = maxWidth;
                let imgHeight = (canvas.height * maxWidth) / canvas.width;
                
                // If height is too large, scale based on height instead
                if (imgHeight > maxHeight) {
                    imgHeight = maxHeight;
                    imgWidth = (canvas.width * maxHeight) / canvas.height;
                }
                
                // Center the image on the page
                const x = (pageWidth - imgWidth) / 2;
                const y = (pageHeight - imgHeight) / 2;

                // Add the image to the PDF
                doc.addImage(imgData, 'JPEG', x, y, imgWidth, imgHeight);

                // Save the PDF
                doc.save('calculator.pdf');
                console.log('PDF generation completed');
            });
        } catch (error) {
            console.error('Error in PDF generation:', error);
        }
    });
});