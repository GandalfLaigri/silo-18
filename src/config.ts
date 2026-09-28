// Dimensions du Silo 18 (mètres). Axe du silo en (x, z) = (0, 0), y vers le haut.
// Le plancher du niveau 1 est en y = 0 ; le niveau n est à y = -(n - 1) · LH.
export const V = 0.1;              // taille d'un voxel
export const LH = 6;               // hauteur d'un niveau (plancher à plancher)
export const SLAB = 0.6;           // épaisseur des dalles
export const NLEV = 144;           // nombre de niveaux
export const CEIL_H = LH - SLAB;   // hauteur libre sous la dalle du niveau supérieur

// Rayons (depuis l'axe)
export const R_CORE = 2.4;         // noyau central de l'escalier (béton, tuyaux, lampes)
export const R_STEP = 6.4;         // bord extérieur des marches
export const R_PARA = 6.75;        // parapet extérieur de l'escalier
export const R_LAND = 8.6;         // bord extérieur des paliers
export const R_GAL = 16;           // bord intérieur des coursives (parapet)
export const R_COL = 16.6;         // axe des grandes colonnes (prises dans le parapet)
export const COL_R = 0.75;         // rayon des colonnes
export const N_COL = 12;           // nombre de colonnes
export const R_FAC = 20.4;         // façade des niveaux (face côté puits)
export const FAC_T = 0.4;          // épaisseur de la façade
export const R_OUT = 40;           // face intérieure du mur d'enceinte
export const R_SILO = 41.2;        // face extérieure du mur d'enceinte

// Escalier : un palier par niveau, en alternance à l'est (+x) et à l'ouest (-x).
export const STEPS = 30;           // contremarches de 0,20 m par niveau
export const LAND_HALF = (26 * Math.PI) / 180;   // demi-ouverture angulaire d'un palier
export const FLIGHT = Math.PI - 2 * LAND_HALF;   // arc parcouru par une volée (sens horaire en descendant)

export const floorY = (n: number) => -(n - 1) * LH;
/** Niveau auquel appartient l'altitude y (dalle comprise). */
export const levelOf = (y: number) => Math.floor((-y + CEIL_H) / LH) + 1;
/** Angle (radians, atan2(z, x)) du centre du palier du niveau n. */
export const landingAngle = (n: number) => (n % 2 === 1 ? 0 : Math.PI);

// Au-dessus et au-dessous des niveaux
export const DOME_Y = CEIL_H;                // naissance du dôme au-dessus du niveau 1
export const DOME_H = 15;                    // flèche du dôme
export const SURFACE_Y = 26;                 // sol extérieur au-dessus du silo
export const GEN_TOP = floorY(NLEV) - SLAB;  // plafond de la salle du générateur
export const GEN_H = 21;                     // hauteur de la salle du générateur
export const GEN_FLOOR = GEN_TOP - GEN_H;
export const CAP_T = 9.1;                    // dalle de 30 pieds au-dessus de la cavité
export const VOID_TOP = GEN_FLOOR - CAP_T;
export const VOID_H = 30;
export const VOID_FLOOR = VOID_TOP - VOID_H;

export const NUM_PL = 30;          // lumières ponctuelles actives simultanément
export const CHUNK = 48;           // chunks de géométrie courante
export const DETAIL_CHUNK = 24;    // chunks de détails fins
export const DETAIL_FAR = 55;      // distance d'affichage des détails fins

export const STYLE = {
  SOLID: 0,      // béton banché (extra 0), tôle (1), peinture propre (2)
  HAB: 1,        // (réservé)
  EMISSIVE: 2,   // source lumineuse (extra : clignotement)
  DECK: 3,       // plaques de sol
  GRATE: 4,      // caillebotis ajouré
  GLASS: 5,      // verre dépoli éclairé
  FURNACE: 6,    // métal en fusion
  SCREEN: 7,     // écran cathodique vert
  BRASS: 8,      // métal poli / laiton (reflets)
  CLOTH: 9,      // étoffe
  ROCK: 10,      // roche brute
  PIPE: 11,      // tuyauterie
  STONE: 12,     // (réservé)
  FLESH: 13,     // peau, bois ciré, plastique mat
  SHOP: 14,      // devanture éclairée
  SLUDGE: 15,    // eau croupie
  FALL: 16,      // chute d'eau
  FUNGUS: 17,    // (réservé)
  MARBLE: 18,    // carrelage poli
  FOLIAGE: 19,   // feuillage, cultures
  WATER: 20,     // eau claire
  OFFICE: 21,    // (réservé)
  CORRUGATED: 22, // tôle ondulée
  BELT: 23,      // tapis roulant
  PANEL: 24,     // murs intérieurs peints (soubassement, joints)
  TILE: 25,      // sol carrelé / linoléum
  GRILLE: 26,    // grille lumineuse à lamelles (dôme, bouches)
  WOOD: 27,      // bois (tables, étagères, portes)
  SOIL: 28,      // terre cultivée
  TERRAIN: 29,   // sol de la surface (terre morte ; herbe dans la simulation du casque)
} as const;

/** Terrain : taille d'un chunk proche (m) et quantification des hauteurs. */
export const T_CHUNK = 64;
export const T_QUANT = 0.2;

export type RGB = [number, number, number];

export const hex = (h: number): RGB => [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255];

// Palette du silo : béton gris-bleu, peintures passées, lampes chaudes.
export const PAL = {
  concrete: [hex(0x646a6c), hex(0x5e6467), hex(0x6a6e6e), hex(0x585e61), hex(0x70736f)] as RGB[],
  concreteDark: hex(0x3e4345),
  concreteLight: hex(0x8a8c86),
  metal: [hex(0x3a3d3f), hex(0x2f3336), hex(0x45474a), hex(0x2a2c2e)] as RGB[],
  rail: hex(0x2c3033),
  rust: hex(0x5a3a26),
  brass: hex(0x9a8050),
  steel: hex(0x80868a),
  paint: [hex(0x8c8878), hex(0x7a8a84), hex(0x9a8e70), hex(0x6e7c80), hex(0x8a7a66), hex(0x7c806c)] as RGB[],
  door: [hex(0x3d5a5a), hex(0x6a5a3a), hex(0x5a3a32), hex(0x3a4a5a), hex(0x4a5040), hex(0x6a6a60)] as RGB[],
  wood: hex(0x6a4a30),
  woodDark: hex(0x3e2c1e),
  lamp: hex(0xffd49a),        // ampoule chaude
  tube: hex(0xdcecff),        // tube fluorescent
  drum: hex(0xfff2dc),        // bagues lumineuses des colonnes
  sodium: hex(0xffa84a),
  grow: hex(0xffe8ff),        // lampes de culture
  growPink: hex(0xff70d8),
  red: hex(0xff3020),
  green: hex(0x60ff90),
  furnace: hex(0xff6a18),
  screen: hex(0x9ad8ff),
  water: hex(0x3a6a70),
  soil: hex(0x3a2a1c),
  wheat: hex(0xb89a48),
  leaf: hex(0x4a7a32),
  cloth: [hex(0x7a3a2a), hex(0x3a4a6a), hex(0x6a6a4a), hex(0x5a3a4a), hex(0x8a7a5a), hex(0x3a5a4a)] as RGB[],
  banner: [hex(0x8a2a1a), hex(0xb07a2a), hex(0x2a3a5a), hex(0x3a5a3a)] as RGB[],
};
