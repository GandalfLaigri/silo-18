// Monde de collision : boîtes statiques (hash spatial 2D) + boîtes dynamiques (cabines, portes).

export interface DynBox {
  min: [number, number, number];
  max: [number, number, number];
  enabled: boolean;
  dy: number; // déplacement vertical de la frame (plateformes mobiles)
}

export interface Hit {
  min: ArrayLike<number>;
  max: ArrayLike<number>;
  dyn: DynBox | null;
}

const CELL = 8;
const OFF = 1024;

export class CollisionWorld {
  private b = new Float32Array(6 * 4096);
  n = 0;
  private cells = new Map<number, number[]>();
  private stamp = new Int32Array(4096);
  private qid = 1;
  dyn: DynBox[] = [];

  private key(ix: number, iz: number) {
    return (ix + OFF) * 4096 + (iz + OFF);
  }

  add(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): number {
    if (this.n * 6 + 6 > this.b.length) {
      const nb = new Float32Array(this.b.length * 2);
      nb.set(this.b);
      this.b = nb;
      const ns = new Int32Array(this.stamp.length * 2);
      ns.set(this.stamp);
      this.stamp = ns;
    }
    const i = this.n++;
    const o = i * 6;
    this.b[o] = x0; this.b[o + 1] = y0; this.b[o + 2] = z0;
    this.b[o + 3] = x1; this.b[o + 4] = y1; this.b[o + 5] = z1;
    const cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL);
    const cz0 = Math.floor(z0 / CELL), cz1 = Math.floor(z1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const k = this.key(cx, cz);
        let l = this.cells.get(k);
        if (!l) this.cells.set(k, (l = []));
        l.push(i);
      }
    return i;
  }

  addDyn(): DynBox {
    const d: DynBox = { min: [0, 0, 0], max: [0, 0, 0], enabled: false, dy: 0 };
    this.dyn.push(d);
    return d;
  }

  /** Appelle cb pour chaque boîte (statique ou dynamique) intersectant l'AABB (strictement). */
  query(
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    cb: (min: ArrayLike<number>, max: ArrayLike<number>, dyn: DynBox | null) => void,
  ) {
    const q = ++this.qid;
    const b = this.b;
    const cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL);
    const cz0 = Math.floor(z0 / CELL), cz1 = Math.floor(z1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const l = this.cells.get(this.key(cx, cz));
        if (!l) continue;
        for (let j = 0; j < l.length; j++) {
          const i = l[j];
          if (this.stamp[i] === q) continue;
          this.stamp[i] = q;
          const o = i * 6;
          if (b[o] < x1 && b[o + 3] > x0 && b[o + 1] < y1 && b[o + 4] > y0 && b[o + 2] < z1 && b[o + 5] > z0) {
            cb(b.subarray(o, o + 3), b.subarray(o + 3, o + 6), null);
          }
        }
      }
    for (const d of this.dyn) {
      if (!d.enabled) continue;
      if (d.min[0] < x1 && d.max[0] > x0 && d.min[1] < y1 && d.max[1] > y0 && d.min[2] < z1 && d.max[2] > z0) {
        cb(d.min, d.max, d);
      }
    }
  }

  /** Comme any(), statiques seulement, avec arrêt au premier recouvrement (rapide). */
  hit(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    const b = this.b;
    const cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL);
    const cz0 = Math.floor(z0 / CELL), cz1 = Math.floor(z1 / CELL);
    for (let cx = cx0; cx <= cx1; cx++)
      for (let cz = cz0; cz <= cz1; cz++) {
        const l = this.cells.get(this.key(cx, cz));
        if (!l) continue;
        for (let j = 0; j < l.length; j++) {
          const o = l[j] * 6;
          if (b[o] < x1 && b[o + 3] > x0 && b[o + 1] < y1 && b[o + 4] > y0 && b[o + 2] < z1 && b[o + 5] > z0) return true;
        }
      }
    return false;
  }

  any(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
    let hit = false;
    this.query(x0, y0, z0, x1, y1, z1, () => (hit = true));
    return hit;
  }

  /** Boîtes statiques (6 flottants chacune), pour les transférer d'un thread à l'autre. */
  export(): Float32Array {
    return this.b.slice(0, this.n * 6);
  }

  static from(boxes: Float32Array): CollisionWorld {
    const c = new CollisionWorld();
    for (let o = 0; o + 5 < boxes.length; o += 6) c.add(boxes[o], boxes[o + 1], boxes[o + 2], boxes[o + 3], boxes[o + 4], boxes[o + 5]);
    return c;
  }
}

/** Interface commune des mondes de collision (un seul, ou un par niveau chargé). */
export interface Collider {
  query(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cb: (min: ArrayLike<number>, max: ArrayLike<number>, dyn: DynBox | null) => void): void;
  hit(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
  any(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean;
}

/**
 * Collisions réparties par tranche d'altitude (un monde par niveau chargé, plus des
 * boîtes dynamiques communes) : les requêtes ne visitent que les tranches concernées.
 */
export class LayeredCollision implements Collider {
  layers = new Map<string, { y0: number; y1: number; w: Collider }>();
  dynWorld = new CollisionWorld();

  set(key: string, w: Collider, y0: number, y1: number) {
    this.layers.set(key, { w, y0, y1 });
  }
  remove(key: string) {
    this.layers.delete(key);
  }
  addDyn(): DynBox {
    return this.dynWorld.addDyn();
  }

  query(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cb: (min: ArrayLike<number>, max: ArrayLike<number>, dyn: DynBox | null) => void) {
    for (const l of this.layers.values()) if (l.y0 < y1 && l.y1 > y0) l.w.query(x0, y0, z0, x1, y1, z1, cb);
    this.dynWorld.query(x0, y0, z0, x1, y1, z1, cb);
  }
  hit(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    for (const l of this.layers.values()) if (l.y0 < y1 && l.y1 > y0 && l.w.hit(x0, y0, z0, x1, y1, z1)) return true;
    return false;
  }
  any(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    let h = false;
    this.query(x0, y0, z0, x1, y1, z1, () => (h = true));
    return h;
  }
}
