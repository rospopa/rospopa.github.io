document.addEventListener('DOMContentLoaded', function() {
  const termsPeriodSelect = document.getElementById('TermsPeriod');
  const termSpan = document.getElementById('Term');

  termsPeriodSelect.addEventListener('change', function() {
    termSpan.textContent = this.value;
  });

  // Set initial value on page load
  termSpan.textContent = termsPeriodSelect.value;
});