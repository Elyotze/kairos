/* ===== Kairos engine — pure JS, no DOM ===== */
const K = { DAYQ: 64, SHIFTQ: 32, DAYS: 10, SIM_DAYS: 18 };
K.HORIZON = K.SIM_DAYS * K.DAYQ;
const COEF = [0, 1.3, 1.0, 0.85];
const LEVEL_NAME = ['', 'en formation', 'confirmé', 'expert'];

const SKILLS = { STR: 'Structure', MEC: 'Mécanique', HYD: 'Hydraulique', ELE: 'Électrique', ESS: 'Essais', QUA: 'Qualité' };
const POSTES = [
  { id: 'P1', name: 'Structure' },
  { id: 'P2', name: 'Mécanique' },
  { id: 'P3', name: 'Hydraulique' },
  { id: 'P4', name: 'Électrique' },
  { id: 'P5', name: 'Essais et contrôle' }
];
const GAMME = [
  { code: '1.1', p: 0, name: 'Mise en place du bâti', h: 2, skill: 'STR', n: 2 },
  { code: '1.2', p: 0, name: 'Pose du châssis principal', h: 4, skill: 'STR', n: 2, preds: [['1.1', 'FS', 0]] },
  { code: '1.3', p: 0, name: 'Fixation des sous-ensembles', h: 3, skill: 'STR', n: 1, preds: [['1.2', 'FS', 0]] },
  { code: '1.4', p: 0, name: 'Contrôle géométrique', h: 1, skill: 'QUA', n: 1, preds: [['1.3', 'FS', 0]] },
  { code: '2.1', p: 1, name: 'Montage du groupe moteur', h: 4, skill: 'MEC', n: 2 },
  { code: '2.2', p: 1, name: 'Pose de la transmission', h: 3, skill: 'MEC', n: 1, preds: [['2.1', 'SS', 2]] },
  { code: '2.3', p: 1, name: 'Montage des organes de liaison', h: 2.5, skill: 'MEC', n: 1, preds: [['2.2', 'FS', 0]] },
  { code: '2.4', p: 1, name: 'Contrôle des serrages', h: 1, skill: 'QUA', n: 1, preds: [['2.1', 'FS', 0], ['2.3', 'FS', 0]] },
  { code: '3.1', p: 2, name: 'Pose des tuyauteries', h: 4, skill: 'HYD', n: 1 },
  { code: '3.2', p: 2, name: 'Montage du groupe hydraulique', h: 3, skill: 'HYD', n: 1 },
  { code: '3.3', p: 2, name: 'Remplissage et purge', h: 2, skill: 'HYD', n: 1, preds: [['3.1', 'FS', 0], ['3.2', 'FS', 0]] },
  { code: '3.4', p: 2, name: "Test d'étanchéité", h: 1.5, skill: 'ESS', n: 1, preds: [['3.3', 'FS', 0]] },
  { code: '4.1', p: 3, name: 'Câblage du faisceau principal', h: 5, skill: 'ELE', n: 1 },
  { code: '4.2', p: 3, name: "Pose de l'armoire électrique", h: 3, skill: 'ELE', n: 1, preds: [['4.1', 'SS', 1]] },
  { code: '4.3', p: 3, name: 'Raccordement des capteurs', h: 3, skill: 'ELE', n: 1, preds: [['4.2', 'FS', 0], ['4.1', 'FF', 0]] },
  { code: '4.4', p: 3, name: "Contrôle d'isolement", h: 1, skill: 'QUA', n: 1, preds: [['4.3', 'FS', 0]] },
  { code: '5.1', p: 4, name: 'Mise sous tension', h: 1, skill: 'ESS', n: 1 },
  { code: '5.2', p: 4, name: 'Essais fonctionnels', h: 4, skill: 'ESS', n: 1, preds: [['5.1', 'FS', 0]] },
  { code: '5.3', p: 4, name: 'Retouches et finitions', h: 2, skill: 'MEC', n: 1, preds: [['5.2', 'FS', 0]] },
  { code: '5.4', p: 4, name: 'Contrôle final et libération', h: 1.5, skill: 'QUA', n: 1, minLevel: 2, preds: [['5.3', 'FS', 0]] }
];
const OFS = [
  { id: 'OF-101', rel: 0, due: 4 * 64 + 8 },
  { id: 'OF-102', rel: 0, due: 4 * 64 + 40 },
  { id: 'OF-103', rel: 16, due: 7 * 64 + 8, variant: { 1: 1.2 }, note: 'option mécanique renforcée' },
  { id: 'OF-104', rel: 48, due: 5 * 64 + 8 },
  { id: 'OF-105', rel: 64, due: 6 * 64 + 40, variant: { 3: 1.3 }, note: 'option faisceau étendu' },
  { id: 'OF-106', rel: 96, due: 7 * 64 + 40 },
  { id: 'OF-107', rel: 128, due: 8 * 64 + 40 },
  { id: 'OF-108', rel: 160, due: 9 * 64 + 40, variant: { 3: 1.3 }, note: 'option faisceau étendu' }
];
const OPERATORS = [
  { id: 'o1', name: 'Léa M.', team: 'M', type: 'Interne', skills: { STR: 3, MEC: 2, QUA: 1 }, risk: 0.04 },
  { id: 'o2', name: 'Hugo B.', team: 'M', type: 'Interne', skills: { STR: 2, MEC: 3 }, risk: 0.06 },
  { id: 'o3', name: 'Inès K.', team: 'M', type: 'Interne', skills: { ELE: 3, ESS: 2 }, risk: 0.05 },
  { id: 'o4', name: 'Karim D.', team: 'M', type: 'Interne', skills: { HYD: 3, MEC: 2, ESS: 2 }, risk: 0.09 },
  { id: 'o5', name: 'Chloé R.', team: 'M', type: 'Interne', skills: { QUA: 3, ESS: 3, ELE: 2 }, risk: 0.03 },
  { id: 'o6', name: 'Mathis P.', team: 'M', type: 'Intérim', skills: { STR: 2, HYD: 1, ELE: 1 }, risk: 0.12 },
  { id: 'o7', name: 'Sarah L.', team: 'S', type: 'Interne', skills: { STR: 3, QUA: 2 }, risk: 0.05 },
  { id: 'o8', name: 'Yanis T.', team: 'S', type: 'Interne', skills: { MEC: 3, HYD: 2 }, risk: 0.07 },
  { id: 'o9', name: 'Nora A.', team: 'S', type: 'Interne', skills: { ELE: 3, QUA: 2, ESS: 2 }, risk: 0.04 },
  { id: 'o10', name: 'Lucas G.', team: 'S', type: 'Interne', skills: { ESS: 3, ELE: 2, QUA: 2 }, risk: 0.06 },
  { id: 'o11', name: 'Emma V.', team: 'S', type: 'Interne', skills: { HYD: 3, STR: 1, MEC: 2 }, risk: 0.08 },
  { id: 'o12', name: 'Théo C.', team: 'S', type: 'Intérim', skills: { MEC: 3, STR: 2, ELE: 1 }, risk: 0.11 }
];
const RENFORT = { id: 'r1', name: 'Renfort int.', team: 'M', type: 'Intérim', skills: { STR: 2, MEC: 2, ESS: 1 }, risk: 0.1, renfort: true };

/* ---- static model ---- */
const NG = GAMME.length;
const OPS = [];
const STAGE = [];
OFS.forEach((of, f) => {
  STAGE.push(POSTES.map(() => []));
  GAMME.forEach(g => {
    const mult = (of.variant && of.variant[g.p]) || 1;
    const i = OPS.length;
    OPS.push({ i, of: f, p: g.p, code: g.code, name: g.name, skill: g.skill, n: g.n, minLevel: g.minLevel || 1,
      std: Math.max(1, Math.round(g.h * 4 * mult)), preds: [], succs: [] });
    STAGE[f][g.p].push(i);
  });
});
OPS.forEach(op => {
  const g = GAMME.find(x => x.code === op.code);
  (g.preds || []).forEach(([code, type, lagH]) => {
    const j = op.of * NG + GAMME.findIndex(x => x.code === code);
    const lag = Math.round(lagH * 4);
    op.preds.push({ j, type, lag });
    OPS[j].succs.push({ i: op.i, type, lag });
  });
});
const TAILIN = new Float64Array(OPS.length);
function tailIn(i) {
  if (TAILIN[i]) return TAILIN[i];
  const op = OPS[i]; let best = op.std;
  for (const s of op.succs) {
    const ts = tailIn(s.i); let v;
    if (s.type === 'FS') v = op.std + s.lag + ts;
    else if (s.type === 'SS') v = s.lag + ts;
    else v = op.std + s.lag + (ts - OPS[s.i].std);
    if (v > best) best = v;
  }
  return (TAILIN[i] = best);
}
OPS.forEach(o => tailIn(o.i));
const STAGELEN = STAGE.map(st => st.map(list => Math.max(...list.filter(i => OPS[i].preds.length === 0).map(i => TAILIN[i]))));
const REST = STAGELEN.map(sl => sl.map((_, p) => sl.slice(p).reduce((a, b) => a + b, 0)));
const TAIL = OPS.map(op => TAILIN[op.i] + (op.p < 4 ? REST[op.of][op.p + 1] : 0));

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---- simulation: parallel schedule generation with slots, shifts, skills ---- */
function simulate(ctx, rng, noise, mode) {
  const { T, frozen, crew, pres, kit, blk, endOv, slots } = ctx;
  const N = OPS.length, NO = crew.length, NF = OFS.length;
  const start = new Int32Array(N).fill(-1), end = new Int32Array(N).fill(-1);
  const who = new Array(N);
  const pr = new Float64Array(N);
  const base = mode === 'base' || mode === 'repair' ? ctx.base : null;
  const repair = mode === 'repair' && base;
  for (let i = 0; i < N; i++) {
    const b = base && base.start[i] >= 0 ? base.start[i] : OFS[OPS[i].of].due - TAIL[i];
    pr[i] = b + (noise ? (rng() - 0.5) * noise : 0);
  }
  const ofp = OFS.map(() => (noise ? (rng() - 0.5) * noise : 0));
  const ofKey = (f, np) => (base && base.enter[f][np] >= 0 ? base.enter[f][np] : OFS[f].due - REST[f][np]) + ofp[f];
  const opn = crew.map(() => (noise ? rng() * 0.03 : 0));
  const busy = new Int32Array(NO), load = new Float64Array(NO);
  const stg = new Int8Array(NF).fill(-1), slot = new Int8Array(NF).fill(-1);
  const enter = [], leave = [], sslot = [];
  for (let f = 0; f < NF; f++) { enter.push(new Int32Array(5).fill(-1)); leave.push(new Int32Array(5).fill(-1)); sslot.push(new Int8Array(5).fill(-1)); }
  const occ = POSTES.map(() => new Int8Array(slots).fill(-1));
  const ofEnd = new Int32Array(NF).fill(-1);
  let doneOF = 0;
  const kitAt = (f, p) => kit[f * 5 + p] || 0;
  const stageDone = (f, p, t) => { for (const i of STAGE[f][p]) if (end[i] < 0 || end[i] > t) return false; return true; };
  const maxEnd = (f, p) => { let m = -1; for (const i of STAGE[f][p]) if (end[i] > m) m = end[i]; return m; };
  function moveTo(f, np, s, t) {
    if (slot[f] >= 0) { occ[stg[f]][slot[f]] = -1; leave[f][stg[f]] = t; }
    occ[np][s] = f; slot[f] = s; stg[f] = np; enter[f][np] = t; sslot[f][np] = s;
  }
  const elig = [];
  const cands = [];
  const ext = [];
  for (let f = 0; f < NF; f++) { ext.push(OFS[f].rel); for (let p = 0; p < 5; p++) if (kit[f * 5 + p]) ext.push(kit[f * 5 + p]); }
  for (const k in blk) ext.push(blk[k]);
  if (repair) { for (let i = 0; i < N; i++) if (base.start[i] >= T) ext.push(base.start[i]); for (let f = 0; f < NF; f++) for (let p = 0; p < 5; p++) if (base.enter[f][p] >= T) ext.push(base.enter[f][p]); }
  let t, acted;
  const nextEvent = (t) => {
    let nt = (Math.floor(t / K.SHIFTQ) + 1) * K.SHIFTQ;
    for (let i = 0; i < N; i++) {
      if (start[i] < 0) continue;
      if (end[i] > t && end[i] < nt) nt = end[i];
      for (const s of OPS[i].succs) if (s.type === 'SS') { const v = start[i] + s.lag; if (v > t && v < nt) nt = v; }
    }
    for (const v of ext) if (v > t && v < nt) nt = v;
    return nt;
  };
  for (t = 0; t < K.HORIZON && doneOF < NF; t++) {
    acted = false;
    /* completions */
    for (let f = 0; f < NF; f++) {
      if (stg[f] === 4 && ofEnd[f] < 0 && stageDone(f, 4, t)) {
        ofEnd[f] = maxEnd(f, 4); leave[f][4] = t; occ[4][slot[f]] = -1; slot[f] = -1; stg[f] = 5; doneOF++;
      }
    }
    /* movements */
    if (t < T) {
      for (let f = 0; f < NF; f++) for (let p = 0; p < 5; p++) if (frozen.enter[f][p] === t) moveTo(f, p, frozen.sslot[f][p], t);
    } else {
      const mv = [];
      for (let f = 0; f < NF; f++) {
        if (repair && base.enter[f][stg[f] + 1] > t) continue;
        if (stg[f] === -1) { if (Math.max(OFS[f].rel, kitAt(f, 0)) <= t) mv.push(f); }
        else if (stg[f] < 4 && stageDone(f, stg[f], t)) mv.push(f);
      }
      if (mv.length) {
        mv.sort((a, b) => ofKey(a, stg[a] + 1) - ofKey(b, stg[b] + 1));
        for (const f of mv) {
          const np = stg[f] + 1; const row = occ[np];
          let s = -1; for (let k = 0; k < slots; k++) if (row[k] < 0) { s = k; break; }
          if (s >= 0) { moveTo(f, np, s, t); acted = true; }
        }
      }
    }
    /* dispatch */
    if (t < T) {
      const list = frozen.byStart.get(t);
      if (list) for (const i of list) {
        start[i] = t; end[i] = endOv[i] != null ? endOv[i] : frozen.end[i]; who[i] = frozen.who[i];
        for (const o of who[i]) { if (end[i] > busy[o]) busy[o] = end[i]; load[o] += end[i] - t; }
      }
      continue;
    }
    elig.length = 0;
    for (let f = 0; f < NF; f++) {
      const p = stg[f]; if (p < 0 || p > 4) continue;
      if (kitAt(f, p) > t) continue;
      for (const i of STAGE[f][p]) {
        if (start[i] >= 0) continue;
        if ((blk[i] || 0) > t) continue;
        if (repair && base.start[i] > t) continue;
        let ok = true;
        for (const pp of OPS[i].preds) {
          const j = pp.j;
          if (pp.type === 'FS') { if (end[j] < 0 || end[j] + pp.lag > t) { ok = false; break; } }
          else if (pp.type === 'SS') { if (start[j] < 0 || start[j] + pp.lag > t) { ok = false; break; } }
          else if (start[j] < 0) { ok = false; break; }
        }
        if (ok) elig.push(i);
      }
    }
    if (!elig.length) { if (!acted) t = nextEvent(t) - 1; continue; }
    elig.sort((a, b) => pr[a] - pr[b]);
    const day = Math.floor(t / K.DAYQ), r = t % K.DAYQ;
    const team = r < K.SHIFTQ ? 'M' : 'S';
    const shEnd = day * K.DAYQ + (team === 'M' ? K.SHIFTQ : K.DAYQ);
    for (const i of elig) {
      const op = OPS[i];
      cands.length = 0;
      for (let o = 0; o < NO; o++) {
        const w = crew[o];
        if (w.team !== team || busy[o] > t) continue;
        const lv = w.skills[op.skill] || 0;
        if (lv < op.minLevel) continue;
        if (pres[o][day] !== 'P') continue;
        if (t + Math.ceil(op.std * COEF[lv]) > shEnd) continue;
        cands.push({ o, lv, c: COEF[lv] + opn[o] + load[o] * 0.0004 - (base && base.who[i] && base.who[i].includes(o) ? 0.6 : 0) });
      }
      if (cands.length < op.n) continue;
      cands.sort((a, b) => a.c - b.c);
      const sel = cands.slice(0, op.n);
      let sum = 0; for (const x of sel) sum += COEF[x.lv];
      const dur = Math.max(1, Math.round(op.std * sum / op.n));
      if (t + dur > shEnd) continue;
      let ffok = true;
      for (const pp of op.preds) if (pp.type === 'FF' && end[pp.j] + pp.lag > t + dur) { ffok = false; break; }
      if (!ffok) continue;
      start[i] = t; end[i] = t + dur; who[i] = sel.map(x => x.o);
      for (const x of sel) { busy[x.o] = t + dur; load[x.o] += dur; }
      acted = true;
    }
    if (!acted) t = nextEvent(t) - 1;
  }
  let makespan = 0, tard = 0, late = 0; const missing = [];
  for (let i = 0; i < N; i++) { if (start[i] < 0) missing.push(i); else if (end[i] > makespan) makespan = end[i]; }
  for (let f = 0; f < NF; f++) {
    if (ofEnd[f] < 0) { tard += 9999; late++; continue; }
    const d = ofEnd[f] - OFS[f].due; if (d > 0) { tard += d; late++; }
  }
  return { start, end, who, enter, leave, sslot, ofEnd, makespan, tard, late, missing, T };
}

function movedCount(plan, base, T) {
  if (!base) return 0;
  let m = 0;
  for (let i = 0; i < OPS.length; i++) {
    if (plan.start[i] < T || base.start[i] < 0) continue;
    if (Math.abs(plan.start[i] - base.start[i]) >= 4) m++;
  }
  return m;
}
function costOf(plan, base, w) {
  if (plan.missing.length) return 1e7 + plan.missing.length * 1000;
  return plan.makespan + 0.6 * plan.tard + (base ? (w == null ? 2 : w) * movedCount(plan, base, plan.T) : 0);
}

function optimize(ctx, base, passes) {
  const t0 = (typeof performance !== 'undefined' ? performance : Date).now();
  const rng = mulberry32(ctx.seed || 20260930);
  let best = null, bestCost = Infinity, firstCost = 0;
  const P = passes || 160;
  ctx.base = base;
  for (let k = 0; k < P; k++) {
    const noise = k === 0 ? 0 : [12, 36, 80][k % 3];
    const mode = base ? (k === 0 ? 'repair' : k % 2 === 1 ? 'base' : 'due') : 'due';
    const plan = simulate(ctx, rng, mode === 'base' ? noise / 3 : noise, mode);
    const c = costOf(plan, base, ctx.wStab);
    if (k === 0) firstCost = c;
    if (c < bestCost) { bestCost = c; best = plan; }
  }
  const t1 = (typeof performance !== 'undefined' ? performance : Date).now();
  best.stats = { passes: P, ms: Math.max(1, Math.round(t1 - t0)), firstCost, bestCost };
  best.moved = movedCount(best, base, ctx.T);
  return best;
}

/* ---- explanation: which constraint fixed each start ---- */
function analyze(plan, ctx, prev) {
  const N = OPS.length;
  const reason = new Array(N), binder = new Int32Array(N).fill(-1);
  const endIdx = new Map();
  for (let k = 0; k < N; k++) if (plan.start[k] >= 0) for (const o of plan.who[k]) endIdx.set(o + ':' + plan.end[k], k);
  for (let i = 0; i < N; i++) {
    const s = plan.start[i];
    if (s < 0) { reason[i] = { k: 'none' }; continue; }
    if (s < ctx.T && prev && prev.reason) { reason[i] = prev.reason[i]; binder[i] = prev.binder[i]; continue; }
    const op = OPS[i], f = op.of, p = op.p;
    const b = ctx.blk[i] || 0;
    if (b > 0 && b >= s) { reason[i] = { k: 'nc', until: b }; continue; }
    const ka = ctx.kit[f * 5 + p] || 0;
    if (p > 0 && ka > 0 && ka >= s) { reason[i] = { k: 'kit', until: ka }; continue; }
    if (plan.enter[f][p] === s) {
      if (p === 0) {
        const rel = Math.max(OFS[f].rel, ctx.kit[f * 5] || 0);
        if (rel >= s) { reason[i] = { k: 'release' }; continue; }
      } else {
        let jm = -1, em = -1;
        for (const j of STAGE[f][p - 1]) if (plan.end[j] > em) { em = plan.end[j]; jm = j; }
        if (em >= s) { reason[i] = { k: 'flow', j: jm }; binder[i] = jm; continue; }
      }
      const sl = plan.sslot[f][p]; let jm = -1, em = -1;
      for (let g = 0; g < OFS.length; g++) {
        if (g === f || plan.sslot[g][p] !== sl || plan.leave[g][p] !== s) continue;
        for (const j of STAGE[g][p]) if (plan.end[j] > em) { em = plan.end[j]; jm = j; }
      }
      reason[i] = { k: 'slot', p }; binder[i] = jm; continue;
    }
    let pj = -1, pt = -1, pk = null;
    for (const pp of op.preds) {
      const j = pp.j; let tt;
      if (pp.type === 'FS') tt = plan.end[j] + pp.lag;
      else if (pp.type === 'SS') tt = plan.start[j] + pp.lag;
      else tt = plan.end[j] + pp.lag - (plan.end[i] - plan.start[i]);
      if (tt > pt) { pt = tt; pj = j; pk = pp; }
    }
    if (pj >= 0 && pt >= s) { reason[i] = { k: 'pred', j: pj, type: pk.type, lag: pk.lag }; binder[i] = pj; continue; }
    if (ctx.T > 0 && s === ctx.T) { reason[i] = { k: 'now' }; continue; }
    let oj = -1, oo = -1;
    for (const o of plan.who[i]) { const k = endIdx.get(o + ':' + s); if (k != null) { oj = k; oo = o; break; } }
    if (oj >= 0) { reason[i] = { k: 'operator', j: oj, o: oo }; binder[i] = oj; continue; }
    if (s % K.SHIFTQ === 0) { reason[i] = { k: 'shift' }; binder[i] = pj >= 0 ? pj : -1; continue; }
    reason[i] = { k: 'priority' }; binder[i] = pj;
  }
  let last = -1, le = -1;
  for (let i = 0; i < N; i++) if (plan.end[i] > le) { le = plan.end[i]; last = i; }
  const chain = new Set(); let c = last;
  while (c >= 0 && !chain.has(c)) { chain.add(c); c = binder[c]; }
  plan.reason = reason; plan.binder = binder; plan.chain = chain;
  return plan;
}

/* ---- independent checker: every hard constraint ---- */
function validate(plan, ctx) {
  const errs = [];
  const { crew, pres, slots, T } = ctx;
  for (let i = 0; i < OPS.length; i++) {
    const op = OPS[i], s = plan.start[i], e = plan.end[i];
    if (s < 0) { errs.push('non planifiée ' + i); continue; }
    for (const pp of op.preds) {
      const j = pp.j;
      if (pp.type === 'FS' && s < plan.end[j] + pp.lag) errs.push('FS ' + i);
      if (pp.type === 'SS' && s < plan.start[j] + pp.lag) errs.push('SS ' + i);
      if (pp.type === 'FF' && e < plan.end[j] + pp.lag) errs.push('FF ' + i);
    }
    const f = op.of, p = op.p;
    if (s < plan.enter[f][p] || (plan.leave[f][p] >= 0 && e > plan.leave[f][p])) errs.push('poste ' + i);
    if (plan.who[i].length !== op.n) errs.push('effectif ' + i);
    for (const o of plan.who[i]) if ((crew[o].skills[op.skill] || 0) < op.minLevel) errs.push('compétence ' + i);
    if (s >= T) {
      const day = Math.floor(s / K.DAYQ), r = s % K.DAYQ, team = r < K.SHIFTQ ? 'M' : 'S';
      const shEnd = day * K.DAYQ + (team === 'M' ? K.SHIFTQ : K.DAYQ);
      for (const o of plan.who[i]) {
        if (crew[o].team !== team) errs.push('équipe ' + i);
        if (pres[o][day] !== 'P') errs.push('présence ' + i);
      }
      if (e > shEnd) errs.push('passation ' + i);
      if ((ctx.blk[i] || 0) > s) errs.push('NC ' + i);
      if ((ctx.kit[f * 5 + p] || 0) > s) errs.push('kit ' + i);
    }
  }
  for (let f = 0; f < OFS.length; f++) for (let p = 1; p < 5; p++) {
    let em = -1; for (const j of STAGE[f][p - 1]) em = Math.max(em, plan.end[j]);
    if (plan.enter[f][p] < em) errs.push('flux ' + f + '/' + p);
  }
  for (let p = 0; p < 5; p++) {
    const iv = [];
    for (let f = 0; f < OFS.length; f++) if (plan.enter[f][p] >= 0) iv.push([plan.enter[f][p], plan.leave[f][p] < 0 ? 1e9 : plan.leave[f][p], plan.sslot[f][p]]);
    for (let a = 0; a < iv.length; a++) {
      let c = 0;
      for (let b = 0; b < iv.length; b++) if (iv[b][0] <= iv[a][0] && iv[a][0] < iv[b][1]) c++;
      if (c > slots) errs.push('capacité P' + (p + 1));
      for (let b = a + 1; b < iv.length; b++) if (iv[a][2] === iv[b][2] && iv[a][0] < iv[b][1] && iv[b][0] < iv[a][1]) errs.push('emplacement P' + (p + 1));
    }
  }
  const byO = crew.map(() => []);
  for (let i = 0; i < OPS.length; i++) if (plan.start[i] >= 0) for (const o of plan.who[i]) byO[o].push([plan.start[i], plan.end[i]]);
  byO.forEach((l, o) => { l.sort((a, b) => a[0] - b[0]); for (let k = 1; k < l.length; k++) if (l[k][0] < l[k - 1][1]) errs.push('chevauchement ' + crew[o].name); });
  return errs;
}

if (typeof module !== 'undefined') module.exports = { K, COEF, SKILLS, POSTES, GAMME, OFS, OPERATORS, RENFORT, OPS, STAGE, TAIL, simulate, optimize, analyze, validate, movedCount, mulberry32 }; // tests Node
