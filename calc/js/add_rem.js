document.addEventListener("DOMContentLoaded", function () {
  function setupRowControls(addBtnId, removeBtnId, rowClass) {
    const addBtn = document.getElementById(addBtnId);
    const removeBtn = document.getElementById(removeBtnId);
    const rows = document.querySelectorAll("." + rowClass);
    let visibleRows = 0; // Скільки рядків відкрито

    // Показати наступний рядок
    addBtn.addEventListener("click", function () {
      if (visibleRows < rows.length) {
        rows[visibleRows].style.display = "table-row";
        visibleRows++;
      }
    });

    // Приховати останній відкритий рядок та очистити інпути
    removeBtn.addEventListener("click", function () {
      if (visibleRows > 0) {
        visibleRows--;
        let lastRow = rows[visibleRows];
        lastRow.style.display = "none";
        
        // Очистка input у прихованому рядку
        const inputs = lastRow.querySelectorAll("input");
        inputs.forEach(input => {
          const oldValue = input.value;
          input.value = "";
          
          // Only trigger update if the value actually changed
          if (oldValue !== "") {
            // Trigger input event to update calculations
            input.dispatchEvent(new Event('input', {
              bubbles: true,
              cancelable: true
            }));
          }
        });

        // If any values were cleared, ensure calculations are updated
        if (inputs.length > 0) {
          // Use the debounced calculation function
          const calculator = document.querySelector('[data-type="currency"]');
          if (calculator) {
            calculator.dispatchEvent(new Event('input', {
              bubbles: true,
              cancelable: true
            }));
          }
        }
      }
    });
  }

  // Налаштування для Unit
  setupRowControls("addRowU", "removeRowU", "unit-row");

  // Налаштування для Parking
  setupRowControls("addRowP", "removeRowP", "park-row");

  // Налаштування для Custom
  setupRowControls("addRowC", "removeRowC", "cust-row");
    
  // Налаштування для Custom Revenue
  setupRowControls("addRowCR", "removeRowCR", "cust_reve-row");
});
