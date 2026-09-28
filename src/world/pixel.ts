// Pixel art en relief : motifs dessinés sur une grille (aigle impérial, crâne, rouage…)
// puis extrudés en boîtes, une boîte par suite horizontale de pixels identiques.
import type { RGB } from '../config';
import type { BoxOpts, World } from './builder';
import { SV, type Side } from './geom';

/** Grille de caractères ('.' = vide) avec quelques primitives de tracé. */
export class Raster {
  g: string[][];
  constructor(public w: number, public h: number) {
    this.g = Array.from({ length: h }, () => Array(w).fill('.'));
  }
  set(x: number, y: number, ch: string) {
    const ix = Math.round(x), iy = Math.round(y);
    if (ix >= 0 && iy >= 0 && ix < this.w && iy < this.h) this.g[iy][ix] = ch;
  }
  disk(cx: number, cy: number, r: number, ch: string) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++)
        if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) this.set(x, y, ch);
  }
  ellipse(cx: number, cy: number, rx: number, ry: number, ch: string) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++)
        if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) this.set(x, y, ch);
  }
  line(x0: number, y0: number, x1: number, y1: number, t: number, ch: string) {
    const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) + 1;
    for (let i = 0; i <= n; i++) {
      const u = i / n;
      this.disk(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, t / 2, ch);
    }
  }
  rows(): string[] {
    return this.g.map((r) => r.join(''));
  }
}

/** Aigle bicéphale (Aquila), 49 × 33. */
export function aquila(): string[] {
  const R = new Raster(49, 33);
  const cx = 24;
  // ailes : rémiges rayonnantes depuis l'épaule
  for (const s of [-1, 1]) {
    for (let i = 0; i < 7; i++) {
      const a = (0.62 - i * 0.2);
      const L = 21 - i * 1.3;
      const sx = cx + s * 3, sy = 14;
      R.line(sx, sy, sx + s * Math.cos(a) * L, sy - Math.sin(a) * L, 2.3, '#');
    }
    // cou et tête tournée vers l'extérieur
    R.line(cx + s * 1.5, 11, cx + s * 5, 5.5, 2.4, '#');
    R.disk(cx + s * 6, 4.5, 2.4, '#');
    R.line(cx + s * 7.5, 4.8, cx + s * 10, 5.8, 1.5, '#');
    R.set(cx + s * 6.5, 3.8, 'o');
    // serres
    R.line(cx + s * 2, 21, cx + s * 4.5, 25, 1.4, '#');
  }
  R.ellipse(cx, 16, 3.6, 7, '#');
  // queue en éventail
  for (const dx of [-3, -1.5, 0, 1.5, 3]) R.line(cx, 22, cx + dx * 1.2, 31, 1.6, '#');
  return R.rows();
}

/** Crâne, 9 × 10. */
export const SKULL = [
  '..#####..',
  '.#######.',
  '#########',
  '#########',
  '#oo###oo#',
  '#oo###oo#',
  '####.####',
  '.#######.',
  '.#.#.#.#.',
  '..#####..',
];

/** Rouage (Mechanicus) à crâne central, 23 × 23. */
export function cog(): string[] {
  const R = new Raster(23, 23);
  const c = 11;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    R.line(c + Math.cos(a) * 8, c + Math.sin(a) * 8, c + Math.cos(a) * 10.6, c + Math.sin(a) * 10.6, 2.6, '#');
  }
  R.disk(c, c, 8.6, '#');
  R.disk(c, c, 5.8, '.');
  // crâne stylisé au centre
  R.ellipse(c, c - 0.5, 3.6, 3.2, '#');
  R.set(c - 1.5, c - 0.5, 'o'); R.set(c + 1.5, c - 0.5, 'o');
  R.set(c - 1, c + 3, '#'); R.set(c, c + 3, '#'); R.set(c + 1, c + 3, '#');
  return R.rows();
}

export interface ArtInk { color: RGB; style?: number; emis?: number; extra?: number; depth?: number }

/**
 * Extrude un motif sur un plan vertical tourné vers `side`, centré en (cx, cy, cz).
 * px : taille d'un pixel (m) · depth : épaisseur (m), vers l'extérieur du plan.
 */
export function art(
  w: World, rows: string[], inks: Record<string, ArtInk>,
  cx: number, cy: number, cz: number, side: Side, px: number, depth: number,
  o: Partial<BoxOpts> = {},
) {
  const n = SV[side];
  // vecteur "droite" pour un observateur face au motif
  const rx = side === 0 ? -1 : side === 2 ? 1 : 0;
  const rz = side === 1 ? -1 : side === 3 ? 1 : 0;
  const W = rows[0].length * px, H = rows.length * px;
  rows.forEach((row, j) => {
    let i = 0;
    while (i < row.length) {
      const ch = row[i];
      let k = i;
      while (k < row.length && row[k] === ch) k++;
      const ink = inks[ch];
      if (ch !== '.' && ink) {
        const a0 = -W / 2 + i * px, a1 = -W / 2 + k * px;
        const y1 = cy + H / 2 - j * px, y0 = y1 - px;
        const d = depth * (ink.depth ?? 1);
        const xa = cx + rx * a0, xb = cx + rx * a1, za = cz + rz * a0, zb = cz + rz * a1;
        const x0 = Math.min(xa, xb) + (n[0] < 0 ? -d : 0), x1 = Math.max(xa, xb) + (n[0] > 0 ? d : 0);
        const z0 = Math.min(za, zb) + (n[1] < 0 ? -d : 0), z1 = Math.max(za, zb) + (n[1] > 0 ? d : 0);
        w.box(x0, y0, z0, x1, y1, z1, { detail: true, ...o, color: ink.color, style: ink.style, emis: ink.emis, extra: ink.extra });
      }
      i = k;
    }
  });
}
