import * as THREE from 'three';
import { NUM_PL, V } from '../config';

/** Nombre de sources de lueur diffuse (générateur, fermes, écran…). */
export const NUM_GLOW = 4;

/** Uniformes partagés par tous les matériaux (mêmes objets => une seule mise à jour). */
export const shared = {
  uTime: { value: 0 },
  uPL: { value: Array.from({ length: NUM_PL }, () => new THREE.Vector4(0, -9999, 0, 1)) },
  uPLC: { value: Array.from({ length: NUM_PL }, () => new THREE.Vector3()) },
  /** Ambiance venue d'en haut et d'en bas. */
  uAmbUp: { value: new THREE.Vector3(0.02, 0.024, 0.028) },
  uAmbDown: { value: new THREE.Vector3(0.018, 0.016, 0.014) },
  /** Lueurs diffuses : position + rayon, couleur. */
  uGlowP: { value: Array.from({ length: NUM_GLOW }, () => new THREE.Vector4(0, -9999, 0, 1)) },
  uGlowC: { value: Array.from({ length: NUM_GLOW }, () => new THREE.Vector3()) },
  /** Soleil voilé (dehors) : direction + seuil y (appliqué au-dessus), couleur. */
  uSunDir: { value: new THREE.Vector4(0, 1, 0, 1e9) },
  uSunCol: { value: new THREE.Vector3() },
  /** Coupure de courant : facteur appliqué aux sources lumineuses (1 : normal). */
  uPower: { value: 1 },
  /** Vue en coupe : plan (normale, distance) ; w = 1e9 : désactivée. */
  uClip: { value: new THREE.Vector4(0, 0, 1, 1e9) },
  /** Mise en évidence d'un niveau (vue d'ensemble) : y0, y1, intensité. */
  uHi: { value: new THREE.Vector3(0, 0, 0) },
  /** Simulation du casque (0 : réalité, 1 : monde verdoyant). */
  uSim: { value: 0 },
  /** Éclairage de la surface (matériau extérieur). */
  uOutSun: { value: new THREE.Vector3(0.3, 0.8, 0.5).normalize() },
  uOutSunCol: { value: new THREE.Vector3(0.5, 0.46, 0.4) },
  uOutAmbUp: { value: new THREE.Vector3(0.3, 0.29, 0.27) },
  uOutAmbDown: { value: new THREE.Vector3(0.14, 0.12, 0.1) },
};

export const GLSL_COMMON = /* glsl */ `
float h11(float p){ p = fract(p * 0.1031); p *= p + 33.33; p *= p + p; return fract(p); }
float h21(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float h31(vec3 p3){ p3 = fract(p3 * 0.1031); p3 += dot(p3, p3.zyx + 31.32); return fract((p3.x + p3.y) * p3.z); }
float vnoise(vec2 p){
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  float a = h21(i), b = h21(i + vec2(1.0, 0.0)), c = h21(i + vec2(0.0, 1.0)), d = h21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, f.x), mix(c, d, f.x), f.y);
}
`;

export const GLSL_LIGHTING = /* glsl */ `
uniform vec4 uPL[${NUM_PL}];
uniform vec3 uPLC[${NUM_PL}];
uniform vec3 uAmbUp;
uniform vec3 uAmbDown;
uniform vec4 uGlowP[${NUM_GLOW}];
uniform vec3 uGlowC[${NUM_GLOW}];
uniform vec4 uSunDir;
uniform vec3 uSunCol;
uniform float uPower;
uniform vec3 uOutSun;
uniform vec3 uOutSunCol;
uniform vec3 uOutAmbUp;
uniform vec3 uOutAmbDown;
void shade(vec3 wp, vec3 N, vec3 V, float wet, out vec3 diff, out vec3 spec){
  diff = mix(uAmbDown, uAmbUp, N.y * 0.5 + 0.5);
  if (wp.y > uSunDir.w) diff += uSunCol * (0.35 + 0.65 * max(dot(N, uSunDir.xyz), 0.0));
  #ifdef OUTDOOR
  diff += mix(uOutAmbDown, uOutAmbUp, N.y * 0.5 + 0.5) + uOutSunCol * max(dot(N, uOutSun), 0.0);
  #endif
  for (int i = 0; i < ${NUM_GLOW}; i++) {
    vec3 L = uGlowP[i].xyz - wp;
    float d = length(L);
    float k = 1.0 - clamp(d / uGlowP[i].w, 0.0, 1.0);
    diff += uGlowC[i] * k * k * (0.35 + 0.65 * max(dot(N, L / max(d, 1e-3)), 0.0));
  }
  spec = vec3(0.0);
  float shin = mix(8.0, 80.0, wet);
  for (int i = 0; i < ${NUM_PL}; i++) {
    vec3 L = uPL[i].xyz - wp;
    float d2 = dot(L, L);
    float r = uPL[i].w;
    if (d2 < r * r) {
      float d = sqrt(d2);
      L /= max(d, 1e-3);
      float att = 1.0 - d / r; att *= att;
      float nl = max(dot(N, L), 0.0);
      diff += uPLC[i] * att * (nl * 0.85 + 0.15);
      vec3 H = normalize(L + V);
      spec += uPLC[i] * att * pow(max(dot(N, H), 0.0), shin) * wet * 2.5 * nl;
    }
  }
}
`;

const VOXEL_VERT = /* glsl */ `
attribute vec3 aColor;
attribute vec4 aParams;
attribute vec4 aFace;
varying vec3 vWP;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vPar;
varying vec4 vFace;
#ifdef PED
uniform float uTime;
attribute vec2 aPart;    // x : partie (0 corps · 1/2 jambes · 3/4 bras · 5 accessoire · 6 charge), y : hauteur du pivot
attribute vec4 aInst;    // phase, marche (0..1), teinte d'accent, posture
vec3 pedPal(float t){
  t = fract(t) * 6.0;
  if (t < 1.0) return vec3(0.55, 0.22, 0.14);
  if (t < 2.0) return vec3(0.62, 0.52, 0.3);
  if (t < 3.0) return vec3(0.28, 0.36, 0.3);
  if (t < 4.0) return vec3(0.42, 0.36, 0.3);
  if (t < 5.0) return vec3(0.26, 0.32, 0.42);
  return vec3(0.5, 0.46, 0.4);
}
#endif
#include <fog_pars_vertex>
void main(){
  vec4 lp = vec4(position, 1.0);
  vec3 n = normal;
  #ifdef PED
    float part = aPart.x, py = aPart.y, pose = aInst.w;
    float ph = uTime * 7.0 * (0.85 + 0.3 * fract(aInst.x * 7.3)) + aInst.x * 6.2831;
    float sw = sin(ph) * 0.55 * aInst.y;
    float T = uTime + aInst.x * 37.0;
    bool leg = part > 0.5 && part < 2.5;
    bool armL = part > 2.5 && part < 3.5;
    bool armR = part > 3.5 && part < 4.5;
    bool arm = armL || armR;
    bool seated = (pose > 0.5 && pose < 1.5) || (pose > 7.5 && pose < 8.5);
    bool kneel = pose > 5.5 && pose < 6.5;
    bool lying = pose > 8.5 && pose < 9.5;
    float ang = 0.0;
    if (part > 0.5 && part < 1.5) ang = sw;
    else if (part > 1.5 && part < 2.5) ang = -sw;
    else if (armL) ang = -sw * 0.8;
    else if (armR) ang = sw * 0.8;
    if (seated && leg) ang = -1.5;
    if (pose > 7.5 && pose < 8.5) {
      if (armL) ang = -1.2;
      else if (armR) ang = -1.15 + 0.06 * sin(T * 11.0) * step(0.3, fract(T * 0.2));
    } else if (seated) {
      if (arm) ang = -0.35;
    } else if (pose > 6.5 && pose < 7.5) {
      if (armL) ang = -1.45 + 0.1 * sin(T * 2.2);
      else if (armR) ang = -2.0 + 0.1 * sin(T * 2.2);
      else if (leg) ang = 0.35 * sin(T * 2.2 + (part > 1.5 ? 3.1416 : 0.0));
    } else if (pose > 11.5 && pose < 12.5) {
      if (arm) ang = -0.2;
    } else if (pose > 1.5 && pose < 2.5) {
      float g = max(0.0, sin(uTime * 2.1 + aInst.x * 17.0));
      if (armR) ang = -0.3 - 0.9 * g * g;
      else if (armL) ang = -0.15 - 0.3 * max(0.0, sin(uTime * 1.7 + aInst.x * 9.0));
    } else if (pose > 2.5 && pose < 3.5) {
      if (arm) ang = -1.25;
    } else if (pose > 3.5 && pose < 4.5) {
      if (armL) ang = -0.95;
      else if (armR) ang = -0.6 - 1.1 * abs(sin(T * 3.2)) * step(0.25, fract(T * 0.11));
    } else if (pose > 4.5 && pose < 5.5) {
      if (arm) ang = -1.05 + 0.03 * sin(T * 1.3);
    } else if (kneel) {
      if (arm) ang = -1.25;
      else if (leg) ang = 1.5;
    } else if (lying) {
      if (arm) ang = -0.1;
      else if (leg) ang = 0.0;
    } else if (pose > 9.5 && pose < 10.5) {
      if (arm) ang = -1.25 + 0.06 * sin(T * 15.0 + part * 2.0);
    } else if (pose > 10.5 && pose < 11.5) {
      float g = sin(T * 0.9);
      if (armL) ang = -2.7 + 0.25 * g;
      else if (armR) ang = -1.2 - 0.6 * g;
    }
    float cs = cos(ang), sn = sin(ang);
    vec3 q = lp.xyz - vec3(0.0, py, 0.0);
    lp.xyz = vec3(q.x, q.y * cs - q.z * sn, q.y * sn + q.z * cs) + vec3(0.0, py, 0.0);
    n = vec3(n.x, n.y * cs - n.z * sn, n.y * sn + n.z * cs);
    lp.y += abs(sin(ph)) * 0.035 * aInst.y;
    if (kneel) lp.y -= 0.62;
    else if (pose > 6.5 && pose < 7.5) { lp.x += sin(T * 1.1) * 0.08 * lp.y; lp.z += cos(T * 1.1) * 0.04 * lp.y; }
    else if (!seated && !lying) lp.x += sin(uTime * 1.3 + aInst.x * 20.0) * 0.02 * (1.0 - aInst.y) * lp.y;
    if (lying) {
      lp.xyz = vec3(lp.x, lp.z + 0.14 + (part < 0.5 ? 0.012 * sin(T * 1.4) : 0.0), -lp.y);
      n = vec3(n.x, n.z, -n.y);
    }
    // l'accessoire n'existe que dans la posture 5, la charge dans la posture 12
    if (part > 4.5 && part < 5.5 && (pose < 4.5 || pose > 5.5)) lp.xyz = vec3(0.0);
    if (part > 5.5 && (pose < 11.5 || pose > 12.5)) lp.xyz = vec3(0.0);
  #endif
  #ifdef USE_INSTANCING
    lp = instanceMatrix * lp;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 wp = modelMatrix * lp;
  vWP = wp.xyz;
  vN = normalize(mat3(modelMatrix) * n);
  vCol = aColor;
  #ifdef USE_INSTANCING_COLOR
    if (aParams.w > 0.5 && aParams.w < 1.5) vCol *= instanceColor;
  #endif
  vPar = aParams;
  #ifdef PED
    if (aParams.w > 1.5 && aParams.w < 2.5) vCol *= pedPal(aInst.z);
    vPar.w = 0.0;
  #endif
  vFace = aFace;
  vec4 mvPosition = viewMatrix * wp;
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}
`;

const VOXEL_FRAG = /* glsl */ `
uniform float uTime;
uniform vec4 uClip;
uniform vec3 uHi;
uniform float uSim;
varying vec3 vWP;
varying vec3 vN;
varying vec3 vCol;
varying vec4 vPar;
varying vec4 vFace;
#include <fog_pars_fragment>
${GLSL_COMMON}
${GLSL_LIGHTING}

const float VX = ${V.toFixed(3)};

/** Masque anti-crénelé d'un intervalle [a, b] (w : largeur d'un pixel). */
float band(float x, float a, float b, float w){ return smoothstep(a - w, a + w, x) * (1.0 - smoothstep(b - w, b + w, x)); }

void main(){
  // vue en coupe : on retire la moitié avant, les faces arrière deviennent la tranche
  if (dot(vWP, uClip.xyz) > uClip.w) discard;
  if (uClip.w < 1e8 && !gl_FrontFacing) {
    float hatch = step(0.5, fract((vWP.x + vWP.y) * 0.8));
    gl_FragColor = vec4(mix(vec3(0.055, 0.075, 0.07), vec3(0.075, 0.1, 0.095), hatch), 1.0);
    #include <fog_fragment>
    return;
  }
  vec3 N = normalize(vN);
  vec3 Vw = normalize(cameraPosition - vWP);
  vec4 par = floor(vPar + 0.5);
  float style = par.x;
  float seed = par.y;
  float emis = par.z * (8.0 / 255.0) * 0.75;
  float extra = par.w;
  vec2 uv = vFace.xy;                 // coordonnées de face en voxels
  vec2 fs = floor(vFace.zw + 0.5);    // taille de la face en voxels
  vec2 um = uv * VX;                  // coordonnées de face en mètres
  vec2 fm = fs * VX;                  // taille de la face en mètres
  vec2 cell = floor(uv);
  vec2 f = uv - cell;
  vec2 fw = fwidth(uv);
  float px = max(fw.x, fw.y);         // voxels par pixel
  float pm = px * VX;                 // mètres par pixel
  float far = smoothstep(0.35, 1.3, px);
  float faceId = dot(floor(N + 0.5), vec3(1.0, 2.0, 4.0));
  vec2 eg = smoothstep(vec2(0.0), fw * 1.5 + 0.03, f) * smoothstep(vec2(0.0), fw * 1.5 + 0.03, 1.0 - f);
  float edge = mix(0.9, 1.0, min(eg.x, eg.y));
  float vn = 0.92 + 0.16 * h31(vec3(floor(vWP * 10.0 + 0.001 - N * 0.5)));
  vec3 albedo = vCol * mix(edge * vn, 0.95, far);
  vec3 emission = vec3(0.0);
  float wet = 0.12;
  float fres = pow(1.0 - max(dot(N, Vw), 0.0), 4.0);
  bool vertical = abs(N.y) < 0.5;
  // coordonnées monde : horizontale le long de la face, verticale = altitude
  vec2 tq = vec2(dot(vWP.xz, vec2(-N.z, N.x)), vWP.y);
  vec2 wq = vertical ? vec2(vWP.x + vWP.z, vWP.y) : vWP.xz;   // continu d'une face à l'autre d'une paroi courbe
  bool weather = false;

  if (style < 0.5) {
    if (extra < 0.5) {
      // béton banché : panneaux de coffrage, trous de banche, reprises de coulage
      weather = true;
      vec2 pq = wq / vec2(2.4, 1.2);
      vec2 pf = fract(pq);
      float seamW = pm / 1.2;
      float seam = (1.0 - band(pf.x, 0.004, 0.996, seamW)) + (1.0 - band(pf.y, 0.008, 0.992, seamW));
      seam *= 1.0 - smoothstep(0.02, 0.07, pm);
      albedo *= (0.9 + 0.14 * h21(floor(pq) + seed * 0.1)) * (1.0 - 0.25 * clamp(seam, 0.0, 1.0));
      if (vertical && pm < 0.02) {
        vec2 tp = fract(pq * vec2(2.0, 2.0));
        if (length((tp - 0.5) * vec2(2.4, 1.2)) < 0.035) albedo *= 0.45;
      }
      albedo *= 0.94 + 0.08 * vnoise(wq * vec2(0.6, 0.15));
    } else if (extra < 1.5) {
      // tôle rivetée
      vec2 pq = wq / vec2(1.6, 1.2);
      vec2 pf = fract(pq);
      float seam = mix(min(band(pf.x, 0.0, 0.015, fw.x * VX), 1.0) + band(pf.y, 0.0, 0.02, fw.y * VX), 0.0, smoothstep(0.02, 0.06, pm));
      albedo *= 1.0 - 0.35 * clamp(seam, 0.0, 1.0);
      albedo *= 0.88 + 0.2 * h21(floor(pq) + seed);
      wet = 0.35;
      weather = true;
    } else {
      wet = 0.25;
    }
  } else if (style > 1.5 && style < 2.5) {
    float k = 1.0;
    if (extra > 0.5 && extra < 1.5) k = 0.7 + 0.3 * sin(uTime * 1.3 + seed);
    else if (extra > 1.5 && extra < 2.5) { float tt = floor(uTime * 12.0); k = h21(vec2(tt, seed)) > 0.08 ? 1.0 : 0.1; }
    else if (extra > 2.5 && extra < 3.5) k = step(0.5, fract(uTime * 0.9 + seed / 255.0)) * 0.95 + 0.05;
    else if (extra > 3.5 && extra < 4.5) k = 0.75 + 0.15 * sin(uTime * 9.0 + seed * 3.0) + 0.1 * sin(uTime * 23.0 + seed);
    emission = vCol * emis * k * uPower;
    albedo = vCol * 0.12;
  } else if (style > 2.5 && style < 3.5) {
    // plaques de sol (extra 1 : bandes de danger)
    weather = true;
    vec2 pq = vWP.xz / 1.2;
    vec2 pf = fract(pq);
    float w1 = pm / 1.2;
    float seam = (1.0 - band(pf.x, 0.02, 0.98, w1)) + (1.0 - band(pf.y, 0.02, 0.98, w1));
    seam *= 1.0 - smoothstep(0.03, 0.08, pm);
    albedo *= (0.82 + 0.26 * h21(floor(pq) + seed)) * (1.0 - 0.4 * clamp(seam, 0.0, 1.0));
    if (pm < 0.02) { vec2 dq = fract(vWP.xz / 0.2 + vec2(0.0, 0.5 * step(0.5, fract(vWP.x / 0.4)))); if (length(dq - 0.5) < 0.18) albedo *= 1.15; }
    if (extra > 0.5 && extra < 1.5) {
      float s = fract((vWP.x + vWP.z) / 1.0);
      albedo = mix(albedo, s < 0.5 ? vec3(0.34, 0.26, 0.05) : vec3(0.03), 0.85 * (1.0 - far * 0.5));
    }
    wet = 0.3;
    if (N.y > 0.5) {
      float pud = smoothstep(0.66, 0.78, vnoise(vWP.xz * 0.3) * 0.65 + vnoise(vWP.xz * 1.1) * 0.35);
      wet = mix(wet, 1.0, pud);
      albedo *= 1.0 - 0.5 * pud;
    }
  } else if (style > 3.5 && style < 4.5) {
    // caillebotis ajouré : trous carrés (0,1 m), tramé au loin
    vec2 gq = vertical ? tq : vWP.xz;
    vec2 g = gq / 0.1;
    vec2 gw = fwidth(g);
    float gpx = max(gw.x, gw.y);
    if (gpx < 0.5) {
      vec2 fd = abs(fract(g) - 0.5);
      if (max(fd.x, fd.y) < 0.5 - max(0.14, gpx * 0.6)) discard;
    } else if (mod(floor(gl_FragCoord.x) + floor(gl_FragCoord.y), 2.0) < 1.0) discard;
    albedo = vCol * (0.85 + 0.25 * h21(floor(gq / 1.5)));
    wet = 0.5;
  } else if (style > 4.5 && style < 5.5) {
    // verre dépoli éclairé de l'intérieur (fenêtres, hublots) ; extra 1 : croisillons
    vec2 q = um / max(fm, vec2(0.01));
    float glow = 0.65 + 0.35 * vnoise(um * 3.0 + seed);
    float mull = 0.0;
    if (extra > 0.5) mull = max(band(q.x, 0.48, 0.52, pm / max(fm.x, 0.01)), band(q.y, 0.48, 0.52, pm / max(fm.y, 0.01)));
    emission = vCol * emis * glow * (1.0 - mull * 0.9) * uPower;
    albedo = vec3(0.03) + vec3(0.06) * fres;
    wet = 0.9;
  } else if (style > 5.5 && style < 6.5) {
    // métal en fusion
    vec2 q = (vertical ? tq : vWP.xz) * vec2(0.6, 0.35);
    float n = vnoise(q + vec2(0.0, -uTime * 0.6)) * 0.6 + vnoise(q * 3.0 + vec2(uTime * 0.3, -uTime * 1.4)) * 0.4;
    vec3 hot = mix(vec3(1.0, 0.25, 0.03), vec3(1.0, 0.85, 0.35), smoothstep(0.45, 0.85, n));
    emission = hot * emis * (0.6 + 0.6 * n);
    albedo = vec3(0.05);
  } else if (style > 6.5 && style < 7.5) {
    // écran cathodique : lignes de texte vertes qui défilent, balayage
    albedo = vec3(0.02);
    if (fs.x > 2.0 && fs.y > 2.0) {
      vec2 p = um / fm;
      float line = floor(p.y * 14.0 + uTime * 0.5);
      float lf = fract(p.y * 14.0 + uTime * 0.5);
      float ch = floor(p.x * 40.0);
      float on = step(0.4, h21(vec2(ch, line + seed))) * step(0.25, lf) * step(lf, 0.72);
      on *= step(p.x, 0.08 + 0.85 * h11(line * 7.1 + seed));
      vec3 col = extra > 0.5 ? vec3(1.0, 0.72, 0.3) : vec3(0.35, 1.0, 0.55);
      float scan = 0.78 + 0.22 * sin(p.y * fs.y * 3.1416);
      float vig = 1.0 - 0.6 * dot(p - 0.5, p - 0.5) * 2.0;
      emission = col * emis * (0.1 + on * 0.85) * scan * vig * uPower;
      emission = mix(emission, col * emis * 0.25 * uPower, smoothstep(0.02, 0.08, pm));
    }
    wet = 0.9;
  } else if (style > 7.5 && style < 8.5) {
    // métal poli
    albedo = vCol * (0.75 + 0.35 * vnoise(vWP.xz * 3.0 + vWP.y * 2.0));
    wet = 0.95;
    emission += vCol * fres * 0.05;
  } else if (style > 8.5 && style < 9.5) {
    // étoffe : trame, plis verticaux, lisière
    vec2 q = vertical ? wq : vWP.xz;
    float fold = 0.8 + 0.2 * sin(q.x * 2.3 + vnoise(q * 0.4) * 3.0);
    albedo = vCol * fold * (0.9 + 0.12 * h21(floor(q / 0.05)));
    float hem = 1.0 - band(um.y, 0.18, fm.y - 0.18, pm) * band(um.x, 0.12, fm.x - 0.12, pm);
    albedo = mix(albedo, vec3(0.75, 0.62, 0.3), hem * step(0.5, extra));
    wet = 0.05;
  } else if (style > 9.5 && style < 10.5) {
    // roche brute
    vec2 q = vertical ? wq : vWP.xz;
    float n = vnoise(q * 0.08) * 0.5 + vnoise(q * 0.4) * 0.3 + vnoise(q * 2.0) * 0.2;
    albedo = vCol * (0.55 + 0.7 * n);
    weather = true;
    wet = 0.3;
  } else if (style > 10.5 && style < 11.5) {
    // tuyauterie : colliers et bandes d'identification
    float along = vertical ? vWP.y : (fm.x > fm.y ? um.x : um.y);
    float clamp_ = band(fract(along / 3.0), 0.0, 0.05, pm / 3.0);
    albedo *= 1.0 - 0.45 * clamp_;
    float tag = band(fract(along / 9.0 + h11(seed)), 0.5, 0.56, pm / 9.0);
    albedo = mix(albedo, h11(seed * 3.3) > 0.5 ? vec3(0.55, 0.42, 0.08) : vec3(0.1, 0.25, 0.4), tag);
    wet = 0.55;
  } else if (style > 12.5 && style < 13.5) {
    albedo = vCol * (0.92 + 0.08 * vn);
    wet = 0.2;
  } else if (style > 13.5 && style < 14.5) {
    // devanture : vitrage à petits bois, étagères chargées
    albedo = vec3(0.03, 0.028, 0.025);
    if (vertical) {
      float w1 = pm;
      float inside = band(um.x, 0.08, fm.x - 0.08, w1) * band(um.y, 0.08, fm.y - 0.1, w1);
      float mull = 1.0 - band(fract(um.x / 0.7), 0.05, 0.95, w1 / 0.7);
      float sill = 1.0 - step(0.85, um.y);
      float glassK = inside * (1.0 - mull) * (1.0 - sill);
      float depth = 0.35 + 0.65 * smoothstep(0.85, fm.y, um.y);
      float shelf = 0.7 + 0.3 * step(0.2, fract(um.y / 0.45));
      vec2 gi = vec2(floor(um.x / 0.14), floor(um.y / 0.45));
      float goods = 0.55 + 0.6 * h21(gi + seed);
      vec3 tint = mix(vec3(1.0), vec3(0.8, 0.6, 0.4) + 0.5 * vec3(h21(gi * 1.3), h21(gi * 2.1), h21(gi * 0.7)), 0.35);
      emission = vCol * emis * depth * shelf * goods * tint * glassK * 0.8 * uPower;
      emission = mix(emission, vCol * emis * 0.35 * inside * uPower, smoothstep(0.03, 0.1, pm));
      albedo = mix(albedo, vec3(0.12, 0.1, 0.08), sill * inside);
    }
  } else if (style > 14.5 && style < 15.5) {
    // eau croupie, boue
    vec2 q = vWP.xz;
    float n = vnoise(q * 0.12 + vec2(uTime * 0.03, uTime * 0.02)) * 0.6 + vnoise(q * 0.6 - uTime * 0.05) * 0.4;
    albedo = vCol * (0.35 + 0.4 * n);
    emission = vCol * emis * (0.2 + 0.8 * smoothstep(0.4, 0.9, n));
    wet = 1.0;
  } else if (style > 15.5 && style < 16.5) {
    // chute d'eau
    vec2 q = vertical ? wq : vWP.xz;
    float s = vnoise(vec2(q.x * 3.0, q.y * 0.25 + uTime * 2.5)) * 0.7 + vnoise(vec2(q.x * 9.0, q.y * 0.6 + uTime * 4.0)) * 0.3;
    albedo = vCol * (0.3 + 0.5 * s);
    emission = vCol * emis * (0.2 + 0.8 * smoothstep(0.45, 0.85, s));
    wet = 0.9;
  } else if (style > 17.5 && style < 18.5) {
    // carrelage poli (grands carreaux, joints)
    vec2 q = vertical ? wq : vWP.xz;
    vec2 tf = fract(q / 0.6);
    float joint = (1.0 - band(tf.x, 0.015, 0.985, pm / 0.6)) + (1.0 - band(tf.y, 0.015, 0.985, pm / 0.6));
    albedo *= (0.92 + 0.12 * h21(floor(q / 0.6) + seed)) * (1.0 - 0.35 * clamp(joint, 0.0, 1.0) * (1.0 - smoothstep(0.02, 0.06, pm)));
    wet = 0.85;
  } else if (style > 18.5 && style < 19.5) {
    // feuillage, cultures : voxels de tons variés ; extra 1 : blé (tiges et épis) ; extra 2 : légumes en touffes
    float hv = h31(vec3(floor(vWP * 10.0 + 0.001 - N * 0.5)) + seed);
    if (extra > 0.5 && extra < 1.5) {
      if (vertical) {
        float st = fract(wq.x / 0.06);
        albedo = vCol * (0.55 + 0.45 * step(0.35, st)) * (0.8 + 0.3 * h11(floor(wq.x / 0.06)));
        albedo *= mix(0.55, 1.05, smoothstep(0.0, 0.8, um.y / max(fm.y, 0.01)));
      } else {
        vec2 e = fract(vWP.xz / 0.08) - 0.5;
        float ear = 1.0 - smoothstep(0.18, 0.32, length(e * vec2(1.0, 0.6)));
        albedo = vCol * (0.7 + 0.45 * ear) * (0.9 + 0.2 * h21(floor(vWP.xz / 0.08)));
      }
      albedo = mix(albedo, vCol, far);
    } else if (extra > 1.5) {
      vec2 qq = (vertical ? wq : vWP.xz) / 0.32;
      vec2 c = fract(qq) - 0.5;
      float leaf = 1.0 - smoothstep(0.28, 0.5, length(c));
      albedo = vCol * (0.55 + 0.55 * leaf) * (0.85 + 0.3 * h21(floor(qq)));
      albedo = mix(albedo, vCol * 0.85, far);
    } else {
      albedo = vCol * mix(0.7 + 0.6 * hv, 1.05, far);
      if (hv < 0.06) albedo *= 0.55;
    }
    if (N.y > 0.5) albedo *= 1.1;
    wet = 0.25;
  } else if (style > 19.5 && style < 20.5) {
    // eau claire : caustiques, reflets
    vec2 wq2 = floor(vWP.xz / 0.2) * 0.2;
    float c = sin(wq2.x * 1.7 + uTime * 1.1) * sin(wq2.y * 2.1 - uTime * 0.9) + sin((wq2.x + wq2.y) * 1.3 + uTime * 1.5);
    float caus = pow(abs(c) * 0.5, 0.8);
    albedo = vCol * 0.3;
    emission = vCol * emis * (0.3 + 0.7 * caus) + vec3(0.7, 0.85, 0.9) * fres * 0.12;
    wet = 1.0;
  } else if (style > 21.5 && style < 22.5) {
    // tôle ondulée rouillée
    weather = true;
    vec2 q = vertical ? wq : vWP.xz;
    float rib = 0.75 + 0.3 * smoothstep(0.2, 0.5, abs(fract(q.x * 6.0) - 0.5));
    albedo *= mix(rib, 0.93, smoothstep(0.02, 0.05, pm));
    float rust = smoothstep(0.4, 0.8, vnoise(vec2(q.x * 1.3, q.y * 0.3))) * (0.5 + 0.5 * vnoise(q * 0.9));
    albedo = mix(albedo, vec3(0.3, 0.16, 0.08), rust * 0.75);
    wet = 0.3;
  } else if (style > 22.5 && style < 23.5) {
    // tapis roulant : lattes qui défilent
    float ax = extra > 0.5 ? vWP.z : vWP.x;
    float s = fract(ax * 3.0 - uTime * 1.2);
    albedo = mix(vec3(0.04), vCol, step(0.22, s));
    wet = 0.3;
  } else if (style > 23.5 && style < 24.5) {
    // murs intérieurs peints : soubassement plus sombre, cimaise, joints de panneaux
    if (vertical) {
      float yl = mod(vWP.y + 0.6, 6.0);
      float dado = 1.0 - step(1.05, yl);
      float rail = band(yl, 1.05, 1.12, pm);
      albedo *= mix(1.0, 0.72, dado) * (1.0 - 0.25 * rail);
      float seam = 1.0 - band(fract(wq.x / 1.2), 0.006, 0.994, pm / 1.2);
      albedo *= 1.0 - 0.18 * seam * (1.0 - smoothstep(0.02, 0.06, pm));
      albedo *= 0.94 + 0.1 * vnoise(wq * vec2(1.3, 0.4) + seed);
      // traces d'usure près du sol
      albedo *= mix(0.78, 1.0, smoothstep(0.0, 0.35, yl));
    } else albedo *= 0.9 + 0.1 * vnoise(vWP.xz * 0.7);
    wet = 0.18;
  } else if (style > 24.5 && style < 25.5) {
    // linoléum / carreaux de sol (extra 1 : damier)
    vec2 q = vWP.xz;
    vec2 tf = fract(q / 0.3);
    vec2 ti = floor(q / 0.3);
    float joint = (1.0 - band(tf.x, 0.02, 0.98, pm / 0.3)) + (1.0 - band(tf.y, 0.02, 0.98, pm / 0.3));
    if (extra > 0.5) albedo *= mod(ti.x + ti.y, 2.0) < 0.5 ? 1.0 : 0.62;
    albedo *= (0.93 + 0.1 * h21(ti + seed)) * (1.0 - 0.2 * clamp(joint, 0.0, 1.0) * (1.0 - smoothstep(0.015, 0.05, pm)));
    albedo *= 0.85 + 0.15 * vnoise(q * 0.5);
    wet = 0.55;
  } else if (style > 25.5 && style < 26.5) {
    // grille lumineuse à lamelles
    vec2 p = um / max(fm, vec2(0.01));
    float slat = step(0.35, fract(p.x * max(4.0, floor(fm.x / 0.12))));
    float frame = band(p.x, 0.06, 0.94, pm / max(fm.x, 0.01)) * band(p.y, 0.1, 0.9, pm / max(fm.y, 0.01));
    emission = vCol * emis * frame * mix(0.35, 1.0, slat) * uPower;
    emission = mix(emission, vCol * emis * 0.7 * frame * uPower, smoothstep(0.02, 0.06, pm));
    albedo = vCol * 0.2;
  } else if (style > 26.5 && style < 27.5) {
    // bois : lames et veinage
    vec2 q = vertical ? wq : vWP.xz;
    float along = abs(N.x) > 0.5 || (!vertical && fm.x > fm.y) ? q.x : q.y;
    float across = abs(N.x) > 0.5 || (!vertical && fm.x > fm.y) ? q.y : q.x;
    float plank = floor(across / 0.18);
    float grain = 0.85 + 0.15 * sin(along * 14.0 + vnoise(vec2(along * 0.8, plank)) * 6.0);
    albedo = vCol * grain * (0.85 + 0.25 * h11(plank + seed));
    wet = 0.35;
  } else if (style > 27.5 && style < 28.5) {
    // terre cultivée : sillons
    vec2 q = vWP.xz;
    float furrow = 0.75 + 0.25 * sin((q.x + q.y * 0.02) * 10.0);
    albedo = vCol * furrow * (0.8 + 0.4 * vnoise(q * 2.0));
    wet = 0.2;
  } else if (style > 28.5 && style < 29.5) {
    // sol de la surface : terre morte et poussière ; herbe drue dans la simulation du casque.
    // Les contremarches de 20 cm du relief voxel sont éclairées comme le sol autour d'elles,
    // sinon chaque pente douce se couvre de courbes de niveau ; seuls les vrais talus gardent leur face.
    float cliff = extra > 0.5 ? 1.0 : vertical ? smoothstep(0.25, 1.4, fm.y) : 0.0;
    if (vertical) N = normalize(mix(vec3(0.0, 1.0, 0.0), N, cliff));
    vec2 q = cliff > 0.5 ? wq : vWP.xz;
    float n = vnoise(q * 0.06) * 0.5 + vnoise(q * 0.45) * 0.3 + vnoise(q * 2.2) * 0.2;
    vec3 dead = mix(vec3(0.3, 0.27, 0.23), vec3(0.44, 0.39, 0.32), n) * (0.86 + 0.24 * h21(floor(q * 4.0)));
    dead = mix(dead, vec3(0.22, 0.2, 0.18), smoothstep(0.62, 0.8, vnoise(q * 0.9 + 3.0)) * 0.6);
    vec3 grass = mix(vec3(0.16, 0.3, 0.09), vec3(0.3, 0.5, 0.15), n) * (0.82 + 0.34 * h21(floor(q * 5.0)));
    vec3 side = mix(grass * 0.8, vec3(0.3, 0.22, 0.14), smoothstep(0.8, 3.0, fm.y) * 0.6);
    albedo = mix(dead, mix(grass, side, cliff), uSim) * mix(edge, 1.0, mix(0.8, 0.5, cliff));
    wet = 0.05;
  }

  // --- patine : coulures, crasse, pieds de murs ------------------------------
  if (weather) {
    float soot = vnoise(vWP.xz * 0.05 + vWP.y * 0.03) * 0.6 + vnoise(wq * 0.25) * 0.4;
    albedo *= 1.0 - 0.28 * smoothstep(0.5, 0.85, soot);
    if (vertical) {
      float drip = smoothstep(0.55, 0.88, vnoise(vec2(wq.x * 1.7, wq.y * 0.09))) * (0.4 + 0.6 * vnoise(wq * vec2(0.5, 0.05)));
      albedo *= 1.0 - drip * 0.3;
      albedo = mix(albedo, albedo * vec3(0.92, 0.85, 0.72), drip * 0.4);
    }
  }

  vec3 diff, spec;
  shade(vWP, N, Vw, wet, diff, spec);
  vec3 col = albedo * diff + spec * (1.0 - far * 0.5) + emission;
  if (uHi.z > 0.0) {
    float k = band(vWP.y, uHi.x, uHi.y, 0.3);
    col = mix(col, col * 1.6 + vec3(0.9, 0.55, 0.18) * 0.35 * uHi.z, k * 0.8);
  }
  gl_FragColor = vec4(col, 1.0);
  #include <fog_fragment>
}
`;

function makeUniforms() {
  return {
    ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
    ...shared,
  };
}

export function createVoxelMaterial(outdoor = false): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: outdoor ? 'voxel-out' : 'voxel',
    uniforms: makeUniforms(),
    vertexShader: VOXEL_VERT,
    fragmentShader: VOXEL_FRAG,
    defines: outdoor ? { OUTDOOR: '' } : {},
    fog: true,
  });
}

/** Variante animée pour les habitants (membres articulés dans le vertex shader). */
export function createPedMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    name: 'ped',
    uniforms: makeUniforms(),
    vertexShader: VOXEL_VERT,
    fragmentShader: VOXEL_FRAG,
    defines: { PED: '' },
    fog: true,
  });
}
