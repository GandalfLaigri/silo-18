// Saison 3 : « la Brèche ». La bombe de la rébellion a arraché le haut de la volée entre les niveaux
// 87 et 88 ; une passerelle d'échafaudage et un palan provisoire (interdit par le Pacte) permettent de passer.
import { LAND_HALF, PAL, R_CORE, R_STEP, STYLE, hex, landingAngle } from '../config';
import { Gen, polar } from './common';
import { crate } from './furniture';
import { Frame } from './furniture';
import { GAP_KEEP, stepA1, stepArc, stepTop } from './atrium';


export function gap(g: Gen) {
  const F = g.F;
  const phi = landingAngle(g.n);
  const aStart = phi - LAND_HALF;
  const aEnd = stepA1(phi, GAP_KEEP) + 0.02;
  const aLift = aEnd - 0.22;
  // passerelle d'échafaudage de niveau avec le palier, jusqu'au palan
  g.sector(R_CORE + 0.3, R_STEP - 0.3, aLift, aStart - aLift, F - 0.12, F, { color: hex(0x6a5a40), style: STYLE.WOOD, seed: 3 });
  for (const r of [R_CORE + 0.35, R_STEP - 0.35]) g.sector(r - 0.04, r + 0.04, aLift, aStart - aLift, F + 0.95, F + 1.02, { color: hex(0xb89020), style: STYLE.BRASS, seed: 4, detail: true, solid: false });
  g.sector(R_STEP - 0.42, R_STEP - 0.3, aLift, aStart - aLift, F, F + 1.0, { color: hex(0x3a3c3a), style: STYLE.GRATE, seed: 5, solid: true });
  // montants d'échafaudage jusqu'à la volée du dessous
  for (let a = aLift; a < aStart; a += 0.18) for (const r of [R_CORE + 0.4, R_STEP - 0.4]) {
    const [x, z] = polar(r, a);
    g.box(x - 0.05, F - 12, z - 0.05, x + 0.05, F + 1.0, z + 0.05, { color: hex(0x6a6e70), style: STYLE.BRASS, detail: true, solid: false });
  }
  // palan : plateforme mobile entre la passerelle et la première marche conservée
  const aP = aLift - 0.12;
  const [px, pz] = polar((R_CORE + R_STEP) / 2, aP);
  const kP = Math.min(29, GAP_KEEP + Math.round((stepA1(phi, GAP_KEEP) - aP) / stepArc));
  // la plateforme (2 m) couvre plusieurs marches : elle s'arrête sur la plus haute, sans les traverser
  const kTop = Math.max(GAP_KEEP, kP - Math.ceil(1.0 / ((R_CORE + R_STEP) / 2) / stepArc));
  g.movers.push({ kind: 'pulley', x: px, z: pz, y0: stepTop(F, kTop), y1: F, w: 2.0 });
  // poutre et poulie au-dessus
  g.box(px - 0.2, F + 4.6, pz - 1.4, px + 0.2, F + 5.0, pz + 1.4, { color: hex(0x7a6a24), style: STYLE.SOLID, extra: 1, seed: 6 });
  g.box(px - 0.3, F + 4.1, pz - 0.3, px + 0.3, F + 4.6, pz + 0.3, { color: hex(0x3a3a38), style: STYLE.BRASS, seed: 7, solid: false });
  // bords arrachés, gravats, bâches
  for (let k = 0; k < 18; k++) {
    const a = aLift - g.rng.range(0, stepArc * 4);
    const [x, z] = polar(g.rng.range(R_CORE + 0.3, R_STEP), a);
    g.box(x - 0.25, stepTop(F, GAP_KEEP) - 0.2, z - 0.25, x + 0.25, stepTop(F, GAP_KEEP) + g.rng.range(0.05, 0.4), z + 0.25, { color: hex(0x5a5c58), style: STYLE.ROCK, seed: g.S() });
  }
  for (let k = 0; k < 5; k++) crate(g, new Frame(...polar(g.rng.range(4, 7.5), phi + g.rng.range(-0.3, 0.3)), g.rng.range(0, 6)), F, 0.6, hex(0x5a4a34));
  // signalisation et lumière de chantier
  const [sx, sz] = polar(R_CORE + 0.02, aStart - 0.3);
  g.text('LA BRÈCHE · TRAVAUX', sx, F + 1.8, sz, Math.cos(aStart - 0.3), Math.sin(aStart - 0.3), 0.2, { plate: 'yellow', tint: hex(0x1a1612) });
  g.text('PALAN PROVISOIRE', sx, F + 1.4, sz, Math.cos(aStart - 0.3), Math.sin(aStart - 0.3), 0.14, { plate: 'dark', tint: hex(0xe8d8b0) });
  for (let k = 0; k < 3; k++) {
    const [x, z] = polar(R_STEP - 0.4, aLift + k * 0.3);
    g.box(x - 0.1, F + 1.0, z - 0.1, x + 0.1, F + 1.25, z + 0.1, { color: PAL.sodium, style: STYLE.EMISSIVE, emis: 3, extra: 1, seed: g.S(), detail: true, solid: false });
    g.light(x, F + 1.6, z, PAL.sodium, 1.0, 8);
  }
  for (let k = 0; k < 3; k++) { const [x, z] = polar(4.5, aLift + 0.2 + k * 0.25); g.idle(x, F, z, g.rng.range(0, 6), k === 1 ? 4 : 2, 'mechanic'); }
  g.zone('La Brèche', ...polar(4.5, (aLift + aStart) / 2), 5, F - 6, F + 4);
  g.dest('La Brèche (saison 3)', ...polar(7.2, phi).reduce((p, v, i) => (i === 0 ? [v, F] : [...p, v]), [] as number[]) as [number, number, number], Math.atan2(-Math.cos(phi), -Math.sin(phi)) + Math.PI);
  void stepArc;
}
