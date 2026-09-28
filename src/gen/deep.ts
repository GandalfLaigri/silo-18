// Le fond du silo : niveau 144 (descente vers le générateur, atelier de Martha Walker),
// salle du générateur, dalle de trente pieds, cavité du forage, machine abandonnée, tunnel et Coffre avancé.
import { GEN_FLOOR, GEN_TOP, PAL, R_SILO, STYLE, VOID_FLOOR, VOID_TOP, hex, type RGB } from '../config';
import type { LevelInfo } from '../world/levels';
import { rect, ring, subtract } from '../world/voxel2d';
import { Gen, TAU, deg, polar, yawTo } from './common';
import { Frame, cabinet, chair, crate, lampCeil, piece, shelf, table, workbench } from './furniture';
import type { Room } from './interior';
import { HALL_H, at, angAt, hallFloor, hallLights, type RoomFn } from './special';

/** Trémie de l'escalier du générateur dans la dalle du niveau 144 (palier à l'ouest). */
export const GEN_STAIR_HOLE = { x0: -32.4, x1: -29.6, z0: -10.4, z1: 10.6 };
/** Puits d'accès à la cavité à travers la dalle de trente pieds. */
export const VOID_SHAFT = { x: 20, z: 27, r: 2.4 };

const IRON = hex(0x3c4240);
const RUST = hex(0x5a4030);

/** Tuyau horizontal (section voxelisée en couches) de (x0, z0) à (x1, z1), axe à l'altitude y. */
export function hpipe(g: Gen, x0: number, z0: number, x1: number, z1: number, y: number, r: number, color: RGB = hex(0x4a4e4a), solid = true) {
  const len = Math.hypot(x1 - x0, z1 - z0);
  const ang = Math.atan2(z1 - z0, x1 - x0);
  const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
  const n = Math.max(3, Math.round((2 * r) / 0.1));
  for (let i = 0; i < n; i++) {
    const ya = y - r + (i * 2 * r) / n, yb = ya + (2 * r) / n;
    const dy = (ya + yb) / 2 - y;
    const w = 2 * Math.sqrt(Math.max(0, r * r - dy * dy));
    if (w < 0.05) continue;
    g.obox(cx, cz, ang, len, w, ya, yb, { color, style: STYLE.PIPE, seed: 31, solid, detail: false });
  }
}

/** Escalier droit (marches en boîtes) le long de x ou de z. */
function straightStair(g: Gen, x: number, z0: number, z1: number, y0: number, y1: number, w: number, color: RGB = hex(0x4a4c4a)) {
  const n = Math.round(Math.abs(y1 - y0) / 0.2);
  const dz = (z1 - z0) / n;
  for (let i = 0; i < n; i++) {
    const top = y0 + ((y1 - y0) * (i + 1)) / n;
    const za = z0 + dz * i, zb = za + dz;
    g.box(x - w / 2, Math.min(top, y0) - 0.3, Math.min(za, zb), x + w / 2, top, Math.max(za, zb), { color, style: STYLE.DECK, seed: 3 });
  }
  // limons et garde-corps
  for (const s of [-1, 1]) {
    const xs = x + s * (w / 2 + 0.05);
    const k = 6;
    for (let i = 0; i < k; i++) {
      const u0 = i / k, u1 = (i + 1) / k;
      const ya = y0 + (y1 - y0) * u0, yb = y0 + (y1 - y0) * u1;
      const za = z0 + (z1 - z0) * u0, zb = z0 + (z1 - z0) * u1;
      g.box(xs - 0.04, Math.max(ya, yb) + 0.95, Math.min(za, zb), xs + 0.04, Math.max(ya, yb) + 1.02, Math.max(za, zb), { color: hex(0x7a6a30), style: STYLE.BRASS, detail: true, solid: false });
      g.box(xs - 0.05, Math.min(ya, yb), Math.min(za, zb), xs + 0.05, Math.max(ya, yb) + 1.0, Math.min(za, zb) + 0.06, { color: IRON, style: STYLE.BRASS, detail: true, solid: false });
      g.wall(xs - 0.1, Math.min(ya, yb), Math.min(za, zb), xs + 0.1, Math.max(ya, yb) + 1.0, Math.max(za, zb));
    }
  }
}

/** Palier / plateforme en caillebotis. */
function platform(g: Gen, x0: number, z0: number, x1: number, z1: number, y: number, rails: ('x0' | 'x1' | 'z0' | 'z1')[] = []) {
  g.box(x0, y - 0.12, z0, x1, y, z1, { color: hex(0x4a4c4a), style: STYLE.GRATE, seed: 4 });
  g.box(x0 + 0.2, y - 0.4, z0 + 0.2, x1 - 0.2, y - 0.12, z1 - 0.2, { color: IRON, style: STYLE.SOLID, extra: 1, detail: true, solid: false });
  for (const r of rails) {
    const [a0, a1, b0, b1] = r === 'x0' ? [x0, x0 + 0.08, z0, z1] : r === 'x1' ? [x1 - 0.08, x1, z0, z1] : r === 'z0' ? [x0, x1, z0, z0 + 0.08] : [x0, x1, z1 - 0.08, z1];
    g.box(a0, y + 0.95, b0, a1, y + 1.02, b1, { color: hex(0x7a6a30), style: STYLE.BRASS, detail: true, solid: false });
    g.box(a0, y + 0.45, b0, a1, y + 0.5, b1, { color: IRON, style: STYLE.BRASS, detail: true, solid: false });
    g.wall(a0 - 0.05, y, b0 - 0.05, a1 + 0.05, y + 1.0, b1 + 0.05);
  }
}

// ---------------------------------------------------------------------------------------------
// Niveau 144
// ---------------------------------------------------------------------------------------------
function escalierGen(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x4a4c48), 1);
  hallLights(g, R, 7, PAL.sodium, HALL_H, 0.9, 10);
  const H = GEN_STAIR_HOLE;
  // garde-corps autour de la trémie
  platform(g, H.x0 - 0.05, H.z0 - 0.3, H.x0, H.z1 + 0.3, g.F, []);
  g.box(H.x1, g.F, H.z0, H.x1 + 0.1, g.F + 1.05, H.z1, { color: hex(0x7a6a30), style: STYLE.BRASS });
  g.box(H.x0 - 0.1, g.F, H.z1 - 0.1, H.x1 + 0.1, g.F + 1.05, H.z1, { color: hex(0x7a6a30), style: STYLE.BRASS });
  g.box(H.x0 - 0.1, g.F, H.z0 - 0.1, H.x0, g.F + 1.05, H.z0 + 3, { color: hex(0x7a6a30), style: STYLE.BRASS });
  g.sign('GÉNÉRATEUR · ACCÈS RÉSERVÉ À MECHANICAL', (H.x0 + H.x1) / 2 + 1.6, g.F + 2.4, H.z0 - 0.6, 0, 1, 0.2, 'yellow');
  g.zone('Descente vers le générateur', (H.x0 + H.x1) / 2, (H.z0 + H.z1) / 2, 8);
  // bouches de ventilation du générateur, au sol : grilles éclairées par en dessous
  for (const [r, t] of [[26, 0.3], [26, 0.7], [33, 0.5], [22, 0.5]] as const) {
    const [x, z] = at(R, r, t);
    g.box(x - 1.0, g.F - 0.02, z - 1.0, x + 1.0, g.F + 0.03, z + 1.0, { color: hex(0x3a3a38), style: STYLE.GRATE, seed: 5, solid: false });
    g.box(x - 0.95, g.F - 0.6, z - 0.95, x + 0.95, g.F - 0.5, z + 0.95, { color: PAL.furnace, style: STYLE.EMISSIVE, emis: 1.6, extra: 4, seed: g.S(), solid: false });
    g.w.emitSteam(x, g.F + 0.1, z, 0.6, 4, 10, [0.32, 0.3, 0.28]);
  }
  // établis et matériel de Mechanical
  for (const t of [0.15, 0.85]) {
    const [x, z] = at(R, 37.5, t);
    workbench(g, new Frame(x, z, angAt(R, t) + Math.PI), g.F, 2.4);
  }
  for (let k = 0; k < 6; k++) crate(g, new Frame(...at(R, g.rng.range(34, 38), g.rng.range(0.05, 0.25)), g.rng.range(0, TAU)), g.F, 0.6);
  for (let k = 0; k < 3; k++) { const [x, z] = at(R, 30 + k * 2, 0.8); g.idle(x, g.F, z, yawTo(1, 0), g.rng.chance(0.5) ? 4 : 2, 'mechanic'); }
}

function electronique(g: Gen, R: Room) {
  const { f, D, hw } = R;
  const y = g.F;
  hallFloor(g, R, STYLE.WOOD, hex(0x4a3a2a));
  const [lx, lz] = f.at(D / 2, 0);
  lampCeil(g, lx, lz, y + 2.9, PAL.lamp, 0.9, 7);
  g.sector(R.r0, R.r1, R.u.a0, R.u.a1 - R.u.a0, y + 2.9, y + 3.02, { color: hex(0x7a746a), style: STYLE.SOLID, extra: 2, solid: false });
  // étagères pleines d'appareils à réparer, étiquetés
  for (const s of [-1, 1]) for (const d of [1.2, 2.8, 4.4]) shelf(g, new Frame(...f.at(d, s * (hw(d) - 0.25)), R.ac - s * Math.PI / 2), y, 1.5, 2.2);
  workbench(g, new Frame(...f.at(D - 0.5, 0), R.ac + Math.PI), y, Math.min(3, hw(D) * 2 - 1));
  // radios, téléviseurs, lampe-loupe
  for (let k = 0; k < 6; k++) piece(g, f, D - 0.7 + g.rng.range(-0.2, 0.2), g.rng.range(-1.2, 1.2), 0.3, 0.35, y + 0.95, y + 0.95 + g.rng.range(0.15, 0.35), g.pick([hex(0x5a4a3a), hex(0x3a3a3a), hex(0x6a6a60)]), STYLE.WOOD);
  piece(g, f, D - 0.8, 0.9, 0.06, 0.06, y + 0.95, y + 1.5, hex(0x2a2a2a), STYLE.BRASS);
  piece(g, f, D - 0.95, 0.9, 0.25, 0.25, y + 1.45, y + 1.55, hex(0xffe8c0), STYLE.EMISSIVE, false, 3);
  g.light(...f.at(D - 1.2, 0.9).reduce((p, v, i) => (i === 0 ? [v, y + 1.4] : [...p, v]), [] as number[]) as [number, number, number], PAL.lamp, 0.8, 4);
  chair(g, new Frame(...f.at(D - 1.4, 0), R.ac), y, hex(0x5a3a2a));
  const [mx, mz] = f.at(D - 1.4, 0);
  g.idle(mx, y, mz, yawTo(Math.cos(R.ac), Math.sin(R.ac)), 1, 'elder');
  for (let k = 0; k < 8; k++) crate(g, new Frame(...f.at(g.rng.range(0.8, D - 2), g.rng.range(-1.5, 1.5)), g.rng.range(0, TAU)), y, 0.4, g.pick([hex(0x5a4a3a), hex(0x4a4a44)]));
  g.zone('Atelier d’électronique de Martha Walker', lx, lz, 4);
}

// ---------------------------------------------------------------------------------------------
// Sous le niveau 144 (appelé par la génération du niveau 144)
// ---------------------------------------------------------------------------------------------
export function below(g: Gen, info: LevelInfo) {
  void info;
  generatorRoom(g);
  cap(g);
  diggerVoid(g);
  vaultTunnel(g);
}

function generatorRoom(g: Gen) {
  const y0 = GEN_FLOOR, y1 = GEN_TOP;
  const RW = 38;
  // murs et sol
  g.ring(0, 0, RW, R_SILO, y0, y1, { color: hex(0x55585a), style: STYLE.SOLID, extra: 0, seed: 101 });
  g.shape(subtract(ring(0, 0, 0, RW), ring(VOID_SHAFT.x, VOID_SHAFT.z, 0, VOID_SHAFT.r)), y0 - 0.6, y0, { color: hex(0x4a4c4a), style: STYLE.DECK, seed: 102, smooth: g.smooth(0, RW) });
  // bandeaux et nervures des murs
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    const [x, z] = polar(RW - 0.3, a);
    g.obox(x, z, a, 0.6, 0.9, y0, y1, { color: hex(0x4c5052), style: STYLE.SOLID, extra: 1, seed: 103 });
  }
  g.ring(0, 0, RW - 0.25, RW, y0 + 3.6, y0 + 4.0, { color: hex(0x8a6a20), style: STYLE.SOLID, extra: 2, seed: 104 });
  // turbine : socle, carter nervuré, chapeau, arbre
  g.ring(0, 0, 0, 8.6, y0, y0 + 1.2, { color: hex(0x5a5c58), style: STYLE.SOLID, extra: 0, seed: 105 });
  g.ring(0, 0, 0, 6.8, y0 + 1.2, y0 + 2.4, { color: hex(0x3e4642), style: STYLE.DECK, seed: 106 });
  g.ring(0, 0, 0, 4.8, y0 + 2.4, y0 + 13, { color: hex(0x4a5a52), style: STYLE.SOLID, extra: 1, seed: 107 });
  for (let k = 0; k < 7; k++) g.ring(0, 0, 4.7, 5.15, y0 + 3 + k * 1.5, y0 + 3.3 + k * 1.5, { color: hex(0x3a4440), style: STYLE.BRASS, seed: 108 });
  // panneaux déposés : fenêtre sur les aubes (lueur des roulements)
  g.shape(ring(0, 0, 4.82, 4.9, deg(-25), deg(50)), y0 + 5, y0 + 9, { color: hex(0xffb070), style: STYLE.EMISSIVE, emis: 0.8, extra: 4, seed: 9, solid: false, smooth: g.smooth(4.82, 4.9) });
  g.ring(0, 0, 0, 3.6, y0 + 13, y0 + 14.2, { color: hex(0x3a4440), style: STYLE.SOLID, extra: 1, seed: 109 });
  g.ring(0, 0, 0, 0.9, y0 + 14.2, y1, { color: hex(0x5a5e5a), style: STYLE.BRASS, seed: 110 });
  g.movers.push({ kind: 'turbine', x: 0, y: y0 + 14.2, z: 0, r: 3.2, h: 0.5 });
  // arrivée de vapeur haute pression (source inconnue)
  hpipe(g, 37.5, -10, 5, -2.5, y0 + 6.5, 1.3, hex(0x6a5a44));
  hpipe(g, -37.5, 10, -5.4, 2.8, y0 + 5.5, 0.9, hex(0x4a5e5a));
  for (const [x, z] of [[33, -9], [-33, 9]] as const) g.ring(x, z, 0, 1.0, y0 + 6.5, y1, { color: hex(0x5a5040), style: STYLE.PIPE, seed: 111 });
  // passerelle annulaire autour de la turbine
  g.shape(ring(0, 0, 5.4, 8.2), y0 + 7.4, y0 + 7.55, { color: hex(0x4a4c4a), style: STYLE.GRATE, seed: 112, smooth: g.smooth(5.4, 8.2) });
  g.shape(ring(0, 0, 8.1, 8.2), y0 + 7.55, y0 + 8.6, { color: hex(0x7a6a30), style: STYLE.BRASS, seed: 113, smooth: g.smooth(8.1, 8.2), detail: true, solid: true });
  for (let k = 0; k < 6; k++) { const [x, z] = polar(8.0, (k / 6) * TAU + 0.3); g.box(x - 0.15, y0, z - 0.15, x + 0.15, y0 + 7.4, z + 0.15, { color: IRON, style: STYLE.BRASS }); }
  // escalier vers la passerelle
  straightStair(g, 6.6, -10.5, -3.4, y0 + 1.2, y0 + 7.4, 1.2);
  // portique et palan au-dessus de la turbine (la « sangle » des ingénieurs)
  g.box(-30, y1 - 2.2, -0.6, 30, y1 - 1.4, 0.6, { color: hex(0x7a6a24), style: STYLE.SOLID, extra: 1, seed: 114 });
  g.box(-1.2, y1 - 3.2, -1.0, 1.2, y1 - 2.2, 1.0, { color: hex(0x3a3c3a), style: STYLE.BRASS });
  for (const s of [-0.3, 0.3]) g.box(s - 0.03, y0 + 15, -0.03, s + 0.03, y1 - 3.2, 0.03, { color: hex(0x1a1a1a), solid: false, detail: true });
  g.box(-0.5, y0 + 14.6, -0.3, 0.5, y0 + 15.0, 0.3, { color: hex(0x6a4a2a), style: STYLE.CLOTH, solid: false, detail: true });
  // escalier depuis le niveau 144 : trois volées en lacets le long de la trémie
  const H = GEN_STAIR_HOLE;
  const yA = y1 + 0.6, yB = y1 - 7.8, yC = y0 + 6;
  straightStair(g, (H.x0 + H.x1) / 2, H.z0 + 0.2, H.z1 - 1.6, yA, yB, 2.4);
  platform(g, H.x0 - 0.2, H.z1 - 1.6, H.x1 + 3.4, H.z1 + 1.6, yB, ['z1', 'x0']);
  straightStair(g, H.x1 + 1.6, H.z1 - 1.6, H.z0 + 2.2, yB, yC, 2.4);
  platform(g, H.x0 - 0.2, H.z0 - 1.2, H.x1 + 3.4, H.z0 + 2.2, yC, ['z0', 'x0']);
  straightStair(g, (H.x0 + H.x1) / 2, H.z0 + 2.2, H.z0 + 2.2 + (yC - y0) * 2.4, yC, y0, 2.4);
  // salle de contrôle en surplomb, longue baie vitrée vers la turbine
  const cy = yB;
  platform(g, H.x1 + 3.4, -5.2, H.x1 + 10.2, H.z1 + 1.6, cy, ['z1']);
  const cx0 = H.x1 + 3.6, cx1 = H.x1 + 10;
  const WC = { color: hex(0x5a5e5a), style: STYLE.SOLID, extra: 2 };
  g.box(cx0, cy, -5, cx1, cy + 3.6, -4.8, WC);                                   // mur sud
  g.box(cx0 + 1.6, cy, 4.8, cx1, cy + 3.6, 5, WC);                               // mur nord (porte côté escalier)
  g.box(cx0, cy + 2.3, 4.8, cx0 + 1.6, cy + 3.6, 5, WC);
  g.box(cx1 - 0.2, cy, -5, cx1, cy + 0.9, 5, WC);                                 // allège de la baie
  g.box(cx1 - 0.12, cy + 0.9, -4.8, cx1 - 0.06, cy + 2.6, 4.8, { color: hex(0x8ab0b0), style: STYLE.GLASS, emis: 0.25, seed: 3 });
  g.box(cx1 - 0.2, cy + 2.6, -5, cx1, cy + 3.6, 5, WC);
  g.box(cx0, cy, -5, cx0 + 0.2, cy + 3.6, 5, WC);                                 // mur ouest
  g.box(cx0, cy + 3.6, -5, cx1, cy + 3.8, 5, { color: hex(0x4a4e4c), style: STYLE.SOLID, extra: 2 });
  for (let k = 0; k < 4; k++) {
    const z = -3.6 + k * 2.4;
    piece(g, new Frame(cx1 - 0.9, z, 0), 0, 0, 0.8, 2.0, cy, cy + 1.0, hex(0x4a5250), STYLE.SOLID, true, 0, 2);
    for (let j = 0; j < 6; j++) g.box(cx1 - 1.25, cy + 1.0, z - 0.8 + j * 0.3, cx1 - 1.2, cy + 1.08, z - 0.7 + j * 0.3, { color: g.pick([PAL.red, PAL.green, hex(0xffc040)]), style: STYLE.EMISSIVE, emis: 3, extra: j % 3 === 0 ? 3 : 0, seed: g.S(), detail: true, solid: false });
    g.box(cx1 - 0.6, cy + 1.2, z - 0.35, cx1 - 0.5, cy + 1.7, z + 0.35, { color: hex(0xffffff), style: STYLE.SCREEN, emis: 2, extra: 1, seed: g.S(), detail: true, solid: false });
  }
  lampCeil(g, (cx0 + cx1) / 2, 0, cy + 2.6, PAL.tube, 0.8, 6);
  g.idle(cx1 - 1.6, cy, 0.4, yawTo(1, 0), 10, 'mechanic');
  g.zone('Salle de contrôle du générateur', (cx0 + cx1) / 2, 0, 5, cy - 0.5, cy + 3);
  // pompes, armoires électriques, vannes, manomètres
  for (let k = 0; k < 10; k++) {
    const a = deg(20 + k * 32);
    const [x, z] = polar(34.5, a);
    if (x < -24 && Math.abs(z) < 13) continue;
    if (k % 2 === 0) {
      g.ring(x, z, 0, 1.3, y0, y0 + 2.2, { color: hex(0x4a5a5a), style: STYLE.SOLID, extra: 1, seed: 120 + k });
      g.ring(x, z, 0, 0.5, y0 + 2.2, y0 + 3.4, { color: hex(0x3a3c3a), style: STYLE.PIPE, seed: 121 });
      g.w.emitSteam(x, y0 + 2.4, z, 0.5, 3, 8, [0.3, 0.3, 0.3]);
    } else {
      cabinet(g, new Frame(x, z, a + Math.PI), y0, 2.4, 2.2, hex(0x4a5250));
      g.box(x - 0.1, y0 + 1.6, z - 0.1, x + 0.1, y0 + 1.7, z + 0.1, { color: PAL.red, style: STYLE.EMISSIVE, emis: 3, extra: 3, seed: g.S(), detail: true, solid: false });
    }
  }
  // lumières : sodium chaud, gyrophares, lueur de la turbine
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + 0.2;
    const [x, z] = polar(30, a);
    g.box(x - 0.4, y1 - 0.3, z - 0.4, x + 0.4, y1, z + 0.4, { color: PAL.sodium, style: STYLE.EMISSIVE, emis: 3, seed: g.S(), solid: false });
    g.light(x, y1 - 1.5, z, PAL.sodium, 1.6, 22);
  }
  g.light(0, y0 + 10, 0, hex(0xffc090), 1.4, 20);
  g.light(12, y0 + 4, 0, hex(0xff9a50), 1.0, 14);
  g.glows.push({ x: 0, y: y0 + 6, z: 0, r: 30, color: [0.1, 0.055, 0.025] });
  for (let k = 0; k < 6; k++) g.w.emitSteam(Math.cos(k) * 5.2, y0 + 2.5, Math.sin(k) * 5.2, 0.8, 5, 12, [0.34, 0.32, 0.3]);
  // ouvriers
  for (let k = 0; k < 5; k++) { const [x, z] = polar(g.rng.range(10, 20), g.rng.range(0, TAU)); g.idle(x, y0, z, g.rng.range(0, TAU), g.rng.chance(0.5) ? 4 : 2, 'mechanic'); }
  const loop: [number, number, number][] = [];
  for (let i = 0; i < 24; i++) { const [x, z] = polar(12, (i / 24) * TAU); loop.push([x, y0, z]); }
  g.path(loop, true, 3, ['mechanic'], 10);
  // brèche vers la cavité (sol éventré, gravats)
  const S = VOID_SHAFT;
  for (let k = 0; k < 10; k++) { const a = (k / 10) * TAU; const [x, z] = [S.x + Math.cos(a) * (S.r + 0.4), S.z + Math.sin(a) * (S.r + 0.4)]; g.box(x - 0.3, y0, z - 0.3, x + 0.3, y0 + g.rng.range(0.15, 0.6), z + 0.3, { color: hex(0x5a5652), style: STYLE.ROCK, seed: g.S() }); }
  g.sign('DANGER · NE PAS DESCENDRE', S.x - S.r - 0.4, y0 + 1.4, S.z, -1, 0, 0.16, 'yellow');
  g.dest('Salle du générateur', -24, y0, -8, Math.atan2(-1, -0.3));
  g.zone('Salle du générateur', 0, 0, 38, y0 - 0.5, y1);
}

/** Dalle de trente pieds et puits d'accès en colimaçon. */
function cap(g: Gen) {
  const S = VOID_SHAFT;
  g.shape(subtract(ring(0, 0, 0, R_SILO), ring(S.x, S.z, 0, S.r)), VOID_TOP, GEN_FLOOR - 0.6, { color: hex(0x5e605c), style: STYLE.SOLID, extra: 0, seed: 130, top: false, smooth: g.smooth(0, R_SILO) });
  g.shape(ring(S.x, S.z, S.r, S.r + 0.4), VOID_TOP, GEN_FLOOR, { color: hex(0x4a4642), style: STYLE.ROCK, seed: 131, smooth: { cx: S.x, cz: S.z, r0: S.r, r1: S.r + 0.4 } });
  // escalier hélicoïdal métallique : du sol de la salle du générateur jusqu'au fond de la cavité
  const top = GEN_FLOOR, bottom = VOID_FLOOR;
  const n = Math.round((top - bottom) / 0.22);
  const turn = TAU / 16;
  for (let i = 0; i < n; i++) {
    const yT = top - (i + 1) * ((top - bottom) / n);
    const a = i * turn;
    g.shape(ring(S.x, S.z, 0.25, S.r - 0.15, a, turn * 1.05), yT - 0.06, yT, { color: hex(0x4a4c4a), style: STYLE.GRATE, seed: 132 });
    if (i % 2 === 0) { const [px, pz] = [S.x + Math.cos(a) * (S.r - 0.2), S.z + Math.sin(a) * (S.r - 0.2)]; g.box(px - 0.03, yT, pz - 0.03, px + 0.03, yT + 1.0, pz + 0.03, { color: IRON, style: STYLE.BRASS, detail: true, solid: false }); }
  }
  g.ring(S.x, S.z, 0, 0.22, bottom, top, { color: hex(0x3a3c3a), style: STYLE.BRASS, seed: 133 });
  // garde-corps extérieur en dessous de la dalle (la tour de l'escalier pend dans le vide)
  g.shape(ring(S.x, S.z, S.r - 0.12, S.r - 0.05), bottom, VOID_TOP, { color: hex(0x3a3c3a), style: STYLE.GRATE, seed: 134, solid: true, smooth: { cx: S.x, cz: S.z, r0: S.r - 0.12, r1: S.r - 0.05 } });
  for (let yy = bottom + 3; yy < VOID_TOP; yy += 4) g.light(S.x, yy, S.z, hex(0xffd8a0), 0.5, 6);
  g.zone('Puits vers la cavité', S.x, S.z, S.r + 1, VOID_FLOOR - 1, GEN_FLOOR + 1);
}

function diggerVoid(g: Gen) {
  const y0 = VOID_FLOOR, y1 = VOID_TOP;
  const RW = 40;
  g.ring(0, 0, RW, RW + 2.4, y0, y1, { color: hex(0x4a4a46), style: STYLE.ROCK, seed: 140 });
  // anneaux laissés par le forage
  for (let yy = y0 + 3; yy < y1 - 1; yy += 3.2) g.ring(0, 0, RW - 0.25, RW, yy, yy + 0.35, { color: hex(0x3a3c3a), style: STYLE.ROCK, seed: 141 });
  g.ring(0, 0, 0, RW + 2.4, y0 - 1, y0, { color: hex(0x3a3834), style: STYLE.ROCK, seed: 142 });
  // fine couche d'eau
  g.shape(ring(0, 0, 0, RW), y0 + 0.02, y0 + 0.12, { color: hex(0x2a4a4a), style: STYLE.WATER, emis: 0.35, seed: 143, solid: false, bottom: false, sides: false });
  // corps central de la machine
  g.ring(0, 0, 0, 6.2, y0, y0 + 4, { color: hex(0x3a3e3c), style: STYLE.SOLID, extra: 1, seed: 144 });
  g.ring(0, 0, 0, 5.4, y0 + 4, y0 + 20, { color: hex(0x4a4a44), style: STYLE.SOLID, extra: 1, seed: 145 });
  for (let k = 0; k < 6; k++) g.ring(0, 0, 5.3, 5.9, y0 + 5 + k * 2.6, y0 + 5.5 + k * 2.6, { color: RUST, style: STYLE.BRASS, seed: 146 });
  g.ring(0, 0, 0, 3.6, y0 + 20, y0 + 25, { color: hex(0x3e423e), style: STYLE.SOLID, extra: 1, seed: 147 });
  // lumières encore alimentées sur la machine
  for (let k = 0; k < 24; k++) {
    const a = (k / 24) * TAU;
    const yy = y0 + 6 + (k % 4) * 3.4;
    const [x, z] = polar(5.5, a);
    g.box(x - 0.12, yy, z - 0.12, x + 0.12, yy + 0.22, z + 0.12, { color: hex(0xffc860), style: STYLE.EMISSIVE, emis: 3.4, extra: k % 5 === 0 ? 1 : 0, seed: g.S(), solid: false });
  }
  // huit bras munis de trois foreuses
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * TAU + deg(22.5);
    const [bx, bz] = polar(11, a);
    g.obox(bx, bz, a, 11, 1.4, y0 + 13, y0 + 14.6, { color: hex(0x4a4640), style: STYLE.SOLID, extra: 1, seed: 150 + k });
    // jambe inclinée vers le sol
    for (let i = 0; i < 14; i++) {
      const u = i / 14;
      const [lx, lz] = polar(16 + u * 5, a);
      g.obox(lx, lz, a, 1.6, 1.2, y0 + 13 - (i + 1), y0 + 14 - i, { color: hex(0x44403a), style: STYLE.SOLID, extra: 1, seed: 160 });
    }
    for (const s of [-1.2, 0, 1.2]) {
      const [dx, dz] = polar(21.5, a + s / 21.5);
      for (let q = 0; q < 5; q++) g.ring(dx, dz, 0, 0.75 - q * 0.14, y0 + 0.2 + q * 0.5, y0 + 0.7 + q * 0.5, { color: hex(0x6a6258), style: STYLE.BRASS, seed: 170 });
    }
    // anneau d'ancrage aux parois : poutres jusqu'au bord de la cavité
    const [rx, rz] = polar(27, a + deg(22.5));
    g.obox(rx, rz, a + deg(22.5), 26, 1.0, y0 + 22, y0 + 23.2, { color: hex(0x3e3c38), style: STYLE.SOLID, extra: 1, seed: 180 });
  }
  g.shape(ring(0, 0, 34, 39.5), y0 + 21.4, y0 + 23.4, { color: hex(0x3a3834), style: STYLE.SOLID, extra: 1, seed: 181, smooth: g.smooth(34, 39.5) });
  for (let k = 0; k < 32; k++) { const [x, z] = polar(36.8, (k / 32) * TAU); g.ring(x, z, 0, 0.5, y0 + 19.8, y0 + 21.4, { color: hex(0x6a6258), style: STYLE.BRASS, seed: 182 }); }
  // campement de George Wilkins sur la machine (plateforme au pied du corps)
  const ca = deg(200);
  const [px, pz] = polar(8.2, ca);
  g.obox(px, pz, ca, 4.2, 4.6, y0 + 3.2, y0 + 3.5, { color: hex(0x4a4c4a), style: STYLE.GRATE, seed: 190 });
  for (let i = 0; i < 16; i++) { const [sx, sz] = polar(10.6 + i * 0.26, ca + 0.18); g.obox(sx, sz, ca, 0.3, 1.0, y0 + 0.2 * (15 - i), y0 + 0.2 * (16 - i), { color: hex(0x3a3c3a), style: STYLE.DECK, seed: 191 }); }
  const fc = new Frame(px, pz, ca);
  piece(g, fc, 0.4, -1.2, 2.0, 0.9, y0 + 3.5, y0 + 3.75, hex(0x6a5a44), STYLE.CLOTH, true);
  piece(g, fc, 0.4, -1.2, 1.8, 0.85, y0 + 3.75, y0 + 3.85, g.pick(PAL.cloth), STYLE.CLOTH);
  table(g, new Frame(...fc.at(-0.8, 1.0), ca), y0 + 3.5, 0.8, 1.2, hex(0x5a4a34));
  for (let k = 0; k < 5; k++) crate(g, new Frame(...fc.at(g.rng.range(-1.6, 1.6), g.rng.range(0.3, 2.0)), g.rng.range(0, TAU)), y0 + 3.5, 0.45, hex(0x5a4a34));
  piece(g, fc, -0.8, 1.0, 0.12, 0.08, y0 + 4.26, y0 + 4.4, hex(0xd84040), STYLE.FLESH);           // distributeur PEZ
  piece(g, fc, -0.6, 0.6, 0.3, 0.22, y0 + 4.26, y0 + 4.34, hex(0x3a2a20), STYLE.WOOD);             // livre
  piece(g, fc, -1.4, -1.5, 0.3, 0.3, y0 + 3.5, y0 + 3.9, hex(0xffd890), STYLE.EMISSIVE, false, 3);  // lanterne
  g.light(...fc.at(-1.2, -1.2).reduce((p, v, i) => (i === 0 ? [v, y0 + 4.5] : [...p, v]), [] as number[]) as [number, number, number], PAL.lamp, 1.0, 8);
  g.zone('Campement de George Wilkins', px, pz, 3.5, y0, y0 + 8);
  if (g.era === 's3') { const [bx, bz] = fc.at(0.4, -1.2); g.idle(bx, y0 + 3.8, bz, yawTo(Math.cos(ca), Math.sin(ca)), 9, 'elder'); }
  g.dest('Cavité du forage', VOID_SHAFT.x - 4, y0, VOID_SHAFT.z - 4, Math.atan2(VOID_SHAFT.x, VOID_SHAFT.z));
  // éclairage : quelques projecteurs de chantier, lueur froide
  for (let k = 0; k < 6; k++) { const [x, z] = polar(24, (k / 6) * TAU); g.light(x, y0 + 8, z, hex(0xa8d0d0), 1.2, 22); }
  g.light(0, y0 + 26, 0, hex(0xffc870), 1.3, 20);
  g.glows.push({ x: 0, y: y0 + 12, z: 0, r: 45, color: [0.012, 0.03, 0.03] });
  g.zone('Cavité du forage', 0, 0, 40, y0 - 1, y1);
}

/** Tunnel vers la grande porte circulaire (le Coffre avancé). */
function vaultTunnel(g: Gen) {
  const y0 = VOID_FLOOR;
  const z0 = -40.5, z1 = -92;
  const hw = 2.6, h = 5.2;              // tunnel de forage
  const zc = z1 + 9, cw = 5.2, ch = 8.6; // chambre de la porte, assez grande pour elle
  const rock = (x0: number, ya: number, za: number, x1: number, yb: number, zb: number, seed: number, c = 0x3e3a34) =>
    g.box(x0, ya, za, x1, yb, zb, { color: hex(c), style: STYLE.ROCK, seed });
  rock(-cw - 1.5, y0 - 1, z1 - 2, cw + 1.5, y0, z0 + 1, 200);
  rock(-hw - 1.5, y0 + h, zc, hw + 1.5, y0 + h + 1.5, z0 + 1, 201);
  for (const s of [-1, 1]) rock(Math.min(s * hw, s * (hw + 1.5)), y0, zc, Math.max(s * hw, s * (hw + 1.5)), y0 + h, z0 + 1, 202, 0x46423a);
  // chambre : parois, voûte, redents vers le tunnel
  rock(-cw - 1.5, y0 + ch, z1 - 2, cw + 1.5, y0 + ch + 1.5, zc + 0.8, 203);
  for (const s of [-1, 1]) rock(Math.min(s * cw, s * (cw + 1.5)), y0, z1 - 2, Math.max(s * cw, s * (cw + 1.5)), y0 + ch, zc + 0.8, 204, 0x46423a);
  for (const s of [-1, 1]) rock(Math.min(s * hw, s * cw), y0, zc, Math.max(s * hw, s * cw), y0 + ch, zc + 0.8, 205, 0x46423a);
  rock(-hw, y0 + h, zc, hw, y0 + ch, zc + 0.8, 206, 0x46423a);
  // percement de la paroi de la cavité
  g.box(-hw, y0, -42.9, hw, y0 + 0.02, -40, { color: hex(0x3a3834), style: STYLE.ROCK, solid: false });
  // étais de bois, lampes de chantier
  for (let z = z0 - 4; z > zc + 2; z -= 6) {
    for (const s of [-1, 1]) g.box(s * (hw - 0.25) - 0.15, y0, z - 0.15, s * (hw - 0.25) + 0.15, y0 + h, z + 0.15, { color: hex(0x5a4430), style: STYLE.WOOD });
    g.box(-hw, y0 + h - 0.35, z - 0.15, hw, y0 + h, z + 0.15, { color: hex(0x5a4430), style: STYLE.WOOD });
    g.box(-0.12, y0 + h - 0.6, z - 0.12, 0.12, y0 + h - 0.35, z + 0.12, { color: PAL.lamp, style: STYLE.EMISSIVE, emis: 2.4, seed: g.S(), solid: false, detail: true });
    g.light(0, y0 + h - 1, z, PAL.lamp, 0.9, 9);
  }
  // noms gravés dans la roche
  const names = ['S. QUINN', 'M. MEADOWS', 'G. WILKINS', 'IIII IIII II', 'QUI ÊTES-VOUS ?'];
  names.forEach((nm, i) => {
    const s = i % 2 ? 1 : -1;
    g.text(nm, s * (hw - 0.01), y0 + 1.4 + (i % 3) * 0.5, -52 - i * 7, -s, 0, 0.22, { tint: hex(0x9a9488), wear: 0.35 });
  });
  // la porte circulaire géante, scellée dans un mur de béton
  const Rd = 3.6, yc = y0 + Rd + 0.3, zd = z1 + 0.6;
  g.box(-cw, y0, zd - 1.5, cw, y0 + ch, zd - 0.5, { color: hex(0x4a4c48), style: STYLE.SOLID, extra: 0, seed: 212 });
  for (let i = 0; i < 72; i++) {
    const yy = yc - Rd + (i + 0.5) * ((2 * Rd) / 72);
    const w = Math.sqrt(Math.max(0, Rd * Rd - (yy - yc) ** 2));
    const ya = yc - Rd + i * ((2 * Rd) / 72), yb = ya + (2 * Rd) / 72;
    g.box(-w, ya, zd - 0.5, w, yb, zd, { color: hex(0x5a5a52), style: STYLE.SOLID, extra: 1, seed: 210 });
    const w2 = Math.sqrt(Math.max(0, (Rd - 0.4) ** 2 - (yy - yc) ** 2));
    if (w2 > 0) g.box(-w2, ya, zd, w2, yb, zd + 0.15, { color: hex(0x4e4e46), style: STYLE.SOLID, extra: 1, seed: 211, detail: true, solid: false });
  }
  for (let k = 0; k < 12; k++) { const a = (k / 12) * TAU; g.box(Math.cos(a) * 3.0 - 0.12, yc + Math.sin(a) * 3.0 - 0.12, zd + 0.15, Math.cos(a) * 3.0 + 0.12, yc + Math.sin(a) * 3.0 + 0.12, zd + 0.3, { color: hex(0x3a3a34), style: STYLE.BRASS, detail: true, solid: false }); }
  g.box(-0.6, yc - 0.6, zd + 0.15, 0.6, yc + 0.6, zd + 0.35, { color: hex(0x4a4a44), style: STYLE.BRASS, detail: true, solid: false });
  for (const a of [0, Math.PI / 2]) g.box(-Math.cos(a) * 1.4 - 0.08, yc - Math.sin(a) * 1.4 - 0.08, zd + 0.3, Math.cos(a) * 1.4 + 0.08, yc + Math.sin(a) * 1.4 + 0.08, zd + 0.42, { color: hex(0x3e3e38), style: STYLE.BRASS, detail: true, solid: false });
  // grille du haut-parleur (la Voix), à droite de la porte
  g.box(Rd + 0.5, y0 + 2.4, zd - 0.5, Rd + 1.1, y0 + 3.0, zd - 0.42, { color: hex(0x2a2a28), style: STYLE.GRATE, detail: true, solid: false });
  g.box(Rd + 0.65, y0 + 3.1, zd - 0.5, Rd + 0.95, y0 + 3.2, zd - 0.42, { color: hex(0x60ff90), style: STYLE.EMISSIVE, emis: 2.5, extra: 1, seed: 5, detail: true, solid: false });
  // éclairage rasant depuis les parois : la porte se lit par ses reliefs
  for (const s of [-1, 1]) {
    g.box(s * (cw - 0.12) - 0.1, y0 + 6.2, zd + 3.4, s * (cw - 0.12) + 0.1, y0 + 6.6, zd + 3.8, { color: PAL.lamp, style: STYLE.EMISSIVE, emis: 1.8, seed: g.S(), solid: false, detail: true });
    g.light(s * (cw - 0.8), y0 + 6, zd + 3.6, hex(0xffd8a8), 0.55, 11);
  }
  g.zone('Le Coffre avancé', 0, zd + 4, 6, y0 - 1, y0 + ch + 1);
  g.zone('Tunnel', 0, (z0 + zc) / 2, 22, y0 - 1, y0 + h + 1);
  g.dest('Porte du Coffre avancé', 0, y0, zd + 7.5, Math.atan2(0, 1));
  void rect;
}

export const deepRooms: Record<string, RoomFn> = {
  escalier_gen: (g, R) => escalierGen(g, R),
  electronique: (g, R) => electronique(g, R),
};
