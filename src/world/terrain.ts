// Relief de la surface, commun aux workers (génération) et au thread principal (caméra du capteur).
// Chaque silo est enterré sous une butte ; la sortie du Silo 18 est une tranchée dans l'axe du sas.
import { R_SILO } from '../config';

/** Axe du sas du niveau 1 (le même que dans gen/special.ts). */
export const EXIT_A = Math.PI / 2;
/** Rayon de la porte extérieure du sas, pente de la rampe. */
export const RAMP_R0 = R_SILO + 7.6;
export const RAMP_SLOPE = 0.3;
export const TRENCH_HW = 2.6;

/** Autres silos visibles (Silo 17 : abandonné, ouvert). */
export const SILOS: { n: number; x: number; z: number; dead?: boolean }[] = [
  { n: 18, x: 0, z: 0 },
  { n: 17, x: -470, z: 330, dead: true },
  { n: 19, x: 430, z: 290 },
  { n: 16, x: -40, z: 620 },
  { n: 20, x: 520, z: -260 },
  { n: 15, x: -560, z: -210 },
  { n: 21, x: 60, z: -560 },
  { n: 14, x: -880, z: 520 },
  { n: 22, x: 900, z: 120 },
  { n: 23, x: 380, z: 820 },
  { n: 13, x: -420, z: 900 },
];

/** Capteur : position (sur la butte, face à la ville) et direction de visée. */
export const SENSOR = { x: 6, z: 64, yaw: 0 };
/** Arbre mort sur la colline visible à l'écran. */
export const TREE = { x: -24, z: 205 };

function h2(x: number, z: number) {
  let h = Math.sin(x * 127.1 + z * 311.7) * 43758.5453;
  return h - Math.floor(h);
}
function vnoise(x: number, z: number) {
  const ix = Math.floor(x), iz = Math.floor(z);
  const fx = x - ix, fz = z - iz;
  const ux = fx * fx * (3 - 2 * fx), uz = fz * fz * (3 - 2 * fz);
  const a = h2(ix, iz), b = h2(ix + 1, iz), c = h2(ix, iz + 1), d = h2(ix + 1, iz + 1);
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz;
}

/** Hauteur « naturelle » (sans la tranchée). */
export function naturalH(x: number, z: number): number {
  let h = 3 + 6 * vnoise(x / 260, z / 260) + 2.2 * vnoise(x / 70 + 7, z / 70 + 3) + 0.5 * vnoise(x / 13, z / 13);
  // vallée qui mène vers la ville (au nord, +z) et creux vers le Silo 17
  h -= 4 * Math.exp(-(((x + 230) / 260) ** 2)) * Math.min(1, Math.max(0, (z - 120) / 300));
  for (const s of SILOS) {
    const d2 = (x - s.x) ** 2 + (z - s.z) ** 2;
    h += 21 * Math.exp(-d2 / (74 * 74));
  }
  // colline de l'arbre mort, face au capteur
  h += 7 * Math.exp(-((x - TREE.x) ** 2 + (z - TREE.z) ** 2) / (60 * 60));
  return h;
}

/** Hauteur de la rampe de sortie à la distance r de l'axe du silo 18. */
export const rampY = (r: number) => (r - RAMP_R0) * RAMP_SLOPE;

/** Hauteur du sol, tranchée de sortie comprise. */
export function terrainH(x: number, z: number): number {
  const h = naturalH(x, z);
  // tranchée : dans l'axe du sas, le sol est ramené au niveau de la rampe
  const ux = Math.cos(EXIT_A), uz = Math.sin(EXIT_A);
  const along = x * ux + z * uz, across = -x * uz + z * ux;
  if (along > RAMP_R0 - 2 && along < 140) {
    const ry = rampY(Math.max(RAMP_R0, along));
    if (ry < h && h - ry < 6.5) {
      const w = Math.abs(across);
      if (w < TRENCH_HW) return Math.max(0, ry) - 0.6;
      // talus de la tranchée
      const k = Math.min(1, (w - TRENCH_HW) / 6);
      if (w < TRENCH_HW + 6) return Math.max(ry, Math.min(h, ry + (h - ry) * k * k));
    }
  }
  return h;
}
