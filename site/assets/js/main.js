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
