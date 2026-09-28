// Intérieur d'un niveau : murs du couloir circulaire, cloisons rayonnantes, faux plafonds,
// sols, éclairage, mobilier des logements, boutiques, ateliers et bureaux.
import { LH, PAL, SLAB, STYLE, hex, type RGB } from '../config';
import type { LevelInfo } from '../world/levels';
import { normAngle, orect, ring, subtract, union } from '../world/voxel2d';
import { Gen, TAU, polar, yawTo } from './common';
import { Frame, bed, bunk, cabinet, chair, counter, crate, crt, desk, kitchen, lampCeil, piece, plant, rug, shelf, table, workbench } from './furniture';
import { RA0, RA1, RB0, RB1, RC0, RC1, ROOM_CEIL, WALL, type Plan, type Unit } from './plan';

const WALLC = (g: Gen): { color: RGB; style: number; extra: number; seed: number } => ({ color: g.pick(PAL.paint), style: STYLE.PANEL, extra: 0, seed: g.S() });

export function unitRadii(u: Unit): [number, number] {
  return u.zone === 'A' ? [RA0, RA1] : u.zone === 'B' ? [RB0, RB1] : [RA0, RB1];
}

/** Murs percés d'ouvertures : secteurs pleins entre les coupures (angles absolus). */
function arcWall(g: Gen, r0: number, r1: number, a0: number, a1: number, y0: number, y1: number, cuts: [number, number][], o: Parameters<Gen['sector']>[6]) {
  const cs = cuts.map(([c0, c1]) => {
    const s = a0 + normAngle(c0 - a0);
    return [s, s + (c1 - c0)] as [number, number];
  }).filter(([c0]) => c0 < a1).sort((p, q) => p[0] - q[0]);
  let cur = a0;
  for (const [c0, c1] of cs) {
    if (c0 > cur + 1e-4) g.sector(r0, r1, cur, c0 - cur, y0, y1, o);
    cur = Math.max(cur, c1);
  }
  if (a1 > cur + 1e-4) g.sector(r0, r1, cur, a1 - cur, y0, y1, o);
}

export function interior(g: Gen, info: LevelInfo, plan: Plan) {
  const { F } = g;
  const top = F + LH - SLAB;
  const wallO = { color: hex(0x74766e), style: STYLE.PANEL, extra: 0, seed: 71 };
  const corrCol = g.pick([hex(0x7a7c70), hex(0x6e7a74), hex(0x7c7466), hex(0x70767a)]);

  // ---- couloir circulaire ------------------------------------------------------------
  const passCuts = plan.units.filter((u) => u.kind === 'passage').map((u) => [u.a0 + 0.12 / RA1, u.a1 - 0.12 / RA1] as [number, number]);
  const bDoors = plan.units.filter((u) => u.zone === 'B' && u.door !== null).map((u) => [u.door! - 0.55 / RC1, u.door! + 0.55 / RC1] as [number, number]);
  for (const [c0, c1] of plan.corridor) {
    // mur avant (zone A | couloir) : ouvert aux passages sur 3 m de haut
    arcWall(g, RA1, RC0, c0, c1, F, F + 3.0, passCuts, { ...wallO, color: corrCol });
    g.sector(RA1, RC0, c0, c1 - c0, F + 3.0, top, { ...wallO, color: corrCol });
    // mur arrière (couloir | zone B) : portes des logements
    arcWall(g, RC1, RB0, c0, c1, F, F + 2.2, bDoors, { ...wallO, color: corrCol });
    g.sector(RC1, RB0, c0, c1 - c0, F + 2.2, top, { ...wallO, color: corrCol });
    // plafond, sol, éclairage
    g.sector(RC0 - 0.01, RC1 + 0.01, c0, c1 - c0, F + ROOM_CEIL, F + ROOM_CEIL + 0.12, { color: hex(0x8a8a82), style: STYLE.SOLID, extra: 2, seed: 72, solid: false });
    g.sector(RC0, RC1, c0, c1 - c0, F, F + 0.02, { color: hex(0x4e5250), style: STYLE.TILE, seed: 73, solid: false, bottom: false, sides: false });
    const len = (c1 - c0) * ((RC0 + RC1) / 2);
    const nL = Math.max(1, Math.round(len / 7));
    for (let k = 0; k < nL; k++) {
      const a = c0 + ((k + 0.5) / nL) * (c1 - c0);
      const [x, z] = polar((RC0 + RC1) / 2, a);
      lampCeil(g, x, z, F + ROOM_CEIL, g.rng.chance(0.3) ? PAL.tube : PAL.lamp, k % 2 === 0 ? 0.9 : 0, 7, g.rng.chance(0.06));
    }
    // passants
    const pts: [number, number, number][] = [];
    const m = Math.max(2, Math.ceil(len / 3));
    for (let k = 0; k <= m; k++) { const [x, z] = polar((RC0 + RC1) / 2, c0 + 0.1 + ((c1 - c0 - 0.2) * k) / m); pts.push([x, F, z]); }
    g.path(pts, false, Math.max(1, Math.round(len / 25)), undefined, 10);
  }

  // ---- cloisons rayonnantes ---------------------------------------------------------------
  const seen = new Set<string>();
  const radial = (a: number, r0: number, r1: number) => {
    const key = `${normAngle(a).toFixed(4)}:${r0}:${r1}`;
    if (seen.has(key)) return;
    seen.add(key);
    const [x, z] = polar((r0 + r1) / 2, a);
    g.shape(orect(x, z, a, (r1 - r0) / 2, WALL / 2), F, top, { ...WALLC(g), res: 0.1 });
  };
  for (const u of plan.units) {
    const [r0, r1] = unitRadii(u);
    radial(u.a0, r0, r1);
    radial(u.a1, r0, r1);
  }

  // ---- unités -----------------------------------------------------------------------------------
  for (const u of plan.units) {
    const [r0, r1] = unitRadii(u);
    const ceil = u.kind === 'passage' ? 3.0 : u.zone === 'AB' ? LH - SLAB : ROOM_CEIL;
    if (u.zone !== 'AB') {
      g.sector(r0, r1, u.a0, u.a1 - u.a0, F + ceil, F + ceil + 0.12, { color: hex(0x8c8c84), style: STYLE.SOLID, extra: 2, seed: 74, solid: false });
    }
    if (u.kind === 'passage') {
      const [x, z] = polar((r0 + r1) / 2, (u.a0 + u.a1) / 2);
      lampCeil(g, x, z, F + 3.0, PAL.lamp, 0.8, 7);
      g.sector(r0, r1, u.a0, u.a1 - u.a0, F, F + 0.02, { color: hex(0x55595a), style: STYLE.TILE, seed: 75, solid: false, bottom: false, sides: false });
      continue;
    }
    if (!u.open || u.kind === 'service') continue;
    if (u.zone === 'AB' || u.sub) continue; // grandes salles : voir special.ts
    furnish(g, info, u, r0, r1);
  }
}

// -----------------------------------------------------------------------------------------------
// Mobilier des unités courantes
// -----------------------------------------------------------------------------------------------
export interface Room { u: Unit; r0: number; r1: number; ac: number; f: Frame; D: number; hw: (d: number) => number; sd: number; y: number }

export function room(g: Gen, u: Unit, r0: number, r1: number): Room {
  const ac = (u.a0 + u.a1) / 2;
  const [x, z] = polar(r0, ac);
  const f = new Frame(x, z, ac);
  const D = r1 - r0;
  const hw = (d: number) => ((u.a1 - u.a0) * (r0 + d)) / 2 - 0.25;
  const sd = u.door !== null ? (normAngle(u.door - ac + Math.PI) - Math.PI) * r0 : 0;
  return { u, r0, r1, ac, f, D, hw, sd, y: g.F };
}

/** Sol de l'unité (finition) et plafonnier. */
function floorAndLight(g: Gen, R: Room, style: number, color: RGB, lamp: RGB = PAL.lamp, k = 1.0) {
  const { u, r0, r1 } = R;
  g.sector(r0 + 0.05, r1 - 0.05, u.a0 + 0.1 / r0, u.a1 - u.a0 - 0.2 / r0, g.F, g.F + 0.025, { color, style, seed: g.S(), solid: false, bottom: false, sides: false, detail: true });
  const [x, z] = R.f.at(R.D / 2, 0);
  lampCeil(g, x, z, g.F + (u.zone === 'AB' ? LH - SLAB : ROOM_CEIL), lamp, k, Math.max(6, R.D * 1.1), g.rng.chance(0.05));
}

function furnish(g: Gen, info: LevelInfo, u: Unit, r0: number, r1: number) {
  const R = room(g, u, r0, r1);
  switch (u.kind) {
    case 'appart': return u.zone === 'B' ? apartmentB(g, info, R) : apartmentA(g, info, R);
    case 'boutique': return shop(g, R);
    case 'atelier': return atelier(g, R);
    case 'bureau': return office(g, R);
  }
}

const side = (sd: number) => (sd >= 0 ? 1 : -1);

function residents(g: Gen, info: LevelInfo, R: Room, spots: { d: number; s: number; pose: number; face: number }[]) {
  const z = info.zone;
  const kinds = z === 'bas' ? (['mechanic', 'resident', 'child'] as const) : z === 'haut' ? (['resident', 'resident', 'it', 'child', 'elder'] as const) : (['resident', 'resident', 'child', 'elder', 'farmer'] as const);
  for (const p of spots) {
    if (!g.rng.chance(0.6)) continue;
    const [x, zz] = R.f.at(p.d, p.s);
    const yaw = R.ac + p.face;
    g.idle(x, g.F, zz, yawTo(Math.cos(yaw), Math.sin(yaw)), p.pose, p.pose === 9 ? 'resident' : g.rng.pick(kinds));
  }
}

function apartmentA(g: Gen, info: LevelInfo, R: Room) {
  const { f, D, hw, sd } = R;
  const y = g.F;
  const sgn = side(sd);
  floorAndLight(g, R, g.rng.chance(0.5) ? STYLE.WOOD : STYLE.TILE, g.pick([hex(0x6a5038), hex(0x5a5448), hex(0x7a6a50), hex(0x505a58)]));
  // lit au fond, côté opposé à la porte (axe tangentiel)
  const bs = -sgn * Math.max(0, hw(D - 0.8) - 1.1);
  bed(g, new Frame(...f.at(D - 0.85, bs), R.ac + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2)), y, hw(D) > 3.2 && g.rng.chance(0.6));
  // armoire dans l'autre coin du fond
  cabinet(g, new Frame(...f.at(D - 0.4, sgn * (hw(D - 0.4) - 0.65)), R.ac + Math.PI), y, 1.0, 1.9);
  // coin cuisine le long de la cloison côté porte
  kitchen(g, new Frame(...f.at(2.3, sgn * (hw(2.3) - 0.35)), R.ac - sgn * Math.PI / 2), y, 1.8);
  // table et chaises
  const td = D * 0.5, ts = -sgn * 0.3;
  rug(g, new Frame(...f.at(td, ts), R.ac), y, 2.0, 2.4);
  table(g, new Frame(...f.at(td, ts), R.ac), y);
  chair(g, new Frame(...f.at(td, ts - 0.7), R.ac - Math.PI / 2), y);
  chair(g, new Frame(...f.at(td, ts + 0.7), R.ac + Math.PI / 2), y);
  // étagère près de l'entrée, plante, miroir
  shelf(g, new Frame(...f.at(0.6, -sgn * (hw(0.6) - 0.25)), R.ac + sgn * Math.PI / 2), y, 1.0, 1.6);
  if (g.rng.chance(0.5)) plant(g, new Frame(...f.at(1.4, -sgn * (hw(1.4) - 0.3)), R.ac), y);
  piece(g, f, D - 1.6, sgn * (hw(D - 1.6) - 0.03), 0.6, 0.03, y + 1.2, y + 1.9, hex(0x9ab0b8), STYLE.BRASS);
  residents(g, info, R, [
    { d: td, s: ts - 0.7, pose: 1, face: -Math.PI / 2 + 0.2 },
    { d: D - 0.85, s: bs, pose: 9, face: 0 },
    { d: 1.6, s: 0.2, pose: g.rng.chance(0.5) ? 0 : 10, face: 0.3 },
  ]);
}

function apartmentB(g: Gen, info: LevelInfo, R: Room) {
  const { f, D, hw, sd, u } = R;
  const y = g.F;
  const sgn = side(sd);
  floorAndLight(g, R, g.rng.chance(0.5) ? STYLE.WOOD : STYLE.TILE, g.pick([hex(0x6a5038), hex(0x5a5448), hex(0x7a6a50), hex(0x505a58)]));
  // cloison entre séjour et chambre, percée d'une porte
  const rp = R.r0 + 5.2;
  const doorA = R.ac - sgn * 0.8 / rp;
  arcWall(g, rp - 0.08, rp + 0.08, u.a0, u.a1, y, y + 2.2, [[doorA - 0.5 / rp, doorA + 0.5 / rp]], { color: g.pick(PAL.paint), style: STYLE.PANEL, extra: 0, seed: g.S() });
  g.sector(rp - 0.08, rp + 0.08, u.a0, u.a1 - u.a0, y + 2.2, y + ROOM_CEIL, { color: g.pick(PAL.paint), style: STYLE.PANEL, extra: 0, seed: g.S() });
  // séjour
  kitchen(g, new Frame(...f.at(2.2, sgn * (hw(2.2) - 0.35)), R.ac - sgn * Math.PI / 2), y, 2.0);
  const td = 3.0, ts = -sgn * 0.6;
  rug(g, new Frame(...f.at(td, ts), R.ac), y, 2.2, 2.6);
  table(g, new Frame(...f.at(td, ts), R.ac), y, 1.0, 1.4);
  for (const s of [-0.9, 0.9]) chair(g, new Frame(...f.at(td, ts + s), R.ac + Math.sign(s) * Math.PI / 2), y);
  chair(g, new Frame(...f.at(td + 0.8, ts), R.ac + Math.PI), y);
  shelf(g, new Frame(...f.at(4.6, -sgn * (hw(4.6) - 0.25)), R.ac + sgn * Math.PI / 2), y, 1.2, 1.8);
  // chambre
  const bs = -sgn * Math.max(0, hw(D - 1) - 1.2);
  bed(g, new Frame(...f.at(D - 0.9, bs), R.ac + (sgn > 0 ? -Math.PI / 2 : Math.PI / 2)), y, true);
  if (g.rng.chance(0.55)) bunk(g, new Frame(...f.at(D - 3.0, sgn * (hw(D - 3) - 0.55)), R.ac + Math.PI / 2), y);
  cabinet(g, new Frame(...f.at(6.0, sgn * (hw(6) - 0.4)), R.ac - sgn * Math.PI / 2), y, 1.2, 1.9);
  const [lx, lz] = f.at(D - 2.5, 0);
  lampCeil(g, lx, lz, y + ROOM_CEIL, PAL.lamp, 0.7, 6);
  residents(g, info, R, [
    { d: td, s: ts - 0.9, pose: 1, face: -Math.PI / 2 },
    { d: td, s: ts + 0.9, pose: 1, face: Math.PI / 2 },
    { d: D - 0.9, s: bs, pose: 9, face: 0 },
    { d: 1.5, s: 0, pose: 2, face: 0.5 },
  ]);
}

const SHOPS: { name: string; goods: RGB[]; tint: RGB }[] = [
  { name: 'ÉPICERIE', goods: [hex(0x8a9a3a), hex(0xb0703a), hex(0x9a3a2a), hex(0xc8b060)], tint: hex(0xffe0b0) },
  { name: 'TISSUS', goods: [hex(0x7a3a2a), hex(0x3a4a6a), hex(0x6a6a4a), hex(0xb0a080)], tint: hex(0xfff0d8) },
  { name: 'RÉPARATIONS', goods: [hex(0x5a5e60), hex(0x3a3c3e), hex(0x8a8a80)], tint: hex(0xd8e8ff) },
  { name: 'QUINCAILLERIE', goods: [hex(0x6a6e70), hex(0x8a6a3a), hex(0x4a4a4a)], tint: hex(0xffe8c8) },
  { name: 'SALON DE THÉ', goods: [hex(0xd8d0bc), hex(0x8a6a4a)], tint: hex(0xffd8a0) },
  { name: 'COUTURE', goods: [hex(0x9a8a6a), hex(0x5a3a4a), hex(0x3a5a4a)], tint: hex(0xfff0d8) },
  { name: 'CORDONNIER', goods: [hex(0x4a3020), hex(0x6a4a30)], tint: hex(0xffe0b0) },
  { name: 'BOUGIES · LAMPES', goods: [hex(0xe8e0c8), hex(0xd8b060)], tint: hex(0xffd090) },
];
export const shopType = (seed: number) => SHOPS[seed % SHOPS.length];

function shop(g: Gen, R: Room) {
  const { f, D, hw } = R;
  const y = g.F;
  const t = shopType(R.u.seed);
  floorAndLight(g, R, STYLE.WOOD, hex(0x5a4632), t.tint, 1.3);
  if (t.name === 'SALON DE THÉ') {
    for (const [d, s] of [[2.0, -1.2], [2.0, 1.2], [4.2, 0]]) {
      table(g, new Frame(...f.at(d, s), R.ac), y, 0.8, 0.8);
      chair(g, new Frame(...f.at(d, s - 0.6), R.ac - Math.PI / 2), y);
      chair(g, new Frame(...f.at(d, s + 0.6), R.ac + Math.PI / 2), y);
      if (g.rng.chance(0.6)) { const [x, z] = f.at(d, s - 0.6); g.idle(x, y, z, yawTo(-Math.sin(R.ac) * -1, Math.cos(R.ac)), 1); }
    }
    counter(g, new Frame(...f.at(D - 1.2, 0), R.ac), y, 2.4);
  } else {
    counter(g, new Frame(...f.at(1.9, 0.4), R.ac), y, Math.min(3.0, hw(1.9) * 2 - 1.4));
    shelf(g, new Frame(...f.at(D - 0.3, -1.0), R.ac + Math.PI), y, 1.6, 2.2);
    shelf(g, new Frame(...f.at(D - 0.3, 1.0), R.ac + Math.PI), y, 1.6, 2.2);
    for (const s of [-1, 1]) shelf(g, new Frame(...f.at(3.6, s * (hw(3.6) - 0.25)), R.ac - s * Math.PI / 2), y, 1.6, 2.0);
    for (let k = 0; k < 4; k++) crate(g, new Frame(...f.at(g.rng.range(0.5, 1.2), g.rng.range(-hw(1) + 0.4, hw(1) - 0.4)), R.ac + g.rng.range(-0.3, 0.3)), y, 0.45, g.pick(t.goods));
    const [x, z] = f.at(2.6, 0.4);
    g.idle(x, y, z, yawTo(-Math.cos(R.ac), -Math.sin(R.ac)), 10, 'resident');
    if (g.rng.chance(0.5)) { const [cx, cz] = f.at(1.1, -0.2); g.idle(cx, y, cz, yawTo(Math.cos(R.ac), Math.sin(R.ac)), 2); }
  }
}

function atelier(g: Gen, R: Room) {
  const { f, D, hw } = R;
  const y = g.F;
  floorAndLight(g, R, STYLE.DECK, hex(0x4a4c4a), PAL.tube, 1.2);
  workbench(g, new Frame(...f.at(D - 0.5, 0), R.ac + Math.PI), y, Math.min(2.6, hw(D) * 2 - 1));
  workbench(g, new Frame(...f.at(2.8, hw(2.8) - 0.45), R.ac - Math.PI / 2), y, 1.8);
  for (let k = 0; k < 3; k++) crate(g, new Frame(...f.at(g.rng.range(1, D - 1.5), -hw(2) + 0.5), R.ac), y, 0.55);
  piece(g, f, 3.4, -0.4, 0.8, 1.4, y, y + 1.1, hex(0x4a5250), STYLE.BRASS, true);         // machine
  piece(g, f, 3.4, -0.4, 0.3, 0.3, y + 1.1, y + 1.5, hex(0x3a3c3e), STYLE.BRASS);
  const [x, z] = f.at(D - 1.2, 0);
  g.idle(x, y, z, yawTo(Math.cos(R.ac), Math.sin(R.ac)), 4, g.rng.chance(0.5) ? 'mechanic' : 'resident');
}

function office(g: Gen, R: Room) {
  const { f, D, hw } = R;
  const y = g.F;
  floorAndLight(g, R, STYLE.TILE, hex(0x5a5e5a), PAL.tube, 1.1);
  const rows = Math.max(1, Math.floor((D - 1.5) / 2));
  for (let i = 0; i < rows; i++) {
    for (const s of [-1, 1]) {
      const d = 1.8 + i * 2;
      if (Math.abs(s) * 1.0 > hw(d) - 0.8) continue;
      desk(g, new Frame(...f.at(d, s * 1.0), R.ac + Math.PI), y);
      if (g.rng.chance(0.55)) { const [x, z] = f.at(d + 0.65, s * 1.0); g.idle(x, y, z, yawTo(-Math.cos(R.ac), -Math.sin(R.ac)), 8, g.rng.chance(0.5) ? 'it' : 'resident'); }
    }
  }
  for (let k = 0; k < 3; k++) cabinet(g, new Frame(...f.at(D - 0.35, -hw(D) + 0.7 + k * 0.9), R.ac + Math.PI), y, 0.8, 1.5, hex(0x5a5e5a));
}

export { arcWall };
export const ringShape = ring;
export const unionShape = union;
export const subtractShape = subtract;
export { crt };
export { TAU };
