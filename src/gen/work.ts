// Lieux de production : fermes, moulin, mines, Approvisionnement, traitement des eaux,
// fonderie, tri des ordures, ateliers et dortoirs de Mechanical.
import { PAL, R_OUT, R_SILO, STYLE, hex, type RGB } from '../config';
import { Gen, TAU, deg, polar, yawTo } from './common';
import { Frame, barrel, bunk, cabinet, counter, crate, lampCeil, piece, shelf, workbench } from './furniture';
import type { Room } from './interior';
import { hpipe } from './deep';
import { HALL_H, P3, angAt, arcPartition, at, hallFloor, hallLights, radialPartition, type RoomFn } from './special';

const face = (a: number) => yawTo(Math.cos(a), Math.sin(a));

// ---------------------------------------------------------------------------------------------
// Fermes : planches de culture concentriques, lampes de croissance, irrigation, petit élevage
// ---------------------------------------------------------------------------------------------
function ferme(g: Gen, R: Room) {
  const { u } = R;
  const shell = g.o.lod > 0;
  const crops: { c: RGB; h: number }[] = [
    { c: PAL.wheat, h: 0.9 }, { c: hex(0x9a8a3a), h: 0.8 }, { c: hex(0x4a7a32), h: 0.45 }, { c: hex(0x5a8a3a), h: 0.35 }, { c: hex(0x3e6a2e), h: 0.6 }, { c: hex(0x7a8a3a), h: 0.7 },
  ];
  const beds = [[21.4, 23.6], [24.4, 26.6], [27.4, 29.6], [30.4, 32.6], [33.4, 35.6], [36.4, 38.8]];
  const aisle = 1.4;
  const nSeg = shell ? 8 : 14;
  if (!shell) hallFloor(g, R, STYLE.DECK, hex(0x3e4240));
  // de loin (LOD 2), un seul plan de culture continu tient lieu des planches
  if (g.o.lod === 2) g.sector(beds[0][0], beds[beds.length - 1][1], u.a0, u.a1 - u.a0, g.F, g.F + 0.9, { color: hex(0x5a6a32), style: STYLE.FOLIAGE, extra: 2, seed: 2, solid: false });
  else beds.forEach(([r0, r1], bi) => {
    for (let s = 0; s < nSeg; s++) {
      const a0 = u.a0 + (s / nSeg) * (u.a1 - u.a0) + aisle / 2 / r0, a1 = u.a0 + ((s + 1) / nSeg) * (u.a1 - u.a0) - aisle / 2 / r0;
      if (a1 <= a0) continue;
      const cr = crops[(bi * 3 + s * 5 + g.n) % crops.length];
      // bac de terre et culture
      g.sector(r0, r1, a0, a1 - a0, g.F, g.F + 0.45, { color: hex(0x4a4c48), style: STYLE.SOLID, extra: 1, seed: 3 });
      g.sector(r0 + 0.1, r1 - 0.1, a0 + 0.1 / r0, a1 - a0 - 0.2 / r0, g.F + 0.45, g.F + 0.5, { color: PAL.soil, style: STYLE.SOIL, seed: 4, solid: false, bottom: false });
      g.sector(r0 + 0.15, r1 - 0.15, a0 + 0.15 / r0, a1 - a0 - 0.3 / r0, g.F + 0.5, g.F + 0.5 + cr.h, { color: cr.c, style: STYLE.FOLIAGE, extra: cr.h > 0.65 ? 1 : 2, seed: g.S(), solid: false });
    }
  });
  // lampes de croissance : bandes lumineuses sous le plafond au-dessus de chaque planche
  for (const [r0, r1] of beds) {
    const rm = (r0 + r1) / 2;
    g.sector(rm - 0.18, rm + 0.18, u.a0, u.a1 - u.a0, g.F + HALL_H - 0.3, g.F + HALL_H - 0.18, { color: g.n % 3 === 0 ? PAL.growPink : PAL.grow, style: STYLE.EMISSIVE, emis: 1.15, seed: 5, solid: false });
    g.sector(rm - 0.3, rm + 0.3, u.a0, u.a1 - u.a0, g.F + HALL_H - 0.18, g.F + HALL_H, { color: hex(0x2e3232), style: STYLE.SOLID, extra: 2, seed: 6, solid: false, top: false });
  }
  if (shell) return;
  // lumière (les plus proches seulement comptent)
  for (let k = 0; k < 24; k++) { const a = u.a0 + ((k + 0.5) / 24) * (u.a1 - u.a0); const [x, z] = polar(k % 2 ? 26 : 34, a); g.light(x, g.F + HALL_H - 1, z, g.n % 3 === 0 ? hex(0xffb0e8) : hex(0xfff0ff), 0.75, 13); }
  // irrigation
  g.sector(R_OUT - 0.5, R_OUT - 0.2, u.a0, u.a1 - u.a0, g.F + 2.6, g.F + 2.9, { color: hex(0x4a5a5a), style: STYLE.PIPE, seed: 7, solid: false });
  for (let k = 0; k < 20; k++) { const a = u.a0 + ((k + 0.5) / 20) * (u.a1 - u.a0); const [x, z] = polar(R_OUT - 0.5, a); g.box(x - 0.15, g.F, z - 0.15, x + 0.15, g.F + 2.7, z + 0.15, { color: hex(0x3a4a4a), style: STYLE.PIPE, detail: true, solid: false }); }
  // petit élevage (enclos) dans un secteur
  const pa = u.a0 + 0.55 * (u.a1 - u.a0);
  for (let k = 0; k < 3; k++) {
    const [x, z] = polar(22.5 + k * 1.2, pa);
    g.obox(x, z, pa + Math.PI / 2, 3.2, 0.08, g.F, g.F + 0.9, { color: PAL.wood, style: STYLE.WOOD, seed: 9 });
  }
  // fermiers au travail
  const loop: [number, number, number][] = [];
  for (let i = 0; i <= 80; i++) { const [x, z] = polar(24, u.a0 + (i / 80) * (u.a1 - u.a0)); loop.push([x, g.F, z]); }
  g.path(loop, false, 6, ['farmer', 'farmer', 'resident', 'child'], 12);
  for (let k = 0; k < 10; k++) {
    const a = u.a0 + g.rng.range(0.05, 0.95) * (u.a1 - u.a0);
    const r = g.rng.pick([24, 27, 30, 33, 36]);
    g.idle(...P3(polar(r, a), g.F), face(a + Math.PI / 2), g.rng.chance(0.5) ? 6 : 4, 'farmer');
  }
  for (let k = 0; k < 8; k++) crate(g, new Frame(...polar(g.rng.pick([23.9, 26.9, 29.9]), u.a0 + g.rng.range(0.05, 0.95) * (u.a1 - u.a0)), g.rng.range(0, TAU)), g.F, 0.5, hex(0x7a6a44));
  g.glows.push({ x: 0, y: g.F + 3, z: 0, r: 60, color: g.n % 3 === 0 ? [0.03, 0.012, 0.03] : [0.02, 0.028, 0.018] });
}

// ---------------------------------------------------------------------------------------------
// Moulin (niveau 59)
// ---------------------------------------------------------------------------------------------
function moulin(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x5a5448));
  hallLights(g, R, 7, PAL.lamp, HALL_H, 0.9, 10);
  for (const t of [0.3, 0.7]) {
    const [x, z] = at(R, 31, t);
    g.ring(x, z, 0, 2.2, g.F, g.F + 0.9, { color: hex(0x7a7468), style: STYLE.ROCK, seed: 3 });
    g.ring(x, z, 0, 2.1, g.F + 0.9, g.F + 1.4, { color: hex(0x8a8478), style: STYLE.ROCK, seed: 4 });
    g.ring(x, z, 0, 0.25, g.F + 1.4, g.F + 3.2, { color: hex(0x4a3a2a), style: STYLE.WOOD, seed: 5 });
    // trémie
    for (let i = 0; i < 6; i++) g.ring(x, z, 0, 0.5 + i * 0.18, g.F + 3.0 + i * 0.25, g.F + 3.25 + i * 0.25, { color: PAL.wood, style: STYLE.WOOD, seed: 6 });
    g.w.emitSteam(x, g.F + 1.5, z, 0.4, 2, 8, [0.5, 0.46, 0.38]);
    g.idle(...P3(at(R, 28.4, t), g.F), face(angAt(R, t)), 4, 'farmer');
  }
  // sacs et bacs de grain
  for (let k = 0; k < 24; k++) {
    const [x, z] = at(R, g.rng.range(22, 26), g.rng.range(0.08, 0.92));
    piece(g, new Frame(x, z, g.rng.range(0, TAU)), 0, 0, 0.5, 0.35, g.F, g.F + 0.55, hex(0xb8a878), STYLE.CLOTH, true);
  }
  for (let k = 0; k < 8; k++) barrel(g, ...at(R, 38.5, 0.1 + k * 0.1), g.F, hex(0x6a5a3a));
  // grande roue dentée d'entraînement
  const [wx, wz] = at(R, 37, 0.5);
  for (let i = 0; i < 20; i++) g.obox(wx, wz, R.ac + Math.PI / 2 + i * 0.16, 3.2, 0.3, g.F + 0.4 + i * 0.18, g.F + 0.58 + i * 0.18, { color: hex(0x4a4238), style: STYLE.BRASS, seed: 7 });
  g.sign('MOULIN · EN PANNE UNE SEMAINE SUR DEUX', ...P3(at(R, 21.05, 0.5), g.F + 3.3), Math.cos(R.ac), Math.sin(R.ac), 0.16, 'cream');
  g.zone('Le moulin', ...at(R, 30, 0.5), 12);
}

// ---------------------------------------------------------------------------------------------
// Mines (niveau 70) : hall, rails, wagonnets, galerie creusée hors du silo
// ---------------------------------------------------------------------------------------------
function mines(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.ROCK, hex(0x4a463e));
  hallLights(g, R, 7, PAL.lamp, HALL_H, 0.9, 10);
  const a = R.ac;
  // rails depuis l'entrée jusqu'à la galerie
  for (const s of [-0.6, 0.6]) {
    const [x, z] = polar(34.5, a);
    g.obox(x - Math.sin(a) * s, z + Math.cos(a) * s, a, 26, 0.08, g.F, g.F + 0.1, { color: hex(0x6a6a64), style: STYLE.BRASS, seed: 3, solid: false });
  }
  for (let r = 22; r < 47; r += 0.8) { const [x, z] = polar(r, a); g.obox(x, z, a, 0.2, 1.8, g.F, g.F + 0.05, { color: hex(0x4a3a2a), style: STYLE.WOOD, seed: 4, solid: false }); }
  // wagonnets
  for (const r of [27, 31]) {
    const fr = new Frame(...polar(r, a), a);
    piece(g, fr, 0, 0, 1.6, 1.2, g.F + 0.3, g.F + 1.2, hex(0x5a4a3a), STYLE.SOLID, true, 0, 1);
    piece(g, fr, 0, 0, 1.4, 1.0, g.F + 1.0, g.F + 1.25, hex(0x3a3632), STYLE.ROCK);
  }
  // galerie : à travers le mur d'enceinte, dans la roche
  g.wallCuts.push({ a, hw: 1.9, y0: 0, y1: 3.2 });
  const len = 16, r0 = R_SILO, r1 = R_SILO + len;
  for (const s of [-1, 1]) { const [x, z] = polar((r0 + r1) / 2, a); g.obox(x - Math.sin(a) * s * 2.6, z + Math.cos(a) * s * 2.6, a, len + 2, 1.4, g.F - 0.6, g.F + 3.8, { color: hex(0x4a443a), style: STYLE.ROCK, seed: 5, res: 0.1 }); }
  { const [x, z] = polar((r0 + r1) / 2, a); g.obox(x, z, a, len + 2, 6.6, g.F + 3.2, g.F + 4.2, { color: hex(0x44403a), style: STYLE.ROCK, seed: 6, res: 0.1 }); g.obox(x, z, a, len + 2, 6.6, g.F - 0.6, g.F, { color: hex(0x3e3a34), style: STYLE.ROCK, seed: 7, res: 0.1 }); }
  { const [x, z] = polar(r1 + 0.6, a); g.obox(x, z, a, 1.2, 6.6, g.F - 0.6, g.F + 4.2, { color: hex(0x3a3630), style: STYLE.ROCK, seed: 8, res: 0.1 }); }
  for (let r = r0 + 2; r < r1; r += 3) {
    for (const s of [-1.6, 1.6]) { const [x, z] = polar(r, a); g.obox(x - Math.sin(a) * s, z + Math.cos(a) * s, a, 0.3, 0.3, g.F, g.F + 3.2, { color: hex(0x5a4430), style: STYLE.WOOD, seed: 9 }); }
    const [x, z] = polar(r, a);
    g.obox(x, z, a, 0.3, 3.6, g.F + 2.9, g.F + 3.2, { color: hex(0x5a4430), style: STYLE.WOOD, seed: 9 });
    g.box(x - 0.1, g.F + 2.6, z - 0.1, x + 0.1, g.F + 2.9, z + 0.1, { color: PAL.lamp, style: STYLE.EMISSIVE, emis: 2.2, extra: g.rng.chance(0.3) ? 2 : 0, seed: g.S(), detail: true, solid: false });
    g.light(x, g.F + 2.4, z, PAL.lamp, 0.8, 7, g.rng.chance(0.2) ? g.S() + 1 : undefined);
  }
  g.zone('Galerie des mines', ...polar((r0 + r1) / 2, a), 9);
  // casiers, casques, mineurs
  for (let k = 0; k < 6; k++) cabinet(g, new Frame(...at(R, 38, 0.1 + k * 0.05), angAt(R, 0.1 + k * 0.05) + Math.PI), g.F, 0.8, 1.9, hex(0x4a4e48));
  for (let k = 0; k < 5; k++) g.idle(...P3(at(R, g.rng.range(24, 34), g.rng.range(0.2, 0.8)), g.F), g.rng.range(0, TAU), g.rng.chance(0.5) ? 2 : 12, 'mechanic');
  g.sign('MINES · ENTRÉE DES CONDAMNÉS INTERDITE AUX VISITEURS', ...P3(at(R, 21.05, 0.5), g.F + 4.5), Math.cos(a), Math.sin(a), 0.16, 'yellow');
  g.dest('Galerie des mines', ...P3(polar(38, a), g.F), Math.atan2(-Math.cos(a), -Math.sin(a)) + Math.PI);
}

// ---------------------------------------------------------------------------------------------
// Approvisionnement : rayonnages, réserve critique grillagée, guichet
// ---------------------------------------------------------------------------------------------
function approvisionnement(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x4e5250));
  hallLights(g, R, 7, PAL.tube, HALL_H, 0.9, 10);
  counter(g, new Frame(...at(R, 23, 0.5), R.ac), g.F, 5);
  g.idle(...P3(at(R, 23.8, 0.5), g.F), face(R.ac + Math.PI), 10, 'resident');
  // rayonnages
  for (let r = 26; r < 36; r += 2.4) for (let t = 0.08; t < 0.92; t += 0.07) {
    if (t > 0.42 && t < 0.58 && r > 30) continue;
    const a = angAt(R, t);
    const fr = new Frame(...at(R, r, t), a + Math.PI / 2);
    piece(g, fr, 0, 0, 0.9, 1.8, g.F, g.F + 0.06, hex(0x5a5e5a), STYLE.BRASS, true);
    for (let k = 0; k < 4; k++) piece(g, fr, 0, 0, 0.9, 1.8, g.F + 0.9 + k * 0.9, g.F + 0.95 + k * 0.9, hex(0x5a5e5a), STYLE.BRASS);
    for (const [dd, ss] of [[-0.42, -0.86], [-0.42, 0.86], [0.42, -0.86], [0.42, 0.86]]) piece(g, fr, dd, ss, 0.06, 0.06, g.F, g.F + 3.6, hex(0x3e4240), STYLE.BRASS);
    for (let k = 0; k < 4; k++) for (let q = 0; q < 2; q++) if (g.rng.chance(0.75)) piece(g, fr, g.rng.range(-0.2, 0.2), -0.45 + q * 0.9, 0.6, 0.7, g.F + 0.06 + k * 0.9, g.F + 0.06 + k * 0.9 + g.rng.range(0.35, 0.8), g.pick([hex(0x6a5236), hex(0x5a6a5a), hex(0x8a7a5a), hex(0x4a5a6a), hex(0xb8a878)]), STYLE.WOOD);
  }
  // réserve critique : cage grillagée et porte-coffre
  const t0 = 0.42, t1 = 0.58;
  arcPartition(g, R, 31, t0, t1, 3.2, [{ t: 0.5, w: 1.3 }], hex(0x3a3e3e));
  for (const t of [t0, t1]) radialPartition(g, R, t, 31, R_OUT, 3.2, [], hex(0x3a3e3e));
  const [vx, vz] = at(R, 30.9, 0.5);
  g.ring(vx - Math.cos(R.ac) * 0.05, vz - Math.sin(R.ac) * 0.05, 0, 0.3, g.F + 1.0, g.F + 1.1, { color: hex(0x9a8a50), style: STYLE.BRASS, solid: false, detail: true });
  g.sign('RÉSERVE CRITIQUE · ACCÈS : CHEF DE L’APPROVISIONNEMENT', vx - Math.cos(R.ac) * 0.12, g.F + 2.7, vz - Math.sin(R.ac) * 0.12, -Math.cos(R.ac), -Math.sin(R.ac), 0.12, 'red');
  for (let k = 0; k < 8; k++) barrel(g, ...at(R, g.rng.range(33, 39), g.rng.range(t0 + 0.02, t1 - 0.02)), g.F, hex(0x3a4a5a));
  g.zone('Réserve critique', ...at(R, 35, 0.5), 4);
  // chiens de garde (niches) et rouleaux de ruban thermique
  for (const t of [0.2, 0.8]) { const fr = new Frame(...at(R, 38.4, t), angAt(R, t) + Math.PI); piece(g, fr, 0, 0, 1.0, 0.9, g.F, g.F + 0.8, PAL.wood, STYLE.WOOD, true); }
  g.zone('Entrepôts de l’Approvisionnement', ...at(R, 30, 0.3), 12);
}

// ---------------------------------------------------------------------------------------------
// Traitement des eaux : cuves, bassins, pompes
// ---------------------------------------------------------------------------------------------
function eau(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x44504e));
  hallLights(g, R, 8, hex(0xc8e8ff), HALL_H, 0.9, 11);
  for (const t of [0.15, 0.38, 0.62, 0.85]) {
    const [x, z] = at(R, 33, t);
    g.ring(x, z, 0, 3.0, g.F, g.F + 4.6, { color: hex(0x5a6a6a), style: STYLE.SOLID, extra: 1, seed: 3 });
    for (let k = 0; k < 4; k++) g.ring(x, z, 2.95, 3.12, g.F + 0.6 + k * 1.1, g.F + 0.75 + k * 1.1, { color: hex(0x3a4442), style: STYLE.BRASS, seed: 4 });
    g.ring(x, z, 0, 0.35, g.F + 4.6, g.F + HALL_H, { color: hex(0x4a5a5a), style: STYLE.PIPE, seed: 5 });
  }
  // bassins de décantation à ciel ouvert
  for (const t of [0.27, 0.5, 0.73]) {
    const a = angAt(R, t);
    const [x, z] = at(R, 25, t);
    g.obox(x, z, a, 4.2, 5.2, g.F, g.F + 0.9, { color: hex(0x4a5250), style: STYLE.SOLID, extra: 0, seed: 6 });
    g.obox(x, z, a, 3.8, 4.8, g.F + 0.7, g.F + 0.78, { color: PAL.water, style: STYLE.WATER, emis: 0.4, seed: 7, solid: false });
  }
  hpipe(g, ...at(R, 36.6, 0.1), ...at(R, 36.6, 0.9), g.F + 4.9, 0.35, hex(0x3a5a6a), false);
  for (let k = 0; k < 4; k++) g.idle(...P3(at(R, g.rng.range(27, 30), g.rng.range(0.2, 0.8)), g.F), g.rng.range(0, TAU), g.rng.chance(0.5) ? 4 : 10, 'mechanic');
  g.zone('Traitement des eaux', ...at(R, 30, 0.5), 14);
}

// ---------------------------------------------------------------------------------------------
// Mechanical : fonderie, tri, ateliers, dortoirs
// ---------------------------------------------------------------------------------------------
function fonderie(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x3e3a36), 1);
  hallLights(g, R, 8, PAL.sodium, HALL_H, 0.9, 11);
  const [fx, fz] = at(R, 34, 0.5);
  g.ring(fx, fz, 0, 3.2, g.F, g.F + 4.2, { color: hex(0x3a3430), style: STYLE.SOLID, extra: 1, seed: 3 });
  g.shape(ringArc(fx, fz, 3.15, 3.3, R.ac + Math.PI - 0.5, 1.0), g.F + 0.8, g.F + 2.0, { color: PAL.furnace, style: STYLE.FURNACE, emis: 5, seed: 4, solid: false });
  g.ring(fx, fz, 0, 0.8, g.F + 4.2, g.F + HALL_H, { color: hex(0x2a2826), style: STYLE.PIPE, seed: 5 });
  g.light(fx - Math.cos(R.ac) * 4, g.F + 1.5, fz - Math.sin(R.ac) * 4, PAL.furnace, 2.4, 16);
  g.glows.push({ x: fx, y: g.F + 1.5, z: fz, r: 18, color: [0.12, 0.05, 0.015] });
  for (let k = 0; k < 6; k++) g.w.emitSteam(fx + g.rng.range(-2, 2), g.F + 4.2, fz + g.rng.range(-2, 2), 0.7, 5, 8, [0.3, 0.26, 0.22]);
  // lingotières, enclumes, creuset suspendu
  for (let k = 0; k < 6; k++) { const [x, z] = at(R, 28, 0.25 + k * 0.1); piece(g, new Frame(x, z, R.ac), 0, 0, 1.0, 0.6, g.F, g.F + 0.5, hex(0x2a2826), STYLE.BRASS, true); if (k % 2) piece(g, new Frame(x, z, R.ac), 0, 0, 0.8, 0.4, g.F + 0.5, g.F + 0.52, PAL.furnace, STYLE.FURNACE, false, 3); }
  for (const t of [0.2, 0.8]) { const [x, z] = at(R, 25, t); piece(g, new Frame(x, z, R.ac), 0, 0, 0.5, 0.9, g.F, g.F + 0.85, hex(0x2a2a2a), STYLE.BRASS, true); g.idle(...P3(at(R, 24.2, t), g.F), face(R.ac), 4, 'mechanic'); }
  g.zone('Fonderie', fx, fz, 10);
}

function ringArc(cx: number, cz: number, r0: number, r1: number, a0: number, span: number) {
  return ringShape(cx, cz, r0, r1, a0, span);
}
import { ring as ringShape } from '../world/voxel2d';

function tri(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x3e3e3a), 1);
  hallLights(g, R, 7, PAL.tube, HALL_H, 0.9, 10);
  // débouché de la chute d'ordures (tube du plafond)
  const [cx, cz] = at(R, 30, 0.2);
  g.ring(cx, cz, 0.9, 1.3, g.F + 2.6, g.F + HALL_H, { color: hex(0x5a5e5a), style: STYLE.SOLID, extra: 1, seed: 3 });
  g.ring(cx, cz, 0, 2.2, g.F, g.F + 1.0, { color: hex(0x4a4e4a), style: STYLE.SOLID, extra: 1, seed: 4 });
  for (let k = 0; k < 10; k++) crate(g, new Frame(cx + g.rng.range(-1.5, 1.5), cz + g.rng.range(-1.5, 1.5), g.rng.range(0, TAU)), g.F + 1.0, g.rng.range(0.25, 0.5), g.pick([hex(0x5a5a50), hex(0x6a5a44), hex(0x4a4a4a)]));
  // chaîne de tri : tapis roulant en arc
  const r = 30;
  g.sector(r - 0.6, r + 0.6, angAt(R, 0.3), angAt(R, 0.85) - angAt(R, 0.3), g.F + 0.8, g.F + 0.9, { color: hex(0x3a3a38), style: STYLE.BELT, seed: 5 });
  g.sector(r - 0.7, r + 0.7, angAt(R, 0.3), angAt(R, 0.85) - angAt(R, 0.3), g.F, g.F + 0.8, { color: hex(0x4a4c4a), style: STYLE.SOLID, extra: 1, seed: 6 });
  for (let k = 0; k < 16; k++) { const t = 0.32 + k * 0.033; const [x, z] = at(R, r + g.rng.range(-0.4, 0.4), t); piece(g, new Frame(x, z, g.rng.range(0, TAU)), 0, 0, g.rng.range(0.15, 0.35), g.rng.range(0.15, 0.35), g.F + 0.9, g.F + 0.9 + g.rng.range(0.1, 0.25), g.pick([hex(0x6a6a60), hex(0x8a6a3a), hex(0x3a4a5a)]), STYLE.FLESH); }
  for (let k = 0; k < 6; k++) { const t = 0.36 + k * 0.08; const s = k % 2 ? 1.3 : -1.3; g.idle(...P3(at(R, r + s, t), g.F), face(angAt(R, t) + (s > 0 ? Math.PI : 0)), 4, g.rng.chance(0.5) ? 'mechanic' : 'resident'); }
  // incinérateur
  const [ix, iz] = at(R, 37.5, 0.9);
  g.obox(ix, iz, angAt(R, 0.9), 3.4, 3.4, g.F, g.F + 3.4, { color: hex(0x2e2c2a), style: STYLE.SOLID, extra: 1, seed: 7 });
  g.obox(ix - Math.cos(angAt(R, 0.9)) * 1.72, iz - Math.sin(angAt(R, 0.9)) * 1.72, angAt(R, 0.9), 0.04, 1.4, g.F + 0.6, g.F + 1.6, { color: PAL.furnace, style: STYLE.FURNACE, emis: 4, seed: 8, solid: false });
  g.light(ix - Math.cos(angAt(R, 0.9)) * 3, g.F + 1.2, iz - Math.sin(angAt(R, 0.9)) * 3, PAL.furnace, 1.6, 10);
  g.sign('RÉCUPÉRATION · BON → RECYCLAGE · TRÈS BON → WALKER', ...P3(at(R, 21.05, 0.5), g.F + 3.3), Math.cos(R.ac), Math.sin(R.ac), 0.14, 'cream');
  g.zone('Chaîne de tri', ...at(R, 30, 0.55), 10);
  g.zone('Salle de récupération', cx, cz, 4);
  g.zone('Incinérateur', ix, iz, 4);
}

function atelierMeca(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x42423e), 1);
  hallLights(g, R, 7, PAL.sodium, HALL_H, 0.9, 11);
  for (let r = 24; r < 38; r += 3.2) for (let t = 0.12; t < 0.9; t += 0.16) {
    const a = angAt(R, t);
    const k = g.rng.next();
    if (k < 0.35) workbench(g, new Frame(...at(R, r, t), a + Math.PI / 2), g.F, 2.4);
    else if (k < 0.6) {
      // tour ou moteur sur bâti
      const fr = new Frame(...at(R, r, t), a + Math.PI / 2);
      piece(g, fr, 0, 0, 0.9, 2.2, g.F, g.F + 1.0, hex(0x4a5250), STYLE.SOLID, true, 0, 1);
      piece(g, fr, 0, -0.6, 0.6, 0.6, g.F + 1.0, g.F + 1.5, hex(0x3a3c3c), STYLE.BRASS);
      piece(g, fr, 0, 0.3, 0.2, 1.0, g.F + 1.1, g.F + 1.3, hex(0x8a8a86), STYLE.BRASS);
    } else if (k < 0.75) barrel(g, ...at(R, r, t), g.F, g.pick([hex(0x5a3a2a), hex(0x3a4a5a), hex(0x4a5a3a)]));
    else crate(g, new Frame(...at(R, r, t), a), g.F, 0.7);
  }
  // tuyauteries au plafond, vapeur
  for (const r of [23, 29, 35]) g.sector(r - 0.25, r + 0.25, R.u.a0, R.u.a1 - R.u.a0, g.F + HALL_H - 0.8, g.F + HALL_H - 0.3, { color: hex(0x4a4e48), style: STYLE.PIPE, seed: 9, solid: false });
  for (let k = 0; k < 3; k++) { const [x, z] = at(R, g.rng.range(24, 36), g.rng.range(0.2, 0.8)); g.w.emitSteam(x, g.F + HALL_H - 0.9, z, 0.5, -1.5, 6, [0.3, 0.3, 0.28]); }
  for (let k = 0; k < 7; k++) g.idle(...P3(at(R, g.rng.range(23, 37), g.rng.range(0.1, 0.9)), g.F), g.rng.range(0, TAU), g.rng.pick([4, 4, 2, 12]), 'mechanic');
  g.zone('Ateliers de Mechanical', ...at(R, 30, 0.5), 12);
}

function dortoir(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.WOOD, hex(0x4a3e30));
  hallLights(g, R, 6, PAL.lamp, HALL_H, 0.8, 8);
  for (let r = 23.5; r < 39; r += 2.6) for (let t = 0.06; t < 0.95; t += 0.07) {
    const a = angAt(R, t);
    bunk(g, new Frame(...at(R, r, t), a), g.F);
    if (g.rng.chance(0.2)) g.idle(...P3(at(R, r, t), g.F + 0.35), face(a), 9, 'mechanic');
  }
  for (let k = 0; k < 10; k++) cabinet(g, new Frame(...at(R, 39.5, 0.05 + k * 0.09), angAt(R, 0.05 + k * 0.09) + Math.PI), g.F, 0.6, 1.8, hex(0x4a4e48));
  g.zone('Dortoirs de Mechanical', ...at(R, 30, 0.5), 10);
}

export const workRooms: Record<string, RoomFn> = {
  ferme: (g, R) => ferme(g, R),
  moulin: (g, R) => moulin(g, R),
  mines: (g, R) => mines(g, R),
  approvisionnement: (g, R) => approvisionnement(g, R),
  eau: (g, R) => eau(g, R),
  fonderie: (g, R) => fonderie(g, R),
  tri: (g, R) => tri(g, R),
  atelier: (g, R) => atelierMeca(g, R),
  dortoir: (g, R) => dortoir(g, R),
};

void deg; void counter; void shelf; void lampCeil; void radialPartition;
