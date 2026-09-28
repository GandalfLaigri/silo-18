import * as THREE from 'three';
import type { GeoArrays } from '../world/builder';

/** Maillage three.js à partir des tableaux produits par un worker. */
export function makeGeometry(a: GeoArrays): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(a.pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(a.nrm, 3, true));
  g.setAttribute('aColor', new THREE.BufferAttribute(a.col, 3, true));
  g.setAttribute('aParams', new THREE.BufferAttribute(a.par, 4, false));
  g.setAttribute('aFace', new THREE.BufferAttribute(a.face, 4, false));
  g.setIndex(new THREE.BufferAttribute(a.idx, 1));
  const [x, y, z, r] = a.bs;
  g.boundingSphere = new THREE.Sphere(new THREE.Vector3(x, y, z), r);
  return g;
}
