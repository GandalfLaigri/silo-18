// Worker de génération : produit les niveaux proches, les coques lointaines et la surface hors du thread principal.
import { geoBuffers, type GeoArrays } from '../world/builder';
import type { Era, LevelOut, ShellOut } from '../world/types';
import { genBelowShell, genLevel, genOverviewLevel, genShell, type ShellKey } from './level';
import { genOutside, genTerrainChunk, type OutsideOut } from './outside';

export type GenRequest =
  | { id: number; type: 'level'; n: number; era: Era; seed: number }
  | { id: number; type: 'shell'; key: ShellKey | 'ov' | 'below'; lod: 1 | 2; era: Era; seed: number }
  | { id: number; type: 'outside'; seed: number }
  | { id: number; type: 'tchunk'; x0: number; z0: number; size: number; cell: number };

export type GenResponse =
  | { id: number; type: 'level'; out: LevelOut }
  | { id: number; type: 'shell'; out: ShellOut }
  | { id: number; type: 'outside'; out: OutsideOut }
  | { id: number; type: 'tchunk'; out: GeoArrays }
  | { id: number; type: 'error'; message: string };

const post = (m: GenResponse, tr: ArrayBuffer[]) => (self as unknown as Worker).postMessage(m, tr);

self.onmessage = (e: MessageEvent<GenRequest>) => {
  const r = e.data;
  try {
    if (r.type === 'level') {
      const out = genLevel(r.n, r.era, r.seed);
      const tr: ArrayBuffer[] = [out.colliders.buffer as ArrayBuffer];
      for (const c of out.chunks) tr.push(...geoBuffers(c.geo));
      post({ id: r.id, type: 'level', out }, tr);
    } else if (r.type === 'shell') {
      const out = r.key === 'ov' ? genOverviewLevel(r.seed) : r.key === 'below' ? genBelowShell(r.seed) : genShell(r.key, r.lod, r.era, r.seed);
      const tr: ArrayBuffer[] = [];
      for (const c of out.chunks) tr.push(...geoBuffers(c));
      post({ id: r.id, type: 'shell', out }, tr);
    } else if (r.type === 'outside') {
      const out = genOutside(r.seed);
      const tr: ArrayBuffer[] = [out.colliders.buffer as ArrayBuffer];
      for (const g of [...out.both, ...out.real, ...out.sim]) tr.push(...geoBuffers(g));
      post({ id: r.id, type: 'outside', out }, tr);
    } else {
      const out = genTerrainChunk(r.x0, r.z0, r.size, r.cell);
      post({ id: r.id, type: 'tchunk', out }, geoBuffers(out));
    }
  } catch (err) {
    post({ id: r.id, type: 'error', message: String((err as Error)?.stack ?? err) }, []);
  }
};
