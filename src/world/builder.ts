// Accumulation de géométrie en boîtes et en formes voxelisées, sans dépendance à three.js
// (le code tourne dans les workers de génération ; le thread principal fabrique les maillages).
import { CHUNK, DETAIL_CHUNK, V, type RGB } from '../config';
import { CollisionWorld } from '../physics';
import { faces, rasterize, rects, type Shape } from './voxel2d';

type TA = Float32Array | Int8Array | Uint8Array | Uint16Array | Uint32Array;

class Buf<T extends TA> {
  a: T;
  n = 0;
  constructor(private ctor: new (n: number) => T, cap = 4096) {
    this.a = new ctor(cap);
  }
  ensure(k: number) {
    if (this.n + k > this.a.length) {
      const b = new this.ctor(Math.max(this.a.length * 2, this.n + k));
      (b as any).set(this.a);
      this.a = b;
    }
  }
  view(): T {
    return this.a.slice(0, this.n) as T;
  }
}

// Faces : normale, axe U, axe V, coin de base (indices dans [x0,y0,z0,x1,y1,z1])
// U x V = normale -> triangles CCW vus de l'extérieur.
const FACES: { n: [number, number, number]; u: [number, number, number]; v: [number, number, number]; base: [number, number, number]; bit: number }[] = [
  { n: [1, 0, 0], u: [0, 0, -1], v: [0, 1, 0], base: [3, 1, 5], bit: 1 },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0], base: [0, 1, 2], bit: 2 },
  { n: [0, 1, 0], u: [1, 0, 0], v: [0, 0, -1], base: [0, 4, 5], bit: 4 },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1], base: [0, 1, 2], bit: 8 },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0], base: [0, 1, 5], bit: 16 },
  { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0], base: [3, 1, 2], bit: 32 },
];

export const SKIP = { PX: 1, NX: 2, PY: 4, NY: 8, PZ: 16, NZ: 32, ALL: 63 };

/** Tableaux d'un maillage (transférables entre threads). */
export interface GeoArrays {
  pos: Float32Array;
  nrm: Int8Array;
  col: Uint8Array;
  par: Uint8Array;
  face: Uint16Array;
  idx: Uint32Array;
  /** Sphère englobante : centre et rayon. */
  bs: [number, number, number, number];
}

/**
 * Accumulateur de géométrie de boîtes (format compact).
 * aFace : coordonnées de la face en voxels (u, v) et taille de la face en voxels.
 */
export class Accum {
  pos = new Buf(Float32Array);
  nrm = new Buf(Int8Array);
  col = new Buf(Uint8Array);
  par = new Buf(Uint8Array);
  face = new Buf(Uint16Array);
  idx = new Buf(Uint32Array);
  verts = 0;
  private min = [Infinity, Infinity, Infinity];
  private max = [-Infinity, -Infinity, -Infinity];

  addBox(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    c: RGB, style: number, seed: number, emis: number, extra: number, skip = 0,
    smooth?: Smooth,
  ) {
    const b = [x0, y0, z0, x1, y1, z1];
    const sx = x1 - x0, sy = y1 - y0, sz = z1 - z0;
    const cr = Math.round(Math.min(1, c[0]) * 255), cg = Math.round(Math.min(1, c[1]) * 255), cb = Math.round(Math.min(1, c[2]) * 255);
    const em = Math.max(0, Math.min(255, Math.round((emis / 8) * 255)));
    if (x0 < this.min[0]) this.min[0] = x0; if (y0 < this.min[1]) this.min[1] = y0; if (z0 < this.min[2]) this.min[2] = z0;
    if (x1 > this.max[0]) this.max[0] = x1; if (y1 > this.max[1]) this.max[1] = y1; if (z1 > this.max[2]) this.max[2] = z1;
    for (const f of FACES) {
      if (skip & f.bit) continue;
      const bx = b[f.base[0]], by = b[f.base[1]], bz = b[f.base[2]];
      const w = Math.abs(f.u[0]) * sx + Math.abs(f.u[1]) * sy + Math.abs(f.u[2]) * sz;
      const h = Math.abs(f.v[0]) * sx + Math.abs(f.v[1]) * sy + Math.abs(f.v[2]) * sz;
      const uw = Math.min(65535, Math.max(1, Math.round(w / V))), vh = Math.min(65535, Math.max(1, Math.round(h / V)));
      this.pos.ensure(12); this.nrm.ensure(12); this.col.ensure(12); this.par.ensure(16); this.face.ensure(16); this.idx.ensure(6);
      // normale lissée d'une paroi courbe : radiale sur les arcs, tangentielle sur les coupes rayonnantes
      let mode = 0, sgn = 1;
      if (smooth && smooth.sy !== undefined) {
        const fx = bx + f.u[0] * w * 0.5 + f.v[0] * h * 0.5 - smooth.cx, fy = (by + f.u[1] * w * 0.5 + f.v[1] * h * 0.5 - smooth.sy) * (smooth.ky ?? 1), fz = bz + f.u[2] * w * 0.5 + f.v[2] * h * 0.5 - smooth.cz;
        mode = 3;
        sgn = Math.sign(f.n[0] * fx + f.n[1] * fy + f.n[2] * fz) || 1;
      } else if (smooth && f.n[1] === 0) {
        const fx = bx + f.u[0] * w * 0.5 + f.v[0] * h * 0.5 - smooth.cx, fz = bz + f.u[2] * w * 0.5 + f.v[2] * h * 0.5 - smooth.cz;
        const r = Math.hypot(fx, fz) || 1;
        const tol = smooth.tol ?? 0.3;
        if (Math.abs(r - smooth.r1) < tol) { mode = 1; sgn = 1; }
        else if (smooth.r0 > 0 && Math.abs(r - smooth.r0) < tol) { mode = 1; sgn = -1; }
        else { mode = 2; sgn = Math.sign(f.n[0] * -fz / r + f.n[2] * fx / r) || 1; }
      }
      for (let k = 0; k < 4; k++) {
        const du = k === 1 || k === 2 ? w : 0;
        const dv = k >= 2 ? h : 0;
        const px = bx + f.u[0] * du + f.v[0] * dv, py = by + f.u[1] * du + f.v[1] * dv, pz = bz + f.u[2] * du + f.v[2] * dv;
        this.pos.a[this.pos.n++] = px;
        this.pos.a[this.pos.n++] = py;
        this.pos.a[this.pos.n++] = pz;
        if (mode === 3) {
          const dx = px - smooth!.cx, dy = (py - smooth!.sy!) * (smooth!.ky ?? 1), dz = pz - smooth!.cz;
          const l = Math.hypot(dx, dy, dz) || 1;
          this.nrm.a[this.nrm.n++] = Math.round((dx / l) * sgn * 127);
          this.nrm.a[this.nrm.n++] = Math.round((dy / l) * sgn * 127);
          this.nrm.a[this.nrm.n++] = Math.round((dz / l) * sgn * 127);
        } else if (mode) {
          const dx = px - smooth!.cx, dz = pz - smooth!.cz;
          const r = Math.hypot(dx, dz) || 1;
          const nx = mode === 1 ? (dx / r) * sgn : (-dz / r) * sgn, nz = mode === 1 ? (dz / r) * sgn : (dx / r) * sgn;
          this.nrm.a[this.nrm.n++] = Math.round(nx * 127);
          this.nrm.a[this.nrm.n++] = 0;
          this.nrm.a[this.nrm.n++] = Math.round(nz * 127);
        } else {
          this.nrm.a[this.nrm.n++] = f.n[0] * 127;
          this.nrm.a[this.nrm.n++] = f.n[1] * 127;
          this.nrm.a[this.nrm.n++] = f.n[2] * 127;
        }
        this.col.a[this.col.n++] = cr;
        this.col.a[this.col.n++] = cg;
        this.col.a[this.col.n++] = cb;
        this.par.a[this.par.n++] = style;
        this.par.a[this.par.n++] = seed & 255;
        this.par.a[this.par.n++] = em;
        this.par.a[this.par.n++] = extra & 255;
        this.face.a[this.face.n++] = du > 0 ? uw : 0;
        this.face.a[this.face.n++] = dv > 0 ? vh : 0;
        this.face.a[this.face.n++] = uw;
        this.face.a[this.face.n++] = vh;
      }
      const v = this.verts;
      const I = this.idx;
      I.a[I.n++] = v; I.a[I.n++] = v + 1; I.a[I.n++] = v + 2;
      I.a[I.n++] = v; I.a[I.n++] = v + 2; I.a[I.n++] = v + 3;
      this.verts += 4;
    }
  }

  arrays(): GeoArrays {
    const c = [(this.min[0] + this.max[0]) / 2, (this.min[1] + this.max[1]) / 2, (this.min[2] + this.max[2]) / 2];
    const r = Math.hypot(this.max[0] - c[0], this.max[1] - c[1], this.max[2] - c[2]);
    return { pos: this.pos.view(), nrm: this.nrm.view(), col: this.col.view(), par: this.par.view(), face: this.face.view(), idx: this.idx.view(), bs: [c[0], c[1], c[2], r] };
  }
}

/**
 * Lissage des normales d'une paroi courbe (centre, rayons intérieur et extérieur).
 * sy/ky : surface ellipsoïdale (dôme) — normale ∝ (x − cx, (y − sy)·ky, z − cz) sur toutes les faces.
 */
export interface Smooth { cx: number; cz: number; r0: number; r1: number; tol?: number; sy?: number; ky?: number }

/** Tableaux transférables d'une géométrie (objets à céder au thread principal). */
export function geoBuffers(a: GeoArrays): ArrayBuffer[] {
  return [a.pos.buffer, a.nrm.buffer, a.col.buffer, a.par.buffer, a.face.buffer, a.idx.buffer] as ArrayBuffer[];
}

export interface BoxOpts {
  color: RGB;
  style?: number;
  seed?: number;
  emis?: number;
  extra?: number;
  solid?: boolean;  // défaut : true (sauf détails)
  skip?: number;
  /** Détail fin : chunk dédié, affiché seulement près du joueur, sans collision par défaut. */
  detail?: boolean;
}

export interface ShapeOpts extends BoxOpts {
  /** Pas de la grille (défaut V). */
  res?: number;
  /** Faces à produire (défaut : toutes). */
  top?: boolean;
  bottom?: boolean;
  sides?: boolean;
  /** Normales lissées (parois courbes). */
  smooth?: Smooth;
}

export interface LightSrc {
  x: number; y: number; z: number;
  r: number; g: number; b: number; // couleur * intensité
  radius: number;
  flicker?: number; // graine : lumière défaillante qui grésille
}

/** Cône de lumière statique (sommet, direction, longueur, rayon de base). */
export interface Cone {
  x: number; y: number; z: number;
  dx: number; dy: number; dz: number;
  len: number; radius: number;
  color: RGB; intensity: number;
  flicker?: number;
}

export interface SteamEmitter {
  x: number; y: number; z: number;
  size: number;   // taille des volutes
  rise: number;   // hauteur de montée
  n: number;      // nombre de particules
  tint: RGB;
}

/** Monde en construction : géométrie par chunks, collisions, lumières. */
export class World {
  opaque = new Map<number, Accum>();
  detail = new Map<number, Accum>();
  col = new CollisionWorld();
  lights: LightSrc[] = [];
  steam: SteamEmitter[] = [];
  cones: Cone[] = [];
  boxes = 0;
  /** Décalage vertical des chunks (un monde par niveau : clés de chunk locales). */
  constructor(public chunkSize = CHUNK, public detailSize = DETAIL_CHUNK) {}

  private chunk(map: Map<number, Accum>, x: number, y: number, z: number, size: number): Accum {
    const k = ((Math.floor(x / size) + 256) * 512 + (Math.floor(z / size) + 256)) * 64 + ((Math.floor(y / 48) + 32) & 63);
    let a = map.get(k);
    if (!a) map.set(k, (a = new Accum()));
    return a;
  }

  private acc(o: BoxOpts, x: number, y: number, z: number) {
    return o.detail ? this.chunk(this.detail, x, y, z, this.detailSize) : this.chunk(this.opaque, x, y, z, this.chunkSize);
  }

  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BoxOpts) {
    if (x1 < x0) [x0, x1] = [x1, x0];
    if (y1 < y0) [y0, y1] = [y1, y0];
    if (z1 < z0) [z0, z1] = [z1, z0];
    if (x1 - x0 < 1e-4 || y1 - y0 < 1e-4 || z1 - z0 < 1e-4) return;
    this.boxes++;
    this.acc(o, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2)
      .addBox(x0, y0, z0, x1, y1, z1, o.color, o.style ?? 0, o.seed ?? 0, o.emis ?? 0, o.extra ?? 0, o.skip ?? 0);
    const solid = o.solid ?? !o.detail;
    if (solid) this.col.add(x0, y0, z0, x1, y1, z1);
  }

  /** Forme 2D voxelisée extrudée de y0 à y1 : seules les faces de contour sont produites. */
  shape(s: Shape, y0: number, y1: number, o: ShapeOpts) {
    if (y1 - y0 < 1e-4) return;
    const res = o.res ?? V;
    const rows = rasterize(s, res);
    if (!rows.size) return;
    const F = faces(rows);
    const c = o.color, st = o.style ?? 0, sd = o.seed ?? 0, em = o.emis ?? 0, ex = o.extra ?? 0;
    const eps = res * 0.5;
    const ym = (y0 + y1) / 2;
    if (o.top !== false || o.bottom !== false) {
      for (const [i0, i1, j0, j1] of F.tops) {
        const x0 = i0 * res, x1 = i1 * res, z0 = j0 * res, z1 = j1 * res;
        const a = this.acc(o, (x0 + x1) / 2, ym, (z0 + z1) / 2);
        if (o.top !== false) a.addBox(x0, y1 - eps, z0, x1, y1, z1, c, st, sd, em, ex, SKIP.ALL ^ SKIP.PY, o.smooth?.sy !== undefined ? o.smooth : undefined);
        if (o.bottom !== false) a.addBox(x0, y0, z0, x1, y0 + eps, z1, c, st, sd, em, ex, SKIP.ALL ^ SKIP.NY, o.smooth?.sy !== undefined ? o.smooth : undefined);
        this.boxes++;
      }
    }
    if (o.sides !== false) {
      for (const [i, j0, j1, sg] of F.xs) {
        const x = i * res, z0 = j0 * res, z1 = j1 * res;
        const a = this.acc(o, x, ym, (z0 + z1) / 2);
        if (sg > 0) a.addBox(x - eps, y0, z0, x, y1, z1, c, st, sd, em, ex, SKIP.ALL ^ SKIP.PX, o.smooth);
        else a.addBox(x, y0, z0, x + eps, y1, z1, c, st, sd, em, ex, SKIP.ALL ^ SKIP.NX, o.smooth);
      }
      for (const [j, i0, i1, sg] of F.zs) {
        const z = j * res, x0 = i0 * res, x1 = i1 * res;
        const a = this.acc(o, (x0 + x1) / 2, ym, z);
        if (sg > 0) a.addBox(x0, y0, z - eps, x1, y1, z, c, st, sd, em, ex, SKIP.ALL ^ SKIP.PZ, o.smooth);
        else a.addBox(x0, y0, z, x1, y1, z + eps, c, st, sd, em, ex, SKIP.ALL ^ SKIP.NZ, o.smooth);
      }
    }
    const solid = o.solid ?? !o.detail;
    if (solid) for (const [i0, i1, j0, j1] of rects(rows)) this.col.add(i0 * res, y0, j0 * res, i1 * res, y1, j1 * res);
  }

  /** Collision seule (sans géométrie). */
  wall(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    this.col.add(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
  }

  /** Collision seule pour une forme 2D. */
  wallShape(s: Shape, y0: number, y1: number, res = 0.2) {
    for (const [i0, i1, j0, j1] of rects(rasterize(s, res))) this.col.add(i0 * res, y0, j0 * res, i1 * res, y1, j1 * res);
  }

  isFree(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    return !this.col.hit(Math.min(x0, x1), Math.min(y0, y1), Math.min(z0, z1), Math.max(x0, x1), Math.max(y0, y1), Math.max(z0, z1));
  }

  light(x: number, y: number, z: number, c: RGB, intensity: number, radius: number, flicker?: number) {
    this.lights.push({ x, y, z, r: c[0] * intensity, g: c[1] * intensity, b: c[2] * intensity, radius, flicker });
  }

  cone(x: number, y: number, z: number, dx: number, dy: number, dz: number, len: number, radius: number, color: RGB, intensity: number, flicker?: number) {
    this.cones.push({ x, y, z, dx, dy, dz, len, radius, color, intensity, flicker });
  }

  emitSteam(x: number, y: number, z: number, size: number, rise: number, n: number, tint: RGB) {
    this.steam.push({ x, y, z, size, rise, n, tint });
  }

  /** Tableaux de tous les chunks non vides. */
  chunkArrays(): { detail: boolean; geo: GeoArrays }[] {
    const out: { detail: boolean; geo: GeoArrays }[] = [];
    for (const a of this.opaque.values()) if (a.verts) out.push({ detail: false, geo: a.arrays() });
    for (const a of this.detail.values()) if (a.verts) out.push({ detail: true, geo: a.arrays() });
    return out;
  }
}
