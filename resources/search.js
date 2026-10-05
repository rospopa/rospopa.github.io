(function () {
  'use strict';
  // Client-side search over a prebuilt index (/resources/search-index.json).
  // The index is regenerated with `node build-search-index.mjs` whenever
  // public page content changes. No network calls happen until the user
  // focuses or types in a search field.
  var INDEX_URL = '/resources/search-index.json';
  var indexPromise = null;

  function loadIndex() {
    if (!indexPromise) {
      indexPromise = fetch(INDEX_URL, { credentials: 'omit' }).then(function (response) {
        if (!response.ok) throw new Error('Search index request failed with status ' + response.status);
        return response.json();
      }).then(function (records) {
        return records.map(function (record) {
          return {
            page: record.p, url: record.u, heading: record.h, text: record.t,
            headingTokens: tokenize(record.h), pageTokens: tokenize(record.p), textTokens: tokenize(record.t)
          };
        });
      });
      indexPromise.catch(function () { indexPromise = null; });
    }
    return indexPromise;
  }

  function stem(token) {
    // Light suffix trimming so "assessor"/"assessments", "lease"/"leases",
    // "zoning"/"zone", and "county"/"counties" match each other.
    if (token.length <= 4) return token;
    return token.replace(/ies$/, 'y').replace(/(ments?|ors?|ings?|ions?|ally|al|ed|es|e|s)$/, '');
  }

  function tokenize(value) {
    return String(value || '').toLowerCase().split(/[^a-z0-9]+/)
      .filter(function (token) { return token.length > 1; })
      .map(stem);
  }

  function countMatches(tokens, query) {
    var count = 0;
    for (var i = 0; i < tokens.length; i++) {
      if (tokens[i] === query) count += 2;
      else if (tokens[i].indexOf(query) === 0 && query.length > 2) count += 1;
    }
    return count;
  }

  function search(records, query) {
    var queryTokens = tokenize(query);
    if (!queryTokens.length) return [];
    var scored = [];
    records.forEach(function (record) {
      var score = 0, matched = 0;
      queryTokens.forEach(function (token) {
        var heading = countMatches(record.headingTokens, token);
        var page = countMatches(record.pageTokens, token);
        var text = countMatches(record.textTokens, token);
        if (heading || page || text) matched++;
        score += heading * 6 + page * 3 + Math.min(text, 6);
      });
      if (matched) scored.push({ record: record, score: score, matched: matched });
    });
    var complete = scored.filter(function (item) { return item.matched === queryTokens.length; });
    var results = complete.length ? complete : scored;
    results.sort(function (a, b) { return b.score - a.score || a.record.page.localeCompare(b.record.page); });
    return results.map(function (item) { return item.record; });
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function escapeRegExp(value) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }

  function rawTokens(value) {
    return String(value || '').toLowerCase().split(/[^a-z0-9]+/).filter(function (token) { return token.length > 1; });
  }

  function highlight(text, query) {
    var tokens = rawTokens(query);
    var safe = escapeHtml(text);
    if (!tokens.length) return safe;
    var pattern = new RegExp('(' + tokens.map(escapeRegExp).join('|') + ')', 'gi');
    return safe.replace(pattern, '<mark>$1</mark>');
  }

  function snippet(text, query, length) {
    var lower = text.toLowerCase(), start = -1;
    rawTokens(query).forEach(function (token) {
      var at = lower.indexOf(token);
      if (at !== -1 && (start === -1 || at < start)) start = at;
    });
    if (start === -1) return text.slice(0, length) + (text.length > length ? '…' : '');
    var from = Math.max(0, start - Math.floor(length / 3));
    var piece = text.slice(from, from + length);
    return (from > 0 ? '…' : '') + piece + (from + length < text.length ? '…' : '');
  }

  function renderResult(record, query, snippetLength) {
    var isPageRecord = !record.heading || record.heading === record.page;
    return '<span class="search-result-page">' + escapeHtml(record.page) + '</span>' +
      '<span class="search-result-heading">' + highlight(isPageRecord ? record.page : record.heading, query) + '</span>' +
      '<span class="search-result-snippet">' + highlight(snippet(record.text, query, snippetLength), query) + '</span>';
  }

  // --- Header combobox ------------------------------------------------------
  function setupCombobox(form) {
    var input = form.querySelector('input.search-input');
    var listbox = form.querySelector('[role="listbox"]');
    var status = form.querySelector('.search-status');
    if (!input || !listbox) return;
    var activeIndex = -1, currentResults = [], timer;

    function close() {
      listbox.hidden = true;
      listbox.innerHTML = '';
      input.setAttribute('aria-expanded', 'false');
      input.removeAttribute('aria-activedescendant');
      activeIndex = -1;
      currentResults = [];
    }

    function announce(message) { if (status) status.textContent = message; }

    function setActive(index) {
      var options = listbox.querySelectorAll('[role="option"]');
      if (!options.length) return;
      activeIndex = (index + options.length) % options.length;
      options.forEach(function (option, i) {
        option.setAttribute('aria-selected', i === activeIndex ? 'true' : 'false');
      });
      input.setAttribute('aria-activedescendant', options[activeIndex].id);
      options[activeIndex].scrollIntoView({ block: 'nearest' });
    }

    function render(results, query) {
      currentResults = results.slice(0, 8);
      if (!currentResults.length) {
        listbox.innerHTML = '<div class="search-empty">No matches for “' + escapeHtml(query) + '”. <a href="/search/?q=' + encodeURIComponent(query) + '">Open the search page</a>.</div>';
        announce('No matches.');
      } else {
        listbox.innerHTML = currentResults.map(function (record, i) {
          return '<a role="option" id="site-search-option-' + i + '" aria-selected="false" href="' + escapeHtml(record.url) + '">' + renderResult(record, query, 110) + '</a>';
        }).join('') + '<a class="search-all" href="/search/?q=' + encodeURIComponent(query) + '">All results for “' + escapeHtml(query) + '” →</a>';
        announce(results.length + (results.length === 1 ? ' result.' : ' results.') + ' Use the up and down arrows to review them.');
      }
      listbox.hidden = false;
      input.setAttribute('aria-expanded', 'true');
      activeIndex = -1;
    }

    function run() {
      var query = input.value.trim();
      if (query.length < 2) { close(); return; }
      loadIndex().then(function (records) {
        if (input.value.trim() !== query) return;
        render(search(records, query), query);
      }).catch(function (error) {
        listbox.innerHTML = '<div class="search-empty" role="alert">Search is unavailable right now. <a href="/search/?q=' + encodeURIComponent(query) + '">Try the search page</a>.</div>';
        listbox.hidden = false;
        input.setAttribute('aria-expanded', 'true');
        console.error(error);
      });
    }

    input.addEventListener('input', function () { clearTimeout(timer); timer = setTimeout(run, 90); });
    input.addEventListener('focus', function () { loadIndex().catch(function () {}); if (input.value.trim().length >= 2) run(); });
    input.addEventListener('keydown', function (event) {
      if (event.key === 'ArrowDown') { event.preventDefault(); if (listbox.hidden) run(); else setActive(activeIndex + 1); }
      else if (event.key === 'ArrowUp') { event.preventDefault(); if (!listbox.hidden) setActive(activeIndex - 1); }
      else if (event.key === 'Escape') { if (!listbox.hidden) { event.preventDefault(); close(); } }
      else if (event.key === 'Enter' && activeIndex >= 0 && currentResults[activeIndex]) {
        event.preventDefault();
        window.location.href = currentResults[activeIndex].url;
      }
    });
    document.addEventListener('click', function (event) { if (!form.contains(event.target)) close(); });
    form.addEventListener('submit', function (event) { if (input.value.trim().length < 2) event.preventDefault(); });
  }

  // --- Full results page ----------------------------------------------------
  function setupResultsPage(container) {
    var params = new URLSearchParams(window.location.search);
    var query = (params.get('q') || '').trim();
    var heading = document.getElementById('search-heading');
    var pageInput = document.querySelector('.search-page-form input.search-input');
    if (pageInput && query) pageInput.value = query;
    if (!query) return;
    document.title = 'Search: ' + query + ' | Chicagoland Industrial';
    container.setAttribute('aria-busy', 'true');
    loadIndex().then(function (records) {
      var results = search(records, query);
      if (heading) heading.textContent = results.length + (results.length === 1 ? ' result for “' : ' results for “') + query + '”';
      container.innerHTML = results.length
        ? '<ol class="search-results-list">' + results.slice(0, 60).map(function (record) {
            return '<li><a href="' + escapeHtml(record.url) + '">' + renderResult(record, query, 220) + '</a></li>';
          }).join('') + '</ol>'
        : '<p>No guide sections match that search. Try a shorter word, a different term, or browse the guides below.</p>';
    }).catch(function (error) {
      if (heading) heading.textContent = 'Search is unavailable';
      container.innerHTML = '<p role="alert">The search index could not be loaded. Browse the guides below instead.</p>';
      console.error(error);
    }).then(function () { container.removeAttribute('aria-busy'); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('form.site-search').forEach(setupCombobox);
    var resultsPage = document.getElementById('search-results-page');
    if (resultsPage) setupResultsPage(resultsPage);
  });
}());
