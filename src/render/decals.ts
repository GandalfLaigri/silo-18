// Motifs plaqués : atlas dessiné au démarrage (canvas, pixels nets) et maillage statique fusionné par niveau.
import * as THREE from 'three';
import { TILES, type TileSpec } from '../world/decalTiles';
import type { DecalDef } from '../world/types';
import { GLSL_COMMON, GLSL_LIGHTING, shared } from './materials';

const SIZE = 1024;
const PAD = 2;

interface Cell { x: number; y: number; w: number; h: number }
const cells: Cell[] = [];

// --- rangement en étagères -----------------------------------------------------
{
  let x = PAD, y = PAD, row = 0;
  for (const t of TILES) {
    if (x + t.w + PAD > SIZE) { x = PAD; y += row + PAD; row = 0; }
    cells[t.id] = { x, y, w: t.w, h: t.h };
    x += t.w + PAD;
    row = Math.max(row, t.h);
  }
}

type Ctx = CanvasRenderingContext2D;
const FONT = '"Arial Narrow", "Roboto Condensed", "Oswald", Arial, sans-serif';

function fitText(c: Ctx, s: string, cx: number, y: number, maxW: number, size: number, color: string, weight = 'bold') {
  let sz = size;
  do {
    c.font = `${weight} ${sz}px ${FONT}`;
    if (c.measureText(s).width <= maxW) break;
    sz -= 1;
  } while (sz > 5);
  c.fillStyle = color;
  c.textAlign = 'center';
  c.textBaseline = 'top';
  c.fillText(s, Math.round(cx), Math.round(y));
}
function rnd(seed: number) {
  let s = seed >>> 0 || 1;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
/** Seuil d'opacité : pixels nets. */
function crisp(c: Ctx, x: number, y: number, w: number, h: number, th = 110) {
  const img = c.getImageData(x, y, w, h);
  for (let i = 3; i < img.data.length; i += 4) img.data[i] = img.data[i] > th ? 255 : 0;
  c.putImageData(img, x, y);
}

// --- dessins ------------------------------------------------------------------
function glyph(c: Ctx, t: TileSpec, x: number, y: number) {
  c.clearRect(x, y, t.w, t.h);
  c.font = `bold 30px ${FONT}`;
  c.fillStyle = '#ffffff';
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const m = c.measureText(t.text!);
  const k = Math.min(1, (t.w - 2) / Math.max(1, m.width));
  c.save();
  c.translate(x + t.w / 2, y + t.h / 2 + 1);
  c.scale(k, 1);
  c.fillText(t.text!, 0, 0);
  c.restore();
  crisp(c, x, y, t.w, t.h, 100);
  // ponts de pochoir sur quelques lettres
  if ('ABDOPQR0689'.includes(t.text!)) c.clearRect(x + t.w / 2 - 1, y + 2, 2, 5);
}

const PLATE_COL = ['#1c1f20', '#d8d0b8', '#8a2418', '#c89a20', '#2e5a5a', '#e8e6e0'];
function plate(c: Ctx, t: TileSpec, x: number, y: number) {
  const col = PLATE_COL[t.variant ?? 0];
  c.fillStyle = col; c.fillRect(x, y, t.w, t.h);
}

const POSTER_BG = ['#c8bc98', '#2a2e30', '#d0c4a0', '#8a2a1a', '#3a5a6a', '#1e2224', '#c89a30', '#d8d0c0', '#e0d8c4', '#2e4a5a'];
const POSTER_FG = ['#2a2420', '#e0d4b0', '#6a1a10', '#f0e0c0', '#e8e4d8', '#e0c070', '#1a1612', '#3a4a5a', '#8a1a10', '#f0e8d8'];
function poster(c: Ctx, t: TileSpec, x: number, y: number) {
  const i = t.variant ?? 0;
  const bg = POSTER_BG[i], fg = POSTER_FG[i];
  c.fillStyle = bg; c.fillRect(x, y, t.w, t.h);
  c.fillStyle = fg;
  c.fillRect(x + 2, y + 2, t.w - 4, 1); c.fillRect(x + 2, y + t.h - 3, t.w - 4, 1);
  fitText(c, t.text!, x + t.w / 2, y + 6, t.w - 8, 13, fg);
  const cx = x + t.w / 2, cy = y + t.h / 2 + 4;
  c.fillStyle = fg; c.strokeStyle = fg; c.lineWidth = 2;
  switch (i) {
    case 0: // le Pacte : livre ouvert
      c.fillRect(cx - 18, cy - 12, 17, 24); c.fillRect(cx + 1, cy - 12, 17, 24);
      c.fillStyle = bg; for (let k = 0; k < 5; k++) { c.fillRect(cx - 15, cy - 8 + k * 4, 12, 1); c.fillRect(cx + 4, cy - 8 + k * 4, 12, 1); }
      break;
    case 1: // œil
      c.beginPath(); c.ellipse(cx, cy, 20, 10, 0, 0, Math.PI * 2); c.stroke();
      c.beginPath(); c.arc(cx, cy, 6, 0, Math.PI * 2); c.fill();
      break;
    case 2: // écran et silhouettes
      c.fillRect(cx - 22, cy - 14, 44, 18);
      c.fillStyle = bg; c.fillRect(cx - 20, cy - 12, 40, 14);
      c.fillStyle = fg; c.beginPath(); c.moveTo(cx - 20, cy + 2); c.lineTo(cx - 4, cy - 8); c.lineTo(cx + 8, cy - 2); c.lineTo(cx + 20, cy - 6); c.lineTo(cx + 20, cy + 2); c.fill();
      for (let k = -2; k <= 2; k++) { c.beginPath(); c.arc(cx + k * 8, cy + 12, 3, 0, Math.PI * 2); c.fill(); c.fillRect(cx + k * 8 - 3, cy + 14, 6, 6); }
      break;
    case 3: // flamme / lanterne
      c.beginPath(); c.moveTo(cx, cy - 18); c.quadraticCurveTo(cx + 14, cy, cx, cy + 14); c.quadraticCurveTo(cx - 14, cy, cx, cy - 18); c.fill();
      break;
    case 4: // goutte
      c.beginPath(); c.moveTo(cx, cy - 18); c.quadraticCurveTo(cx + 16, cy + 4, cx, cy + 14); c.quadraticCurveTo(cx - 16, cy + 4, cx, cy - 18); c.fill();
      break;
    case 5: // lune
      c.beginPath(); c.arc(cx, cy, 14, 0, Math.PI * 2); c.fill();
      c.fillStyle = bg; c.beginPath(); c.arc(cx + 7, cy - 5, 12, 0, Math.PI * 2); c.fill();
      break;
    case 6: // porteur chargé
      c.beginPath(); c.arc(cx - 2, cy - 14, 4, 0, Math.PI * 2); c.fill();
      c.fillRect(cx - 6, cy - 9, 8, 14); c.fillRect(cx + 2, cy - 12, 12, 16);
      c.fillRect(cx - 6, cy + 5, 3, 12); c.fillRect(cx - 1, cy + 5, 3, 12);
      break;
    case 7: // berceau
      c.beginPath(); c.arc(cx, cy, 16, 0, Math.PI); c.fill();
      c.fillRect(cx - 18, cy - 2, 36, 3);
      break;
    case 8: case 9: // portrait
      c.beginPath(); c.arc(cx, cy - 6, 9, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.ellipse(cx, cy + 16, 16, 10, 0, Math.PI, 0); c.fill();
      break;
  }
  fitText(c, t.sub!, x + t.w / 2, y + t.h - 16, t.w - 6, 10, fg);
}

function graffiti(c: Ctx, t: TileSpec, x: number, y: number) {
  const r = rnd(t.id * 131);
  c.clearRect(x, y, t.w, t.h);
  const cols = ['#e0d8c0', '#c83a20', '#e0d8c0', '#d0c040', '#e0d8c0'];
  const col = cols[(t.variant ?? 0) % cols.length];
  for (let k = 0; k < 50; k++) { c.fillStyle = col; c.fillRect(x + r() * t.w, y + r() * t.h, 1, 1); }
  c.save();
  c.font = `bold 20px ${FONT}`;
  c.textAlign = 'center'; c.textBaseline = 'middle';
  c.translate(x + t.w / 2, y + t.h / 2);
  c.rotate(-0.06 + r() * 0.08);
  c.fillStyle = col;
  const m = c.measureText(t.text!);
  const k = Math.min(1, (t.w - 8) / m.width);
  c.scale(k, 1.1);
  c.fillText(t.text!, 0, 0);
  c.restore();
  c.fillStyle = col;
  for (let k = 0; k < 10; k++) { const dx = x + 8 + r() * (t.w - 16); c.fillRect(dx, y + t.h * 0.62, 1, 3 + r() * 12); }
  crisp(c, x, y, t.w, t.h);
}

function hazard(c: Ctx, t: TileSpec, x: number, y: number) {
  c.clearRect(x, y, t.w, t.h);
  c.fillStyle = '#141210'; c.beginPath(); c.moveTo(x + t.w / 2, y); c.lineTo(x + t.w, y + t.h); c.lineTo(x, y + t.h); c.closePath(); c.fill();
  c.fillStyle = '#d0a018'; c.beginPath(); c.moveTo(x + t.w / 2, y + 4); c.lineTo(x + t.w - 3, y + t.h - 2); c.lineTo(x + 3, y + t.h - 2); c.closePath(); c.fill();
  c.fillStyle = '#141210'; c.fillRect(x + t.w / 2 - 2, y + 12, 4, 10); c.fillRect(x + t.w / 2 - 2, y + 25, 4, 3);
}

function arrow(c: Ctx, t: TileSpec, x: number, y: number) {
  c.clearRect(x, y, t.w, t.h);
  c.fillStyle = '#ffffff';
  const up = (t.variant ?? 0) === 0;
  c.beginPath();
  if (up) { c.moveTo(x + 16, y + 2); c.lineTo(x + 30, y + 16); c.lineTo(x + 21, y + 16); c.lineTo(x + 21, y + 30); c.lineTo(x + 11, y + 30); c.lineTo(x + 11, y + 16); c.lineTo(x + 2, y + 16); }
  else { c.moveTo(x + 16, y + 30); c.lineTo(x + 30, y + 16); c.lineTo(x + 21, y + 16); c.lineTo(x + 21, y + 2); c.lineTo(x + 11, y + 2); c.lineTo(x + 11, y + 16); c.lineTo(x + 2, y + 16); }
  c.closePath(); c.fill();
}

function stripes(c: Ctx, t: TileSpec, x: number, y: number) {
  c.fillStyle = '#c89a20'; c.fillRect(x, y, t.w, t.h);
  c.fillStyle = '#141210';
  for (let k = -t.h; k < t.w; k += 8) { c.beginPath(); c.moveTo(x + k, y + t.h); c.lineTo(x + k + 4, y + t.h); c.lineTo(x + k + 4 + t.h, y); c.lineTo(x + k + t.h, y); c.closePath(); c.fill(); }
}

// --- atlas ---------------------------------------------------------------------
function buildAtlas(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = cv.height = SIZE;
  const c = cv.getContext('2d', { willReadFrequently: true })!;
  c.imageSmoothingEnabled = false;
  c.save();
  c.beginPath(); c.rect(0, 0, SIZE, SIZE); c.clip();
  for (const t of TILES) {
    const { x, y } = cells[t.id];
    c.save();
    c.beginPath(); c.rect(x, y, t.w, t.h); c.clip();
    if (t.kind === 'glyph') glyph(c, t, x, y);
    else if (t.kind === 'plate') plate(c, t, x, y);
    else if (t.kind === 'poster') poster(c, t, x, y);
    else if (t.kind === 'graffiti') graffiti(c, t, x, y);
    else if (t.kind === 'hazard') hazard(c, t, x, y);
    else if (t.kind === 'arrow') arrow(c, t, x, y);
    else if (t.kind === 'stripes') stripes(c, t, x, y);
    c.restore();
  }
  c.restore();
  const tex = new THREE.CanvasTexture(cv);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.generateMipmaps = true;
  tex.colorSpace = THREE.NoColorSpace;
  return tex;
}

let atlas: THREE.CanvasTexture | null = null;
let material: THREE.ShaderMaterial | null = null;

const VERT = /* glsl */ `
attribute vec2 aLocal;
attribute vec3 aParam;   // lueur, usure, graine
attribute vec3 aTint;
varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vParam;
varying vec3 vTint;
varying vec3 vWP;
varying vec3 vN;
#include <fog_pars_vertex>
void main(){
  vUv = uv; vLocal = aLocal; vParam = aParam; vTint = aTint;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * normal);
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform float uTime;
uniform vec4 uClip;
varying vec2 vUv;
varying vec2 vLocal;
varying vec3 vParam;
varying vec3 vTint;
varying vec3 vWP;
varying vec3 vN;
#include <fog_pars_fragment>
${GLSL_COMMON}
${GLSL_LIGHTING}
void main(){
  if (dot(vWP, uClip.xyz) > uClip.w) discard;
  if (vParam.y < -0.5) {
    // oscilloscope de la Voix : trace qui s'agite quand elle parle, graticule, fond noir
    vec2 p = vLocal;
    float talk = smoothstep(0.2, 0.6, sin(uTime * 0.7) + 0.4 * sin(uTime * 1.9));
    float w = 0.5 + (0.02 + 0.2 * talk) * sin(p.x * 38.0 - uTime * 5.0) * sin(p.x * 6.0 + uTime * 1.3);
    float d = abs(p.y - w) / max(fwidth(p.y), 1e-4);
    float trace = smoothstep(2.5, 0.5, d) + 0.3 * smoothstep(12.0, 0.0, d);
    vec2 gq = abs(fract(p * vec2(10.0, 6.0)) - 0.5);
    float grid = step(0.47, max(gq.x, gq.y));
    gl_FragColor = vec4(vec3(0.015) + vec3(0.55, 1.0, 0.75) * vParam.x * (0.03 + trace + grid * 0.07) * uPower, 1.0);
    #include <fog_fragment>
    return;
  }
  vec4 t = texture2D(uAtlas, vUv);
  if (t.a < 0.5) discard;
  float glow = vParam.x, wear = vParam.y, seed = vParam.z;
  float n = vnoise(vLocal * vec2(9.0, 13.0) + seed * 7.1);
  float e = min(min(vLocal.x, 1.0 - vLocal.x), min(vLocal.y, 1.0 - vLocal.y));
  if (wear > 0.0 && n * 0.2 > e + 0.06 - wear * 0.09) discard;
  // peinture écaillée (lettres au pochoir)
  if (wear > 0.0 && vnoise(vWP.xz * 7.0 + vWP.y * 5.0 + seed) < wear * 0.35) discard;
  float stain = smoothstep(0.45, 0.85, vnoise(vLocal * vec2(3.0, 4.0) + seed * 3.3 + 10.0));
  vec3 albedo = t.rgb * vTint * (1.0 - wear * (0.15 + 0.3 * stain));
  vec3 N = normalize(vN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 diff, spec;
  shade(vWP, N, V, 0.1, diff, spec);
  vec3 col = albedo * diff + t.rgb * vTint * glow * uPower;
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

function getMaterial() {
  if (!atlas) atlas = buildAtlas();
  if (!material) {
    material = new THREE.ShaderMaterial({
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...shared, uAtlas: { value: atlas } },
      vertexShader: VERT,
      fragmentShader: FRAG,
      fog: true,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -2,
    });
  }
  return material;
}

/** Construit le maillage fusionné d'une liste de motifs. */
export function buildDecals(defs: DecalDef[]): THREE.Mesh | null {
  if (!defs.length) return null;
  const n = defs.length;
  const pos = new Float32Array(n * 12), nrm = new Float32Array(n * 12), uv = new Float32Array(n * 8), loc = new Float32Array(n * 8);
  const par = new Float32Array(n * 12), tint = new Float32Array(n * 12);
  const idx = new Uint32Array(n * 6);
  defs.forEach((d, i) => {
    const nl = Math.hypot(d.nx, d.nz) || 1;
    const nx0 = d.nx / nl, nz0 = d.nz / nl;
    // repère du plan : droite (pour un observateur face au motif), haut
    let rx = nz0, rz = -nx0;
    let ux = 0, uy = 1, uz = 0;
    let nx = nx0, ny = 0, nz = nz0;
    if (d.up) {
      // posé au sol, lisible par un observateur placé dans la direction (nx, nz)
      ux = -nx0; uy = 0; uz = -nz0; nx = 0; ny = 1; nz = 0;
      rx = nz0; rz = -nx0;
    }
    const off = 0.012;
    const cx = d.x + nx * off, cy = d.y + ny * off, cz = d.z + nz * off;
    const hw = d.w / 2, hh = d.h / 2;
    const corners = [[-hw, -hh], [hw, -hh], [hw, hh], [-hw, hh]];
    const c = cells[d.tile];
    const u0 = (c.x + 0.25) / SIZE, u1 = (c.x + c.w - 0.25) / SIZE, v0 = 1 - (c.y + c.h - 0.25) / SIZE, v1 = 1 - (c.y + 0.25) / SIZE;
    const uvs = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
    const lc = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const t = d.tint ?? [1, 1, 1];
    corners.forEach(([a, b], k) => {
      pos.set([cx + rx * a + ux * b, cy + uy * b, cz + rz * a + uz * b], i * 12 + k * 3);
      nrm.set([nx, ny, nz], i * 12 + k * 3);
      uv.set(uvs[k], i * 8 + k * 2);
      loc.set(lc[k], i * 8 + k * 2);
      par.set([d.glow, d.wear, ((i * 0.618) % 1) * 40], i * 12 + k * 3);
      tint.set(t, i * 12 + k * 3);
    });
    idx.set([i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3], i * 6);
  });
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  g.setAttribute('aLocal', new THREE.BufferAttribute(loc, 2));
  g.setAttribute('aParam', new THREE.BufferAttribute(par, 3));
  g.setAttribute('aTint', new THREE.BufferAttribute(tint, 3));
  g.setIndex(new THREE.BufferAttribute(idx, 1));
  g.computeBoundingSphere();
  const m = new THREE.Mesh(g, getMaterial());
  m.matrixAutoUpdate = false;
  return m;
}
