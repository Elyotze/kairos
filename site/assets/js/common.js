/* Kairos · réglage des animations, commun à toutes les pages.
   Respecte « réduire les animations » du système et mémorise le choix du visiteur. */
(function () {
  'use strict';
  var root = document.querySelector('.kx');
  if (!root) return;
  var KEY = 'kx-motion';
  var reduce = false;
  try { reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
  var saved = null;
  try { saved = window.localStorage.getItem(KEY); } catch (e) {}
  var on = saved ? saved === 'on' : !reduce;
  var buttons = Array.prototype.slice.call(document.querySelectorAll('[data-motion-toggle]'));

  function apply() {
    root.classList.toggle('kx-on', on);
    root.classList.toggle('kx-off', !on);
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', on ? 'false' : 'true');
      b.setAttribute('aria-label', on ? 'Mettre les animations en pause' : 'Relancer les animations');
    });
    document.dispatchEvent(new CustomEvent('kx:motion', { detail: { on: on } }));
  }

  window.kxMotionOn = function () { return on && !reduce; };

  buttons.forEach(function (b) {
    b.addEventListener('click', function () {
      on = !on;
      try { window.localStorage.setItem(KEY, on ? 'on' : 'off'); } catch (e) {}
      apply();
    });
  });
  apply();
})();
