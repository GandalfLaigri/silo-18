// Grandes salles et lieux nommés : aiguillage vers les programmes, outils communs,
// cafétérias (écran sur l'extérieur), poste du shérif, cellule d'attente 3 et sas.
import { LH, PAL, R_OUT, R_SILO, SLAB, STYLE, hex, type RGB } from '../config';
import { POSTER } from '../world/decalTiles';
import type { LevelInfo } from '../world/levels';
import { Gen, TAU, deg, polar, yawTo } from './common';
import { Frame, cabinet, chair, counter, crate, desk, lampCeil, piece, table } from './furniture';
import { room, unitRadii, type Room } from './interior';
import type { Plan } from './plan';
import { deepRooms } from './deep';
import { civicRooms } from './civic';
import { workRooms } from './work';

export type RoomFn = (g: Gen, R: Room, info: LevelInfo) => void;

/** Hauteur libre d'une grande salle. */
export const HALL_H = LH - SLAB;
/** Axe du couloir de la cellule d'attente 3 et du sas (niveau 1, palier à l'est). */
export const AIRLOCK_A = deg(90);

export const P3 = (p: [number, number], y: number): [number, number, number] => [p[0], y, p[1]];
/** Orientation caméra depuis (x0, z0) vers (x1, z1). */
export const camYawToward = (x0: number, z0: number, x1: number, z1: number) => Math.atan2(-(x1 - x0), -(z1 - z0));

export function special(g: Gen, info: LevelInfo, plan: Plan, shellOnly = false) {
  const table: Record<string, RoomFn> = { ...ROOMS, ...civicRooms, ...workRooms, ...deepRooms };
  for (const u of plan.units) {
    if (!(u.zone === 'AB' || u.sub)) continue;
    const [r0, r1] = unitRadii(u);
    const R = room(g, u, r0, r1);
    if (shellOnly) {
      if (u.sub === 'ferme' || u.sub === 'parc') table[u.sub](g, R, info);
      continue;
    }
    const fn = table[u.sub ?? ''];
    if (fn) fn(g, R, info);
    else genericHall(g, R);
    if (u.name && u.sub !== 'escalier_gen') {
      const am = u.door ?? (u.entries?.[0]?.a ?? (u.a0 + u.a1) / 2);
      const [ex, ez] = polar(r0 + 1.4, am);
      const [cx, cz] = polar((r0 + r1) / 2, (u.a0 + u.a1) / 2);
      g.dest(u.name, ex, g.F, ez, camYawToward(ex, ez, cx, cz));
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Outils communs aux grandes salles
// ---------------------------------------------------------------------------------------------
/** Sol d'une salle (finition) en secteur. */
export function hallFloor(g: Gen, R: Room, style: number = STYLE.TILE, color: RGB = hex(0x55595a), extra = 0) {
  const { u, r0, r1 } = R;
  g.sector(r0 + 0.02, r1 - 0.02, u.a0 + 0.12 / r0, u.a1 - u.a0 - 0.24 / r0, g.F, g.F + 0.025, { color, style, extra, seed: g.S(), solid: false, bottom: false, sides: false });
}

/** Grille de plafonniers dans une salle (tous les ~pas mètres). */
export function hallLights(g: Gen, R: Room, step = 7, color: RGB = PAL.tube, y = HALL_H, k = 0.95, radius = 10) {
  const { u, r0, r1 } = R;
  for (let r = r0 + step / 2; r < r1 - 1; r += step) {
    const n = Math.max(1, Math.round(((u.a1 - u.a0) * r) / step));
    for (let i = 0; i < n; i++) {
      const a = u.a0 + ((i + 0.5) / n) * (u.a1 - u.a0);
      const [x, z] = polar(r, a);
      lampCeil(g, x, z, g.F + y, color, (i + Math.round(r)) % 2 === 0 ? k : 0, radius, g.rng.chance(0.04));
    }
  }
}

/** Point (x, z) d'une salle à la distance radiale r et à l'angle relatif t (0 : a0, 1 : a1). */
export const at = (R: Room, r: number, t: number): [number, number] => polar(r, R.u.a0 + t * (R.u.a1 - R.u.a0));
export const angAt = (R: Room, t: number) => R.u.a0 + t * (R.u.a1 - R.u.a0);
export const tOf = (R: Room, a: number) => (a - R.u.a0) / (R.u.a1 - R.u.a0);

/** Cloison en arc dans une salle (angles relatifs t0..t1), avec ouvertures (t, largeur m). */
export function arcPartition(g: Gen, R: Room, r: number, t0: number, t1: number, y1 = HALL_H, doors: { t: number; w: number }[] = [], color?: RGB) {
  const a0 = angAt(R, t0), a1 = angAt(R, t1);
  const o = { color: color ?? g.pick(PAL.paint), style: STYLE.PANEL, seed: g.S() };
  const cuts = doors.map((d) => { const a = angAt(R, d.t); return [a - d.w / 2 / r, a + d.w / 2 / r] as [number, number]; }).sort((p, q) => p[0] - q[0]);
  let cur = a0;
  for (const [c0, c1] of cuts) { if (c0 > cur) g.sector(r - 0.1, r + 0.1, cur, c0 - cur, g.F, g.F + y1, o); cur = Math.max(cur, c1); }
  if (a1 > cur) g.sector(r - 0.1, r + 0.1, cur, a1 - cur, g.F, g.F + y1, o);
  for (const [c0, c1] of cuts) if (y1 > 2.3) g.sector(r - 0.1, r + 0.1, c0, c1 - c0, g.F + 2.3, g.F + y1, o);
}

/** Cloison rayonnante dans une salle (angle relatif t), de r0 à r1, avec ouvertures (distance radiale, largeur). */
export function radialPartition(g: Gen, R: Room, t: number, r0: number, r1: number, y1 = HALL_H, doors: { r: number; w: number }[] = [], color?: RGB) {
  const a = angAt(R, t);
  const o = { color: color ?? g.pick(PAL.paint), style: STYLE.PANEL, seed: g.S(), res: 0.1 };
  const cuts = doors.map((d) => [d.r - d.w / 2, d.r + d.w / 2] as [number, number]).sort((p, q) => p[0] - q[0]);
  let cur = r0;
  const seg = (s0: number, s1: number, y0: number, yy1: number) => { const [x, z] = polar((s0 + s1) / 2, a); g.obox(x, z, a, s1 - s0, 0.2, g.F + y0, g.F + yy1, o); };
  for (const [c0, c1] of cuts) { if (c0 > cur) seg(cur, c0, 0, y1); if (y1 > 2.3) seg(c0, c1, 2.3, y1); cur = Math.max(cur, c1); }
  if (r1 > cur) seg(cur, r1, 0, y1);
}

/** Axe (0 : -z, 1 : +x, 2 : +z, 3 : -x) le plus proche d'une normale horizontale. */
export const sideOf = (nx: number, nz: number) => (Math.abs(nx) > Math.abs(nz) ? (nx > 0 ? 1 : 3) : nz > 0 ? 2 : 0) as 0 | 1 | 2 | 3;

/** Écran d'extérieur géant sur une cloison plane perpendiculaire à l'axe radial a (vers le centre). */
export function outsideScreen(g: Gen, a: number, r: number, w: number, h: number, y0: number) {
  const [cx, cz] = polar(r + 0.35, a);
  g.obox(cx, cz, a, 0.5, w + 1.6, g.F, g.F + HALL_H, { color: hex(0x3a3c3c), style: STYLE.SOLID, extra: 2, seed: 5, res: 0.1 });
  const [fx, fz] = polar(r + 0.02, a);
  g.obox(fx, fz, a, 0.14, w + 0.5, g.F + y0 - 0.25, g.F + y0 + h + 0.25, { color: hex(0x181a1a), style: STYLE.BRASS, seed: 6, res: 0.1 });
  const [sx, sz] = polar(r - 0.07, a);
  g.screens.push({ x: sx, y: g.F + y0 + h / 2, z: sz, side: sideOf(-Math.cos(a), -Math.sin(a)), w, h });
}

/** Petit écran d'extérieur sur une paroi plane, orientée par l'angle de sa normale. */
export function outsideScreenFlat(g: Gen, p: [number, number], normalAng: number, w: number, h: number, y0: number) {
  const nx = Math.cos(normalAng), nz = Math.sin(normalAng);
  g.obox(p[0] - nx * 0.06, p[1] - nz * 0.06, normalAng, 0.1, w + 0.2, g.F + y0 - 0.1, g.F + y0 + h + 0.1, { color: hex(0x1a1c1c), style: STYLE.BRASS, seed: 3, res: 0.1, solid: false, detail: true });
  g.screens.push({ x: p[0] + nx * 0.01, y: g.F + y0 + h / 2, z: p[1] + nz * 0.01, side: sideOf(nx, nz), w, h });
}

/** Rangées de tables de cantine avec convives. */
export function canteenTables(g: Gen, R: Room, rA: number, rB: number, tA: number, tB: number, crowd: number, face?: number) {
  for (let r = rA; r <= rB; r += 2.8) {
    const span = (tB - tA) * (R.u.a1 - R.u.a0) * r;
    const n = Math.max(1, Math.floor(span / 4.4));
    for (let i = 0; i < n; i++) {
      const t = tA + ((i + 0.5) / n) * (tB - tA);
      const a = angAt(R, t);
      const [x, z] = polar(r, a);
      const f = new Frame(x, z, a);
      table(g, f, g.F, 0.9, 3.0, g.pick([hex(0x6a5a44), hex(0x5a5e58)]));
      for (const s of [-1.05, -0.35, 0.35, 1.05]) for (const d of [-0.62, 0.62]) {
        const [cx, cz] = f.at(d, s);
        chair(g, new Frame(cx, cz, a + (d < 0 ? 0 : Math.PI)), g.F, hex(0x3e3a34));
        if (g.rng.chance(crowd)) {
          const yaw = face ?? a + (d < 0 ? 0 : Math.PI);
          g.idle(cx, g.F, cz, yawTo(Math.cos(yaw), Math.sin(yaw)), 1);
        }
      }
      for (let k = 0; k < 4; k++) piece(g, f, g.rng.range(-0.25, 0.25), g.rng.range(-1.3, 1.3), 0.3, 0.4, g.F + 0.76, g.F + 0.79, hex(0x8a8a80), STYLE.FLESH);
    }
  }
}

// ---------------------------------------------------------------------------------------------
// Programmes
// ---------------------------------------------------------------------------------------------
function genericHall(g: Gen, R: Room) {
  hallFloor(g, R);
  hallLights(g, R);
  for (let k = 0; k < 6; k++) {
    const [x, z] = at(R, g.rng.range(R.r0 + 3, R.r1 - 3), g.rng.range(0.15, 0.85));
    crate(g, new Frame(x, z, g.rng.range(0, TAU)), g.F, 0.7);
  }
}

/** Grande cafétéria : tables, comptoir, plafonnier rayonnant, écran géant sur l'extérieur. */
function cafeteria(g: Gen, R: Room, info: LevelInfo, big: boolean) {
  const { u } = R;
  const ac = (u.a0 + u.a1) / 2;
  hallFloor(g, R, STYLE.TILE, hex(0x6a645a), 1);
  const rScreen = big ? 37.2 : 36.4;
  const W = big ? 19 : 13;
  const H = big ? 3.9 : 3.0;
  outsideScreen(g, ac, rScreen, W, H, big ? 1.0 : 1.2);
  // tables en rangées face à l'écran
  canteenTables(g, R, R.r0 + 3.5, rScreen - 5, 0.1, 0.84, info.zone === 'bas' ? 0.45 : 0.35, ac);
  // comptoir de service le long d'une cloison
  const t = 0.93;
  const at_ = angAt(R, t);
  const [kx, kz] = at(R, R.r0 + 9, t);
  counter(g, new Frame(kx, kz, at_ + Math.PI / 2), g.F, 9);
  for (let k = 0; k < 3; k++) { const [x, z] = at(R, R.r0 + 5.5 + k * 3, 0.965); g.idle(x, g.F, z, yawTo(-Math.sin(at_), Math.cos(at_)), 10, 'resident'); }
  g.sign('SERVICE', ...P3(at(R, R.r0 + 9, 0.905), g.F + 2.6), -Math.sin(at_), Math.cos(at_), 0.22, 'cream');
  // plafonnier rayonnant (soleil de lamelles)
  const [cx, cz] = polar(R.r0 + 8, ac);
  const yc = g.F + HALL_H;
  g.ring(cx, cz, 0, 1.4, yc - 0.25, yc, { color: hex(0xfff0d8), style: STYLE.EMISSIVE, emis: 1.5, solid: false });
  for (let k = 0; k < 16; k++) {
    const a = (k / 16) * TAU;
    g.obox(cx + Math.cos(a) * 3.2, cz + Math.sin(a) * 3.2, a, 3.2, 0.35, yc - 0.18, yc - 0.02, { color: hex(0xffe8c8), style: STYLE.EMISSIVE, emis: 0.95, solid: false });
  }
  g.ring(cx, cz, 5.0, 5.4, yc - 0.3, yc, { color: hex(0x3a3836), style: STYLE.BRASS, solid: false });
  g.light(cx, yc - 1.2, cz, hex(0xffe8c8), 2.0, 22);
  hallLights(g, R, 8, PAL.lamp, HALL_H, 0.9, 11);
  const ta = angAt(R, 0.1);
  g.decal(...P3(at(R, R.r0 + 2, 0.1), g.F + 1.7), Math.cos(ta + Math.PI / 2), Math.sin(ta + Math.PI / 2), POSTER.tirage, 0.7, 1.05, { wear: 0.2 });
  g.zone(u.name ?? 'Cafétéria', cx, cz, 16);
}

/** Poste du shérif du niveau 1 : bureaux, bureau du shérif, cellule d'attente 3, couloir vers le sas. */
function sherif(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x5a5a52));
  hallLights(g, R, 6, PAL.lamp, HALL_H, 0.8, 8);
  for (const [r, t] of [[24, 0.25], [24, 0.75], [27.5, 0.3]] as const) {
    const [x, z] = at(R, r, t);
    desk(g, new Frame(x, z, angAt(R, t) + Math.PI), g.F);
    if (g.rng.chance(0.7)) { const [ix, iz] = at(R, r + 0.65, t); g.idle(ix, g.F, iz, yawTo(-Math.cos(angAt(R, t)), -Math.sin(angAt(R, t))), 8, 'deputy'); }
  }
  for (let k = 0; k < 4; k++) cabinet(g, new Frame(...at(R, 21.5, 0.08 + k * 0.06), angAt(R, 0.08 + k * 0.06)), g.F, 0.8, 1.6, hex(0x5a5e5a));
  // bureau du shérif, cloisonné
  arcPartition(g, R, 31, 0, 0.42, 3.0, [{ t: 0.3, w: 1.0 }], hex(0x7a7466));
  radialPartition(g, R, 0.42, 31, R_OUT, 3.0, [], hex(0x7a7466));
  {
    const [x, z] = at(R, 35, 0.2);
    desk(g, new Frame(x, z, angAt(R, 0.2) + Math.PI), g.F);
    cabinet(g, new Frame(...at(R, 39.3, 0.33), angAt(R, 0.33) + Math.PI), g.F, 1.0, 1.9, hex(0x3a3e3a));
    g.zone('Bureau du shérif', x, z, 3.5);
    lampCeil(g, x, z, g.F + 3.0, PAL.lamp, 0.8, 6);
    g.sector(31.1, R_OUT, angAt(R, 0), angAt(R, 0.42) - angAt(R, 0), g.F + 3.0, g.F + 3.12, { color: hex(0x8c8c84), style: STYLE.SOLID, extra: 2, solid: false });
  }
  // cellule d'attente 3 : couloir radial jusqu'au mur d'enceinte, puis le sas
  const tc = tOf(R, AIRLOCK_A);
  const dt = 1.5 / 34 / (R.u.a1 - R.u.a0);
  radialPartition(g, R, tc - dt, 31, R_OUT, HALL_H, [], hex(0x6e6a60));
  radialPartition(g, R, tc + dt, 31, R_OUT, HALL_H, [], hex(0x6e6a60));
  arcPartition(g, R, 31, tc - dt, tc + dt, HALL_H, [{ t: tc, w: 1.2 }], hex(0x6e6a60));
  g.sector(31, R_OUT, angAt(R, tc - dt), angAt(R, tc + dt) - angAt(R, tc - dt), g.F + 3.0, g.F + 3.12, { color: hex(0x7a7a72), style: STYLE.SOLID, extra: 2, solid: false });
  g.sign('CELLULE 3', ...P3(polar(30.85, AIRLOCK_A), g.F + 2.5), -Math.cos(AIRLOCK_A), -Math.sin(AIRLOCK_A), 0.18, 'cream');
  holdingAndAirlock(g, AIRLOCK_A);
  g.zone('Poste du shérif', ...at(R, 25, 0.5), 7);
}

/** Cellule d'attente 3, couloir et sas dans l'axe a (le mur d'enceinte est percé par l'atrium). */
function holdingAndAirlock(g: Gen, a: number) {
  const F = g.F;
  const ux = Math.cos(a), uz = Math.sin(a);
  const P = (r: number, s: number): [number, number] => [ux * r - uz * s, uz * r + ux * s];
  const [cx, cz] = P(36.2, 0);
  g.zone('Cellule d’attente 3', cx, cz, 3);
  lampCeil(g, cx, cz, F + 3.0, hex(0xe8f0ff), 0.8, 6);
  const fr = new Frame(...P(38.9, -0.8), a + Math.PI);
  piece(g, fr, 0, 0, 0.9, 2.0, F, F + 0.45, hex(0x5a5a52), STYLE.SOLID, true);
  piece(g, fr, 0, 0, 0.85, 1.9, F + 0.45, F + 0.55, hex(0xb8b4a8), STYLE.CLOTH);
  chair(g, new Frame(...P(35.4, 1.0), a), F, hex(0x3a3a3a));
  outsideScreenFlat(g, P(37.4, 1.45), a - Math.PI / 2, 1.1, 0.7, 1.5);
  // barreaux entre la cellule et le couloir
  for (let s = -1.4; s <= 1.41; s += 0.2) { if (Math.abs(s) < 0.45) continue; const [x, z] = P(33.9, s); g.box(x - 0.03, F, z - 0.03, x + 0.03, F + 2.9, z + 0.03, { color: hex(0x2a2c2e), style: STYLE.BRASS }); }
  // couloir dans l'épaisseur du mur puis sas (hors du silo)
  const hw = 1.3;
  const r0 = R_OUT, r1 = R_SILO + 7.6;
  for (const s of [-1, 1]) {
    const [x, z] = P((R_SILO + r1) / 2, s * (hw + 0.3));
    g.obox(x, z, a, r1 - R_SILO, 0.6, F - 0.6, F + 3.6, { color: hex(0x4a4c4a), style: STYLE.SOLID, extra: 0, seed: 81, res: 0.1 });
  }
  {
    const [x, z] = P((r0 + r1) / 2, 0);
    g.obox(x, z, a, r1 - r0, 2 * hw + 1.2, F + 3.0, F + 3.6, { color: hex(0x4a4c4a), style: STYLE.SOLID, extra: 0, seed: 82, res: 0.1 });
    g.obox(x, z, a, r1 - r0, 2 * hw + 1.2, F - 0.6, F, { color: hex(0x3e4040), style: STYLE.DECK, seed: 83, res: 0.1 });
  }
  for (const s of [-1, 1]) for (const k of [0, 1, 2]) {
    const [x, z] = P(R_SILO + 2.6 + k * 1.6, s * (hw - 0.08));
    g.box(x - 0.12, F + 2.3, z - 0.12, x + 0.12, F + 2.6, z + 0.12, { color: hex(0x3a3a38), style: STYLE.BRASS, detail: true, solid: false });
  }
  const [lx, lz] = P(R_SILO + 4, 0);
  g.box(lx - 0.2, F + 2.95, lz - 0.2, lx + 0.2, F + 3.0, lz + 0.2, { color: PAL.red, style: STYLE.EMISSIVE, emis: 3, extra: 1, seed: 9, detail: true, solid: false });
  g.light(lx, F + 2.4, lz, hex(0xff4a30), 0.9, 7);
  g.zone('Sas', lx, lz, 3.5);
  g.dest('Sas vers l’extérieur', ...P3(P(R_OUT - 1.2, 0), F), Math.atan2(-ux, -uz));
  g.airlock = { a, rIn: R_SILO + 0.6, rOut: r1, y: F, hw };
}

function bureaux1(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x5a5e5a));
  hallLights(g, R, 6, PAL.tube, 3.0);
  for (let r = R.r0 + 2.5; r < R.r1 - 2; r += 2.6) for (const t of [0.3, 0.7]) {
    const [x, z] = at(R, r, t);
    desk(g, new Frame(x, z, angAt(R, t) + Math.PI), g.F);
    if (g.rng.chance(0.4)) { const [ix, iz] = at(R, r + 0.65, t); g.idle(ix, g.F, iz, yawTo(-Math.cos(angAt(R, t)), -Math.sin(angAt(R, t))), 8); }
  }
  g.sector(R.r0, R.r1, R.u.a0, R.u.a1 - R.u.a0, g.F + 3.0, g.F + 3.12, { color: hex(0x8c8c84), style: STYLE.SOLID, extra: 2, solid: false });
}

const ROOMS: Record<string, RoomFn> = {
  cafeteria: (g, R, info) => cafeteria(g, R, info, true),
  cafeteria_mids: (g, R, info) => cafeteria(g, R, info, false),
  cantine_meca: (g, R, info) => cafeteria(g, R, info, false),
  sherif: (g, R) => sherif(g, R),
  bureaux1: (g, R) => bureaux1(g, R),
};
