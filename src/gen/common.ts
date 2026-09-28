// Contexte de génération d'un niveau : monde, hasard, listes de décor, outils polaires et panneaux.
import { PAL, STYLE, V, floorY, hex, type RGB } from '../config';
import { RNG } from '../rng';
import { World, type BoxOpts, type ShapeOpts } from '../world/builder';
import { GLYPH, GLYPH_H, GLYPH_W, PLATE } from '../world/decalTiles';
import type { DecalDef, Dest, Era, Interior, Mover, PedDefs, PedKind, ScreenDef, Zone } from '../world/types';
import type { Rect } from '../world/geom';
import type { LevelInfo } from '../world/levels';
import { orect, ring, type Shape } from '../world/voxel2d';

export const TAU = Math.PI * 2;
export const deg = (d: number) => (d * Math.PI) / 180;
export const polar = (r: number, a: number): [number, number] => [r * Math.cos(a), r * Math.sin(a)];
/** Orientation d'un habitant (convention des passants : yaw = atan2(dx, dz)) regardant dans la direction (dx, dz). */
export const yawTo = (dx: number, dz: number) => Math.atan2(dx, dz);
/** Orientation caméra (joueur) regardant dans la direction (dx, dz). */
export const camYaw = (dx: number, dz: number) => Math.atan2(-dx, -dz);

export interface GenOpts {
  era: Era;
  /** 0 : détail complet (niveaux proches) · 1 : coque moyenne · 2 : coque lointaine. */
  lod: 0 | 1 | 2;
  seed: number;
}

export class Gen {
  w: World;
  rng: RNG;
  F: number;
  decals: DecalDef[] = [];
  peds: PedDefs = { paths: [], idle: [] };
  zones: Zone[] = [];
  dests: Dest[] = [];
  interiors: Interior[] = [];
  screens: ScreenDef[] = [];
  movers: Mover[] = [];
  grates: { r: Rect; y: number }[] = [];
  /** Résolution des formes courbes (plus grossière au loin). */
  res: number;
  detailOk: boolean;
  info?: LevelInfo;
  /** Percements du mur d'enceinte (angle, demi-largeur, hauteurs relatives au plancher). */
  wallCuts: { a: number; hw: number; y0: number; y1: number }[] = [];
  /** Sas du niveau 1 (axe, rayons des portes, plancher, demi-largeur). */
  airlock?: { a: number; rIn: number; rOut: number; y: number; hw: number };
  /** Portes interactives. */
  doors: { x: number; y: number; z: number; ax: 'x' | 'z'; w: number; h: number; name: string; kind: string }[] = [];
  /** Lueurs diffuses (générateur, fonderie…). */
  glows: { x: number; y: number; z: number; r: number; color: RGB }[] = [];

  constructor(public n: number, public o: GenOpts) {
    this.w = new World();
    this.rng = new RNG(o.seed ^ Math.imul(n + 7, 0x9e3779b1));
    this.F = floorY(n);
    this.res = o.lod === 0 ? V : o.lod === 1 ? 0.2 : 0.5;
    this.detailOk = o.lod === 0;
  }

  get era() { return this.o.era; }
  S() { return this.rng.byte(); }
  pick<T>(a: readonly T[]): T { return this.rng.pick(a); }
  concrete(): RGB { return this.rng.pick(PAL.concrete); }

  // --- géométrie ---------------------------------------------------------------
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, o: BoxOpts) { this.w.box(x0, y0, z0, x1, y1, z1, o); }
  shape(s: Shape, y0: number, y1: number, o: ShapeOpts) { this.w.shape(s, y0, y1, { res: this.res, ...o }); }
  /** Secteur d'anneau (angles en radians, a0 → a0 + span dans le sens trigonométrique). */
  sector(r0: number, r1: number, a0: number, span: number, y0: number, y1: number, o: ShapeOpts) {
    this.shape(ring(0, 0, r0, r1, a0, span), y0, y1, { smooth: { cx: 0, cz: 0, r0, r1, tol: Math.min(0.3, (r1 - r0) / 2 + 0.05) }, ...o });
  }
  /** Anneau complet (ou disque si r0 = 0) centré en (cx, cz), normales lissées. */
  ring(cx: number, cz: number, r0: number, r1: number, y0: number, y1: number, o: ShapeOpts) {
    this.shape(ring(cx, cz, r0, r1), y0, y1, { smooth: { cx, cz, r0, r1, tol: Math.min(0.3, (r1 - r0) / 2 + 0.05) }, ...o });
  }
  /** Normales lissées pour une forme composite autour de l'axe. */
  smooth(r0: number, r1: number) { return { cx: 0, cz: 0, r0, r1, tol: Math.min(0.3, (r1 - r0) / 2 + 0.05) }; }
  /** Rectangle orienté posé au sol : centre (x, z), angle, dimensions (longueur × largeur). */
  obox(x: number, z: number, ang: number, len: number, wid: number, y0: number, y1: number, o: ShapeOpts) {
    const snapped = Math.abs(Math.sin(2 * ang)) < 0.02;
    if (snapped) {
      const along = Math.abs(Math.cos(ang)) > 0.5;
      const hx = (along ? len : wid) / 2, hz = (along ? wid : len) / 2;
      this.w.box(x - hx, y0, z - hz, x + hx, y1, z + hz, o);
    } else this.shape(orect(x, z, ang, len / 2, wid / 2), y0, y1, { res: V, ...o });
  }
  /** Collision seule. */
  wall(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { this.w.wall(x0, y0, z0, x1, y1, z1); }
  light(x: number, y: number, z: number, c: RGB, k: number, r: number, flicker?: number) {
    if (this.detailOk) this.w.light(x, y, z, c, k, r, flicker);
  }

  // --- personnages ---------------------------------------------------------------
  idle(x: number, y: number, z: number, yaw: number, pose = 0, kind?: PedKind) {
    if (this.detailOk) this.peds.idle.push({ x, y, z, yaw, pose, kind });
  }
  path(pts: [number, number, number][], closed: boolean, count: number, kinds?: PedKind[], pause?: number) {
    if (this.detailOk && count > 0) this.peds.paths.push({ pts, closed, count, kinds, pause });
  }

  // --- repères -------------------------------------------------------------------
  zone(name: string, x: number, z: number, r: number, y0 = this.F - 0.5, y1 = this.F + 5.4) { this.zones.push({ name, x, z, r, y0, y1 }); }
  dest(name: string, x: number, y: number, z: number, yaw: number) { this.dests.push({ name, x, y, z, yaw, level: this.n }); }

  // --- motifs plaqués ------------------------------------------------------------
  decal(x: number, y: number, z: number, nx: number, nz: number, tile: number, w: number, h: number, o: { glow?: number; wear?: number; tint?: RGB; up?: boolean } = {}) {
    if (this.o.lod === 2) return;
    this.decals.push({ x, y, z, nx, nz, w, h, tile, glow: o.glow ?? 0, wear: o.wear ?? 0, tint: o.tint, up: o.up });
  }

  /**
   * Texte au pochoir centré en (x, y, z), sur un plan de normale (nx, nz).
   * h : hauteur des lettres. plate : couleur de plaque de fond (clé de PLATE) ou aucune.
   */
  text(s: string, x: number, y: number, z: number, nx: number, nz: number, h: number, o: { tint?: RGB; plate?: keyof typeof PLATE; plateTint?: RGB; glow?: number; wear?: number; margin?: number; lift?: number } = {}) {
    if (this.o.lod === 2) return;
    const up = s.toUpperCase();
    const cw = ((h * GLYPH_W) / GLYPH_H) * 0.92;
    const W = up.length * cw;
    const nl = Math.hypot(nx, nz) || 1;
    const ux = nx / nl, uz = nz / nl;
    const rx = uz, rz = -ux;       // « droite » pour un observateur face au texte
    const lift = o.lift ?? 0.004;
    if (o.plate) {
      const m = o.margin ?? h * 0.35;
      this.decals.push({ x, y, z, nx, nz, w: W + m * 2, h: h + m * 2, tile: PLATE[o.plate], glow: 0, wear: o.wear ?? 0.1, tint: o.plateTint });
    }
    for (let i = 0; i < up.length; i++) {
      const t = GLYPH[up[i]];
      if (t === undefined) continue;
      const a = -W / 2 + (i + 0.5) * cw;
      this.decals.push({ x: x + rx * a + ux * lift, y, z: z + rz * a + uz * lift, nx, nz, w: cw * 1.05, h, tile: t, glow: o.glow ?? 0, wear: o.wear ?? 0.15, tint: o.tint ?? hex(0xe8e0cc) });
    }
  }

  /** Texte posé sur une paroi circulaire de rayon r, à l'angle a, lu depuis l'axe (normale vers le centre). */
  textOnRing(s: string, r: number, a: number, y: number, h: number, o: Parameters<Gen['text']>[7] = {}, facingOut = false) {
    const [x, z] = polar(r, a);
    const k = facingOut ? 1 : -1;
    this.text(s, x, y, z, Math.cos(a) * k, Math.sin(a) * k, h, o);
  }

  // --- éléments courants ---------------------------------------------------------
  /** Lampe capsule (verre blanc cerclé de bagues sombres), verticale, centrée en (x, z). */
  capsule(x: number, z: number, y0: number, h: number, r = 0.22, glow = 3.2, light = true) {
    const col = PAL.lamp;
    this.box(x - r, y0, z - r, x + r, y0 + h, z + r, { color: col, style: STYLE.EMISSIVE, emis: glow, detail: this.detailOk, solid: false });
    for (const f of [0.02, 0.5, 0.98]) {
      const yy = y0 + h * f;
      this.box(x - r - 0.03, yy - 0.04, z - r - 0.03, x + r + 0.03, yy + 0.04, z + r + 0.03, { color: hex(0x2a2826), style: STYLE.BRASS, detail: this.detailOk, solid: false });
    }
    if (light) this.light(x, y0 + h / 2, z, col, 1.5, 11);
  }

  /** Panneau de fond + texte sur une paroi droite (normale nx, nz). */
  sign(s: string, x: number, y: number, z: number, nx: number, nz: number, h = 0.22, plate: keyof typeof PLATE = 'dark', tint?: RGB) {
    this.text(s, x, y, z, nx, nz, h, { plate, tint: tint ?? (plate === 'cream' || plate === 'yellow' || plate === 'white' ? hex(0x1c1a18) : hex(0xe8e0cc)), wear: 0.05 });
  }
}

export const DETAIL = (g: Gen) => ({ detail: g.detailOk, solid: false });
