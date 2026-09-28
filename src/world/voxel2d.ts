// Formes 2D (plan x, z) voxelisées sur une grille régulière, puis extrudées verticalement.
// Un silo est fait de cercles : noyau, marches en secteurs d'anneau, coursives, façades.
// Une cellule (i, j) de pas `res` est pleine si son centre ((i + ½)·res, (j + ½)·res) est dans la forme.
// Chaque rangée j est décrite par des intervalles [i0, i1) triés et disjoints.

export type Rows = Map<number, number[]>;

export interface Shape {
  /** Boîte englobante (x0, z0, x1, z1) en mètres. */
  bbox: [number, number, number, number];
  /** Intervalles de cellules pleines de la rangée dont le centre est en zc (ajoutés à out, triés). */
  row(zc: number, res: number, out: number[]): void;
}

const TAU = Math.PI * 2;
/** Première cellule dont le centre est ≥ x. */
const cellFrom = (x: number, res: number) => Math.ceil(x / res - 0.5 - 1e-9);

function pushSpan(out: number[], x0: number, x1: number, res: number) {
  const i0 = cellFrom(x0, res), i1 = cellFrom(x1, res);
  if (i1 > i0) out.push(i0, i1);
}

/** Normalise un angle dans [0, 2π). */
export const normAngle = (a: number) => ((a % TAU) + TAU) % TAU;
/** a est-il dans l'arc [a0, a0 + span] (sens trigonométrique) ? */
export const inArc = (a: number, a0: number, span: number) => normAngle(a - a0) <= span + 1e-9;

// ---------------------------------------------------------------------------
// Primitives
// ---------------------------------------------------------------------------

export function rect(x0: number, z0: number, x1: number, z1: number): Shape {
  return {
    bbox: [Math.min(x0, x1), Math.min(z0, z1), Math.max(x0, x1), Math.max(z0, z1)],
    row(zc, res, out) {
      if (zc < Math.min(z0, z1) || zc >= Math.max(z0, z1)) return;
      pushSpan(out, Math.min(x0, x1), Math.max(x0, x1), res);
    },
  };
}

/**
 * Anneau (r0 ≤ r < r1) centré en (cx, cz), limité éventuellement à l'arc [a0, a0 + span]
 * (angles au sens de atan2(z, x)).
 */
export function ring(cx: number, cz: number, r0: number, r1: number, a0 = 0, span = TAU): Shape {
  const full = span >= TAU - 1e-9;
  // boîte englobante de l'arc : extrémités, plus les axes traversés
  let bx0 = cx - r1, bz0 = cz - r1, bx1 = cx + r1, bz1 = cz + r1;
  if (!full) {
    const xs: number[] = [], zs: number[] = [];
    for (const a of [a0, a0 + span]) for (const r of [r0, r1]) { xs.push(cx + r * Math.cos(a)); zs.push(cz + r * Math.sin(a)); }
    for (let k = 0; k < 4; k++) {
      const ax = (k * Math.PI) / 2;
      if (inArc(ax, a0, span)) { xs.push(cx + r1 * Math.cos(ax)); zs.push(cz + r1 * Math.sin(ax)); }
    }
    bx0 = Math.min(...xs); bx1 = Math.max(...xs); bz0 = Math.min(...zs); bz1 = Math.max(...zs);
  }
  return {
    bbox: [bx0, bz0, bx1, bz1],
    row(zc, res, out) {
      const dz = zc - cz;
      if (Math.abs(dz) >= r1 || zc < bz0 - res || zc > bz1 + res) return;
      const xo = Math.sqrt(r1 * r1 - dz * dz);
      const spans: [number, number][] = [];
      if (Math.abs(dz) < r0) {
        const xi = Math.sqrt(r0 * r0 - dz * dz);
        spans.push([cx - xo, cx - xi], [cx + xi, cx + xo]);
      } else spans.push([cx - xo, cx + xo]);
      if (full) {
        for (const [a, b] of spans) pushSpan(out, a, b, res);
        return;
      }
      // arc : on teste l'angle de chaque cellule de l'anneau (limitée à la boîte de l'arc)
      for (const [a, b] of spans) {
        const i0 = cellFrom(Math.max(a, bx0 - res), res), i1 = cellFrom(Math.min(b, bx1 + res), res);
        if (i1 <= i0) continue;
        let start = NaN;
        for (let i = i0; i <= i1; i++) {
          const inside = i < i1 && inArc(Math.atan2(dz, (i + 0.5) * res - cx), a0, span);
          if (inside && Number.isNaN(start)) start = i;
          else if (!inside && !Number.isNaN(start)) { out.push(start, i); start = NaN; }
        }
      }
    },
  };
}

export const disk = (cx: number, cz: number, r: number) => ring(cx, cz, 0, r);

/** Rectangle orienté : centre, direction (angle), demi-longueur, demi-largeur. */
export function orect(cx: number, cz: number, ang: number, hl: number, hw: number): Shape {
  const ux = Math.cos(ang), uz = Math.sin(ang);
  const ex = Math.abs(ux) * hl + Math.abs(uz) * hw, ez = Math.abs(uz) * hl + Math.abs(ux) * hw;
  return {
    bbox: [cx - ex, cz - ez, cx + ex, cz + ez],
    row(zc, res, out) {
      const dz = zc - cz;
      if (Math.abs(dz) > ez) return;
      const i0 = cellFrom(cx - ex, res), i1 = cellFrom(cx + ex, res);
      let start = NaN;
      for (let i = i0; i <= i1; i++) {
        let inside = false;
        if (i < i1) {
          const dx = (i + 0.5) * res - cx;
          const a = dx * ux + dz * uz, b = -dx * uz + dz * ux;
          inside = Math.abs(a) <= hl && Math.abs(b) <= hw;
        }
        if (inside && Number.isNaN(start)) start = i;
        else if (!inside && !Number.isNaN(start)) { out.push(start, i); start = NaN; }
      }
    },
  };
}

/** Polygone convexe ou non (règle pair-impair), sommets [x, z]. */
export function poly(pts: [number, number][]): Shape {
  let x0 = Infinity, z0 = Infinity, x1 = -Infinity, z1 = -Infinity;
  for (const [x, z] of pts) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); }
  return {
    bbox: [x0, z0, x1, z1],
    row(zc, res, out) {
      const xs: number[] = [];
      for (let k = 0; k < pts.length; k++) {
        const [ax, az] = pts[k], [bx, bz] = pts[(k + 1) % pts.length];
        if ((az <= zc && bz > zc) || (bz <= zc && az > zc)) xs.push(ax + ((zc - az) / (bz - az)) * (bx - ax));
      }
      xs.sort((a, b) => a - b);
      const tmp: number[] = [];
      for (let k = 0; k + 1 < xs.length; k += 2) pushSpan(tmp, xs[k], xs[k + 1], res);
      out.push(...normalize(tmp));
    },
  };
}

// ---------------------------------------------------------------------------
// Opérations booléennes (par rangée)
// ---------------------------------------------------------------------------

/** Trie et fusionne des intervalles. */
export function normalize(iv: number[]): number[] {
  if (iv.length <= 2) return iv;
  const pairs: [number, number][] = [];
  for (let k = 0; k < iv.length; k += 2) pairs.push([iv[k], iv[k + 1]]);
  pairs.sort((a, b) => a[0] - b[0]);
  const out: number[] = [];
  for (const [a, b] of pairs) {
    const n = out.length;
    if (n && a <= out[n - 1]) out[n - 1] = Math.max(out[n - 1], b);
    else out.push(a, b);
  }
  return out;
}

function subtractIv(a: number[], b: number[]): number[] {
  if (!b.length) return a;
  const out: number[] = [];
  for (let k = 0; k < a.length; k += 2) {
    let s = a[k];
    const e = a[k + 1];
    for (let m = 0; m < b.length && s < e; m += 2) {
      const bs = b[m], be = b[m + 1];
      if (be <= s || bs >= e) continue;
      if (bs > s) out.push(s, bs);
      s = Math.max(s, be);
    }
    if (s < e) out.push(s, e);
  }
  return out;
}

export function union(...shapes: Shape[]): Shape {
  const bb: [number, number, number, number] = [Infinity, Infinity, -Infinity, -Infinity];
  for (const s of shapes) { bb[0] = Math.min(bb[0], s.bbox[0]); bb[1] = Math.min(bb[1], s.bbox[1]); bb[2] = Math.max(bb[2], s.bbox[2]); bb[3] = Math.max(bb[3], s.bbox[3]); }
  return {
    bbox: bb,
    row(zc, res, out) {
      const tmp: number[] = [];
      for (const s of shapes) s.row(zc, res, tmp);
      out.push(...normalize(tmp));
    },
  };
}

export function subtract(a: Shape, ...holes: Shape[]): Shape {
  return {
    bbox: a.bbox,
    row(zc, res, out) {
      const base: number[] = [];
      a.row(zc, res, base);
      if (!base.length) return;
      const h: number[] = [];
      for (const s of holes) s.row(zc, res, h);
      out.push(...subtractIv(normalize(base), normalize(h)));
    },
  };
}

export function intersect(a: Shape, b: Shape): Shape {
  return {
    bbox: [Math.max(a.bbox[0], b.bbox[0]), Math.max(a.bbox[1], b.bbox[1]), Math.min(a.bbox[2], b.bbox[2]), Math.min(a.bbox[3], b.bbox[3])] as [number, number, number, number],
    row(zc, res, out) {
      const A: number[] = [], B: number[] = [];
      a.row(zc, res, A);
      if (!A.length) return;
      b.row(zc, res, B);
      if (!B.length) return;
      const nb = normalize(B);
      // A ∩ B = A − (A − B)
      const na = normalize(A);
      out.push(...subtractIv(na, subtractIv(na, nb)));
    },
  };
}

// ---------------------------------------------------------------------------
// Rastérisation et maillage
// ---------------------------------------------------------------------------

export function rasterize(s: Shape, res: number): Rows {
  const rows: Rows = new Map();
  const [, z0, , z1] = s.bbox;
  const j0 = Math.floor(z0 / res) - 1, j1 = Math.ceil(z1 / res) + 1;
  for (let j = j0; j <= j1; j++) {
    const out: number[] = [];
    s.row((j + 0.5) * res, res, out);
    const n = normalize(out);
    if (n.length) rows.set(j, n);
  }
  return rows;
}

/** Rectangles maximaux verticalement (fusion des rangées aux intervalles identiques) : [i0, i1, j0, j1]. */
export function rects(rows: Rows): number[][] {
  const out: number[][] = [];
  const js = [...rows.keys()].sort((a, b) => a - b);
  let open = new Map<string, number[]>();
  let prevJ = -Infinity;
  for (const j of js) {
    const iv = rows.get(j)!;
    const next = new Map<string, number[]>();
    for (let k = 0; k < iv.length; k += 2) {
      const key = `${iv[k]},${iv[k + 1]}`;
      const o = j === prevJ + 1 ? open.get(key) : undefined;
      if (o) { o[3] = j + 1; next.set(key, o); open.delete(key); }
      else next.set(key, [iv[k], iv[k + 1], j, j + 1]);
    }
    for (const o of open.values()) out.push(o);
    open = next;
    prevJ = j;
  }
  for (const o of open.values()) out.push(o);
  return out;
}

export interface Faces {
  /** Rectangles (dessus et dessous) : [i0, i1, j0, j1]. */
  tops: number[][];
  /** Faces latérales ±x : [i (arête), j0, j1, signe]. */
  xs: number[][];
  /** Faces latérales ±z : [j (arête), i0, i1, signe]. */
  zs: number[][];
}

/** Contour d'une forme rastérisée : faces latérales fusionnées + rectangles du dessus. */
export function faces(rows: Rows): Faces {
  const tops = rects(rows);
  const xs: number[][] = [];
  const zs: number[][] = [];
  const js = [...rows.keys()].sort((a, b) => a - b);
  // ±x : un intervalle maximal a toujours ses deux bouts exposés ; on fusionne d'une rangée à l'autre
  let openL = new Map<number, number[]>(), openR = new Map<number, number[]>();
  let prevJ = -Infinity;
  for (const j of js) {
    const iv = rows.get(j)!;
    const nL = new Map<number, number[]>(), nR = new Map<number, number[]>();
    const cont = j === prevJ + 1;
    for (let k = 0; k < iv.length; k += 2) {
      const a = iv[k], b = iv[k + 1];
      const l = cont ? openL.get(a) : undefined;
      if (l) { l[2] = j + 1; openL.delete(a); nL.set(a, l); } else nL.set(a, [a, j, j + 1, -1]);
      const r = cont ? openR.get(b) : undefined;
      if (r) { r[2] = j + 1; openR.delete(b); nR.set(b, r); } else nR.set(b, [b, j, j + 1, 1]);
    }
    for (const o of openL.values()) xs.push(o);
    for (const o of openR.values()) xs.push(o);
    openL = nL; openR = nR; prevJ = j;
  }
  for (const o of openL.values()) xs.push(o);
  for (const o of openR.values()) xs.push(o);
  // ±z : différences entre rangées consécutives
  const empty: number[] = [];
  const all = new Set<number>();
  for (const j of js) { all.add(j); all.add(j + 1); }
  for (const j of [...all].sort((a, b) => a - b)) {
    // arête entre la rangée j-1 (dessous) et j (dessus), en z = j·res
    const below = rows.get(j - 1) ?? empty, above = rows.get(j) ?? empty;
    for (const [a, b] of pairsOf(subtractIv(below, above))) zs.push([j, a, b, 1]);   // face +z de la rangée j-1
    for (const [a, b] of pairsOf(subtractIv(above, below))) zs.push([j, a, b, -1]);  // face −z de la rangée j
  }
  return { tops, xs, zs };
}

function pairsOf(iv: number[]): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < iv.length; k += 2) out.push([iv[k], iv[k + 1]]);
  return out;
}

/** Nombre de cellules pleines (tests). */
export function area(rows: Rows): number {
  let n = 0;
  for (const iv of rows.values()) for (let k = 0; k < iv.length; k += 2) n += iv[k + 1] - iv[k];
  return n;
}
