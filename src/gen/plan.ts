// Plan d'un niveau : découpage de l'anneau habitable en unités (logements, boutiques, grandes salles),
// couloir circulaire, ouvertures de façade. Angles en radians (atan2(z, x)), croissants.
import { FAC_T, R_FAC, R_OUT, landingAngle } from '../config';
import { RNG } from '../rng';
import type { LevelInfo, PlaceKey } from '../world/levels';
import { deg, TAU } from './common';
import { normAngle } from '../world/voxel2d';

export const RA0 = R_FAC + FAC_T;   // début de la zone avant (derrière la façade)
export const RA1 = 27.0;            // mur entre zone avant et couloir (27,0 → 27,2)
export const RC0 = 27.2;
export const RC1 = 29.2;            // mur entre couloir et zone arrière (29,2 → 29,4)
export const RB0 = 29.4;
export const RB1 = R_OUT;
export const WALL = 0.2;
export const ROOM_CEIL = 2.9;       // faux plafond des logements (au-dessus : gaines)

export type UnitKind = 'appart' | 'boutique' | 'atelier' | 'bureau' | 'service' | 'passage' | 'salle';

export interface Unit {
  zone: 'A' | 'B' | 'AB';
  a0: number;
  a1: number;
  kind: UnitKind;
  /** Programme particulier des grandes salles et des lieux nommés. */
  sub?: string;
  /** Angle de la porte (A : façade ; B : mur du couloir) ; null : pas de porte. */
  door: number | null;
  open: boolean;
  name?: string;
  label?: string;
  /** Enseigne au-dessus de l'entrée (façade). */
  sign?: string;
  /** Entrées supplémentaires en façade (grandes salles) : angle, largeur, hauteur. */
  entries?: { a: number; w: number; h: number; kind?: 'passage' | 'portal' | 'door' }[];
  /** Façade vitrée (fermes, parc, salles vitrées). */
  glazed?: boolean;
  seed: number;
}

export type OpeningKind = 'door' | 'passage' | 'shop' | 'window' | 'portal' | 'upper';
export interface Opening { a: number; w: number; y0: number; y1: number; kind: OpeningKind; closed?: boolean; seed: number; unit?: Unit }

export interface Plan {
  units: Unit[];
  openings: Opening[];
  /** Plages angulaires du couloir circulaire (a0, a1). */
  corridor: [number, number][];
  /** Grandes baies vitrées en façade (fermes). */
  glazing: [number, number][];
}

const midA = (RA0 + RA1) / 2;
const midB = (RB0 + RB1) / 2;

interface Big { a0: number; a1: number; sub: string; name: string; kind?: UnitKind; glazed?: boolean; entries?: Unit['entries']; zone?: 'AB' | 'A' }

/** Grandes salles propres à chaque type de niveau (angles relatifs au palier φ). */
function bigUnits(info: LevelInfo, phi: number, rng: RNG): Big[] {
  const has = (k: PlaceKey) => info.places.some((p) => p.key === k);
  const at = (d0: number, d1: number) => [phi + deg(d0), phi + deg(d1)] as const;
  const B: Big[] = [];
  const add = (d0: number, d1: number, sub: string, name: string, extra: Partial<Big> = {}) => {
    const [a0, a1] = at(d0, d1);
    B.push({ a0, a1, sub, name, ...extra });
  };
  switch (info.kind) {
    case 'sommet':
      add(-58, 58, 'cafeteria', 'Cafétéria du niveau 1', { entries: [{ a: phi, w: 7.5, h: 4.4, kind: 'portal' }, { a: phi + deg(-40), w: 2.2, h: 2.6, kind: 'door' }, { a: phi + deg(40), w: 2.2, h: 2.6, kind: 'door' }] });
      add(62, 104, 'sherif', 'Poste du shérif', { entries: [{ a: phi + deg(83), w: 1.6, h: 2.4, kind: 'door' }] });
      add(196, 236, 'bureaux1', 'Bureaux du niveau 1', { kind: 'bureau', entries: [{ a: phi + deg(216), w: 1.4, h: 2.3, kind: 'door' }] });
      break;
    case 'bureaux':
      if (has('it')) {
        add(-42, 42, 'it', 'Département IT', { entries: [{ a: phi, w: 3.2, h: 3.0, kind: 'portal' }] });
        add(150, 200, 'combinaisons', 'Salle des combinaisons', { kind: 'atelier', zone: 'A', entries: [{ a: phi + deg(175), w: 1.4, h: 2.3, kind: 'door' }] });
      } else if (has('judiciaire')) {
        add(-40, 40, 'judiciaire', 'Judiciaire', { entries: [{ a: phi, w: 3.0, h: 3.0, kind: 'portal' }] });
      } else if (has('maire')) {
        add(-30, 30, 'maire', 'Bureau du maire', { entries: [{ a: phi, w: 2.4, h: 2.8, kind: 'portal' }] });
      } else if (has('porteurs')) {
        add(-30, 30, 'porteurs', 'Répartition des porteurs', { entries: [{ a: phi, w: 3.4, h: 3.0, kind: 'portal' }] });
      }
      break;
    case 'ferme':
      add(8, 352, 'ferme', info.title, { glazed: true, entries: [{ a: phi + deg(90), w: 2.6, h: 3.0, kind: 'passage' }, { a: phi + deg(180), w: 2.6, h: 3.0, kind: 'passage' }, { a: phi + deg(270), w: 2.6, h: 3.0, kind: 'passage' }, { a: phi + deg(12), w: 2.2, h: 2.6, kind: 'door' }, { a: phi + deg(348), w: 2.2, h: 2.6, kind: 'door' }] });
      break;
    case 'parc':
      add(8, 352, 'parc', 'Le Parc', { glazed: true, entries: [{ a: phi + deg(60), w: 5, h: 4.2, kind: 'portal' }, { a: phi + deg(180), w: 5, h: 4.2, kind: 'portal' }, { a: phi + deg(300), w: 5, h: 4.2, kind: 'portal' }, { a: phi + deg(14), w: 3, h: 3, kind: 'passage' }, { a: phi + deg(346), w: 3, h: 3, kind: 'passage' }] });
      break;
    case 'medical':
      if (has('pouponniere')) {
        add(-44, 44, 'hopital', 'Hôpital des Mids', { entries: [{ a: phi, w: 3.0, h: 3.0, kind: 'portal' }] });
        add(140, 200, 'soins', 'Soins de longue durée', { entries: [{ a: phi + deg(170), w: 2.2, h: 2.6, kind: 'door' }] });
      } else add(-40, 40, 'clinique', 'Centre médical', { entries: [{ a: phi, w: 3.0, h: 3.0, kind: 'portal' }] });
      break;
    case 'ecole':
      add(-50, 50, 'ecole', 'École', { entries: [{ a: phi, w: 2.8, h: 2.8, kind: 'portal' }] });
      break;
    case 'moulin':
      add(-50, 50, 'moulin', 'Le moulin', { entries: [{ a: phi, w: 4, h: 3.6, kind: 'portal' }] });
      break;
    case 'auberge':
      add(-60, 60, 'auberge', 'L’auberge', { entries: [{ a: phi, w: 4, h: 3.2, kind: 'portal' }] });
      break;
    case 'mines':
      add(-40, 40, 'mines', 'Entrée des mines', { entries: [{ a: phi, w: 5, h: 4.2, kind: 'portal' }] });
      add(150, 186, 'porteurs', 'Station de porteurs', { zone: 'A', entries: [{ a: phi + deg(168), w: 3, h: 3, kind: 'portal' }] });
      break;
    case 'approvisionnement':
      add(-70, 70, 'approvisionnement', 'Approvisionnement', { entries: [{ a: phi, w: 4.4, h: 3.6, kind: 'portal' }] });
      break;
    case 'eau':
      add(-80, 80, 'eau', 'Traitement des eaux', { entries: [{ a: phi, w: 4, h: 3.6, kind: 'portal' }] });
      break;
    case 'mecanique':
      if (has('fonderie')) add(-60, 60, 'fonderie', 'Fonderie', { entries: [{ a: phi, w: 5, h: 4.2, kind: 'portal' }] });
      else if (has('cantine_meca')) add(-55, 55, 'cantine_meca', 'Cafétéria de Mechanical', { entries: [{ a: phi, w: 6, h: 4, kind: 'portal' }] });
      else if (has('tri')) add(-50, 50, 'tri', 'Récupération et chaîne de tri', { entries: [{ a: phi, w: 4.5, h: 3.6, kind: 'portal' }] });
      else if (has('adjoints')) { add(-30, 30, 'adjoints', 'Poste des adjoints des Profondeurs', { entries: [{ a: phi, w: 2.2, h: 2.6, kind: 'door' }] }); add(140, 220, 'atelier', 'Ateliers de Mechanical', { entries: [{ a: phi + deg(180), w: 5, h: 4, kind: 'portal' }] }); }
      else if (has('dortoir')) add(130, 230, 'dortoir', 'Dortoirs de Mechanical', { entries: [{ a: phi + deg(180), w: 2.6, h: 3, kind: 'passage' }] });
      else add(-50 + rng.range(-10, 10), 50 + rng.range(-10, 10), 'atelier', 'Ateliers de Mechanical', { entries: [{ a: phi, w: 5, h: 4.2, kind: 'portal' }] });
      break;
    case 'fond':
      add(-40, 40, 'escalier_gen', 'Descente vers le générateur', { entries: [{ a: phi, w: 5, h: 4.2, kind: 'portal' }] });
      add(140, 180, 'electronique', 'Atelier d’électronique de Martha Walker', { zone: 'A', entries: [{ a: phi + deg(160), w: 1.4, h: 2.3, kind: 'door' }] });
      break;
    default:
      break;
  }
  // lieux secondaires dans les niveaux courants
  if (info.kind === 'logements' || info.kind === 'marche') {
    if (has('cafeteria')) add(-50, 50, 'cafeteria_mids', 'Cafétéria des Mids', { entries: [{ a: phi, w: 6, h: 4, kind: 'portal' }] });
    if (has('bar')) add(150, 176, 'bar', 'Bar', { zone: 'A', entries: [{ a: phi + deg(163), w: 1.6, h: 2.4, kind: 'door' }] });
    if (has('observateurs')) add(150, 172, 'observateurs', 'Salle des observateurs', { zone: 'A', kind: 'service', entries: [{ a: phi + deg(158), w: 1.0, h: 2.2, kind: 'door' }] });
  }
  return B;
}

export function makePlan(info: LevelInfo, seed: number, full: boolean): Plan {
  const rng = new RNG(seed ^ 0x51f0);
  const phi = landingAngle(info.n);
  const units: Unit[] = [];
  const bigs = bigUnits(info, phi, rng);
  // plages occupées (normalisées sur [phi, phi + 2π))
  const rel = (a: number) => normAngle(a - phi);
  const occAB: [number, number][] = [];
  const occA: [number, number][] = [];
  for (const b of bigs) {
    const r0 = rel(b.a0), r1 = r0 + (b.a1 - b.a0);
    (b.zone === 'A' ? occA : occAB).push([r0, r1]);
    units.push({ zone: b.zone ?? 'AB', a0: phi + r0, a1: phi + r1, kind: b.kind ?? 'salle', sub: b.sub, door: null, open: true, name: b.name, entries: b.entries, glazed: b.glazed, seed: rng.byte() });
  }
  // passages vers le couloir : face à la passerelle et aux quatre points cardinaux relatifs
  const passW = 2.8 / midA;
  const hits = (lo: number, hi: number, occ: [number, number][]) =>
    occ.some(([a, b]) => [-TAU, 0, TAU].some((k) => hi + k > a && lo + k < b));
  for (const d of [0, 90, 180, 270]) {
    const c = deg(d);
    const lo = c - passW / 2, hi = c + passW / 2;
    if (hits(lo - 0.02, hi + 0.02, [...occAB, ...occA])) continue;
    const l0 = normAngle(lo);
    occA.push([l0, l0 + passW]);
    units.push({ zone: 'A', a0: phi + lo, a1: phi + hi, kind: 'passage', door: phi + c, open: true, seed: rng.byte() });
  }

  // remplissage d'une zone : intervalles libres en unités de largeur variable
  const free = (occ: [number, number][]) => {
    const split: [number, number][] = [];
    for (const [a, b] of occ) {
      if (b > TAU) { split.push([a, TAU], [0, b - TAU]); } else split.push([a, b]);
    }
    const iv = split.sort((x, y) => x[0] - y[0]);
    const out: [number, number][] = [];
    let cur = 0;
    for (const [a, b] of iv) {
      if (a > cur + 1e-6) out.push([cur, a]);
      cur = Math.max(cur, b);
    }
    if (cur < TAU - 1e-6) out.push([cur, TAU]);
    return out;
  };
  const zoneKind = (zone: 'A' | 'B'): UnitKind => {
    const r = rng.next();
    const z = info.zone;
    if (info.kind === 'marche' && zone === 'A') return r < 0.7 ? 'boutique' : r < 0.85 ? 'atelier' : 'appart';
    if (info.kind === 'mecanique') return r < 0.45 ? 'atelier' : r < 0.85 ? 'appart' : 'service';
    if (info.kind === 'bureaux' || info.kind === 'sommet') return zone === 'A' ? (r < 0.4 ? 'bureau' : r < 0.85 ? 'appart' : 'service') : r < 0.3 ? 'bureau' : 'appart';
    if (zone === 'A') {
      const shop = z === 'mids' ? 0.16 : z === 'haut' ? 0.08 : 0.1;
      const work = z === 'haut' ? 0.04 : 0.1;
      return r < shop ? 'boutique' : r < shop + work ? 'atelier' : r < 0.9 ? 'appart' : 'service';
    }
    return r < 0.85 ? 'appart' : 'service';
  };
  const fill = (spans: [number, number][], zone: 'A' | 'B', rMid: number, wMin: number, wMax: number) => {
    for (const [s0, s1] of spans) {
      const len = (s1 - s0) * rMid;
      if (len < 2.5) {
        units.push({ zone, a0: phi + s0, a1: phi + s1, kind: 'service', door: null, open: false, seed: rng.byte() });
        continue;
      }
      const n = Math.max(1, Math.round(len / rng.range(wMin, wMax)));
      for (let k = 0; k < n; k++) {
        const a0 = s0 + ((s1 - s0) * k) / n, a1 = s0 + ((s1 - s0) * (k + 1)) / n;
        const kind = zoneKind(zone);
        const w = (a1 - a0) * rMid;
        const off = kind === 'boutique' ? 0 : rng.range(-0.25, 0.25) * Math.max(0, w - 2.6);
        units.push({
          zone, a0: phi + a0, a1: phi + a1, kind,
          door: kind === 'service' && rng.chance(0.5) ? null : phi + (a0 + a1) / 2 + off / rMid,
          open: kind !== 'service' && (full ? rng.chance(zone === 'A' ? 0.62 : 0.4) : false),
          seed: rng.byte(),
        });
      }
    }
  };
  fill(free([...occAB, ...occA]), 'A', midA, 5.5, 8);
  fill(free(occAB), 'B', midB, 6.5, 9);

  // couloir : partout où il n'y a pas de grande salle traversante
  const corridor = free(occAB).map(([a, b]) => [phi + a, phi + b] as [number, number]);

  // ouvertures de façade
  const openings: Opening[] = [];
  const glazing: [number, number][] = [];
  const RF = R_FAC;
  for (const u of units) {
    if (u.zone === 'B') continue;
    const s = rng.byte();
    if (u.kind === 'passage') {
      openings.push({ a: u.door!, w: Math.min(3.0, (u.a1 - u.a0) * RF - 0.4), y0: 0, y1: 3.0, kind: 'passage', seed: s, unit: u });
      continue;
    }
    if (u.entries) {
      for (const e of u.entries) openings.push({ a: e.a, w: e.w, y0: 0, y1: e.h, kind: e.kind === 'portal' ? 'portal' : e.kind === 'passage' ? 'passage' : 'door', seed: s, unit: u });
      if (u.glazed) glazing.push([u.a0, u.a1]);
      else {
        // fenêtres hautes régulières sur les grandes salles
        const w = (u.a1 - u.a0) * RF;
        const n = Math.floor(w / 4.5);
        for (let k = 0; k < n; k++) {
          const a = u.a0 + ((k + 0.5) / n) * (u.a1 - u.a0);
          if (u.entries.some((e) => Math.abs(normAngle(e.a - a + Math.PI) - Math.PI) * RF < e.w / 2 + 1.2)) continue;
          openings.push({ a, w: 1.6, y0: 1.2, y1: 2.4, kind: 'window', seed: rng.byte(), unit: u });
        }
      }
      continue;
    }
    const w = (u.a1 - u.a0) * RF;
    if (u.kind === 'boutique' && u.door !== null) {
      openings.push({ a: u.door, w: Math.min(3.2, w - 1.2), y0: 0, y1: 2.5, kind: 'shop', seed: s, unit: u, closed: !u.open });
    } else if (u.door !== null) {
      openings.push({ a: u.door, w: 1.1, y0: 0, y1: 2.2, kind: 'door', closed: !u.open, seed: s, unit: u });
      // fenêtres de part et d'autre de la porte
      for (const side of [-1, 1]) {
        const a = u.door + (side * 1.75) / RF;
        if ((a - u.a0) * RF > 1.0 && (u.a1 - a) * RF > 1.0) openings.push({ a, w: 1.2, y0: 1.0, y1: 2.0, kind: 'window', seed: rng.byte(), unit: u });
      }
    }
    // fenêtre de l'étage (gaines, séchoirs, mezzanines)
    if (w > 4 && rng.chance(0.55)) openings.push({ a: (u.a0 + u.a1) / 2 + rng.range(-0.3, 0.3) * (w - 2) / RF, w: rng.pick([0.8, 1.0, 1.4]), y0: 3.5, y1: 4.4, kind: 'upper', seed: rng.byte(), unit: u });
  }
  openings.sort((a, b) => a.a - b.a);
  return { units, openings, corridor, glazing };
}
