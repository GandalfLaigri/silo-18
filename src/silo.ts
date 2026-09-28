// Gestion du silo : niveaux proches générés en détail (workers), coques lointaines instanciées,
// collisions par tranches, lumières, habitants et motifs des niveaux chargés.
import * as THREE from 'three';
import { NLEV, floorY } from './config';
import { CollisionWorld, LayeredCollision } from './physics';
import { Pedestrians } from './pedestrians';
import { Props } from './props';
import { buildDecals } from './render/decals';
import { makeGeometry } from './render/geo';
import { LightPool } from './render/lightpool';
import { Steam } from './render/steam';
import type { LightSrc } from './world/builder';
import type { Dest, Era, Interior, LevelOut, Zone } from './world/types';
import { shellKey, type ShellKey } from './gen/level';
import type { GenRequest, GenResponse } from './gen/worker';

/** Hauteur (en niveaux) des tranches de coques lointaines instanciées. */
const FAR_BAND = 6;

export interface LevelInst {
  n: number;
  out: LevelOut;
  group: THREE.Group;
  details: THREE.Mesh[];
  peds: Pedestrians;
  steam: Steam | null;
  props: Props;
}

const SHELL_KEYS: ShellKey[] = ['haut', 'mids', 'basmids', 'bas', 'ferme', 'n1', 'n144', 'breche'];

export class Silo {
  group = new THREE.Group();
  levels = new Map<number, LevelInst>();
  col = new LayeredCollision();
  lights = new LightPool();
  private workers: Worker[] = [];
  private busy: boolean[] = [];
  private queue: GenRequest[] = [];
  private pending = new Map<number, (r: GenResponse) => void>();
  private requested = new Set<number>();
  private nextId = 1;
  private shells = new Map<string, THREE.BufferGeometry[]>();
  private farMeshes = new Map<string, THREE.InstancedMesh[]>();
  private farGroup = new THREE.Group();
  private lastFarKey = '';
  shellsReady = false;
  /** Niveaux chargés autour du niveau courant (rayon). */
  nearR = 3;
  farR1 = 14;
  farR2 = 48;
  center = 1;
  onLevelLoaded: ((l: LevelInst) => void) | null = null;
  stats = { genMs: 0, levels: 0 };

  constructor(private voxelMat: THREE.ShaderMaterial, private pedMat: THREE.ShaderMaterial, public era: Era, public seed: number) {
    const n = Math.max(2, Math.min(4, (navigator.hardwareConcurrency || 4) - 1));
    for (let i = 0; i < n; i++) {
      const w = new Worker(new URL('./gen/worker.ts', import.meta.url), { type: 'module' });
      w.onmessage = (e: MessageEvent<GenResponse>) => {
        this.busy[i] = false;
        const cb = this.pending.get(e.data.id);
        this.pending.delete(e.data.id);
        if (e.data.type === 'error') console.error('[silo] génération :', e.data.message);
        cb?.(e.data);
        this.pump();
      };
      this.workers.push(w);
      this.busy.push(false);
    }
    this.group.add(this.farGroup);
  }

  send(req: GenRequest extends infer T ? (T extends GenRequest ? Omit<T, 'id'> : never) : never, cb: (r: GenResponse) => void, urgent = false) {
    const r = { ...req, id: this.nextId++ } as GenRequest;
    this.pending.set(r.id, cb);
    if (urgent) this.queue.unshift(r); else this.queue.push(r);
    this.pump();
  }
  private pump() {
    for (let i = 0; i < this.workers.length && this.queue.length; i++) {
      if (this.busy[i]) continue;
      this.busy[i] = true;
      this.workers[i].postMessage(this.queue.shift());
    }
  }

  /** Coques lointaines (toutes les variantes, deux niveaux de détail). */
  loadShells(onProgress: (k: number, n: number) => void): Promise<void> {
    const jobs: Promise<void>[] = [];
    let done = 0;
    const total = SHELL_KEYS.length * 2;
    for (const key of SHELL_KEYS) for (const lod of [2, 1] as const) {
      jobs.push(new Promise((res) => {
        this.send({ type: 'shell', key, lod, era: this.era, seed: this.seed }, (r) => {
          if (r.type === 'shell') this.shells.set(r.out.key, r.out.chunks.map(makeGeometry));
          onProgress(++done, total);
          res();
        });
      }));
    }
    return Promise.all(jobs).then(() => { this.shellsReady = true; this.lastFarKey = ''; });
  }

  /** Demande les niveaux autour de c, libère les autres, met à jour les coques lointaines. */
  update(c: number) {
    c = Math.max(1, Math.min(NLEV, c));
    this.center = c;
    const want: number[] = [];
    for (let d = 0; d <= this.nearR; d++) for (const s of d ? [-1, 1] : [1]) { const n = c + s * d; if (n >= 1 && n <= NLEV) want.push(n); }
    for (const n of want) if (!this.levels.has(n) && !this.requested.has(n)) this.requestLevel(n, Math.abs(n - c) <= 1);
    for (const [n, l] of this.levels) if (Math.abs(n - c) > this.nearR + 2) this.unload(l);
    this.refreshFar();
  }

  private requestLevel(n: number, urgent: boolean) {
    this.requested.add(n);
    this.send({ type: 'level', n, era: this.era, seed: this.seed }, (r) => {
      this.requested.delete(n);
      if (r.type !== 'level') return;
      if (Math.abs(n - this.center) > this.nearR + 2) return; // devenu inutile
      this.install(r.out);
    }, urgent);
  }

  private install(out: LevelOut) {
    const group = new THREE.Group();
    const details: THREE.Mesh[] = [];
    for (const c of out.chunks) {
      const m = new THREE.Mesh(makeGeometry(c.geo), this.voxelMat);
      m.matrixAutoUpdate = false;
      group.add(m);
      if (c.detail) details.push(m);
    }
    const dec = buildDecals(out.decals);
    if (dec) group.add(dec);
    this.col.set(`L${out.level}`, CollisionWorld.from(out.colliders), out.y0 - 0.5, out.y1 + 0.5);
    const peds = new Pedestrians(out.peds, this.pedMat, this.seed ^ (out.level * 131), this.col);
    group.add(peds.group);
    const steam = out.steam.length ? new Steam(out.steam) : null;
    if (steam) group.add(steam.points);
    const props = new Props(out.movers, this.voxelMat, this.col);
    group.add(props.group);
    const inst: LevelInst = { n: out.level, out, group, details, peds, steam, props };
    this.levels.set(out.level, inst);
    this.group.add(group);
    this.rebuildLights();
    this.lastFarKey = '';
    this.refreshFar();
    this.stats.genMs = out.ms;
    this.stats.levels++;
    this.onLevelLoaded?.(inst);
  }

  private unload(l: LevelInst) {
    this.group.remove(l.group);
    l.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh && m.geometry) m.geometry.dispose(); });
    l.peds.dispose();
    l.steam?.dispose();
    l.props.dispose();
    this.col.remove(`L${l.n}`);
    this.levels.delete(l.n);
    this.rebuildLights();
    this.lastFarKey = '';
  }

  /** Lumières ajoutées hors génération (sas, surface). */
  extraLights: LightSrc[] = [];
  rebuildLights() {
    const all: LightSrc[] = [...this.extraLights];
    for (const l of this.levels.values()) all.push(...l.out.lights);
    this.lights = Object.assign(new LightPool(), { black: this.lights.black });
    this.lights.add(all);
  }

  /** Vue d'ensemble : tous les niveaux sont représentés. */
  overview = false;
  setOverview(on: boolean) { this.overview = on; this.lastFarKey = ''; this.refreshFar(); }

  /** Géométrie annexe (vue d'ensemble, fond du silo) générée par un worker. */
  requestShell(key: 'ov' | 'below', cb: (geos: THREE.BufferGeometry[]) => void) {
    this.send({ type: 'shell', key, lod: 2, era: this.era, seed: this.seed }, (r) => { if (r.type === 'shell') cb(r.out.chunks.map(makeGeometry)); });
  }

  /** Coques instanciées pour les niveaux non chargés, par distance au centre. */
  private refreshFar() {
    if (!this.shellsReady) return;
    const c = this.center;
    const loaded = [...this.levels.keys()].sort((a, b) => a - b).join(',');
    const key = `${c}|${loaded}|${this.overview}|${this.nearR}`;
    if (key === this.lastFarKey) return;
    this.lastFarKey = key;
    // les niveaux gardés en réserve (au-delà de nearR, avant déchargement) cèdent la place à leur coque
    for (const l of this.levels.values()) l.group.visible = this.overview || Math.abs(l.n - c) <= this.nearR;
    // répartition des niveaux par (coque, détail, tranche de FAR_BAND niveaux) : chaque tranche est
    // un maillage instancié à part, écarté par le frustum quand elle sort du champ
    const buckets = new Map<string, number[]>();
    const R2 = this.overview ? NLEV : this.farR2;
    for (let n = Math.max(1, c - R2); n <= Math.min(NLEV, c + R2); n++) {
      if (this.levels.get(n)?.group.visible) continue;
      const lod = Math.abs(n - c) <= this.farR1 ? 1 : 2;
      const k = `${shellKey(n, this.era)}:${lod}#${Math.floor((n - 1) / FAR_BAND)}`;
      let b = buckets.get(k);
      if (!b) buckets.set(k, (b = []));
      b.push(n);
    }
    for (const ms of this.farMeshes.values()) for (const im of ms) im.count = 0;
    const m = new THREE.Matrix4();
    const rot = new THREE.Matrix4().makeRotationY(Math.PI);
    for (const [k, list] of buckets) {
      const geos = this.shells.get(k.slice(0, k.indexOf('#')));
      if (!geos) continue;
      let meshes = this.farMeshes.get(k);
      if (!meshes) {
        meshes = geos.map((g) => {
          const im = new THREE.InstancedMesh(g, this.voxelMat, FAR_BAND);
          im.count = 0;
          this.farGroup.add(im);
          return im;
        });
        this.farMeshes.set(k, meshes);
      }
      for (const im of meshes) {
        list.forEach((n, i) => {
          m.makeTranslation(0, floorY(n), 0);
          if (n % 2 === 0) m.multiply(rot);
          im.setMatrixAt(i, m);
        });
        im.count = list.length;
        im.instanceMatrix.needsUpdate = true;
        im.computeBoundingSphere();
      }
    }
  }

  /** Détails fins : visibles près de la caméra seulement. */
  cullDetails(cam: THREE.Vector3, far: number) {
    for (const l of this.levels.values()) for (const m of l.details) {
      const s = m.geometry.boundingSphere!;
      m.visible = s.center.distanceTo(cam) - s.radius < far;
    }
  }

  tick(dt: number, player: THREE.Vector3, t: number, cam: THREE.Vector3, density: number) {
    for (const l of this.levels.values()) {
      l.props.update(dt);
      if (Math.abs(l.n - this.center) > 2) { l.peds.group.visible = false; continue; }
      l.peds.group.visible = true;
      l.peds.density = density;
      l.peds.update(dt, player, t, cam);
    }
    this.lights.update(cam);
  }

  get dests(): Dest[] { return [...this.levels.values()].flatMap((l) => l.out.dests); }
  get zones(): Zone[] { return [...this.levels.values()].flatMap((l) => l.out.zones); }
  get interiors(): Interior[] { return [...this.levels.values()].flatMap((l) => l.out.interiors); }
  isLoaded(n: number) { return this.levels.has(n); }

  crowdNear(p: THREE.Vector3, r: number) {
    let k = 0;
    for (const l of this.levels.values()) if (Math.abs(l.n - this.center) <= 1) k += l.peds.crowdNear(p, r);
    return k;
  }

  /** Change d'époque : tout est régénéré. */
  reset(era: Era) {
    this.era = era;
    for (const l of [...this.levels.values()]) this.unload(l);
    for (const ms of this.farMeshes.values()) for (const m of ms) { this.farGroup.remove(m); m.dispose(); }
    this.farMeshes.clear();
    for (const gs of this.shells.values()) for (const g of gs) g.dispose();
    this.shells.clear();
    this.shellsReady = false;
    this.requested.clear();
  }
}
