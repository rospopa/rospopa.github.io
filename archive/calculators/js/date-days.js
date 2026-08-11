document.addEventListener('DOMContentLoaded', function() {
    const dateInput = document.getElementById('B4');
    const resultInput = document.getElementById('A4');

    dateInput.addEventListener('change', function() {
        const selectedDate = new Date(dateInput.value);

        if (isNaN(selectedDate)) {
            resultInput.value = ""; // Або можна залишити поле пустим, resultInput.value = "";
            return;
        }

        const currentYear = selectedDate.getFullYear();
        const lastDayOfYear = new Date(currentYear, 11, 31); // 11 - це грудень (місяці в JavaScript 0-індексовані)

        // Обчислюємо різницю в мілісекундах, потім переводимо в дні
        const differenceInTime = lastDayOfYear.getTime() - selectedDate.getTime();
        const differenceInDays = Math.ceil(differenceInTime / (1000 * 3600 * 24));

        resultInput.value = differenceInDays;
    });
});