(function () {
  'use strict';
  // Progressive enhancements for the public guides. Every widget works from
  // plain HTML that already reads correctly without JavaScript; this file only
  // adds live computation, remembered checklist state, filtering and
  // position tracking. No network requests, no dependencies.

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  var usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
  var num = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2 });
  var pct = function (v) { return isFinite(v) ? num.format(v) + '%' : '—'; };
  var money = function (v) { return isFinite(v) ? usd.format(v) : '—'; };
  var moneyCents = function (v) { return isFinite(v) ? usdCents.format(v) : '—'; };
  var ratio = function (v) { return isFinite(v) ? num.format(v) + 'x' : '—'; };

  function readNumber(form, name) {
    var field = form.elements[name];
    if (!field) return NaN;
    var value = parseFloat(String(field.value).replace(/[^0-9.\-]/g, ''));
    return isNaN(value) ? NaN : value;
  }
  function write(form, name, text) {
    var out = form.querySelector('output[name="' + name + '"]');
    if (out) out.textContent = text;
  }
  function storage(action, key, value) {
    try {
      if (action === 'get') return localStorage.getItem(key);
      if (action === 'set') localStorage.setItem(key, value);
      if (action === 'remove') localStorage.removeItem(key);
    } catch (error) { return null; }
    return null;
  }

  // --- Calculators -----------------------------------------------------------
  var calculators = {
    'cap-rate': function (form) {
      var noi = readNumber(form, 'noi'), cap = readNumber(form, 'cap'), price = readNumber(form, 'price');
      write(form, 'value', cap > 0 && noi >= 0 ? money(noi / (cap / 100)) : '—');
      write(form, 'impliedCap', price > 0 && noi >= 0 ? pct(noi / price * 100) : '—');
    },
    'dscr': function (form) {
      var noi = readNumber(form, 'noi'), loan = readNumber(form, 'loan'), rate = readNumber(form, 'rate'),
          years = readNumber(form, 'amort'), price = readNumber(form, 'price');
      var r = rate / 100 / 12, payment = NaN;
      if (loan > 0 && rate >= 0) {
        if (!(years > 0)) payment = loan * r;                                     // interest-only
        else if (r === 0) payment = loan / (years * 12);
        else payment = loan * r / (1 - Math.pow(1 + r, -years * 12));
      }
      var ads = payment * 12;
      write(form, 'payment', moneyCents(payment));
      write(form, 'ads', money(ads));
      write(form, 'dscr', ads > 0 && noi >= 0 ? ratio(noi / ads) : '—');
      write(form, 'cashflow', ads > 0 && noi >= 0 ? money(noi - ads) : '—');
      write(form, 'ltv', price > 0 && loan > 0 ? pct(loan / price * 100) : '—');
    },
    'occupancy': function (form) {
      var sf = readNumber(form, 'sf'), base = readNumber(form, 'base'), pass = readNumber(form, 'pass'),
          esc = readNumber(form, 'esc'), term = Math.round(readNumber(form, 'term'));
      if (!(sf > 0) || isNaN(base) || isNaN(pass)) { ['year1', 'monthly', 'final', 'total', 'average'].forEach(function (n) { write(form, n, '—'); }); return; }
      if (isNaN(esc)) esc = 0;
      if (!(term > 0)) term = 1;
      var year1 = sf * (base + pass), total = 0, finalBase = base;
      for (var y = 0; y < term; y++) { finalBase = base * Math.pow(1 + esc / 100, y); total += sf * (finalBase + pass); }
      write(form, 'year1', money(year1));
      write(form, 'monthly', money(year1 / 12));
      write(form, 'final', money(sf * (finalBase + pass)));
      write(form, 'total', money(total));
      write(form, 'average', money(total / term));
    },
    'exchange-deadline': function (form) {
      var field = form.elements.closing, text = field && field.value;
      var match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text || '');
      if (!match) { write(form, 'identify', '—'); write(form, 'complete', '—'); return; }
      var start = Date.UTC(+match[1], +match[2] - 1, +match[3]);
      var fmt = new Intl.DateTimeFormat('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'UTC' });
      write(form, 'identify', fmt.format(new Date(start + 45 * 86400000)));
      write(form, 'complete', fmt.format(new Date(start + 180 * 86400000)));
    }
  };

  function setupCalculator(form) {
    var compute = calculators[form.dataset.calc];
    if (!compute) return;
    form.addEventListener('submit', function (event) { event.preventDefault(); compute(form); });
    form.addEventListener('input', function () { compute(form); });
    form.classList.add('calc-ready');
    compute(form);
  }

  // --- Remembered checklists -------------------------------------------------
  function setupChecklist(table) {
    var id = table.dataset.checklist, key = 'rospopa:checklist:' + id;
    var rows = Array.prototype.slice.call(table.querySelectorAll('tbody tr'));
    if (!rows.length) return;
    var saved = [];
    try { saved = JSON.parse(storage('get', key) || '[]'); } catch (error) { saved = []; }
    var headRow = table.querySelector('thead tr');
    if (headRow) { var th = document.createElement('th'); th.scope = 'col'; th.className = 'check'; th.textContent = 'Done'; headRow.insertBefore(th, headRow.firstChild); }
    var caption = table.querySelector('caption');
    var tools = document.createElement('div');
    tools.className = 'checklist-tools';
    var status = document.createElement('p');
    status.className = 'checklist-status'; status.setAttribute('aria-live', 'polite');
    var reset = document.createElement('button');
    reset.type = 'button'; reset.className = 'btn btn-outline btn-small'; reset.textContent = 'Reset checklist';
    tools.appendChild(status); tools.appendChild(reset);
    var wrap = table.closest('.table-wrap') || table;
    wrap.parentNode.insertBefore(tools, wrap.nextSibling);

    function update() {
      var done = rows.filter(function (row) { return row.classList.contains('done'); }).length;
      status.textContent = done + ' of ' + rows.length + ' checked' + (done ? ' · saved in this browser' : '');
      storage('set', key, JSON.stringify(rows.map(function (row, i) { return row.classList.contains('done') ? i : -1; }).filter(function (i) { return i >= 0; })));
    }
    rows.forEach(function (row, i) {
      var cell = document.createElement('td'); cell.className = 'check';
      var box = document.createElement('input'); box.type = 'checkbox';
      var label = (row.querySelector('th, td') || {}).textContent || ('item ' + (i + 1));
      box.setAttribute('aria-label', 'Mark “' + label.trim() + '” done');
      box.checked = saved.indexOf(i) !== -1;
      row.classList.toggle('done', box.checked);
      box.addEventListener('change', function () { row.classList.toggle('done', box.checked); update(); });
      cell.appendChild(box);
      row.insertBefore(cell, row.firstChild);
    });
    reset.addEventListener('click', function () {
      rows.forEach(function (row) { row.classList.remove('done'); row.querySelector('input[type="checkbox"]').checked = false; });
      storage('remove', key); update();
      status.textContent = '0 of ' + rows.length + ' checked';
    });
    if (caption) caption.textContent += ' — tick items as you gather them';
    update();
  }

  // --- Glossary filter -------------------------------------------------------
  function setupGlossaryFilter(form) {
    var input = form.querySelector('input'), output = form.querySelector('output');
    var terms = Array.prototype.slice.call(document.querySelectorAll('dl.glossary dt')).map(function (dt) {
      var dd = dt.nextElementSibling;
      return { dt: dt, dd: dd, text: (dt.textContent + ' ' + (dd ? dd.textContent : '')).toLowerCase() };
    });
    var sections = Array.prototype.slice.call(document.querySelectorAll('main section'));
    form.hidden = false;
    function apply() {
      var q = input.value.trim().toLowerCase(), shown = 0;
      terms.forEach(function (t) {
        var hit = !q || t.text.indexOf(q) !== -1;
        t.dt.hidden = !hit; if (t.dd) t.dd.hidden = !hit; if (hit) shown++;
      });
      sections.forEach(function (section) {
        var list = section.querySelector('dl.glossary'); if (!list) return;
        section.hidden = !!q && !list.querySelector('dt:not([hidden])');
      });
      output.textContent = q ? shown + ' of ' + terms.length + ' terms match “' + input.value.trim() + '”' : terms.length + ' terms';
    }
    input.addEventListener('input', apply);
    input.addEventListener('keydown', function (event) { if (event.key === 'Escape') { input.value = ''; apply(); } });
    form.addEventListener('submit', function (event) { event.preventDefault(); apply(); });
    apply();
  }

  // --- Position tracking for tables of contents and county chips ------------
  function setupScrollSpy() {
    var links = Array.prototype.slice.call(document.querySelectorAll('.toc a[href^="#"], .chips a[href^="#"]'));
    if (!links.length) return;
    var targets = links.map(function (link) { return document.getElementById(decodeURIComponent(link.getAttribute('href').slice(1))); });
    var ticking = false;
    function update() {
      ticking = false;
      var offset = (window.matchMedia('(min-width: 1024px)').matches ? 90 : 24), current = -1;
      targets.forEach(function (el, i) { if (el && el.getBoundingClientRect().top - offset <= 0) current = i; });
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 2) current = targets.length - 1;
      links.forEach(function (link, i) {
        var same = targets[i] && current >= 0 && targets[i] === targets[current];
        if (same) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
      });
    }
    function schedule() { if (!ticking) { ticking = true; window.requestAnimationFrame(update); } }
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    update();
  }

  // --- Auto-scrolling headline carousel --------------------------------------
  function setupCarousel(root) {
    var track = root.querySelector('.news-track'), prev = root.querySelector('.prev'), next = root.querySelector('.next');
    if (!track || track.children.length < 2) return;
    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    var timer = null, paused = false;
    function step() { var card = track.firstElementChild; return card ? card.getBoundingClientRect().width + parseFloat(getComputedStyle(track).columnGap || getComputedStyle(track).gap || '16') : 300; }
    function atEnd() { return track.scrollLeft + track.clientWidth >= track.scrollWidth - 4; }
    function go(direction) {
      if (direction > 0 && atEnd()) track.scrollTo({ left: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
      else track.scrollBy({ left: direction * step(), behavior: reduceMotion.matches ? 'auto' : 'smooth' });
    }
    function start() { stop(); if (reduceMotion.matches || paused || document.hidden) return; timer = setInterval(function () { go(1); }, 6000); }
    function stop() { if (timer) { clearInterval(timer); timer = null; } }
    prev.hidden = next.hidden = false;
    prev.addEventListener('click', function () { go(-1); start(); });
    next.addEventListener('click', function () { go(1); start(); });
    ['pointerenter', 'focusin', 'touchstart'].forEach(function (type) { root.addEventListener(type, function () { paused = true; stop(); }, { passive: true }); });
    ['pointerleave', 'focusout'].forEach(function (type) { root.addEventListener(type, function () { paused = false; start(); }); });
    track.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowRight') { event.preventDefault(); go(1); }
      if (event.key === 'ArrowLeft') { event.preventDefault(); go(-1); }
    });
    document.addEventListener('visibilitychange', start);
    reduceMotion.addEventListener('change', start);
    root.classList.add('carousel-ready');
    start();
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form[data-calc]').forEach(setupCalculator);
    document.querySelectorAll('table[data-checklist]').forEach(setupChecklist);
    document.querySelectorAll('form[data-glossary-filter]').forEach(setupGlossaryFilter);
    document.querySelectorAll('[data-carousel]').forEach(setupCarousel);
    setupScrollSpy();
  });
}());
