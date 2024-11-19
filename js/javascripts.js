window.onload = function () {
/* When your mouse cursor enter the background, the fading won't pause and keep playing */ 
$('.carousel').carousel({
    pause: "false" /* Change to true to make it paused when your mouse cursor enter the background */
});
jQuery(document).ready(function ($) {
    if (jQuery("*").hasClass('type-text')) {
        var self_1 = jQuery(".type-text");
        var txt2 = self_1.html();
        var tot = txt2.length;
        var ch = 0;
        function typeIt() {
            if (ch > tot)
                return;
            ch++;
            if (txt2[ch] == "<")
                ch = ch + 5;
            if (txt2[ch] == "&")
                ch = ch + 4;
            self_1.html(txt2.substring(0, ch));
            setTimeout(typeIt, 40);
        }
        typeIt();
    }
});
jQuery(document).ready(function ($) {
    // Показати елемент через 500 мс після завантаження сторінки
    setTimeout(function () {
        $('.type-text').css('opacity', '1');
    }, 250); // Затримка у 500 мс (можна змінити за потреби)
});
};
document.addEventListener('DOMContentLoaded', function() {
  const soundIcon = document.querySelector('.sound-icon');
  const videoElement = document.querySelector('.carousel-video');

  soundIcon.addEventListener('click', function() {
    if (videoElement.muted) {
      videoElement.muted = false;
      soundIcon.classList.remove('fa-volume-off');
      soundIcon.classList.add('fa-volume-up');
    } else {
      videoElement.muted = true;
      soundIcon.classList.remove('fa-volume-up');
      soundIcon.classList.add('fa-volume-off');
    }
  });
});
