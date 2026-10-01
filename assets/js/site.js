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

    // Preselect the topic when arriving from a service or a use case (?topic=networks).
    var topic = fields.topic;
    var wanted = new URLSearchParams(location.search).get('topic');
    if (topic && wanted && topic.querySelector('option[value="' + wanted.replace(/[^a-z]/g, '') + '"]')) topic.value = wanted;

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (fields.website.value) return; // honeypot
      submit.disabled = true;
      label.textContent = form.dataset.sending || 'Sending...';
      status.removeAttribute('data-kind');

      fetch(form.action, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json;charset=utf-8' },
        body: JSON.stringify({
          name: fields.name.value.trim(),
          email: fields.email.value.trim(),
          message: (topic && topic.value ? '[' + topic.options[topic.selectedIndex].text + ']\n\n' : '') + fields.message.value.trim()
        })
      }).then(function (res) {
        if (!res.ok) throw new Error(res.status);
        box.dataset.state = 'sent';
        form.reset();
        var sent = box.querySelector('.sent h2');
        if (sent) sent.focus();
      }).catch(function () {
        status.dataset.kind = 'error';
        status.textContent = form.dataset.error || 'Something went wrong while sending your message. Please try again, or email us directly at info@satprod.net.';
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
