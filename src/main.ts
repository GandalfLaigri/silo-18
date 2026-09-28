import * as THREE from 'three';
import { Airlock } from './airlock';
import { HiveAudio, type AudioProfile } from './audio';
import { DETAIL_FAR, GEN_FLOOR, GEN_TOP, NLEV, R_GAL, VOID_TOP, floorY, landingAngle, levelOf } from './config';
import { Hud } from './hud';
import { Outside } from './outside';
import { Overview } from './overview';
import { Input, Player } from './player';
import { createPedMaterial, createVoxelMaterial, shared } from './render/materials';
import { Post } from './render/post';
import { hashString } from './rng';
import { Silo } from './silo';
import { levelInfo, zoneOf } from './world/levels';
import type { Dest, Era } from './world/types';

// ---------------------------------------------------------------------------
// Rendu
// ---------------------------------------------------------------------------
const canvas = document.getElementById('view') as HTMLCanvasElement;
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
let pixelRatio = Math.min(devicePixelRatio, 1);
renderer.setPixelRatio(pixelRatio);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;

const scene = new THREE.Scene();
const fog = new THREE.FogExp2(0x0a0d0f, 0.007);
scene.fog = fog;
scene.background = new THREE.Color(0x0a0d0f);
const camera = new THREE.PerspectiveCamera(76, innerWidth / innerHeight, 0.1, 7000);
camera.layers.enable(1);

const voxelMat = createVoxelMaterial();
const pedMat = createPedMaterial();
const post = new Post(renderer, scene, camera);
const audio = new HiveAudio();
const input = new Input();
const hud = new Hud();

const $ = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
const menu = $('menu');
const hudEl = $('hud');
const visorEl = $('visor');
const playBtn = $<HTMLButtonElement>('play');
const ovBtn = $<HTMLButtonElement>('ovBtn');
const status = $('status');
const optBloom = $<HTMLInputElement>('optBloom');
const optAO = $<HTMLInputElement>('optAO');
const optVox = $<HTMLInputElement>('optVox');
const optRes = $<HTMLSelectElement>('optRes');
const optSens = $<HTMLInputElement>('optSens');
const optFov = $<HTMLInputElement>('optFov');
const optVol = $<HTMLInputElement>('optVol');
const optLum = $<HTMLInputElement>('optLum');
const optGamma = $<HTMLInputElement>('optGamma');
const optNear = $<HTMLSelectElement>('optNear');
const optGammaV = $('optGammaV');
const optEra = $<HTMLSelectElement>('optEra');
const optStart = $<HTMLSelectElement>('optStart');

const params = new URLSearchParams(location.search);
let era: Era = params.get('epoque') === 's3' ? 's3' : 's1';
optEra.value = era;
if (params.get('niveau')) optStart.value = params.get('niveau')!;
const seed = hashString(params.get('seed') ?? 'silo-18');

let silo = new Silo(voxelMat, pedMat, era, seed);
scene.add(silo.group);
const player = new Player(silo.col);
const overview = new Overview(canvas, post, () => silo, fog, voxelMat);
scene.add(overview.group);
const outside = new Outside(() => silo, renderer, fog);
scene.add(outside.group, outside.screensGroup);

// ---------------------------------------------------------------------------
// Placement du joueur
// ---------------------------------------------------------------------------
/** Position sur le palier du niveau n, tourné vers la passerelle. */
function landingSpot(n: number): Dest {
  const a = landingAngle(n);
  return { name: `Niveau ${n}`, level: n, x: Math.cos(a) * 7.3, y: floorY(n), z: Math.sin(a) * 7.3, yaw: Math.atan2(-Math.cos(a), -Math.sin(a)) };
}
let waitLoad = true;          // le joueur reste suspendu tant que son niveau n'est pas chargé
let lastGroundY = 0;
function place(d: Dest) {
  if (player.fly) player.toggleFly();
  player.spawn(d.x, d.y + 0.05, d.z, d.yaw, 0);
  waitLoad = true;
  lastGroundY = d.y;
  silo.update(Math.max(1, Math.min(NLEV, levelOf(d.y + 1))));
}

// ---------------------------------------------------------------------------
// Sas et combinaison
// ---------------------------------------------------------------------------
let fadeK = 0;
const airlock = new Airlock(silo.col, voxelMat, {
  toast: (s, ms) => hud.toast(s, ms),
  prompt: (h) => { airPrompt = h; },
  suit: (h) => hud.setSuit(h),
  visor: (on) => visorEl.classList.toggle('hidden', !on),
  setSim: (on) => outside.setSim(on),
  sound: (k) => { if (k === 'clank') audio.clank(); else if (k === 'hiss') audio.hiss(); else if (k === 'fire') audio.fire(); else if (k === 'knock') audio.knock(); else audio.wipe(); },
  fade: (k) => { fadeK = k; },
  lose: () => {
    const s = silo.dests.find((d) => d.name.startsWith('Cafétéria du niveau 1'));
    place(s ?? landingSpot(1));
    hud.toast('VOTRE COMBINAISON A CÉDÉ · AU NIVEAU 1, ON REGARDE L’ÉCRAN EN SILENCE', 5000);
  },
});
scene.add(airlock.group);
airlock.onClean = () => { outside.dirt = 0.04; };
let airPrompt = '';

// ---------------------------------------------------------------------------
// Menu / options
// ---------------------------------------------------------------------------
let locked = false;
let started = false;
let destMode = false;
function lockPointer() {
  const p = canvas.requestPointerLock() as unknown as Promise<void> | undefined;
  p?.catch?.(() => {});
}

function applyOptions() {
  post.bloom.enabled = optBloom.checked;
  post.bloom.strength = 0.3;
  post.bloom.radius = 0.35;
  post.setGrade([1.0, 1.0, 0.98], 0.84);
  post.ao.mat.uniforms.uEnabled.value = optAO.checked ? 1 : 0;
  const near = parseInt(optNear.value, 10) || 3;
  if (near !== silo.nearR) { silo.nearR = near; if (silo.shellsReady) silo.update(silo.center); }
  const res = parseFloat(optRes.value);
  const pr = res > 1 ? Math.min(devicePixelRatio, res) : res;
  if (Math.abs(pr - pixelRatio) > 1e-3) { pixelRatio = pr; onResize(); }
  camera.fov = parseFloat(optFov.value);
  camera.updateProjectionMatrix();
  player.sensitivity = 0.002 * parseFloat(optSens.value);
  audio.setVolume(parseFloat(optVol.value));
  const lum = parseFloat(optLum.value);
  renderer.toneMappingExposure = 0.82 * lum;
  // gamma d'affichage : > 1 éclaircit les tons sombres sans brûler les lumières
  const gamma = parseFloat(optGamma.value);
  post.gamma = (1.02 - (lum - 1) * 0.22) / gamma;
  optGammaV.textContent = gamma.toFixed(2).replace('.', ',');
  airlock.setPixelScale(renderer.getDrawingBufferSize(new THREE.Vector2()).y, camera.fov);
  try {
    localStorage.setItem('silo-lum', optLum.value);
    localStorage.setItem('silo-gamma', optGamma.value);
    localStorage.setItem('silo-near', optNear.value);
  } catch { /* stockage indisponible */ }
}
try {
  const v = localStorage.getItem('silo-lum');
  if (v) optLum.value = v;
  const g = localStorage.getItem('silo-gamma');
  if (g) optGamma.value = g;
  const nr = localStorage.getItem('silo-near');
  if (nr) optNear.value = nr;
} catch { /* stockage indisponible */ }
for (const el of [optBloom, optAO, optRes, optNear, optSens, optFov, optVol, optLum, optGamma]) el.addEventListener('input', applyOptions);
optGamma.addEventListener('dblclick', () => { optGamma.value = '1'; applyOptions(); });

function boot() {
  playBtn.disabled = true;
  ovBtn.disabled = true;
  playBtn.textContent = 'CHARGEMENT…';
  status.textContent = 'Coulée du béton, pose des 4 320 marches…';
  const t0 = performance.now();
  silo.loadShells((k, n) => { status.textContent = `Coques des niveaux : ${k} / ${n}`; }).then(() => {
    silo.requestShell('ov', (geos) => overview.setOverviewLevel(geos));
    silo.requestShell('below', (geos) => overview.setBelow(geos));
    outside.load();
    place(landingSpot(parseInt(optStart.value, 10) || 12));
    status.textContent = `Silo prêt en ${((performance.now() - t0) / 1000).toFixed(1)} s · ${era === 's1' ? 'saison 1, an 143' : 'saison 3, an 144 (après la rébellion)'}`;
    playBtn.disabled = false;
    ovBtn.disabled = false;
    playBtn.textContent = started ? 'REPRENDRE' : 'ENTRER DANS LE SILO';
  });
}

optEra.addEventListener('change', () => {
  // changer d'époque régénère tout le silo : on recharge la page avec le nouveau paramètre
  params.set('epoque', optEra.value);
  params.set('niveau', optStart.value);
  location.search = `?${params.toString()}`;
});
optStart.addEventListener('change', () => { if (silo.shellsReady) place(landingSpot(parseInt(optStart.value, 10))); });

playBtn.addEventListener('click', () => { audio.start(); lockPointer(); });

// ---------------------------------------------------------------------------
// Vue d'ensemble
// ---------------------------------------------------------------------------
function openOverview() {
  if (!silo.shellsReady || overview.active) return;
  overview.era = era;
  overview.enter(Math.max(1, Math.min(NLEV, levelOf(player.pos.y + 0.5))));
  menu.classList.add('hidden');
  hudEl.classList.add('hidden');
  visorEl.classList.add('hidden');
  if (document.pointerLockElement) document.exitPointerLock();
}
function closeOverview(visit?: number) {
  if (!overview.active) return;
  overview.exit();
  post.setCamera(camera);
  if (visit !== undefined) place(landingSpot(visit));
  silo.update(Math.max(1, Math.min(NLEV, levelOf(player.pos.y + 0.5))));
  curLevel = -1;
  if (airlock.suitOn) visorEl.classList.remove('hidden');
  if (started) { hudEl.classList.remove('hidden'); lockPointer(); }
  else menu.classList.remove('hidden');
}
overview.onVisit = (n) => { started = true; audio.start(); closeOverview(n); };
ovBtn.addEventListener('click', () => { audio.start(); openOverview(); });
addEventListener('keydown', (e) => {
  if (e.code === 'Tab') {
    e.preventDefault();
    if (overview.active) closeOverview();
    else if (locked || (started && !destMode)) openOverview();
    return;
  }
  if (overview.active) {
    if (e.code === 'Escape') closeOverview();
    else if (overview.key(e)) e.preventDefault();
  }
});

document.addEventListener('pointerlockchange', () => {
  locked = document.pointerLockElement === canvas;
  if (!locked && (destMode || overview.active)) return;
  menu.classList.toggle('hidden', locked);
  hudEl.classList.toggle('hidden', !locked && !started);
  if (locked && !started) {
    started = true;
    const n = Math.max(1, levelOf(player.pos.y + 1));
    hud.toast(`NIVEAU ${n} · ${levelInfo(n).title.toUpperCase()}`);
  }
  if (!locked) playBtn.textContent = 'REPRENDRE';
});
canvas.addEventListener('click', () => {
  if (!locked && started && !destMode && !overview.active) lockPointer();
});

function openDests() {
  destMode = true;
  hud.showDests([...silo.dests].sort((a, b) => a.level - b.level));
  document.exitPointerLock();
}
function closeDests(relock = true) {
  destMode = false;
  hud.showDests(null);
  if (relock) lockPointer();
}
hud.onPick = (d) => {
  place(d);
  hud.toast(d.name.toUpperCase());
  closeDests(true);
};
addEventListener('keydown', (e) => {
  if (!destMode) return;
  if (e.key.toLowerCase() === 'm' || e.code === 'Escape') closeDests(e.code !== 'Escape');
});

function onResize() {
  renderer.setPixelRatio(pixelRatio);
  renderer.setSize(innerWidth, innerHeight, false);
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  post.resize();
  overview.onResize();
}
addEventListener('resize', onResize);

// ---------------------------------------------------------------------------
// Jour, nuit, annonces
// ---------------------------------------------------------------------------
let clock = 9 * 60 + 40;      // minutes (heure du silo)
let night = false;
function setNight(on: boolean) {
  night = on;
  clock = on ? 23 * 60 + 10 : 9 * 60 + 40;
  hud.toast(on ? 'NUIT · EXTINCTION DES FEUX, SEULS LES PORTEURS CIRCULENT' : 'JOUR · LES LAMPES DU SILO SE RALLUMENT');
}
const ANNOUNCES: Record<Era, string[]> = {
  s1: [
    'Rappel à tous les résidents : les ascenseurs sont interdits par le Pacte. Merci d’emprunter l’escalier.',
    'Le moulin du niveau cinquante-neuf est de nouveau en panne. Les porteurs sont priés de descendre le grain vers les moulins inférieurs.',
    'Avis de Mechanical : une coupure de courant de huit heures est prévue pour la réparation du générateur.',
    'Tirage au sort des places de la cafétéria du niveau un : présentez-vous au poste du shérif.',
    'Toute relique doit être remise au Judiciaire. La possession d’une relique est un crime.',
    'Extinction des feux à vingt-deux heures. Bonne nuit, Silo dix-huit.',
    'Le Pacte nous protège. Souvenez-vous de la rébellion.',
  ],
  s3: [
    'Réunion publique cette semaine au niveau un. La maire Nichols remercie les résidents pour leur patience.',
    'Travaux de la Brèche : les palans provisoires sont réservés aux équipes de reconstruction.',
    'Rappel : les caméras de l’IT ont été désactivées. Le Conseil du silo s’engage pour la vérité et la transparence.',
    'L’eau est précieuse. Signalez toute fuite au traitement des eaux.',
    'Extinction des feux à vingt-deux heures. Bonne nuit, Silo dix-huit.',
  ],
};
let announceAt = 30;
function say(text: string) {
  try {
    const s = window.speechSynthesis;
    if (!s || parseFloat(optVol.value) <= 0) return;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'fr-FR';
    const v = s.getVoices().find((x) => x.lang.startsWith('fr'));
    if (v) u.voice = v;
    u.rate = 0.95; u.pitch = 0.85;
    u.volume = Math.min(1, parseFloat(optVol.value) * 0.7);
    s.cancel();
    s.speak(u);
  } catch { /* synthèse vocale indisponible */ }
}

// ---------------------------------------------------------------------------
// Ambiance
// ---------------------------------------------------------------------------
const PROFILE_IN: AudioProfile = { hum: 1, rumble: 0.5, wind: 0.25, drips: 0, sludge: 0, choir: 0, hammer: 0, siren: false, bells: false, gunfire: 0, music: 'none', vox: false, birds: 0 };
const PROFILE_OUT: AudioProfile = { ...PROFILE_IN, hum: 0, rumble: 0.1, wind: 1.3, birds: 1 };
const fogCol = new THREE.Color();

function ambience(y: number, isOut: boolean) {
  if (isOut) {
    outside.applyOutdoorFog();
    scene.background = fog.color;
    audio.setProfile({ ...PROFILE_OUT, birds: outside.sim ? 1 : 0 });
    return;
  }
  const n = Math.max(1, Math.min(NLEV, levelOf(y)));
  const deep = THREE.MathUtils.clamp((n - 100) / 44, 0, 1);
  const k = night ? 0.6 : 1;
  fogCol.setRGB((0.018 + deep * 0.02) * k, (0.022 + deep * 0.008) * k, (0.026 - deep * 0.008) * k);
  if (y < GEN_TOP) fogCol.setRGB(0.05, 0.03, 0.018);
  if (y < VOID_TOP) fogCol.setRGB(0.012, 0.022, 0.024);
  fog.color.copy(fogCol);
  fog.density = y < VOID_TOP ? 0.012 : 0.0068 + deep * 0.003;
  scene.background = fog.color;
  shared.uAmbUp.value.set(0.024 * k, 0.028 * k, 0.032 * k);
  shared.uAmbDown.value.set((0.02 + deep * 0.012) * k, (0.018 + deep * 0.004) * k, 0.016 * k);
  shared.uPower.value = night ? 0.45 : 1;
  const z = zoneOf(n);
  audio.setProfile({ ...PROFILE_IN, rumble: 0.35 + deep * 0.9 + (y < GEN_TOP ? 1.2 : 0), drips: z === 'bas' || y < GEN_TOP ? 0.6 : 0, hum: night ? 0.7 : 1 });
}

// ---------------------------------------------------------------------------
// Boucle
// ---------------------------------------------------------------------------
const noInput = new Input(false);
let time = 0;
let last = performance.now();
let debugActive = false;
let curLevel = -1;
let curZone = '';
let stepAcc = 0, stepN = 0;
const slow = { t: 0, crowd: 0, detail: 0, screens: 0 };
let voiceSaid = false;

function frame() {
  requestAnimationFrame(frame);
  const now = performance.now();
  const dt = Math.min((now - last) / 1000, 1 / 20);
  last = now;
  tick(dt, true);
}

function zoneAt(x: number, y: number, z: number): string {
  let best = '', bd = 1e9;
  for (const zn of silo.zones) {
    if (y < zn.y0 || y > zn.y1) continue;
    const d = Math.hypot(zn.x - x, zn.z - z);
    if (d < zn.r && d < bd) { bd = d; best = zn.name; }
  }
  if (!best) {
    const r = Math.hypot(x, z);
    best = r < 9 ? 'Escalier central' : r < R_GAL ? 'Puits' : r < 20.5 ? 'Coursive' : '';
  }
  return best;
}

function tick(dt: number, render: boolean) {
  time += dt;
  shared.uTime.value = time;
  hud.tick(dt, ` · ${silo.levels.size} niv.`);
  if (overview.active) {
    overview.update(dt);
    outside.update(overview.camera.position, player.pos, true);
    silo.tick(dt, player.pos, time, overview.camera.position, 1);
    if (time - slow.detail > 0.15) { slow.detail = time; silo.cullDetails(overview.camera.position, 400); }
    if (render) post.render();
    input.endFrame();
    return;
  }
  const active = (locked || debugActive) && !destMode;
  const inp = active ? input : noInput;
  const P = player;
  let ePressed = false;

  if (active) {
    if (input.hitChar('f')) { P.toggleFly(); hud.toast(P.fly ? 'VOL LIBRE' : 'À PIED'); }
    if (input.hitChar('m') && locked) openDests();
    if (input.hitChar('h')) hud.toggleHelp();
    if (input.hitChar('n')) setNight(!night);
    if (input.hitChar('v')) airlock.toggleVisor();
    ePressed = input.hitChar('e');
  }

  // attendre que le niveau sous les pieds soit chargé
  const here = Math.max(1, Math.min(NLEV, levelOf(P.pos.y + 0.5)));
  if (waitLoad && !P.fly && silo.isLoaded(here) && (here >= NLEV || silo.isLoaded(here + 1))) waitLoad = false;
  if (!waitLoad || P.fly) P.update(dt, inp);
  else { P.yaw -= inp.dx * P.sensitivity; P.pitch = Math.max(-1.55, Math.min(1.55, P.pitch - inp.dy * P.sensitivity)); }
  if (P.grounded) lastGroundY = P.pos.y;
  if (!P.fly && P.pos.y < lastGroundY - 14) {
    hud.toast('VOUS ÊTES PASSÉ PAR-DESSUS LA RAMBARDE…', 3600);
    place(landingSpot(Math.max(1, Math.min(NLEV, levelOf(lastGroundY + 0.5)))));
  }
  if (P.grounded && !P.fly) {
    const hs = Math.hypot(P.vel.x, P.vel.z);
    stepAcc += hs * dt;
    const stride = 1.1 + 0.1 * hs;
    if (stepAcc > stride) { stepAcc -= stride; stepN++; }
  } else stepAcc = Math.min(stepAcc, 0.9);

  P.applyCamera(camera);
  camera.updateMatrixWorld();
  const camY = camera.position.y;
  const camLevel = Math.max(1, Math.min(NLEV, levelOf(camY)));
  if (camLevel !== curLevel) {
    curLevel = camLevel;
    silo.update(camLevel);
  }
  const isOut = outside.update(camera.position, P.pos, false);
  const pOut = Outside.isOutside(P.pos);
  if (isOut || camY > 6) hud.setLevel(1, isOut ? 'SURFACE' : undefined);
  else if (camY < VOID_TOP) hud.setLevel(NLEV, 'CAVITÉ');
  else if (camY < GEN_TOP) hud.setLevel(NLEV, 'GÉNÉRATEUR');
  else hud.setLevel(camLevel);
  hud.setMode(P.fly ? 'VOL LIBRE' : waitLoad ? 'CHARGEMENT DU NIVEAU…' : airlock.suitOn ? 'EN COMBINAISON' : 'À PIED');
  const zone = pOut ? 'Dehors' : zoneAt(P.pos.x, P.pos.y, P.pos.z);
  if (zone !== curZone) {
    curZone = zone;
    hud.setZone(zone);
    if (zone === 'Le Coffre avancé' && !voiceSaid) { voiceSaid = true; hud.toast('UNE VOIX, DERRIÈRE LA PORTE : « QUI ÊTES-VOUS ? »', 5000); }
  }
  // heure du silo
  clock = (clock + dt * 2) % (24 * 60);
  const hh = Math.floor(clock / 60), mm = Math.floor(clock % 60);
  hud.setClock(`${night ? 'NUIT' : 'JOUR'} · ${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')} · AN ${era === 's1' ? 143 : 144}`);

  // sas, combinaison, capteur
  airPrompt = '';
  const l1 = silo.levels.get(1)?.out.airlock ?? null;
  airlock.setDef(l1);
  if (airlock.update(dt, P.pos, ePressed, pOut)) ePressed = false;
  hud.setPrompt(airPrompt);
  post.fade = fadeK;
  outside.dirt = Math.min(0.85, outside.dirt + dt * 0.0004);

  ambience(camY, isOut);
  silo.tick(dt, P.pos, time, camera.position, night ? 0.25 : 1);
  if (time - slow.detail > 0.15) { slow.detail = time; silo.cullDetails(camera.position, DETAIL_FAR); }
  if (time - slow.screens > 0.5) {
    slow.screens = time;
    outside.syncScreens([...silo.levels.values()].flatMap((l) => l.out.screens.map((s, i) => ({ key: `${l.n}:${i}`, s }))));
    const ex = silo.extraLights;
    if (!ex.includes(airlock.light)) { ex.push(airlock.light, ...outside.lights.map((l) => ({ ...l }))); silo.rebuildLights(); }
  }
  outside.renderFeed(scene, camera.position);

  // son
  if (audio.ctx) {
    if (time - slow.t > 0.3) { slow.t = time; slow.crowd = silo.crowdNear(P.pos, 14); }
    const r = Math.hypot(P.pos.x, P.pos.z);
    audio.update({
      altitude: isOut ? 180 : 60, abyss: isOut ? 0 : Math.max(0, 1 - Math.max(0, r - 8) / 14), crowd: slow.crowd, steam: 99,
      forge: P.pos.y < GEN_TOP + 8 ? Math.hypot(P.pos.x, P.pos.z, P.pos.y - (GEN_FLOOR + 8)) : 999, music: 999,
      lamp: silo.lights.nearestDist, inElevator: false, elevatorMoving: false, steps: P.grounded && !P.fly ? stepN : -1,
      run: P.speed > 6, surface: isOut ? 'wet' : 'stone', indoor: !isOut && r > 21 && r < 40, outdoor: isOut ? 1 : 0, birds: isOut && outside.sim ? 1 : 0, slams: [],
    }, time);
    if (!isOut && optVox.checked && time > announceAt) {
      announceAt = time + 80 + Math.random() * 70;
      const lines = ANNOUNCES[era];
      audio.voxChime();
      const text = lines[Math.floor(Math.random() * lines.length)];
      setTimeout(() => say(text), 1400);
    }
  }
  if (render) post.render();
  input.endFrame();
}

applyOptions();
boot();
frame();

// Accès de débogage (développement) : window.silo
if (import.meta.env.DEV) {
  (window as any).silo = {
    get silo() { return silo; }, player, camera, scene, post, shared, fog, overview, outside, airlock,
    go(n: number) { place(landingSpot(n)); },
    view(x: number, y: number, z: number, yaw = 0, pitch = 0, fly = true) {
      if (player.fly !== fly) player.toggleFly();
      player.spawn(x, y, z, yaw, pitch);
      waitLoad = false;
      menu.classList.add('hidden');
      hudEl.classList.remove('hidden');
    },
    step(seconds: number) {
      debugActive = true;
      const n = Math.round(seconds * 60);
      for (let i = 0; i < n; i++) tick(1 / 60, i === n - 1);
      debugActive = false;
    },
    press(code: string) { input.pressed.add(code); },
    key(ch: string) { input.chars.add(ch); },
    hold(code: string, on = true) { if (on) input.keys.add(code); else input.keys.delete(code); },
    mouse(dx: number, dy: number) { input.dx += dx; input.dy += dy; },
  };
}
