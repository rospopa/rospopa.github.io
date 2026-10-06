(function () {
  'use strict';
  var root = document.documentElement;
  var themeColor = document.querySelector('meta[name="theme-color"]');
  var toggle;

  function applyTheme(dark) {
    root.dataset.theme = dark ? 'monochrome-dark' : 'monochrome';
    if (themeColor) themeColor.content = dark ? '#14251a' : '#ffffff';
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
  // Lets the CSS collapse the nav into the menu button before first paint; without JS the link strip stays.
  root.classList.add('has-menu');

  function setupMenu() {
    var button = document.querySelector('.menu-toggle');
    var nav = document.getElementById('site-nav');
    if (!button || !nav) { root.classList.remove('has-menu'); return; }
    var header = button.closest('.site-header');
    var desktop = window.matchMedia('(min-width: 1024px)');

    function setOpen(open, returnFocus) {
      header.classList.toggle('menu-open', open);
      button.setAttribute('aria-expanded', open ? 'true' : 'false');
      button.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
      if (!open && returnFocus) button.focus();
    }

    button.hidden = false;
    button.addEventListener('click', function () {
      var open = button.getAttribute('aria-expanded') !== 'true';
      setOpen(open);
      if (open) { var first = nav.querySelector('a'); if (first) first.focus(); }
    });
    nav.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && button.getAttribute('aria-expanded') === 'true') setOpen(false, true);
    });
    document.addEventListener('click', function (event) {
      if (button.getAttribute('aria-expanded') === 'true' && !header.contains(event.target)) setOpen(false);
    });
    var onChange = function () { if (desktop.matches) setOpen(false); };
    if (desktop.addEventListener) desktop.addEventListener('change', onChange); else desktop.addListener(onChange);
  }

  document.addEventListener('DOMContentLoaded', function () {
    setupMenu();
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
