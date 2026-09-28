// Vue d'ensemble : le silo en coupe (plan de coupe tourné vers la caméra), coupe géologique,
// règle des niveaux, liste des 144 niveaux groupés par zone et fiche descriptive.
import * as THREE from 'three';
import { GEN_FLOOR, GEN_TOP, LH, NLEV, R_SILO, SLAB, SURFACE_Y, VOID_FLOOR, VOID_TOP, floorY, levelOf, type RGB } from './config';
import { shared } from './render/materials';
import type { Post } from './render/post';
import type { Silo } from './silo';
import { ABOVE, BELOW, LEVELS, ZONES, levelInfo, type LevelInfo, type ZoneId } from './world/levels';
import type { Era } from './world/types';

const KIND_COLOR: Record<LevelInfo['kind'], number> = {
  sommet: 0xd9b36a, logements: 0x86887f, bureaux: 0xc9a060, marche: 0xcbb354, ferme: 0x6fa650, parc: 0x5caa62,
  medical: 0xb8d4dc, ecole: 0xd4c490, moulin: 0xb09060, auberge: 0xb4845e, mines: 0x7e6c5a, approvisionnement: 0xa6946e,
  eau: 0x6a9ec0, mecanique: 0xc27444, fond: 0xc8603a,
};
const KIND_LABEL: Record<LevelInfo['kind'], string> = {
  sommet: 'Sommet', logements: 'Logements', bureaux: 'Bureaux', marche: 'Marché', ferme: 'Fermes', parc: 'Parc', medical: 'Santé',
  ecole: 'École', moulin: 'Moulin', auberge: 'Auberge', mines: 'Mines', approvisionnement: 'Approvisionnement', eau: 'Eaux', mecanique: 'Mechanical', fond: 'Fond',
};

type Sel = { type: 'level'; n: number } | { type: 'below'; i: number } | { type: 'above'; i: number };

const ROCK_VERT = /* glsl */ `
varying vec3 vWP;
void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vWP = wp.xyz; gl_Position = projectionMatrix * viewMatrix * wp; }
`;
const ROCK_FRAG = /* glsl */ `
varying vec3 vWP;
uniform vec3 uAxis;
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
void main(){
  float u = dot(vWP.xz, uAxis.xz);
  float y = vWP.y;
  // strates ondulées
  float s = y * 0.045 + vn(vec2(u * 0.01, y * 0.02)) * 1.6 + vn(vec2(u * 0.04, y * 0.05)) * 0.4;
  float band = fract(s);
  vec3 a = vec3(0.062, 0.056, 0.05), b = vec3(0.082, 0.072, 0.06), c = vec3(0.048, 0.048, 0.046);
  vec3 col = band < 0.33 ? a : band < 0.7 ? b : c;
  col *= 0.85 + 0.3 * vn(vec2(u, y) * 0.35);
  // hachures de coupe, discrètes
  float hatch = step(0.9, fract((u + y) * 0.2));
  col = mix(col, col * 1.25, hatch * 0.25);
  // assombrir en profondeur, liseré de la surface
  col *= mix(0.55, 1.0, smoothstep(-1000.0, 0.0, y));
  if (y > ${SURFACE_Y.toFixed(1)} - 1.5) col = mix(col, vec3(0.25, 0.2, 0.15), 0.6);
  gl_FragColor = vec4(col, 1.0);
}
`;

export class Overview {
  active = false;
  camera: THREE.PerspectiveCamera;
  group = new THREE.Group();
  private ovMesh: THREE.InstancedMesh[] = [];
  private rock: THREE.Mesh;
  private rockMat: THREE.ShaderMaterial;
  private yaw = 0.6;
  private pitch = 0.08;
  private dist = 1150;
  private ty = (floorY(1) + floorY(NLEV)) / 2 - 40;
  private target = { yaw: 0.6, pitch: 0.08, dist: 1150, ty: (floorY(1) + floorY(NLEV)) / 2 - 40 };
  private drag: { x: number; y: number; yaw: number; pitch: number } | null = null;
  private moved = false;
  private sel: Sel | null = null;
  private hover = -1;
  private ray = new THREE.Raycaster();
  private listEl = document.getElementById('ovList')!;
  private cardEl = document.getElementById('ovCard')!;
  private tipEl = document.getElementById('ovTip')!;
  private rootEl = document.getElementById('ov')!;
  private items = new Map<number, HTMLElement>();
  private saved = { fog: 0, amb: [new THREE.Vector3(), new THREE.Vector3()], sun: new THREE.Vector4(), sunCol: new THREE.Vector3() };
  private ruler: { el: HTMLElement; y: number }[] = [];
  private lastLoaded = '';
  onVisit: (n: number) => void = () => {};
  era: Era = 's1';

  constructor(private canvas: HTMLCanvasElement, private post: Post, private silo: () => Silo, private fog: THREE.FogExp2, private voxelMat: THREE.ShaderMaterial) {
    this.camera = new THREE.PerspectiveCamera(40, innerWidth / innerHeight, 1, 6000);
    // coupe géologique
    this.rockMat = new THREE.ShaderMaterial({ vertexShader: ROCK_VERT, fragmentShader: ROCK_FRAG, uniforms: { uAxis: { value: new THREE.Vector3(1, 0, 0) } }, side: THREE.DoubleSide });
    const g = new THREE.BufferGeometry();
    const W = 900, top = SURFACE_Y, bot = -1250, R = R_SILO + 0.3;
    const quads: number[][] = [[-W, bot, -R, top], [R, bot, W, top], [-R, bot, R, VOID_FLOOR - 1.2]];
    const pos: number[] = [];
    for (const [u0, y0, u1, y1] of quads) pos.push(u0, y0, 0, u1, y0, 0, u1, y1, 0, u0, y0, 0, u1, y1, 0, u0, y1, 0);
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    this.rock = new THREE.Mesh(g, this.rockMat);
    this.rock.frustumCulled = false;
    this.group.add(this.rock);
    this.group.visible = false;
    this.buildList();
    this.buildLegend();
    this.bindMouse();
  }

  /** Géométries reçues du worker (niveau générique de la coupe, fond du silo). */
  setOverviewLevel(geos: THREE.BufferGeometry[]) {
    for (const geo of geos) {
      const im = new THREE.InstancedMesh(geo, this.voxelMat, NLEV);
      const c = new THREE.Color();
      for (let n = 1; n <= NLEV; n++) im.setColorAt(n - 1, c.setHex(KIND_COLOR[levelInfo(n).kind]).convertSRGBToLinear().multiplyScalar(1.4));
      im.frustumCulled = false;
      this.ovMesh.push(im);
      this.group.add(im);
    }
    this.refreshInstances(true);
  }
  setBelow(geos: THREE.BufferGeometry[]) {
    for (const geo of geos) { const m = new THREE.Mesh(geo, this.voxelMat); m.frustumCulled = false; this.group.add(m); }
  }

  private refreshInstances(force = false) {
    const loaded = [...this.silo().levels.keys()].join(',');
    if (!force && loaded === this.lastLoaded) return;
    this.lastLoaded = loaded;
    const m = new THREE.Matrix4();
    const hide = new THREE.Matrix4().makeScale(0, 0, 0);
    for (const im of this.ovMesh) {
      for (let n = 1; n <= NLEV; n++) im.setMatrixAt(n - 1, this.silo().isLoaded(n) ? hide : m.makeTranslation(0, floorY(n), 0));
      im.instanceMatrix.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Interface
  // ---------------------------------------------------------------------------------------------
  private buildLegend() {
    const el = document.getElementById('ovLegend')!;
    const kinds: LevelInfo['kind'][] = ['logements', 'bureaux', 'marche', 'ferme', 'medical', 'ecole', 'mines', 'approvisionnement', 'mecanique'];
    el.innerHTML = kinds.map((k) => `<span><i style="background:#${KIND_COLOR[k].toString(16).padStart(6, '0')}"></i>${KIND_LABEL[k]}</span>`).join('') +
      '<span style="margin-top:6px;color:var(--dim)">Numéro doré : lieu montré dans la série · gris : emplacement supposé</span>';
  }

  private buildList() {
    const L = this.listEl;
    L.innerHTML = '';
    const sec = (title: string, color: string) => { const d = document.createElement('div'); d.className = 'sec'; d.style.color = color; d.textContent = title; L.appendChild(d); };
    sec('AU-DESSUS', '#c8c0b0');
    ABOVE.forEach((a, i) => this.addItem(L, '↑', a.title, 'dôme', true, () => this.select({ type: 'above', i }), -100 - i));
    let zone: ZoneId | null = null;
    for (const info of LEVELS) {
      if (info.zone !== zone) { zone = info.zone; sec(`${ZONES[zone].name.toUpperCase()} · ${ZONES[zone].range[0]}–${ZONES[zone].range[1]}`, ZONES[zone].color); }
      this.addItem(L, String(info.n), info.title, KIND_LABEL[info.kind], info.canon, () => this.select({ type: 'level', n: info.n }), info.n);
    }
    sec('SOUS LE NIVEAU 144', '#c8603a');
    BELOW.forEach((b, i) => this.addItem(L, '↓', b.title, '', true, () => this.select({ type: 'below', i }), -200 - i));
  }

  private addItem(L: HTMLElement, num: string, title: string, tag: string, canon: boolean, onClick: () => void, key: number) {
    const d = document.createElement('div');
    d.className = `it${canon ? ' canon' : ''}`;
    d.innerHTML = `<b>${num}</b><span>${title}</span><small>${tag}</small>`;
    d.addEventListener('click', onClick);
    d.addEventListener('mouseenter', () => { if (key > 0) this.hover = key; });
    d.addEventListener('mouseleave', () => { if (key > 0 && this.hover === key) this.hover = -1; });
    L.appendChild(d);
    this.items.set(key, d);
  }

  select(s: Sel, fromClick = true) {
    this.sel = s;
    for (const el of this.items.values()) el.classList.remove('on');
    const C = this.cardEl;
    C.classList.remove('hidden');
    if (s.type === 'level') {
      const info = levelInfo(s.n);
      this.items.get(s.n)?.classList.add('on');
      if (fromClick) this.items.get(s.n)?.scrollIntoView({ block: 'nearest' });
      const places = info.places.map((p) => `<li>${p.name}${p.label ? ` · <small>${p.label}</small>` : ''} <span class="tag ${p.canon && !(p.ref ?? '').includes('supposé') ? 'c' : 'h'}">${p.canon ? (p.ref ?? 'série') : 'supposé'}</span></li>`).join('');
      C.innerHTML = `<h2><b>${info.n}</b>${info.title}</h2>
        <div class="meta">${ZONES[info.zone].name} · ${KIND_LABEL[info.kind]} · altitude ${Math.round(floorY(info.n))} m ${info.canon ? '<span class="tag c">canon</span>' : '<span class="tag h">supposé</span>'}</div>
        <p>${info.desc}</p>
        ${places ? `<ul>${places}</ul>` : ''}
        ${info.s3 ? `<p class="s3">Saison 3 · ${info.s3}</p>` : ''}
        <button class="go" id="ovGo">VISITER CE NIVEAU</button>`;
      C.querySelector('#ovGo')!.addEventListener('click', () => this.onVisit(info.n));
      this.focusY(floorY(s.n) + 2.5, 190);
      this.silo().update(s.n);
    } else {
      const d = s.type === 'below' ? BELOW[s.i] : ABOVE[s.i];
      this.items.get(s.type === 'below' ? -200 - s.i : -100 - s.i)?.classList.add('on');
      C.innerHTML = `<h2>${d.title}</h2><div class="meta">${s.type === 'below' ? 'Sous le niveau 144' : 'Au-dessus du niveau 1'} <span class="tag c">canon</span></div><p>${d.desc}</p>` +
        (s.type === 'below' ? '<button class="go" id="ovGo">VISITER LE FOND</button>' : s.i === 1 ? '<button class="go" id="ovGo">ALLER AU SAS</button>' : '<button class="go" id="ovGo">VISITER LE NIVEAU 1</button>');
      C.querySelector('#ovGo')!.addEventListener('click', () => this.onVisit(s.type === 'below' ? NLEV : 1));
      const y = s.type === 'below' ? [(GEN_FLOOR + GEN_TOP) / 2, GEN_FLOOR - 4, (VOID_TOP + VOID_FLOOR) / 2][s.i] : s.i === 0 ? 14 : SURFACE_Y;
      this.focusY(y, s.type === 'below' ? 230 : 260);
      this.silo().update(s.type === 'below' ? NLEV : 1);
    }
  }

  private focusY(y: number, dist: number) {
    this.target.ty = y;
    this.target.dist = dist;
  }

  // ---------------------------------------------------------------------------------------------
  // Entrée / sortie
  // ---------------------------------------------------------------------------------------------
  enter(currentLevel: number) {
    this.active = true;
    this.rootEl.classList.remove('hidden');
    this.group.visible = true;
    this.saved.fog = this.fog.density;
    this.saved.amb[0].copy(shared.uAmbUp.value);
    this.saved.amb[1].copy(shared.uAmbDown.value);
    this.saved.sun.copy(shared.uSunDir.value);
    this.saved.sunCol.copy(shared.uSunCol.value);
    this.voxelMat.side = THREE.DoubleSide;
    this.voxelMat.needsUpdate = true;
    this.silo().setOverview(true);
    this.post.setCamera(this.camera);
    this.onResize();
    this.refreshInstances(true);
    if (!this.sel) this.select({ type: 'level', n: currentLevel }, true);
    else if (this.sel.type === 'level') this.silo().update(this.sel.n);
    this.buildRuler();
  }

  exit() {
    this.active = false;
    this.rootEl.classList.add('hidden');
    this.group.visible = false;
    this.fog.density = this.saved.fog;
    shared.uAmbUp.value.copy(this.saved.amb[0]);
    shared.uAmbDown.value.copy(this.saved.amb[1]);
    shared.uSunDir.value.copy(this.saved.sun);
    shared.uSunCol.value.copy(this.saved.sunCol);
    shared.uClip.value.set(0, 0, 1, 1e9);
    shared.uHi.value.set(0, 0, 0);
    this.voxelMat.side = THREE.FrontSide;
    this.voxelMat.needsUpdate = true;
    this.silo().setOverview(false);
    for (const r of this.ruler) r.el.remove();
    this.ruler = [];
  }

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    // décale le centre de l'image vers la gauche (panneau de liste à droite)
    const w = innerWidth, h = innerHeight, panel = Math.min(330, w * 0.46);
    this.camera.setViewOffset(w + panel, h, panel, 0, w, h);
    this.camera.updateProjectionMatrix();
  }

  private buildRuler() {
    for (const r of this.ruler) r.el.remove();
    this.ruler = [];
    const add = (label: string, y: number, cls = '') => {
      const el = document.createElement('div');
      el.className = `tip ${cls}`;
      el.style.pointerEvents = 'none';
      el.style.opacity = '0.8';
      el.textContent = label;
      this.rootEl.appendChild(el);
      this.ruler.push({ el, y });
    };
    for (const n of [1, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120, 130, 144]) add(`${n}`, floorY(n) + 1);
    for (const z of Object.values(ZONES)) add(z.short, (floorY(z.range[0]) + floorY(z.range[1])) / 2);
    add('GÉNÉRATEUR', (GEN_FLOOR + GEN_TOP) / 2);
    add('CAVITÉ', (VOID_TOP + VOID_FLOOR) / 2);
    add('SURFACE', SURFACE_Y + 3);
  }

  // ---------------------------------------------------------------------------------------------
  // Souris
  // ---------------------------------------------------------------------------------------------
  private bindMouse() {
    const c = this.canvas;
    c.addEventListener('pointerdown', (e) => {
      if (!this.active) return;
      this.drag = { x: e.clientX, y: e.clientY, yaw: this.target.yaw, pitch: this.target.pitch };
      this.moved = false;
    });
    addEventListener('pointermove', (e) => {
      if (!this.active) return;
      if (this.drag) {
        const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 4) this.moved = true;
        this.target.yaw = this.drag.yaw - dx * 0.006;
        this.target.pitch = Math.max(-1.2, Math.min(1.2, this.drag.pitch + dy * 0.004));
      }
      this.pick(e.clientX, e.clientY, false);
    });
    addEventListener('pointerup', (e) => {
      if (!this.active || !this.drag) return;
      const click = !this.moved;
      this.drag = null;
      if (click && e.target === c) this.pick(e.clientX, e.clientY, true);
    });
    c.addEventListener('wheel', (e) => {
      if (!this.active) return;
      e.preventDefault();
      if (e.shiftKey) this.target.ty -= e.deltaY * 0.3;
      else this.target.dist = Math.max(40, Math.min(1500, this.target.dist * Math.exp(e.deltaY * 0.0012)));
    }, { passive: false });
  }

  /** Niveau sous la souris (intersection avec le plan de coupe). */
  private pick(px: number, py: number, click: boolean) {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(((px - r.left) / r.width) * 2 - 1, -((py - r.top) / r.height) * 2 + 1);
    this.ray.setFromCamera(ndc, this.camera);
    const n = new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw));
    const plane = new THREE.Plane(n, 0);
    const hit = new THREE.Vector3();
    if (!this.ray.ray.intersectPlane(plane, hit) || Math.hypot(hit.x, hit.z) > R_SILO + 2) {
      if (!click) { this.tipEl.classList.add('hidden'); this.hover = -1; }
      return;
    }
    let label = '', sel: Sel | null = null, key = -1;
    if (hit.y > floorY(1) + LH) { label = 'Le dôme'; sel = { type: 'above', i: 0 }; }
    else if (hit.y < GEN_TOP) {
      const i = hit.y > GEN_FLOOR ? 0 : hit.y > VOID_TOP ? 1 : 2;
      label = BELOW[i].title; sel = { type: 'below', i };
    } else {
      const lv = Math.max(1, Math.min(NLEV, levelOf(hit.y)));
      const info = levelInfo(lv);
      label = `${lv} · ${info.title}`; sel = { type: 'level', n: lv }; key = lv;
    }
    if (click && sel) this.select(sel);
    else {
      this.hover = key;
      this.tipEl.classList.remove('hidden');
      this.tipEl.textContent = label;
      this.tipEl.style.left = `${px + 14}px`;
      this.tipEl.style.top = `${py + 10}px`;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Image
  // ---------------------------------------------------------------------------------------------
  update(dt: number) {
    const k = 1 - Math.exp(-dt * 6);
    const T = this.target;
    this.yaw += (T.yaw - this.yaw) * k;
    this.pitch += (T.pitch - this.pitch) * k;
    this.dist += (T.dist - this.dist) * k;
    this.ty += (T.ty - this.ty) * k;
    const cam = this.camera;
    cam.position.set(Math.sin(this.yaw) * Math.cos(this.pitch) * this.dist, this.ty + Math.sin(this.pitch) * this.dist, Math.cos(this.yaw) * Math.cos(this.pitch) * this.dist);
    cam.lookAt(0, this.ty, 0);
    cam.updateMatrixWorld();
    // plan de coupe vertical passant par l'axe, face à la caméra
    const nx = Math.sin(this.yaw), nz = Math.cos(this.yaw);
    shared.uClip.value.set(nx, 0, nz, 0);
    this.rock.rotation.y = this.yaw;
    this.rock.position.set(-nx * 0.08, 0, -nz * 0.08);
    this.rockMat.uniforms.uAxis.value.set(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
    // éclairage de maquette
    this.fog.density = 0.00012;
    shared.uAmbUp.value.set(0.16, 0.17, 0.18);
    shared.uAmbDown.value.set(0.08, 0.075, 0.07);
    const sd = new THREE.Vector3(Math.sin(this.yaw + 0.7), 0.5, Math.cos(this.yaw + 0.7)).normalize();
    shared.uSunDir.value.set(sd.x, sd.y, sd.z, -1e9);
    shared.uSunCol.value.set(0.55, 0.5, 0.44);
    // mise en évidence : survol, sinon sélection
    const hl = this.hover > 0 ? this.hover : this.sel?.type === 'level' ? this.sel.n : -1;
    if (hl > 0) shared.uHi.value.set(floorY(hl) - SLAB, floorY(hl) + LH - SLAB, this.hover > 0 ? 1 : 0.7);
    else shared.uHi.value.set(0, 0, 0);
    this.refreshInstances();
    // règle
    const v = new THREE.Vector3();
    const side = new THREE.Vector3(Math.cos(this.yaw), 0, -Math.sin(this.yaw)).multiplyScalar(-(R_SILO + 6));
    for (const r of this.ruler) {
      v.set(side.x, r.y, side.z).project(cam);
      const vis = v.z < 1 && Math.abs(v.x) < 1.1 && Math.abs(v.y) < 1.05;
      r.el.style.display = vis ? '' : 'none';
      if (vis) {
        r.el.style.left = `${((v.x + 1) / 2) * innerWidth - r.el.offsetWidth - 4}px`;
        r.el.style.top = `${((1 - v.y) / 2) * innerHeight - 9}px`;
      }
    }
  }

  /** Touches (flèches : niveau voisin, Entrée : visiter). */
  key(e: KeyboardEvent) {
    if (!this.active) return false;
    const cur = this.sel?.type === 'level' ? this.sel.n : 1;
    if (e.code === 'ArrowDown') { this.select({ type: 'level', n: Math.min(NLEV, cur + 1) }); return true; }
    if (e.code === 'ArrowUp') { this.select({ type: 'level', n: Math.max(1, cur - 1) }); return true; }
    if (e.code === 'PageDown') { this.select({ type: 'level', n: Math.min(NLEV, cur + 10) }); return true; }
    if (e.code === 'PageUp') { this.select({ type: 'level', n: Math.max(1, cur - 10) }); return true; }
    if (e.code === 'Enter' && this.sel?.type === 'level') { this.onVisit(this.sel.n); return true; }
    return false;
  }
}

export type { RGB };
