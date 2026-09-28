// Mobilier voxelisé : chaque meuble est une composition de pavés orientés (angle quelconque).
import { PAL, STYLE, hex, type RGB } from '../config';
import { ring } from '../world/voxel2d';
import type { Gen } from './common';

/** Repère local d'un meuble : origine (x, z), angle (axe « avant »), dimensions en mètres. */
export class Frame {
  ux: number; uz: number; // avant (profondeur)
  vx: number; vz: number; // côté (largeur)
  constructor(public x: number, public z: number, public ang: number) {
    this.ux = Math.cos(ang); this.uz = Math.sin(ang);
    this.vx = -Math.sin(ang); this.vz = Math.cos(ang);
  }
  /** Point à la profondeur d et au décalage latéral s. */
  at(d: number, s: number): [number, number] {
    return [this.x + this.ux * d + this.vx * s, this.z + this.uz * d + this.vz * s];
  }
}

const D = (g: Gen, solid = false) => ({ detail: g.detailOk, solid });

/** Pavé local : centre (d, s), taille (profondeur dd × largeur ds), hauteur y0..y1. */
export function piece(g: Gen, f: Frame, d: number, s: number, dd: number, ds: number, y0: number, y1: number, color: RGB, style: number = STYLE.FLESH, solid = false, emis = 0, extra = 0) {
  const [x, z] = f.at(d, s);
  g.obox(x, z, f.ang, dd, ds, y0, y1, { color, style, emis, extra, seed: g.S(), ...D(g, solid) });
}

export function bed(g: Gen, f: Frame, y: number, double = false, blanket?: RGB) {
  const w = double ? 1.5 : 0.95;
  const wood = g.rng.chance(0.6) ? PAL.wood : hex(0x4a4e50);
  piece(g, f, 0, 0, 2.0, w, y, y + 0.32, wood, STYLE.WOOD, true);
  piece(g, f, 0, 0, 1.94, w - 0.06, y + 0.32, y + 0.52, hex(0xcfc6b0), STYLE.CLOTH, false);
  piece(g, f, 0.18, 0, 1.4, w, y + 0.5, y + 0.6, blanket ?? g.pick(PAL.cloth), STYLE.CLOTH, false);
  piece(g, f, -0.8, 0, 0.3, w - 0.2, y + 0.52, y + 0.64, hex(0xe0dccc), STYLE.CLOTH, false);
  piece(g, f, -1.02, 0, 0.08, w, y, y + 0.95, wood, STYLE.WOOD, false);
}

export function bunk(g: Gen, f: Frame, y: number) {
  const metal = hex(0x3e4244);
  for (const [dd, ss] of [[-0.95, -0.42], [-0.95, 0.42], [0.95, -0.42], [0.95, 0.42]]) piece(g, f, dd, ss, 0.06, 0.06, y, y + 1.9, metal, STYLE.BRASS);
  for (const h of [0.3, 1.35]) {
    piece(g, f, 0, 0, 1.96, 0.9, y + h, y + h + 0.08, metal, STYLE.BRASS, h < 1);
    piece(g, f, 0, 0, 1.9, 0.86, y + h + 0.08, y + h + 0.24, g.pick(PAL.cloth), STYLE.CLOTH);
  }
}

export function table(g: Gen, f: Frame, y: number, dd = 0.9, ds = 0.9, color: RGB = PAL.wood, h = 0.76) {
  piece(g, f, 0, 0, dd, ds, y + h - 0.05, y + h, color, STYLE.WOOD, true);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) piece(g, f, a * (dd / 2 - 0.06), b * (ds / 2 - 0.06), 0.06, 0.06, y, y + h - 0.05, color, STYLE.WOOD);
}

export function chair(g: Gen, f: Frame, y: number, color: RGB = PAL.woodDark) {
  piece(g, f, 0, 0, 0.42, 0.42, y + 0.42, y + 0.47, color, STYLE.WOOD);
  piece(g, f, 0.19, 0, 0.05, 0.42, y + 0.47, y + 0.92, color, STYLE.WOOD);
  for (const [a, b] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) piece(g, f, a * 0.17, b * 0.17, 0.04, 0.04, y, y + 0.42, color, STYLE.WOOD);
}

export function cabinet(g: Gen, f: Frame, y: number, w = 1.0, h = 1.9, color?: RGB) {
  const c = color ?? g.pick([PAL.wood, hex(0x5a5e58), hex(0x4a5a5a), hex(0x6a5a44)]);
  piece(g, f, 0, 0, 0.5, w, y, y + h, c, STYLE.WOOD, true);
  piece(g, f, -0.26, 0, 0.02, 0.02, y + 0.1, y + h - 0.1, hex(0x2a2826), STYLE.SOLID);
}

export function shelf(g: Gen, f: Frame, y: number, w = 1.4, h = 1.8, goods = true) {
  const c = g.pick([PAL.wood, hex(0x4a4e4e)]);
  piece(g, f, 0, 0, 0.35, 0.05, y, y + h, c, STYLE.WOOD, true);
  piece(g, f, 0, w / 2, 0.35, 0.05, y, y + h, c, STYLE.WOOD);
  piece(g, f, 0, -w / 2, 0.35, 0.05, y, y + h, c, STYLE.WOOD);
  for (let k = 0; k < 4; k++) {
    const yy = y + 0.1 + k * (h - 0.2) / 3;
    piece(g, f, 0, 0, 0.35, w, yy, yy + 0.03, c, STYLE.WOOD);
    if (goods && k < 3) {
      let s = -w / 2 + 0.08;
      while (s < w / 2 - 0.12) {
        const gw = g.rng.range(0.08, 0.26);
        const gh = g.rng.range(0.1, Math.min(0.4, (h - 0.2) / 3 - 0.05));
        if (g.rng.chance(0.8)) piece(g, f, g.rng.range(-0.05, 0.05), s + gw / 2, 0.24, gw, yy + 0.03, yy + 0.03 + gh, g.pick([hex(0x8a6a4a), hex(0x5a6a7a), hex(0x9a8a5a), hex(0x6a4a3a), hex(0xb0a890), hex(0x4a5a3a), hex(0x7a3a2a)]), STYLE.FLESH);
        s += gw + 0.03;
      }
    }
  }
}

export function counter(g: Gen, f: Frame, y: number, len: number, top: RGB = hex(0x8a7a60), body: RGB = hex(0x5a4a3a)) {
  piece(g, f, 0, 0, 0.6, len, y, y + 0.92, body, STYLE.WOOD, true);
  piece(g, f, 0, 0, 0.66, len + 0.04, y + 0.92, y + 0.97, top, STYLE.WOOD);
}

export function kitchen(g: Gen, f: Frame, y: number, len = 1.8) {
  counter(g, f, y, len, hex(0x9a9a90), hex(0x6a6e6a));
  piece(g, f, 0, -len / 2 + 0.35, 0.45, 0.5, y + 0.97, y + 1.0, hex(0xb8bcbc), STYLE.BRASS);           // évier
  piece(g, f, 0, len / 2 - 0.35, 0.4, 0.45, y + 0.97, y + 1.02, hex(0x2a2a2a), STYLE.SOLID);          // réchaud
  piece(g, f, 0.05, len / 2 - 0.35, 0.12, 0.12, y + 1.02, y + 1.03, hex(0xff5020), STYLE.EMISSIVE, false, 1.2);
  piece(g, f, 0.28, 0, 0.3, len, y + 1.5, y + 2.1, hex(0x7a7a6e), STYLE.WOOD);                          // placards hauts
  for (let k = 0; k < 3; k++) piece(g, f, -0.1, g.rng.range(-len / 2 + 0.3, len / 2 - 0.3), 0.14, 0.14, y + 0.97, y + 0.97 + g.rng.range(0.1, 0.25), g.pick([hex(0x9a6a3a), hex(0xd0c8b0), hex(0x5a7a8a)]), STYLE.FLESH);
}

export function rug(g: Gen, f: Frame, y: number, dd: number, ds: number) {
  piece(g, f, 0, 0, dd, ds, y, y + 0.02, g.pick(PAL.cloth), STYLE.CLOTH, false, 0, 1);
}

export function plant(g: Gen, f: Frame, y: number) {
  piece(g, f, 0, 0, 0.3, 0.3, y, y + 0.35, hex(0x7a4a30), STYLE.FLESH);
  piece(g, f, 0, 0, 0.5, 0.5, y + 0.35, y + 0.8, PAL.leaf, STYLE.FOLIAGE);
}

export function crt(g: Gen, f: Frame, y: number, amber = false) {
  piece(g, f, 0.06, 0, 0.42, 0.44, y, y + 0.38, hex(0xb8b2a0), STYLE.FLESH);
  piece(g, f, -0.16, 0, 0.02, 0.34, y + 0.05, y + 0.33, hex(0xffffff), STYLE.SCREEN, false, 2.4, amber ? 1 : 0);
  piece(g, f, -0.3, 0, 0.18, 0.45, y - 0.02, y, hex(0xa8a290), STYLE.FLESH);                     // clavier
}

export function desk(g: Gen, f: Frame, y: number, withCrt = true) {
  table(g, f, y, 0.75, 1.4, g.pick([hex(0x5a5e58), PAL.wood, hex(0x4a5050)]));
  if (withCrt) crt(g, new Frame(...f.at(0.12, 0.2), f.ang + Math.PI), y + 0.76);
  piece(g, f, 0.1, -0.45, 0.3, 0.22, y + 0.76, y + 0.8, hex(0xd8d0bc), STYLE.FLESH);                // papiers
  chair(g, new Frame(...f.at(-0.65, 0), f.ang + Math.PI), y, hex(0x3a3c3a));
}

export function lampCeil(g: Gen, x: number, z: number, y: number, color: RGB = PAL.lamp, k = 1.1, r = 6.5, flick = false) {
  g.box(x - 0.2, y - 0.1, z - 0.2, x + 0.2, y, z + 0.2, { color: hex(0x3a3836), style: STYLE.SOLID, extra: 2, detail: g.detailOk, solid: false });
  g.box(x - 0.16, y - 0.2, z - 0.16, x + 0.16, y - 0.1, z + 0.16, { color, style: STYLE.EMISSIVE, emis: 3.2, extra: flick ? 2 : 0, seed: g.S(), detail: g.detailOk, solid: false });
  g.light(x, y - 0.4, z, color, k, r, flick ? g.S() + 1 : undefined);
}

export function crate(g: Gen, f: Frame, y: number, s = 0.6, color?: RGB) {
  piece(g, f, 0, 0, s, s, y, y + s * 0.8, color ?? g.pick([hex(0x6a5236), hex(0x5a4a34), hex(0x4a5a4a)]), STYLE.WOOD, true);
}

export function barrel(g: Gen, x: number, z: number, y: number, color: RGB = hex(0x4a5a5a)) {
  g.shape(ring(x, z, 0, 0.3), y, y + 0.9, { color, style: STYLE.SOLID, extra: 1, seed: g.S(), detail: g.detailOk, solid: true, res: 0.1 });
}

export function workbench(g: Gen, f: Frame, y: number, len = 2.0) {
  piece(g, f, 0, 0, 0.8, len, y + 0.88, y + 0.95, hex(0x6a5a44), STYLE.WOOD, true);
  for (const s of [-1, 1]) piece(g, f, 0, s * (len / 2 - 0.08), 0.7, 0.08, y, y + 0.88, hex(0x3a3c3e), STYLE.BRASS);
  piece(g, f, 0, 0, 0.7, len - 0.2, y + 0.2, y + 0.26, hex(0x3a3c3e), STYLE.BRASS);
  for (let k = 0; k < 5; k++) piece(g, f, g.rng.range(-0.25, 0.25), g.rng.range(-len / 2 + 0.2, len / 2 - 0.2), g.rng.range(0.08, 0.3), g.rng.range(0.08, 0.3), y + 0.95, y + 0.95 + g.rng.range(0.04, 0.2), g.pick([hex(0x6a6e70), hex(0x8a6a3a), hex(0x3a3a3a), hex(0xa08040), hex(0x5a3a2a)]), STYLE.BRASS);
  // panneau à outils
  piece(g, f, 0.42, 0, 0.04, len, y + 1.1, y + 2.0, hex(0x5a4a34), STYLE.WOOD);
  for (let k = 0; k < 8; k++) piece(g, f, 0.38, g.rng.range(-len / 2 + 0.15, len / 2 - 0.15), 0.04, g.rng.range(0.04, 0.12), y + g.rng.range(1.2, 1.7), y + g.rng.range(1.75, 1.95), hex(0x7a7e80), STYLE.BRASS);
}
