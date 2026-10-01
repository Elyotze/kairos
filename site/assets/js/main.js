/* Kairos · page d'accueil : carrousel des modules. */
(function () {
  'use strict';
  var track = document.getElementById('kx-track');
  var box = document.getElementById('kx-carousel');
  if (!track || !box) return;
  var slides = Array.prototype.slice.call(track.children);
  var dots = Array.prototype.slice.call(document.querySelectorAll('[data-slide]'));
  var label = document.getElementById('kx-slide-label');
  var n = slides.length;
  var current = 0;
  var manual = false;
  var hover = false;

  function pad(i) { return (i < 10 ? '0' : '') + i; }

  function go(i, byUser) {
    current = (i + n) % n;
    if (byUser) manual = true;
    track.style.transform = 'translateX(-' + current * 100 + '%)';
    if (label) label.textContent = pad(current + 1) + ' / ' + pad(n);
    slides.forEach(function (el, j) {
      el.setAttribute('aria-hidden', j === current ? 'false' : 'true');
    });
    dots.forEach(function (d, j) {
      d.setAttribute('aria-current', j === current ? 'true' : 'false');
    });
  }

  var prev = document.getElementById('kx-prev');
  var next = document.getElementById('kx-next');
  if (prev) prev.addEventListener('click', function () { go(current - 1, true); });
  if (next) next.addEventListener('click', function () { go(current + 1, true); });
  dots.forEach(function (d) {
    d.addEventListener('click', function () { go(+d.getAttribute('data-slide'), true); });
  });

  // pause on hover or keyboard focus inside the carousel
  box.addEventListener('mouseenter', function () { hover = true; });
  box.addEventListener('mouseleave', function () { hover = false; });
  box.addEventListener('focusin', function () { hover = true; });
  box.addEventListener('focusout', function () { hover = false; });

  // swipe on touch screens
  var x0 = null;
  box.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  box.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 48) go(current + (dx < 0 ? 1 : -1), true);
    x0 = null;
  }, { passive: true });

  window.setInterval(function () {
    if (manual || hover || document.hidden) return;
    if (window.kxMotionOn && !window.kxMotionOn()) return;
    go(current + 1, false);
  }, 7000);

  go(0, false);
})();

/* Kairos · animations au défilement.
   1. Les blocs apparaissent en glissant quand ils entrent à l'écran.
   2. Les briques du schéma détaillé partent du schéma simplifié et viennent se placer au bon endroit. */
(function () {
  'use strict';
  var on = function () { return window.kxMotionOn ? window.kxMotionOn() : true; };

  // 1. reveal on scroll
  var targets = Array.prototype.slice.call(document.querySelectorAll('main section:not(#accueil) > div > *:not(#kx-detail):not(#kx-simple):not(.kx-mob), [data-reveal]'));
  if ('IntersectionObserver' in window && targets.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add('is-in');
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    targets.forEach(function (el) {
      var r = el.getBoundingClientRect();
      if (r.top < window.innerHeight * 0.9) return; // already visible at load: no effect
      var sib = el.parentElement ? Array.prototype.indexOf.call(el.parentElement.children, el) : 0;
      el.style.transitionDelay = Math.min(sib, 4) * 70 + 'ms';
      el.classList.add('kx-rv');
      io.observe(el);
    });
  }

  // 2. assembly of the detailed diagram
  var simple = document.getElementById('kx-simple');
  var detail = document.getElementById('kx-detail');
  if (!simple || !detail) return;
  var movers = Array.prototype.slice.call(detail.querySelectorAll('[data-from]'));
  var fades = Array.prototype.slice.call(detail.querySelectorAll('.kx-asm-fade'));
  var risers = Array.prototype.slice.call(detail.querySelectorAll('[data-asm="in"]'));
  var sources = {};
  Array.prototype.forEach.call(simple.querySelectorAll('[data-k]'), function (el) { sources[el.getAttribute('data-k')] = el; });
  var vecs = [], ticking = false, active = false;

  function clamp(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function easeInOut(k) { return k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2; }

  function clear() {
    movers.concat(fades, risers).forEach(function (el) { el.style.transform = ''; el.style.opacity = ''; });
    Object.keys(sources).forEach(function (k) { sources[k].style.opacity = ''; });
  }
  function measure() {
    clear();
    vecs = movers.map(function (m) {
      var src = sources[m.getAttribute('data-from')];
      if (!src) return null;
      var a = src.getBoundingClientRect(), b = m.getBoundingClientRect();
      return {
        dx: a.left + a.width / 2 - (b.left + b.width / 2),
        dy: a.top + a.height / 2 - (b.top + b.height / 2),
        s: Math.max(0.55, Math.min(1.3, a.width / b.width)),
        src: src
      };
    });
  }
  function apply() {
    ticking = false;
    var enabled = on() && detail.offsetParent !== null;
    if (!enabled) { if (active) { clear(); active = false; } return; }
    if (!active) { measure(); active = true; }
    var r = detail.getBoundingClientRect(), vh = window.innerHeight;
    var p = clamp((vh * 0.95 - r.top) / (vh * 0.7));
    var e = easeInOut(p);
    movers.forEach(function (m, i) {
      var v = vecs[i];
      if (!v) return;
      // each brick leaves a little after the previous one, so they never travel as a pile
      var pi = clamp((p - i * 0.06) / 0.76), ei = easeInOut(pi), k = 1 - ei;
      m.style.transform = 'translate(' + (v.dx * k).toFixed(1) + 'px,' + (v.dy * k).toFixed(1) + 'px) scale(' + (1 + (v.s - 1) * k).toFixed(3) + ')';
      m.style.opacity = (clamp(pi / 0.12) * (0.5 + 0.5 * ei)).toFixed(3);
      v.src.style.opacity = (1 - 0.55 * ei).toFixed(3);
    });
    var f = clamp((p - 0.72) / 0.28).toFixed(3);
    fades.forEach(function (el) { el.style.opacity = f; });
    risers.forEach(function (el) {
      var q = clamp((p - 0.5) / 0.4);
      el.style.opacity = q.toFixed(3);
      el.style.transform = 'translateY(' + ((1 - easeInOut(q)) * 28).toFixed(1) + 'px)';
    });
  }
  function onScroll() { if (!ticking) { ticking = true; window.requestAnimationFrame(apply); } }
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', function () { active = false; onScroll(); });
  document.addEventListener('kx:motion', function () { active = false; clear(); onScroll(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { active = false; onScroll(); });
  onScroll();
})();
