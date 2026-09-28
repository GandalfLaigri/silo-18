// Catalogue des motifs plaqués (lettres et chiffres au pochoir, plaques, affiches, graffitis).
// Les dessins sont produits dans render/decals.ts ; ici : identifiants et proportions (utilisables dans les workers).

export type TileKind = 'glyph' | 'plate' | 'poster' | 'graffiti' | 'hazard' | 'arrow' | 'stripes' | 'wire';
export interface TileSpec { id: number; w: number; h: number; kind: TileKind; text?: string; sub?: string; variant?: number }

const T: TileSpec[] = [];
const add = (kind: TileKind, w: number, h: number, text?: string, sub?: string, variant = 0) => {
  T.push({ id: T.length, kind, w, h, text, sub, variant });
  return T.length - 1;
};

/** Jeu de caractères au pochoir (une case par caractère, chasse fixe). */
export const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ÉÈÀÇÊÔ-·.,:!?\'/°+()';
export const GLYPH_W = 20, GLYPH_H = 32;
export const GLYPH: Record<string, number> = {};
for (const ch of CHARSET) GLYPH[ch] = add('glyph', GLYPH_W, GLYPH_H, ch);

/** Plaque unie (fond de panneau), avec liseré. */
export const PLATE = {
  dark: add('plate', 16, 16, undefined, undefined, 0),
  cream: add('plate', 16, 16, undefined, undefined, 1),
  red: add('plate', 16, 16, undefined, undefined, 2),
  yellow: add('plate', 16, 16, undefined, undefined, 3),
  teal: add('plate', 16, 16, undefined, undefined, 4),
  white: add('plate', 16, 16, undefined, undefined, 5),
};

export const POSTER = {
  pacte: add('poster', 64, 96, 'LE PACTE', 'NOUS PROTÈGE', 0),
  reliques: add('poster', 64, 96, 'RELIQUES', 'SIGNALEZ-LES', 1),
  tirage: add('poster', 64, 96, 'TIRAGE', 'CAFÉTÉRIA N°1', 2),
  liberte: add('poster', 64, 96, 'JOUR DE LA', 'LIBERTÉ', 3),
  eau: add('poster', 64, 96, "L'EAU", 'EST PRÉCIEUSE', 4),
  nuit: add('poster', 64, 96, 'EXTINCTION', 'DES FEUX 22 H', 5),
  porteurs: add('poster', 64, 96, 'PORTEURS', 'PRIORITÉ', 6),
  fecondite: add('poster', 64, 96, 'LOTERIE', 'DE FÉCONDITÉ', 7),
  maire: add('poster', 64, 96, 'VOTEZ', 'JAHNS', 8),
  juliette: add('poster', 64, 96, 'NOTRE MAIRE', 'NICHOLS', 9),
};
export const POSTERS_S1 = [POSTER.pacte, POSTER.reliques, POSTER.tirage, POSTER.liberte, POSTER.eau, POSTER.nuit, POSTER.porteurs, POSTER.fecondite, POSTER.maire];
export const POSTERS_S3 = [POSTER.pacte, POSTER.eau, POSTER.nuit, POSTER.porteurs, POSTER.juliette, POSTER.juliette, POSTER.liberte];

export const GRAFFITI = {
  juliette: add('graffiti', 128, 48, 'JULIETTE VIT', undefined, 0),
  ment: add('graffiti', 128, 48, "L'IT MENT", undefined, 1),
  teddy: add('graffiti', 128, 48, 'LIBÉREZ TEDDY', undefined, 2),
  dehors: add('graffiti', 128, 48, 'ET SI DEHORS...', undefined, 3),
  mechanical: add('graffiti', 128, 48, 'MÉCANIQUE !', undefined, 4),
};
export const GRAFFITI_S1 = [GRAFFITI.dehors, GRAFFITI.mechanical];
export const GRAFFITI_S3 = [GRAFFITI.juliette, GRAFFITI.ment, GRAFFITI.teddy, GRAFFITI.juliette];

export const HAZARD = add('hazard', 32, 32);
export const ARROW = { up: add('arrow', 32, 32, undefined, undefined, 0), down: add('arrow', 32, 32, undefined, undefined, 1) };
export const STRIPES = add('stripes', 32, 16);

export const TILES: readonly TileSpec[] = T;
