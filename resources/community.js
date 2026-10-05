/* Members' board on /resources/community/. Reading is open to everyone;
   asking and answering need a secure.rospopa.com account. The page keeps a
   static fallback (sign-in link) when the workspace API cannot be reached. */
(function () {
  'use strict';
  var API = 'https://secure.rospopa.com/api/community';
  var SIGN_IN = 'https://secure.rospopa.com/#community';
  var LIVE_KEY = 'rp-board-live';
  var CATEGORIES = [
    ['general', 'General'], ['buying', 'Buying and investing'], ['leasing', 'Leasing and tenants'],
    ['building', 'Building and operations'], ['taxes', 'Illinois taxes and incentives'],
    ['financing', 'Financing'], ['selling', 'Selling and exit']
  ];

  function el(tag, attrs, children) {
    var node = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') node.textContent = attrs[k];
      else if (k === 'class') node.className = attrs[k];
      else node.setAttribute(k, attrs[k]);
    });
    (children || []).forEach(function (c) { if (c) node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return node;
  }

  function paragraphs(text) {
    var frag = document.createDocumentFragment();
    String(text || '').split(/\n{2,}/).forEach(function (p) {
      var para = el('p', { class: 'member-text' });
      p.split('\n').forEach(function (line, i) {
        if (i) para.appendChild(document.createElement('br'));
        para.appendChild(document.createTextNode(line));
      });
      frag.appendChild(para);
    });
    return frag;
  }

  function date(ts) {
    try { return new Date(ts).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }); } catch (e) { return ''; }
  }

  function request(path, options) {
    var opts = options || {};
    var controller = 'AbortController' in window ? new AbortController() : null;
    var timer = controller && setTimeout(function () { controller.abort(); }, 12000);
    var init = { credentials: 'include', method: opts.method || 'GET', headers: { Accept: 'application/json' } };
    if (controller) init.signal = controller.signal;
    if (opts.body) { init.headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(API + path, init).then(function (res) {
      if (timer) clearTimeout(timer);
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) { var err = new Error(data.error || 'Request failed (' + res.status + ')'); err.status = res.status; throw err; }
        return data;
      });
    });
  }

  function setup(root) {
    var status = root.querySelector('[data-board-status]');
    var list = el('ol', { class: 'member-threads', 'aria-live': 'polite' });
    var toolbar = el('div', { class: 'member-toolbar' });
    var user = null;

    function say(text, isError) {
      status.textContent = text;
      status.classList.toggle('is-error', !!isError);
    }

    function signInLink(text) {
      return el('a', { class: 'btn', href: SIGN_IN, rel: 'noopener', text: text || 'Sign in to ask or answer' });
    }

    function field(label, control) {
      return el('label', { class: 'member-field' }, [el('span', { text: label }), control]);
    }

    function askForm() {
      var select = el('select', { name: 'category' });
      CATEGORIES.forEach(function (c) { select.appendChild(el('option', { value: c[0], text: c[1] })); });
      var title = el('input', { name: 'title', type: 'text', maxlength: '160', minlength: '8', required: '', autocomplete: 'off' });
      var body = el('textarea', { name: 'body', rows: '5', maxlength: '5000', minlength: '10', required: '' });
      var msg = el('p', { class: 'member-msg', role: 'status' });
      var submit = el('button', { type: 'submit', class: 'btn', text: 'Post question' });
      var form = el('form', { class: 'member-form', 'aria-label': 'Ask the community' }, [
        el('p', { class: 'member-note', text: 'Posting as ' + user.name + '. Your question is public. Please leave out confidential deal details.' }),
        field('Topic', select), field('Question', title), field('Details', body), msg,
        el('p', { class: 'member-actions' }, [submit])
      ]);
      form.hidden = true;
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit.disabled = true; msg.textContent = 'Posting…';
        request('/threads', { method: 'POST', body: { category: select.value, title: title.value, body: body.value } })
          .then(function () { form.reset(); form.hidden = true; msg.textContent = ''; loadThreads(); })
          .catch(function (err) { msg.textContent = err.message; })
          .then(function () { submit.disabled = false; });
      });
      return form;
    }

    function renderToolbar() {
      toolbar.textContent = '';
      if (user) {
        var form = askForm();
        var ask = el('button', { type: 'button', class: 'btn', 'aria-expanded': 'false', text: 'Ask a question' });
        ask.addEventListener('click', function () {
          form.hidden = !form.hidden;
          ask.setAttribute('aria-expanded', String(!form.hidden));
          if (!form.hidden) form.querySelector('input').focus();
        });
        toolbar.appendChild(el('p', { class: 'member-signed-in' }, ['Signed in as ', el('strong', { text: user.name }), ' ', ask]));
        toolbar.appendChild(form);
      } else {
        toolbar.appendChild(el('p', { class: 'member-signed-out' }, ['Have a secure.rospopa.com account? ', signInLink(), ' Then return to this page.']));
      }
    }

    function replyForm(threadId, onDone) {
      var body = el('textarea', { name: 'body', rows: '4', maxlength: '5000', minlength: '2', required: '' });
      var msg = el('p', { class: 'member-msg', role: 'status' });
      var submit = el('button', { type: 'submit', class: 'btn btn-small', text: 'Post answer' });
      var form = el('form', { class: 'member-form', 'aria-label': 'Answer this question' }, [field('Your answer', body), msg, el('p', { class: 'member-actions' }, [submit])]);
      form.addEventListener('submit', function (e) {
        e.preventDefault();
        submit.disabled = true; msg.textContent = 'Posting…';
        request('/threads/' + threadId + '/replies', { method: 'POST', body: { body: body.value } })
          .then(function () { onDone(); })
          .catch(function (err) { msg.textContent = err.message; submit.disabled = false; });
      });
      return form;
    }

    function openThread(item, t, toggle) {
      var detail = item.querySelector('.member-detail');
      if (detail) { detail.remove(); toggle.setAttribute('aria-expanded', 'false'); return; }
      detail = el('div', { class: 'member-detail' }, [el('p', { class: 'member-msg', text: 'Loading…' })]);
      item.appendChild(detail);
      toggle.setAttribute('aria-expanded', 'true');
      function load() {
        request('/threads/' + t.id).then(function (data) {
          detail.textContent = '';
          detail.appendChild(paragraphs(data.thread.body));
          data.replies.forEach(function (r) {
            var head = el('div', { class: 'post-head' }, [el('span', { class: 'post-author' }, [el('strong', { text: r.author }), r.authorIsAdmin ? el('span', { class: 'post-role', text: ' Site author' }) : null, el('span', { class: 'post-role', text: ' · ' + date(r.createdAt) })])]);
            if (r.accepted) head.appendChild(el('span', { class: 'post-badge', text: 'Accepted answer' }));
            var post = el('div', { class: 'post' + (r.accepted ? ' post-accepted' : '') }, [head]);
            post.appendChild(paragraphs(r.body));
            detail.appendChild(post);
          });
          if (!data.replies.length) detail.appendChild(el('p', { class: 'member-msg', text: 'No answers yet.' }));
          if (user) detail.appendChild(replyForm(t.id, function () { load(); loadThreads(true); }));
          else detail.appendChild(el('p', {}, [signInLink('Sign in to answer')]));
        }).catch(function (err) { detail.textContent = ''; detail.appendChild(el('p', { class: 'member-msg is-error', text: err.message })); });
      }
      load();
    }

    function renderThreads(threads) {
      list.textContent = '';
      threads.forEach(function (t) {
        var toggle = el('button', { type: 'button', class: 'member-title', 'aria-expanded': 'false', text: t.title });
        var meta = el('p', { class: 'thread-meta', text: t.categoryTitle + ' · Asked by ' + t.author + ' · ' + date(t.createdAt) + ' · ' + t.replyCount + (t.replyCount === 1 ? ' answer' : ' answers') + (t.answered ? ' · Answered' : '') });
        var item = el('li', { class: 'member-thread' + (t.answered ? ' is-answered' : '') }, [toggle, meta, el('p', { class: 'member-excerpt', text: t.excerpt })]);
        toggle.addEventListener('click', function () { openThread(item, t, toggle); });
        list.appendChild(item);
      });
    }

    function loadThreads(quiet) {
      if (!quiet) say('Loading member questions…');
      return request('/threads?limit=30').then(function (data) {
        renderThreads(data.threads);
        say(data.threads.length ? data.threads.length + (data.threads.length === 1 ? ' member question' : ' member questions') + ', newest activity first.' : 'No member questions yet. ' + (user ? 'Be the first to ask.' : 'Sign in to ask the first one.'));
      });
    }

    function remember(ok) {
      try { if (ok) localStorage.setItem(LIVE_KEY, '1'); else localStorage.removeItem(LIVE_KEY); } catch (e) { /* storage blocked */ }
    }

    function start() {
      if (loadButton) loadButton.remove();
      request('/me')
        .then(function (data) { user = data.user; })
        .catch(function () { user = null; })
        .then(function () {
          return loadThreads().then(function () {
            root.querySelector('[data-board-fallback]').hidden = true;
            renderToolbar();
            root.appendChild(toolbar);
            root.appendChild(list);
            root.classList.add('is-live');
            remember(true);
          });
        })
        .catch(function () {
          remember(false);
          say('The member board could not be loaded here right now. Members can read and post from their workspace.', true);
        });
    }

    // The workspace sits behind a bot check, so only call it on request or
    // once this browser has loaded the board successfully before.
    var loadButton = null;
    var seen = false;
    try { seen = localStorage.getItem(LIVE_KEY) === '1'; } catch (e) { /* storage blocked */ }
    if (seen) { start(); return; }
    loadButton = el('button', { type: 'button', class: 'btn board-load', text: 'Load member posts here' });
    loadButton.setAttribute('data-board-load', '');
    loadButton.addEventListener('click', start);
    say('Members who are signed in to the workspace can load the live board on this page.');
    status.insertAdjacentElement('afterend', loadButton);
  }

  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-community-board]').forEach(setup);
  });
}());
