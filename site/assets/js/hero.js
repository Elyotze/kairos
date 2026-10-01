/* Kairos · fond animé de l'accueil.
   Des lignes de production défilent comme un Gantt vivant : les opérations s'allument en passant
   la ligne « maintenant » et, de temps en temps, un aléa (rouge) décale la suite de sa ligne.
   Sobre, monochrome, en pause hors écran, figé si les animations sont coupées. */
(function () {
  'use strict';
  var canvas = document.getElementById('kx-hero-bg');
  if (!canvas || !canvas.getContext) return;
  var ctx = canvas.getContext('2d');
  var W = 0, H = 0, dpr = 1, lanes = [], raf = 0, running = false, visible = true;
  var clock = 0, last = 0, nextAlea = 3;
  var LANE = 44, BAR_H = 6, SHIFT = 34;

  function rnd(a, b) { return a + Math.random() * (b - a); }
  function motionOn() { return window.kxMotionOn ? window.kxMotionOn() : true; }

  function build() {
    var r = canvas.getBoundingClientRect();
    W = Math.max(1, r.width); H = Math.max(1, r.height);
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    lanes = [];
    var n = Math.ceil(H / LANE) + 1;
    for (var i = 0; i < n; i++) {
      var bars = [], x = rnd(0, 120);
      while (x < W + 400) {
        var w = rnd(50, 210);
        bars.push({ x: x, w: w, tone: Math.random(), shift: 0, from: 0, t0: -1, alea: -1 });
        x += w + rnd(16, 70);
      }
      lanes.push({ y: i * LANE + LANE / 2 + 6, speed: rnd(7, 16), bars: bars, period: x + rnd(40, 160) });
    }
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y); ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r); ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h); ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r); ctx.arcTo(x, y, x + r, y, r); ctx.closePath();
  }
  function ease(k) { return k < 0 ? 0 : k > 1 ? 1 : 1 - Math.pow(1 - k, 3); }

  function triggerAlea() {
    var nowX = W * 0.64;
    var lane = lanes[Math.floor(rnd(1, Math.max(2, lanes.length - 1)))];
    if (!lane) return;
    // first bar just after "now" on that lane gets the alea; everything after it shifts right
    var best = -1, bestX = Infinity;
    lane.bars.forEach(function (b, i) {
      var x = pos(lane, b);
      if (x > nowX + 10 && x < bestX) { bestX = x; best = i; }
    });
    if (best < 0) return;
    lane.bars[best].alea = clock;
    var bx = lane.bars[best].x + lane.bars[best].shift;
    lane.bars.forEach(function (b) {
      if (b.x + b.shift > bx) { b.from = b.shift; b.shift += SHIFT; b.t0 = clock; }
    });
    lane.period += SHIFT;
  }

  function pos(lane, b) {
    var s = b.t0 >= 0 ? b.from + (b.shift - b.from) * ease((clock - b.t0) / 1.4) : b.shift;
    var x = (b.x + s - clock * lane.speed) % lane.period;
    if (x < -260) x += lane.period;
    return x;
  }

  function draw() {
    ctx.clearRect(0, 0, W, H);
    var nowX = W * 0.64;
    // faint time grid
    ctx.strokeStyle = 'rgba(255,255,255,0.025)';
    ctx.lineWidth = 1;
    var step = 160, off = (clock * 10) % step;
    for (var gx = -off; gx < W; gx += step) { ctx.beginPath(); ctx.moveTo(gx + 0.5, 0); ctx.lineTo(gx + 0.5, H); ctx.stroke(); }
    lanes.forEach(function (lane) {
      ctx.strokeStyle = 'rgba(255,255,255,0.03)';
      ctx.beginPath(); ctx.moveTo(0, lane.y + 0.5); ctx.lineTo(W, lane.y + 0.5); ctx.stroke();
      lane.bars.forEach(function (b) {
        var x = pos(lane, b);
        if (x > W || x + b.w < 0) return;
        var active = x < nowX && x + b.w > nowX;
        var a = 0.035 + b.tone * 0.075;
        var y = lane.y - BAR_H / 2;
        if (b.alea >= 0 && clock - b.alea < 3.2) {
          var k = clock - b.alea, f = k < 0.4 ? k / 0.4 : Math.max(0, 1 - (k - 0.4) / 2.8);
          ctx.fillStyle = 'rgba(229,72,77,' + (0.12 + 0.5 * f).toFixed(3) + ')';
          roundRect(x, y, b.w, BAR_H, 3); ctx.fill();
          return;
        }
        if (active) {
          ctx.save();
          ctx.shadowColor = 'rgba(237,237,236,0.35)'; ctx.shadowBlur = 14;
          ctx.fillStyle = 'rgba(237,237,236,' + (0.26 + b.tone * 0.18).toFixed(3) + ')';
          roundRect(x, y, b.w, BAR_H, 3); ctx.fill();
          ctx.restore();
        } else {
          ctx.fillStyle = 'rgba(237,237,236,' + a.toFixed(3) + ')';
          roundRect(x, y, b.w, BAR_H, 3); ctx.fill();
        }
      });
    });
    // the "now" line
    var g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(237,237,236,0)'); g.addColorStop(0.5, 'rgba(237,237,236,0.22)'); g.addColorStop(1, 'rgba(237,237,236,0)');
    ctx.fillStyle = g; ctx.fillRect(Math.round(nowX), 0, 1, H);
  }

  function frame(ts) {
    if (!running) return;
    var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0;
    last = ts; clock += dt;
    if (clock > nextAlea) { triggerAlea(); nextAlea = clock + rnd(2.8, 4.6); }
    draw();
    raf = window.requestAnimationFrame(frame);
  }

  function update() {
    var shouldRun = visible && motionOn() && !document.hidden;
    if (shouldRun && !running) { running = true; last = 0; raf = window.requestAnimationFrame(frame); }
    else if (!shouldRun && running) { running = false; window.cancelAnimationFrame(raf); draw(); }
    else if (!shouldRun) draw();
  }

  build();
  clock = 6; // start with a populated, already-moving scene
  draw();
  update();

  var rt = 0;
  window.addEventListener('resize', function () {
    window.clearTimeout(rt);
    rt = window.setTimeout(function () { build(); draw(); }, 150);
  });
  document.addEventListener('visibilitychange', update);
  document.addEventListener('kx:motion', update);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (entries) {
      visible = entries.some(function (e) { return e.isIntersecting; });
      update();
    }).observe(canvas);
  }
})();
