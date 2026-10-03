(function () {
  'use strict';
  var root = document.documentElement;
  var themeColor = document.querySelector('meta[name="theme-color"]');
  var toggle;

  function applyTheme(dark) {
    root.dataset.theme = dark ? 'monochrome-dark' : 'monochrome';
    if (themeColor) themeColor.content = dark ? '#1e1e22' : '#ffffff';
    if (toggle) {
      var label = dark ? 'Day mode' : 'Night mode';
      toggle.setAttribute('aria-label', label);
      toggle.title = label;
    }
  }

  var savedTheme;
  try { savedTheme = localStorage.getItem('rep_theme'); } catch (error) {
    console.warn('Theme preference storage is unavailable; using day mode.', error);
  }
  applyTheme(savedTheme === 'dark');

  document.addEventListener('DOMContentLoaded', function () {
    toggle = document.querySelector('.theme-toggle');
    if (!toggle) return;
    applyTheme(root.dataset.theme === 'monochrome-dark');
    toggle.hidden = false;
    toggle.addEventListener('click', function () {
      var dark = root.dataset.theme !== 'monochrome-dark';
      applyTheme(dark);
      try { localStorage.setItem('rep_theme', dark ? 'dark' : 'light'); } catch (error) {
        console.warn('Theme changed for this page, but the preference could not be saved.', error);
      }
    });
  });

  window.addEventListener('storage', function (event) {
    if (event.key === 'rep_theme' || event.key === null) applyTheme(event.newValue === 'dark');
  });
}());
