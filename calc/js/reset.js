document.addEventListener('DOMContentLoaded', function() {
    const resetButton = document.getElementById('resetAll');
    
    resetButton.addEventListener('click', function() {
        // Reset all input fields
        const inputs = document.querySelectorAll('input');
        inputs.forEach(input => {
            input.value = '';
            // Trigger change event to update any dependent calculations
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        });

        // Reset all select elements
        const selects = document.querySelectorAll('select');
        selects.forEach(select => {
            select.selectedIndex = 0;
            // Trigger change event to update any dependent calculations
            const event = new Event('change', { bubbles: true });
            select.dispatchEvent(event);
        });

        // Reset any custom input formatting (like currency formatting)
        const currencyInputs = document.querySelectorAll('[data-type="currency"]');
        currencyInputs.forEach(input => {
            input.value = '';
            // Trigger change event to update any dependent calculations
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        });

        // Reset any percentage inputs
        const percentageInputs = document.querySelectorAll('[data-type="percentage"]');
        percentageInputs.forEach(input => {
            input.value = '';
            // Trigger change event to update any dependent calculations
            const event = new Event('change', { bubbles: true });
            input.dispatchEvent(event);
        });

        // Reset any calculated fields or displays
        const calculatedFields = document.querySelectorAll('[data-calculated="true"]');
        calculatedFields.forEach(field => {
            if (field.tagName === 'INPUT') {
                field.value = '';
            } else {
                field.textContent = '';
            }
        });

        // Clear localStorage cache
        localStorage.clear();

        // Clear sessionStorage cache
        sessionStorage.clear();

        // Show a success message to the user
        //alert('All fields have been reset successfully!');

        // Optionally reload the page to ensure a completely fresh state
        window.location.reload();
    });
});