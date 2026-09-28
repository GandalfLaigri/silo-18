// Surface : relief en colonnes de voxels (chunks), tranchée et portail de sortie, capteur,
// arbre mort, corps des nettoyeurs, buttes et portails des autres silos, ville en ruine au loin.
// Trois jeux de géométrie : « réel », « simulation » (visière du casque) et commun.
import { PAL, STYLE, T_QUANT, hex, type RGB } from '../config';
import { RNG } from '../rng';
import { Accum, SKIP, World, type GeoArrays } from '../world/builder';
import { EXIT_A, RAMP_R0, SENSOR, SILOS, TREE, TRENCH_HW, naturalH, rampY, terrainH } from '../world/terrain';
import { ring } from '../world/voxel2d';

const q = (h: number) => Math.round(h / T_QUANT) * T_QUANT;

/** Colonnes de terrain d'un carré (x0, z0, taille), pas `cell` ; jupes profondes aux bords. */
export function genTerrainChunk(x0: number, z0: number, size: number, cell: number): GeoArrays {
  const a = new Accum();
  const n = Math.round(size / cell);
  const H: number[] = new Array((n + 2) * (n + 2));
  const idx = (i: number, j: number) => (j + 1) * (n + 2) + (i + 1);
  for (let j = -1; j <= n; j++) for (let i = -1; i <= n; i++) H[idx(i, j)] = q(terrainH(x0 + (i + 0.5) * cell, z0 + (j + 0.5) * cell));
  const col = hex(0x6a5e4e);
  const skirt = cell * 3;
  for (let j = 0; j < n; j++) {
    // dessus : fusion des cellules de même hauteur le long de x
    let i = 0;
    while (i < n) {
      const h = H[idx(i, j)];
      let k = i + 1;
      while (k < n && H[idx(k, j)] === h) k++;
      const xa = x0 + i * cell, xb = x0 + k * cell, za = z0 + j * cell, zb = za + cell;
      a.addBox(xa, h - 0.1, za, xb, h, zb, col, STYLE.TERRAIN, 7, 0, 0, SKIP.ALL ^ SKIP.PY);
      i = k;
    }
    // côtés vers les voisins plus bas
    for (let i2 = 0; i2 < n; i2++) {
      const h = H[idx(i2, j)];
      const xa = x0 + i2 * cell, za = z0 + j * cell;
      const nb: [number, number, number][] = [[1, 0, SKIP.PX], [-1, 0, SKIP.NX], [0, 1, SKIP.PZ], [0, -1, SKIP.NZ]];
      for (const [di, dj, bit] of nb) {
        const ii = i2 + di, jj = j + dj;
        const edge = ii < 0 || jj < 0 || ii >= n || jj >= n;
        const hn = edge ? Math.min(H[idx(ii, jj)], h) - skirt : H[idx(ii, jj)];
        if (hn >= h) continue;
        a.addBox(xa, hn, za, xa + cell, h, za + cell, col, STYLE.TERRAIN, 7, 0, 1, SKIP.ALL ^ bit);
      }
    }
  }
  return a.arrays();
}

export interface OutsideOut {
  both: GeoArrays[];
  real: GeoArrays[];
  sim: GeoArrays[];
  colliders: Float32Array;
  lights: { x: number; y: number; z: number; r: number; g: number; b: number; radius: number }[];
  ms: number;
}

/** Figure allongée (corps de nettoyeur en combinaison blanche). */
function body(w: World, x: number, z: number, ang: number, rng: RNG) {
  const y = q(terrainH(x, z));
  const ux = Math.cos(ang), uz = Math.sin(ang);
  const P = (d: number, s: number): [number, number] => [x + ux * d - uz * s, z + uz * d + ux * s];
  const suit = hex(0xd8d6ce), dirt = hex(0x9a9486);
  const part = (d: number, s: number, l: number, wd: number, h0: number, h1: number, c: RGB) => {
    const [px, pz] = P(d, s);
    w.shape(orectS(px, pz, ang, l / 2, wd / 2), y + h0, y + h1, { color: c, style: STYLE.CLOTH, seed: rng.byte(), solid: false, res: 0.1 });
  };
  part(0, 0, 0.7, 0.45, 0, 0.3, rng.chance(0.5) ? suit : dirt);                 // torse
  part(0.55, 0, 0.36, 0.36, 0, 0.34, hex(0xc8c8c0));                             // casque
  part(0.56, 0, 0.1, 0.26, 0.12, 0.3, hex(0x2a3440));                            // visière
  part(-0.62, -0.12, 0.6, 0.16, 0, 0.18, suit);                                  // jambes
  part(-0.6, 0.14, 0.6, 0.16, 0, 0.18, suit);
  part(0.15, -0.36, 0.5, 0.13, 0, 0.16, suit);                                   // bras
  part(0.1, 0.36, 0.5, 0.13, 0, 0.16, suit);
  part(0.02, 0, 0.72, 0.47, 0.12, 0.16, hex(0x3a3a3a));                          // ruban thermique
}

import { orect } from '../world/voxel2d';
const orectS = orect;

/** Portail de sortie d'un silo (tranchée, porte, mât du capteur). */
function portal(w: World, sx: number, sz: number, dir: number, open: boolean, rng: RNG) {
  const ux = Math.cos(dir), uz = Math.sin(dir);
  const P = (d: number, s: number): [number, number] => [sx + ux * d - uz * s, sz + uz * d + ux * s];
  const base = q(naturalH(...P(78, 0)));
  const conc = { color: hex(0x6a6c68), style: STYLE.SOLID, extra: 0, seed: rng.byte() };
  // mur de tête et porte
  const [fx, fz] = P(70, 0);
  w.shape(orect(fx, fz, dir, 0.6, 5), base - 1, base + 5.5, { ...conc, res: 0.2 });
  const [dx, dz] = P(69.3, 0);
  w.shape(orect(dx, dz, dir, 0.15, 1.8), base, base + 3.4, { color: open ? hex(0x1a1a18) : hex(0x5a5a50), style: open ? STYLE.SOLID : STYLE.CORRUGATED, extra: 1, seed: 3, res: 0.1, solid: !open });
  // murs de la tranchée
  for (const s of [-1, 1]) { const [mx, mz] = P(80, s * 3.2); w.shape(orect(mx, mz, dir, 10, 0.3), base - 1, base + 2.4, { ...conc, res: 0.2 }); }
  // mât du capteur
  const [cx, cz] = P(72, 4.5);
  w.box(cx - 0.12, base, cz - 0.12, cx + 0.12, base + 3.2, cz + 0.12, { color: hex(0x4a4a46), style: STYLE.BRASS });
  w.box(cx - 0.35, base + 3.2, cz - 0.3, cx + 0.35, base + 3.7, cz + 0.3, { color: hex(0x5a5a54), style: STYLE.BRASS });
}

export function genOutside(seed: number): OutsideOut {
  const t0 = performance.now();
  const rng = new RNG(seed ^ 0x0ff51de);
  const both = new World(4096, 4096), real = new World(4096, 4096), sim = new World(4096, 4096);
  const lights: OutsideOut['lights'] = [];

  // ---- sortie du Silo 18 : rampe, tunnel, portail, tranchée ------------------------------------
  const ux = Math.cos(EXIT_A), uz = Math.sin(EXIT_A);
  let rEnd = RAMP_R0;
  while (rEnd < 140 && naturalH(ux * rEnd, uz * rEnd) - rampY(rEnd) > 0.2) rEnd += 0.5;
  // marches de la rampe (0,2 m de haut) jusqu'au sol naturel
  const conc = { color: hex(0x66686a), style: STYLE.SOLID, extra: 0, seed: 11 };
  for (let r = RAMP_R0; r < rEnd; r += 0.2 / 0.3) {
    const y = q(rampY(r + 0.2 / 0.3));
    both.box(-TRENCH_HW, y - 0.4, r, TRENCH_HW, y, r + 0.2 / 0.3 + 0.01, { color: hex(0x5a5c5a), style: STYLE.DECK, seed: 12 });
  }
  // tunnel sous la butte : jusqu'à ce que la couverture de terre devienne mince
  let rTun = RAMP_R0;
  while (rTun < rEnd && naturalH(0, rTun) - rampY(rTun) >= 6.5) rTun += 0.5;
  both.box(-TRENCH_HW - 0.6, rampY(RAMP_R0) - 0.6, RAMP_R0 - 0.2, -TRENCH_HW, rampY(rTun) + 4.2, rTun, conc);
  both.box(TRENCH_HW, rampY(RAMP_R0) - 0.6, RAMP_R0 - 0.2, TRENCH_HW + 0.6, rampY(rTun) + 4.2, rTun, conc);
  for (let r = RAMP_R0; r < rTun; r += 2) {
    const y = rampY(Math.min(rTun, r + 2)) + 3.4;
    both.box(-TRENCH_HW - 0.6, y, r, TRENCH_HW + 0.6, y + 0.8, r + 2.02, { ...conc, seed: 13 });
    both.box(-0.3, y - 0.12, r + 0.8, 0.3, y, r + 1.2, { color: hex(0xdcecff), style: STYLE.EMISSIVE, emis: 2.4, extra: r % 6 < 2 ? 2 : 0, seed: 14, solid: false });
    if (Math.round(r) % 6 === 0) lights.push({ x: 0, y: y - 0.6, z: r + 1, r: 0.7, g: 0.75, b: 0.8, radius: 8 });
  }
  // murs de soutènement de la tranchée ouverte
  for (let r = rTun; r < rEnd + 2; r += 1) {
    const top = Math.max(q(naturalH(-TRENCH_HW - 0.8, r)), rampY(r) + 0.6);
    for (const s of [-1, 1]) {
      const x0 = s < 0 ? -TRENCH_HW - 0.5 : TRENCH_HW, x1 = s < 0 ? -TRENCH_HW : TRENCH_HW + 0.5;
      both.box(x0, rampY(r) - 0.6, r, x1, Math.min(top, rampY(r) + 6.5), r + 1.01, { ...conc, seed: 15 });
    }
  }
  // portail : linteau massif, numéro du silo, lampe rouge éteinte
  const yP = rampY(rTun);
  both.box(-TRENCH_HW - 1.2, yP + 3.4, rTun - 0.2, TRENCH_HW + 1.2, yP + 5.6, rTun + 0.6, { ...conc, seed: 16 });
  both.box(-0.3, yP + 4.4, rTun + 0.6, 0.3, yP + 4.7, rTun + 0.7, { color: hex(0x3a1a18), style: STYLE.SOLID, extra: 2, seed: 17 });
  // capteur sur son mât, à côté de la tranchée
  const sy = q(terrainH(SENSOR.x, SENSOR.z));
  both.box(SENSOR.x - 0.1, sy, SENSOR.z - 0.1, SENSOR.x + 0.1, sy + 1.3, SENSOR.z + 0.1, { color: hex(0x4a4a46), style: STYLE.BRASS, seed: 18 });
  both.box(SENSOR.x - 0.35, sy + 1.3, SENSOR.z - 0.45, SENSOR.x + 0.35, sy + 1.85, SENSOR.z + 0.35, { color: hex(0x6a6a62), style: STYLE.SOLID, extra: 1, seed: 19 });
  both.box(SENSOR.x - 0.16, sy + 1.42, SENSOR.z + 0.35, SENSOR.x + 0.16, sy + 1.72, SENSOR.z + 0.42, { color: hex(0x101418), style: STYLE.GLASS, emis: 0.2, seed: 20 });
  both.box(SENSOR.x - 0.5, sy + 1.85, SENSOR.z - 0.6, SENSOR.x + 0.5, sy + 1.95, SENSOR.z + 0.5, { color: hex(0x5a5a54), style: STYLE.BRASS, seed: 21 });

  // ---- corps des nettoyeurs (dans la réalité) -------------------------------------------------
  const bodies: [number, number, number][] = [
    [SENSOR.x + 4, SENSOR.z + 9, 0.4], [-8, 88, 2.1], [-14, 96, 2.5],             // Holston et Allison, côte à côte
    [18, 110, 1.2], [-30, 140, 1.9], [9, 160, 0.3], [-20, 178, 2.8], [30, 70, 1.6], [-2, 125, 0.9],
  ];
  for (const [x, z, a] of bodies) body(real, x, z, a, rng);

  // ---- l'arbre mort (et son feuillage dans la simulation) --------------------------------------
  const ty = q(terrainH(TREE.x, TREE.z));
  const bark = hex(0x3e342a);
  const trunk = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, r: number, W: World) => {
    const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0, z1 - z0) / 0.2));
    for (let i = 0; i < n; i++) {
      const u = i / n, rr = r * (1 - 0.45 * u);
      const x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, z = z0 + (z1 - z0) * u;
      W.box(x - rr, y, z - rr, x + rr, y + (y1 - y0) / n + 0.12, z + rr, { color: bark, style: STYLE.WOOD, seed: 22, solid: false });
    }
  };
  trunk(TREE.x, ty - 0.5, TREE.z, TREE.x + 0.4, ty + 4.2, TREE.z - 0.2, 0.45, both);
  const tips: [number, number, number][] = [];
  const branch = (x: number, y: number, z: number, a: number, e: number, len: number, r: number, depth: number) => {
    const x1 = x + Math.cos(a) * Math.cos(e) * len, y1 = y + Math.sin(e) * len, z1 = z + Math.sin(a) * Math.cos(e) * len;
    trunk(x, y, z, x1, y1, z1, r, both);
    if (depth > 0) for (let k = 0; k < 2; k++) branch(x1, y1, z1, a + rng.range(-0.9, 0.9), e + rng.range(-0.3, 0.25), len * 0.72, r * 0.62, depth - 1);
    else tips.push([x1, y1, z1]);
  };
  for (let k = 0; k < 4; k++) branch(TREE.x + 0.4, ty + 4.0, TREE.z - 0.2, (k / 4) * Math.PI * 2 + rng.range(-0.4, 0.4), rng.range(0.35, 0.8), 2.4, 0.22, 2);
  for (const [x, y, z] of tips) sim.shape(ring(x, z, 0, rng.range(1.1, 1.8)), y - 0.6, y + 1.0, { color: rng.pick([hex(0x4a7a30), hex(0x3e6a28), hex(0x5a8a36)]), style: STYLE.FOLIAGE, seed: rng.byte(), solid: false, res: 0.2 });

  // ---- la simulation : fleurs et touffes d'herbe haute près de la sortie -----------------------
  for (let k = 0; k < 420; k++) {
    const x = rng.range(-70, 70), z = rng.range(RAMP_R0 + 12, 240);
    if (Math.abs(x) < TRENCH_HW + 1.5 && z < 100) continue;
    const y = q(terrainH(x, z));
    const flower = rng.chance(0.25);
    sim.box(x - 0.12, y, z - 0.12, x + 0.12, y + (flower ? 0.35 : 0.25), z + 0.12, { color: flower ? rng.pick([hex(0xf0e060), hex(0xe86a8a), hex(0xf0f0f0), hex(0x9a70e0)]) : hex(0x5a8a36), style: flower ? STYLE.FLESH : STYLE.FOLIAGE, seed: rng.byte(), solid: false });
  }

  // ---- autres silos : buttes, portails, capteurs ; le Silo 17 ouvert et ses squelettes -----------
  for (const s of SILOS) {
    if (s.n === 18) continue;
    const dir = Math.atan2(-s.z, -s.x) + rng.range(-0.6, 0.6);
    portal(both, s.x, s.z, dir, !!s.dead, rng);
    if (s.dead) {
      const ux2 = Math.cos(dir), uz2 = Math.sin(dir);
      for (let k = 0; k < 160; k++) {
        const d = 80 + Math.abs(rng.range(0, 1) * rng.range(0, 1)) * 140, sidew = rng.range(-40, 40) * (d - 70) / 140;
        const x = s.x + ux2 * d - uz2 * sidew, z = s.z + uz2 * d + ux2 * sidew;
        const y = q(terrainH(x, z));
        real.box(x - 0.3, y, z - 0.12, x + 0.3, y + 0.14, z + 0.12, { color: hex(0xc8c0a8), style: STYLE.FLESH, seed: rng.byte(), solid: false });
        if (rng.chance(0.5)) real.box(x + 0.25, y, z - 0.1, x + 0.45, y + 0.2, z + 0.1, { color: hex(0xd8d0b8), style: STYLE.FLESH, seed: rng.byte(), solid: false });
      }
    }
  }

  // ---- la ville en ruine, au loin (tours brisées) ---------------------------------------------
  for (let k = 0; k < 150; k++) {
    const x = rng.range(-2600, 2600) * (0.4 + 0.6 * rng.next()), z = rng.range(2600, 4300);
    const wdt = rng.range(30, 90), dep = rng.range(30, 80), h = rng.range(40, 260) * (1 - Math.abs(x) / 4000);
    const y0 = naturalH(x, z) - 10;
    const col = rng.pick([hex(0x6a6860), hex(0x5a5a56), hex(0x72706a), hex(0x4e4c48)]);
    both.box(x - wdt / 2, y0, z - dep / 2, x + wdt / 2, y0 + h, z + dep / 2, { color: col, style: STYLE.SOLID, extra: 1, seed: rng.byte(), solid: false });
    // sommet déchiqueté (réel) / intact avec antenne (simulation)
    for (let j = 0; j < 4; j++) {
      const bx = x + rng.range(-wdt / 2, wdt / 4), bz = z + rng.range(-dep / 2, dep / 4);
      const bw = rng.range(8, wdt / 2), bh = rng.range(6, 40);
      real.box(bx, y0 + h, bz, bx + bw, y0 + h + bh * rng.next(), bz + bw * 0.6, { color: col, style: STYLE.SOLID, extra: 1, seed: rng.byte(), solid: false });
    }
    sim.box(x - wdt / 2, y0 + h, z - dep / 2, x + wdt / 2, y0 + h + 12, z + dep / 2, { color: hex(0x7a8a9a), style: STYLE.GLASS, emis: 0.4, seed: rng.byte(), solid: false });
  }

  const out = (w: World) => w.chunkArrays().map((c) => c.geo);
  const colliders = both.col.export();
  return { both: out(both), real: out(real), sim: out(sim), colliders, lights, ms: Math.round(performance.now() - t0) };
}

void PAL;
