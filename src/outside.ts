// La surface : ciel, relief en voxels (quadtree de chunks), décor, collisions du sol,
// simulation du casque, caméra du capteur et écrans qui diffusent sa vue dans le silo.
import * as THREE from 'three';
import { R_SILO, T_QUANT } from './config';
import type { Collider, DynBox } from './physics';
import { CollisionWorld } from './physics';
import { makeGeometry } from './render/geo';
import { createVoxelMaterial, shared } from './render/materials';
import type { Silo } from './silo';
import type { ScreenDef } from './world/types';
import { SENSOR, terrainH } from './world/terrain';
import type { OutsideOut } from './gen/outside';

/** Sol analytique : une boîte par cellule de 1 m sous la surface quantifiée. */
class HeightCollider implements Collider {
  private min = new Float32Array(3);
  private max = new Float32Array(3);
  query(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, cb: (min: ArrayLike<number>, max: ArrayLike<number>, dyn: DynBox | null) => void) {
    for (let i = Math.floor(x0); i <= Math.floor(x1); i++) for (let j = Math.floor(z0); j <= Math.floor(z1); j++) {
      const h = Math.round(terrainH(i + 0.5, j + 0.5) / T_QUANT) * T_QUANT;
      if (y0 < h && y1 > h - 3) {
        this.min[0] = i; this.min[1] = h - 3; this.min[2] = j;
        this.max[0] = i + 1; this.max[1] = h; this.max[2] = j + 1;
        cb(this.min, this.max, null);
      }
    }
  }
  hit(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) {
    let h = false;
    this.query(x0, y0, z0, x1, y1, z1, () => (h = true));
    return h;
  }
  any(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) { return this.hit(x0, y0, z0, x1, y1, z1); }
}

const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main(){ vDir = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }
`;
const SKY_FRAG = /* glsl */ `
varying vec3 vDir;
uniform float uSim;
uniform float uTime;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
float fbm(vec2 p){ return vn(p) * 0.5 + vn(p * 2.1) * 0.3 + vn(p * 4.3) * 0.2; }
void main(){
  vec3 d = normalize(vDir);
  float h = d.y;
  vec2 cp = d.xz / max(0.12, h + 0.25);
  // réalité : couvercle de poussière brun-gris
  vec3 rHor = vec3(0.4, 0.36, 0.3), rTop = vec3(0.2, 0.19, 0.18);
  vec3 real = mix(rHor, rTop, smoothstep(-0.02, 0.55, h));
  real *= 0.85 + 0.3 * fbm(cp * 1.4 + vec2(uTime * 0.004, 0.0));
  real = mix(real, vec3(0.3, 0.27, 0.22), smoothstep(0.02, -0.1, h));
  // simulation : ciel bleu, nuages blancs, soleil
  vec3 sHor = vec3(0.72, 0.83, 0.92), sTop = vec3(0.24, 0.46, 0.8);
  vec3 sim = mix(sHor, sTop, smoothstep(0.0, 0.6, h));
  float cl = smoothstep(0.55, 0.8, fbm(cp * 1.2 + vec2(uTime * 0.01, uTime * 0.004)));
  sim = mix(sim, vec3(0.97), cl * smoothstep(0.0, 0.15, h));
  vec3 sd = normalize(vec3(0.3, 0.8, 0.5));
  sim += vec3(1.0, 0.95, 0.8) * pow(max(dot(d, sd), 0.0), 400.0) * 2.0;
  sim = mix(sim, vec3(0.5, 0.62, 0.4), smoothstep(0.02, -0.1, h));
  gl_FragColor = vec4(mix(real, sim, uSim), 1.0);
}
`;

const FEED_FRAG = /* glsl */ `
uniform sampler2D uFeed;
uniform float uTime;
uniform float uDirt;
uniform vec4 uCrop;
varying vec2 vUv;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  vec2 uv = uCrop.xy + vUv * uCrop.zw;
  vec3 c = texture2D(uFeed, uv).rgb * 0.7 + texture2D(uFeed, uv + vec2(0.0015, 0.0)).rgb * 0.15 + texture2D(uFeed, uv - vec2(0.0015, 0.0)).rgb * 0.15;
  float l = dot(c, vec3(0.3, 0.59, 0.11));
  c = mix(vec3(l), c, 0.5) * vec3(0.94, 1.0, 0.98);
  // crasse de la lentille : taches, coulures
  float d = smoothstep(0.42, 0.78, vn(vUv * vec2(7.0, 3.0)) * 0.6 + vn(vUv * vec2(24.0, 11.0)) * 0.4);
  d = max(d, smoothstep(0.7, 0.9, vn(vec2(vUv.x * 40.0, vUv.y * 2.0))) * 0.6);
  c = mix(c, vec3(0.16, 0.14, 0.11), d * uDirt);
  float scan = 0.92 + 0.08 * sin(vUv.y * 520.0);
  float grain = (h21(vUv * vec2(900.0, 520.0) + fract(uTime * 13.0) * 50.0) - 0.5) * 0.06;
  vec2 v = vUv - 0.5;
  float vig = 1.0 - dot(v, v) * 0.7;
  gl_FragColor = vec4((c * scan + grain) * vig * 1.35, 1.0);
}
`;
const FEED_VERT = /* glsl */ `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;

interface TNode { key: string; x0: number; z0: number; size: number; cell: number }

export class Outside {
  group = new THREE.Group();
  mat = createVoxelMaterial(true);
  ready = false;
  private both: THREE.Mesh[] = [];
  private real: THREE.Mesh[] = [];
  private simM: THREE.Mesh[] = [];
  private sky: THREE.Mesh;
  private skyMat: THREE.ShaderMaterial;
  private terrain = new Map<string, THREE.Mesh>();
  private pending = new Set<string>();
  private wanted: TNode[] = [];
  private lastFocus = new THREE.Vector2(1e9, 1e9);
  private height = new HeightCollider();
  sensorCam: THREE.PerspectiveCamera;
  private rt: THREE.WebGLRenderTarget;
  private feedMats: THREE.ShaderMaterial[] = [];
  private screens = new Map<string, THREE.Mesh>();
  private screenGroup = new THREE.Group();
  /** Crasse sur la lentille du capteur (0 : propre). */
  dirt = 0.6;
  sim = false;
  private frame = 0;
  lights: { x: number; y: number; z: number; r: number; g: number; b: number; radius: number }[] = [];

  constructor(private silo: () => Silo, private renderer: THREE.WebGLRenderer, private fog: THREE.FogExp2) {
    this.skyMat = new THREE.ShaderMaterial({ vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, uniforms: { uSim: shared.uSim, uTime: shared.uTime }, side: THREE.BackSide, depthWrite: false, fog: false });
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(5000, 32, 16), this.skyMat);
    this.sky.frustumCulled = false;
    this.sky.renderOrder = -10;
    this.sky.layers.enable(1);
    this.group.add(this.sky);
    this.group.layers.enable(1);
    this.sensorCam = new THREE.PerspectiveCamera(24, 3.2, 0.3, 7000);
    this.sensorCam.layers.set(1);
    this.rt = new THREE.WebGLRenderTarget(960, 300, { type: THREE.HalfFloatType });
    this.rt.texture.colorSpace = THREE.LinearSRGBColorSpace;
  }

  get screensGroup() { return this.screenGroup; }

  load() {
    const silo = this.silo();
    silo.send({ type: 'outside', seed: silo.seed }, (r) => {
      if (r.type !== 'outside') return;
      this.install(r.out);
    });
    silo.col.set('TERRAIN', this.height, -60, 400);
  }

  private mk(g: THREE.BufferGeometry) {
    const m = new THREE.Mesh(g, this.mat);
    m.matrixAutoUpdate = false;
    m.layers.enable(1);
    this.group.add(m);
    return m;
  }

  private install(o: OutsideOut) {
    this.both = o.both.map((a) => this.mk(makeGeometry(a)));
    this.real = o.real.map((a) => this.mk(makeGeometry(a)));
    this.simM = o.sim.map((a) => this.mk(makeGeometry(a)));
    this.silo().col.set('OUT', CollisionWorld.from(o.colliders), -10, 400);
    this.lights = o.lights;
    this.setSim(this.sim);
    this.ready = true;
    console.info(`[silo] surface générée en ${o.ms} ms`);
  }

  setSim(on: boolean) {
    this.sim = on;
    shared.uSim.value = on ? 1 : 0;
    for (const m of this.real) m.visible = !on;
    for (const m of this.simM) m.visible = on;
  }

  /** Découpage en quadtree autour du point focal (chunks de 64 × 64 cellules). */
  private quadtree(fx: number, fz: number): TNode[] {
    const out: TNode[] = [];
    const rec = (x0: number, z0: number, size: number) => {
      const cx = x0 + size / 2, cz = z0 + size / 2;
      const d = Math.max(Math.abs(fx - cx), Math.abs(fz - cz)) - size / 2;
      if (size > 64 && d < size * 0.65) {
        const h = size / 2;
        rec(x0, z0, h); rec(x0 + h, z0, h); rec(x0, z0 + h, h); rec(x0 + h, z0 + h, h);
      } else {
        const cell = Math.max(1, size / 64);
        out.push({ key: `${x0},${z0},${size}`, x0, z0, size, cell });
      }
    };
    rec(-4096, -4096, 8192);
    return out;
  }

  private updateTerrain(fx: number, fz: number) {
    if (this.lastFocus.distanceTo(new THREE.Vector2(fx, fz)) < 12 && this.wanted.length) {
      this.flushTerrain();
      return;
    }
    this.lastFocus.set(fx, fz);
    this.wanted = this.quadtree(fx, fz);
    const silo = this.silo();
    for (const n of this.wanted) {
      if (this.terrain.has(n.key) || this.pending.has(n.key)) continue;
      this.pending.add(n.key);
      silo.send({ type: 'tchunk', x0: n.x0, z0: n.z0, size: n.size, cell: n.cell }, (r) => {
        this.pending.delete(n.key);
        if (r.type !== 'tchunk') return;
        const m = this.mk(makeGeometry(r.out));
        m.visible = false;
        this.terrain.set(n.key, m);
        this.flushTerrain();
      });
    }
    this.flushTerrain();
  }

  /** Remplace l'ancien découpage quand tous les chunks voulus sont prêts. */
  private flushTerrain() {
    const want = new Set(this.wanted.map((n) => n.key));
    const allReady = this.wanted.every((n) => this.terrain.has(n.key));
    if (!allReady) return;
    for (const [k, m] of this.terrain) {
      if (want.has(k)) m.visible = true;
      else { this.group.remove(m); m.geometry.dispose(); this.terrain.delete(k); }
    }
  }

  /** Le point p est-il à l'air libre ? */
  static isOutside(p: THREE.Vector3) {
    const r = Math.hypot(p.x, p.z);
    return p.y > 2.5 && r > R_SILO + 6 && !(Math.abs(p.x) < 3.3 && p.z > 40 && p.z < 70 && p.y < 9);
  }

  /** Mise à jour : terrain autour du joueur, visibilité, ciel. */
  update(camPos: THREE.Vector3, playerPos: THREE.Vector3, overview: boolean) {
    const near = playerPos.y > -30 || overview;
    const outside = Outside.isOutside(camPos);
    this.group.visible = near;
    this.sky.visible = outside;
    const focusOut = playerPos.y > -12 && Math.hypot(playerPos.x, playerPos.z) > 30;
    this.updateTerrain(focusOut ? playerPos.x : SENSOR.x, focusOut ? playerPos.z : SENSOR.z + 30);
    this.sky.position.copy(camPos);
    this.sky.updateMatrixWorld();
    return outside;
  }

  /** Brouillard et lumière de la surface (réalité ou simulation). */
  applyOutdoorFog() {
    if (this.sim) { this.fog.color.setRGB(0.66, 0.76, 0.86); this.fog.density = 0.00032; }
    else { this.fog.color.setRGB(0.36, 0.33, 0.28); this.fog.density = 0.00046; }
    if (this.sim) { shared.uOutSunCol.value.set(0.95, 0.88, 0.75); shared.uOutAmbUp.value.set(0.42, 0.48, 0.55); }
    else { shared.uOutSunCol.value.set(0.42, 0.39, 0.34); shared.uOutAmbUp.value.set(0.3, 0.29, 0.27); }
  }

  // ---------------------------------------------------------------------------------------------
  // Écrans et caméra du capteur
  // ---------------------------------------------------------------------------------------------
  /** Crée ou retire les écrans des niveaux chargés. */
  syncScreens(defs: { key: string; s: ScreenDef }[]) {
    const keep = new Set(defs.map((d) => d.key));
    for (const [k, m] of this.screens) if (!keep.has(k)) { this.screenGroup.remove(m); m.geometry.dispose(); this.screens.delete(k); }
    for (const { key, s } of defs) {
      if (this.screens.has(key)) continue;
      const aspect = s.w / s.h, feed = 3.2;
      const crop = aspect > feed ? new THREE.Vector4(0, 0.5 - (feed / aspect) / 2, 1, feed / aspect) : new THREE.Vector4(0.5 - (aspect / feed) / 2, 0, aspect / feed, 1);
      const mat = new THREE.ShaderMaterial({ vertexShader: FEED_VERT, fragmentShader: FEED_FRAG, uniforms: { uFeed: { value: this.rt.texture }, uTime: shared.uTime, uDirt: { value: this.dirt }, uCrop: { value: crop } } });
      this.feedMats.push(mat);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h), mat);
      m.position.set(s.x, s.y, s.z);
      m.rotation.y = s.side === 0 ? Math.PI : s.side === 1 ? Math.PI / 2 : s.side === 2 ? 0 : -Math.PI / 2;
      this.screenGroup.add(m);
      this.screens.set(key, m);
    }
  }

  /** Rend la vue du capteur (réalité) si un écran est proche de la caméra. */
  renderFeed(scene: THREE.Scene, cam: THREE.Vector3) {
    if (!this.ready || !this.screens.size) return;
    if (++this.frame % 3) return;
    let near = false;
    for (const m of this.screens.values()) if (m.position.distanceTo(cam) < 70) { near = true; break; }
    if (!near) return;
    const sy = terrainH(SENSOR.x, SENSOR.z) + 1.6;
    this.sensorCam.position.set(SENSOR.x, sy, SENSOR.z + 0.5);
    this.sensorCam.lookAt(SENSOR.x - 4, sy + 2, SENSOR.z + 100);
    this.sensorCam.updateMatrixWorld();
    // la vue du capteur est toujours la réalité
    const sim = this.sim, fc = this.fog.color.clone(), fd = this.fog.density, bg = scene.background;
    const vis = this.group.visible, skyVis = this.sky.visible;
    const sunCol = shared.uOutSunCol.value.clone(), amb = shared.uOutAmbUp.value.clone();
    this.setSim(false);
    this.applyOutdoorFog();
    this.group.visible = true;
    this.sky.visible = true;
    this.sky.position.copy(this.sensorCam.position);
    this.sky.updateMatrixWorld();
    scene.background = this.fog.color;
    const prev = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.rt);
    this.renderer.render(scene, this.sensorCam);
    this.renderer.setRenderTarget(prev);
    this.setSim(sim);
    this.fog.color.copy(fc); this.fog.density = fd; scene.background = bg;
    this.group.visible = vis; this.sky.visible = skyVis;
    shared.uOutSunCol.value.copy(sunCol); shared.uOutAmbUp.value.copy(amb);
    for (const m of this.feedMats) m.uniforms.uDirt.value = this.dirt;
  }
}
