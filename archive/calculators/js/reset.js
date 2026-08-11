document.addEventListener('DOMContentLoaded', function() {
    const resetButton = document.getElementById('resetAllfield');
    
    // Перевіряємо, чи існує кнопка на сторінці
    if (resetButton) {
        
        // Функція для розрахунку дистанції (з reset-btn.js)
        function distance(x1, y1, x2, y2) {
            var dx = x1 - x2;
            var dy = y1 - y2;
            return Math.sqrt(dx * dx + dy * dy);
        }

        resetButton.addEventListener('click', function(event) {
            // --- ЧАСТИНА 1: Візуальна анімація (з reset-btn.js) ---
            var mx = event.clientX - resetButton.offsetLeft;
            var my = event.clientY - resetButton.offsetTop;

            var w = resetButton.offsetWidth;
            var h = resetButton.offsetHeight;
            
            var directions = [
                { id: 'top', x: w/2, y: 0 },
                { id: 'right', x: w, y: h/2 },
                { id: 'bottom', x: w/2, y: h },
                { id: 'left', x: 0, y: h/2 }
            ];
            
            directions.sort(function(a, b) {
                return distance(mx, my, a.x, a.y) - distance(mx, my, b.x, b.y);
            });
            
            resetButton.setAttribute('data-direction', directions.shift().id);
            resetButton.classList.add('is-open');

            // --- ЧАСТИНА 2: Очищення даних (з reset.js) ---
            
            // Reset all input fields
            const inputs = document.querySelectorAll('input');
            inputs.forEach(input => {
                input.value = '';
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            });

            // Reset all select elements
            const selects = document.querySelectorAll('select');
            selects.forEach(select => {
                select.selectedIndex = 0;
                const event = new Event('change', { bubbles: true });
                select.dispatchEvent(event);
            });

            // Reset any custom input formatting
            const currencyInputs = document.querySelectorAll('[data-type="currency"]');
            currencyInputs.forEach(input => {
                input.value = '';
                const event = new Event('change', { bubbles: true });
                input.dispatchEvent(event);
            });

            // Reset any percentage inputs
            const percentageInputs = document.querySelectorAll('[data-type="percentage"]');
            percentageInputs.forEach(input => {
                input.value = '';
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

            // Clear localStorage & sessionStorage
            localStorage.clear();
            sessionStorage.clear();

            // --- ЧАСТИНА 3: Перезавантаження ---
            // Чекаємо 500мс, щоб анімація (is-open) встигла відобразитись перед перезавантаженням
            setTimeout(function() {
                window.location.reload();
            }, 500); 
        });
    }
});