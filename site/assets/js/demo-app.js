(function () {
  const $ = s => document.querySelector(s);
  const pad = n => String(n).padStart(2, '0');
  const hm = t => { const r = ((t % 64) + 64) % 64, m = 360 + r * 15; return pad(Math.floor(m / 60)) + ':' + pad(m % 60); };
  const fmtT = t => `J${Math.floor(t / 64) + 1} · ${hm(t)}`;
  const fmtE = t => (t > 0 && t % 64 === 0) ? `J${t / 64} · 22:00` : fmtT(t);
  const fmtDur = q => { q = Math.abs(Math.round(q)); const h = Math.floor(q / 4), m = (q % 4) * 15; if (!h) return `${m} min`; return m ? `${h} h ${pad(m)}` : `${h} h`; };
  const sgn = q => (q > 0 ? '+' : q < 0 ? '−' : '');
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const opLabel = i => `${OFS[OPS[i].of].id} · ${OPS[i].code}`;
  const PRES_CYCLE = ['P', 'A', 'C', 'F', 'R'];
  const PRES_NAME = { P: 'Présent', A: 'Absent (imprévu)', C: 'Congé validé', F: 'Formation', R: 'Prêté à une autre ligne', X: 'Pas encore arrivé' };
  const TEAM = { M: 'Matin', S: 'Après-midi' };
  const TEAM_S = { M: 'M', S: 'AM' };

  function basePres(crew) {
    const p = crew.map(() => Array(K.SIM_DAYS).fill('P'));
    p[3][5] = 'C'; p[3][6] = 'C'; p[6][2] = 'F'; p[10][8] = 'C'; p[10][9] = 'C';
    return p;
  }
  function frozenFrom(plan, T) {
    const byStart = new Map();
    for (let i = 0; i < OPS.length; i++) {
      const s = plan.start[i];
      if (s >= 0 && s < T) { if (!byStart.has(s)) byStart.set(s, []); byStart.get(s).push(i); }
    }
    const enter = plan.enter.map(a => Array.from(a).map(v => (v >= 0 && v < T ? v : -1)));
    const sslot = plan.sslot.map(a => Array.from(a));
    return { start: plan.start, end: plan.end, who: plan.who, enter, sslot, byStart };
  }

  /* ---------------- state ---------------- */
  const S = { view: 'poste', zoom: 10 };
  function initState() {
    Object.assign(S, {
      slots: 2, crew: OPERATORS.slice(), pres: basePres(OPERATORS), kit: {}, blk: {}, endOv: {},
      now: 80, plan: null, prev: null, events: [], showChain: false, showGhost: true, selected: -1,
      scenario: null, pending: 0, presSnap: null
    });
  }
  const cur = () => (S.scenario ? S.scenario.plan : S.plan);
  const curCrew = () => (S.scenario ? S.scenario.crew : S.crew);
  const curPres = () => (S.scenario ? S.scenario.pres : S.pres);
  const refPlan = () => (S.scenario ? S.plan : S.prev);

  function makeCtx(T, crew, pres) {
    return { T, frozen: T > 0 && S.plan ? frozenFrom(S.plan, T) : null, crew: crew || S.crew, pres: pres || S.pres,
      kit: S.kit, blk: S.blk, endOv: S.endOv, slots: S.slots };
  }
  function kpis(plan, ctx) {
    const late = []; let minSlack = Infinity, minF = -1;
    OFS.forEach((o, f) => { const sl = o.due - plan.ofEnd[f]; if (sl < 0) late.push(f); if (sl < minSlack) { minSlack = sl; minF = f; } });
    let work = 0;
    for (let i = 0; i < OPS.length; i++) if (plan.start[i] >= 0) work += (plan.end[i] - plan.start[i]) * plan.who[i].length;
    let cap = 0; const ms = plan.makespan;
    ctx.crew.forEach((w, o) => {
      for (let d = 0; d * 64 < ms; d++) {
        if (ctx.pres[o][d] !== 'P') continue;
        const a = d * 64 + (w.team === 'M' ? 0 : 32), b = a + 32;
        cap += Math.max(0, Math.min(b, ms) - a);
      }
    });
    return { late, minSlack, minF, util: cap ? work / cap : 0 };
  }
  function solve(T, crew, pres, wStab) {
    const ctx = makeCtx(T, crew, pres);
    if (wStab != null) ctx.wStab = wStab;
    const base = T > 0 ? S.plan : null;
    const plan = optimize(ctx, base, base ? 120 : 160);
    analyze(plan, ctx, base);
    plan.ctx = ctx; plan.viol = validate(plan, ctx); plan.base = base;
    plan.kpi = kpis(plan, ctx);
    return plan;
  }
  function pushEvent(kind, t, title, detail, plan, prev) {
    S.events.unshift({ kind, t, title, detail, ms: plan.stats.ms, passes: plan.stats.passes, moved: plan.base ? plan.moved : null,
      dMk: prev ? plan.makespan - prev.makespan : null, late: plan.kpi.late.length, viol: plan.viol.length });
  }
  function replan(kind, title, detail) {
    const prev = S.plan;
    const plan = solve(S.now);
    S.prev = prev; S.plan = plan; S.scenario = null; S.pending = 0; S.presSnap = null;
    pushEvent(kind, S.now, title, detail, plan, prev);
    renderAll(true);
  }

  /* ---------------- triggers ---------------- */
  const slackOf = (f, P) => OFS[f].due - P.ofEnd[f];
  function guard() {
    if (S.scenario) { toast('Publiez ou abandonnez le scénario en cours avant un nouvel aléa.'); return false; }
    return true;
  }
  function trigNC() {
    if (!guard()) return;
    const P = S.plan, T = S.now; let i = S.selected;
    if (i < 0 || P.start[i] < T) {
      const all = OPS.map(o => o.i).filter(k => P.start[k] >= T && !((S.blk[k] || 0) > T));
      const soon = all.filter(k => P.start[k] < T + 16);
      const pool = soon.length ? soon : all.sort((a, b) => P.start[a] - P.start[b]).slice(0, 6);
      if (!pool.length) { toast('Aucune opération à venir : la production est terminée.'); return; }
      pool.sort((a, b) => slackOf(OPS[a].of, P) - slackOf(OPS[b].of, P) || P.start[a] - P.start[b]);
      i = pool[0];
    }
    const until = T + 16;
    S.blk[i] = Math.max(S.blk[i] || 0, until);
    S.selected = i;
    replan('nc', `Non-conformité sur ${opLabel(i)}`, `« ${OPS[i].name} » bloquée jusqu'à ${fmtT(until)}, levée prévue dans 4 h.`);
  }
  function trigAbs() {
    if (!guard()) return;
    const P = S.plan, T = S.now, d = Math.floor(T / 64);
    const h = S.crew.map(() => 0);
    for (let k = 0; k < OPS.length; k++) if (P.start[k] >= T && P.start[k] < T + 64) for (const o of P.who[k]) h[o] += P.end[k] - P.start[k];
    let o = -1, best = 0;
    h.forEach((v, k) => { if (S.pres[k][d] === 'P' && v > best) { best = v; o = k; } });
    if (o < 0) { toast('Aucun opérateur chargé dans les 16 prochaines heures.'); return; }
    const n = OPS.filter(op => P.start[op.i] >= T && Math.floor(P.start[op.i] / 64) <= d + 1 && P.who[op.i].includes(o)).length;
    [d, d + 1].forEach(x => { if (x < K.SIM_DAYS && S.pres[o][x] === 'P') S.pres[o][x] = 'A'; });
    replan('abs', `Absence imprévue : ${S.crew[o].name}`, `Indisponible J${d + 1} et J${d + 2} : ${n} OP à réaffecter selon la matrice de compétences.`);
  }
  function trigKit() {
    if (!guard()) return;
    const P = S.plan, T = S.now; let best = null;
    for (let f = 0; f < OFS.length; f++) for (let p = 0; p < 5; p++) {
      let first = Infinity, started = false;
      for (const k of STAGE[f][p]) { if (P.start[k] < T) started = true; first = Math.min(first, P.start[k]); }
      if (started || (S.kit[f * 5 + p] || 0) > T) continue;
      if (!best || first < best.first) best = { f, p, first };
    }
    if (!best) { toast('Aucun poste à venir : tous les kits sont livrés.'); return; }
    const until = best.first + 16;
    S.kit[best.f * 5 + best.p] = until;
    S.selected = STAGE[best.f][best.p].reduce((a, k) => (P.start[k] < P.start[a] ? k : a), STAGE[best.f][best.p][0]);
    replan('kit', `Kit en retard : ${OFS[best.f].id}, poste ${POSTES[best.p].id}`,
      `Pièces du poste ${POSTES[best.p].id} ${POSTES[best.p].name} disponibles à ${fmtT(until)} au lieu de ${fmtT(best.first)}.`);
  }
  function trigDrift() {
    if (!guard()) return;
    const P = S.plan, T = S.now; let i = S.selected;
    if (i < 0 || !(P.start[i] < T && P.end[i] > T)) {
      const run = OPS.map(o => o.i).filter(k => P.start[k] < T && P.end[k] > T);
      if (!run.length) { toast("Aucune OP en cours à cet instant : avancez l'horloge d'une heure."); return; }
      run.sort((a, b) => slackOf(OPS[a].of, P) - slackOf(OPS[b].of, P));
      i = run[0];
    }
    const dur = P.end[i] - P.start[i], extra = Math.max(4, Math.round(dur * 0.5));
    S.endOv[i] = P.end[i] + extra; S.selected = i;
    replan('drift', `Dérive de temps : ${opLabel(i)}`, `Temps réel au-delà du P80 : fin réestimée à ${fmtE(P.end[i] + extra)} (+${fmtDur(extra)}).`);
  }
  function whatIf() {
    if (S.scenario) return;
    if (S.crew.some(w => w.renfort)) { toast("Le renfort fait déjà partie de l'équipe."); return; }
    const d = Math.floor(S.now / 64) + 1;
    const crew = S.crew.concat([RENFORT]);
    const pres = S.pres.concat([Array.from({ length: K.SIM_DAYS }, (_, x) => (x < d ? 'X' : 'P'))]);
    const plan = solve(S.now, crew, pres, 0.25);
    S.scenario = { plan, crew, pres, from: d };
    renderAll(true);
  }
  function publishScenario() {
    const sc = S.scenario, prev = S.plan;
    S.crew = sc.crew; S.pres = sc.pres; S.prev = prev; S.plan = sc.plan; S.scenario = null;
    pushEvent('publish', S.now, 'Scénario publié : + 1 intérimaire', `Renfort Structure, Mécanique, Essais dans l'équipe du matin à partir de J${sc.from + 1}.`, S.plan, prev);
    renderAll(true);
  }
  function advance(dq) {
    if (S.scenario) { toast("Publiez ou abandonnez le scénario avant d'avancer l'horloge."); return; }
    const lim = Math.ceil(Math.max(S.plan.makespan, 64) / 64) * 64;
    if (S.now >= lim) { toast('La production planifiée est terminée.'); return; }
    S.now = Math.min(S.now + dq, lim);
    renderAll();
  }
  function reset() {
    initState();
    $('#c-chain').checked = false; $('#c-ghost').checked = true;
    S.plan = solve(0);
    pushEvent('init', 0, 'Calcul initial', `160 OP, 8 OF, 12 opérateurs : planning complet, ${S.plan.kpi.late.length} OF en retard.`, S.plan, null);
    renderAll(true);
  }

  /* ---------------- helpers ---------------- */
  function cssVar(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  function lum(hex) {
    if (!hex || hex[0] !== '#') return 0.3;
    const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  }
  function textOn(hex) { const L = lum(hex); return (1.05 / (L + 0.05)) >= ((L + 0.05) / 0.057) ? '#ffffff' : '#11151a'; }
  let toastTimer = 0;
  function toast(msg) { const t = $('#toast'); t.textContent = msg; t.hidden = false; clearTimeout(toastTimer); toastTimer = setTimeout(() => { t.hidden = true; }, 2800); }
  const ICON_OK = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="var(--good)" stroke-width="1.5"/><path d="M4.8 8.2l2.1 2.1 4.3-4.6" fill="none" stroke="var(--good)" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  const ICON_WARN = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8 1.8l6.6 11.7H1.4z" fill="none" stroke="var(--crit)" stroke-width="1.5" stroke-linejoin="round"/><path d="M8 6.3v3.4M8 11.6v.1" stroke="var(--crit)" stroke-width="1.6" stroke-linecap="round"/></svg>';
  const ICON_LATE = '<svg width="11" height="11" viewBox="0 0 12 12" aria-hidden="true"><path d="M6 1.2l5 9.3H1z" fill="currentColor"/></svg>';

  /* ---------------- KPI ---------------- */
  function renderKPIs() {
    const P = cur(), R = refPlan(), k = P.kpi;
    const tile = (l, v, s, extra) => `<div class="kpi"><div class="kpi-l">${l}</div><div class="kpi-v">${v}</div>${extra || ''}<div class="kpi-s">${s}</div></div>`;
    const dMk = R ? P.makespan - R.makespan : null;
    const refWord = S.scenario ? 'vs planning publié' : 'vs plan précédent';
    const mkSub = dMk == null ? 'dernier OF, calcul initial' : dMk === 0 ? `inchangée ${refWord}` : `<span class="${dMk > 0 ? 'up' : 'down'}">${sgn(dMk)}${fmtDur(dMk)}</span> ${refWord}`;
    let lateSub;
    if (k.late.length) { const f = k.minF; lateSub = `<span class="up">${k.late.length} en retard</span>, pire : ${OFS[f].id} (${fmtDur(-k.minSlack)})`; }
    else lateSub = `marge mini ${fmtDur(k.minSlack)} (${OFS[k.minF].id})`;
    const u = Math.round(k.util * 100);
    $('#kpis').innerHTML =
      tile('Fin de production', fmtE(P.makespan), mkSub) +
      tile("OF à l'heure", `${OFS.length - k.late.length} / ${OFS.length}`, lateSub) +
      tile('Charge opérateurs', `${u} %`, 'heures planifiées / heures présentes', `<div class="meter" aria-hidden="true"><i style="width:${Math.min(100, u)}%"></i></div>`) +
      tile('OP déplacées', P.base ? String(P.moved) : '0', P.base ? 'au dernier recalcul, écart ≥ 1 h' : 'aucun recalcul pour le moment') +
      tile('Temps de calcul', `${P.stats.ms} ms`, `${P.stats.passes} passes · ${P.viol.length ? `<span class="up">${P.viol.length} violation(s)</span>` : '0 violation'}`);
  }

  /* ---------------- Gantt ---------------- */
  let tcol = [];
  function renderGantt() {
    const P = cur(), crew = curCrew(), pres = curPres(), R = S.showGhost ? refPlan() : null;
    tcol = [1, 2, 3, 4, 5, 6, 7, 8].map(n => textOn(cssVar('--of' + n)));
    const wrap = $('#ganttWrap');
    const W = Math.max(860, wrap.clientWidth - 2);
    const poste = S.view === 'poste';
    const LBL = poste ? 150 : 138, HEAD = 42, RIGHT = 12;
    const lastDay = Math.max(K.DAYS, Math.ceil(P.makespan / 64));
    let d0 = 0, nd = lastDay;
    if (S.zoom === 5) { d0 = Math.max(0, Math.min(Math.floor(S.now / 64) - 1, lastDay - 5)); nd = 5; }
    const q0 = d0 * 64, q1 = (d0 + nd) * 64, px = (W - LBL - RIGHT) / (q1 - q0);
    const X = t => LBL + (Math.max(q0, Math.min(q1, t)) - q0) * px;
    const vis = (a, b) => b > q0 && a < q1;
    const rows = [];
    if (poste) {
      for (let p = 0; p < 5; p++) for (let s = 0; s < S.slots; s++) {
        const bands = [], items = [];
        for (let f = 0; f < OFS.length; f++) {
          if (P.enter[f][p] < 0 || P.sslot[f][p] !== s) continue;
          let b = P.leave[f][p];
          if (b < 0) { b = 0; for (const k of STAGE[f][p]) b = Math.max(b, P.end[k]); }
          bands.push({ f, a: P.enter[f][p], b });
          for (const k of STAGE[f][p]) if (P.start[k] >= 0) items.push(k);
        }
        items.sort((a, b) => P.start[a] - P.start[b]);
        const laneEnd = [], lanes = {};
        for (const k of items) { let l = laneEnd.findIndex(e => e <= P.start[k]); if (l < 0) { l = laneEnd.length; laneEnd.push(0); } laneEnd[l] = P.end[k]; lanes[k] = l; }
        rows.push({ p, s, h: 10 + Math.max(1, laneEnd.length) * 16, bands, items, lanes });
      }
    } else {
      crew.forEach((w, o) => {
        const items = [];
        for (let k = 0; k < OPS.length; k++) if (P.start[k] >= 0 && P.who[k].includes(o)) items.push(k);
        rows.push({ o, h: 26, items });
      });
    }
    let y = HEAD; rows.forEach(r => { r.y = y; y += r.h; });
    const H = y + 6;
    const g = [];
    g.push(`<defs><pattern id="hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="2.5" height="6" fill="var(--hatch)"/></pattern></defs>`);
    // header + day grid
    for (let d = d0; d < d0 + nd; d++) {
      const xa = X(d * 64), xm = X(d * 64 + 32), xb = X(d * 64 + 64), dw = xb - xa;
      if (d % 2 === 1) g.push(`<rect x="${xa}" y="0" width="${dw}" height="${H}" fill="var(--shade)" opacity=".55"/>`);
      g.push(`<text x="${(xa + xb) / 2}" y="16" text-anchor="middle" font-size="13" font-weight="600" fill="var(--ink)" style="font-family:var(--f-display)">J${d + 1}</text>`);
      if (dw >= 56) {
        g.push(`<text class="t-mono" x="${(xa + xm) / 2}" y="33" text-anchor="middle" font-size="10" fill="var(--muted)">M</text>`);
        g.push(`<text class="t-mono" x="${(xm + xb) / 2}" y="33" text-anchor="middle" font-size="10" fill="var(--muted)">AM</text>`);
      }
      g.push(`<line x1="${xm}" x2="${xm}" y1="24" y2="${H}" stroke="var(--line)"/>`);
      g.push(`<line x1="${xa}" x2="${xa}" y1="4" y2="${H}" stroke="var(--axis)"/>`);
    }
    g.push(`<line x1="${X(q1)}" x2="${X(q1)}" y1="4" y2="${H}" stroke="var(--axis)"/>`);
    g.push(`<line x1="0" x2="${W}" y1="${HEAD}" y2="${HEAD}" stroke="var(--axis)"/>`);
    // rows
    rows.forEach((r, ri) => {
      const sepCol = poste ? (r.s === 0 ? 'var(--axis)' : 'var(--line)') : 'var(--line)';
      if (ri > 0) g.push(`<line x1="0" x2="${W}" y1="${r.y}" y2="${r.y}" stroke="${sepCol}"/>`);
      if (poste) {
        if (r.s === 0) {
          g.push(`<text class="t-mono" x="10" y="${r.y + 17}" font-size="12" font-weight="500" fill="var(--ink)">${POSTES[r.p].id}</text>`);
          g.push(`<text x="36" y="${r.y + 17}" font-size="12.5" fill="var(--ink)">${esc(POSTES[r.p].name.replace(' et contrôle', ''))}</text>`);
        }
        g.push(`<text class="t-mono" x="${LBL - 10}" y="${r.y + 17}" text-anchor="end" font-size="11" fill="var(--muted)">E${r.s + 1}</text>`);
        r.bands.forEach(b => {
          if (!vis(b.a, b.b)) return;
          const c = `var(--of${b.f + 1})`;
          g.push(`<rect x="${X(b.a)}" y="${r.y + 2.5}" width="${Math.max(1, X(b.b) - X(b.a))}" height="${r.h - 5}" rx="5" fill="${c}" fill-opacity=".09" stroke="${c}" stroke-opacity=".5" stroke-width="1"/>`);
        });
      } else {
        const w = crew[r.o];
        g.push(`<text x="10" y="${r.y + 17}" font-size="12.5" font-weight="500" fill="var(--ink)">${esc(w.name)}</text>`);
        g.push(`<text class="t-mono" x="${LBL - 10}" y="${r.y + 17}" text-anchor="end" font-size="10.5" fill="var(--muted)">${w.type === 'Intérim' ? 'INT ' : ''}${TEAM_S[w.team]}</text>`);
        for (let d = d0; d < d0 + nd; d++) {
          const st = pres[r.o][d];
          const ta = d * 64 + (w.team === 'M' ? 0 : 32), oa = d * 64 + (w.team === 'M' ? 32 : 0);
          g.push(`<rect x="${X(oa)}" y="${r.y + 1}" width="${X(oa + 32) - X(oa)}" height="${r.h - 2}" fill="var(--shade)"/>`);
          if (st !== 'P') {
            g.push(`<rect x="${X(ta)}" y="${r.y + 3}" width="${X(ta + 32) - X(ta)}" height="${r.h - 6}" rx="3" fill="url(#hatch)" stroke="var(--axis)" stroke-dasharray="3 2"/>`);
            if (X(ta + 32) - X(ta) > 26) g.push(`<text class="t-mono" x="${(X(ta) + X(ta + 32)) / 2}" y="${r.y + 17}" text-anchor="middle" font-size="10.5" fill="var(--ink-2)">${st === 'X' ? '—' : st}</text>`);
          }
        }
      }
      // ghosts (previous plan)
      if (R && !S.showChain) {
        for (let k = 0; k < OPS.length; k++) {
          if (P.start[k] < P.T || R.start[k] < 0 || Math.abs(P.start[k] - R.start[k]) < 4) continue;
          let inRow, lane = 0;
          if (poste) { const f = OPS[k].of, p = OPS[k].p; inRow = p === r.p && R.sslot[f][p] === r.s; lane = r.lanes[k] != null ? r.lanes[k] : 0; }
          else inRow = R.who[k].includes(r.o);
          if (!inRow || !vis(R.start[k], R.end[k])) continue;
          const by = poste ? r.y + 5 + lane * 16 : r.y + 5;
          g.push(`<rect x="${X(R.start[k]) + .5}" y="${by + .5}" width="${Math.max(2, X(R.end[k]) - X(R.start[k]) - 1)}" height="${poste ? 12 : 15}" rx="3" fill="none" stroke="var(--ink-2)" stroke-width="1" stroke-dasharray="3 2" opacity=".55"/>`);
        }
      }
      // bars
      for (const k of r.items) {
        if (!vis(P.start[k], P.end[k])) continue;
        const by = poste ? r.y + 5 + r.lanes[k] * 16 : r.y + 5;
        g.push(bar(k, X(P.start[k]), by, Math.max(2, X(P.end[k]) - X(P.start[k]) - 1), poste ? 13 : 16, P, poste));
      }
    });
    // now line
    if (vis(S.now, S.now + 1)) {
      const xn = X(S.now);
      g.push(`<line x1="${xn}" x2="${xn}" y1="${HEAD - 6}" y2="${H}" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="4 3"/>`);
      g.push(`<path d="M${xn - 5} ${HEAD - 10}h10l-5 6z" fill="var(--ink)"/>`);
    }
    const svg = $('#gantt');
    svg.setAttribute('width', W); svg.setAttribute('height', H); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    svg.innerHTML = g.join('');
  }
  function bar(k, x, y, w, h, P, poste) {
    const op = OPS[k], f = op.of, c = `var(--of${f + 1})`;
    const done = P.end[k] <= S.now, run = P.start[k] < S.now && P.end[k] > S.now;
    const inChain = P.chain.has(k), sel = S.selected === k;
    let o = done ? 0.36 : 1;
    if (S.showChain) o = inChain ? 1 : 0.14;
    const stroke = sel ? 'var(--ink)' : (S.showChain && inChain) || run ? 'var(--ink)' : 'none';
    const sw = sel ? 2.2 : 1.2;
    let lab = '';
    const code = op.code, ofn = OFS[f].id.slice(3);
    const txt = poste ? (w >= 22 ? code : '') : (w >= 50 ? `${ofn}·${code}` : w >= 24 ? ofn : '');
    if (txt) lab = `<text x="${x + w / 2}" y="${y + h / 2 + 3.6}" text-anchor="middle" font-size="10.5" font-weight="500" fill="${tcol[f]}" pointer-events="none">${txt}</text>`;
    let tabs = '';
    if ((S.blk[k] || 0) > S.now && P.start[k] >= S.now) tabs += `<rect x="${x}" y="${y - 2}" width="4" height="${h + 4}" rx="1" fill="var(--crit)"/>`;
    if (S.endOv[k] != null) tabs += `<rect x="${x + w - 4}" y="${y - 2}" width="4" height="${h + 4}" rx="1" fill="var(--crit)"/>`;
    return `<g class="bar-g" data-i="${k}" opacity="${o}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="${c}" stroke="${stroke}" stroke-width="${sw}"/>${lab}${tabs}</g>`;
  }

  function renderLegend() {
    const poste = S.view === 'poste';
    let h = OFS.map((o, f) => `<span><i class="sw" style="background:var(--of${f + 1})"></i>${o.id}</span>`).join('');
    h += '<span class="lg-sep"></span>';
    h += `<span><svg width="18" height="10" aria-hidden="true"><path d="M1 5h16" stroke="var(--ink)" stroke-width="1.4" stroke-dasharray="4 3"/></svg> Maintenant</span>`;
    h += `<span><i class="sw" style="background:var(--ink-2);opacity:.36"></i>Terminée</span>`;
    h += `<span><i class="sw" style="background:var(--surface);box-shadow:inset 0 0 0 1.2px var(--ink)"></i>En cours</span>`;
    h += `<span><i class="sw" style="background:none;box-shadow:inset 0 0 0 1px var(--ink-2);outline:1px dashed var(--ink-2);outline-offset:-1px"></i>Position avant recalcul</span>`;
    h += `<span><i class="sw" style="background:var(--crit);width:4px"></i> Aléa sur l'OP</span>`;
    h += poste ? `<span><i class="sw" style="background:var(--ink-2);opacity:.18"></i>Produit présent au poste</span>` : `<span><i class="sw" style="background:repeating-linear-gradient(135deg,var(--surface) 0 3px,var(--hatch) 3px 5px);box-shadow:inset 0 0 0 1px var(--axis)"></i>Absent, congé, formation</span>`;
    $('#legend').innerHTML = h;
  }
  function renderCheck() {
    const P = cur();
    $('#check').innerHTML = P.viol.length
      ? `${ICON_WARN}<span><b>${P.viol.length} violation(s)</b> détectée(s) par le vérificateur : ${esc(P.viol.slice(0, 4).join(', '))}.</span>`
      : `${ICON_OK}<span><b>0 violation.</b> Un vérificateur indépendant contrôle les 160 OP après chaque calcul : précédences FS/SS/FF, flux entre postes, emplacements, effectifs, compétences, équipes sans passation, présence, kits et NC.</span>`;
  }
  function renderOF() {
    const P = cur(), R = refPlan();
    let h = '<thead><tr><th>OF</th><th>Lancement</th><th>Sortie prévue</th><th>Échéance</th><th>Marge</th><th class="num">Écart</th></tr></thead><tbody>';
    OFS.forEach((o, f) => {
      const sl = o.due - P.ofEnd[f];
      const pill = sl < 0 ? `<span class="pill late">${ICON_LATE}retard ${fmtDur(-sl)}</span>` : `<span class="pill ${sl < 16 ? 'tight' : 'ok'}">marge ${fmtDur(sl)}</span>`;
      const d = R ? P.ofEnd[f] - R.ofEnd[f] : 0;
      const dd = !R || d === 0 ? '<span class="delta-0">—</span>' : `<span class="${d > 0 ? 'delta-up' : 'delta-down'}">${sgn(d)}${fmtDur(d)}</span>`;
      h += `<tr><td><div class="of-cell"><i class="sw" style="background:var(--of${f + 1})"></i><div><b>${o.id}</b>${o.note ? `<span class="of-note">${o.note}</span>` : ''}</div></div></td><td class="mono">${fmtT(o.rel)}</td><td class="mono">${fmtE(P.ofEnd[f])}</td><td class="mono">${fmtE(o.due)}</td><td>${pill}</td><td class="num mono">${dd}</td></tr>`;
    });
    $('#ofTable').innerHTML = h + '</tbody>';
  }

  /* ---------------- detail / explanation ---------------- */
  function explain(i, P) {
    const r = P.reason[i]; const s = P.start[i];
    const nm = j => `« ${OPS[j].code} ${OPS[j].name} »`;
    const crew = curCrew();
    switch (r.k) {
      case 'nc': return `Bloquée par une non-conformité jusqu'à ${fmtT(r.until)} : elle ne peut pas démarrer avant la levée.`;
      case 'kit': return `Le kit de pièces de ce poste n'est disponible qu'à ${fmtT(r.until)}.`;
      case 'release': return `Première opération de l'OF : elle démarre au lancement de l'OF, ${fmtT(s)}.`;
      case 'flow': return `Le produit arrive au poste ${POSTES[OPS[i].p].id} dès la fin de ${nm(r.j)} au poste précédent.`;
      case 'slot': return `Le poste ${POSTES[r.p].id} était complet (${S.slots} emplacements occupés) : l'OF a attendu qu'un emplacement se libère.`;
      case 'pred':
        if (r.type === 'FS') return `Démarre dès la fin de ${nm(r.j)} (lien FS${r.lag ? ' + ' + fmtDur(r.lag) : ''}).`;
        if (r.type === 'SS') return `Démarre ${fmtDur(r.lag)} après le début de ${nm(r.j)} (lien SS + ${fmtDur(r.lag)}).`;
        return `Calée pour finir au plus tôt en même temps que ${nm(r.j)} (lien FF).`;
      case 'now': return `Replanifiée à partir de maintenant (${fmtT(s)}), après le dernier aléa.`;
      case 'operator': {
        const w = crew[r.o]; const lv = w ? (w.skills[OPS[i].skill] || 0) : 0;
        return `Attend ${w ? w.name : "l'opérateur"} (${SKILLS[OPS[i].skill]}, niveau ${lv}), qui termine ${nm(r.j)} sur ${OFS[OPS[r.j].of].id}.`;
      }
      case 'shift': return `Pas assez de temps restant dans l'équipe précédente pour la finir sans passation : démarrage en début d'équipe, ${fmtT(s)}.`;
      case 'priority': return `Les opérateurs qualifiés étaient pris par des OP plus urgentes, dont la marge était plus faible.`;
      default: return '—';
    }
  }
  function renderDetail() {
    const el = $('#detail'); const i = S.selected; const P = cur();
    if (i < 0 || P.start[i] < 0) {
      el.innerHTML = `<h3>Mode d'emploi</h3><p class="card-sub">Quatre gestes pour voir le moteur réagir.</p><ol class="steps">
        <li><b>1</b><span>Déclenchez un aléa ci-dessous.</span></li>
        <li><b>2</b><span>Regardez les indicateurs, le Gantt et les OF se recalculer.</span></li>
        <li><b>3</b><span>Cliquez une barre : Kairos explique pourquoi elle est placée là.</span></li>
        <li><b>4</b><span>Testez le scénario « + 1 intérimaire », puis publiez-le ou abandonnez-le.</span></li></ol>`;
      return;
    }
    const op = OPS[i], f = op.of, crew = curCrew();
    const done = P.end[i] <= S.now, run = P.start[i] < S.now && P.end[i] > S.now;
    const blocked = (S.blk[i] || 0) > S.now && P.start[i] >= S.now;
    const status = done ? 'Terminée' : run ? 'En cours' : 'À venir';
    const avg = P.who[i].reduce((a, o) => a + COEF[crew[o].skills[op.skill] || 1], 0) / P.who[i].length;
    const dur = P.end[i] - P.start[i];
    const who = P.who[i].map(o => `${esc(crew[o].name)} <span class="t-dim" style="color:var(--muted)">(${LEVEL_NAME[crew[o].skills[op.skill]]})</span>`).join(', ');
    const links = op.preds.length ? op.preds.map(pp => `${pp.type} ${OPS[pp.j].code}${pp.lag ? ' + ' + fmtDur(pp.lag) : ''}`).join(' · ') : (op.p === 0 ? 'lancement de l\'OF' : 'arrivée au poste');
    const predNote = S.endOv[i] != null ? ' (dérive incluse)' : '';
    el.innerHTML = `<div class="d-head"><i class="sw" style="background:var(--of${f + 1})"></i><div><div class="d-of">${OFS[f].id} · ${POSTES[op.p].id} ${POSTES[op.p].name}</div><h3>${op.code} ${esc(op.name)}</h3></div><button class="d-close" id="d-close" aria-label="Fermer le détail">Fermer</button></div>
      <div class="chips"><span class="chip">${status}</span>${blocked ? '<span class="chip crit">Bloquée (NC)</span>' : ''}${S.endOv[i] != null ? '<span class="chip crit">Dérive signalée</span>' : ''}${P.chain.has(i) ? '<span class="chip chain">Chaîne critique</span>' : ''}<span class="chip">${SKILLS[op.skill]}${op.minLevel > 1 ? ' niv. ≥ ' + op.minLevel : ''}</span>${op.n > 1 ? '<span class="chip">Binôme</span>' : ''}</div>
      <dl class="kv">
        <dt>Créneau</dt><dd class="mono">${fmtT(P.start[i])} → ${fmtE(P.end[i])}</dd>
        <dt>${op.n > 1 ? 'Opérateurs' : 'Opérateur'}</dt><dd>${who}</dd>
        <dt>Durée</dt><dd>standard ${fmtDur(op.std)} → prédite ${fmtDur(dur)}${predNote} <span style="color:var(--muted);white-space:nowrap">(× ${avg.toFixed(2).replace('.', ',')})</span></dd>
        <dt>Liens</dt><dd class="mono">${links}</dd>
        <dt>Emplacement</dt><dd class="mono">${POSTES[op.p].id} · E${P.sslot[f][op.p] + 1}</dd>
      </dl>
      <div class="why"><div class="why-l">Pourquoi à cette heure ?</div>${esc(explain(i, P))}</div>
      <div class="d-actions">${!done && !run ? '<button class="btn" id="d-nc">Bloquer cette OP (NC)</button>' : ''}${run ? '<button class="btn" id="d-drift">Signaler une dérive</button>' : ''}</div>`;
    $('#d-close').onclick = () => { S.selected = -1; renderGantt(); renderDetail(); };
    const nc = $('#d-nc'); if (nc) nc.onclick = trigNC;
    const dr = $('#d-drift'); if (dr) dr.onclick = trigDrift;
  }

  /* ---------------- log / scenario ---------------- */
  function renderLog() {
    $('#log').innerHTML = S.events.map(e => {
      const imp = [];
      if (e.dMk != null) imp.push(e.dMk === 0 ? 'fin inchangée' : `fin <span class="${e.dMk > 0 ? 'delta-up' : 'delta-down'}">${sgn(e.dMk)}${fmtDur(e.dMk)}</span>`);
      if (e.moved != null) imp.push(`${e.moved} OP déplacées`);
      imp.push(e.late ? `<span class="delta-up">${e.late} OF en retard</span>` : 'OF à l\'heure');
      imp.push(`${e.ms} ms`);
      return `<li class="k-${e.kind}"><div class="lg-top"><span class="mono">${fmtT(e.t)}</span></div><div class="lg-title">${esc(e.title)}</div><div class="lg-detail">${esc(e.detail)}</div><div class="lg-impact">${imp.join('<span aria-hidden="true">·</span>')}</div></li>`;
    }).join('');
  }
  function renderScenario() {
    const el = $('#scenario'), sc = S.scenario;
    $('#boardTitle').textContent = sc ? 'Planning (scénario non publié)' : 'Planning de la ligne';
    if (!sc) { el.hidden = true; el.innerHTML = ''; return; }
    const P = sc.plan, R = S.plan, d = P.makespan - R.makespan;
    el.hidden = false;
    el.innerHTML = `<p><b>Scénario what-if.</b> Un intérimaire (Structure, Mécanique, Essais) rejoint l'équipe du matin à partir de J${sc.from + 1}. Fin de production ${fmtE(P.makespan)} (${d === 0 ? 'inchangée' : sgn(d) + fmtDur(d)}), ${P.kpi.late.length} OF en retard contre ${R.kpi.late.length} dans le planning publié.</p>
      <button class="btn btn-primary" id="sc-pub">Publier le scénario</button><button class="btn" id="sc-drop">Abandonner</button>`;
    $('#sc-pub').onclick = publishScenario;
    $('#sc-drop').onclick = () => { S.scenario = null; renderAll(true); };
  }

  /* ---------------- data tab ---------------- */
  function renderPres() {
    const nowDay = Math.floor(S.now / 64);
    let h = `<thead><tr><th>Opérateur</th><th>Équipe</th>${Array.from({ length: K.DAYS }, (_, d) => `<th class="mono">J${d + 1}</th>`).join('')}</tr></thead><tbody>`;
    S.crew.forEach((w, o) => {
      h += `<tr><td style="white-space:nowrap"><b>${esc(w.name)}</b>${w.type === 'Intérim' ? '<span class="tag">Intérim</span>' : ''}</td><td>${TEAM[w.team]}</td>`;
      for (let d = 0; d < K.DAYS; d++) {
        const st = S.pres[o][d];
        const lab = st === 'P' ? TEAM_S[w.team] : st === 'X' ? '—' : st;
        h += `<td><button class="pc s-${st}${d === nowDay ? ' today' : ''}" data-o="${o}" data-d="${d}" ${d < nowDay || st === 'X' ? 'disabled' : ''} title="${esc(w.name)}, J${d + 1} : ${PRES_NAME[st]}" aria-label="${esc(w.name)}, J${d + 1} : ${PRES_NAME[st]}">${lab}</button></td>`;
      }
      h += '</tr>';
    });
    $('#presTable').innerHTML = h + '</tbody>';
    const teamRisk = Object.keys(TEAM).map(t => {
      const ws = S.crew.filter(w => w.team === t);
      const r = ws.reduce((a, w) => a + w.risk, 0) / Math.max(1, ws.length);
      return `<span class="risk-team"><b>${TEAM[t]}</b> <span class="risk"><i><b style="width:${Math.round(r * 400)}%"></b></i>${Math.round(r * 100)} %</span></span>`;
    }).join('');
    $('#teamRisk').innerHTML = `<span>Prévision d'absence par équipe, agrégée et jamais nominative :</span>${teamRisk}`;
    $('#pend').innerHTML = S.pending
      ? `<span>${S.pending} modification(s) en attente.</span><button class="btn btn-primary" id="p-recalc">Recalculer le planning</button><button class="btn" id="p-cancel">Annuler</button>`
      : `<span style="color:var(--muted)">Légende : M / AM présent · A absent imprévu · C congé validé · F formation · R prêté à une autre ligne. C, F et R sont intouchables pour le solveur.</span>`;
    const rc = $('#p-recalc'); if (rc) rc.onclick = () => { const n = S.pending; replan('presence', 'Présences modifiées', `${n} changement(s) de statut pris en compte depuis l'onglet Données.`); selectTab('plan'); };
    const cc = $('#p-cancel'); if (cc) cc.onclick = () => { S.pres = S.presSnap; S.presSnap = null; S.pending = 0; renderPres(); };
  }
  function renderStatic() {
    const lv = n => `<span class="lvl" aria-label="niveau ${n}">${[1, 2, 3].map(k => `<i class="${k <= n ? '' : 'off'}"></i>`).join('')}</span>`;
    const keys = Object.keys(SKILLS);
    const SH = { STR: 'Struct.', MEC: 'Méca.', HYD: 'Hydrau.', ELE: 'Élec.', ESS: 'Essais', QUA: 'Qualité' };
    let h = `<thead><tr><th>Opérateur</th>${keys.map(k => `<th title="${SKILLS[k]}">${SH[k]}</th>`).join('')}</tr></thead><tbody>`;
    OPERATORS.concat([RENFORT]).forEach(w => {
      h += `<tr><td style="white-space:nowrap"><b>${esc(w.name)}</b> <span style="color:var(--muted)">${TEAM_S[w.team]}</span>${w.renfort ? '<span class="tag">scénario</span>' : w.type === 'Intérim' ? '<span class="tag">Intérim</span>' : ''}</td>${keys.map(k => `<td>${w.skills[k] ? lv(w.skills[k]) : '<span style="color:var(--muted)">—</span>'}</td>`).join('')}</tr>`;
    });
    $('#skillTable').innerHTML = h + '</tbody>';
    let g = '<thead><tr><th>Code</th><th>Opération</th><th>Compétence</th><th class="num">Durée</th><th>Liens</th></tr></thead><tbody>';
    GAMME.forEach(x => {
      g += `<tr><td class="mono">${x.code}</td><td>${esc(x.name)}${x.n > 1 ? '<span class="tag">binôme</span>' : ''}${x.minLevel ? '<span class="tag">niv. ≥ 2</span>' : ''}</td><td>${SKILLS[x.skill]}</td><td class="num mono">${fmtDur(x.h * 4)}</td><td class="mono" style="white-space:nowrap">${(x.preds || []).map(p => `${p[1]} ${p[0]}${p[2] ? ' +' + p[2] + ' h' : ''}`).join(', ') || '—'}</td></tr>`;
    });
    $('#gammeTable').innerHTML = g + '</tbody>';
    $('#archFig').innerHTML = archSVG();
  }

  function archSVG() {
    const t = (x, y, s, o) => `<text x="${x}" y="${y}"${o && o.a ? ` text-anchor="${o.a}"` : ''} font-size="${o && o.fs || 11.5}"${o && o.b ? ' font-weight="600"' : ''} fill="${o && o.c || 'var(--ink)'}">${s}</text>`;
    const box = (x, y, w, h, dash) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="var(--surface)" stroke="var(--axis)"${dash ? ' stroke-dasharray="4 4"' : ''}/>`;
    const b3 = (x, y, w, n, l1, l2, dash) => box(x, y, w, 72, dash) + t(x + w / 2, y + 24, n, { a: 'middle', fs: 13, b: 1 }) + t(x + w / 2, y + 42, l1, { a: 'middle' }) + t(x + w / 2, y + 58, l2, { a: 'middle', c: 'var(--ink-2)' });
    const b2 = (x, y, n, l1) => box(x, y, 296, 56) + t(x + 148, y + 24, n, { a: 'middle', fs: 13, b: 1 }) + t(x + 148, y + 42, l1, { a: 'middle', c: 'var(--ink-2)' });
    const band = (y, name, tag, hub) => `<rect x="36" y="${y}" width="688" height="120" rx="8" fill="${hub ? 'var(--of1)' : 'none'}" fill-opacity="${hub ? .1 : 1}" stroke="${hub ? 'var(--of1)' : 'var(--axis)'}" stroke-width="${hub ? 2 : 1.25}"/>` + t(52, y + 22, name, { fs: 13, b: 1 }) + t(708, y + 22, tag, { a: 'end', c: hub ? 'var(--ink)' : 'var(--ink-2)' });
    const arr = d => `<path d="${d}" fill="none" stroke="var(--axis)" stroke-width="1.4" marker-end="url(#ar)"/>`;
    const arr2 = d => `<path d="${d}" fill="none" stroke="var(--axis)" stroke-width="1.4" marker-start="url(#ar)" marker-end="url(#ar)"/>`;
    return `<svg viewBox="0 0 760 932" role="img" aria-label="Architecture cible en cinq couches autour de PostgreSQL"><defs><marker id="ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="var(--axis)"/></marker></defs>
      ${t(36, 32, 'Cinq couches, un hub : tout passe par PostgreSQL', { fs: 16, b: 1 })}
      ${t(36, 54, 'Aucune couche n\'appelle directement une autre ; les numéros renvoient au flux ci-contre.', { c: 'var(--ink-2)' })}
      ${band(76, '1 · Sources externes', 'lecture seule')}
      ${b3(52, 108, 152, 'ERP SAP S/4HANA', 'API OData standard', 'OF, gammes, NC')}${b3(220, 108, 152, 'MES', 'Temps réels, statuts', 'kitting')}${b3(388, 108, 152, 'Présence', 'Saisie dans Kairos', 'compétences')}${b3(556, 108, 152, 'Plateforme data', 'Optionnelle', 'données gouvernées', true)}
      ${arr('M128 196V242')}${arr('M296 196V242')}${arr('M464 196V242')}<path d="M632 196V242" fill="none" stroke="var(--axis)" stroke-width="1.4" stroke-dasharray="4 4" marker-end="url(#ar)"/>
      ${t(140, 216, '1 · extraction', { c: 'var(--ink-2)' })}${t(140, 232, 'planifiée', { c: 'var(--ink-2)' })}
      ${band(244, '2 · Data pipeline ETL', 'Python, jobs planifiés')}
      ${b3(52, 276, 152, 'Extract', 'OData, REST, CSV', 'lecture seule')}${b3(220, 276, 152, 'Staging', 'JSON brut,', 'jamais modifié')}${b3(388, 276, 152, 'Transform', 'Nettoyage, clés,', 'normalisation')}${b3(556, 276, 152, 'Load', 'Upsert idempotent', 'sans doublon')}
      ${arr('M204 312H219')}${arr('M372 312H387')}${arr('M540 312H555')}
      ${arr('M632 364V410')}${t(620, 392, '2 · staging brut, puis upsert vers les tables propres', { a: 'end', c: 'var(--ink-2)' })}
      ${band(412, '3 · PostgreSQL, le hub', 'source de vérité et tampon', true)}
      ${b3(52, 444, 208, 'Référentiel', 'Postes, opérateurs,', 'compétences, présence')}${b3(276, 444, 208, 'Planning', 'OP, liens, affectations,', 'scénarios what-if')}${b3(500, 444, 208, 'Opérationnel et ML', 'Temps réels, NC, kits,', 'prédictions, audit')}
      ${arr2('M200 534V586')}${arr2('M560 534V586')}
      ${t(212, 564, '6 · lecture de l\'état  ·  7 · écriture du planning', { c: 'var(--ink-2)' })}${t(572, 564, '3 · requêtes SQL', { c: 'var(--ink-2)' })}
      <rect x="36" y="588" width="328" height="320" rx="8" fill="none" stroke="var(--axis)" stroke-width="1.25"/>${t(52, 610, '4 · Moteur asynchrone', { fs: 13, b: 1 })}${t(348, 610, 'hors requête HTTP', { a: 'end', c: 'var(--ink-2)' })}
      ${b2(52, 620, 'File Redis + worker Celery', 'Calcul en tâche de fond, écran fluide')}${b2(52, 692, 'Solveur OR-Tools CP-SAT', 'RCPSP multi-compétences, 30 s maximum')}${b2(52, 764, 'ML LightGBM', 'Durées prédites, P80, risque d\'absence')}${b2(52, 836, 'Assistant LLM', 'Explique le planning, ne décide jamais')}
      <rect x="396" y="588" width="328" height="320" rx="8" fill="none" stroke="var(--axis)" stroke-width="1.25"/>${t(412, 610, '5 · Pilotage', { fs: 13, b: 1 })}${t(708, 610, 'FastAPI + React', { a: 'end', c: 'var(--ink-2)' })}
      ${b2(412, 620, 'API FastAPI', 'REST + WebSocket, validation Pydantic')}${b2(412, 692, 'SSO OIDC et rôles', 'Superviseur, chef d\'équipe, admin')}${b2(412, 764, 'Gantt live', 'Par poste ou opérateur, chaîne critique')}${b2(412, 836, 'Alertes et what-if', 'Aléas, scénarios du chef d\'équipe')}
      ${arr('M412 640H349')}${arr('M348 658H411')}${t(380, 634, '4–5', { a: 'middle', c: 'var(--ink-2)' })}${t(380, 674, '8–9', { a: 'middle', c: 'var(--ink-2)' })}
    </svg>`;
  }

  /* ---------------- orchestration ---------------- */
  function renderAll(flash) {
    $('#nowOut').textContent = fmtT(S.now);
    renderScenario(); renderKPIs(); renderGantt(); renderLegend(); renderCheck(); renderOF(); renderDetail(); renderLog();
    if (!$('#tab-data').hidden) renderPres();
    if (flash) { const k = $('#kpis'); k.classList.remove('flash'); void k.offsetWidth; k.classList.add('flash'); }
  }
  function selectTab(id) {
    ['plan', 'data', 'arch'].forEach(x => {
      $('#t-' + x).setAttribute('aria-selected', String(x === id));
      $('#tab-' + x).hidden = x !== id;
    });
    if (id === 'data') renderPres();
    if (id === 'plan') renderGantt();
  }

  function bind() {
    $('#t-plan').onclick = () => selectTab('plan');
    $('#t-data').onclick = () => selectTab('data');
    $('#t-arch').onclick = () => selectTab('arch');
    document.querySelectorAll('[data-adv]').forEach(b => { b.onclick = () => advance(+b.dataset.adv); });
    $('#tr-nc').onclick = trigNC; $('#tr-abs').onclick = trigAbs; $('#tr-kit').onclick = trigKit; $('#tr-drift').onclick = trigDrift;
    $('#whatif').onclick = whatIf; $('#reset').onclick = reset;
    const setView = v => { S.view = v; $('#v-poste').setAttribute('aria-pressed', String(v === 'poste')); $('#v-op').setAttribute('aria-pressed', String(v === 'op')); renderGantt(); renderLegend(); };
    $('#v-poste').onclick = () => setView('poste'); $('#v-op').onclick = () => setView('op');
    const setZoom = z => { S.zoom = z; $('#z-10').setAttribute('aria-pressed', String(z === 10)); $('#z-5').setAttribute('aria-pressed', String(z === 5)); renderGantt(); };
    $('#z-10').onclick = () => setZoom(10); $('#z-5').onclick = () => setZoom(5);
    $('#c-chain').onchange = e => { S.showChain = e.target.checked; renderGantt(); };
    $('#c-ghost').onchange = e => { S.showGhost = e.target.checked; renderGantt(); };
    const svg = $('#gantt'), tip = $('#tip');
    svg.addEventListener('mousemove', e => {
      const g = e.target.closest && e.target.closest('.bar-g');
      if (!g) { tip.hidden = true; return; }
      const i = +g.dataset.i, P = cur(), op = OPS[i], crew = curCrew();
      tip.innerHTML = `<b>${OFS[op.of].id} · ${op.code} ${esc(op.name)}</b><div class="t-dim">${POSTES[op.p].id} ${POSTES[op.p].name} · ${P.who[i].map(o => esc(crew[o].name)).join(', ')}</div><div class="mono" style="margin-top:3px">${fmtT(P.start[i])} → ${fmtE(P.end[i])}</div><div class="t-dim">standard ${fmtDur(op.std)} · prédite ${fmtDur(P.end[i] - P.start[i])}</div>`;
      tip.hidden = false;
      const r = tip.getBoundingClientRect();
      let x = e.clientX + 14, y = e.clientY + 14;
      if (x + r.width > window.innerWidth - 8) x = e.clientX - r.width - 14;
      if (y + r.height > window.innerHeight - 8) y = e.clientY - r.height - 14;
      tip.style.left = Math.max(8, x) + 'px'; tip.style.top = Math.max(8, y) + 'px';
    });
    svg.addEventListener('mouseleave', () => { tip.hidden = true; });
    svg.addEventListener('click', e => {
      const g = e.target.closest && e.target.closest('.bar-g');
      const i = g ? +g.dataset.i : -1;
      S.selected = i === S.selected ? -1 : i;
      renderGantt(); renderDetail();
      if (S.selected >= 0 && window.innerWidth < 1100) $('#detail').scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    });
    $('#presTable').addEventListener('click', e => {
      const b = e.target.closest('.pc'); if (!b || b.disabled) return;
      const o = +b.dataset.o, d = +b.dataset.d;
      if (!S.presSnap) S.presSnap = S.pres.map(a => a.slice());
      const st = S.pres[o][d];
      S.pres[o][d] = PRES_CYCLE[(PRES_CYCLE.indexOf(st) + 1) % PRES_CYCLE.length];
      S.pending++;
      renderPres();
      const nb = document.querySelector(`.pc[data-o="${o}"][data-d="${d}"]`); if (nb) nb.focus();
    });
    let raf = 0;
    const re = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => { if (!$('#tab-plan').hidden) renderGantt(); }); };
    if (window.ResizeObserver) new ResizeObserver(re).observe($('#ganttWrap')); else window.addEventListener('resize', re);
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    if (mq.addEventListener) mq.addEventListener('change', re);
    new MutationObserver(re).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  bind();
  renderStatic();
  reset();
  const h = (location.hash || '').slice(1);
  if (h === 'donnees') selectTab('data'); else if (h === 'architecture') selectTab('arch');
})();
