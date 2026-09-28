import { ZONES, levelInfo } from './world/levels';
import type { Dest } from './world/types';

const $ = (id: string) => document.getElementById(id)!;

export class Hud {
  private lvlN = $('lvlN');
  private lvlZ = $('lvlZ');
  private title = $('title');
  private zone = $('zone');
  private mode = $('mode');
  private clock = $('clock');
  private prompt = $('prompt');
  private fps = $('fps');
  private toastEl = $('toast');
  private help = $('help');
  private dests = $('dests');
  private suit = $('suit');
  private toastTimer = 0;
  private frames = 0;
  private acc = 0;
  private lastLevel = -1;
  onPick: (d: Dest) => void = () => {};

  setLevel(n: number, label?: string) {
    const key = `${n}|${label ?? ''}`;
    if (key === String(this.lastLevel)) return;
    this.lastLevel = key as unknown as number;
    if (label) {
      this.lvlN.textContent = label;
      this.lvlZ.textContent = '';
      this.title.textContent = '';
      return;
    }
    const info = levelInfo(n);
    this.lvlN.textContent = String(n);
    this.lvlZ.textContent = ZONES[info.zone].short;
    this.lvlZ.style.color = ZONES[info.zone].color;
    this.title.textContent = info.title;
  }

  setZone(name: string) {
    if (this.zone.textContent !== name) this.zone.textContent = name;
  }
  setMode(s: string) {
    if (this.mode.textContent !== s) this.mode.textContent = s;
  }
  setClock(s: string) {
    if (this.clock.textContent !== s) this.clock.textContent = s;
  }
  setPrompt(html: string) {
    if (this.prompt.innerHTML !== html) this.prompt.innerHTML = html;
  }
  setSuit(html: string | null) {
    this.suit.classList.toggle('hidden', !html);
    if (html && this.suit.innerHTML !== html) this.suit.innerHTML = html;
  }
  toggleHelp() {
    this.help.classList.toggle('hidden');
  }
  toast(msg: string, ms = 2800) {
    this.toastEl.textContent = msg;
    this.toastEl.classList.add('on');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('on'), ms);
  }
  tick(dt: number, extra = '') {
    this.frames++;
    this.acc += dt;
    if (this.acc > 0.5) {
      this.fps.textContent = `${Math.round(this.frames / this.acc)} IPS${extra}`;
      this.frames = 0;
      this.acc = 0;
    }
  }

  /** Liste des lieux (touche M). */
  showDests(list: Dest[] | null) {
    if (!list) { this.dests.classList.add('hidden'); return; }
    this.dests.innerHTML = '<h3>LIEUX À PROXIMITÉ</h3>';
    for (const d of list) {
      const b = document.createElement('button');
      b.innerHTML = `<span>N${d.level}</span>${d.name}`;
      b.addEventListener('click', () => this.onPick(d));
      this.dests.appendChild(b);
    }
    const hint = document.createElement('div');
    hint.className = 'hint';
    hint.textContent = 'Cliquez pour vous y rendre · la vue d’ensemble (Tab) mène à tous les niveaux · M ou Échap pour fermer';
    this.dests.appendChild(hint);
    this.dests.classList.remove('hidden');
  }
}
