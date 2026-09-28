// Habitants du silo : silhouettes voxel animées dans le shader, marcheurs sur des tracés 3D
// (coursives, couloirs, volées d'escalier) et figurants immobiles.
import * as THREE from 'three';
import { STYLE, hex, type RGB } from './config';
import { RNG } from './rng';
import { Accum } from './world/builder';
import type { Collider } from './physics';
import type { PedDefs, PedKind } from './world/types';
import { makeGeometry } from './render/geo';

const HIP = 0.85, SHOULDER = 1.4;

class PedBuilder {
  a = new Accum();
  parts: number[] = [];
  box(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, c: RGB, part: number, style: number = STYLE.FLESH, emis = 0, extra = 0, pivot = -1) {
    const before = this.a.verts;
    this.a.addBox(x0, y0, z0, x1, y1, z1, c, style, 3, emis, extra);
    const pv = pivot >= 0 ? pivot : part === 1 || part === 2 ? HIP : part === 3 || part === 4 ? SHOULDER : 0;
    for (let i = before; i < this.a.verts; i++) this.parts.push(part, pv);
  }
  build() {
    const g = makeGeometry(this.a.arrays());
    g.setAttribute('aPart', new THREE.BufferAttribute(new Float32Array(this.parts), 2));
    return g;
  }
}

const SKIN = [hex(0xc09070), hex(0x8a5a40), hex(0xd8b090), hex(0x6a4430), hex(0xb08060)];
const W: RGB = [1, 1, 1];            // teinté par instanceColor (extra = 1)
const SHOE = hex(0x1e1a16);
const F = STYLE.FLESH;

function legsArms(b: PedBuilder, pants: RGB, sleeve: RGB, hand: RGB, k = 1) {
  const pe = pants === W ? 1 : 0, se = sleeve === W ? 1 : 0;
  b.box(-0.18 * k, 0, -0.09 * k, -0.03 * k, 0.85, 0.09 * k, pants, 1, F, 0, pe);
  b.box(-0.19 * k, 0, -0.1 * k, -0.02 * k, 0.12, 0.14 * k, SHOE, 1);
  b.box(0.03 * k, 0, -0.09 * k, 0.18 * k, 0.85, 0.09 * k, pants, 2, F, 0, pe);
  b.box(0.02 * k, 0, -0.1 * k, 0.19 * k, 0.12, 0.14 * k, SHOE, 2);
  b.box(-0.33 * k, 0.82, -0.07 * k, -0.23 * k, 1.42, 0.07 * k, sleeve, 3, F, 0, se);
  b.box(-0.32 * k, 0.74, -0.06 * k, -0.24 * k, 0.83, 0.06 * k, hand, 3);
  b.box(0.23 * k, 0.82, -0.07 * k, 0.33 * k, 1.42, 0.07 * k, sleeve, 4, F, 0, se);
  b.box(0.24 * k, 0.74, -0.06 * k, 0.32 * k, 0.83, 0.06 * k, hand, 4);
}
function head(b: PedBuilder, skin: RGB, hair: RGB, style: 'short' | 'long' | 'bun' | 'bald' = 'short') {
  b.box(-0.11, 1.47, -0.11, 0.11, 1.7, 0.11, skin, 0);
  if (style === 'bald') return;
  b.box(-0.12, 1.64, -0.12, 0.12, 1.73, 0.12, hair, 0);
  b.box(-0.12, 1.5, -0.13, 0.12, 1.66, -0.1, hair, 0);
  if (style === 'long') b.box(-0.12, 1.3, -0.14, 0.12, 1.66, -0.08, hair, 0);
  if (style === 'bun') b.box(-0.06, 1.66, -0.17, 0.06, 1.78, -0.07, hair, 0);
}
/** Caisse portée à deux mains (posture 12). */
function cargo(b: PedBuilder) {
  b.box(-0.22, 0.9, 0.18, 0.22, 1.2, 0.5, hex(0x5a4a34), 6, STYLE.WOOD, 0, 0);
}

function variants(): THREE.BufferGeometry[] {
  const out: THREE.BufferGeometry[] = [];
  const hair = [hex(0x2a1e16), hex(0x5a3a22), hex(0x1a1614), hex(0x8a6a44), hex(0x6a6660)];
  // 0 : habitant (chemise teintée, gilet tricoté, pantalon de toile)
  {
    const b = new PedBuilder();
    legsArms(b, hex(0x3a3830), W, SKIN[0]);
    b.box(-0.23, 0.8, -0.12, 0.23, 1.45, 0.12, W, 0, F, 0, 1);
    b.box(-0.24, 0.84, -0.13, 0.24, 1.3, 0.13, hex(0x6a5a44), 0, STYLE.CLOTH);        // gilet
    b.box(-0.24, 0.84, -0.02, -0.02, 1.3, 0.135, W, 0, F, 0, 1);
    head(b, SKIN[0], hair[0]);
    cargo(b);
    out.push(b.build());
  }
  // 1 : habitante (robe longue, cheveux longs, sacoche)
  {
    const b = new PedBuilder();
    legsArms(b, hex(0x2a2622), W, SKIN[2]);
    b.box(-0.25, 0.2, -0.15, 0.25, 0.85, 0.15, W, 0, F, 0, 1);
    b.box(-0.22, 0.8, -0.12, 0.22, 1.45, 0.12, W, 0, F, 0, 1);
    b.box(-0.23, 1.02, -0.13, 0.23, 1.07, 0.13, hex(0x4a3a2a), 0);
    head(b, SKIN[2], hair[1], 'long');
    b.box(0.22, 0.85, -0.05, 0.3, 1.1, 0.12, hex(0x6a4a30), 0, STYLE.CLOTH);          // sacoche
    b.box(0.05, 0.68, 0.02, 0.33, 0.8, 0.12, hex(0xd8d0bc), 5);                         // papier
    cargo(b);
    out.push(b.build());
  }
  // 2 : adjoint du shérif (veste marron, étoile, ceinturon)
  {
    const b = new PedBuilder();
    const jacket = hex(0x5a4430);
    legsArms(b, hex(0x2e2c2a), jacket, SKIN[4]);
    b.box(-0.24, 0.8, -0.13, 0.24, 1.46, 0.13, jacket, 0, STYLE.CLOTH);
    b.box(-0.25, 0.86, -0.14, 0.25, 0.94, 0.14, hex(0x1e1a16), 0);
    b.box(0.08, 1.22, 0.13, 0.15, 1.3, 0.145, hex(0xd8b040), 0, STYLE.BRASS);           // insigne
    b.box(0.2, 0.8, -0.04, 0.27, 0.95, 0.06, hex(0x1a1a1a), 0);                         // étui
    head(b, SKIN[4], hair[2]);
    out.push(b.build());
  }
  // 3 : agent du Judiciaire (costume sombre, cravate)
  {
    const b = new PedBuilder();
    const suit = hex(0x22262a);
    legsArms(b, suit, suit, SKIN[1]);
    b.box(-0.24, 0.8, -0.13, 0.24, 1.46, 0.13, suit, 0, STYLE.CLOTH);
    b.box(-0.06, 1.1, 0.13, 0.06, 1.44, 0.14, hex(0xd8d4c8), 0);
    b.box(-0.025, 1.12, 0.14, 0.025, 1.42, 0.15, hex(0x3a1a1a), 0);
    head(b, SKIN[1], hair[2]);
    out.push(b.build());
  }
  // 4 : porteur (casquette, cadre de portage chargé sur le dos)
  {
    const b = new PedBuilder();
    legsArms(b, hex(0x3a3428), W, SKIN[3]);
    b.box(-0.23, 0.8, -0.12, 0.23, 1.45, 0.12, W, 0, F, 0, 1);
    head(b, SKIN[3], hair[0]);
    b.box(-0.13, 1.66, -0.13, 0.13, 1.76, 0.13, hex(0x3a3228), 0);
    b.box(-0.13, 1.66, 0.12, 0.13, 1.7, 0.2, hex(0x3a3228), 0);
    b.box(-0.24, 0.7, -0.19, -0.2, 1.75, -0.15, hex(0x4a3a28), 0, STYLE.WOOD);          // cadre
    b.box(0.2, 0.7, -0.19, 0.24, 1.75, -0.15, hex(0x4a3a28), 0, STYLE.WOOD);
    b.box(-0.27, 0.9, -0.58, 0.27, 1.7, -0.19, hex(0x6a5a3e), 0, STYLE.CLOTH);          // charge
    b.box(-0.24, 1.7, -0.5, 0.24, 1.9, -0.22, hex(0x5a4a34), 0, STYLE.WOOD);
    out.push(b.build());
  }
  // 5 : mécanicien (combinaison, casquette, ceinture à outils)
  {
    const b = new PedBuilder();
    legsArms(b, W, W, SKIN[3]);
    b.box(-0.24, 0.8, -0.13, 0.24, 1.46, 0.13, W, 0, F, 0, 1);
    b.box(-0.25, 0.84, -0.14, 0.25, 0.94, 0.14, hex(0x3a2e22), 0);
    b.box(-0.2, 0.7, 0.1, -0.08, 0.9, 0.18, hex(0x6a6e70), 0, STYLE.BRASS);             // outils
    head(b, SKIN[3], hair[3], 'short');
    b.box(-0.13, 1.65, -0.13, 0.13, 1.74, 0.13, W, 0, F, 0, 1);
    b.box(0.1, 0.62, 0.02, 0.3, 0.76, 0.1, hex(0x8a8a86), 5, STYLE.BRASS);              // clé
    cargo(b);
    out.push(b.build());
  }
  // 6 : employé de l'IT (costume clair, cravate, dossier)
  {
    const b = new PedBuilder();
    const suit = hex(0x4a4e52);
    legsArms(b, suit, suit, SKIN[2]);
    b.box(-0.23, 0.8, -0.12, 0.23, 1.46, 0.12, suit, 0, STYLE.CLOTH);
    b.box(-0.06, 1.1, 0.12, 0.06, 1.44, 0.13, hex(0xe0e4e0), 0);
    b.box(-0.025, 1.12, 0.13, 0.025, 1.42, 0.14, W, 0, F, 0, 2);
    head(b, SKIN[2], hair[4]);
    b.box(0.05, 0.68, 0.02, 0.33, 0.8, 0.12, hex(0xb8a070), 5);
    out.push(b.build());
  }
  // 7 : enfant
  {
    const b = new PedBuilder();
    const k = 0.72;
    b.box(-0.13, 0, -0.07, -0.02, 0.55, 0.07, hex(0x3a3830), 1, F, 0, 0, 0.55);
    b.box(0.02, 0, -0.07, 0.13, 0.55, 0.07, hex(0x3a3830), 2, F, 0, 0, 0.55);
    b.box(-0.17, 0.52, -0.1, 0.17, 1.0, 0.1, W, 0, F, 0, 1);
    b.box(-0.24, 0.6, -0.05, -0.17, 0.98, 0.05, W, 3, F, 0, 1, 0.98);
    b.box(0.17, 0.6, -0.05, 0.24, 0.98, 0.05, W, 4, F, 0, 1, 0.98);
    b.box(-0.1, 1.0, -0.1, 0.1, 1.22, 0.1, SKIN[0], 0);
    b.box(-0.11, 1.15, -0.11, 0.11, 1.25, 0.11, hair[1], 0);
    void k;
    out.push(b.build());
  }
  // 8 : fermier (salopette, chapeau)
  {
    const b = new PedBuilder();
    legsArms(b, W, hex(0x8a7a5a), SKIN[4]);
    b.box(-0.23, 0.8, -0.12, 0.23, 1.45, 0.12, hex(0x8a7a5a), 0, STYLE.CLOTH);
    b.box(-0.2, 0.8, 0.1, 0.2, 1.3, 0.14, W, 0, F, 0, 1);
    head(b, SKIN[4], hair[3]);
    b.box(-0.2, 1.68, -0.2, 0.2, 1.71, 0.2, hex(0xb89a58), 0, STYLE.CLOTH);
    b.box(-0.12, 1.71, -0.12, 0.12, 1.82, 0.12, hex(0xb89a58), 0, STYLE.CLOTH);
    cargo(b);
    out.push(b.build());
  }
  // 9 : soignant (blouse blanche)
  {
    const b = new PedBuilder();
    legsArms(b, hex(0x3a4a5a), hex(0xe0e0d8), SKIN[1]);
    b.box(-0.25, 0.45, -0.14, 0.25, 1.46, 0.14, hex(0xe0e0d8), 0, STYLE.CLOTH);
    head(b, SKIN[1], hair[1], 'bun');
    b.box(0.05, 0.68, 0.02, 0.33, 0.8, 0.12, hex(0xd8d0bc), 5);
    out.push(b.build());
  }
  // 10 : ancien (voûté, cardigan, canne)
  {
    const b = new PedBuilder();
    legsArms(b, hex(0x3a3834), W, SKIN[2]);
    b.box(-0.23, 0.78, -0.16, 0.23, 1.38, 0.1, W, 0, F, 0, 1);
    b.box(-0.11, 1.36, -0.02, 0.11, 1.58, 0.2, SKIN[2], 0);
    b.box(-0.12, 1.52, -0.02, 0.12, 1.6, 0.2, hex(0xb0aca4), 0);
    b.box(0.3, 0.0, 0.08, 0.33, 0.8, 0.11, hex(0x3a2a1c), 4, STYLE.WOOD);
    out.push(b.build());
  }
  // 11 : raider (tenue noire, casque, masque)
  {
    const b = new PedBuilder();
    const blk = hex(0x16181a);
    legsArms(b, blk, blk, hex(0x121212));
    b.box(-0.25, 0.8, -0.15, 0.25, 1.46, 0.15, blk, 0, STYLE.BRASS);
    b.box(-0.13, 1.46, -0.13, 0.13, 1.8, 0.13, blk, 0, STYLE.BRASS);
    b.box(-0.1, 1.55, 0.12, 0.1, 1.64, 0.14, hex(0x3a4a50), 0, STYLE.BRASS);
    b.box(0.26, 0.6, 0.0, 0.31, 1.1, 0.35, hex(0x0a0a0a), 4, STYLE.SOLID);
    out.push(b.build());
  }
  return out;
}

export const PALETTES: Record<PedKind, number[]> = {
  resident: [0x7a6a50, 0x5a6a70, 0x8a5a44, 0x6a7a5a, 0x9a8a6a, 0x4a5a6a, 0xa09078, 0x6a4a4a, 0x7a7a6a],
  porter: [0x6a5a3e, 0x5a5a4a, 0x4a4a3a, 0x7a6a4a],
  deputy: [0x5a4430],
  judicial: [0x22262a],
  mechanic: [0x6a4a2a, 0x5a5040, 0x4a4438, 0x7a5a3a, 0x3a4040],
  it: [0x4a4e52],
  child: [0x9a5a44, 0x5a7a8a, 0x8a8a5a, 0x7a5a7a, 0x6a8a6a],
  farmer: [0x4a5a6a, 0x5a5a4a, 0x6a5a44],
  medic: [0xe0e0d8],
  elder: [0x7a6a5a, 0x5a5a6a, 0x6a5a4a],
  raider: [0x16181a],
};
const VARIANT: Record<PedKind, number[]> = { resident: [0, 1, 0, 1], porter: [4], deputy: [2], judicial: [3], mechanic: [5], it: [6], child: [7], farmer: [8], medic: [9], elder: [10], raider: [11] };
const NV = 12;

interface Path { pts: [number, number, number][]; cum: number[]; len: number; closed: boolean }
interface Body { v: number; col: number; ph: number; tint: number; scale: number; x: number; y: number; z: number; yaw: number; pose: number; walk: number }
interface Walker extends Body { path: Path; s: number; dir: 1 | -1; speed: number; off: number; pauseMean: number; next: number; hold: number; turn: number; look: number }
interface Idle extends Body { yaw0: number; ph2: number; turns: boolean }

const SEATED = (p: number) => p === 1 || p === 8;
const TURNS = (p: number) => p === 0 || p === 2 || p === 5 || p === 10;
const CHECKED = (p: number) => p === 0 || p === 2 || p === 5 || p === 10 || p === 12;
const VIS = 70;

let GEOS: THREE.BufferGeometry[] | null = null;

export class Pedestrians {
  group = new THREE.Group();
  private meshes: THREE.InstancedMesh[] = [];
  private inst: THREE.InstancedBufferAttribute[] = [];
  private walkers: Walker[] = [];
  private idles: Idle[] = [];
  private rng: RNG;
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private p = new THREE.Vector3();
  private sc = new THREE.Vector3();
  private c = new THREE.Color();
  private up = new THREE.Vector3(0, 1, 0);
  private cap: number[] = [];
  /** Facteur d'affluence (nuit : moins de monde dehors). */
  density = 1;

  constructor(defs: PedDefs, mat: THREE.Material, seed: number, col: Collider) {
    const rng = (this.rng = new RNG(seed ^ 0x2545f491));
    if (!GEOS) GEOS = variants();
    const counts = new Array(NV).fill(0);
    const body = (kind: PedKind, pose: number): Body => {
      const v = rng.pick(VARIANT[kind]);
      counts[v]++;
      return { v, col: rng.pick(PALETTES[kind]), ph: rng.next(), tint: rng.next(), scale: kind === 'child' ? rng.range(0.85, 1.1) : rng.range(0.93, 1.07), x: 0, y: 0, z: 0, yaw: 0, pose, walk: 0 };
    };
    const defKinds: PedKind[] = ['resident', 'resident', 'porter', 'child', 'elder'];
    const pick = (kinds?: PedKind[]) => rng.pick(kinds && kinds.length ? kinds : defKinds);

    for (const d of defs.idle) {
      const pose = d.pose ?? 0;
      if (CHECKED(pose) && col.hit(d.x - 0.2, d.y + 0.4, d.z - 0.2, d.x + 0.2, d.y + 1.7, d.z + 0.2)) continue;
      const kind = d.kind ?? pick();
      const b = body(kind, pose);
      b.x = d.x; b.y = SEATED(pose) ? d.y - 0.3 : d.y; b.z = d.z; b.yaw = d.yaw;
      this.idles.push({ ...b, yaw0: d.yaw, ph2: rng.range(0, 100), turns: TURNS(pose) });
    }
    for (const p of defs.paths) {
      const path = mkPath(p.pts, p.closed);
      if (path.len < 1) continue;
      for (let k = 0; k < p.count; k++) {
        const kind = pick(p.kinds);
        const carrying = kind !== 'porter' && kind !== 'child' && rng.chance(0.08);
        const b = body(kind, carrying ? 12 : 0);
        const off = rng.pick([0, -0.45, 0.45, -0.8, 0.8]);
        this.walkers.push({
          ...b, path, s: rng.range(0, path.len * (path.closed ? 1 : 2)), dir: rng.chance(0.5) ? 1 : -1,
          speed: kind === 'child' ? rng.range(1.1, 1.6) : kind === 'elder' ? rng.range(0.5, 0.75) : kind === 'porter' ? rng.range(0.9, 1.25) : rng.range(0.85, 1.35),
          off, pauseMean: p.pause ?? 0, next: (p.pause ?? 0) * rng.range(0.2, 1.5), hold: 0, turn: 0, look: 0,
        });
      }
    }
    GEOS.forEach((g, v) => {
      const n = Math.max(1, counts[v]);
      this.cap.push(n);
      const geo = g.clone();
      const mesh = new THREE.InstancedMesh(geo, mat, n);
      const attr = new THREE.InstancedBufferAttribute(new Float32Array(n * 4), 4);
      attr.setUsage(THREE.DynamicDrawUsage);
      geo.setAttribute('aInst', attr);
      mesh.setColorAt(0, this.c.setHex(0x444444));
      mesh.instanceColor!.setUsage(THREE.DynamicDrawUsage);
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      mesh.frustumCulled = false;
      this.meshes.push(mesh);
      this.inst.push(attr);
      this.group.add(mesh);
    });
  }

  get total() { return this.walkers.length + this.idles.length; }

  dispose() {
    for (const m of this.meshes) { m.geometry.dispose(); m.dispose(); }
  }

  crowdNear(p: THREE.Vector3, r: number): number {
    let n = 0;
    const r2 = r * r;
    for (const w of this.walkers) { const dx = w.x - p.x, dy = w.y - p.y, dz = w.z - p.z; if (dx * dx + dy * dy + dz * dz < r2) n++; }
    for (const s of this.idles) { const dx = s.x - p.x, dy = s.y - p.y, dz = s.z - p.z; if (dx * dx + dy * dy + dz * dz < r2) n += 0.6; }
    return n;
  }

  update(dt: number, player: THREE.Vector3, t: number, cam: THREE.Vector3) {
    const rng = this.rng;
    const nW = Math.round(this.walkers.length * this.density);
    for (let wi = 0; wi < this.walkers.length; wi++) {
      const w = this.walkers[wi];
      const P = w.path;
      if (wi >= nW) { w.walk = -1; continue; }
      let d: number, back = false;
      if (P.closed) d = ((w.s % P.len) + P.len) % P.len;
      else {
        const q = ((w.s % (2 * P.len)) + 2 * P.len) % (2 * P.len);
        back = q >= P.len;
        d = back ? 2 * P.len - q : q;
      }
      const r = posAt(P, d, w.off);
      w.x = r[0]; w.y = r[1]; w.z = r[2];
      const sgn = (back ? -1 : 1) * w.dir;
      const hx = r[3] * sgn, hz = r[4] * sgn;
      const px = player.x - w.x, pz = player.z - w.z;
      const ahead = px * hx + pz * hz;
      const blocked = Math.abs(player.y - w.y) < 1.2 && ahead > 0 && ahead < 1.3 && Math.abs(px * hz - pz * hx) < 0.6;
      if (w.pauseMean > 0) {
        if (w.hold > 0) {
          w.hold -= dt;
          if (w.hold <= 0) { w.next = w.pauseMean * rng.range(0.5, 1.5); if (rng.chance(0.3)) w.dir = w.dir > 0 ? -1 : 1; }
        } else if ((w.next -= dt) <= 0) {
          w.hold = rng.range(2, 6);
          w.turn = (rng.chance(0.5) ? 1 : -1) * rng.range(1.2, 1.8);
        }
      }
      const holding = w.hold > 0;
      w.walk = !blocked && !holding ? 1 : 0;
      if (w.walk) w.s += w.dir * w.speed * dt;
      w.look += ((holding ? w.turn : 0) - w.look) * Math.min(1, dt * 3);
      w.yaw = Math.atan2(hx, hz) + w.look;
    }
    for (const s of this.idles) {
      if (!s.turns) continue;
      const dx = player.x - s.x, dz = player.z - s.z, dy = player.y - s.y;
      const d2 = dx * dx + dz * dz;
      if (d2 > 30 * 30 || Math.abs(dy) > 4) continue;
      const sway = 0.3 * Math.sin(t * 0.21 + s.ph2) + 0.18 * Math.sin(t * 0.57 + s.ph2 * 3);
      let target = s.yaw0 + sway;
      if (d2 < 12) {
        let dd = Math.atan2(dx, dz) - target;
        dd = Math.atan2(Math.sin(dd), Math.cos(dd));
        target += dd * (1 - Math.sqrt(d2) / 3.5);
      }
      let delta = target - s.yaw;
      delta = Math.atan2(Math.sin(delta), Math.cos(delta));
      s.yaw += delta * Math.min(1, dt * 2.5);
    }
    const n = new Array(NV).fill(0);
    const vis2 = VIS * VIS;
    const put = (b: Body) => {
      if (b.walk < 0) return;
      const dx = b.x - cam.x, dy = b.y - cam.y, dz = b.z - cam.z;
      if (dx * dx + dy * dy + dz * dz > vis2) return;
      const v = b.v, i = n[v]++;
      if (i >= this.cap[v]) return;
      this.q.setFromAxisAngle(this.up, b.yaw);
      this.m.compose(this.p.set(b.x, b.y, b.z), this.q, this.sc.setScalar(b.scale));
      this.meshes[v].setMatrixAt(i, this.m);
      this.meshes[v].setColorAt(i, this.c.setHex(b.col));
      this.inst[v].setXYZW(i, b.ph, b.walk, b.tint, b.pose);
    };
    for (const w of this.walkers) put(w);
    for (const s of this.idles) put(s);
    this.meshes.forEach((m, v) => {
      m.count = Math.min(n[v], this.cap[v]);
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
      this.inst[v].needsUpdate = true;
    });
  }
}

function mkPath(pts: [number, number, number][], closed: boolean): Path {
  const cum = [0];
  const n = closed ? pts.length : pts.length - 1;
  for (let k = 0; k < n; k++) {
    const a = pts[k], b = pts[(k + 1) % pts.length];
    cum.push(cum[k] + Math.hypot(b[0] - a[0], b[2] - a[2]));
  }
  return { pts, cum, len: cum[cum.length - 1], closed };
}

/** Position (x, y, z) à l'abscisse d, décalée latéralement de off, et direction horizontale du tracé. */
function posAt(P: Path, d: number, off: number): [number, number, number, number, number] {
  let k = 0;
  while (k < P.cum.length - 2 && P.cum[k + 1] < d) k++;
  const a = P.pts[k], b = P.pts[(k + 1) % P.pts.length];
  const segLen = P.cum[k + 1] - P.cum[k] || 1;
  const u = Math.max(0, Math.min(1, (d - P.cum[k]) / segLen));
  const hx = (b[0] - a[0]) / segLen, hz = (b[2] - a[2]) / segLen;
  return [a[0] + (b[0] - a[0]) * u + hz * off, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u - hx * off, hx, hz];
}
