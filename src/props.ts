// Éléments animés du décor : moyeu de la turbine du générateur, ventilateurs,
// palan provisoire de la Brèche (plateforme mobile sur laquelle on peut monter).
import * as THREE from 'three';
import { STYLE, hex } from './config';
import type { DynBox, LayeredCollision } from './physics';
import { makeGeometry } from './render/geo';
import { Accum } from './world/builder';
import type { Mover } from './world/types';

function turbineGeo(r: number, h: number) {
  const a = new Accum();
  a.addBox(-r, 0, -0.4, r, h, 0.4, hex(0x4a4e4a), STYLE.BRASS, 0, 0, 0);
  a.addBox(-0.4, 0, -r, 0.4, h, r, hex(0x4a4e4a), STYLE.BRASS, 0, 0, 0);
  a.addBox(-r * 0.7, 0, -r * 0.7, -r * 0.5, h + 0.2, -r * 0.5, hex(0xc8a030), STYLE.SOLID, 0, 0, 2);
  a.addBox(-0.9, 0, -0.9, 0.9, h + 0.3, 0.9, hex(0x3a3c3a), STYLE.BRASS, 0, 0, 0);
  return makeGeometry(a.arrays());
}
function platformGeo(w: number) {
  const a = new Accum();
  const s = w / 2;
  a.addBox(-s, -0.15, -s, s, 0, s, hex(0x5a4a34), STYLE.WOOD, 0, 0, 0);
  a.addBox(-s, -0.3, -s, s, -0.15, s, hex(0x3a3c3a), STYLE.BRASS, 0, 0, 0);
  for (const [x0, z0, x1, z1] of [[-s, -s, s, -s + 0.06], [-s, s - 0.06, s, s], [-s, -s, -s + 0.06, s]]) {
    a.addBox(x0, 0.95, z0, x1, 1.02, z1, hex(0xb89020), STYLE.BRASS, 0, 0, 0);
    a.addBox(x0, 0.45, z0, x1, 0.5, z1, hex(0x5a5a54), STYLE.BRASS, 0, 0, 0);
  }
  for (const [x, z] of [[-s, -s], [s, -s], [-s, s], [s, s]]) a.addBox(x - 0.04, 0, z - 0.04, x + 0.04, 1.02, z + 0.04, hex(0x5a5a54), STYLE.BRASS, 0, 0, 0);
  // câbles de suspension
  for (const [x, z] of [[-s + 0.1, 0], [s - 0.1, 0]]) a.addBox(x - 0.02, 1.0, z - 0.02, x + 0.02, 6.0, z + 0.02, hex(0x1a1a1a), STYLE.SOLID, 0, 0, 0);
  return makeGeometry(a.arrays());
}

interface Pulley { m: Extract<Mover, { kind: 'pulley' }>; mesh: THREE.Mesh; dyn: DynBox; t: number; y: number }

export class Props {
  group = new THREE.Group();
  private turbines: { mesh: THREE.Mesh; speed: number }[] = [];
  private pulleys: Pulley[] = [];

  constructor(movers: Mover[], mat: THREE.Material, private col: LayeredCollision) {
    for (const m of movers) {
      if (m.kind === 'turbine') {
        const mesh = new THREE.Mesh(turbineGeo(m.r, m.h), mat);
        mesh.position.set(m.x, m.y, m.z);
        this.group.add(mesh);
        this.turbines.push({ mesh, speed: 2.6 });
      } else if (m.kind === 'pulley') {
        const mesh = new THREE.Mesh(platformGeo(m.w), mat);
        this.group.add(mesh);
        const dyn = col.addDyn();
        dyn.enabled = true;
        this.pulleys.push({ m, mesh, dyn, t: 0, y: m.y1 });
      }
    }
  }

  /** Nombre de palans (pour le son). */
  get moving() { return this.pulleys.some((p) => { const c = p.t % 22; return (c > 6 && c < 11) || (c > 17); }); }

  update(dt: number) {
    for (const tb of this.turbines) tb.mesh.rotation.y += tb.speed * dt;
    for (const p of this.pulleys) {
      p.t += dt;
      // cycle : 6 s en haut, 5 s de descente, 6 s en bas, 5 s de montée
      const c = p.t % 22;
      const { y0, y1 } = p.m;
      const u = c < 6 ? 0 : c < 11 ? (c - 6) / 5 : c < 17 ? 1 : 1 - (c - 17) / 5;
      const s = u * u * (3 - 2 * u);
      const y = y1 + (y0 - y1) * s;
      p.dyn.dy = y - p.y;
      p.y = y;
      const hw = p.m.w / 2;
      p.dyn.min[0] = p.m.x - hw; p.dyn.min[1] = y - 0.3; p.dyn.min[2] = p.m.z - hw;
      p.dyn.max[0] = p.m.x + hw; p.dyn.max[1] = y; p.dyn.max[2] = p.m.z + hw;
      p.mesh.position.set(p.m.x, y, p.m.z);
    }
  }

  dispose() {
    this.group.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.geometry.dispose(); });
    for (const p of this.pulleys) { p.dyn.enabled = false; const i = this.col.dynWorld.dyn.indexOf(p.dyn); if (i >= 0) this.col.dynWorld.dyn.splice(i, 1); }
  }
}
