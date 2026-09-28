// Le puits central d'un niveau : noyau, volée d'escalier, palier, passerelle, coursive,
// colonnes à bagues lumineuses, façade percée, luminaires du plafond, numéros de niveau.
import {
  COL_R, FAC_T, FLIGHT, LAND_HALF, LH, NLEV, N_COL, PAL, R_COL, R_CORE, R_FAC, R_GAL, R_LAND, R_OUT, R_PARA, R_SILO, R_STEP,
  SLAB, STEPS, STYLE, hex, landingAngle, type RGB,
} from '../config';
import { ARROW, POSTERS_S1, POSTERS_S3, GRAFFITI_S1, GRAFFITI_S3 } from '../world/decalTiles';
import type { LevelInfo } from '../world/levels';
import { rect, ring, subtract, normAngle } from '../world/voxel2d';
import { Gen, TAU, deg, polar, yawTo } from './common';
import type { Opening, Plan } from './plan';

const CONC = (g: Gen) => ({ color: g.concrete(), style: STYLE.SOLID, extra: 0, seed: g.S() });
const STEEL: RGB = hex(0x3a3f42);

/** Largeur de la passerelle (demi) et bornes radiales. */
export const BRIDGE_HW = 1.7;

export interface AtriumOpts {
  /** Dalle complète jusqu'au mur d'enceinte (niveaux proches). */
  fullSlab: boolean;
  /** Pas de volée descendante (niveau 144). */
  noFlight?: boolean;
  /** Parapet de coursive vitré (fermes). */
  glassParapet?: boolean;
  /** Couleur dominante des peintures de façade. */
  tone?: RGB;
  /** S3 : escalier détruit sous ce niveau (la Brèche). */
  gap?: boolean;
  /** Trémie dans la dalle (niveau 144). */
  slabHole?: { x0: number; z0: number; x1: number; z1: number };
}

/** Mur d'enceinte du niveau, percé là où des couloirs sortent du silo (sas, mines). */
export function outerWall(g: Gen) {
  const F = g.F;
  const cuts = g.wallCuts;
  const o = { color: hex(0x5a5e5e), style: STYLE.SOLID, extra: 0, seed: 30, top: false, bottom: false };
  if (!cuts.length) { g.ring(0, 0, R_OUT, R_SILO, F, F + LH - SLAB, o); return; }
  const ys = [...new Set([0, LH - SLAB, ...cuts.flatMap((c) => [c.y0, c.y1])])].sort((a, b) => a - b);
  for (let i = 0; i + 1 < ys.length; i++) {
    const y0 = ys[i], y1 = ys[i + 1];
    const active = cuts.filter((c) => c.y0 < y1 - 1e-3 && c.y1 > y0 + 1e-3).map((c) => { const hw = c.hw / R_OUT; return [normAngle(c.a - hw), normAngle(c.a - hw) + 2 * hw] as [number, number]; }).sort((p, q) => p[0] - q[0]);
    if (!active.length) { g.ring(0, 0, R_OUT, R_SILO, F + y0, F + y1, o); continue; }
    let cur = active[active.length - 1][1] - TAU;
    for (const [a, b] of active) {
      if (a > cur + 1e-4) g.sector(R_OUT, R_SILO, cur, a - cur, F + y0, F + y1, o);
      cur = Math.max(cur, b);
    }
  }
}

/** Hauteur du dessus de la marche k (1..STEPS-1) de la volée qui descend du niveau de plancher F. */
export const stepTop = (F: number, k: number) => F - k * (LH / STEPS);
export const stepArc = FLIGHT / (STEPS - 1);
/** Saison 3 : première marche conservée sous la Brèche (niveau 87). */
export const GAP_KEEP = 21;
/** Angle de début (côté haut) de la marche k de la volée partant du palier d'angle phi. */
export const stepA1 = (phi: number, k: number) => phi - LAND_HALF - (k - 1) * stepArc;

/** Tracé 3D de la volée (pour les passants) : du palier du niveau n à celui du niveau n + 1. */
export function flightPath(n: number, F: number, r = 4.5): [number, number, number][] {
  const phi = landingAngle(n);
  const pts: [number, number, number][] = [];
  const [x0, z0] = polar(r, phi);
  pts.push([x0, F, z0]);
  for (let k = 1; k < STEPS; k += 2) {
    const a = stepA1(phi, k) - stepArc / 2;
    const [x, z] = polar(r, a);
    pts.push([x, stepTop(F, k), z]);
  }
  const [x1, z1] = polar(r, phi + Math.PI);
  pts.push([x1, F - LH, z1]);
  return pts;
}

export function atrium(g: Gen, info: LevelInfo, plan: Plan, o: AtriumOpts) {
  const { F, n } = g;
  const phi = landingAngle(n);
  const lod = g.o.lod;
  const cx = Math.cos(phi); // ±1 : la passerelle est dans l'axe x
  const conc = CONC(g);
  const dark = g.detailOk;

  // ---- noyau central -------------------------------------------------------------
  const coreTop = n === 1 ? F + LH + 1.5 : F + LH - SLAB;
  g.ring(0, 0, 0, R_CORE, F - SLAB - (n === NLEV ? 0 : 0), coreTop, { color: hex(0x6e7270), style: STYLE.SOLID, extra: 0, seed: 3, top: n === 1, bottom: false });
  if (lod < 2) {
    // gaines verticales dans une saignée du noyau, côté palier
    for (const da of [-0.55, 0.55]) {
      const [px, pz] = polar(R_CORE + 0.02, phi + Math.PI + da);
      g.box(px - 0.12, F - SLAB, pz - 0.12, px + 0.12, coreTop, pz + 0.12, { color: hex(0x4a4c4a), style: STYLE.PIPE, seed: 5, detail: dark, solid: false });
    }
  }

  // ---- palier ---------------------------------------------------------------------
  const landA0 = phi - LAND_HALF;
  g.sector(R_CORE, R_LAND, landA0, 2 * LAND_HALF, F - 0.55, F, { ...conc, color: hex(0x686c6c) });
  const bridgeHole = rect(Math.min(cx * (R_LAND - 1), cx * (R_GAL + 1)), -BRIDGE_HW, Math.max(cx * (R_LAND - 1), cx * (R_GAL + 1)), BRIDGE_HW);
  // parapet du palier (sauf passerelle) et retours radiaux
  g.shape(subtract(ring(0, 0, R_LAND - 0.32, R_LAND, landA0, 2 * LAND_HALF), bridgeHole), F, F + 1.0, { ...conc, smooth: g.smooth(R_LAND - 0.32, R_LAND) });
  for (const a of [landA0, phi + LAND_HALF]) {
    const inner = R_STEP - 0.05;
    const [ax, az] = polar((inner + R_LAND) / 2, a);
    g.obox(ax, az, a, R_LAND - inner, 0.3, F - 0.55, F + 1.0, { ...conc });
  }
  if (lod < 2) {
    // main courante du palier
    g.shape(subtract(ring(0, 0, R_LAND - 0.26, R_LAND - 0.06, landA0, 2 * LAND_HALF), bridgeHole), F + 1.0, F + 1.06, { color: STEEL, style: STYLE.BRASS, detail: dark, solid: false, smooth: g.smooth(R_LAND - 0.26, R_LAND - 0.06) });
  }

  // ---- volée descendante ------------------------------------------------------------
  if (!o.noFlight) {
    const coarse = lod === 2 ? 3 : 1;
    for (let k = o.gap ? GAP_KEEP : 1; k < STEPS; k += coarse) {
      const kk = Math.min(STEPS - 1, k + coarse - 1);
      const top = stepTop(F, k);
      const a1 = stepA1(phi, k);
      const span = stepArc * (kk - k + 1);
      const a0 = a1 - span;
      g.sector(R_CORE, R_STEP, a0, span, top - 0.6, top, { color: hex(0x6a6e6e), style: STYLE.SOLID, extra: 0, seed: 7 });
      // parapet en rampe : sous-secteurs dont le dessus suit la pente de la volée
      const sub = lod === 0 ? 4 : lod === 1 ? 2 : 1;
      const rise = (LH / STEPS) * (kk - k + 1);
      for (let q = 0; q < sub; q++) {
        const qa1 = a1 - (span * q) / sub;
        const ht = top + 0.95 + rise * (0.5 - (q + 0.5) / sub);
        g.sector(R_STEP - 0.02, R_PARA, qa1 - span / sub, span / sub, top - 0.6, ht, { color: hex(0x626766), style: STYLE.SOLID, extra: 0, seed: 9 });
        if (lod === 0) g.sector(R_STEP + 0.04, R_PARA - 0.06, qa1 - span / sub, span / sub, ht, ht + 0.05, { color: STEEL, style: STYLE.BRASS, detail: true, solid: false });
      }
      if (lod === 0) {
        // nez de marche plus clair (usure)
        g.sector(R_CORE + 0.3, R_STEP - 0.1, a1 - 0.012, 0.012, top - 0.001, top + 0.004, { color: hex(0x8a8c88), style: STYLE.SOLID, extra: 2, detail: true, solid: false });
      }
    }
    // lampes capsules sur le noyau, le long de la volée
    if (lod < 2) {
      for (const k of [8, 20]) {
        const a = stepA1(phi, k) - stepArc / 2;
        const [lx, lz] = polar(R_CORE + 0.28, a);
        g.capsule(lx, lz, stepTop(F, k) + 2.1, 1.0, 0.2, 2.1, lod === 0);
        const [bx, bz] = polar(R_CORE + 0.06, a);
        g.box(Math.min(bx, lx) - 0.05, stepTop(F, k) + 2.55, Math.min(bz, lz) - 0.05, Math.max(bx, lx) + 0.05, stepTop(F, k) + 2.65, Math.max(bz, lz) + 0.05, { color: hex(0x2a2826), detail: dark, solid: false });
      }
    }
  }

  // ---- passerelle -------------------------------------------------------------------
  {
    const xa = cx * (R_LAND - 0.35), xb = cx * (R_GAL + 0.4);
    const x0 = Math.min(xa, xb), x1 = Math.max(xa, xb);
    g.box(x0, F - 0.55, -BRIDGE_HW, x1, F, BRIDGE_HW, { color: hex(0x666a6a), style: STYLE.SOLID, extra: 0, seed: 11 });
    g.box(x0 + 0.5, F - 1.3, -0.8, x1 - 0.5, F - 0.55, 0.8, { color: hex(0x5a5e5e), style: STYLE.SOLID, extra: 0, seed: 12 });
    for (const s of [-1, 1]) {
      const z0 = s < 0 ? -BRIDGE_HW : BRIDGE_HW - 0.28, z1 = s < 0 ? -BRIDGE_HW + 0.28 : BRIDGE_HW;
      g.box(x0, F, z0, x1, F + 1.0, z1, { ...conc });
      if (lod < 2) g.box(x0, F + 1.0, z0 + 0.06, x1, F + 1.06, z1 - 0.06, { color: STEEL, style: STYLE.BRASS, detail: dark, solid: false });
    }
  }

  // ---- dalle et coursive --------------------------------------------------------------
  const slabR = o.fullSlab ? R_SILO : R_FAC + FAC_T + 0.3;
  if (n === NLEV) {
    // fond du puits : dalle pleine (trémie de l'escalier du générateur)
    g.shape(ring(0, 0, 0, R_GAL + 0.02), F - SLAB, F, { color: hex(0x5c605e), style: STYLE.SOLID, extra: 0, seed: 13, smooth: g.smooth(0, R_GAL + 0.02) });
  }
  g.shape(subtract(ring(0, 0, R_GAL, slabR), rect(cx > 0 ? R_GAL - 0.1 : -R_GAL - 0.6, -BRIDGE_HW, cx > 0 ? R_GAL + 0.6 : -R_GAL + 0.1, BRIDGE_HW), ...(o.slabHole && n === NLEV ? [rect(o.slabHole.x0, o.slabHole.z0, o.slabHole.x1, o.slabHole.z1)] : [])), F - SLAB, F, { color: hex(0x646866), style: STYLE.SOLID, extra: 0, seed: 13, smooth: g.smooth(R_GAL, slabR) });
  // niveau 1 : toiture au-dessus des salles (le puits et la coursive restent ouverts sous le dôme)
  if (n === 1 && o.fullSlab) g.shape(ring(0, 0, R_FAC, R_SILO), F + LH - SLAB, F + LH + 0.6, { color: hex(0x626664), style: STYLE.SOLID, extra: 0, seed: 16, smooth: g.smooth(R_FAC, R_SILO) });
  // la passerelle se raccorde à la dalle
  g.box(cx > 0 ? R_GAL - 0.1 : -R_GAL - 0.6, F - SLAB, -BRIDGE_HW, cx > 0 ? R_GAL + 0.6 : -R_GAL + 0.1, F, BRIDGE_HW, { color: hex(0x646866), style: STYLE.SOLID, extra: 0, seed: 13 });
  // nez de dalle vers le puits (bandeau plus sombre)
  if (lod < 2) g.ring(0, 0, R_GAL - 0.05, R_GAL + 0.02, F - SLAB - 0.25, F - SLAB, { color: hex(0x4c504f), style: STYLE.SOLID, extra: 0, seed: 14, top: false });

  // parapet de coursive (vitré pour les fermes : muret bas + verre)
  const parH = o.glassParapet ? 0.5 : 1.02;
  const parShape = subtract(ring(0, 0, R_GAL, R_GAL + 0.3), rect(cx > 0 ? R_GAL - 1 : -R_GAL - 1, -BRIDGE_HW + 0.28, cx > 0 ? R_GAL + 1 : -R_GAL + 1, BRIDGE_HW - 0.28));
  g.shape(parShape, F, F + parH, { color: hex(0x5e6262), style: STYLE.SOLID, extra: 0, seed: 15, smooth: g.smooth(R_GAL, R_GAL + 0.3) });
  if (o.glassParapet) {
    g.shape(subtract(ring(0, 0, R_GAL + 0.12, R_GAL + 0.18), rect(cx > 0 ? R_GAL - 1 : -R_GAL - 1, -BRIDGE_HW + 0.28, cx > 0 ? R_GAL + 1 : -R_GAL + 1, BRIDGE_HW - 0.28)), F + parH, F + 1.02, { color: hex(0x9ab8b0), style: STYLE.GLASS, emis: 0.35, detail: dark, solid: true, smooth: g.smooth(R_GAL + 0.12, R_GAL + 0.18) });
  }
  if (lod < 2) g.shape(subtract(ring(0, 0, R_GAL + 0.06, R_GAL + 0.24), rect(cx > 0 ? R_GAL - 1 : -R_GAL - 1, -BRIDGE_HW + 0.28, cx > 0 ? R_GAL + 1 : -R_GAL + 1, BRIDGE_HW - 0.28)), F + 1.02, F + 1.08, { color: STEEL, style: STYLE.BRASS, detail: dark, solid: false, smooth: g.smooth(R_GAL + 0.06, R_GAL + 0.24) });

  // ---- colonnes et bagues lumineuses ---------------------------------------------------
  for (let i = 0; i < N_COL; i++) {
    const a = deg(15 + i * 30);
    const [x, z] = polar(R_COL, a);
    g.ring(x, z, 0, COL_R, F - SLAB, F + LH - SLAB, { color: hex(0x70736f), style: STYLE.SOLID, extra: 0, seed: 20 + i, top: false, bottom: false });
    // bague lumineuse (verre laiteux cerclé)
    const yb = F + 3.15;
    g.ring(x, z, COL_R - 0.05, COL_R + 0.16, yb, yb + 0.55, { color: PAL.drum, style: STYLE.EMISSIVE, emis: lod === 2 ? 3.0 : 2.3, solid: false });
    if (lod < 2) {
      g.ring(x, z, COL_R - 0.05, COL_R + 0.2, yb - 0.06, yb, { color: hex(0x2a2826), style: STYLE.BRASS, detail: dark, solid: false });
      g.ring(x, z, COL_R - 0.05, COL_R + 0.2, yb + 0.55, yb + 0.61, { color: hex(0x2a2826), style: STYLE.BRASS, detail: dark, solid: false });
    }
    if (i % 2 === 0) g.light(x - Math.cos(a) * 0.9, yb + 0.3, z - Math.sin(a) * 0.9, PAL.drum, 1.25, 12);
  }

  // ---- façade ----------------------------------------------------------------------------
  facade(g, plan, o);

  // (le mur d'enceinte est construit à la fin, une fois connus ses percements : voir outerWall)

  // ---- plafond de la coursive : tubes fluorescents --------------------------------------------
  if (lod < 2) {
    const yc = F + LH - SLAB;
    for (let i = 0; i < 24; i++) {
      const a = deg(7.5 + i * 15);
      const r = 18.9;
      const span = 1.4 / r;
      g.sector(r - 0.14, r + 0.14, a - span / 2, span, yc - 0.12, yc, { color: hex(0x2e3030), style: STYLE.SOLID, extra: 2, detail: dark, solid: false });
      g.sector(r - 0.08, r + 0.08, a - span / 2 + 0.005, span - 0.01, yc - 0.17, yc - 0.12, { color: PAL.tube, style: STYLE.EMISSIVE, emis: 2.5, extra: g.rng.chance(0.05) ? 2 : 0, seed: g.S(), detail: dark, solid: false });
      if (i % 4 === 1) { const [lx, lz] = polar(r, a); g.light(lx, yc - 0.5, lz, PAL.tube, 0.8, 10, g.rng.chance(0.08) ? g.S() + 1 : undefined); }
    }
  }

  // ---- numéros de niveau -----------------------------------------------------------------------
  if (lod < 2) {
    const num = String(n);
    const ny = F + 3.5;
    // au-dessus du passage face à la passerelle
    g.textOnRing(num, R_FAC - 0.01, phi, ny + 0.2, 1.05, { tint: hex(0xe6dcc0), wear: 0.25 });
    g.textOnRing(`NIVEAU`, R_FAC - 0.01, phi, ny - 0.6, 0.26, { tint: hex(0xe6dcc0), wear: 0.2 });
    // sur le noyau, face au palier
    g.textOnRing(`${num}`, R_CORE + 0.01, phi, F + 1.9, 0.7, { tint: hex(0xe6dcc0), wear: 0.3 }, true);
    // sur les parapets de la passerelle
    const bx = cx * (R_LAND + 0.4);
    g.text(num, bx, F + 0.62, BRIDGE_HW - 0.29, 0, -1, 0.34, { tint: hex(0x1e1c1a), plate: 'cream', wear: 0.2 });
    g.text(num, bx, F + 0.62, -BRIDGE_HW + 0.29, 0, 1, 0.34, { tint: hex(0x1e1c1a), plate: 'cream', wear: 0.2 });
    // sens de circulation sur le noyau
    if (!o.noFlight) {
      const [ax, az] = polar(R_CORE + 0.01, phi - LAND_HALF - 0.25);
      g.decal(ax, F + 1.4, az, Math.cos(phi - LAND_HALF - 0.25), Math.sin(phi - LAND_HALF - 0.25), ARROW.down, 0.4, 0.4, { wear: 0.3, tint: hex(0xe6dcc0) });
    }
    if (n > 1) {
      const [ax, az] = polar(R_CORE + 0.01, phi + LAND_HALF + 0.25);
      g.decal(ax, F + 1.4, az, Math.cos(phi + LAND_HALF + 0.25), Math.sin(phi + LAND_HALF + 0.25), ARROW.up, 0.4, 0.4, { wear: 0.3, tint: hex(0xe6dcc0) });
    }
  }

  // ---- passants ---------------------------------------------------------------------------------
  if (g.detailOk) {
    const loop: [number, number, number][] = [];
    for (let i = 0; i < 64; i++) { const [x, z] = polar(18.9, (i / 64) * TAU); loop.push([x, F, z]); }
    const z = info.zone;
    const busy = info.kind === 'marche' ? 26 : z === 'mids' ? 16 : z === 'haut' ? 11 : z === 'basmids' ? 10 : 8;
    const kinds: Parameters<Gen['path']>[3] = z === 'bas' ? ['mechanic', 'mechanic', 'resident', 'porter', 'child'] : z === 'haut' ? ['resident', 'resident', 'it', 'judicial', 'child', 'elder', 'porter'] : ['resident', 'resident', 'porter', 'child', 'elder', 'farmer', 'medic'];
    g.path(loop, true, busy, kinds, 18);
    // escalier : porteurs chargés et voyageurs
    if (!o.noFlight && !o.gap) g.path(flightPath(n, F), false, z === 'bas' ? 2 : 3, ['porter', 'porter', 'resident', 'deputy'], 0);
    // passerelle
    g.path([[cx * 7.6, F, 0.4], [cx * 19, F, 0.4]], false, 1, ['resident', 'porter'], 6);
    // badauds accoudés au parapet
    const nLean = z === 'bas' ? 2 : 4;
    for (let i = 0; i < nLean; i++) {
      const a = g.rng.range(0, TAU);
      if (Math.abs(normAngle(a - phi + Math.PI) - Math.PI) < 0.25) continue;
      const [x, zz] = polar(R_GAL + 0.62, a);
      g.idle(x, F, zz, yawTo(-Math.cos(a), -Math.sin(a)), g.rng.chance(0.4) ? 2 : 0, g.rng.pick(kinds));
    }
  }
  // repères
  const [dx, dz] = polar(7.2, phi);
  g.dest(`Niveau ${n} · palier`, dx, F, dz, Math.atan2(-Math.cos(phi) * -1, -Math.sin(phi) * -1));
}

// -----------------------------------------------------------------------------------------------
// Façade : segments pleins entre les ouvertures, linteaux, allèges, vitres, portes, décor
// -----------------------------------------------------------------------------------------------
function facade(g: Gen, plan: Plan, o: AtriumOpts) {
  const { F } = g;
  const lod = g.o.lod;
  const R0 = R_FAC, R1 = R_FAC + FAC_T;
  const yTop = F + LH - SLAB;
  const wallCol = o.tone ?? hex(0x6c6e6a);
  const W = { color: wallCol, style: STYLE.SOLID, extra: 0, seed: 40 };
  const dark = g.detailOk;
  const low = 3.0; // bande basse (portes, fenêtres, passages)
  type Cut = { a0: number; a1: number; op: Opening };
  const cuts: Cut[] = plan.openings.map((op) => {
    const hw = op.w / 2 / R0;
    return { a0: op.a - hw, a1: op.a + hw, op };
  });
  // vitrages continus (fermes, parc)
  for (const [ga0, ga1] of plan.glazing) cuts.push({ a0: ga0 + 0.02, a1: ga1 - 0.02, op: { a: (ga0 + ga1) / 2, w: 0, y0: 0.5, y1: 4.6, kind: 'window', seed: 1 } });

  // bande basse : on découpe l'anneau selon les ouvertures de hauteur ≥ 1 m depuis le sol
  const bandCut = (y0: number, y1: number, pred: (c: Cut) => boolean) => {
    const cs = cuts.filter(pred).map((c) => [normAngle(c.a0), normAngle(c.a0) + (c.a1 - c.a0)] as [number, number]);
    const split: [number, number][] = [];
    for (const [a, b] of cs) { if (b > TAU) split.push([a, TAU], [0, b - TAU]); else split.push([a, b]); }
    split.sort((x, y) => x[0] - y[0]);
    let cur = 0;
    const segs: [number, number][] = [];
    for (const [a, b] of split) { if (a > cur + 1e-4) segs.push([cur, a]); cur = Math.max(cur, b); }
    if (cur < TAU - 1e-4) segs.push([cur, TAU]);
    // raccorder le segment final au premier à travers 0
    if (segs.length > 1 && segs[0][0] < 1e-4 && segs[segs.length - 1][1] > TAU - 1e-4) {
      const last = segs.pop()!;
      segs[0] = [last[0] - TAU, segs[0][1]];
    }
    for (const [a, b] of segs) g.sector(R0, R1, a, b - a, y0, y1, W);
  };
  // seules les baies praticables et les vitrages continus traversent le mur ; les fenêtres sont des vitres en applique
  const cutting = (c: Cut) => c.op.kind !== 'upper' && !(c.op.kind === 'window' && c.op.w > 0);
  const inBand = (c: Cut, y0: number, y1: number) => cutting(c) && c.op.y0 < y1 - 1e-3 && c.op.y1 > y0 + 1e-3;
  if (lod === 2) {
    // au loin : deux bandes seulement
    bandCut(F, F + 2.4, (c) => cutting(c));
    bandCut(F + 2.4, yTop, (c) => cutting(c) && c.op.y1 > 3.2);
  } else {
    const ys = [...new Set([0, LH - SLAB, ...cuts.filter(cutting).flatMap((c) => [c.op.y0, c.op.y1])])].filter((y) => y >= 0 && y <= LH - SLAB).sort((a, b) => a - b);
    // fusion des bandes consécutives qui ont les mêmes découpes
    let start = ys[0];
    let key = '';
    for (let i = 0; i + 1 < ys.length; i++) {
      const y0 = ys[i], y1 = ys[i + 1];
      const k = cuts.map((c, j) => (inBand(c, y0, y1) ? j : -1)).filter((j) => j >= 0).join(',');
      if (i === 0) { key = k; start = y0; continue; }
      if (k !== key) {
        const kk = key;
        bandCut(F + start, F + y0, (c) => kk.split(',').includes(String(cuts.indexOf(c))));
        key = k; start = y0;
      }
    }
    const kk = key;
    bandCut(F + start, yTop, (c) => kk.split(',').includes(String(cuts.indexOf(c))));
  }
  void low;

  // remplissage des ouvertures
  for (const c of cuts) {
    const op = c.op;
    const span = c.a1 - c.a0;
    const k = g.rng;
    if (op.kind === 'window' || op.kind === 'upper') {
      const lit = op.kind === 'upper' ? k.chance(0.35) : k.chance(op.w === 0 ? 1 : 0.7);
      const glassCol: RGB = op.w === 0 ? hex(0xd8ffe0) : lit ? g.pick([PAL.lamp, hex(0xffe0b8), hex(0xfff0d8), hex(0xd8e8ff)]) : hex(0x202428);
      const em = op.w === 0 ? 0.25 : lit ? g.rng.range(0.9, 2.2) : 0;
      if (op.w === 0) {
        // vitrage continu : montants tous les 2 m, verre très légèrement teinté
        const nM = Math.max(2, Math.round((span * R0) / 2));
        for (let m = 0; m <= nM; m++) {
          const a = c.a0 + (span * m) / nM;
          g.sector(R0 - 0.02, R1, a - 0.06 / R0, 0.12 / R0, F + op.y0, F + op.y1, { color: hex(0x3a3e3c), style: STYLE.SOLID, extra: 2, seed: 2 });
        }
        g.sector(R0 + 0.18, R0 + 0.22, c.a0, span, F + op.y0, F + op.y1, { color: glassCol, style: STYLE.GLASS, emis: em, extra: 0, seed: op.seed, solid: true, detail: false });
        continue;
      }
      // vitre en applique (légèrement en saillie) et son cadre
      const fr = 0.07 / R0;
      g.sector(R0 - 0.06, R0, c.a0 - fr, span + 2 * fr, F + op.y0 - 0.07, F + op.y1 + 0.07, { color: hex(0x34373a), style: STYLE.SOLID, extra: 2, seed: 3, solid: false, detail: lod === 0 });
      g.sector(R0 - 0.09, R0 - 0.06, c.a0, span, F + op.y0, F + op.y1, { color: glassCol, style: STYLE.GLASS, emis: em, extra: 1, seed: op.seed, solid: false });
      if (lod === 0 && op.kind === 'window') {
        g.sector(R0 - 0.2, R0 - 0.06, c.a0 - fr, span + 2 * fr, F + op.y0 - 0.12, F + op.y0 - 0.07, { color: hex(0x4e5250), style: STYLE.SOLID, extra: 2, detail: true, solid: false });
      }
      continue;
    }
    if (op.kind === 'door' && op.closed) {
      const dc = g.pick(PAL.door);
      g.sector(R0 + 0.12, R0 + 0.22, c.a0, span, F, F + op.y1, { color: dc, style: STYLE.SOLID, extra: 2, seed: op.seed });
      if (lod === 0) {
        const [hx, hz] = polar(R0 + 0.1, c.a0 + span * 0.82);
        g.box(hx - 0.05, F + 1.0, hz - 0.05, hx + 0.05, F + 1.08, hz + 0.05, { color: PAL.brass, style: STYLE.BRASS, detail: true, solid: false });
      }
    } else if (op.kind === 'shop' && op.closed) {
      // rideau de fer baissé
      g.sector(R0 + 0.14, R0 + 0.2, c.a0, span, F, F + op.y1, { color: hex(0x5a5c5a), style: STYLE.CORRUGATED, seed: op.seed });
    }
    // encadrement (portes, boutiques, portails)
    if (lod === 0 && (op.kind === 'door' || op.kind === 'shop' || op.kind === 'portal')) {
      const fr = 0.12 / R0;
      const fc = op.kind === 'portal' ? hex(0x4a4e4c) : hex(0x3c3e3c);
      g.sector(R0 - 0.05, R0 + 0.02, c.a0 - fr, fr, F, F + op.y1 + 0.12, { color: fc, style: STYLE.SOLID, extra: 2, detail: true, solid: false });
      g.sector(R0 - 0.05, R0 + 0.02, c.a1, fr, F, F + op.y1 + 0.12, { color: fc, style: STYLE.SOLID, extra: 2, detail: true, solid: false });
      g.sector(R0 - 0.05, R0 + 0.02, c.a0 - fr, span + 2 * fr, F + op.y1, F + op.y1 + 0.12, { color: fc, style: STYLE.SOLID, extra: 2, detail: true, solid: false });
    }
    // lampe au-dessus des portes et numéro
    const u = op.unit;
    if (lod === 0 && u && (op.kind === 'door' || op.kind === 'shop')) {
      if (k.chance(0.5)) {
        const [lx, lz] = polar(R0 - 0.12, op.a);
        g.box(lx - 0.12, F + op.y1 + 0.3, lz - 0.12, lx + 0.12, F + op.y1 + 0.45, lz + 0.12, { color: PAL.lamp, style: STYLE.EMISSIVE, emis: 2.5, detail: true, solid: false });
      }
      const label = u.label ?? '';
      if (label) g.textOnRing(label, R0 - 0.01, op.a, F + op.y1 + 0.2, 0.13, { plate: 'cream', tint: hex(0x1c1a18), wear: 0.1 });
    }
    if (lod === 0 && u?.sign && (op.kind === 'portal' || op.kind === 'door' || op.kind === 'passage')) {
      g.textOnRing(u.sign, R0 - 0.02, op.a, F + op.y1 + 0.45, 0.24, { plate: 'dark', tint: hex(0xe8dcc0), wear: 0.08 });
    }
  }

  // décor de façade : affiches, graffitis, tuyaux, boîtiers
  if (lod === 0) {
    const s3 = g.era === 's3';
    const posters = s3 ? POSTERS_S3 : POSTERS_S1;
    const graff = s3 ? GRAFFITI_S3 : GRAFFITI_S1;
    const clear = (a: number, w: number) => !cuts.some((c) => { const d = Math.abs(normAngle(a - (c.a0 + c.a1) / 2 + Math.PI) - Math.PI) * R0; return d < (c.a1 - c.a0) * R0 / 2 + w / 2 + 0.2; });
    const nPost = g.info?.zone === 'haut' ? 5 : 8;
    for (let i = 0; i < nPost; i++) {
      const a = g.rng.range(0, TAU);
      if (!clear(a, 0.9)) continue;
      const [x, z] = polar(R0 - 0.01, a);
      g.decal(x, F + g.rng.range(1.5, 1.8), z, -Math.cos(a), -Math.sin(a), g.pick(posters), 0.62, 0.93, { wear: g.rng.range(0.1, 0.6) });
    }
    const nGraff = s3 ? 4 : g.info?.zone === 'bas' || g.info?.zone === 'basmids' ? 2 : 0;
    for (let i = 0; i < nGraff; i++) {
      const a = g.rng.range(0, TAU);
      if (!clear(a, 2.4)) continue;
      const [x, z] = polar(R0 - 0.01, a);
      g.decal(x, F + g.rng.range(1.0, 2.2), z, -Math.cos(a), -Math.sin(a), g.pick(graff), 2.2, 0.82, { wear: g.rng.range(0, 0.3) });
    }
    // conduite horizontale sous le plafond, le long de la façade
    g.sector(R0 - 0.34, R0 - 0.1, 0, TAU, yTop - 0.42, yTop - 0.18, { color: hex(0x4a4e4e), style: STYLE.PIPE, seed: 50, detail: true, solid: false });
    // boîtiers électriques
    for (let i = 0; i < 6; i++) {
      const a = g.rng.range(0, TAU);
      if (!clear(a, 0.6)) continue;
      g.sector(R0 - 0.12, R0, a, 0.5 / R0, F + 2.6, F + 3.2, { color: hex(0x5a5e58), style: STYLE.SOLID, extra: 1, detail: true, solid: false });
    }
  }
}

/** Dôme au-dessus du niveau 1 : coupole nervurée, panneaux lumineux, globe de verre sur le noyau. */
export function dome(g: Gen) {
  const y0 = LH - SLAB; // naissance au plafond du niveau 1
  const lod = g.o.lod;
  const Rd = R_FAC + 0.4;
  const H = 15;
  // surface intérieure : demi-ellipsoïde r(y) = Rd·√(1 − ((y − y0)/H)²)
  const rIn = (y: number) => Rd * Math.sqrt(Math.max(0, 1 - ((y - y0) / H) ** 2));
  const nRing = lod === 2 ? 10 : lod === 1 ? 24 : 40;
  const sm = { cx: 0, cz: 0, r0: 0, r1: Rd, sy: y0, ky: (Rd / H) ** 2 };
  for (let i = 0; i < nRing; i++) {
    const ya = y0 + (H * i) / nRing, yb = y0 + (H * (i + 1)) / nRing;
    g.ring(0, 0, Math.max(0, rIn(yb)), rIn(ya) + 0.7, ya, yb + 0.45, { color: hex(0x9a9c94), style: STYLE.SOLID, extra: 0, seed: 60 + i, smooth: sm });
  }
  if (lod === 2) return;
  // panneaux lumineux à lamelles, en rangées, affleurant la coque
  [[2.2, 30, 1.7], [5.0, 26, 1.6], [7.8, 20, 1.4], [10.4, 14, 1.2]].forEach(([dy, nP, wP], ri) => {
    const y = y0 + dy;
    const r = rIn(y + 0.6) - 0.02;
    for (let k = 0; k < nP; k++) {
      const a = (k + (ri % 2) * 0.5) * (TAU / nP);
      g.sector(r - 0.12, r, a - wP / 2 / r, wP / r, y - 0.45, y + 0.55, { color: hex(0xfff4e0), style: STYLE.GRILLE, emis: 2.6, detail: g.detailOk, solid: false });
      g.sector(r - 0.04, r + 0.1, a - (wP / 2 + 0.15) / r, (wP + 0.3) / r, y - 0.6, y + 0.7, { color: hex(0x7c7e78), style: STYLE.SOLID, extra: 2, detail: g.detailOk, solid: false });
    }
  });
  // nervures méridiennes
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU + TAU / 32;
    for (let yy = y0; yy < y0 + H * 0.93; yy += 0.3) {
      const r = rIn(yy + 0.3) - 0.14;
      const [x, z] = polar(r, a);
      g.box(x - 0.16, yy, z - 0.16, x + 0.16, yy + 0.32, z + 0.16, { color: hex(0x8a8c86), style: STYLE.SOLID, extra: 0, detail: g.detailOk, solid: false });
    }
  }
  // globe de verre sur le noyau
  const gy = LH + 1.5;
  for (let i = 0; i < 12; i++) {
    const t = i / 12;
    const yy = gy + 5 * Math.sin(t * Math.PI / 2) - 0.2;
    const rr = 4.2 * Math.cos(t * Math.PI / 2);
    g.ring(0, 0, 0, rr + 0.1, yy, yy + 0.5, { color: hex(0xfff0d0), style: STYLE.GLASS, emis: 3.5, extra: 1, seed: 90 + i, solid: false });
  }
  g.ring(0, 0, 0, 4.4, gy - 0.5, gy - 0.1, { color: hex(0x7a7c78), style: STYLE.SOLID, extra: 2, seed: 92 });
  g.light(0, gy + 2, 0, hex(0xfff0d8), 3.2, 36);
  g.light(12, 7.5, 0, hex(0xfff0d8), 1.0, 20);
  g.light(-12, 7.5, 0, hex(0xfff0d8), 1.0, 20);
}
