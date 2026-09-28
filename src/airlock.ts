// Le sas du niveau 1 : portes coulissantes, décontamination, combinaison et casque,
// simulation de la visière, oxygène, nettoyage du capteur, retour (ou non) dans le silo.
import * as THREE from 'three';
import { PAL, STYLE, hex } from './config';
import type { DynBox, LayeredCollision } from './physics';
import { makeGeometry } from './render/geo';
import { Steam } from './render/steam';
import { Accum, type LightSrc } from './world/builder';
import { SENSOR, terrainH } from './world/terrain';

type State = 'idle' | 'inOpen' | 'inWait' | 'inClose' | 'cycle' | 'outOpen' | 'outWait' | 'outClose' | 'burn';

function doorGeo(w: number, h: number, t: number, heavy: boolean) {
  const a = new Accum();
  const c = heavy ? hex(0x5a5c56) : hex(0x4a5250);
  a.addBox(-w / 2, 0, -t / 2, w / 2, h, t / 2, c, STYLE.SOLID, 3, 0, 1);
  if (heavy) {
    for (let i = 0; i < 6; i++) a.addBox(-w / 2 + i * (w / 6), 0.15, t / 2, -w / 2 + i * (w / 6) + w / 12, 0.45, t / 2 + 0.02, i % 2 ? hex(0x141210) : hex(0xc8a020), STYLE.SOLID, 0, 0, 2);
    a.addBox(-0.5, h / 2 - 0.5, -t / 2 - 0.08, 0.5, h / 2 + 0.5, -t / 2, hex(0x3a3a36), STYLE.BRASS, 0, 0, 0);
  } else {
    a.addBox(-0.22, 1.5, -t / 2 - 0.02, 0.22, 1.9, t / 2 + 0.02, hex(0xd8e8e0), STYLE.GLASS, 0, 0.4, 0);
    a.addBox(-0.3, 1.05, -t / 2 - 0.08, 0.3, 1.1, -t / 2, hex(0x9a8a50), STYLE.BRASS, 0, 0, 0);
  }
  return makeGeometry(a.arrays());
}

export interface AirlockDef { a: number; rIn: number; rOut: number; y: number; hw: number }
export interface AirlockHooks {
  toast: (s: string, ms?: number) => void;
  prompt: (html: string) => void;
  suit: (html: string | null) => void;
  visor: (on: boolean) => void;
  setSim: (on: boolean) => void;
  sound: (k: 'clank' | 'hiss' | 'fire' | 'knock' | 'wipe') => void;
  fade: (k: number) => void;
  lose: () => void;
}

export class Airlock {
  group = new THREE.Group();
  private def: AirlockDef | null = null;
  private inner: THREE.Mesh;
  private outer: THREE.Mesh;
  private dIn: DynBox;
  private dOut: DynBox;
  private openIn = 0;
  private openOut = 0;
  state: State = 'idle';
  private t = 0;
  private dir: 'out' | 'in' = 'out';
  private mist: Steam | null = null;
  private fire: Steam | null = null;
  private fireLight: LightSrc = { x: 0, y: -9999, z: 0, r: 0, g: 0, b: 0, radius: 7 };
  suitOn = false;
  oxygen = 0;
  private cleaning = -1;
  private loseT = -1;
  /** Le joueur a-t-il déjà nettoyé ? */
  cleaned = 0;

  constructor(private col: LayeredCollision, mat: THREE.Material, private hooks: AirlockHooks) {
    this.inner = new THREE.Mesh(doorGeo(2.6, 3.0, 0.22, false), mat);
    this.outer = new THREE.Mesh(doorGeo(2.9, 3.4, 0.4, true), mat);
    this.group.add(this.inner, this.outer);
    this.group.visible = false;
    this.dIn = col.addDyn();
    this.dOut = col.addDyn();
  }

  get light() { return this.fireLight; }

  /** Définition fournie par le niveau 1 chargé (null : déchargé). */
  setDef(d: AirlockDef | null) {
    if (d && this.def && d.rIn === this.def.rIn) return;
    this.def = d;
    this.group.visible = !!d;
    this.dIn.enabled = !!d;
    this.dOut.enabled = !!d;
    this.mist?.dispose(); this.fire?.dispose();
    this.mist = this.fire = null;
    if (!d) return;
    const em: { x: number; y: number; z: number; size: number; rise: number; n: number; tint: [number, number, number] }[] = [];
    const fe: typeof em = [];
    for (let k = 0; k < 6; k++) {
      const z = d.rIn + 1 + (k * (d.rOut - d.rIn - 2)) / 5;
      em.push({ x: (k % 2 ? -1 : 1) * 0.8, y: d.y + 2.4, z, size: 0.9, rise: -1.8, n: 14, tint: [0.62, 0.64, 0.62] });
      fe.push({ x: (k % 2 ? -1 : 1) * 1.1, y: d.y + 2.3, z, size: 0.7, rise: -1.4, n: 16, tint: [1.0, 0.45, 0.12] });
    }
    this.mist = new Steam(em);
    this.fire = new Steam(fe);
    this.mist.points.visible = this.fire.points.visible = false;
    this.group.add(this.mist.points, this.fire.points);
    this.fireLight.x = 0; this.fireLight.z = (d.rIn + d.rOut) / 2; this.fireLight.y = d.y + 1.6;
  }

  setPixelScale(h: number, fov: number) { this.mist?.setPixelScale(h, fov); this.fire?.setPixelScale(h, fov); }

  private go(s: State) { this.state = s; this.t = 0; }

  /** Retourne true si E a été consommé. */
  update(dt: number, p: THREE.Vector3, ePressed: boolean, outside: boolean): boolean {
    let used = false;
    const d = this.def;
    this.t += dt;
    if (d) {
      const z = p.z, inX = Math.abs(p.x) < d.hw + 1.2, nearY = Math.abs(p.y - d.y) < 2.5;
      const inChamber = inX && nearY && z > d.rIn + 0.4 && z < d.rOut - 0.4;
      const silSide = z < d.rIn - 0.2, outSide = z > d.rOut + 0.2;
      switch (this.state) {
        case 'idle':
          if (inX && nearY && silSide && z > d.rIn - 3.2) {
            this.hooks.prompt('<b>[E]</b> Demander à sortir · ouvrir le sas');
            if (ePressed) { this.dir = 'out'; this.go('inOpen'); this.hooks.sound('clank'); used = true; }
          } else if (inX && outSide && z < d.rOut + 3.5 && p.y < d.y + 6) {
            this.hooks.prompt('<b>[E]</b> Frapper à la porte du sas');
            if (ePressed) { this.dir = 'in'; this.go('outOpen'); this.hooks.sound('knock'); this.hooks.toast('PERSONNE N’EST JAMAIS REVENU… LA PORTE S’OUVRE POURTANT', 3600); used = true; }
          } else this.hooks.prompt('');
          break;
        case 'inOpen':
          this.openIn = Math.min(1, this.openIn + dt / 1.8);
          if (this.openIn >= 1) this.go(this.dir === 'out' ? 'inWait' : 'inWait');
          break;
        case 'inWait':
          if (this.dir === 'out' && inChamber) { this.go('inClose'); this.hooks.sound('clank'); }
          else if (this.dir === 'in' && silSide && z < d.rIn - 1.2) { this.go('inClose'); this.hooks.sound('clank'); this.suit(false); }
          else if (this.t > 12 && !inChamber) { this.go('inClose'); this.hooks.sound('clank'); }
          break;
        case 'inClose':
          this.openIn = Math.max(0, this.openIn - dt / 1.8);
          if (this.openIn <= 0) {
            if (this.dir === 'out' && inChamber) { this.go('cycle'); this.hooks.sound('hiss'); this.hooks.toast('DÉCONTAMINATION · COMBINAISON SCELLÉE', 3200); this.suit(true); }
            else if (this.dir === 'in' && inChamber) { this.go('cycle'); this.hooks.sound('hiss'); }
            else this.go('idle');
          }
          break;
        case 'cycle':
          if (this.mist) this.mist.points.visible = true;
          if (this.t > 4.5) {
            if (this.mist) this.mist.points.visible = false;
            if (this.dir === 'out') { this.go('outOpen'); this.hooks.sound('clank'); }
            else { this.go('inOpen'); this.hooks.sound('clank'); }
          }
          break;
        case 'outOpen':
          this.openOut = Math.min(1, this.openOut + dt / 2.6);
          if (this.openOut >= 1) this.go('outWait');
          break;
        case 'outWait':
          if (this.dir === 'out' && outSide && z > d.rOut + 2) { this.go('outClose'); this.hooks.sound('clank'); }
          else if (this.dir === 'in' && inChamber && z < d.rOut - 1.2) { this.go('outClose'); this.hooks.sound('clank'); }
          else if (this.t > 20 && !inChamber) { this.go('outClose'); }
          break;
        case 'outClose':
          this.openOut = Math.max(0, this.openOut - dt / 2.6);
          if (this.openOut <= 0) {
            if (this.dir === 'out') { this.go('burn'); this.hooks.sound('fire'); }
            else if (inChamber) { this.go('cycle'); this.hooks.sound('hiss'); }
            else this.go('idle');
          }
          break;
        case 'burn': {
          if (this.fire) this.fire.points.visible = true;
          const f = this.t < 3 ? 0.7 + 0.3 * Math.sin(this.t * 40) : 0;
          this.fireLight.r = 3.0 * f; this.fireLight.g = 1.4 * f; this.fireLight.b = 0.4 * f;
          if (this.t > 3) { if (this.fire) this.fire.points.visible = false; this.go('idle'); }
          break;
        }
      }
      // portes : intérieure coulisse sur le côté, extérieure se lève
      this.inner.position.set(-this.openIn * 2.5, d.y, d.rIn);
      this.outer.position.set(0, d.y + this.openOut * 3.3, d.rOut);
      const setBox = (b: DynBox, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number) => { b.min[0] = x0; b.min[1] = y0; b.min[2] = z0; b.max[0] = x1; b.max[1] = y1; b.max[2] = z1; b.dy = 0; };
      setBox(this.dIn, -1.3 - this.openIn * 2.5, d.y, d.rIn - 0.11, 1.3 - this.openIn * 2.5, d.y + 3.0, d.rIn + 0.11);
      setBox(this.dOut, -1.45, d.y + this.openOut * 3.3, d.rOut - 0.2, 1.45, d.y + 3.4 + this.openOut * 3.3, d.rOut + 0.2);
    }

    // combinaison : oxygène, capteur, fin
    if (this.suitOn) {
      if (outside && this.loseT < 0) this.oxygen -= dt;
      const m = Math.max(0, Math.floor(this.oxygen / 60)), s = Math.max(0, Math.floor(this.oxygen % 60));
      this.hooks.suit(`COMBINAISON · OXYGÈNE ${m}:${String(s).padStart(2, '0')}<br>VISIÈRE : ${this.simLabel} · <b>[V]</b>`);
      // nettoyage du capteur
      const sd = Math.hypot(p.x - SENSOR.x, p.z - SENSOR.z);
      if (outside && sd < 2.6 && Math.abs(p.y - terrainH(SENSOR.x, SENSOR.z)) < 2.5) {
        if (this.cleaning < 0) {
          this.hooks.prompt('<b>[E]</b> Nettoyer la lentille du capteur (laine)');
          if (ePressed) { this.cleaning = 0; used = true; this.hooks.sound('wipe'); }
        } else {
          this.cleaning += dt;
          this.hooks.prompt(`Nettoyage… ${Math.min(100, Math.round((this.cleaning / 3.5) * 100))} %`);
          if (this.cleaning > 3.5) { this.cleaning = -1; this.cleaned++; this.hooks.toast('LA LENTILLE EST PROPRE · À LA CAFÉTÉRIA, LA VUE S’ÉCLAIRCIT', 4000); this.onClean?.(); }
        }
      } else if (outside && this.cleaning >= 0) this.cleaning = -1;
      if (this.oxygen <= 0 && this.loseT < 0) { this.loseT = 0; this.hooks.toast('L’AIR DU DEHORS PASSE LES JOINTS…', 3000); }
      if (this.loseT >= 0) {
        this.loseT += dt;
        this.hooks.fade(Math.min(1, this.loseT / 3));
        if (this.loseT > 3.5) { this.loseT = -1; this.suit(false); this.hooks.fade(0); this.hooks.lose(); }
      }
    }
    return used;
  }

  onClean: (() => void) | null = null;
  private sim = true;
  get simLabel() { return this.sim ? 'SIMULATION' : 'RÉALITÉ'; }
  toggleVisor() {
    if (!this.suitOn) return;
    this.sim = !this.sim;
    this.hooks.setSim(this.sim);
    this.hooks.toast(this.sim ? 'VISIÈRE : LE MONDE QU’ON VOUS MONTRE' : 'VISIÈRE RELEVÉE : LE MONDE TEL QU’IL EST', 3000);
  }

  suit(on: boolean) {
    this.suitOn = on;
    this.hooks.visor(on);
    if (on) { this.oxygen = 300; this.sim = true; this.hooks.setSim(true); }
    else { this.hooks.suit(null); this.hooks.setSim(false); this.sim = true; }
  }
}

void PAL;
