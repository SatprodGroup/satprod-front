/* Satprod site behaviour: theme, mobile nav, reveal fallback, card glow, contact form. */
(function () {
  'use strict';

  var root = document.documentElement;
  root.classList.remove('no-js');

  function store (key, value) {
    try {
      if (value === undefined) return localStorage.getItem(key);
      localStorage.setItem(key, value);
    } catch (e) { return null; }
  }

  /* ---------- theme ---------- */
  var toggle = document.querySelector('.theme-toggle');
  if (toggle) {
    toggle.addEventListener('click', function () {
      var current = root.dataset.theme ||
        (matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = current === 'dark' ? 'light' : 'dark';
      var apply = function () { root.dataset.theme = next; };
      if (document.startViewTransition && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.startViewTransition(apply);
      } else {
        apply();
      }
      store('theme', next);
    });
  }

  /* ---------- mobile nav ---------- */
  var header = document.querySelector('.site-header');
  var menuBtn = document.querySelector('.menu-toggle');
  if (header && menuBtn) {
    var setOpen = function (open) {
      header.toggleAttribute('data-open', open);
      menuBtn.setAttribute('aria-expanded', String(open));
    };
    menuBtn.addEventListener('click', function () { setOpen(!header.hasAttribute('data-open')); });
    header.querySelectorAll('.nav a').forEach(function (a) {
      a.addEventListener('click', function () { setOpen(false); });
    });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') setOpen(false); });
  }

  /* ---------- footer year ---------- */
  document.querySelectorAll('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });

  /* ---------- reveal (fallback when scroll-driven animations are unsupported) ---------- */
  var reveals = document.querySelectorAll('.reveal');
  if (!(window.CSS && CSS.supports('animation-timeline: view()'))) {
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      }, { rootMargin: '0px 0px -10% 0px' });
      reveals.forEach(function (el) { io.observe(el); });
    } else {
      reveals.forEach(function (el) { el.classList.add('is-in'); });
    }
  }

  /* ---------- pointer glow on cards ---------- */
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('pointermove', function (e) {
      var r = card.getBoundingClientRect();
      card.style.setProperty('--mx', (e.clientX - r.left) + 'px');
      card.style.setProperty('--my', (e.clientY - r.top) + 'px');
    });
  });

  /* ---------- contact form ---------- */
  var box = document.querySelector('[data-contact]');
  if (box) {
    var form = box.querySelector('form');
    var fields = form.elements;
    var status = box.querySelector('.status');
    var submit = form.querySelector('[type="submit"]');
    var label = submit.querySelector('span');
    var idle = label.textContent;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (fields.website.value) return; // honeypot
      submit.disabled = true;
      label.textContent = 'Sending...';
      status.removeAttribute('data-kind');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          message: fields.message.value.trim()
        })
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        box.dataset.state = 'sent';
        form.reset();
        var sent = box.querySelector('.sent h2');
        if (sent) sent.focus();
      }).catch(function () {
        status.dataset.kind = 'error';
        status.textContent = 'Something went wrong while sending your message. Please try again, or email us directly at info@satprod.net.';
      }).then(function () {
        submit.disabled = false;
        label.textContent = idle;
      });
    });

    box.querySelector('[data-reset]').addEventListener('click', function () {
      delete box.dataset.state;
      fields.name.focus();
    });
  }
})();

/* ---------- work gallery ---------- */
(function () {
  'use strict';
  var dialog = document.querySelector('.work-dialog');
  if (!dialog || typeof dialog.showModal !== 'function') return;
  var title = dialog.querySelector('#dlg-title');
  var body = dialog.querySelector('.dlg-body');

  function open (card, updateHash) {
    title.textContent = card.querySelector('.work-title').textContent;
    body.replaceChildren(card.querySelector('template').content.cloneNode(true));
    var gallery = body.querySelector('.dlg-gallery');
    if (gallery.children.length > 1) {
      var hint = document.createElement('p');
      hint.className = 'dlg-hint';
      hint.textContent = gallery.children.length + ' images, swipe or use the arrow keys';
      body.appendChild(hint);
    }
    dialog.dataset.slug = card.id;
    dialog.showModal();
    if (updateHash) history.replaceState(null, '', '#' + card.id);
  }

  document.querySelectorAll('.work-card').forEach(function (card) {
    card.querySelector('.work-open').addEventListener('click', function () {
      // On the home page, the full list lives on /work/: open the dialog here anyway.
      open(card, location.pathname.indexOf('/work') === 0);
    });
  });

  dialog.querySelector('.dlg-close').addEventListener('click', function () { dialog.close(); });
  dialog.addEventListener('click', function (e) { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', function () {
    if (location.hash) history.replaceState(null, '', location.pathname);
    var card = document.getElementById(dialog.dataset.slug);
    if (card) card.querySelector('.work-open').focus();
  });
  dialog.addEventListener('keydown', function (e) {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    var g = dialog.querySelector('.dlg-gallery');
    if (!g) return;
    e.preventDefault();
    g.scrollBy({ left: (e.key === 'ArrowRight' ? 1 : -1) * g.clientWidth, behavior: 'smooth' });
  });

  // Deep link: /work/#royal-tervuren-app opens that project.
  var target = location.hash && document.getElementById(location.hash.slice(1));
  if (target && target.classList.contains('work-card')) open(target, false);
})();
