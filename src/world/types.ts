import type { RGB } from '../config';
import type { Cone, GeoArrays, LightSrc, SteamEmitter } from './builder';
import type { Rect, Side } from './geom';

/** Silhouettes des habitants du silo. */
export type PedKind =
  | 'resident' | 'porter' | 'deputy' | 'judicial' | 'mechanic' | 'it' | 'child' | 'farmer' | 'medic' | 'elder' | 'raider';

/** Tracé 3D (x, y, z) parcouru en boucle (closed) ou en aller-retour. */
export interface PedPath { pts: [number, number, number][]; closed: boolean; count: number; kinds?: PedKind[]; pause?: number }
/**
 * pose : 0 debout · 1 assis · 2 discute · 3 prie · 4 travaille · 5 lit · 6 agenouillé · 7 danse
 * · 8 assis, écrit · 9 allongé · 10 mains devant · 11 harangue · 12 porte une charge.
 */
export interface PedIdle { x: number; y: number; z: number; yaw: number; pose?: number; kind?: PedKind; scale?: number }
export interface PedDefs { paths: PedPath[]; idle: PedIdle[] }

export interface Dest { name: string; x: number; y: number; z: number; yaw: number; level: number }
export interface Zone { name: string; x: number; z: number; r: number; y0: number; y1: number }
export interface Interior { r: Rect; y0: number; y1: number; name: string }

/**
 * Motif plaqué (affiche, lettre, plaque…) : centre, normale horizontale (nx, nz) vers l'observateur,
 * dimensions, teinte (lettres et plaques), lueur, usure. up : posé au sol, lisible depuis la direction (nx, nz).
 */
export interface DecalDef { x: number; y: number; z: number; nx: number; nz: number; w: number; h: number; tile: number; glow: number; wear: number; tint?: RGB; up?: boolean }

/** Écran montrant l'extérieur (vue du capteur) : centre, côté, dimensions. */
export interface ScreenDef { x: number; y: number; z: number; side: Side; w: number; h: number }

export type { Side };

/** Élément animé du décor. */
export type Mover =
  | { kind: 'fan'; x: number; y: number; z: number; r: number; speed: number }
  | { kind: 'turbine'; x: number; y: number; z: number; r: number; h: number }
  | { kind: 'belt'; x: number; y: number; z: number }
  | { kind: 'pulley'; x: number; z: number; y0: number; y1: number; w: number };

/** Résultat de la génération d'un niveau (transféré du worker vers le thread principal). */
export interface LevelOut {
  key: string;
  level: number;
  y0: number;
  y1: number;
  chunks: { detail: boolean; geo: GeoArrays }[];
  colliders: Float32Array;
  lights: LightSrc[];
  cones: Cone[];
  steam: SteamEmitter[];
  decals: DecalDef[];
  peds: PedDefs;
  zones: Zone[];
  dests: Dest[];
  interiors: Interior[];
  screens: ScreenDef[];
  movers: Mover[];
  grates: { r: Rect; y: number }[];
  airlock?: { a: number; rIn: number; rOut: number; y: number; hw: number };
  glows: Glow[];
  ms: number;
}

/** Coque lointaine d'un type de niveau (sans intérieurs), instanciée à chaque niveau éloigné. */
export interface ShellOut {
  key: string;
  chunks: GeoArrays[];
  ms: number;
}

export type Era = 's1' | 's3';

export interface Glow { x: number; y: number; z: number; r: number; color: RGB }
