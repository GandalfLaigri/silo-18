// Lieux institutionnels et de vie : IT et le Coffre, Judiciaire, maire, porteurs, hôpital, école,
// auberge, bar, observateurs, recyclage, parc et petits lieux nommés.
import { LH, PAL, R_OUT, SLAB, STYLE, hex } from '../config';
import { PLATE, POSTER } from '../world/decalTiles';
import { Gen, TAU, deg, polar, yawTo } from './common';
import { Frame, bed, bunk, cabinet, chair, counter, crate, crt, desk, lampCeil, piece, plant, rug, shelf, table, workbench } from './furniture';
import type { Room } from './interior';
import { HALL_H, P3, angAt, arcPartition, at, canteenTables, hallFloor, hallLights, outsideScreenFlat, radialPartition, type RoomFn } from './special';

const face = (a: number) => yawTo(Math.cos(a), Math.sin(a));
/** Plafond bas d'une salle (sous les gaines). */
function lowCeil(g: Gen, R: Room, h = 3.0, t0 = 0, t1 = 1, r0 = R.r0, r1 = R.r1) {
  g.sector(r0, r1, angAt(R, t0), angAt(R, t1) - angAt(R, t0), g.F + h, g.F + h + 0.12, { color: hex(0x8c8c84), style: STYLE.SOLID, extra: 2, solid: false });
}

// ---------------------------------------------------------------------------------------------
// Département IT (niveau 19) : bureaux, bureau de Bernard, salle des serveurs, le Coffre
// ---------------------------------------------------------------------------------------------
function it(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x5a5e5c), 1);
  lowCeil(g, R, 3.2);
  // accueil
  const [ax, az] = at(R, 23.2, 0.5);
  counter(g, new Frame(ax, az, R.ac), g.F, 3.2, hex(0x9a9a90), hex(0x4a5250));
  g.idle(...P3(at(R, 24.0, 0.5), g.F), face(R.ac + Math.PI), 10, 'it');
  g.sign('DÉPARTEMENT DE L’INFORMATIQUE', ...P3(at(R, 21.05, 0.5), g.F + 2.7), Math.cos(R.ac), Math.sin(R.ac), 0.2, 'white');
  // grand bureau paysager : rangées de terminaux verts
  for (let r = 25.6; r < 31.5; r += 2.2) for (const t of [0.14, 0.26, 0.38, 0.62, 0.74, 0.86]) {
    const a = angAt(R, t);
    desk(g, new Frame(...at(R, r, t), a + Math.PI), g.F);
    if (g.rng.chance(0.6)) g.idle(...P3(at(R, r + 0.65, t), g.F), face(a + Math.PI), 8, 'it');
  }
  for (let k = 0; k < 10; k++) lampCeil(g, ...(at(R, 24 + (k % 2) * 5, 0.1 + (k >> 1) * 0.2) as [number, number]), g.F + 3.2, PAL.tube, k % 2 ? 0.8 : 0, 9);
  // couloir et bureau de Bernard Holland (à droite)
  arcPartition(g, R, 32.4, 0.52, 1, HALL_H, [{ t: 0.6, w: 1.2 }], hex(0x6e7470));
  radialPartition(g, R, 0.52, 32.4, R_OUT, HALL_H, [{ r: 34.5, w: 1.0 }], hex(0x6e7470));
  {
    const t = 0.78, a = angAt(R, t);
    rug(g, new Frame(...at(R, 36.4, t), a), g.F, 3.2, 3.8);
    desk(g, new Frame(...at(R, 37.4, t), a + Math.PI), g.F, true);
    for (const dt of [-0.12, 0.12]) shelf(g, new Frame(...at(R, 39.5, t + dt), a + Math.PI), g.F, 1.4, 2.2);
    chair(g, new Frame(...at(R, 35.4, t - 0.06), a), g.F, hex(0x5a3a2a));
    chair(g, new Frame(...at(R, 35.4, t + 0.06), a), g.F, hex(0x5a3a2a));
    piece(g, new Frame(...at(R, 37.2, t + 0.04), a), 0, 0, 0.08, 0.08, g.F + 0.76, g.F + 1.0, hex(0x6a3a14), STYLE.GLASS, false, 0.6);   // la bouteille de brandy
    lampCeil(g, ...at(R, 36.5, t), g.F + 3.2, PAL.lamp, 0.9, 6);
    g.zone('Bureau de Bernard Holland', ...at(R, 36.5, t), 3.5);
    g.idle(...P3(at(R, 38.1, t), g.F), face(a + Math.PI), 8, 'it');
  }
  // salle des serveurs (à gauche, au fond) et le Coffre derrière
  arcPartition(g, R, 32.4, 0, 0.48, HALL_H, [{ t: 0.38, w: 1.2 }], hex(0x5a6064));
  radialPartition(g, R, 0.48, 32.4, R_OUT, HALL_H, [], hex(0x5a6064));
  radialPartition(g, R, 0.2, 32.4, R_OUT, HALL_H, [{ r: 36.2, w: 1.3 }], hex(0x4a4e50));
  for (let r = 33.6; r < 39.5; r += 1.5) for (const t of [0.26, 0.33, 0.41]) {
    const a = angAt(R, t);
    piece(g, new Frame(...at(R, r, t), a + Math.PI / 2), 0, 0, 0.7, 0.9, g.F, g.F + 2.1, hex(0x2c3034), STYLE.SOLID, true, 0, 1);
    for (let k = 0; k < 6; k++) piece(g, new Frame(...at(R, r, t), a + Math.PI / 2), -0.36, g.rng.range(-0.35, 0.35), 0.02, 0.05, g.F + 0.3 + k * 0.3, g.F + 0.34 + k * 0.3, g.pick([PAL.green, hex(0xffa040), hex(0x80c0ff)]), STYLE.EMISSIVE, false, 3, g.rng.chance(0.5) ? 3 : 0);
  }
  lampCeil(g, ...at(R, 36, 0.33), g.F + 3.2, hex(0xa8c8ff), 1.0, 8);
  g.zone('Salle des serveurs', ...at(R, 36, 0.33), 4);
  // le Coffre : porte blindée ronde, écran de la Voix, livre de l'Ordre, réserves
  {
    const t = 0.1, a = angAt(R, t);
    {
      // porte blindée ronde, ouverte vers l'intérieur, pivotée sur le bord de l'ouverture
      const th = angAt(R, 0.2);
      const df = new Frame(...polar(36.95, th), th - Math.PI / 2);   // profondeur : vers le Coffre
      const RD = 1.15, yc = g.F + 1.25, N = 14;
      for (let k = 0; k < N; k++) {
        const y0 = yc - RD + (k / N) * 2 * RD, y1 = yc - RD + ((k + 1) / N) * 2 * RD;
        const ym = (y0 + y1) / 2 - yc;
        const w = 2 * Math.sqrt(Math.max(0, RD * RD - ym * ym));
        piece(g, df, RD + 0.1, 0, w, 0.34, y0, y1, PAL.steel, STYLE.BRASS, true);
        if (w > 0.8) piece(g, df, RD + 0.1, 0, w - 0.3, 0.4, y0, y1, hex(0x5a5e60), STYLE.SOLID, false, 0, 1);
      }
      // moyeu, volant et pênes
      piece(g, df, RD + 0.1, 0, 0.5, 0.5, yc - 0.25, yc + 0.25, PAL.brass, STYLE.BRASS);
      for (const a of [0, Math.PI / 3, (2 * Math.PI) / 3]) {
        const c = Math.cos(a) * 0.45, s = Math.sin(a) * 0.45;
        piece(g, df, RD + 0.1 + c, 0.24, 0.06, 0.06, yc + s - 0.03, yc + s + 0.03, PAL.brass, STYLE.BRASS);
        piece(g, df, RD + 0.1 - c, 0.24, 0.06, 0.06, yc - s - 0.03, yc - s + 0.03, PAL.brass, STYLE.BRASS);
      }
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * TAU;
        piece(g, df, RD + 0.1 + Math.cos(a) * (RD + 0.06), 0, 0.14, 0.14, yc + Math.sin(a) * (RD + 0.06) - 0.07, yc + Math.sin(a) * (RD + 0.06) + 0.07, PAL.steel, STYLE.BRASS);
      }
    }
    g.sign('ACCÈS RÉSERVÉ · CHEF DE L’IT', ...P3(at(R, 35.2, 0.215), g.F + 2.5), Math.cos(angAt(R, 0.2) + Math.PI / 2), Math.sin(angAt(R, 0.2) + Math.PI / 2), 0.14, 'red');
    const [sx, sz] = at(R, 39.6, t);
    // écran de la Voix : forme d'onde
    piece(g, new Frame(sx, sz, a + Math.PI), 0.05, 0, 0.1, 2.4, g.F + 1.0, g.F + 2.4, hex(0x1a1c1c), STYLE.BRASS);
    // l'écran : motif plaqué (plan net, même sur un mur oblique), trace animée par le shader (wear < 0)
    g.decal(sx - Math.cos(a) * 0.12, g.F + 1.7, sz - Math.sin(a) * 0.12, -Math.cos(a), -Math.sin(a), PLATE.dark, 2.1, 1.1, { glow: 2.4, wear: -1 });
    const lf = new Frame(...at(R, 37, t), a + Math.PI);
    piece(g, lf, 0, 0, 0.5, 0.6, g.F, g.F + 1.1, PAL.woodDark, STYLE.WOOD, true);                       // lutrin
    piece(g, lf, 0, 0, 0.42, 0.55, g.F + 1.1, g.F + 1.2, hex(0x5a1a14), STYLE.WOOD);                     // l'Ordre
    for (const dt of [-0.07, 0.07]) shelf(g, new Frame(...at(R, 34.2, t + dt), a), g.F, 1.4, 2.4);
    for (let k = 0; k < 5; k++) crate(g, new Frame(...at(R, g.rng.range(33.5, 38), t + g.rng.range(-0.08, 0.08)), g.rng.range(0, TAU)), g.F, 0.5, hex(0x4a5a4a));
    {
      // l'orbe qui rougeoie quand la Voix convoque
      const [ox, oz] = at(R, 36.5, t);
      g.box(ox - 0.2, g.F + 3.0, oz - 0.2, ox + 0.2, g.F + 3.1, oz + 0.2, { color: hex(0xff3020), style: STYLE.EMISSIVE, emis: 2.5, extra: 1, seed: 4, detail: true, solid: false });
    }
    g.light(...P3(at(R, 37, t), g.F + 2.4), hex(0xffb8a0), 0.8, 7);
    g.zone('Le Coffre', ...at(R, 36.5, t), 4);
    g.dest('Le Coffre (IT)', ...P3(at(R, 35.4, 0.2), g.F), Math.atan2(-Math.cos(angAt(R, 0.2) - Math.PI / 2), -Math.sin(angAt(R, 0.2) - Math.PI / 2)));
  }
}

function combinaisons(g: Gen, R: Room) {
  const { f, D, hw } = R;
  hallFloor(g, R, STYLE.TILE, hex(0x6a6e6c));
  lowCeil(g, R, 2.9);
  lampCeil(g, ...f.at(D / 2, 0), g.F + 2.9, PAL.tube, 1.0, 7);
  // combinaisons de nettoyage suspendues, casques sur l'étagère
  for (let k = 0; k < 5; k++) {
    const s = -hw(D - 0.6) + 0.8 + k * 0.9;
    if (Math.abs(s) > hw(D - 0.6) - 0.3) continue;
    const fr = new Frame(...f.at(D - 0.6, s), R.ac + Math.PI);
    piece(g, fr, 0, 0, 0.3, 0.55, g.F + 0.3, g.F + 1.8, hex(0xe8e6de), STYLE.CLOTH);
    piece(g, fr, 0, 0, 0.32, 0.6, g.F + 1.0, g.F + 1.08, hex(0x3a3a3a), STYLE.CLOTH);                // ruban thermique
    piece(g, fr, 0, 0, 0.36, 0.36, g.F + 1.85, g.F + 2.2, hex(0xd8dad4), STYLE.BRASS);                // casque
    piece(g, fr, -0.19, 0, 0.02, 0.26, g.F + 1.92, g.F + 2.12, hex(0x506070), STYLE.GLASS, false, 0.3); // visière
  }
  workbench(g, new Frame(...f.at(2.0, hw(2) - 0.45), R.ac - Math.PI / 2), g.F, 2.0);
  for (let k = 0; k < 6; k++) { const fr = new Frame(...f.at(1.6 + k * 0.12, hw(2) - 0.4), 0); g.ring(fr.x, fr.z, 0.03, 0.09, g.F + 0.95, g.F + 1.02, { color: hex(0x2a2a2a), style: STYLE.FLESH, solid: false, detail: true }); }
  g.idle(...P3(f.at(2.4, hw(2) - 1.1), g.F), face(R.ac - Math.PI / 2 + Math.PI), 4, 'it');
  g.zone('Salle des combinaisons', ...f.at(D / 2, 0), 3.5);
}

// ---------------------------------------------------------------------------------------------
// Judiciaire (niveau 14)
// ---------------------------------------------------------------------------------------------
function judiciaire(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.MARBLE, hex(0x6a665e));
  lowCeil(g, R, 3.4);
  // deux agents à l'entrée
  for (const dt of [-0.06, 0.06]) g.idle(...P3(at(R, 21.6, 0.5 + dt), g.F), face(R.ac + Math.PI), 10, 'judicial');
  g.sign('JUDICIAIRE', ...P3(at(R, 21.05, 0.5), g.F + 2.8), Math.cos(R.ac), Math.sin(R.ac), 0.26, 'dark');
  // bureau de la juge Meadows : en façade, fenêtre sur l'escalier (partie gauche)
  radialPartition(g, R, 0.3, 20.8, 29, 3.4, [], hex(0x5a5448));
  arcPartition(g, R, 29, 0, 0.3, 3.4, [{ t: 0.2, w: 1.0 }], hex(0x5a5448));
  {
    const t = 0.14, a = angAt(R, t);
    rug(g, new Frame(...at(R, 24.5, t), a), g.F, 3, 3.5);
    desk(g, new Frame(...at(R, 25.2, t), a), g.F, false);
    shelf(g, new Frame(...at(R, 28.6, t), a + Math.PI), g.F, 1.8, 2.4);
    chair(g, new Frame(...at(R, 23.8, t + 0.04), a + Math.PI), g.F, hex(0x4a2a1a));
    plant(g, new Frame(...at(R, 21.4, 0.03), a), g.F);
    lampCeil(g, ...at(R, 25, t), g.F + 3.4, PAL.lamp, 0.9, 6);
    g.zone('Bureau de la juge Meadows', ...at(R, 25, t), 3.5);
    g.idle(...P3(at(R, 24.6, t), g.F), face(a + Math.PI), 8, 'judicial');
  }
  // bureau de Robert Sims et salle des reliques (partie droite, au fond)
  radialPartition(g, R, 0.7, 20.8, R_OUT, 3.4, [{ r: 30.5, w: 1.1 }], hex(0x5a5448));
  arcPartition(g, R, 33, 0.7, 1, 3.4, [{ t: 0.85, w: 1.0 }], hex(0x4a4640));
  {
    const t = 0.85, a = angAt(R, t);
    desk(g, new Frame(...at(R, 26, t), a), g.F, true);
    cabinet(g, new Frame(...at(R, 21.4, t + 0.05), a), g.F, 1.0, 1.9, hex(0x3a3a38));
    g.zone('Bureau de Robert Sims', ...at(R, 26, t), 3.5);
    lampCeil(g, ...at(R, 26, t), g.F + 3.4, PAL.lamp, 0.8, 6);
    // la salle des reliques : étagères de reliques ensachées et registres
    for (let r = 34.5; r < 39.6; r += 1.3) {
      shelf(g, new Frame(...at(R, r, 0.78), a + Math.PI / 2), g.F, 1.8, 2.3);
      shelf(g, new Frame(...at(R, r, 0.93), a - Math.PI / 2), g.F, 1.8, 2.3);
    }
    table(g, new Frame(...at(R, 36.5, t), a), g.F, 1.0, 1.8, hex(0x5a5448));
    for (let k = 0; k < 4; k++) piece(g, new Frame(...at(R, 36.5, t), a), g.rng.range(-0.3, 0.3), g.rng.range(-0.7, 0.7), 0.25, 0.32, g.F + 0.76, g.F + 0.82, hex(0x3a2418), STYLE.WOOD);
    lampCeil(g, ...at(R, 36.5, t), g.F + 3.4, hex(0xe8f0ff), 0.9, 6);
    g.zone('Salle des reliques', ...at(R, 36.5, t), 3.5);
  }
  // grande salle : bureaux des agents, casiers
  for (let r = 25; r < 32; r += 2.4) for (const t of [0.4, 0.5, 0.6]) {
    desk(g, new Frame(...at(R, r, t), angAt(R, t) + Math.PI), g.F);
    if (g.rng.chance(0.5)) g.idle(...P3(at(R, r + 0.65, t), g.F), face(angAt(R, t) + Math.PI), 8, 'judicial');
  }
  for (let k = 0; k < 6; k++) cabinet(g, new Frame(...at(R, 39.5, 0.35 + k * 0.05), angAt(R, 0.35 + k * 0.05) + Math.PI), g.F, 0.9, 1.9, hex(0x3e4040));
  for (let k = 0; k < 6; k++) lampCeil(g, ...at(R, 26 + (k % 2) * 6, 0.4 + (k >> 1) * 0.1), g.F + 3.4, PAL.tube, k % 2 ? 0.8 : 0, 9);
  g.decal(...P3(at(R, 31.9, 0.55), g.F + 1.7), Math.cos(angAt(R, 0.55) + Math.PI), Math.sin(angAt(R, 0.55) + Math.PI), POSTER.reliques, 0.7, 1.05, { wear: 0.1 });
}

// ---------------------------------------------------------------------------------------------
// Bureau du maire (niveau 2) et répartition des porteurs (niveau 10)
// ---------------------------------------------------------------------------------------------
function maire(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.WOOD, hex(0x5a4030));
  lowCeil(g, R, 3.4);
  // antichambre et secrétariat
  desk(g, new Frame(...at(R, 23.5, 0.3), R.ac + Math.PI), g.F);
  g.idle(...P3(at(R, 24.2, 0.3), g.F), face(R.ac + Math.PI), 8, 'resident');
  for (const t of [0.62, 0.72]) chair(g, new Frame(...at(R, 22.4, t), R.ac), g.F, hex(0x5a3a2a));
  arcPartition(g, R, 27, 0, 1, 3.4, [{ t: 0.5, w: 1.4 }], hex(0x6a5e4c));
  // le bureau
  const t = 0.5, a = R.ac;
  rug(g, new Frame(...at(R, 33, t), a), g.F, 5, 6);
  desk(g, new Frame(...at(R, 35.5, t), a + Math.PI), g.F, true);
  for (const dt of [-0.08, 0.08]) chair(g, new Frame(...at(R, 33.4, t + dt), a), g.F, hex(0x6a3a24));
  // fauteuils de réunion
  for (const dt of [-0.3, -0.22]) chair(g, new Frame(...at(R, 31, t + dt), a + Math.PI / 2), g.F, hex(0x6a3a24));
  table(g, new Frame(...at(R, 31, t - 0.26), a), g.F, 0.9, 0.9, PAL.woodDark, 0.5);
  // collection d'alcools et registres depuis la rébellion
  cabinet(g, new Frame(...at(R, 39.4, t + 0.25), a + Math.PI), g.F, 1.4, 1.1, PAL.woodDark);
  for (let k = 0; k < 7; k++) piece(g, new Frame(...at(R, 39.4, t + 0.25), a + Math.PI), 0.05, -0.6 + k * 0.2, 0.08, 0.08, g.F + 1.1, g.F + 1.1 + g.rng.range(0.22, 0.34), g.pick([hex(0x6a3a14), hex(0x2a4a2a), hex(0x8a7a5a)]), STYLE.GLASS, false, 0.4);
  for (const dt of [-0.3, -0.18]) shelf(g, new Frame(...at(R, 39.5, t + dt), a + Math.PI), g.F, 1.6, 2.4);
  lampCeil(g, ...at(R, 33, t), g.F + 3.4, PAL.lamp, 1.1, 8);
  g.zone('Bureau du maire', ...at(R, 33, t), 5);
  const mayor = g.era === 's3' ? 'resident' : 'elder';
  g.idle(...P3(at(R, 36.2, t), g.F), face(a + Math.PI), 8, mayor);
}

function porteurs(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.DECK, hex(0x4e5250));
  lowCeil(g, R, 3.4);
  hallLights(g, R, 6, PAL.lamp, 3.4, 0.9, 8);
  // guichet de répartition et tableau des niveaux
  counter(g, new Frame(...at(R, R.r0 + 3, 0.5), R.ac), g.F, 4.5);
  for (const dt of [-0.08, 0.0, 0.08]) g.idle(...P3(at(R, R.r0 + 3.8, 0.5 + dt), g.F), face(R.ac + Math.PI), 8, 'elder');
  const [bx, bz] = at(R, R.r0 + 6.2, 0.5);
  piece(g, new Frame(bx, bz, R.ac + Math.PI), 0, 0, 0.1, 5, g.F + 1.2, g.F + 3.0, hex(0x1e2220), STYLE.SOLID, true, 0, 2);
  for (let i = 0; i < 24; i++) {
    const fr = new Frame(bx, bz, R.ac + Math.PI);
    const [x, z] = fr.at(-0.06, -2.2 + (i % 8) * 0.62);
    g.text(`${1 + i * 6}`, x, g.F + 2.7 - Math.floor(i / 8) * 0.5, z, -Math.cos(R.ac), -Math.sin(R.ac), 0.14, { tint: hex(0xe0d8c0) });
  }
  g.sign('RÉPARTITION DES PORTEURS', ...P3(at(R, R.r0 + 6.1, 0.5), g.F + 3.15), -Math.cos(R.ac), -Math.sin(R.ac), 0.2, 'cream');
  // casiers, charges en attente, porteurs
  for (let k = 0; k < 14; k++) crate(g, new Frame(...at(R, g.rng.range(R.r0 + 8, R.r1 - 2), g.rng.range(0.1, 0.9)), g.rng.range(0, TAU)), g.F, g.rng.range(0.45, 0.8));
  for (let k = 0; k < 6; k++) g.idle(...P3(at(R, g.rng.range(R.r0 + 7, R.r1 - 3), g.rng.range(0.15, 0.85)), g.F), g.rng.range(0, TAU), g.rng.chance(0.6) ? 2 : 0, 'porter');
  g.decal(...P3(at(R, R.r0 + 0.1, 0.2), g.F + 1.8), Math.cos(R.ac), Math.sin(R.ac), POSTER.porteurs, 0.7, 1.05, { wear: 0.3 });
}

// ---------------------------------------------------------------------------------------------
// Santé : hôpital des Mids (pouponnière, soins de longue durée, morgue), centre médical
// ---------------------------------------------------------------------------------------------
function wardBeds(g: Gen, R: Room, r: number, t0: number, t1: number, n: number, kind: 'lit' | 'berceau') {
  for (let i = 0; i < n; i++) {
    const t = t0 + ((i + 0.5) / n) * (t1 - t0);
    const a = angAt(R, t);
    const fr = new Frame(...at(R, r, t), a);
    if (kind === 'lit') {
      piece(g, fr, 0, 0, 2.0, 0.9, g.F, g.F + 0.55, hex(0xc8ccc8), STYLE.BRASS, true);
      piece(g, fr, 0, 0, 1.9, 0.85, g.F + 0.55, g.F + 0.68, hex(0xe8e8e0), STYLE.CLOTH);
      piece(g, fr, -1.0, 0, 0.06, 0.9, g.F, g.F + 1.1, hex(0x9aa0a0), STYLE.BRASS);
      if (g.rng.chance(0.5)) g.idle(...P3(fr.at(0, 0), g.F + 0.15), face(a), 9, g.rng.chance(0.5) ? 'elder' : 'resident');
    } else {
      piece(g, fr, 0, 0, 0.8, 0.5, g.F, g.F + 0.8, hex(0xe0dcd0), STYLE.WOOD, true);
      piece(g, fr, 0, 0, 0.7, 0.42, g.F + 0.8, g.F + 0.9, hex(0xf0e8d8), STYLE.CLOTH);
    }
  }
}

function hopital(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x7a7e78));
  lowCeil(g, R, 3.2);
  counter(g, new Frame(...at(R, 23.2, 0.5), R.ac), g.F, 3.4, hex(0xd8d8d0), hex(0x6a7070));
  g.idle(...P3(at(R, 24, 0.5), g.F), face(R.ac + Math.PI), 10, 'medic');
  g.sign('HÔPITAL DES MIDS', ...P3(at(R, 21.05, 0.5), g.F + 2.7), Math.cos(R.ac), Math.sin(R.ac), 0.22, 'white');
  // pouponnière (gauche) : berceaux, couveuses, terminal
  arcPartition(g, R, 27, 0, 0.36, HALL_H, [{ t: 0.3, w: 1.2 }], hex(0x8a9a94));
  radialPartition(g, R, 0.36, 20.8, R_OUT, HALL_H, [{ r: 30, w: 1.2 }], hex(0x8a9a94));
  wardBeds(g, R, 31, 0.04, 0.32, 7, 'berceau');
  wardBeds(g, R, 35, 0.04, 0.32, 7, 'berceau');
  desk(g, new Frame(...at(R, 38.5, 0.18), angAt(R, 0.18) + Math.PI), g.F, true);
  g.idle(...P3(at(R, 33, 0.2), g.F), face(angAt(R, 0.2)), 10, 'medic');
  g.zone('Pouponnière', ...at(R, 33, 0.18), 5);
  for (let k = 0; k < 3; k++) lampCeil(g, ...at(R, 30 + k * 3.5, 0.18), g.F + 3.2, hex(0xfff0e0), 0.8, 7);
  // salles communes de soins (droite)
  radialPartition(g, R, 0.64, 20.8, R_OUT, HALL_H, [{ r: 30, w: 1.2 }], hex(0x8a9a94));
  wardBeds(g, R, 30, 0.68, 0.96, 6, 'lit');
  wardBeds(g, R, 36, 0.68, 0.96, 6, 'lit');
  for (let k = 0; k < 3; k++) lampCeil(g, ...at(R, 28 + k * 4, 0.82), g.F + 3.2, PAL.tube, 0.8, 7);
  g.zone('Salle commune', ...at(R, 33, 0.82), 5);
  // morgue (au fond, centre)
  arcPartition(g, R, 34, 0.36, 0.64, HALL_H, [{ t: 0.5, w: 1.2 }], hex(0x6a7a74));
  const [mx, mz] = at(R, 37, 0.5);
  piece(g, new Frame(mx, mz, R.ac), 0, 0, 2.0, 0.8, g.F, g.F + 0.9, hex(0xb8bcbc), STYLE.BRASS, true);
  for (let k = 0; k < 6; k++) piece(g, new Frame(...at(R, 39.7, 0.4 + k * 0.04), R.ac + Math.PI), 0, 0, 0.1, 0.7, g.F + 0.4 + (k % 2) * 0.8, g.F + 1.1 + (k % 2) * 0.8, hex(0xa8acac), STYLE.BRASS);
  lampCeil(g, mx, mz, g.F + 3.2, hex(0xd8f0ff), 0.8, 6);
  g.zone('Morgue', mx, mz, 3);
  for (let k = 0; k < 4; k++) lampCeil(g, ...at(R, 23 + k * 2.5, 0.5), g.F + 3.2, PAL.tube, k % 2 ? 0.8 : 0, 8);
  // couloir
  g.path([[...at(R, 22.5, 0.2)].reduce((p, v, i) => (i === 0 ? [v, g.F] : [...p, v]), [] as number[]) as [number, number, number], [...at(R, 22.5, 0.8)].reduce((p, v, i) => (i === 0 ? [v, g.F] : [...p, v]), [] as number[]) as [number, number, number]], false, 3, ['medic', 'resident', 'elder'], 6);
}

/** Soins de longue durée : chambres individuelles (lit, fauteuil, miroir) dont celle de Gloria. */
function soins(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x7a7e78));
  lowCeil(g, R, 3.0);
  const n = 5;
  for (let i = 0; i <= n; i++) radialPartition(g, R, i / n, 29, R_OUT, 3.0, [], hex(0x8a948e));
  arcPartition(g, R, 29, 0, 1, 3.0, Array.from({ length: n }, (_, i) => ({ t: (i + 0.5) / n, w: 1.1 })), hex(0x8a948e));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, a = angAt(R, t);
    bed(g, new Frame(...at(R, 38.3, t), a + Math.PI / 2), g.F, false, hex(0x9aa0a8));
    chair(g, new Frame(...at(R, 34, t + 0.05), a), g.F, hex(0x6a6a60));
    piece(g, new Frame(...at(R, 36, t - 0.08), a - Math.PI / 2), 0, 0, 0.03, 0.6, g.F + 1.2, g.F + 1.9, hex(0xa8c0c8), STYLE.BRASS);   // miroir (caméra)
    lampCeil(g, ...at(R, 35, t), g.F + 3.0, PAL.lamp, 0.7, 5);
    if (i === 2) { g.idle(...P3(at(R, 34, t + 0.05), g.F), face(a + Math.PI), 1, 'elder'); g.zone('Chambre de Gloria Hildebrandt', ...at(R, 35, t), 3); }
  }
  counter(g, new Frame(...at(R, 24, 0.5), R.ac), g.F, 2.6, hex(0xd8d8d0), hex(0x6a7070));
  g.idle(...P3(at(R, 24.8, 0.5), g.F), face(R.ac + Math.PI), 8, 'medic');
}

function clinique(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.TILE, hex(0x7a7e78));
  lowCeil(g, R, 3.2);
  counter(g, new Frame(...at(R, 23.2, 0.5), R.ac), g.F, 3.0, hex(0xd8d8d0), hex(0x6a7070));
  g.idle(...P3(at(R, 24, 0.5), g.F), face(R.ac + Math.PI), 10, 'medic');
  for (const t of [0.12, 0.25, 0.75, 0.88]) for (const r of [30, 34]) chair(g, new Frame(...at(R, r, t), angAt(R, t)), g.F, hex(0x5a6a6a));
  arcPartition(g, R, 32, 0.35, 0.65, HALL_H, [{ t: 0.5, w: 1.2 }], hex(0x8a9a94));
  wardBeds(g, R, 36, 0.38, 0.62, 4, 'lit');
  for (let k = 0; k < 6; k++) lampCeil(g, ...at(R, 25 + (k % 2) * 8, 0.2 + (k >> 1) * 0.3), g.F + 3.2, PAL.tube, k % 2 ? 0.8 : 0, 8);
  g.zone('Cabinet du docteur Nichols', ...at(R, 36, 0.5), 4);
  g.idle(...P3(at(R, 35, 0.45), g.F), face(R.ac), 10, 'medic');
}

// ---------------------------------------------------------------------------------------------
// École, auberge, bar, salle des observateurs
// ---------------------------------------------------------------------------------------------
function ecole(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.WOOD, hex(0x6a5a44));
  lowCeil(g, R, 3.2);
  const n = 3;
  for (let i = 1; i < n; i++) radialPartition(g, R, i / n, 24, R_OUT, 3.2, [], hex(0x7a8a70));
  arcPartition(g, R, 24, 0, 1, 3.2, Array.from({ length: n }, (_, i) => ({ t: (i + 0.5) / n, w: 1.2 })), hex(0x7a8a70));
  for (let i = 0; i < n; i++) {
    const t = (i + 0.5) / n, a = angAt(R, t);
    // tableau noir au fond
    const [bx, bz] = at(R, 39.6, t);
    piece(g, new Frame(bx, bz, a + Math.PI), 0, 0, 0.06, 3.2, g.F + 0.9, g.F + 2.2, hex(0x1e2a24), STYLE.SOLID, false, 0, 2);
    g.text(['LE PACTE · ARTICLE 1', 'CALCUL · 144 NIVEAUX', 'HISTOIRE DU SILO'][i % 3], ...P3(g.pick([at(R, 39.5, t)]), g.F + 1.9), -Math.cos(a), -Math.sin(a), 0.12, { tint: hex(0xd8d8d0) });
    desk(g, new Frame(...at(R, 37.5, t), a), g.F, false);
    g.idle(...P3(at(R, 38.2, t), g.F), face(a + Math.PI), 11, 'resident');
    for (let r = 27; r < 36; r += 1.7) for (const dt of [-0.07, 0, 0.07]) {
      const tt = t + dt * (3 / n);
      const fr = new Frame(...at(R, r, tt), angAt(R, tt));
      table(g, fr, g.F, 0.5, 0.7, hex(0x7a6a4a), 0.62);
      chair(g, new Frame(...fr.at(-0.45, 0), angAt(R, tt)), g.F, hex(0x5a4a34));
      if (g.rng.chance(0.7)) g.idle(...P3(fr.at(-0.45, 0), g.F), face(angAt(R, tt)), 8, 'child');
    }
    for (let k = 0; k < 2; k++) lampCeil(g, ...at(R, 29 + k * 6, t), g.F + 3.2, PAL.tube, 0.8, 8);
  }
  g.zone('École', ...at(R, 30, 0.5), 10);
}

function auberge(g: Gen, R: Room) {
  hallFloor(g, R, STYLE.WOOD, hex(0x5a4430));
  // réfectoire commun (devant), dortoirs (au fond)
  canteenTables(g, R, 23.5, 30, 0.08, 0.72, 0.45);
  arcPartition(g, R, 32, 0, 1, HALL_H, [{ t: 0.2, w: 1.4 }, { t: 0.8, w: 1.4 }], hex(0x7a6a50));
  for (let i = 1; i < 4; i++) radialPartition(g, R, i / 4, 32, R_OUT, HALL_H, [], hex(0x7a6a50));
  for (let i = 0; i < 4; i++) for (const dt of [-0.07, 0.07]) {
    const t = (i + 0.5) / 4 + dt;
    bunk(g, new Frame(...at(R, 36.5, t), angAt(R, t)), g.F);
  }
  // petite scène (pièce du Jour de la Liberté)
  const ts = 0.86, as = angAt(R, ts);
  const [sx, sz] = at(R, 28, ts);
  g.obox(sx, sz, as, 5, 4.5, g.F, g.F + 0.6, { color: PAL.woodDark, style: STYLE.WOOD, seed: 3 });
  for (const s of [-2.4, 2.4]) { const fr = new Frame(sx, sz, as); piece(g, fr, 1.6, s, 0.3, 0.3, g.F + 0.6, g.F + 3.6, hex(0x7a1a14), STYLE.CLOTH, false, 0, 1); }
  for (const k of [0, 1]) g.idle(...P3(new Frame(sx, sz, as).at(0.2, -0.8 + k * 1.6), g.F + 0.6), face(as + Math.PI), k ? 11 : 2, 'resident');
  g.light(sx, g.F + 3.6, sz, hex(0xffd090), 1.2, 9);
  counter(g, new Frame(...at(R, 22.4, 0.9), R.ac), g.F, 2.6);
  hallLights(g, R, 7, PAL.lamp, HALL_H, 0.9, 9);
  g.zone('Réfectoire de l’auberge', ...at(R, 27, 0.4), 8);
  g.zone('Dortoirs de l’auberge', ...at(R, 36, 0.5), 8);
}

function bar(g: Gen, R: Room) {
  const { f, D, hw } = R;
  hallFloor(g, R, STYLE.WOOD, hex(0x4a3424));
  lowCeil(g, R, 2.9);
  counter(g, new Frame(...f.at(D - 1.6, 0), R.ac), g.F, Math.min(4, hw(D - 1.6) * 2 - 1), hex(0x6a4a30), hex(0x3a2a1c));
  shelf(g, new Frame(...f.at(D - 0.3, 0), R.ac + Math.PI), g.F, Math.min(3.5, hw(D) * 2 - 1.2), 2.2, true);
  for (let k = 0; k < 3; k++) {
    const fr = new Frame(...f.at(1.6 + k * 1.3, (k % 2 ? 1 : -1) * 1.0), R.ac);
    table(g, fr, g.F, 0.7, 0.7, hex(0x5a3a24));
    chair(g, new Frame(...fr.at(0, -0.55), R.ac - Math.PI / 2), g.F);
    chair(g, new Frame(...fr.at(0, 0.55), R.ac + Math.PI / 2), g.F);
    if (g.rng.chance(0.7)) g.idle(...P3(fr.at(0, -0.55), g.F), face(R.ac + Math.PI / 2), 1, 'mechanic');
  }
  g.idle(...P3(f.at(D - 0.9, 0), g.F), face(R.ac + Math.PI), 10, 'resident');
  for (const s of [-1, 1]) lampCeil(g, ...f.at(D / 2, s * 1.2), g.F + 2.9, hex(0xffb070), 0.8, 5);
  g.zone('Le bar du 26', ...f.at(D / 2, 0), 3.5);
}

function observateurs(g: Gen, R: Room) {
  const { f, D, hw } = R;
  hallFloor(g, R, STYLE.TILE, hex(0x3a3e3e));
  lowCeil(g, R, 2.9);
  // placard du concierge : balais, seaux… puis cloison et la salle cachée
  const rp = R.r0 + 1.6;
  arcPartition(g, R, rp, 0, 1, 2.9, [{ t: 0.8, w: 0.8 }], hex(0x5a5e5a));
  for (let k = 0; k < 4; k++) piece(g, f, 0.4, -hw(0.4) + 0.3 + k * 0.4, 0.06, 0.06, g.F, g.F + 1.4, hex(0x6a5a3a), STYLE.WOOD);
  piece(g, f, 0.6, 0.4, 0.4, 0.4, g.F, g.F + 0.35, hex(0x5a6a7a), STYLE.BRASS);
  // mur d'écrans des caméras cachées
  const [sx, sz] = f.at(D - 0.2, 0);
  const fr = new Frame(sx, sz, R.ac + Math.PI);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    piece(g, fr, 0, -1.5 + i * 1.0, 0.1, 0.9, g.F + 0.9 + j * 0.62, g.F + 1.45 + j * 0.62, hex(0x141616), STYLE.BRASS);
    piece(g, fr, -0.06, -1.5 + i * 1.0, 0.02, 0.8, g.F + 0.94 + j * 0.62, g.F + 1.41 + j * 0.62, hex(0xffffff), STYLE.SCREEN, false, 2.6, (i + j) % 3 === 0 ? 1 : 0);
  }
  for (const s of [-0.9, 0.9]) {
    const d = D - 1.4;
    table(g, new Frame(...f.at(d, s), R.ac), g.F, 0.8, 1.2, hex(0x3a3e3e));
    crt(g, new Frame(...f.at(d + 0.1, s), R.ac + Math.PI), g.F + 0.76);
    chair(g, new Frame(...f.at(d - 0.7, s), R.ac), g.F, hex(0x2a2c2c));
    g.idle(...P3(f.at(d - 0.7, s), g.F), face(R.ac), 8, 'it');
  }
  g.light(...P3(f.at(D - 1.2, 0), g.F + 2.2), hex(0x9ad8ff), 0.9, 6);
  g.zone('Salle des observateurs', ...f.at(D - 1.5, 0), 3);
}

/** Petits lieux nommés logés dans une unité de façade. */
function petit(kind: string): RoomFn {
  return (g, R) => {
    const { f, D, hw } = R;
    hallFloor(g, R, STYLE.TILE, hex(0x55595a));
    lowCeil(g, R, 2.9);
    lampCeil(g, ...f.at(D / 2, 0), g.F + 2.9, kind === 'relais' ? hex(0xa8c8ff) : PAL.lamp, 1.0, 7);
    switch (kind) {
      case 'recyclage': {
        counter(g, new Frame(...f.at(1.6, 0), R.ac), g.F, Math.min(3, hw(1.6) * 2 - 1));
        for (const s of [-1, 1]) shelf(g, new Frame(...f.at(3.5, s * (hw(3.5) - 0.25)), R.ac - s * Math.PI / 2), g.F, 2.0, 2.2);
        // trappe de la chute d'ordures
        const [cx, cz] = f.at(D - 0.8, 0);
        g.ring(cx, cz, 0.45, 0.65, g.F, g.F + 1.1, { color: hex(0x5a5e5a), style: STYLE.SOLID, extra: 1, seed: 3 });
        g.ring(cx, cz, 0, 0.45, g.F + 1.05, g.F + 1.1, { color: hex(0x2a2a28), style: STYLE.BRASS, solid: false, detail: true });
        g.sign('CHUTE · VIDAGE À L’HEURE', cx - Math.cos(R.ac) * 0.66, g.F + 1.5, cz - Math.sin(R.ac) * 0.66, -Math.cos(R.ac), -Math.sin(R.ac), 0.1, 'yellow');
        for (let k = 0; k < 6; k++) crate(g, new Frame(...f.at(g.rng.range(2.5, D - 1.8), g.rng.range(-1.2, 1.2)), g.rng.range(0, TAU)), g.F, 0.5);
        g.idle(...P3(f.at(2.3, 0), g.F), face(R.ac + Math.PI), 10, 'resident');
        break;
      }
      case 'radio': {
        table(g, new Frame(...f.at(D - 1, 0), R.ac), g.F, 0.8, 1.4, PAL.woodDark);
        piece(g, f, D - 1, 0, 0.35, 0.6, g.F + 0.76, g.F + 1.1, hex(0x3a3a34), STYLE.BRASS);
        piece(g, f, D - 1.18, 0.1, 0.02, 0.1, g.F + 0.9, g.F + 0.96, hex(0xffa040), STYLE.EMISSIVE, false, 2.5, 1);
        chair(g, new Frame(...f.at(D - 1.7, 0), R.ac), g.F);
        break;
      }
      case 'relais': {
        for (const s of [-0.9, 0, 0.9]) {
          piece(g, f, D - 0.6, s, 0.6, 0.7, g.F, g.F + 2.1, hex(0x2c3034), STYLE.SOLID, true, 0, 1);
          for (let k = 0; k < 5; k++) piece(g, f, D - 0.92, s + g.rng.range(-0.25, 0.25), 0.02, 0.05, g.F + 0.4 + k * 0.32, g.F + 0.44 + k * 0.32, g.pick([PAL.green, hex(0xffa040)]), STYLE.EMISSIVE, false, 3, 3);
        }
        break;
      }
      case 'controle': {
        piece(g, f, 0.8, 0, 0.15, hw(0.8) * 2 - 1.8, g.F + 0.9, g.F + 1.0, hex(0xc8a020), STYLE.SOLID, true, 0, 2);
        desk(g, new Frame(...f.at(2.5, 0), R.ac + Math.PI), g.F);
        for (const s of [-0.8, 0.8]) g.idle(...P3(f.at(1.4, s), g.F), face(R.ac + Math.PI), 10, 'judicial');
        break;
      }
      case 'planque': {
        bed(g, new Frame(...f.at(D - 1, 0.5), R.ac + Math.PI / 2), g.F);
        for (let k = 0; k < 10; k++) crate(g, new Frame(...f.at(g.rng.range(0.8, D - 2), g.rng.range(-1.5, 1.5)), g.rng.range(0, TAU)), g.F, g.rng.range(0.3, 0.6));
        table(g, new Frame(...f.at(2.5, -0.8), R.ac), g.F);
        g.idle(...P3(f.at(2.5, 0), g.F), face(R.ac + Math.PI), 2, 'resident');
        break;
      }
      case 'reparation': {
        counter(g, new Frame(...f.at(1.6, 0), R.ac), g.F, Math.min(3, hw(1.6) * 2 - 1));
        workbench(g, new Frame(...f.at(D - 0.5, 0), R.ac + Math.PI), g.F, 2.4);
        for (let k = 0; k < 5; k++) crt(g, new Frame(...f.at(D - 0.6, -1 + k * 0.5), R.ac + Math.PI), g.F + 0.95);
        g.idle(...P3(f.at(2.3, 0), g.F), face(R.ac + Math.PI), 4, 'resident');
        break;
      }
      case 'adjoints': {
        desk(g, new Frame(...f.at(2.2, -0.8), R.ac + Math.PI), g.F);
        cabinet(g, new Frame(...f.at(D - 0.4, 1.0), R.ac + Math.PI), g.F, 1.0, 1.8, hex(0x4a4e4a));
        for (let s = -1.2; s <= 1.21; s += 0.2) { const [x, z] = f.at(D - 2.2, s); g.box(x - 0.03, g.F, z - 0.03, x + 0.03, g.F + 2.4, z + 0.03, { color: hex(0x2a2c2e), style: STYLE.BRASS }); }
        g.idle(...P3(f.at(2.9, -0.8), g.F), face(R.ac + Math.PI), 8, 'deputy');
        break;
      }
      default:
        workbench(g, new Frame(...f.at(D - 0.5, 0), R.ac + Math.PI), g.F, 2.2);
    }
  };
}

// ---------------------------------------------------------------------------------------------
// Le Parc (niveau 40) : pelouses, arbres, allées, tables de pique-nique, lampes de jour
// ---------------------------------------------------------------------------------------------
function tree(g: Gen, x: number, z: number, y: number, h: number, crown: number, dead = false) {
  g.ring(x, z, 0, 0.22 + h * 0.02, y, y + h * 0.6, { color: hex(0x4a3424), style: STYLE.WOOD, seed: 3, detail: !!g.detailOk && false });
  if (dead) return;
  const layers = 5;
  for (let i = 0; i < layers; i++) {
    const u = (i + 0.5) / layers;
    const rr = crown * Math.sin(Math.PI * (0.25 + u * 0.75)) + 0.2;
    const yy = y + h * 0.45 + i * (h * 0.55) / layers;
    g.ring(x + g.rng.range(-0.2, 0.2), z + g.rng.range(-0.2, 0.2), 0, rr, yy, yy + (h * 0.55) / layers + 0.05, { color: g.pick([hex(0x3e6a2e), hex(0x4a7a34), hex(0x365a28)]), style: STYLE.FOLIAGE, seed: g.S(), solid: false });
  }
}

function parc(g: Gen, R: Room) {
  const { u } = R;
  const shell = g.o.lod > 0;
  // pelouse et allées
  g.sector(R.r0 + 0.1, R.r1 - 0.1, u.a0 + 0.1 / R.r0, u.a1 - u.a0 - 0.2 / R.r0, g.F, g.F + 0.12, { color: hex(0x4a6a32), style: STYLE.FOLIAGE, seed: 5, solid: false, sides: false, bottom: false });
  if (!shell) {
    g.sector(29, 31, u.a0, u.a1 - u.a0, g.F + 0.12, g.F + 0.14, { color: hex(0x8a8070), style: STYLE.TILE, seed: 6, solid: false, sides: false, bottom: false });
    for (let k = 0; k < 6; k++) { const a = u.a0 + ((k + 0.5) / 6) * (u.a1 - u.a0); const [x, z] = polar(25.5, a); g.obox(x, z, a, 9, 1.8, g.F + 0.12, g.F + 0.14, { color: hex(0x8a8070), style: STYLE.TILE, seed: 7, solid: false }); }
  }
  // arbres
  const nTrees = shell ? 18 : 42;
  for (let k = 0; k < nTrees; k++) {
    const a = u.a0 + g.rng.range(0.03, 0.97) * (u.a1 - u.a0);
    const r = g.rng.chance(0.5) ? g.rng.range(22.5, 27.5) : g.rng.range(32.5, 38.5);
    const [x, z] = polar(r, a);
    tree(g, x, z, g.F + 0.12, g.rng.range(3.6, 4.9), g.rng.range(1.2, 2.1));
  }
  // lampes de jour au plafond (grands panneaux chauds)
  for (let r = 24; r < 39; r += 5) {
    const n = Math.round(((u.a1 - u.a0) * r) / 7);
    for (let i = 0; i < n; i++) {
      const a = u.a0 + ((i + 0.5) / n) * (u.a1 - u.a0);
      g.sector(r - 0.8, r + 0.8, a - 1.2 / r, 2.4 / r, g.F + HALL_H - 0.12, g.F + HALL_H, { color: hex(0xfff2d8), style: STYLE.GRILLE, emis: 2.6, seed: g.S(), solid: false });
      if (!shell && i % 2 === 0) { const [x, z] = polar(r, a); g.light(x, g.F + HALL_H - 0.6, z, hex(0xfff2d8), 1.1, 13); }
    }
  }
  if (shell) return;
  // tables de pique-nique et bancs, promeneurs
  for (let k = 0; k < 16; k++) {
    const a = u.a0 + ((k + 0.5) / 16) * (u.a1 - u.a0);
    const fr = new Frame(...polar(30, a), a + Math.PI / 2);
    if (k % 2) {
      table(g, fr, g.F + 0.12, 0.9, 1.8, hex(0x6a5034));
      for (const s of [-0.75, 0.75]) piece(g, fr, s, 0, 0.35, 1.8, g.F + 0.12, g.F + 0.55, hex(0x6a5034), STYLE.WOOD, true);
      if (g.rng.chance(0.6)) g.idle(...P3(fr.at(-0.75, 0.3), g.F + 0.12 + 0.25), face(a + Math.PI / 2 + Math.PI), 1);
      if (g.rng.chance(0.5)) g.idle(...P3(fr.at(0.75, -0.3), g.F + 0.12 + 0.25), face(a + Math.PI / 2), 1);
    } else {
      piece(g, fr, 0, 0, 0.45, 1.6, g.F + 0.12, g.F + 0.55, hex(0x5a4a34), STYLE.WOOD, true);
      if (g.rng.chance(0.4)) g.idle(...P3(fr.at(0, 0), g.F + 0.12 + 0.25), face(a), 1, 'elder');
    }
  }
  const loop: [number, number, number][] = [];
  for (let i = 0; i <= 60; i++) { const [x, z] = polar(30, u.a0 + (i / 60) * (u.a1 - u.a0)); loop.push([x, g.F + 0.14, z]); }
  g.path(loop, false, 12, ['resident', 'child', 'child', 'elder'], 8);
  for (let k = 0; k < 6; k++) { const [x, z] = polar(g.rng.range(23, 27), u.a0 + g.rng.range(0.1, 0.9) * (u.a1 - u.a0)); g.idle(x, g.F + 0.12, z, g.rng.range(0, TAU), 7, 'child'); }
  g.zone('Le Parc', ...polar(30, (u.a0 + u.a1) / 2), 30);
}

export const civicRooms: Record<string, RoomFn> = {
  it: (g, R) => it(g, R),
  combinaisons: (g, R) => combinaisons(g, R),
  judiciaire: (g, R) => judiciaire(g, R),
  maire: (g, R) => maire(g, R),
  porteurs: (g, R) => porteurs(g, R),
  hopital: (g, R) => hopital(g, R),
  soins: (g, R) => soins(g, R),
  clinique: (g, R) => clinique(g, R),
  ecole: (g, R) => ecole(g, R),
  auberge: (g, R) => auberge(g, R),
  bar: (g, R) => bar(g, R),
  observateurs: (g, R) => observateurs(g, R),
  parc: (g, R) => parc(g, R),
  recyclage: petit('recyclage'),
  radio: petit('radio'),
  relais: petit('relais'),
  controle: petit('controle'),
  planque: petit('planque'),
  reparation: petit('reparation'),
  adjoints: petit('adjoints'),
};

void LH; void SLAB; void deg;
