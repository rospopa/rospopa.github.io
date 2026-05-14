const checkboxA8 = document.getElementById('A8');
const inputA9 = document.getElementById('A9');
const dailyBasedSpanInLabelA10 = document.querySelector('label[for="A10"] span.dailyBasedSpan');

checkboxA8.addEventListener('change', function() {
    if (checkboxA8.checked) {
        inputA9.removeAttribute('disabled');
        dailyBasedSpanInLabelA10.textContent = ' (Percentage-Based)';
    } else {
        inputA9.setAttribute('disabled', '');
        dailyBasedSpanInLabelA10.textContent = ' (Daily-Based)';
    }
});

if (!checkboxA8.checked) {
    inputA9.setAttribute('disabled', '');
    dailyBasedSpanInLabelA10.textContent = ' (Daily-Based)';
} else {
    dailyBasedSpanInLabelA10.textContent = ' (Percentage-Based)';
}