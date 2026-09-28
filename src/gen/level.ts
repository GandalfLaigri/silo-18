// Génération d'un niveau complet (proche) ou d'une coque lointaine (instanciée).
import { LH, NLEV, R_FAC, R_OUT, R_SILO, SLAB, STYLE, floorY, hex, landingAngle } from '../config';
import { orect, ring } from '../world/voxel2d';
import { levelInfo, zoneOf, type LevelInfo } from '../world/levels';
import type { Era, LevelOut, ShellOut } from '../world/types';
import { World } from '../world/builder';
import { atrium, dome, outerWall } from './atrium';
import { Gen, polar } from './common';
import { below, GEN_STAIR_HOLE } from './deep';
import { gap } from './gap';
import { interior, shopType } from './interior';
import { makePlan, RA0, RB0, type Plan, type Unit } from './plan';
import { AIRLOCK_A, special } from './special';

export type ShellKey = 'haut' | 'mids' | 'basmids' | 'bas' | 'ferme' | 'n1' | 'n144' | 'breche';

/** Type de coque lointaine d'un niveau. */
export function shellKey(n: number, era: Era): ShellKey {
  if (n === 1) return 'n1';
  if (n === NLEV) return 'n144';
  if (era === 's3' && n === 87) return 'breche';
  const info = levelInfo(n);
  if (info.kind === 'ferme' || info.kind === 'parc') return 'ferme';
  return zoneOf(n);
}

/** Tonalité des façades selon la zone. */
function tone(info: LevelInfo) {
  switch (info.zone) {
    case 'haut': return hex(0x76786f);
    case 'mids': return hex(0x6c6e68);
    case 'basmids': return hex(0x646662);
    default: return hex(0x5c5a56);
  }
}

/** Numéros d'appartements, enseignes, lieux nommés (avant la façade, qui les affiche). */
function label(info: LevelInfo, plan: Plan) {
  let a = 10, b = 300;
  for (const u of [...plan.units].sort((p, q) => p.a0 - q.a0)) {
    if (u.kind === 'passage' || u.zone === 'AB') continue;
    if (u.kind === 'appart' || u.kind === 'service') u.label = `${info.n}${u.zone === 'A' ? a++ : b++}`;
    if (u.kind === 'boutique') u.sign = shopType(u.seed).name;
    if (u.kind === 'atelier' && info.zone !== 'bas') u.sign = 'ATELIER';
  }
  // appartements et lieux canoniques
  const apts = info.places.filter((p) => p.key === 'appart');
  const cands = plan.units.filter((u) => u.kind === 'appart').sort((p, q) => (p.zone === 'A' ? 0 : 1) - (q.zone === 'A' ? 0 : 1));
  apts.forEach((p, i) => {
    const u = cands[i * 3 % Math.max(1, cands.length)];
    if (!u) return;
    u.open = true;
    const num = p.name.match(/\d{3,}/)?.[0];
    if (num) u.label = num;
    u.name = p.label ? `${p.name} · ${p.label}` : p.name;
  });
  for (const u of plan.units) if (u.zone === 'AB' || u.sub) u.sign = u.sign ?? SIGNS[u.sub ?? ''];
  // stations de recyclage, points radio… dans des unités de la zone avant
  const misc: [string, string][] = [];
  for (const p of info.places) {
    if (p.key === 'recyclage') misc.push(['recyclage', 'RECYCLAGE']);
    if (p.key === 'radio') misc.push(['radio', '']);
    if (p.key === 'relais') misc.push(['relais', 'IT · RELAIS']);
    if (p.key === 'controle') misc.push(['controle', 'JUDICIAIRE']);
    if (p.key === 'planque') misc.push(['planque', '']);
    if (p.key === 'reparation') misc.push(['reparation', 'RÉPARATION INFORMATIQUE']);
    if (p.key === 'adjoints' && info.kind !== 'mecanique' && !info.places.some((q) => q.key === 'cafeteria')) misc.push(['adjoints', 'ADJOINTS DU SHÉRIF']);
    if (p.key === 'barricade') misc.push(['barricade', '']);
  }
  const free = plan.units.filter((u) => u.zone === 'A' && (u.kind === 'boutique' || u.kind === 'atelier' || u.kind === 'service' || u.kind === 'bureau') && !u.sub);
  misc.forEach(([sub, sign], i) => {
    const u = free[(i * 5 + 2) % Math.max(1, free.length)];
    if (!u || u.sub) return;
    u.sub = sub; u.open = true; u.kind = 'atelier';
    if (u.door === null) u.door = (u.a0 + u.a1) / 2;
    if (sign) u.sign = sign;
    const pl = info.places.find((p) => p.key === sub);
    u.name = pl?.name;
  });
}

const SIGNS: Record<string, string> = {
  cafeteria: 'CAFÉTÉRIA', sherif: 'SHÉRIF', bureaux1: 'ADMINISTRATION', it: 'DÉPARTEMENT IT', combinaisons: 'IT · MATÉRIEL',
  judiciaire: 'JUDICIAIRE', maire: 'BUREAU DU MAIRE', porteurs: 'PORTEURS', ferme: 'FERMES', parc: 'PARC', hopital: 'HÔPITAL DES MIDS',
  soins: 'SOINS DE LONGUE DURÉE', clinique: 'CENTRE MÉDICAL', ecole: 'ÉCOLE', moulin: 'MOULIN', auberge: 'AUBERGE', mines: 'MINES',
  approvisionnement: 'APPROVISIONNEMENT', eau: 'TRAITEMENT DES EAUX', fonderie: 'FONDERIE', cantine_meca: 'CAFÉTÉRIA', tri: 'RÉCUPÉRATION',
  adjoints: 'ADJOINTS DU SHÉRIF', atelier: 'MÉCANIQUE', dortoir: 'DORTOIRS', escalier_gen: 'GÉNÉRATEUR · ACCÈS RÉSERVÉ',
  electronique: 'ÉLECTRONIQUE', cafeteria_mids: 'CAFÉTÉRIA', bar: 'BAR', observateurs: 'ENTRETIEN',
};

export function genLevel(n: number, era: Era, seed: number): LevelOut {
  const t0 = performance.now();
  const info = levelInfo(n);
  const g = new Gen(n, { era, lod: 0, seed });
  g.info = info;
  const plan = makePlan(info, seed ^ (n * 7919), true);
  label(info, plan);
  atrium(g, info, plan, { fullSlab: true, noFlight: n === NLEV, glassParapet: info.kind === 'ferme' || info.kind === 'parc', tone: tone(info), gap: era === 's3' && n === 87, slabHole: n === NLEV ? GEN_STAIR_HOLE : undefined });
  interior(g, info, plan);
  special(g, info, plan);
  if (n === 1) {
    dome(g);
    g.wallCuts.push({ a: AIRLOCK_A, hw: 1.3, y0: 0, y1: 3.0 });
  }
  if (n === NLEV) below(g, info);
  if (era === 's3' && n === 87) gap(g);
  outerWall(g);
  // zones des unités nommées
  for (const u of plan.units) if (u.name) {
    const [x, z] = polar(u.zone === 'B' ? (RB0 + 40) / 2 : u.zone === 'A' ? (RA0 + 27) / 2 : 30, (u.a0 + u.a1) / 2);
    g.zone(u.name, x, z, Math.max(3.5, ((u.a1 - u.a0) * 30) / 2));
  }
  return pack(g, `L${n}`, n, t0);
}

function pack(g: Gen, key: string, level: number, t0: number): LevelOut {
  const colliders = g.w.col.export();
  let y0 = Infinity, y1 = -Infinity;
  for (let o = 0; o < colliders.length; o += 6) { y0 = Math.min(y0, colliders[o + 1]); y1 = Math.max(y1, colliders[o + 4]); }
  if (!isFinite(y0)) { y0 = floorY(level) - LH; y1 = floorY(level) + LH; }
  return {
    key, level, y0, y1,
    chunks: g.w.chunkArrays(),
    colliders,
    lights: g.w.lights, cones: g.w.cones, steam: g.w.steam,
    decals: g.decals, peds: g.peds, zones: g.zones, dests: g.dests, interiors: g.interiors,
    screens: g.screens, movers: g.movers, grates: g.grates,
    airlock: g.airlock, glows: g.glows,
    ms: Math.round(performance.now() - t0),
  };
}

/** Coque lointaine : puits, escalier, coursive, façade ; plancher en y = 0, palier à l'est (+x). */
export function genShell(key: ShellKey, lod: 1 | 2, era: Era, seed: number): ShellOut {
  const t0 = performance.now();
  const rep: Record<ShellKey, number> = { n1: 1, n144: NLEV, breche: 87, haut: 21, mids: 67, basmids: 107, bas: 133, ferme: 81 };
  const info = levelInfo(rep[key]);
  // on construit comme un niveau impair (palier à l'est), plancher ramené en 0
  const n = rep[key] % 2 === 1 ? rep[key] : rep[key] - 1;
  const g = new Gen(n, { era, lod, seed: seed ^ 0x77 });
  g.info = info;
  g.w = new World(4096, 4096);
  g.F = 0;
  const plan = makePlan({ ...info, n }, seed ^ (rep[key] * 7919), false);
  label({ ...info, n }, plan);
  atrium(g, info, plan, { fullSlab: false, noFlight: key === 'n144', glassParapet: key === 'ferme', tone: tone(info), gap: key === 'breche' });
  if (key === 'n1') dome(g);
  if (key === 'ferme') special(g, info, plan, true);
  void landingAngle; void SLAB;
  const chunks = g.w.chunkArrays().map((c) => c.geo);
  return { key: `${key}:${lod}`, chunks, ms: Math.round(performance.now() - t0) };
}

/**
 * Vue d'ensemble : dalle pleine, mur d'enceinte et cloisons d'un niveau (plancher en y = 0),
 * instanciés à chaque niveau ; la dalle est teintée par instance (fonction du niveau).
 */
export function genOverviewLevel(seed: number): ShellOut {
  const t0 = performance.now();
  const g = new Gen(3, { era: 's1', lod: 2, seed });
  g.w = new World(4096, 4096);
  g.F = 0;
  g.res = 0.4;
  g.shape(ring(0, 0, R_FAC + 0.2, R_SILO), -SLAB, 0.02, { color: [1, 1, 1], style: STYLE.PANEL, extra: 1, seed: 1, res: 0.4, smooth: g.smooth(R_FAC + 0.2, R_SILO) });
  g.shape(ring(0, 0, R_OUT, R_SILO), 0, LH - SLAB, { color: hex(0x5a5e5e), style: STYLE.SOLID, extra: 0, seed: 2, res: 0.4, smooth: g.smooth(R_OUT, R_SILO) });
  g.shape(ring(0, 0, 27, 27.2), 0, 3.0, { color: hex(0x74766e), style: STYLE.PANEL, seed: 3, res: 0.4 });
  g.shape(ring(0, 0, 29.2, 29.4), 0, 3.0, { color: hex(0x74766e), style: STYLE.PANEL, seed: 3, res: 0.4 });
  for (let k = 0; k < 20; k++) {
    const a = (k / 20) * Math.PI * 2 + 0.07;
    const [x, z] = polar(30.4, a);
    g.shape(orect(x, z, a, 9.6, 0.12), 0, 3.0, { color: hex(0x6e7068), style: STYLE.PANEL, seed: 4, res: 0.4 });
  }
  return { key: 'ov', chunks: g.w.chunkArrays().map((c) => c.geo), ms: Math.round(performance.now() - t0) };
}

/** Sous le niveau 144, en version lointaine (vue d'ensemble). */
export function genBelowShell(seed: number): ShellOut {
  const t0 = performance.now();
  const g = new Gen(NLEV, { era: 's1', lod: 1, seed });
  g.w = new World(4096, 4096);
  g.info = levelInfo(NLEV);
  g.res = 0.3;
  below(g, g.info);
  return { key: 'below', chunks: g.w.chunkArrays().map((c) => c.geo), ms: Math.round(performance.now() - t0) };
}

export type { Unit };
