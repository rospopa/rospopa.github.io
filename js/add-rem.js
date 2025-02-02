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
        lastRow.querySelectorAll("input").forEach(input => input.value = "");
      }
    });
  }

  // Налаштування для Unit
  setupRowControls("addRowU", "removeRowU", "unit-row");

  // Налаштування для Parking
  setupRowControls("addRowP", "removeRowP", "park-row");
});
