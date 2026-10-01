/* Kairos · simulateur d'impact.
   Modèle volontairement simple, toutes les hypothèses sont visibles sur la page :
     aléas / an      = effectif / 100 × fréquence hebdo × 46 semaines
     h planification = aléas × replanification × part évitée
     h atelier       = aléas × attente × part évitée
     ETP             = heures / 1 607 */
(function () {
  'use strict';
  var DEFAULTS = { n: 120, a: 15, h: 1.5, w: 4, s: 50 };
  var WEEKS = 46, HOURS_PER_FTE = 1607, YEAR1 = 0.875; // 3-month ramp-up: year 1 = 10.5 / 12
  var X0 = 52, X1 = 704;

  var p = Object.assign({}, DEFAULTS);
  var v = Object.assign({}, p, scales(p));
  var tid = 0, raf = 0, snap = 0;

  function model(q) {
    var al = q.n / 100 * q.a * WEEKS;
    var plan = al * q.h * q.s / 100;
    var prod = al * q.w * q.s / 100;
    return { al: al, plan: plan, prod: prod, tot: plan + prod };
  }
  function nice(x) {
    if (!(x > 0)) return 1000;
    var e = Math.pow(10, Math.floor(Math.log10(x)));
    var m = x / e;
    return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * e;
  }
  function scales(q) {
    return {
      y1: nice(model(q).tot * YEAR1 * 1.12),
      y2: nice(model(Object.assign({}, q, { n: 400 })).tot * 1.12)
    };
  }
  function canAnimate() {
    if (window.kxMotionOn && !window.kxMotionOn()) return false;
    return typeof window.requestAnimationFrame === 'function';
  }

  var grp = function (x) { return String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' '); };
  var num = function (x) { return String(+x.toFixed(2)).replace('.', ','); };
  var r10 = function (x) { return Math.round(x / 10) * 10; };
  var ax = function (x) {
    if (x >= 1000) { var k = x / 1000; return (k % 1 === 0 ? String(k) : num(k)) + ' k'; }
    return String(Math.round(x));
  };
  var fill = function (x, lo, hi) {
    var f = Math.max(0, Math.min(1, (x - lo) / (hi - lo)));
    return 'calc(8px + (100% - 16px) * ' + f.toFixed(4) + ')';
  };

  function compute() {
    var m = model(v);
    var c1y = function (val) { return 248 - 232 * Math.min(1.08, val / v.y1); };
    var c1x = function (t) { return X0 + (X1 - X0) * t / 12; };
    var cum = function (t) { return t <= 3 ? t * t / 6 : 1.5 + (t - 3); };
    var top = [], bot = [];
    for (var i = 0; i <= 48; i++) {
      var t = i / 4, f = cum(t) / 12;
      top.push([c1x(t), c1y(m.tot * f)]);
      bot.push([c1x(t), c1y(m.plan * f)]);
    }
    var pts = function (arr) {
      return arr.map(function (q, j) { return (j ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ');
    };
    var lineTot = pts(top), linePlan = pts(bot);
    var areaProd = lineTot + ' ' + bot.slice().reverse().map(function (q) { return 'L' + q[0].toFixed(1) + ' ' + q[1].toFixed(1); }).join(' ') + ' Z';
    var areaPlan = linePlan + ' L' + X1 + ' 248 L' + X0 + ' 248 Z';
    var tgt = model(p), sc = scales(p);
    var c2y = function (val) { return 208 - 192 * Math.min(1.08, val / v.y2); };
    var c2x = function (n) { return X0 + (X1 - X0) * n / 400; };
    var y400 = c2y(model(Object.assign({}, v, { n: 400 })).tot);
    var c2Line = 'M' + X0 + ' 208 L' + X1 + ' ' + y400.toFixed(1);
    return {
      nTxt: p.n + ' pers.', aTxt: String(p.a), hTxt: num(p.h) + ' h', wTxt: num(p.w) + ' h', sTxt: p.s + ' %',
      nFill: fill(p.n, 20, 400), aFill: fill(p.a, 5, 40), hFill: fill(p.h, 0.5, 4), wFill: fill(p.w, 1, 10), sFill: fill(p.s, 20, 80),
      totTxt: '≈ ' + grp(r10(m.tot)) + ' h',
      etpTxt: num(Math.round(m.tot / HOURS_PER_FTE * 10) / 10) + ' ETP',
      per100Txt: '≈ ' + grp(r10(model(Object.assign({}, v, { n: 100 })).tot)),
      aleasTxt: '≈ ' + grp(r10(m.al)),
      y1ProdTxt: grp(r10(m.prod * YEAR1)) + ' h',
      y1PlanTxt: grp(r10(m.plan * YEAR1)) + ' h',
      y1Top: ax(sc.y1), y1Mid: ax(sc.y1 / 2),
      c1LineTot: lineTot, c1LinePlan: linePlan, c1AreaProd: areaProd, c1AreaPlan: areaPlan,
      c1EndY: top[top.length - 1][1].toFixed(1),
      c1Aria: 'Courbe cumulée sur douze mois : environ ' + grp(r10(tgt.tot * YEAR1)) + ' heures la première année, dont ' + grp(r10(tgt.plan * YEAR1)) + ' en planification.',
      y2Top: ax(sc.y2), y2Mid: ax(sc.y2 / 2),
      c2Line: c2Line, c2Area: c2Line + ' L' + X1 + ' 208 Z',
      ptX: c2x(v.n).toFixed(1), ptY: c2y(m.tot).toFixed(1),
      ptTxt: p.n + ' pers. · ' + grp(r10(tgt.tot)) + ' h/an',
      c2Aria: 'Droite proportionnelle : le gain annuel passe de 0 à environ ' + grp(r10(model(Object.assign({}, p, { n: 400 })).tot)) + ' heures pour 400 personnes ; votre atelier de ' + p.n + ' personnes est à environ ' + grp(r10(tgt.tot)) + ' heures.'
    };
  }

  var texts = Array.prototype.slice.call(document.querySelectorAll('[data-t]'));
  var attrs = Array.prototype.slice.call(document.querySelectorAll('[data-b]')).map(function (el) {
    return { el: el, pairs: el.getAttribute('data-b').split(';').map(function (s) { return s.split(':'); }) };
  });
  var styles = Array.prototype.slice.call(document.querySelectorAll('[data-s]')).map(function (el) {
    return { el: el, pairs: el.getAttribute('data-s').split(';').map(function (s) { return s.split(':'); }) };
  });

  function render() {
    var vals = compute();
    texts.forEach(function (el) {
      var val = vals[el.getAttribute('data-t')];
      if (val !== undefined && el.textContent !== val) el.textContent = val;
    });
    attrs.forEach(function (b) {
      b.pairs.forEach(function (pr) {
        if (pr[0] === 'value') return; // range inputs keep their own value
        var val = vals[pr[1]];
        if (val !== undefined) b.el.setAttribute(pr[0], val);
      });
    });
    styles.forEach(function (b) {
      b.pairs.forEach(function (pr) {
        var val = vals[pr[1]];
        if (val !== undefined) b.el.style.setProperty(pr[0], val);
      });
    });
  }

  function tweenTo(target, ms) {
    var to = Object.assign({}, target, scales(target));
    var id = ++tid;
    if (raf) window.cancelAnimationFrame(raf);
    if (snap) window.clearTimeout(snap);
    if (!canAnimate()) { v = to; render(); return; }
    var from = Object.assign({}, v);
    var t0 = null;
    var step = function (ts) {
      if (id !== tid) return;
      if (t0 === null) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms);
      var e = 1 - Math.pow(1 - k, 3);
      var nv = {};
      for (var key in to) nv[key] = from[key] + (to[key] - from[key]) * e;
      v = nv;
      render();
      if (k < 1) raf = window.requestAnimationFrame(step);
    };
    raf = window.requestAnimationFrame(step);
    // safety net if animation frames are throttled (background tab)
    snap = window.setTimeout(function () { if (id === tid) { tid++; v = to; render(); } }, ms + 1500);
  }

  var inputs = { n: 'kx-n', a: 'kx-a', h: 'kx-h', w: 'kx-w', s: 'kx-s' };
  var presetButtons = Array.prototype.slice.call(document.querySelectorAll('[data-preset]'));

  function syncControls() {
    Object.keys(inputs).forEach(function (k) {
      var el = document.getElementById(inputs[k]);
      if (el && +el.value !== p[k]) el.value = p[k];
    });
    presetButtons.forEach(function (b) {
      b.setAttribute('aria-pressed', +b.getAttribute('data-preset') === p.n ? 'true' : 'false');
    });
  }

  function setParam(k, val) {
    p = Object.assign({}, p);
    p[k] = val;
    syncControls();
    tweenTo(p, 500);
  }

  Object.keys(inputs).forEach(function (k) {
    var el = document.getElementById(inputs[k]);
    if (!el) return;
    el.value = p[k];
    el.addEventListener('input', function () { setParam(k, +el.value); });
  });
  presetButtons.forEach(function (b) {
    b.addEventListener('click', function () { setParam('n', +b.getAttribute('data-preset')); });
  });
  var reset = document.getElementById('kx-reset');
  if (reset) reset.addEventListener('click', function () { p = Object.assign({}, DEFAULTS); syncControls(); tweenTo(p, 500); });

  // intro: the curves grow from an empty workshop when the simulator comes into view
  var target = document.querySelector('[data-t="totTxt"]');
  if (canAnimate() && 'IntersectionObserver' in window && target) {
    var io = new IntersectionObserver(function (entries) {
      if (!entries.some(function (e) { return e.isIntersecting; })) return;
      io.disconnect();
      v = Object.assign({}, v, { n: 0 });
      render();
      tweenTo(p, 1600);
    }, { threshold: 0.4 });
    io.observe(target);
  } else {
    render();
  }
})();
