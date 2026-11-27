/**
 * mapLyon.js — Génération procédurale de la carte de Lyon.
 *
 * Repère : 1 unité = 1 mètre. Axe X = est (+) / ouest (-). Axe Z = sud (+) / nord (-).
 *
 * Contenu :
 *  - Relief (colline de la Croix-Rousse, colline de Fourvière, lac du Parc de la Tête d'Or)
 *  - Fleuves : Saône (ouest) et Rhône (est), quais en pente (perrés), berges basses, parapets
 *  - Ponts praticables, réseau de rues par quartier, rues en pente (montées), traboules
 *  - Immeubles par style (haussmannien, canut, Vieux Lyon, tours de bureaux, Confluence…)
 *  - Monuments : Place Bellecour + statue équestre, Tour Part-Dieu (le Crayon), Incity,
 *    gares Part-Dieu et Perrache, centre commercial, Hôpital de la Croix-Rousse, Basilique
 *    de Fourvière, Tour métallique, Cathédrale Saint-Jean, Musée des Confluences, Cubes…
 *  - Mobilier urbain : lampadaires (allumés la nuit), arbres, péniches, marqueurs d'entrée
 *  - Physique simple : hauteur du sol, collisions (boîtes orientées), lancer de rayon caméra
 *  - Carte radar (canvas) réutilisée par le HUD
 */
import * as THREE from 'three';

// ───────────────────────────── Constantes ─────────────────────────────
export const WORLD = { minX: -1000, maxX: 1000, minZ: -1200, maxZ: 1200 };
export const WATER_LEVEL = -3.2;

const T_STEP = 4;          // résolution du maillage de relief (m)
const OCC = 2;             // résolution de la grille d'occupation du sol (m)
const PERRE_W = 6;         // largeur du quai en pente (perré)
const BERGE_H = -2.6;      // hauteur des berges basses
const BED_H = -7.5;        // fond du fleuve
const ROAD_W = 12;         // largeur d'une rue standard
const QUAI_OFFSET = 11;    // distance entre le bord du fleuve et l'axe de la route de quai
const STEP_UP = 0.5;       // hauteur de marche franchissable à pied
const CONFLUENCE_Z = 1040; // au sud de ce Z, Saône et Rhône ne font plus qu'un
const HASH_CELL = 24;      // taille des cellules de la table spatiale des collisions
const CHUNK = 400;         // taille des morceaux de maillage (pour ne dessiner que ce qui est visible)

// Codes de la grille d'occupation
const O_FREE = 0, O_ROAD = 1, O_WATER = 2, O_RESERVED = 3, O_PARK = 4, O_RAIL = 5,
  O_BUILDING = 6, O_GARDEN = 7, O_PLAZA = 8;

// Tracés des fleuves : [x, z, demi-largeur]
const SAONE_CTRL = [
  [-420, -1320, 34], [-428, -1000, 34], [-428, -700, 35], [-385, -420, 35], [-335, -120, 36],
  [-302, 180, 36], [-255, 480, 36], [-185, 780, 37], [-95, 975, 39], [-30, 1065, 42],
];
const RHONE_CTRL = [
  [365, -1320, 60], [322, -1000, 60], [282, -650, 60], [256, -300, 60], [249, 0, 60],
  [236, 300, 60], [214, 560, 61], [168, 780, 63], [85, 935, 72], [-15, 1065, 92],
  [-38, 1200, 95], [-34, 1330, 95],
];

const BRIDGES = [
  { river: 'saone', z: -1000, name: 'Pont Koenig', style: 'metal' },
  { river: 'saone', z: -620, name: 'Pont Schuman', style: 'stone' },
  { river: 'saone', z: -340, name: 'Pont La Feuillée', style: 'metal' },
  { river: 'saone', z: -100, name: 'Pont Maréchal Juin', style: 'stone' },
  { river: 'saone', z: 240, name: 'Pont Bonaparte', style: 'stone' },
  { river: 'saone', z: 520, name: 'Pont Kitchener', style: 'metal' },
  { river: 'saone', z: 860, name: 'Pont de la Mulatière', style: 'stone' },
  { river: 'rhone', z: -1000, name: 'Pont Poincaré', style: 'metal' },
  { river: 'rhone', z: -620, name: 'Pont Churchill', style: 'metal' },
  { river: 'rhone', z: -450, name: 'Pont Morand', style: 'stone' },
  { river: 'rhone', z: -100, name: 'Pont Lafayette', style: 'stone' },
  { river: 'rhone', z: 140, name: 'Pont de la Guillotière', style: 'stone' },
  { river: 'rhone', z: 410, name: "Pont de l'Université", style: 'stone' },
  { river: 'rhone', z: 720, name: 'Pont Galliéni', style: 'metal' },
];

// Péniches amarrées : rivière, z, côté (-1 ouest / +1 est)
const BOATS = [
  ['rhone', -380, 1], ['rhone', -250, 1], ['rhone', 30, 1], ['rhone', 280, 1], ['rhone', 560, 1],
  ['rhone', -300, -1], ['rhone', 200, -1],
  ['saone', -500, -1], ['saone', 60, -1], ['saone', -200, 1], ['saone', 400, 1], ['saone', 680, 1],
];

// Styles d'immeubles
const STYLES = {
  haussmann: {
    w: [14, 24], d: [12, 20], h: [17, 24], facade: 'classic', bay: 3.2, floor: 3.3, roof: 'mansard', skip: 0.015,
    colors: ['#e9dfc8', '#efe6d2', '#dccfb4', '#e4d6bb', '#f2ead9', '#d9cbb0'],
  },
  canut: {
    w: [12, 20], d: [10, 16], h: [19, 28], facade: 'classic', bay: 3.4, floor: 4.2, roof: 'tile', skip: 0.03,
    colors: ['#e3b98a', '#d9a679', '#e8c79b', '#d79f80', '#f0d3a8', '#c98f6e', '#e9c08f'],
  },
  vieux: {
    w: [8, 14], d: [9, 14], h: [11, 18], facade: 'classic', bay: 3.0, floor: 3.4, roof: 'tile', skip: 0.02,
    colors: ['#f0b27a', '#e9967a', '#f4d06f', '#e8a87c', '#d4846a', '#f6c28b', '#efb98e'],
  },
  business: {
    w: [22, 40], d: [22, 36], h: [35, 105], facade: 'modern', bay: 2.2, floor: 3.6, roof: 'flat', skip: 0.25, margin: 3,
    colors: ['#c9d6e2', '#b8c8d8', '#d8e0e8', '#a9bccd', '#e0e6ea', '#9fb0bf'],
  },
  confluence: {
    w: [20, 34], d: [18, 30], h: [14, 34], facade: 'modern', bay: 2.4, floor: 3.4, roof: 'flat', skip: 0.12, margin: 2,
    colors: ['#ff8a2a', '#7fc241', '#f2f2f2', '#e8e8e0', '#4fb3d9', '#d94f4f', '#ffffff', '#f5d142'],
  },
  generic: {
    w: [12, 22], d: [10, 18], h: [9, 24], facade: 'plain', bay: 3.0, floor: 3.0, roof: 'flat', skip: 0.05,
    colors: ['#d8d0c4', '#c9bfb0', '#e0d8cc', '#bfb4a4', '#d6c6ae', '#e6dccb', '#cdb79a'],
  },
  house: {
    w: [9, 13], d: [8, 12], h: [6, 9], facade: 'plain', bay: 3.0, floor: 3.0, roof: 'tile', skip: 0.5, margin: 2,
    colors: ['#f3e0c0', '#efd3b0', '#f6e7cf', '#e8c9a5', '#f1dbc2'],
  },
};

// ───────────────────────────── Utilitaires ─────────────────────────────
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
function smooth(e0, e1, x) {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
}
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function canvasTexture(canvas, { repeat = false, srgb = true, anisotropy = 4 } = {}) {
  const t = new THREE.CanvasTexture(canvas);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = anisotropy;
  t.needsUpdate = true;
  return t;
}
const nextFrame = () => new Promise((r) => setTimeout(r, 16));
function polyLength(pts) {
  let l = 0;
  for (let i = 1; i < pts.length; i++) l += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
  return l;
}

// ───────────────────────────── Fleuve ─────────────────────────────
class River {
  constructor(id, name, ctrl, bergeW) {
    this.id = id;
    this.name = name;
    this.bergeW = bergeW; // largeur perré + berge basse (depuis le bord)
    const curve = new THREE.CatmullRomCurve3(
      ctrl.map(([x, z, hw]) => new THREE.Vector3(x, hw, z)), false, 'centripetal');
    const n = Math.ceil(curve.getLength() / 8);
    const sp = curve.getSpacedPoints(n);
    this.count = sp.length;
    this.x = new Float32Array(this.count);
    this.z = new Float32Array(this.count);
    this.hw = new Float32Array(this.count);
    this.nx = new Float32Array(this.count);
    this.nz = new Float32Array(this.count);
    sp.forEach((v, i) => { this.x[i] = v.x; this.z[i] = v.z; this.hw[i] = v.y; });
    for (let i = 0; i < this.count; i++) {
      const a = Math.max(0, i - 1), b = Math.min(this.count - 1, i + 1);
      let tx = this.x[b] - this.x[a], tz = this.z[b] - this.z[a];
      const l = Math.hypot(tx, tz) || 1;
      tx /= l; tz /= l;
      this.nx[i] = tz; this.nz[i] = -tx; // normale pointant vers l'est
    }
  }
  indexAtZ(z) {
    let lo = 0, hi = this.count - 1;
    if (z <= this.z[0]) return 0;
    if (z >= this.z[hi]) return hi - 1;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (this.z[m] <= z) lo = m; else hi = m;
    }
    return lo;
  }
  _t(i, z) { return clamp((z - this.z[i]) / (this.z[i + 1] - this.z[i] || 1), 0, 1); }
  xAt(z) { const i = this.indexAtZ(z); return lerp(this.x[i], this.x[i + 1], this._t(i, z)); }
  hwAt(z) { const i = this.indexAtZ(z); return lerp(this.hw[i], this.hw[i + 1], this._t(i, z)); }
  /** Abscisse X de la rive (side = -1 rive ouest, +1 rive est) à la latitude z. */
  bankX(z, side, extra = 0) {
    const i = this.indexAtZ(z);
    const s = (this.x[i + 1] - this.x[i]) / (this.z[i + 1] - this.z[i] || 1);
    return this.xAt(z) + side * (this.hwAt(z) + extra) * Math.sqrt(1 + s * s);
  }
  offsetPoint(i, side, dist) {
    return [this.x[i] + this.nx[i] * side * dist, this.z[i] + this.nz[i] * side * dist];
  }
  /** Distance au lit du fleuve. */
  sample(x, z) {
    const i0 = this.indexAtZ(z);
    const a = Math.max(0, i0 - 30), b = Math.min(this.count - 2, i0 + 30);
    let best = 1e12, bhw = 0, bi = i0;
    for (let i = a; i <= b; i++) {
      const ax = this.x[i], az = this.z[i];
      const dx = this.x[i + 1] - ax, dz = this.z[i + 1] - az;
      const l2 = dx * dx + dz * dz || 1;
      let t = ((x - ax) * dx + (z - az) * dz) / l2;
      t = t < 0 ? 0 : t > 1 ? 1 : t;
      const ex = x - (ax + dx * t), ez = z - (az + dz * t);
      const d2 = ex * ex + ez * ez;
      if (d2 < best) { best = d2; bhw = this.hw[i] + (this.hw[i + 1] - this.hw[i]) * t; bi = i; }
    }
    return { d: Math.sqrt(best), hw: bhw, i: bi };
  }
}

// ───────────────────────────── Constructeur de géométrie fusionnée ─────────────────────────────
class GeoBuilder {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; this.idx = []; this.v = 0; }
  /** Quadrilatère a,b,c,d dans le sens anti-horaire vu de face. */
  quad(a, b, c, d, uv, col) {
    const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2];
    const vx = d[0] - a[0], vy = d[1] - a[1], vz = d[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz) || 1;
    nx /= l; ny /= l; nz /= l;
    for (const p of [a, b, c, d]) {
      this.p.push(p[0], p[1], p[2]);
      this.n.push(nx, ny, nz);
      this.c.push(col.r, col.g, col.b);
    }
    this.uv.push(...(uv || [0, 0, 1, 0, 1, 1, 0, 1]));
    const v = this.v;
    this.idx.push(v, v + 1, v + 2, v, v + 2, v + 3);
    this.v += 4;
  }
  /** Boîte orientée (angle a autour de Y), centre (cx, cz), demi-tailles hx/hz, de y0 à y1. */
  obox(cx, cz, hx, hz, y0, y1, a, col, uvo = {}, faces = {}) {
    const c = Math.cos(a), s = Math.sin(a);
    const P = (lx, y, lz) => [cx + lx * c + lz * s, y, cz - lx * s + lz * c];
    const su = uvo.su || 4, sv = uvo.sv || 4, uo = uvo.uo || 0, vo = uvo.vo || 0;
    const x0 = -hx, x1 = hx, z0 = -hz, z1 = hz, h = y1 - y0;
    const side = (len) => [uo, vo, uo + len / su, vo, uo + len / su, vo + h / sv, uo, vo + h / sv];
    this.quad(P(x0, y0, z1), P(x1, y0, z1), P(x1, y1, z1), P(x0, y1, z1), side(2 * hx), col);
    this.quad(P(x1, y0, z0), P(x0, y0, z0), P(x0, y1, z0), P(x1, y1, z0), side(2 * hx), col);
    this.quad(P(x1, y0, z1), P(x1, y0, z0), P(x1, y1, z0), P(x1, y1, z1), side(2 * hz), col);
    this.quad(P(x0, y0, z0), P(x0, y0, z1), P(x0, y1, z1), P(x0, y1, z0), side(2 * hz), col);
    if (faces.top !== false) {
      const tu = uvo.topScale || su;
      this.quad(P(x0, y1, z1), P(x1, y1, z1), P(x1, y1, z0), P(x0, y1, z0),
        [0, 0, 2 * hx / tu, 0, 2 * hx / tu, 2 * hz / tu, 0, 2 * hz / tu], col);
    }
    if (faces.bottom) this.quad(P(x0, y0, z0), P(x1, y0, z0), P(x1, y0, z1), P(x0, y0, z1), null, col);
  }
  /** Tronc de pyramide (toit mansardé / toit en croupe). */
  frustum(cx, cz, hx, hz, y0, y1, inset, col) {
    const i = Math.min(inset, hx - 0.05, hz - 0.05);
    const P = (x, y, z) => [cx + x, y, cz + z];
    const ax = hx - i, az = hz - i;
    this.quad(P(-hx, y0, hz), P(hx, y0, hz), P(ax, y1, az), P(-ax, y1, az), null, col);
    this.quad(P(hx, y0, -hz), P(-hx, y0, -hz), P(-ax, y1, -az), P(ax, y1, -az), null, col);
    this.quad(P(hx, y0, hz), P(hx, y0, -hz), P(ax, y1, -az), P(ax, y1, az), null, col);
    this.quad(P(-hx, y0, -hz), P(-hx, y0, hz), P(-ax, y1, az), P(-ax, y1, -az), null, col);
    if (ax > 0.06 && az > 0.06) this.quad(P(-ax, y1, az), P(ax, y1, az), P(ax, y1, -az), P(-ax, y1, -az), null, col);
  }
  get empty() { return this.v === 0; }
  build() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    g.setIndex(this.v > 65535 ? new THREE.Uint32BufferAttribute(this.idx, 1) : new THREE.Uint16BufferAttribute(this.idx, 1));
    g.computeBoundingSphere();
    return g;
  }
}

// ───────────────────────────── Textures procédurales ─────────────────────────────
function makeFacadeTextures(kind, rng, anisotropy) {
  const S = 512, C = 128;
  const cv = makeCanvas(S, S), g = cv.getContext('2d');
  const ev = makeCanvas(S, S), ge = ev.getContext('2d');
  ge.fillStyle = '#000'; ge.fillRect(0, 0, S, S);
  const warm = ['#ffcf73', '#ffe0a0', '#fff2c8', '#ffb85c', '#ffd890'];
  const cold = ['#e8f2ff', '#fff6dc', '#d6e8ff', '#fffaf0'];
  if (kind === 'classic') {
    g.fillStyle = '#f3efe6'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,0.05)';
    for (let y = 0; y < S; y += 16) g.fillRect(0, y, S, 1);
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const x0 = bx * C, y0 = fy * C;
      g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x0, y0, C, 4);
      const wx = x0 + 36, wy = y0 + 20, ww = 56, wh = 82;
      g.fillStyle = '#fbf9f4'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 9);
      const gr = g.createLinearGradient(0, wy, 0, wy + wh);
      gr.addColorStop(0, '#5d6b78'); gr.addColorStop(1, '#232c35');
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#e9e4d8'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.33, ww, 3);
      g.fillStyle = '#20242a'; g.fillRect(wx - 9, wy + wh - 8, ww + 18, 4);
      for (let k = 0; k < 10; k++) g.fillRect(wx - 9 + k * 8.2, wy + wh - 8, 2, 14);
      if (rng() < 0.42) {
        ge.fillStyle = warm[Math.floor(rng() * warm.length)];
        ge.fillRect(wx, wy, ww, wh);
        ge.fillStyle = '#000'; ge.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      }
    }
  } else if (kind === 'modern') {
    g.fillStyle = '#dfe6ea'; g.fillRect(0, 0, S, S);
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const x0 = bx * C, y0 = fy * C;
      const gr = g.createLinearGradient(x0, y0, x0 + C, y0 + C);
      gr.addColorStop(0, '#8aa4b8'); gr.addColorStop(0.55, '#4b6378'); gr.addColorStop(1, '#6f8aa0');
      g.fillStyle = gr; g.fillRect(x0 + 5, y0 + 12, C - 10, C - 16);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.beginPath(); g.moveTo(x0 + 5, y0 + C - 4); g.lineTo(x0 + 40, y0 + 12); g.lineTo(x0 + 60, y0 + 12); g.lineTo(x0 + 25, y0 + C - 4); g.fill();
      g.fillStyle = '#8f9ba3'; g.fillRect(x0, y0, C, 9);
      if (rng() < 0.5) {
        ge.fillStyle = cold[Math.floor(rng() * cold.length)];
        ge.fillRect(x0 + 5, y0 + 12, C - 10, C - 16);
      }
    }
  } else { // plain
    g.fillStyle = '#f4f1eb'; g.fillRect(0, 0, S, S);
    g.fillStyle = 'rgba(0,0,0,0.04)';
    for (let k = 0; k < 400; k++) g.fillRect(rng() * S, rng() * S, 3 + rng() * 6, 2);
    for (let fy = 0; fy < 4; fy++) for (let bx = 0; bx < 4; bx++) {
      const x0 = bx * C, y0 = fy * C;
      const wx = x0 + 34, wy = y0 + 30, ww = 60, wh = 66;
      g.fillStyle = '#d9d4ca'; g.fillRect(wx - 5, wy + wh, ww + 10, 6);
      g.fillStyle = '#323a42'; g.fillRect(wx, wy, ww, wh);
      g.fillStyle = '#c8c2b6'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh);
      if (rng() < 0.4) {
        ge.fillStyle = warm[Math.floor(rng() * warm.length)];
        ge.fillRect(wx, wy, ww, wh);
      }
    }
  }
  return {
    map: canvasTexture(cv, { repeat: true, anisotropy }),
    emissive: canvasTexture(ev, { repeat: true, anisotropy }),
  };
}

function makeStoneTexture(rng, anisotropy) {
  const cv = makeCanvas(256, 256), g = cv.getContext('2d');
  g.fillStyle = '#e8e2d6'; g.fillRect(0, 0, 256, 256);
  for (let y = 0; y < 256; y += 32) {
    const off = (y / 32) % 2 ? 32 : 0;
    for (let x = -32; x < 256; x += 64) {
      const v = 200 + Math.floor(rng() * 40);
      g.fillStyle = `rgb(${v},${v - 6},${v - 16})`;
      g.fillRect(x + off + 2, y + 2, 60, 28);
    }
  }
  return canvasTexture(cv, { repeat: true, anisotropy });
}

function makeDeckTexture(anisotropy) {
  const cv = makeCanvas(256, 256), g = cv.getContext('2d');
  // v (vertical) = largeur du pont (16 m), u (horizontal) = longueur (16 m)
  g.fillStyle = '#9c978e'; g.fillRect(0, 0, 256, 256);
  g.fillStyle = '#3a3a3d'; g.fillRect(0, 32, 256, 192);
  g.fillStyle = '#d8d8d0';
  for (let x = 0; x < 256; x += 64) g.fillRect(x, 126, 34, 4);
  g.fillStyle = '#c9c4b8'; g.fillRect(0, 30, 256, 3); g.fillRect(0, 223, 256, 3);
  return canvasTexture(cv, { repeat: true, anisotropy });
}

function makeRadialTexture(inner = 'rgba(255,220,150,0.9)', outer = 'rgba(255,200,120,0)') {
  const cv = makeCanvas(128, 128), g = cv.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, inner); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return canvasTexture(cv);
}

function makeSignTexture(text, { bg = '#1b1b1b', fg = '#ffffff', w = 1024, h = 256, font = 'bold 120px "Bebas Neue", Impact, sans-serif', border = null } = {}) {
  const cv = makeCanvas(w, h), g = cv.getContext('2d');
  g.fillStyle = bg; g.fillRect(0, 0, w, h);
  if (border) { g.strokeStyle = border; g.lineWidth = 12; g.strokeRect(6, 6, w - 12, h - 12); }
  g.fillStyle = fg; g.font = font; g.textAlign = 'center'; g.textBaseline = 'middle';
  let size = parseInt(font.match(/(\d+)px/)[1], 10);
  while (g.measureText(text).width > w * 0.92 && size > 20) {
    size -= 6; g.font = font.replace(/\d+px/, size + 'px');
  }
  g.fillText(text, w / 2, h / 2 + 4);
  return canvasTexture(cv);
}

function makeWaterNormal() {
  const S = 256;
  const cv = makeCanvas(S, S), g = cv.getContext('2d');
  const img = g.createImageData(S, S);
  const hgt = (x, y) => {
    const u = (x / S) * Math.PI * 2, v = (y / S) * Math.PI * 2;
    return Math.sin(u * 3 + v * 2) * 0.5 + Math.sin(u * 7 - v * 5) * 0.25 + Math.cos(u * 11 + v * 13) * 0.12 + Math.sin(v * 4) * 0.3;
  };
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1);
    let nx = -dx * 2, ny = -dy * 2, nz = 1;
    const l = Math.hypot(nx, ny, nz); nx /= l; ny /= l; nz /= l;
    const k = (y * S + x) * 4;
    img.data[k] = (nx * 0.5 + 0.5) * 255; img.data[k + 1] = (ny * 0.5 + 0.5) * 255; img.data[k + 2] = (nz * 0.5 + 0.5) * 255; img.data[k + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = canvasTexture(cv, { repeat: true, srgb: false });
  return t;
}

// ───────────────────────────── La carte ─────────────────────────────
export class LyonMap {
  constructor(scene, opts = {}) {
    this.scene = scene;
    this.anisotropy = opts.anisotropy || 4;
    this.group = new THREE.Group();
    this.group.name = 'Lyon';
    scene.add(this.group);
    this.rng = mulberry32(69001);

    this.saone = new River('saone', 'La Saône', SAONE_CTRL, 12);
    this.rhone = new River('rhone', 'Le Rhône', RHONE_CTRL, 16);
    this.rivers = [this.saone, this.rhone];

    this.roads = [];          // { pts:[[x,z],...], w, kind, name }  (réutilisé par le trafic à l'étape 2)
    this.bridges = [];        // { x0, x1, z0, z1, top, name }
    this.solids = [];         // boîtes de collision orientées
    this.solidHash = new Map();
    this.buildings = [];      // emprises pour le radar
    this.locations = [];      // lieux importants (entrées d'intérieurs, icônes radar)
    this.labels = [];         // étiquettes pour la grande carte
    this.plazas = [];         // places pavées (peinture du sol)
    this.lamps = [];          // positions des lampadaires
    this.trees = [];          // positions des arbres
    this.animated = [];       // callbacks (dt, t)
    this.nightMaterials = []; // { mat, max }
    this.markers = [];
    this.ramps = [];
    this.time = 0;
    this.spawn = { x: -65, z: 362, yaw: Math.PI };
  }

  /** Construit toute la ville. onProgress(texte, fraction). */
  async build(onProgress) {
    const steps = [
      ['Relief, Saône et Rhône', () => this._computeTerrain()],
      ['Tracé des rues et des quais', () => this._buildRoadNetwork()],
      ['Occupation du sol', () => this._buildOccupancy()],
      ['Monuments de Lyon', () => this._buildLandmarks()],
      ['Immeubles haussmanniens, canuts et tours', () => this._buildCity()],
      ['Pavés, asphalte et jardins', () => this._buildGround()],
      ['Ponts et parapets', () => this._buildBridgesAndQuays()],
      ['Lampadaires, arbres et péniches', () => this._buildStreetFurniture()],
      ['Eaux du Rhône et de la Saône', () => this._buildWater()],
      ['Carte radar', () => this._buildRadarMap()],
    ];
    for (let i = 0; i < steps.length; i++) {
      onProgress?.(steps[i][0], i / steps.length);
      await nextFrame();
      steps[i][1]();
    }
    onProgress?.('Prêt !', 1);
  }

  // ───────────── Relief ─────────────
  regionOf(x, z) { // 0 = rive droite (ouest), 1 = Presqu'île / Croix-Rousse, 2 = rive gauche (est)
    if (z < CONFLUENCE_Z) {
      if (x < this.saone.xAt(z)) return 0;
      if (x < this.rhone.xAt(z)) return 1;
      return 2;
    }
    return x < this.rhone.xAt(z) ? 0 : 2;
  }

  _analyze(x, z) {
    const a = this.saone.sample(x, z), b = this.rhone.sample(x, z);
    const ea = a.d - a.hw, eb = b.d - b.hw;
    const edge = Math.min(ea, eb);
    const river = ea < eb ? this.saone : this.rhone;
    const region = this.regionOf(x, z);
    const border = Math.min(x - WORLD.minX, WORLD.maxX - x, z - WORLD.minZ, WORLD.maxZ - z);
    const bm = smooth(0, 140, border);
    let h = 0;
    if (region === 1) { // Croix-Rousse : plateau au nord, pentes vers la Presqu'île
      h = 42 * smooth(-470, -720, z) * smooth(28, 150, edge) * bm;
      h += Math.sin(x * 0.02) * Math.cos(z * 0.017) * 1.5 * (h / 42);
    } else if (region === 0) { // Fourvière
      h = 55 * smooth(95, 270, edge) * smooth(560, 360, z) * smooth(-860, -640, z) * bm;
      h += 4 * Math.sin(x * 0.013 + 1) * Math.cos(z * 0.011) * (h / 55);
    } else { // Lac du parc de la Tête d'Or
      const lx = (x - 560) / 120, lz = (z + 905) / 60;
      const r = Math.sqrt(lx * lx + lz * lz);
      if (r < 1.1) h = Math.min(h, lerp(0, -6, smooth(1.05, 0.7, r)));
    }
    if (edge < 0) {
      const inside = -edge;
      if (inside < PERRE_W) h = lerp(0, BERGE_H, inside / PERRE_W);
      else if (inside < river.bergeW) h = BERGE_H;
      else h = lerp(BERGE_H, BED_H, Math.min(1, (inside - river.bergeW) / 5));
    }
    return { h, edge, region };
  }

  _computeTerrain() {
    this.nx = Math.round((WORLD.maxX - WORLD.minX) / T_STEP) + 1;
    this.nz = Math.round((WORLD.maxZ - WORLD.minZ) / T_STEP) + 1;
    const N = this.nx * this.nz;
    this.H = new Float32Array(N);
    this.E = new Float32Array(N);
    this.R = new Uint8Array(N);
    for (let j = 0; j < this.nz; j++) {
      const z = WORLD.minZ + j * T_STEP;
      for (let i = 0; i < this.nx; i++) {
        const x = WORLD.minX + i * T_STEP;
        const r = this._analyze(x, z);
        const k = j * this.nx + i;
        this.H[k] = r.h; this.E[k] = r.edge; this.R[k] = r.region;
      }
    }
  }

  _gridSample(arr, x, z) {
    const fx = (x - WORLD.minX) / T_STEP, fz = (z - WORLD.minZ) / T_STEP;
    let i = Math.floor(fx), j = Math.floor(fz);
    if (i < 0) i = 0; else if (i > this.nx - 2) i = this.nx - 2;
    if (j < 0) j = 0; else if (j > this.nz - 2) j = this.nz - 2;
    const tx = clamp(fx - i, 0, 1), tz = clamp(fz - j, 0, 1);
    const n = this.nx, k = j * n + i;
    const h00 = arr[k], h10 = arr[k + 1], h01 = arr[k + n], h11 = arr[k + n + 1];
    if (tx + tz <= 1) return h00 + (h10 - h00) * tx + (h01 - h00) * tz;
    return h11 + (h01 - h11) * (1 - tx) + (h10 - h11) * (1 - tz);
  }
  /** Hauteur du relief seul (sans ponts ni objets). */
  getGroundHeight(x, z) { return this._gridSample(this.H, x, z); }
  /** Distance signée au bord de l'eau (négative = dans le fleuve). */
  edgeAt(x, z) { return this._gridSample(this.E, x, z); }
  regionAt(x, z) {
    const i = clamp(Math.round((x - WORLD.minX) / T_STEP), 0, this.nx - 1);
    const j = clamp(Math.round((z - WORLD.minZ) / T_STEP), 0, this.nz - 1);
    return this.R[j * this.nx + i];
  }
  isWater(x, z) { return this.getGroundHeight(x, z) < WATER_LEVEL - 0.2; }

  // ───────────── Rues ─────────────
  _clip(pts, allow) {
    const runs = [];
    let cur = [];
    const push = (p) => {
      if (allow(p[0], p[1])) cur.push(p);
      else { if (cur.length > 1) runs.push(cur); cur = []; }
    };
    push(pts[0]);
    for (let k = 1; k < pts.length; k++) {
      const [ax, az] = pts[k - 1], [bx, bz] = pts[k];
      const n = Math.max(1, Math.ceil(Math.hypot(bx - ax, bz - az) / 4));
      for (let s = 1; s <= n; s++) push([lerp(ax, bx, s / n), lerp(az, bz, s / n)]);
    }
    if (cur.length > 1) runs.push(cur);
    return runs;
  }

  _buildRoadNetwork() {
    // Pointe de la Presqu'île (Confluence)
    let zTip = 1000;
    for (let z = 800; z < 1060; z += 2) {
      if (this.saone.bankX(z, 1) >= this.rhone.bankX(z, -1) - 2) { zTip = z; break; }
    }
    const mz = zTip - 46;
    const mx = (this.saone.bankX(mz, 1) + this.rhone.bankX(mz, -1)) / 2;
    this.museum = { x: mx, z: mz, zTip };
    this.cubeSites = [778, 814].map((z) => ({ x: this.saone.bankX(z, 1) + 40, z }));

    this.noRoad = [
      { x0: -180, z0: 248, x1: 50, z1: 402 },        // Place Bellecour
      { x0: -135, z0: 594, x1: 105, z1: 686 },       // Gare de Perrache
      { x0: 606, z0: -94, x1: 774, z1: 34 },         // Centre commercial Part-Dieu
      { x0: 372, z0: -1200, x1: 790, z1: -628 },     // Parc de la Tête d'Or
      { x0: 788, z0: -1200, x1: 1000, z1: 1200 },    // Voies ferrées
      { x0: mx - 36, z0: mz - 40, x1: mx + 36, z1: zTip + 30 }, // Musée des Confluences
      ...this.cubeSites.map((c) => ({ x0: c.x - 16, z0: c.z - 16, x1: c.x + 16, z1: c.z + 16 })), // Cubes
    ];
    const inWorld = (x, z, m = 6) => x > WORLD.minX + m && x < WORLD.maxX - m && z > WORLD.minZ + m && z < WORLD.maxZ - m;
    const free = (x, z) => inWorld(x, z) && !this.noRoad.some((r) => x > r.x0 && x < r.x1 && z > r.z0 && z < r.z1);
    const land = (reg, minE = 10) => (x, z) => free(x, z) && this.regionAt(x, z) === reg && this.edgeAt(x, z) > minE;

    const addStraight = (x0, z0, x1, z1, allow, kind = 'street', w = ROAD_W, name = '') => {
      for (const run of this._clip([[x0, z0], [x1, z1]], allow)) {
        if (polyLength(run) > 20) this.roads.push({ pts: [run[0], run[run.length - 1]], w, kind, name });
      }
    };
    const H = (zs, x0, x1, allow) => zs.forEach((z) => addStraight(x0, z, x1, z, allow));
    const V = (xs, z0, z1, allow) => xs.forEach((x) => addStraight(x, z0, x, z1, allow));

    // Quais le long des deux fleuves
    for (const r of this.rivers) {
      for (const side of [-1, 1]) {
        const pts = [];
        for (let i = 0; i < r.count; i++) pts.push(r.offsetPoint(i, side, r.hw[i] + QUAI_OFFSET));
        const runs = this._clip(pts, (x, z) => free(x, z) && this.edgeAt(x, z) > QUAI_OFFSET - 3);
        for (const run of runs) {
          if (polyLength(run) < 40) continue;
          const dec = run.filter((_, k) => k % 3 === 0);
          if (dec[dec.length - 1] !== run[run.length - 1]) dec.push(run[run.length - 1]);
          this.roads.push({ pts: dec, w: ROAD_W, kind: 'quai', river: r.id, side, name: side < 0 ? `Quai ouest (${r.name})` : `Quai est (${r.name})` });
        }
      }
    }

    // Presqu'île (Terreaux → Bellecour → Perrache → Confluence)
    H([-450, -340, -220, -100, 20, 140, 240, 410, 500, 585, 720, 860], -600, 400, land(1));
    V([-190, -110, -40, 60, 130], -480, 1000, (x, z) => z > -485 && land(1)(x, z));
    // Croix-Rousse : plateau + montées + traboules
    H([-1110, -1000, -870, -720], -600, 400, land(1));
    V([-220, -40, 110], -1195, -720, land(1));
    this.roads.push({ pts: [[-40, -720], [-40, -470]], w: 10, kind: 'montee', name: 'Montée de la Grande-Côte' });
    this.roads.push({ pts: [[-260, -470], [-180, -560], [-250, -640], [-220, -720]], w: 9, kind: 'montee', name: 'Montée Saint-Sébastien' });
    this.roads.push({ pts: [[130, -470], [70, -590], [110, -720]], w: 9, kind: 'montee', name: 'Montée de la Boucle' });
    this.roads.push({ pts: [[-120, -712], [-120, -488]], w: 3, kind: 'path', name: 'Traboule' });
    this.roads.push({ pts: [[40, -712], [40, -488]], w: 3, kind: 'path', name: 'Traboule' });
    // Rive gauche : Brotteaux, Part-Dieu, Guillotière, Gerland
    H([-620, -450, -300, -100, 40, 140, 300, 410, 560, 720, 880, 1040, 1150], 150, 784, land(2));
    V([400, 500, 600, 700, 780], -626, 1195, land(2));
    // Rive droite : Vaise, Vieux Lyon, Fourvière, La Mulatière
    H([-1110, -1000, -880, -760, -620, -500, -340, -220, -100, 20, 140, 240, 400, 520, 700, 860, 1040, 1150], -995, 0, land(0));
    V([-900, -780, -660, -540], -1195, 1195, land(0));
    V([-420], 380, 1195, land(0));
    V([-300], 560, 1195, land(0));
    // Allées du parc de la Tête d'Or
    const loop = [];
    for (let k = 0; k <= 48; k++) {
      const a = (k / 48) * Math.PI * 2;
      loop.push([560 + Math.cos(a) * 150, -905 + Math.sin(a) * 88]);
    }
    this.roads.push({ pts: loop, w: 4, kind: 'path', name: 'Allée du lac' });
    this.roads.push({ pts: [[560, -817], [560, -628]], w: 5, kind: 'path', name: 'Allée des Tilleuls' });
  }

  // ───────────── Occupation du sol ─────────────
  _buildOccupancy() {
    this.ow = (WORLD.maxX - WORLD.minX) / OCC;
    this.oh = (WORLD.maxZ - WORLD.minZ) / OCC;
    this.occ = new Uint8Array(this.ow * this.oh);
    for (let j = 0; j < this.oh; j++) {
      const z = WORLD.minZ + (j + 0.5) * OCC;
      for (let i = 0; i < this.ow; i++) {
        const x = WORLD.minX + (i + 0.5) * OCC;
        const k = j * this.ow + i;
        if (this.edgeAt(x, z) < 2.5) this.occ[k] = O_WATER;
        else if (x < WORLD.minX + 8 || x > WORLD.maxX - 8 || z < WORLD.minZ + 8 || z > WORLD.maxZ - 8) this.occ[k] = O_RESERVED;
      }
    }
    for (const r of this.roads) {
      const rad = r.w / 2 + (r.kind === 'path' ? 0.8 : 3.5);
      for (let k = 1; k < r.pts.length; k++) this._rasterSeg(r.pts[k - 1], r.pts[k], rad, O_ROAD);
    }
    // voies ferrées + parc
    this._markRect(836, WORLD.minZ, 906, WORLD.maxZ, O_RAIL, false);
    this._markRect(372, -1200, 790, -628, O_PARK, false);
  }

  _cellRange(x0, z0, x1, z1) {
    return [
      clamp(Math.floor((x0 - WORLD.minX) / OCC), 0, this.ow - 1),
      clamp(Math.floor((z0 - WORLD.minZ) / OCC), 0, this.oh - 1),
      clamp(Math.floor((x1 - WORLD.minX) / OCC), 0, this.ow - 1),
      clamp(Math.floor((z1 - WORLD.minZ) / OCC), 0, this.oh - 1),
    ];
  }
  _rasterSeg(a, b, rad, code) {
    const [i0, j0, i1, j1] = this._cellRange(Math.min(a[0], b[0]) - rad, Math.min(a[1], b[1]) - rad, Math.max(a[0], b[0]) + rad, Math.max(a[1], b[1]) + rad);
    const dx = b[0] - a[0], dz = b[1] - a[1], l2 = dx * dx + dz * dz || 1, r2 = rad * rad;
    for (let j = j0; j <= j1; j++) {
      const z = WORLD.minZ + (j + 0.5) * OCC;
      for (let i = i0; i <= i1; i++) {
        const x = WORLD.minX + (i + 0.5) * OCC;
        let t = ((x - a[0]) * dx + (z - a[1]) * dz) / l2;
        t = clamp(t, 0, 1);
        const ex = x - (a[0] + dx * t), ez = z - (a[1] + dz * t);
        if (ex * ex + ez * ez <= r2) {
          const k = j * this.ow + i;
          if (this.occ[k] === O_FREE || this.occ[k] === O_PARK || this.occ[k] === O_RESERVED) this.occ[k] = code;
        }
      }
    }
  }
  _markRect(x0, z0, x1, z1, code, force = true) {
    const [i0, j0, i1, j1] = this._cellRange(x0, z0, x1 - 0.01, z1 - 0.01);
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const k = j * this.ow + i;
      if (this.occ[k] === O_WATER) continue;
      if (force || this.occ[k] === O_FREE) this.occ[k] = code;
    }
  }
  occAt(x, z) {
    const i = Math.floor((x - WORLD.minX) / OCC), j = Math.floor((z - WORLD.minZ) / OCC);
    if (i < 0 || j < 0 || i >= this.ow || j >= this.oh) return O_RESERVED;
    return this.occ[j * this.ow + i];
  }

  // ───────────── Collisions ─────────────
  /** Ajoute une boîte de collision orientée. a = rotation Y (comme mesh.rotation.y). */
  addSolid(cx, cz, hx, hz, minY, maxY, a = 0, tag = 'static') {
    const s = { cx, cz, hx, hz, minY, maxY, c: Math.cos(a), s: Math.sin(a), tag };
    const ex = Math.abs(s.c) * hx + Math.abs(s.s) * hz, ez = Math.abs(s.s) * hx + Math.abs(s.c) * hz;
    const i0 = Math.floor((cx - ex) / HASH_CELL), i1 = Math.floor((cx + ex) / HASH_CELL);
    const j0 = Math.floor((cz - ez) / HASH_CELL), j1 = Math.floor((cz + ez) / HASH_CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const key = (i + 1000) * 4096 + (j + 1000);
      let arr = this.solidHash.get(key);
      if (!arr) { arr = []; this.solidHash.set(key, arr); }
      arr.push(s);
    }
    this.solids.push(s);
    return s;
  }
  _solidsNear(x, z, r, out) {
    out.length = 0;
    const i0 = Math.floor((x - r) / HASH_CELL), i1 = Math.floor((x + r) / HASH_CELL);
    const j0 = Math.floor((z - r) / HASH_CELL), j1 = Math.floor((z + r) / HASH_CELL);
    for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
      const arr = this.solidHash.get((i + 1000) * 4096 + (j + 1000));
      if (arr) for (const s of arr) if (!out.includes(s)) out.push(s);
    }
    return out;
  }

  /**
   * Repousse un cercle (personnage, véhicule) hors des obstacles.
   * pos : Vector3 (pieds), radius, height. Retourne true s'il y a eu contact.
   */
  resolveCircle(pos, radius, height = 1.8) {
    const near = this._solidsNear(pos.x, pos.z, radius + 1, this._tmpNear || (this._tmpNear = []));
    let hit = false;
    for (let pass = 0; pass < 2; pass++) {
      for (const s of near) {
        if (pos.y >= s.maxY - STEP_UP || pos.y + height <= s.minY) continue;
        const dx = pos.x - s.cx, dz = pos.z - s.cz;
        let lx = s.c * dx - s.s * dz, lz = s.s * dx + s.c * dz;
        const qx = clamp(lx, -s.hx, s.hx), qz = clamp(lz, -s.hz, s.hz);
        const ddx = lx - qx, ddz = lz - qz;
        const d2 = ddx * ddx + ddz * ddz;
        if (d2 > radius * radius) continue;
        hit = true;
        if (d2 > 1e-8) {
          const d = Math.sqrt(d2), push = (radius - d) / d;
          lx += ddx * push; lz += ddz * push;
        } else {
          const px = s.hx - Math.abs(lx), pz = s.hz - Math.abs(lz);
          if (px < pz) lx = (lx >= 0 ? 1 : -1) * (s.hx + radius);
          else lz = (lz >= 0 ? 1 : -1) * (s.hz + radius);
        }
        pos.x = s.cx + s.c * lx + s.s * lz;
        pos.z = s.cz - s.s * lx + s.c * lz;
      }
    }
    // limites de la carte
    pos.x = clamp(pos.x, WORLD.minX + 4, WORLD.maxX - 4);
    pos.z = clamp(pos.z, WORLD.minZ + 4, WORLD.maxZ - 4);
    return hit;
  }

  /** Hauteur de la surface marchable sous (x, z) pour un objet dont les pieds sont à feetY. */
  getSurfaceHeight(x, z, feetY = 1e9) {
    let h = this.getGroundHeight(x, z);
    for (const b of this.bridges) {
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && feetY > b.top - 2.2) h = Math.max(h, b.top);
    }
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const lx = r.c * dx - r.s * dz, lz = r.s * dx + r.c * dz;
      if (Math.abs(lx) < r.hw && Math.abs(lz) < r.hl) {
        const top = r.y + ((lz + r.hl) / (2 * r.hl)) * r.h;
        if (feetY > top - 1.2) h = Math.max(h, top);
      }
    }
    const near = this._solidsNear(x, z, 0.5, this._tmpNear2 || (this._tmpNear2 = []));
    for (const s of near) {
      if (feetY < s.maxY - STEP_UP - 0.1) continue;
      const dx = x - s.cx, dz = z - s.cz;
      const lx = s.c * dx - s.s * dz, lz = s.s * dx + s.c * dz;
      if (Math.abs(lx) <= s.hx && Math.abs(lz) <= s.hz) h = Math.max(h, s.maxY);
    }
    return h;
  }

  _pointBlocked(x, y, z, pad) {
    if (y < this.getGroundHeight(x, z) + 0.2) return true;
    for (const b of this.bridges) {
      if (x > b.x0 && x < b.x1 && z > b.z0 && z < b.z1 && y > b.top - 0.9 && y < b.top + 0.15) return true;
    }
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const lx = r.c * dx - r.s * dz, lz = r.s * dx + r.c * dz;
      if (Math.abs(lx) < r.hw + pad && Math.abs(lz) < r.hl + pad && y < r.y + ((lz + r.hl) / (2 * r.hl)) * r.h + pad) return true;
    }
    const near = this._solidsNear(x, z, pad, this._tmpNear3 || (this._tmpNear3 = []));
    for (const s of near) {
      if (y < s.minY - pad || y > s.maxY + pad) continue;
      const dx = x - s.cx, dz = z - s.cz;
      const lx = s.c * dx - s.s * dz, lz = s.s * dx + s.c * dz;
      if (Math.abs(lx) < s.hx + pad && Math.abs(lz) < s.hz + pad) return true;
    }
    return false;
  }
  /** Lancer de rayon simple (caméra). Retourne la fraction [0..1] du trajet libre. */
  raycast(from, to, pad = 0.2) {
    const dx = to.x - from.x, dy = to.y - from.y, dz = to.z - from.z;
    const len = Math.hypot(dx, dy, dz);
    const steps = Math.max(1, Math.ceil(len / 0.3));
    for (let s = 1; s <= steps; s++) {
      const t = s / steps;
      if (this._pointBlocked(from.x + dx * t, from.y + dy * t, from.z + dz * t, pad)) return Math.max(0, (s - 1) / steps);
    }
    return 1;
  }

  // ───────────── Matériaux ─────────────
  _initMaterials() {
    if (this.mats) return;
    const rng = this.rng, an = this.anisotropy;
    const fac = {};
    for (const kind of ['classic', 'modern', 'plain']) {
      const t = makeFacadeTextures(kind, rng, an);
      fac[kind] = new THREE.MeshLambertMaterial({ map: t.map, emissiveMap: t.emissive, emissive: 0xffffff, emissiveIntensity: 0, vertexColors: true });
      this.nightMaterials.push({ mat: fac[kind], max: kind === 'modern' ? 0.85 : 1.0 });
    }
    const stoneTex = makeStoneTexture(rng, an);
    this.mats = {
      facade: fac,
      roof: new THREE.MeshLambertMaterial({ vertexColors: true }),
      stone: new THREE.MeshLambertMaterial({ map: stoneTex, vertexColors: true }),
      plainV: new THREE.MeshLambertMaterial({ vertexColors: true }),
      deck: new THREE.MeshLambertMaterial({ map: makeDeckTexture(an) }),
      bronze: new THREE.MeshStandardMaterial({ color: '#3c4a3a', metalness: 0.75, roughness: 0.4 }),
      gold: new THREE.MeshStandardMaterial({ color: '#d9a636', metalness: 0.9, roughness: 0.25, emissive: '#3a2a00' }),
      metal: new THREE.MeshStandardMaterial({ color: '#aab4bc', metalness: 0.8, roughness: 0.35 }),
      glass: new THREE.MeshStandardMaterial({ color: '#8fc7e8', metalness: 0.3, roughness: 0.05, transparent: true, opacity: 0.65 }),
      rail: new THREE.MeshLambertMaterial({ color: '#5a5550' }),
    };
    this.chunkB = new Map(); // "type|ix|iz" → GeoBuilder
    this.stoneB = new GeoBuilder();
    this.plainB = new GeoBuilder();
  }

  /** Constructeur de géométrie du morceau de ville contenant (x, z). */
  _cb(type, x, z) {
    const key = `${type}|${Math.floor((x - WORLD.minX) / CHUNK)}|${Math.floor((z - WORLD.minZ) / CHUNK)}`;
    let b = this.chunkB.get(key);
    if (!b) { b = new GeoBuilder(); this.chunkB.set(key, b); }
    return b;
  }

  // ───────────── Bâtiments ─────────────
  /**
   * Ajoute un immeuble rectangulaire (fusionné dans un grand maillage par style).
   * o: { x0, z0, x1, z1, h, facade, color, roof, bay, floor, baseY?, roofColor?, mark? }
   */
  addBuilding(o) {
    const rng = this.rng;
    const cx = (o.x0 + o.x1) / 2, cz = (o.z0 + o.z1) / 2, hx = (o.x1 - o.x0) / 2, hz = (o.z1 - o.z0) / 2;
    let gMin, gMax;
    if (o.baseY !== undefined) { gMin = gMax = o.baseY; } else {
      const hs = [[o.x0, o.z0], [o.x1, o.z0], [o.x0, o.z1], [o.x1, o.z1], [cx, cz]].map(([x, z]) => this.getGroundHeight(x, z));
      gMin = Math.min(...hs); gMax = Math.max(...hs);
    }
    const y0 = o.baseY !== undefined ? o.baseY : gMin - 1.2;
    const y1 = gMax + o.h;
    const col = new THREE.Color(o.color);
    const bay = o.bay || 3, floor = o.floor || 3;
    const roofB = this._cb('roof', cx, cz);
    this._cb(o.facade || 'plain', cx, cz).obox(cx, cz, hx, hz, y0, y1, 0, col,
      { su: bay * 4, sv: floor * 4, uo: Math.floor(rng() * 4) * 0.25, vo: (y0 - gMin) / (floor * 4) + Math.floor(rng() * 4) * 0.25 }, { top: false });
    let top = y1;
    const roof = o.roof || 'flat';
    if (roof === 'mansard' && hx > 3 && hz > 3) {
      const rc = new THREE.Color(o.roofColor || ['#5d6670', '#646d78', '#555e69'][Math.floor(rng() * 3)]);
      roofB.frustum(cx, cz, hx, hz, y1, y1 + 3.2, 1.7, rc);
      top = y1 + 3.2;
      this._chimneys(roofB, cx, cz, hx - 2, hz - 2, top, 1 + Math.floor(rng() * 3));
    } else if (roof === 'tile') {
      const rc = new THREE.Color(o.roofColor || ['#a9563a', '#b8643f', '#9c4b33', '#b5704d'][Math.floor(rng() * 4)]);
      const rh = Math.min(hx, hz) * 0.55;
      roofB.frustum(cx, cz, hx + 0.4, hz + 0.4, y1, y1 + rh, Math.min(hx, hz) * 0.95, rc);
      top = y1 + rh * 0.5;
      if (rng() < 0.5) this._chimneys(roofB, cx, cz, hx * 0.5, hz * 0.5, y1 + rh * 0.4, 1);
    } else {
      const rc = new THREE.Color(o.roofColor || ['#7b7d80', '#8a8c8e', '#6f7275'][Math.floor(rng() * 3)]);
      roofB.obox(cx, cz, hx, hz, y1 - 0.01, y1 + 0.6, 0, rc, { su: 8, sv: 8 }, {});
      roofB.obox(cx, cz, hx - 0.5, hz - 0.5, y1 + 0.55, y1 + 0.56, 0, new THREE.Color('#55585b'), {}, {});
      top = y1 + 0.6;
      const n = hx * hz > 150 ? 1 + Math.floor(rng() * 3) : 0;
      for (let k = 0; k < n; k++) {
        const bx = cx + (rng() - 0.5) * hx, bz = cz + (rng() - 0.5) * hz;
        roofB.obox(bx, bz, 1 + rng() * 1.5, 1 + rng() * 1.5, top, top + 1.5 + rng() * 1.5, 0, new THREE.Color('#9a9c9e'), {}, {});
      }
    }
    this.addSolid(cx, cz, hx, hz, y0, top, 0, 'building');
    this.buildings.push({ x0: o.x0, z0: o.z0, x1: o.x1, z1: o.z1 });
    if (o.mark !== false) this._markRect(o.x0, o.z0, o.x1, o.z1, O_BUILDING);
    return { top, base: gMin, y1 };
  }
  _chimneys(roofB, cx, cz, ex, ez, y, n) {
    const rng = this.rng, col = new THREE.Color('#b59f86');
    for (let k = 0; k < n; k++) {
      const x = cx + (rng() * 2 - 1) * Math.max(0.2, ex), z = cz + (rng() * 2 - 1) * Math.max(0.2, ez);
      roofB.obox(x, z, 0.45 + rng() * 0.3, 0.3, y - 0.5, y + 1.6, 0, col, {}, {});
    }
  }

  _styleAt(x, z, reg, e, h) {
    if (reg === 1) {
      if (z < -470) return 'canut';
      if (z > 690) return 'confluence';
      return 'haussmann';
    }
    if (reg === 2) {
      if (x > 904) return 'generic';
      if (z < -628) return null;
      if (x > 480 && z > -360 && z < 60) return 'business';
      if (z < 200) return 'haussmann';
      return 'generic';
    }
    if (z < -680) return 'generic';
    if (e < 100 && z < 560) return 'vieux';
    if (h > 12) return 'house';
    return 'generic';
  }

  _fits(i, j, cw, cd, m) {
    for (let jj = j - m; jj < j + cd + m; jj++) {
      if (jj < 0 || jj >= this.oh) return false;
      for (let ii = i - m; ii < i + cw + m; ii++) {
        if (ii < 0 || ii >= this.ow) return false;
        if (this.occ[jj * this.ow + ii] !== O_FREE) return false;
      }
    }
    return true;
  }

  _buildCity() {
    const rng = this.rng;
    const rr = ([a, b]) => a + rng() * (b - a);
    for (let j = 2; j < this.oh - 2; j++) {
      for (let i = 2; i < this.ow - 2; i++) {
        if (this.occ[j * this.ow + i] !== O_FREE) continue;
        const x = WORLD.minX + i * OCC, z = WORLD.minZ + j * OCC;
        const reg = this.regionAt(x, z), e = this.edgeAt(x, z), h = this.getGroundHeight(x, z);
        const st = this._styleAt(x, z, reg, e, h);
        if (!st) continue;
        const S = STYLES[st];
        if (rng() < S.skip) { // cour intérieure / jardin / esplanade
          const k = st === 'business' ? 6 : 3 + Math.floor(rng() * 3);
          const code = st === 'business' || st === 'confluence' ? O_PLAZA : O_GARDEN;
          for (let jj = j; jj < Math.min(this.oh, j + k); jj++) for (let ii = i; ii < Math.min(this.ow, i + k); ii++) {
            if (this.occ[jj * this.ow + ii] === O_FREE) this.occ[jj * this.ow + ii] = code;
          }
          continue;
        }
        for (let attempt = 0; attempt < 4; attempt++) {
          const shrink = 1 - attempt * 0.22;
          const cw = Math.max(3, Math.round((rr(S.w) * shrink) / OCC));
          const cd = Math.max(3, Math.round((rr(S.d) * shrink) / OCC));
          if (!this._fits(i, j, cw, cd, S.margin || 0)) continue;
          const x0 = WORLD.minX + i * OCC, z0 = WORLD.minZ + j * OCC;
          let facade = S.facade;
          if (st === 'confluence' && rng() < 0.4) facade = 'plain';
          this.addBuilding({
            x0, z0, x1: x0 + cw * OCC, z1: z0 + cd * OCC, h: rr(S.h), facade,
            color: S.colors[Math.floor(rng() * S.colors.length)], roof: S.roof, bay: S.bay, floor: S.floor,
          });
          break;
        }
      }
    }
    this._finalizeBuildings();
  }

  _finalizeBuildings() {
    for (const [key, b] of this.chunkB) {
      if (b.empty) continue;
      const type = key.split('|')[0];
      const m = new THREE.Mesh(b.build(), type === 'roof' ? this.mats.roof : this.mats.facade[type]);
      m.castShadow = m.receiveShadow = true;
      m.name = 'immeubles-' + key;
      this.group.add(m);
    }
    for (const [b, mat, name] of [[this.stoneB, this.mats.stone, 'pierre'], [this.plainB, this.mats.plainV, 'divers']]) {
      if (b.empty) continue;
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = m.receiveShadow = true;
      m.name = name;
      this.group.add(m);
    }
    this.chunkB = this.stoneB = this.plainB = null;
  }

  // ───────────── Monuments ─────────────
  _addSign(text, x, y, z, w, h, rotY, opts = {}) {
    const tex = makeSignTexture(text, opts);
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05 });
    this.nightMaterials.push({ mat, max: 0.9, min: 0.05 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    m.position.set(x, y, z);
    m.rotation.y = rotY;
    this.group.add(m);
    return m;
  }
  _addLocation(loc) {
    this.locations.push(loc);
    if (loc.marker) this._addMarker(loc);
    return loc;
  }
  _addMarker(loc) {
    const y = this.getGroundHeight(loc.x, loc.z);
    const color = new THREE.Color(loc.markerColor || '#ffd23f');
    const g = new THREE.Group();
    g.position.set(loc.x, y, loc.z);
    const cv = makeCanvas(16, 128), c = cv.getContext('2d');
    const gr = c.createLinearGradient(0, 128, 0, 0);
    gr.addColorStop(0, 'rgba(255,255,255,0.95)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = gr; c.fillRect(0, 0, 16, 128);
    const ringMat = new THREE.MeshBasicMaterial({ map: canvasTexture(cv), color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending });
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 1.4, 32, 1, true), ringMat);
    ring.position.y = 0.7;
    g.add(ring);
    const disc = new THREE.Mesh(new THREE.CircleGeometry(1.3, 32), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.05;
    g.add(disc);
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.7, 4), new THREE.MeshBasicMaterial({ color }));
    arrow.rotation.x = Math.PI; arrow.position.y = 2.4;
    g.add(arrow);
    this.group.add(g);
    this.markers.push({ loc, group: g, arrow, ring });
  }

  _buildLandmarks() {
    this._initMaterials();
    const R = (x0, z0, x1, z1, code = O_RESERVED) => this._markRect(x0, z0, x1, z1, code);

    // Place Bellecour
    this.plazas.push({ x0: -180, z0: 248, x1: 50, z1: 402, color: '#b8653f', border: '#d8c3a2' });
    R(-180, 248, 50, 402, O_PLAZA);
    this._buildStatue(-65, 325);
    for (let x = -168; x <= 40; x += 13) for (const z of [372, 384, 396]) this.trees.push([x, z, 1.1]);
    for (let x = -168; x <= 40; x += 13) this.trees.push([x, 256, 1]);
    this.labels.push({ text: 'Place Bellecour', x: -65, z: 300, size: 11 });

    // Part-Dieu : le Crayon, Incity, Oxygène
    this._buildCrayon(650, -200);
    this.addBuilding({ x0: 533, z0: -217, x1: 567, z1: -183, h: 182, facade: 'modern', color: '#e6edf2', bay: 2.2, floor: 3.8, roof: 'flat' });
    const incTop = this.getGroundHeight(550, -200) + 182.6;
    this.addBuilding({ x0: 538, z0: -212, x1: 562, z1: -188, h: 10, baseY: incTop, facade: 'modern', color: '#f5f8fa', bay: 2.2, floor: 3.8, roof: 'flat', mark: false });
    const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.9, 26, 8), this.mats.metal);
    spire.position.set(550, incTop + 10.6 + 13, -200); this.group.add(spire);
    this.addBuilding({ x0: 535, z0: -42, x1: 565, z1: -18, h: 112, facade: 'modern', color: '#cfe0ee', bay: 2.2, floor: 3.7, roof: 'flat' });
    this.labels.push({ text: 'Tour Part-Dieu', x: 650, z: -230, size: 11 }, { text: 'Incity', x: 550, z: -160, size: 10 });

    // Centre commercial Part-Dieu
    const mall = this.addBuilding({ x0: 611, z0: -88, x1: 770, z1: 28, h: 24, facade: 'plain', color: '#d8cfc0', bay: 8, floor: 6, roof: 'flat' });
    this._addSign('CENTRE COMMERCIAL PART-DIEU', 610.8, mall.base + 18, -30, 60, 7, -Math.PI / 2, { bg: '#0d2a52', fg: '#ffffff' });
    this.plainB.obox(609.5, -30, 1.5, 9, mall.base, mall.base + 7, 0, new THREE.Color('#2b3c4a'), {}, {});
    this._addLocation({ id: 'centre-commercial', name: 'Centre Commercial Part-Dieu', x: 606.5, z: -30, icon: 'shop', marker: true, markerColor: '#4fc3f7', interior: 'mall' });
    this.plazas.push({ x0: 606, z0: -94, x1: 611, z1: 34, color: '#b9b2a5' });

    // Gare Part-Dieu + voies
    const gare = this.addBuilding({ x0: 790, z0: -280, x1: 834, z1: 180, h: 14, facade: 'modern', color: '#e6ecef', bay: 3, floor: 4.5, roof: 'flat' });
    this._addSign('GARE LYON PART-DIEU', 789.8, gare.base + 11, -50, 46, 5, -Math.PI / 2, { bg: '#ffffff', fg: '#b3122a' });
    this._addLocation({ id: 'gare-part-dieu', name: 'Gare Part-Dieu', x: 787.5, z: -50, icon: 'train', marker: true, markerColor: '#ffd23f', interior: 'station' });
    this._buildRailways();
    this.labels.push({ text: 'Gare Part-Dieu', x: 812, z: -300, size: 10 });

    // Gare de Perrache
    const per = this.addBuilding({ x0: -130, z0: 598, x1: 100, z1: 686, h: 20, facade: 'plain', color: '#bdbab3', bay: 6, floor: 5, roof: 'flat' });
    this._addSign('GARE DE PERRACHE', -15, per.base + 15, 597.8, 50, 6, Math.PI, { bg: '#1d1d1d', fg: '#ffd23f' });
    this._addLocation({ id: 'gare-perrache', name: 'Gare de Perrache', x: -15, z: 594.5, icon: 'train', marker: true, markerColor: '#ffd23f', interior: 'station' });
    this.labels.push({ text: 'Gare de Perrache', x: -15, z: 642, size: 10 });

    // Hôpital de la Croix-Rousse
    const hop = this.addBuilding({ x0: -10, z0: -975, x1: 70, z1: -881, h: 22, facade: 'plain', color: '#f3f1ec', bay: 3.4, floor: 3.4, roof: 'flat' });
    this._addSign('HÔPITAL DE LA CROIX-ROUSSE', 30, hop.base + 17, -880.8, 54, 5, 0, { bg: '#ffffff', fg: '#c62828' });
    this._buildRedCross(30, hop.base + 10, -880.7);
    this._addLocation({ id: 'hopital', name: 'Hôpital de la Croix-Rousse', x: 30, z: -878, icon: 'hospital', marker: true, markerColor: '#ff5252', interior: 'hospital', spawn: { x: 30, z: -873, yaw: 0 } });

    // Planque du joueur + garage (Guillotière)
    const house = this.addBuilding({ x0: 428, z0: 378, x1: 452, z1: 401, h: 8, facade: 'plain', color: '#e7c9a0', roof: 'tile', bay: 3, floor: 3.2 });
    this.addBuilding({ x0: 456, z0: 386, x1: 472, z1: 401, h: 4.5, facade: 'plain', color: '#9ea3a8', roof: 'flat', bay: 4, floor: 4.5 });
    this._buildGarageDoor(464, house.base, 401.05);
    this._addLocation({ id: 'planque', name: 'Planque', x: 440, z: 403.5, icon: 'house', marker: true, markerColor: '#66ff88', interior: 'house' });
    this._addLocation({ id: 'garage', name: 'Garage', x: 464, z: 404.5, icon: 'garage', marker: true, markerColor: '#4fc3f7', interior: 'garage' });

    // Armurerie
    const arm = this.addBuilding({ x0: 538, z0: 688, x1: 562, z1: 710, h: 9, facade: 'plain', color: '#7d7468', roof: 'flat', bay: 4, floor: 4.5 });
    this._addSign('ARMURERIE', 550, arm.base + 6.5, 710.1, 16, 2.6, 0, { bg: '#111', fg: '#ff3b30', border: '#ff3b30' });
    this._addLocation({ id: 'armurerie', name: 'Armurerie', x: 550, z: 712.5, icon: 'gun', marker: true, markerColor: '#ff9f43', interior: 'gunshop' });

    // Commissariat
    const pol = this.addBuilding({ x0: 410, z0: -70, x1: 460, z1: -20, h: 14, facade: 'plain', color: '#e9e9ef', roof: 'flat', bay: 3, floor: 3.5 });
    this._addSign('POLICE NATIONALE', 409.8, pol.base + 11, -45, 22, 3, -Math.PI / 2, { bg: '#0b3d91', fg: '#ffffff' });
    this._addLocation({ id: 'police', name: 'Commissariat', x: 404, z: -45, icon: 'police', marker: false });

    // Fourvière : basilique + tour métallique
    this._buildBasilica(-600, -40);
    this._buildMetalTower(-600, -280);
    // Vieux Lyon : cathédrale Saint-Jean
    this._buildCathedral(-407, 186);
    // Confluence : musée + cubes
    this._buildMuseum();
    this._buildCubes();
    // Parc de la Tête d'Or (arbres)
    for (let k = 0; k < 420; k++) {
      const x = 385 + this.rng() * 395, z = -1185 + this.rng() * 545;
      const lx = (x - 560) / 128, lz = (z + 905) / 66;
      if (lx * lx + lz * lz < 1.15) continue;
      if (this.occAt(x, z) !== O_PARK) continue;
      this.trees.push([x, z, 0.9 + this.rng() * 0.6]);
    }
    // Tremplins pour les cascades
    this._addRamp(-37.5, -712, 0, 2.2, 8, 1.5);   // haut de la Grande-Côte
    this._addRamp(-217.5, -712, 0, 2.2, 8, 1.5);
    this._addRamp(112.5, -712, 0, 2.2, 8, 1.5);
    this._addRamp(-65, 290, Math.PI, 2.5, 8, 1.3);   // Bellecour
    this._addRamp(602.5, 470, 0, 2.2, 8, 1.6);       // Guillotière

    // Étiquettes des quartiers (grande carte)
    this.labels.push(
      { text: 'CROIX-ROUSSE', x: -40, z: -960, size: 22, district: true },
      { text: 'PENTES', x: -100, z: -600, size: 14, district: true },
      { text: "PRESQU'ÎLE", x: -40, z: -150, size: 20, district: true },
      { text: 'PERRACHE', x: -15, z: 560, size: 14, district: true },
      { text: 'CONFLUENCE', x: -30, z: 790, size: 18, district: true },
      { text: 'VIEUX LYON', x: -405, z: -20, size: 15, district: true },
      { text: 'FOURVIÈRE', x: -760, z: -160, size: 20, district: true },
      { text: 'VAISE', x: -720, z: -960, size: 20, district: true },
      { text: 'PART-DIEU', x: 650, z: -140, size: 20, district: true },
      { text: 'BROTTEAUX', x: 520, z: -460, size: 18, district: true },
      { text: "PARC DE LA TÊTE D'OR", x: 580, z: -1060, size: 15, district: true },
      { text: 'GUILLOTIÈRE', x: 540, z: 300, size: 18, district: true },
      { text: 'GERLAND', x: 450, z: 980, size: 20, district: true },
      { text: 'LA MULATIÈRE', x: -620, z: 900, size: 16, district: true },
      { text: 'Rue de la République', x: -40, z: -30, size: 9 },
    );
  }

  _addRamp(x, z, a, hw, hl, h) {
    const y = this.getGroundHeight(x, z);
    const shape = new THREE.Shape();
    shape.moveTo(-hl, 0); shape.lineTo(hl, 0); shape.lineTo(hl, h); shape.lineTo(-hl, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hw * 2, bevelEnabled: false });
    geo.translate(0, 0, -hw);
    geo.rotateY(-Math.PI / 2); // la pente monte vers +z local
    if (!this._rampMat) {
      const cv = makeCanvas(64, 64), g = cv.getContext('2d');
      g.fillStyle = '#f2b705'; g.fillRect(0, 0, 64, 64);
      g.fillStyle = '#1b1b1b';
      for (let k = -64; k < 128; k += 32) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 16, 0); g.lineTo(k - 48, 64); g.lineTo(k - 64, 64); g.fill(); }
      const t = canvasTexture(cv, { repeat: true });
      t.repeat.set(0.4, 0.4);
      this._rampMat = new THREE.MeshLambertMaterial({ map: t });
    }
    const m = new THREE.Mesh(geo, this._rampMat);
    m.position.set(x, y, z); m.rotation.y = a;
    m.castShadow = m.receiveShadow = true;
    this.group.add(m);
    this.ramps.push({ x, z, y, c: Math.cos(a), s: Math.sin(a), hw, hl, h });
    // face arrière verticale : solide (on ne traverse pas le tremplin par derrière)
    this.addSolid(x + Math.sin(a) * (hl - 0.3), z + Math.cos(a) * (hl - 0.3), hw, 0.3, y - 0.5, y + h, a, 'ramp');
    this.labels.push({ text: 'Tremplin', x, z: z + 12, size: 6 });
  }

  _buildStatue(cx, cz) {
    const y = this.getGroundHeight(cx, cz);
    const g = new THREE.Group(); g.position.set(cx, y, cz);
    const stone = new THREE.MeshLambertMaterial({ color: '#e6e0d2' });
    const box = (w, h, d, x, yy, z, mat, rx = 0) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, yy, z); m.rotation.x = rx; m.castShadow = true; m.receiveShadow = true; g.add(m); return m;
    };
    box(10, 0.45, 14, 0, 0.225, 0, stone);
    box(5.5, 4.6, 9, 0, 0.45 + 2.3, 0, stone);
    box(6.3, 0.5, 9.8, 0, 5.3, 0, stone);
    const T = 5.55, B = this.mats.bronze;
    box(1.6, 1.6, 3.8, 0, T + 2.4, 0, B);                // corps du cheval
    for (const [lx, lz, rx] of [[-0.55, 1.4, -0.7], [0.55, 1.4, 0], [-0.55, -1.4, 0.15], [0.55, -1.4, -0.1]]) {
      const leg = box(0.32, 1.8, 0.32, lx, T + 0.9, lz, B, rx);
      if (rx < -0.3) leg.position.set(lx, T + 1.3, lz + 0.35);
    }
    box(0.75, 1.7, 0.85, 0, T + 3.4, 1.85, B, -0.55);    // encolure
    box(0.6, 0.7, 1.4, 0, T + 4.25, 2.45, B, 0.35);      // tête
    box(0.3, 1.4, 0.3, 0, T + 2.2, -2.1, B, 0.5);        // queue
    box(0.85, 1.2, 0.55, 0, T + 3.85, -0.1, B);          // cavalier
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.3, 12, 10), B); head.position.set(0, T + 4.75, -0.05); g.add(head);
    box(0.2, 0.2, 1.3, 0.45, T + 4.3, 0.55, B, -0.6);    // bras + bâton
    box(0.25, 1.0, 0.25, -0.55, T + 3.2, 0.2, B, -0.4);
    box(0.25, 1.0, 0.25, 0.55, T + 3.2, 0.2, B, -0.4);
    this.group.add(g);
    this.addSolid(cx, cz, 5, 7, y, y + 0.45);
    this.addSolid(cx, cz, 3.2, 4.9, y, y + 10);
    this.labels.push({ text: 'Statue de Louis XIV', x: cx, z: cz + 20, size: 8 });
  }

  _buildCrayon(cx, cz) {
    const y = this.getGroundHeight(cx, cz);
    const cv = makeCanvas(256, 512), g = cv.getContext('2d');
    const ev = makeCanvas(256, 512), ge = ev.getContext('2d');
    g.fillStyle = '#d2a996'; g.fillRect(0, 0, 256, 512);
    ge.fillStyle = '#000'; ge.fillRect(0, 0, 256, 512);
    for (let fy = 0; fy < 16; fy++) for (let bx = 0; bx < 8; bx++) {
      g.fillStyle = '#3d3f46'; g.fillRect(bx * 32 + 9, fy * 32 + 7, 14, 20);
      if (this.rng() < 0.45) { ge.fillStyle = '#ffe2a8'; ge.fillRect(bx * 32 + 9, fy * 32 + 7, 14, 20); }
    }
    const tex = canvasTexture(cv, { repeat: true, anisotropy: this.anisotropy });
    const etex = canvasTexture(ev, { repeat: true, anisotropy: this.anisotropy });
    tex.repeat.set(9, 9); etex.repeat.set(9, 9);
    const mat = new THREE.MeshLambertMaterial({ map: tex, emissiveMap: etex, emissive: 0xffffff, emissiveIntensity: 0 });
    this.nightMaterials.push({ mat, max: 1 });
    const H = 142;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, H, 48, 1, true), mat);
    body.position.set(cx, y + H / 2, cz); body.castShadow = body.receiveShadow = true;
    this.group.add(body);
    const capMat = new THREE.MeshLambertMaterial({ color: '#b98d7c' });
    const cap = new THREE.Mesh(new THREE.ConeGeometry(15.6 * Math.SQRT2 * 0.72, 30, 4), capMat);
    cap.position.set(cx, y + H + 15, cz); cap.rotation.y = Math.PI / 4; cap.castShadow = true;
    this.group.add(cap);
    const top = new THREE.Mesh(new THREE.CylinderGeometry(15.4, 15.4, 2, 48), capMat);
    top.position.set(cx, y + H, cz); this.group.add(top);
    const antenna = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 10, 6), this.mats.metal);
    antenna.position.set(cx, y + H + 34, cz); this.group.add(antenna);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.7, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
    blink.position.set(cx, y + H + 39.5, cz); this.group.add(blink);
    this.animated.push((dt, t) => { blink.visible = Math.sin(t * 3) > 0; });
    this.addSolid(cx, cz, 15, 15, y - 1, y + H + 30);
    this.addBuilding({ x0: cx - 34, z0: cz - 26, x1: cx - 15, z1: cz + 26, h: 12, facade: 'plain', color: '#c9b9aa', roof: 'flat', bay: 4, floor: 4 });
    this._markRect(cx - 16, cz - 16, cx + 16, cz + 16, O_RESERVED);
    this.plazas.push({ x0: cx - 15, z0: cz + 18, x1: cx + 40, z1: cz + 90, color: '#b4aca0' });
  }

  _buildRedCross(x, y, z) {
    const mat = new THREE.MeshLambertMaterial({ color: '#d32f2f', emissive: '#d32f2f', emissiveIntensity: 0.2 });
    this.nightMaterials.push({ mat, max: 1, min: 0.2 });
    for (const [w, h] of [[6, 2], [2, 6]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(x, y, z); this.group.add(m);
    }
  }

  _buildGarageDoor(x, y, z) {
    const cv = makeCanvas(128, 128), g = cv.getContext('2d');
    g.fillStyle = '#c7ccd1'; g.fillRect(0, 0, 128, 128);
    g.fillStyle = '#8d949b';
    for (let k = 0; k < 128; k += 12) g.fillRect(0, k, 128, 3);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 3.6), new THREE.MeshLambertMaterial({ map: canvasTexture(cv) }));
    m.position.set(x, y + 1.8, z); this.group.add(m);
  }

  _buildRailways() {
    const b = new GeoBuilder(), col = new THREE.Color('#ffffff');
    const tracks = [846, 858, 870, 882, 894];
    for (const tx of tracks) for (const off of [-0.72, 0.72]) {
      b.obox(tx + off, 0, 0.06, (WORLD.maxZ - WORLD.minZ) / 2, 0.02, 0.18, 0, col, {}, {});
    }
    const rails = new THREE.Mesh(b.build(), this.mats.rail);
    rails.receiveShadow = true;
    this.group.add(rails);
    // quais de gare + marquises
    const conc = new THREE.Color('#c9c5bd'), roofc = new THREE.Color('#e9ecef'), pil = new THREE.Color('#7d868e');
    for (const px of [852, 876]) {
      this.plainB.obox(px, -50, 3, 215, -0.2, 0.9, 0, conc, {}, {});
      this.addSolid(px, -50, 3, 215, -0.5, 0.9);
      this.plainB.obox(px, -50, 4.2, 200, 6.2, 6.5, 0, roofc, {}, { bottom: true });
      for (let z = -240; z <= 140; z += 30) {
        this.plainB.obox(px, z, 0.2, 0.2, 0.9, 6.2, 0, pil, {}, {});
        this.addSolid(px, z, 0.25, 0.25, 0.9, 6.2);
      }
    }
    this._buildTrain(858, -180, 8, '#f4f4f4', '#2a4b8d');
    this._buildTrain(882, -60, 6, '#e8e8e8', '#9a1f2b');
    this._buildTrain(894, 500, 5, '#d8d8d8', '#5b6b7a');
  }

  _buildTrain(x, z0, cars, body, stripe) {
    const bc = new THREE.Color(body), sc = new THREE.Color(stripe), wc = new THREE.Color('#1c232b');
    const L = 20;
    for (let k = 0; k < cars; k++) {
      const cz = z0 + k * (L + 0.8);
      this.plainB.obox(x, cz, 1.45, L / 2, 0.5, 4.2, 0, bc, {}, {});
      this.plainB.obox(x, cz, 1.47, L / 2 - 0.5, 2.4, 3.1, 0, wc, {}, {});
      this.plainB.obox(x, cz, 1.48, L / 2 - 0.2, 1.4, 1.8, 0, sc, {}, {});
      this.addSolid(x, cz, 1.45, L / 2 + 0.4, 0, 4.2);
    }
    // nez profilé
    const noseZ = z0 - L / 2 - 3;
    this.plainB.frustum(x, noseZ, 1.45, 3, 0.5, 3.6, 1.2, bc);
    this.addSolid(x, noseZ, 1.45, 3, 0, 3.6);
  }

  _buildBasilica(cx, cz) {
    const y = this.getGroundHeight(cx, cz);
    const c = new THREE.Color('#f1ece0'), roof = new THREE.Color('#8a8f94');
    this._markRect(cx - 50, cz - 30, cx + 40, cz + 30, O_RESERVED);
    this.plazas.push({ x0: cx + 30, z0: cz - 25, x1: cx + 52, z1: cz + 25, color: '#cfc6b4' });
    this.stoneB.obox(cx, cz, 31, 12, y - 3, y + 20, 0, c, { su: 6, sv: 6 }, { top: false });
    this._cb('roof', cx, cz).frustum(cx, cz, 31, 12, y + 20, y + 26, 9, roof);
    this.stoneB.obox(cx + 34, cz, 3, 7, y - 1, y + 15, 0, c, { su: 6, sv: 6 }, {});
    this.addSolid(cx, cz, 31, 12, y - 3, y + 26);
    this.addSolid(cx + 34, cz, 3, 7, y - 1, y + 15);
    const tmat = this.mats.stone;
    for (const [tx, tz] of [[cx + 31, cz - 12], [cx + 31, cz + 12], [cx - 31, cz - 12], [cx - 31, cz + 12]]) {
      const t = new THREE.Mesh(new THREE.CylinderGeometry(4.2, 4.6, 34, 8), tmat);
      t.position.set(tx, y + 17, tz); t.castShadow = true; this.group.add(t);
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(4.8, 4.8, 1.2, 8), tmat);
      cap.position.set(tx, y + 34.4, tz); this.group.add(cap);
      this.addSolid(tx, tz, 4.4, 4.4, y - 1, y + 35);
    }
    for (let k = -2; k <= 2; k++) {
      const col = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 0.7, 13, 10), tmat);
      col.position.set(cx + 38, y + 6.5, cz + k * 2.8); col.castShadow = true; this.group.add(col);
    }
    // chapelle avec la Vierge dorée
    this.stoneB.obox(cx - 44, cz - 18, 4, 4, y - 1, y + 32, 0, c, { su: 6, sv: 6 }, {});
    this.addSolid(cx - 44, cz - 18, 4, 4, y - 1, y + 32);
    const statue = new THREE.Group();
    const s1 = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.1, 4, 10), this.mats.gold);
    s1.position.y = 2; statue.add(s1);
    const s2 = new THREE.Mesh(new THREE.SphereGeometry(0.55, 10, 8), this.mats.gold);
    s2.position.y = 4.4; statue.add(s2);
    statue.position.set(cx - 44, y + 32, cz - 18);
    this.group.add(statue);
    this.labels.push({ text: 'Basilique de Fourvière', x: cx, z: cz + 30, size: 10 });
  }

  _buildMetalTower(cx, cz) {
    const y = this.getGroundHeight(cx, cz);
    this._markRect(cx - 10, cz - 10, cx + 10, cz + 10, O_RESERVED);
    const cv = makeCanvas(128, 128), g = cv.getContext('2d');
    g.strokeStyle = '#ffffff'; g.lineWidth = 7;
    g.strokeRect(0, 0, 128, 128);
    g.beginPath(); g.moveTo(0, 0); g.lineTo(128, 128); g.moveTo(128, 0); g.lineTo(0, 128); g.stroke();
    const tex = canvasTexture(cv, { repeat: true });
    tex.repeat.set(2, 14);
    const mat = new THREE.MeshLambertMaterial({ map: tex, color: '#8d969e', alphaTest: 0.5, side: THREE.DoubleSide });
    const H = 86;
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 7.5, H, 4, 1, true), mat);
    tower.position.set(cx, y + H / 2, cz); tower.rotation.y = Math.PI / 4; tower.castShadow = true;
    this.group.add(tower);
    const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.5, 18, 6), this.mats.metal);
    ant.position.set(cx, y + H + 9, cz); this.group.add(ant);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.6, 8, 6), new THREE.MeshBasicMaterial({ color: '#ff2a2a' }));
    blink.position.set(cx, y + H + 18.4, cz); this.group.add(blink);
    this.animated.push((dt, t) => { blink.visible = Math.sin(t * 3 + 1) > 0; });
    this.addSolid(cx, cz, 5, 5, y - 1, y + 20);
    this.labels.push({ text: 'Tour métallique', x: cx, z: cz + 22, size: 9 });
  }

  _buildCathedral(cx, cz) {
    const y = this.getGroundHeight(cx, cz);
    const c = new THREE.Color('#dccbaa');
    this._markRect(cx - 26, cz - 18, cx + 24, cz + 18, O_RESERVED);
    this.stoneB.obox(cx - 2, cz, 20, 12, y - 1, y + 24, 0, c, { su: 6, sv: 6 }, { top: false });
    this._cb('roof', cx, cz).frustum(cx - 2, cz, 20, 12, y + 24, y + 30, 11, new THREE.Color('#7f6a5a'));
    this.addSolid(cx - 2, cz, 20, 12, y - 1, y + 30);
    for (const tz of [cz - 9.5, cz + 9.5]) {
      this.stoneB.obox(cx + 18.5, tz, 3.5, 3.5, y - 1, y + 33, 0, c, { su: 6, sv: 6 }, {});
      this.addSolid(cx + 18.5, tz, 3.5, 3.5, y - 1, y + 33);
    }
    // rosace
    const cv = makeCanvas(256, 256), g = cv.getContext('2d');
    g.fillStyle = '#dccbaa'; g.fillRect(0, 0, 256, 256);
    g.fillStyle = '#2a3a6a'; g.beginPath(); g.arc(128, 128, 120, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#d8c79f'; g.lineWidth = 6;
    for (let k = 0; k < 12; k++) { const a = (k / 12) * Math.PI * 2; g.beginPath(); g.moveTo(128, 128); g.lineTo(128 + Math.cos(a) * 120, 128 + Math.sin(a) * 120); g.stroke(); }
    g.beginPath(); g.arc(128, 128, 60, 0, Math.PI * 2); g.stroke();
    const rose = new THREE.Mesh(new THREE.CircleGeometry(4.5, 32), new THREE.MeshLambertMaterial({ map: canvasTexture(cv) }));
    rose.position.set(cx + 18.05, y + 17, cz); rose.rotation.y = Math.PI / 2;
    this.group.add(rose);
    this.labels.push({ text: 'Cathédrale Saint-Jean', x: cx, z: cz + 26, size: 9 });
  }

  _buildMuseum() {
    const { x, z, zTip } = this.museum;
    const y = this.getGroundHeight(x, z);
    const ax = this.rhone.bankX(z, -1) - this.saone.bankX(z, 1);
    this._markRect(x - 36, z - 40, x + 36, zTip + 30, O_PLAZA);
    this.plazas.push({ x0: x - 40, z0: z - 40, x1: x + 40, z1: zTip + 30, color: '#c4bdb0' });
    const a = Math.atan2(-0.35, 1);
    const g = new THREE.Group(); g.position.set(x, y, z); g.rotation.y = a;
    const base = new THREE.Mesh(new THREE.BoxGeometry(Math.min(30, ax * 0.55), 10, 44), this.mats.metal);
    base.position.set(0, 9, 4); base.rotation.z = 0.05; base.castShadow = true; g.add(base);
    const cloud = new THREE.Mesh(new THREE.BoxGeometry(Math.min(26, ax * 0.5), 9, 38), this.mats.metal);
    cloud.position.set(0, 18, 8); cloud.rotation.set(0.12, 0.2, -0.06); cloud.castShadow = true; g.add(cloud);
    const crystal = new THREE.Mesh(new THREE.IcosahedronGeometry(1, 0), this.mats.glass);
    crystal.scale.set(11, 15, 9); crystal.position.set(0, 12, -18); g.add(crystal);
    for (const px of [-6, 6]) for (const pz of [-8, 10, 22]) {
      const p = new THREE.Mesh(new THREE.CylinderGeometry(1, 1.4, 5, 8), this.mats.metal);
      p.position.set(px, 2.5, pz); g.add(p);
    }
    this.group.add(g);
    this.addSolid(x, z, 10, 26, y - 1, y + 4, a);
    this.labels.push({ text: 'Musée des Confluences', x, z: z + 40, size: 9 });
  }

  _buildCubes() {
    const make = ({ x, z }, color, holes) => {
      const y = this.getGroundHeight(x, z);
      const cv = makeCanvas(256, 256), g = cv.getContext('2d');
      g.fillStyle = color; g.fillRect(0, 0, 256, 256);
      g.fillStyle = 'rgba(0,0,0,0.45)';
      if (holes) {
        g.beginPath(); g.arc(150, 110, 70, 0, Math.PI * 2); g.fill();
        for (let k = 0; k < 40; k++) { g.beginPath(); g.arc(Math.random() * 256, Math.random() * 256, 4 + Math.random() * 8, 0, Math.PI * 2); g.fill(); }
      } else {
        for (let k = 0; k < 256; k += 32) { g.fillRect(k, 0, 3, 256); g.fillRect(0, k, 256, 3); }
      }
      const m = new THREE.Mesh(new THREE.BoxGeometry(26, 24, 26), new THREE.MeshLambertMaterial({ map: canvasTexture(cv) }));
      m.position.set(x, y + 12, z); m.castShadow = m.receiveShadow = true;
      this.group.add(m);
      this.addSolid(x, z, 13, 13, y - 1, y + 24);
      this.buildings.push({ x0: x - 13, z0: z - 13, x1: x + 13, z1: z + 13 });
      this._markRect(x - 14, z - 14, x + 14, z + 14, O_BUILDING);
      return x;
    };
    const x = make(this.cubeSites[0], '#f47a20', true);
    make(this.cubeSites[1], '#76b82a', false);
    this.labels.push({ text: 'Cube Orange', x, z: 750, size: 9 });
  }

  // ───────────── Sol (texture peinte) ─────────────
  _buildGround() {
    const W = WORLD.maxX - WORLD.minX, D = WORLD.maxZ - WORLD.minZ;
    const GW = 4096, GH = 4096;
    const cv = makeCanvas(GW, GH), g = cv.getContext('2d');
    const sx = GW / W, sz = GH / D;
    g.setTransform(sx, 0, 0, sz, -WORLD.minX * sx, -WORLD.minZ * sz);
    const rng = this.rng;
    // fond : pavés / béton
    g.fillStyle = '#8e8a82'; g.fillRect(WORLD.minX, WORLD.minZ, W, D);
    for (let k = 0; k < 60000; k++) {
      const v = 110 + Math.floor(rng() * 50);
      g.fillStyle = `rgba(${v},${v - 4},${v - 10},0.10)`;
      g.fillRect(WORLD.minX + rng() * W, WORLD.minZ + rng() * D, 1 + rng() * 5, 1 + rng() * 5);
    }
    // occupation : jardins, parcs, places, pentes herbeuses
    const colorFor = (code, x, z) => {
      if (code === O_GARDEN) return '#6d8c4c';
      if (code === O_PARK) return '#5f8d45';
      if (code === O_PLAZA) return '#aaa395';
      if (code === O_FREE) {
        const h = this.getGroundHeight(x, z), reg = this.regionAt(x, z);
        if ((reg === 0 && h > 5) || (reg === 1 && h > 4 && h < 40)) return '#6a8a4a';
      }
      return null;
    };
    for (let j = 0; j < this.oh; j++) {
      let runStart = -1, runColor = null;
      const z = WORLD.minZ + j * OCC;
      for (let i = 0; i <= this.ow; i++) {
        const x = WORLD.minX + i * OCC;
        const c = i < this.ow ? colorFor(this.occ[j * this.ow + i], x, z) : null;
        if (c !== runColor) {
          if (runColor) { g.fillStyle = runColor; g.fillRect(WORLD.minX + runStart * OCC, z, (i - runStart) * OCC + 0.05, OCC + 0.05); }
          runColor = c; runStart = i;
        }
      }
    }
    // taches de verdure dans les parcs
    for (let k = 0; k < 3000; k++) {
      const x = 372 + rng() * 418, z = -1200 + rng() * 572;
      if (this.occAt(x, z) !== O_PARK) continue;
      g.fillStyle = `rgba(${60 + rng() * 40},${110 + rng() * 40},${40 + rng() * 30},0.35)`;
      g.beginPath(); g.arc(x, z, 2 + rng() * 6, 0, Math.PI * 2); g.fill();
    }
    // places
    for (const p of this.plazas) {
      g.fillStyle = p.color; g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0);
      if (p.border) { g.strokeStyle = p.border; g.lineWidth = 3; g.strokeRect(p.x0 + 1.5, p.z0 + 1.5, p.x1 - p.x0 - 3, p.z1 - p.z0 - 3); }
    }
    // gravier de Bellecour
    for (let k = 0; k < 6000; k++) {
      g.fillStyle = `rgba(${150 + rng() * 60},${70 + rng() * 30},${40 + rng() * 20},0.25)`;
      g.fillRect(-178 + rng() * 226, 250 + rng() * 150, 0.6 + rng(), 0.6 + rng());
    }
    // rues
    const strokeRoad = (r, width, color, dash = null) => {
      g.beginPath();
      g.moveTo(r.pts[0][0], r.pts[0][1]);
      for (let k = 1; k < r.pts.length; k++) g.lineTo(r.pts[k][0], r.pts[k][1]);
      g.lineWidth = width; g.strokeStyle = color; g.setLineDash(dash || []);
      g.stroke();
    };
    g.lineCap = 'round'; g.lineJoin = 'round';
    const roads = this.roads.filter((r) => r.kind !== 'bridge' && r.kind !== 'path');
    for (const r of roads) strokeRoad(r, r.w + 6, '#b5b0a6');
    for (const r of roads) strokeRoad(r, r.w + 0.8, '#6f6c68');
    for (const r of roads) strokeRoad(r, r.w, '#3b3b3e');
    g.lineCap = 'butt';
    for (const r of roads) if (r.w >= 9) strokeRoad(r, 0.3, '#e8e4d8', [3, 5]);
    g.lineCap = 'round';
    for (const r of this.roads.filter((r) => r.kind === 'path')) {
      strokeRoad(r, r.w + 1, '#9c8f74');
      strokeRoad(r, r.w, r.name === 'Traboule' ? '#b9ab90' : '#cdbb94');
    }
    g.setLineDash([]);
    // voies ferrées
    g.fillStyle = '#6b5f55'; g.fillRect(836, WORLD.minZ, 70, D);
    g.fillStyle = '#4b4038';
    for (const tx of [846, 858, 870, 882, 894]) for (let z = WORLD.minZ; z < WORLD.maxZ; z += 0.9) g.fillRect(tx - 1.3, z, 2.6, 0.3);
    // fleuves : perré, berges, lit
    for (const r of this.rivers) {
      const poly = (dist) => {
        g.beginPath();
        for (let i = 0; i < r.count; i++) { const [x, z] = r.offsetPoint(i, -1, Math.max(0.5, r.hw[i] - dist)); i ? g.lineTo(x, z) : g.moveTo(x, z); }
        for (let i = r.count - 1; i >= 0; i--) { const [x, z] = r.offsetPoint(i, 1, Math.max(0.5, r.hw[i] - dist)); g.lineTo(x, z); }
        g.closePath();
      };
      poly(-0.6); g.fillStyle = '#cfc7b6'; g.fill();
      poly(0); g.fillStyle = '#8c8475'; g.fill();
      poly(PERRE_W); g.fillStyle = '#a89e8a'; g.fill();
      poly(r.bergeW); g.fillStyle = '#2b3d3f'; g.fill();
    }
    // lac
    g.fillStyle = '#2b3d3f'; g.beginPath(); g.ellipse(560, -905, 110, 54, 0, 0, Math.PI * 2); g.fill();

    const tex = canvasTexture(cv, { anisotropy: this.anisotropy });
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;

    // Maillage du relief, découpé en morceaux (normales calculées sur la grille complète → pas de couture)
    const nx = this.nx, nz = this.nz, H = this.H;
    const groundMat = new THREE.MeshLambertMaterial({ map: tex });
    const CC = CHUNK / T_STEP;
    for (let cj = 0; cj < nz - 1; cj += CC) for (let ci = 0; ci < nx - 1; ci += CC) {
      const i1 = Math.min(nx - 1, ci + CC), j1 = Math.min(nz - 1, cj + CC);
      const w = i1 - ci + 1, d = j1 - cj + 1;
      const pos = new Float32Array(w * d * 3), nor = new Float32Array(w * d * 3), uv = new Float32Array(w * d * 2);
      for (let j = cj; j <= j1; j++) for (let i = ci; i <= i1; i++) {
        const k = (j - cj) * w + (i - ci), g = j * nx + i;
        pos[k * 3] = WORLD.minX + i * T_STEP; pos[k * 3 + 1] = H[g]; pos[k * 3 + 2] = WORLD.minZ + j * T_STEP;
        const hl = H[j * nx + Math.max(0, i - 1)], hr = H[j * nx + Math.min(nx - 1, i + 1)];
        const hu = H[Math.max(0, j - 1) * nx + i], hd = H[Math.min(nz - 1, j + 1) * nx + i];
        const ax = (hl - hr) / (2 * T_STEP), az = (hu - hd) / (2 * T_STEP);
        const l = Math.hypot(ax, 1, az);
        nor[k * 3] = ax / l; nor[k * 3 + 1] = 1 / l; nor[k * 3 + 2] = az / l;
        uv[k * 2] = i / (nx - 1); uv[k * 2 + 1] = 1 - j / (nz - 1);
      }
      const idx = [];
      for (let j = 0; j < d - 1; j++) for (let i = 0; i < w - 1; i++) {
        const v00 = j * w + i, v10 = v00 + 1, v01 = v00 + w, v11 = v01 + 1;
        idx.push(v00, v01, v10, v10, v01, v11);
      }
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
      geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      geo.setIndex(idx);
      geo.computeBoundingSphere();
      const ground = new THREE.Mesh(geo, groundMat);
      ground.receiveShadow = true;
      ground.name = 'sol';
      this.group.add(ground);
    }
    this.groundCanvas = cv;

    // Bordure hors carte
    const frameMat = new THREE.MeshLambertMaterial({ color: '#7d7a72' });
    const F = 4000;
    for (const [x0, z0, x1, z1] of [[-F, -F, F, WORLD.minZ], [-F, WORLD.maxZ, F, F], [-F, WORLD.minZ, WORLD.minX, WORLD.maxZ], [WORLD.maxX, WORLD.minZ, F, WORLD.maxZ]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), frameMat);
      m.rotation.x = -Math.PI / 2; m.position.set((x0 + x1) / 2, -0.05, (z0 + z1) / 2);
      this.group.add(m);
    }
  }

  // ───────────── Ponts & parapets ─────────────
  _buildBridgesAndQuays() {
    const stone = new GeoBuilder(), deck = new GeoBuilder(), metal = new GeoBuilder();
    const cStone = new THREE.Color('#e3d9c4'), cMetal = new THREE.Color('#5b6f66'), cPier = new THREE.Color('#cfc4ad');
    const W = 16, TOP = 0.2;
    for (const def of BRIDGES) {
      const r = def.river === 'saone' ? this.saone : this.rhone;
      const z = def.z;
      const xl = r.bankX(z, -1) - 3, xr = r.bankX(z, 1) + 3, len = xr - xl, cx = (xl + xr) / 2;
      const body = def.style === 'metal' ? metal : stone;
      const bodyCol = def.style === 'metal' ? cMetal : cStone;
      body.obox(cx, z, len / 2, W / 2, TOP - 0.8, TOP, 0, bodyCol, { su: 4, sv: 4 }, { top: false, bottom: true });
      deck.quad([xl, TOP + 0.01, z + W / 2], [xr, TOP + 0.01, z + W / 2], [xr, TOP + 0.01, z - W / 2], [xl, TOP + 0.01, z - W / 2],
        [0, 0, len / 16, 0, len / 16, 1, 0, 1], new THREE.Color('#ffffff'));
      for (const pz of [z - W / 2 + 0.25, z + W / 2 - 0.25]) {
        body.obox(cx, pz, len / 2, 0.25, TOP, TOP + 1.0, 0, def.style === 'metal' ? new THREE.Color('#3e4d46') : cStone, { su: 4, sv: 4 }, {});
        this.addSolid(cx, pz, len / 2, 0.3, TOP, TOP + 1.0, 0, 'parapet');
      }
      const piers = Math.max(1, Math.round(len / 45));
      for (let k = 1; k <= piers; k++) {
        const px = xl + (len * k) / (piers + 1);
        stone.obox(px, z, 2.2, W / 2 * 0.9, BED_H - 1, TOP - 0.8, 0, cPier, { su: 4, sv: 4 }, {});
        this.addSolid(px, z, 2.2, W / 2 * 0.9, BED_H - 1, TOP - 0.8, 0, 'pier');
      }
      if (def.style === 'metal') { // arches métalliques
        for (const pz of [z - W / 2 + 0.25, z + W / 2 - 0.25]) {
          const segs = 16;
          for (let s = 0; s < segs; s++) {
            const t0 = s / segs, t1 = (s + 1) / segs;
            const y0 = TOP + Math.sin(t0 * Math.PI) * 5 + 1, y1 = TOP + Math.sin(t1 * Math.PI) * 5 + 1;
            const x0 = xl + 3 + (len - 6) * t0, x1 = xl + 3 + (len - 6) * t1;
            metal.quad([x0, y0 - 0.25, pz], [x1, y1 - 0.25, pz], [x1, y1 + 0.25, pz], [x0, y0 + 0.25, pz], null, cMetal);
            metal.quad([x1, y1 - 0.25, pz], [x0, y0 - 0.25, pz], [x0, y0 + 0.25, pz], [x1, y1 + 0.25, pz], null, cMetal);
            if (s % 2 === 0) metal.obox(x0, pz, 0.08, 0.08, TOP + 1, y0, 0, cMetal, {}, {});
          }
        }
      }
      for (let lx = xl + 8; lx < xr - 4; lx += 22) {
        this.lamps.push({ x: lx, z: z - W / 2 + 0.6, y: TOP, a: 0 });
        this.lamps.push({ x: lx + 11, z: z + W / 2 - 0.6, y: TOP, a: Math.PI });
      }
      this.bridges.push({ x0: xl, x1: xr, z0: z - W / 2, z1: z + W / 2, top: TOP, name: def.name, river: def.river, z });
      this.roads.push({ pts: [[xl, z], [xr, z]], w: ROAD_W, kind: 'bridge', name: def.name });
      this.labels.push({ text: def.name, x: cx, z: z - 14, size: 7, bridge: true });
    }
    // parapets des quais (avec ouvertures régulières pour descendre sur les berges)
    const cWall = new THREE.Color('#d8cfbc');
    for (const r of this.rivers) {
      const rb = this.bridges.filter((b) => b.river === r.id);
      for (const side of [-1, 1]) {
        for (let i = 0; i < r.count - 1; i++) {
          if (i % 25 === 12) continue; // ouverture
          const [ax, az] = r.offsetPoint(i, side, r.hw[i] + 0.3);
          const [bx, bz] = r.offsetPoint(i + 1, side, r.hw[i + 1] + 0.3);
          const mx = (ax + bx) / 2, mz = (az + bz) / 2;
          if (mx < WORLD.minX + 2 || mx > WORLD.maxX - 2 || mz < WORLD.minZ + 2 || mz > WORLD.maxZ - 2) continue;
          if (this.edgeAt(mx, mz) < -0.5) continue;
          if (rb.some((b) => Math.abs(mz - b.z) < 9)) continue;
          const dx = bx - ax, dz = bz - az, L = Math.hypot(dx, dz);
          const a = Math.atan2(dx, dz);
          stone.obox(mx, mz, 0.3, L / 2 + 0.05, -1.6, 0.9, a, cWall, { su: 4, sv: 4 }, {});
          this.addSolid(mx, mz, 0.3, L / 2, -1.6, 0.9, a, 'parapet');
        }
      }
    }
    for (const [b, mat] of [[stone, this.mats.stone], [deck, this.mats.deck], [metal, this.mats.plainV]]) {
      if (b.empty) continue;
      const m = new THREE.Mesh(b.build(), mat);
      m.castShadow = m.receiveShadow = true;
      this.group.add(m);
    }
  }

  // ───────────── Mobilier urbain ─────────────
  _buildStreetFurniture() {
    const rng = this.rng;
    // lampadaires le long des rues
    const seen = new Set();
    const keyOf = (x, z) => Math.round(x / 12) * 100000 + Math.round(z / 12);
    for (const l of this.lamps) seen.add(keyOf(l.x, l.z));
    for (const r of this.roads) {
      if (r.kind === 'bridge' || r.kind === 'path') continue;
      let acc = 15, sideFlip = 1;
      for (let k = 1; k < r.pts.length; k++) {
        const [ax, az] = r.pts[k - 1], [bx, bz] = r.pts[k];
        const L = Math.hypot(bx - ax, bz - az);
        if (L < 0.01) continue;
        const ux = (bx - ax) / L, uz = (bz - az) / L, nx = uz, nz = -ux;
        while (acc < L) {
          const px = ax + ux * acc, pz = az + uz * acc;
          const off = r.w / 2 + 1.8;
          const x = px + nx * off * sideFlip, z = pz + nz * off * sideFlip;
          const key = keyOf(x, z);
          if (!seen.has(key) && this.edgeAt(x, z) > 1.5 && this.occAt(x, z) === O_ROAD && !this.bridges.some((b) => x > b.x0 - 2 && x < b.x1 + 2 && z > b.z0 - 2 && z < b.z1 + 2)) {
            seen.add(key);
            this.lamps.push({ x, z, y: this.getGroundHeight(x, z), a: Math.atan2(-nx * sideFlip, -nz * sideFlip) });
          }
          sideFlip = -sideFlip;
          acc += 34;
        }
        acc -= L;
      }
    }
    const poleB = new GeoBuilder(), headB = new GeoBuilder(), white = new THREE.Color('#ffffff');
    poleB.obox(0, 0, 0.09, 0.09, 0, 6.1, 0, white, {}, {});
    poleB.obox(0, 0.6, 0.05, 0.6, 5.95, 6.05, 0, white, {}, {});
    headB.obox(0, 1.15, 0.25, 0.35, 5.75, 5.95, 0, white, {}, { bottom: true });
    const poleMat = new THREE.MeshLambertMaterial({ color: '#2d3236' });
    const headMat = new THREE.MeshLambertMaterial({ color: '#fff6d8', emissive: '#ffd590', emissiveIntensity: 0 });
    this.nightMaterials.push({ mat: headMat, max: 2.2 });
    const n = this.lamps.length;
    const poles = new THREE.InstancedMesh(poleB.build(), poleMat, n);
    const heads = new THREE.InstancedMesh(headB.build(), headMat, n);
    const poolTex = makeRadialTexture();
    const poolGeo = new THREE.PlaneGeometry(11, 11); poolGeo.rotateX(-Math.PI / 2);
    this.poolMat = new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, polygonOffset: true, polygonOffsetFactor: -2 });
    const pools = new THREE.InstancedMesh(poolGeo, this.poolMat, n);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), one = new THREE.Vector3(1, 1, 1), v = new THREE.Vector3();
    this.lamps.forEach((l, i) => {
      q.setFromAxisAngle(up, l.a);
      m4.compose(v.set(l.x, l.y, l.z), q, one);
      poles.setMatrixAt(i, m4); heads.setMatrixAt(i, m4);
      const px = l.x + Math.sin(l.a) * 2.2, pz = l.z + Math.cos(l.a) * 2.2;
      m4.compose(v.set(px, Math.max(l.y, this.getSurfaceHeight(px, pz, l.y + 1)) + 0.07, pz), q, one);
      pools.setMatrixAt(i, m4);
    });
    poles.castShadow = true;
    pools.visible = false;
    this.group.add(poles, heads, pools);
    this.lightPools = pools;

    // arbres le long des quais
    for (const r of this.rivers) for (const side of [-1, 1]) {
      for (let i = 0; i < r.count; i += 2) {
        const [x, z] = r.offsetPoint(i, side, r.hw[i] + 2.6);
        if (x < WORLD.minX + 6 || x > WORLD.maxX - 6 || z < WORLD.minZ + 6 || z > WORLD.maxZ - 6) continue;
        const e = this.edgeAt(x, z);
        if (e < 1.8 || e > 4) continue;
        if (this.bridges.some((b) => Math.abs(z - b.z) < 12 && b.river === r.id)) continue;
        this.trees.push([x, z, 0.85 + rng() * 0.3]);
      }
    }
    // arbres sur les collines et dans les jardins
    for (let k = 0; k < 9000 && this.trees.length < 2600; k++) {
      const x = WORLD.minX + 10 + rng() * (WORLD.maxX - WORLD.minX - 20), z = WORLD.minZ + 10 + rng() * (WORLD.maxZ - WORLD.minZ - 20);
      const code = this.occAt(x, z);
      if (code === O_GARDEN && rng() < 0.5) { this.trees.push([x, z, 0.7 + rng() * 0.4]); continue; }
      if (code !== O_FREE) continue;
      const h = this.getGroundHeight(x, z), reg = this.regionAt(x, z);
      if ((reg === 0 && h > 6) || (reg === 1 && h > 5 && h < 40)) this.trees.push([x, z, 0.8 + rng() * 0.6]);
    }
    const trunkGeo = new THREE.CylinderGeometry(0.22, 0.32, 3.2, 6); trunkGeo.translate(0, 1.6, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1); crownGeo.translate(0, 0, 0);
    const trunks = new THREE.InstancedMesh(trunkGeo, new THREE.MeshLambertMaterial({ color: '#5b4632' }), this.trees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, new THREE.MeshLambertMaterial({ color: '#ffffff' }), this.trees.length);
    const col = new THREE.Color(), s = new THREE.Vector3();
    this.trees.forEach(([x, z, sc], i) => {
      const y = this.getGroundHeight(x, z);
      q.setFromAxisAngle(up, rng() * Math.PI * 2);
      m4.compose(v.set(x, y, z), q, s.set(sc, sc, sc)); trunks.setMatrixAt(i, m4);
      const cs = 2.4 * sc;
      m4.compose(v.set(x, y + 3.2 * sc + cs * 0.55, z), q, s.set(cs, cs * 0.9, cs)); crowns.setMatrixAt(i, m4);
      col.setHSL(0.22 + rng() * 0.08, 0.45 + rng() * 0.2, 0.26 + rng() * 0.1); crowns.setColorAt(i, col);
      this.addSolid(x, z, 0.35 * sc, 0.35 * sc, y, y + 3, 0, 'tree');
    });
    trunks.castShadow = crowns.castShadow = true;
    crowns.receiveShadow = true;
    this.group.add(trunks, crowns);

    // péniches
    for (const [rid, z, side] of BOATS) this._buildBoat(rid === 'saone' ? this.saone : this.rhone, z, side);
  }

  _buildBoat(r, z, side) {
    const i = r.indexAtZ(z);
    const off = r.hw[i] - r.bergeW - 4.5;
    const [x, zz] = r.offsetPoint(i, side, off);
    const tx = r.x[Math.min(r.count - 1, i + 1)] - r.x[i], tz = r.z[Math.min(r.count - 1, i + 1)] - r.z[i];
    const a = Math.atan2(tx, tz);
    const L = 30 + this.rng() * 12;
    const colors = ['#1f4e79', '#7a1f1f', '#2f5d3a', '#333a40', '#6b4a2a'];
    const hullCol = colors[Math.floor(this.rng() * colors.length)];
    const shape = new THREE.Shape();
    shape.moveTo(-2.8, -L / 2); shape.lineTo(2.8, -L / 2); shape.lineTo(2.8, L / 2 - 6); shape.lineTo(0, L / 2); shape.lineTo(-2.8, L / 2 - 6); shape.lineTo(-2.8, -L / 2);
    const hullGeo = new THREE.ExtrudeGeometry(shape, { depth: 2.2, bevelEnabled: false });
    hullGeo.rotateX(-Math.PI / 2);
    const g = new THREE.Group();
    const hull = new THREE.Mesh(hullGeo, new THREE.MeshLambertMaterial({ color: hullCol }));
    hull.castShadow = true; g.add(hull);
    const cabinMat = new THREE.MeshLambertMaterial({ color: this.rng() < 0.5 ? '#f2efe6' : '#e9d9a8' });
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(4.4, 2.3, L * 0.45), cabinMat);
    cabin.position.set(0, 2.2 + 1.15, -L * 0.1); cabin.castShadow = true; g.add(cabin);
    const win = new THREE.Mesh(new THREE.BoxGeometry(4.5, 0.7, L * 0.42), new THREE.MeshLambertMaterial({ color: '#1d2730', emissive: '#ffcf73', emissiveIntensity: 0 }));
    this.nightMaterials.push({ mat: win.material, max: 0.8 });
    win.position.set(0, 3.5, -L * 0.1); g.add(win);
    const baseY = WATER_LEVEL - 0.6;
    g.position.set(x, baseY, zz); g.rotation.y = a;
    this.group.add(g);
    this.addSolid(x, zz, 2.8, L / 2, BED_H, WATER_LEVEL + 1.6, a, 'boat');
    const phase = this.rng() * 10;
    this.animated.push((dt, t) => {
      g.position.y = baseY + Math.sin(t * 0.8 + phase) * 0.08;
      g.rotation.z = Math.sin(t * 0.6 + phase) * 0.012;
    });
  }

  // ───────────── Eau ─────────────
  _buildWater() {
    const normal = makeWaterNormal();
    normal.repeat.set(320, 320);
    const mat = new THREE.MeshPhongMaterial({
      color: '#2f6070', specular: '#bcd6e4', shininess: 90, normalMap: normal,
      normalScale: new THREE.Vector2(0.5, 0.5), transparent: true, opacity: 0.9,
    });
    const geo = new THREE.PlaneGeometry(8000, 8000);
    geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, mat);
    water.position.y = WATER_LEVEL;
    water.receiveShadow = true;
    water.name = 'eau';
    this.group.add(water);
    this.waterMat = mat;
    this.animated.push((dt, t) => { normal.offset.set(t * 0.004, t * 0.009); });
  }

  // ───────────── Radar ─────────────
  _buildRadarMap() {
    const PX = 0.6;
    const W = WORLD.maxX - WORLD.minX, D = WORLD.maxZ - WORLD.minZ;
    const cv = makeCanvas(Math.round(W * PX), Math.round(D * PX)), g = cv.getContext('2d');
    g.setTransform(PX, 0, 0, PX, -WORLD.minX * PX, -WORLD.minZ * PX);
    g.fillStyle = '#4b5a46'; g.fillRect(WORLD.minX, WORLD.minZ, W, D);
    for (let z = WORLD.minZ; z < WORLD.maxZ; z += 8) for (let x = WORLD.minX; x < WORLD.maxX; x += 8) {
      const h = this.getGroundHeight(x + 4, z + 4);
      if (h > 2) { g.fillStyle = `rgba(255,240,200,${Math.min(0.22, h / 55 * 0.22)})`; g.fillRect(x, z, 8.5, 8.5); }
    }
    g.fillStyle = '#4f7f3d'; g.fillRect(372, -1200, 418, 572);
    for (const p of this.plazas) { g.fillStyle = p.color === '#b8653f' ? '#b8704a' : '#7c7a70'; g.fillRect(p.x0, p.z0, p.x1 - p.x0, p.z1 - p.z0); }
    g.fillStyle = '#39443a';
    for (const b of this.buildings) g.fillRect(b.x0, b.z0, b.x1 - b.x0, b.z1 - b.z0);
    g.fillStyle = '#3b6fa8';
    for (const r of this.rivers) {
      g.beginPath();
      for (let i = 0; i < r.count; i++) { const [x, z] = r.offsetPoint(i, -1, r.hw[i]); i ? g.lineTo(x, z) : g.moveTo(x, z); }
      for (let i = r.count - 1; i >= 0; i--) { const [x, z] = r.offsetPoint(i, 1, r.hw[i]); g.lineTo(x, z); }
      g.closePath(); g.fill();
    }
    g.beginPath(); g.ellipse(560, -905, 105, 50, 0, 0, Math.PI * 2); g.fill();
    g.lineCap = 'round'; g.lineJoin = 'round';
    for (const r of this.roads) {
      g.beginPath(); g.moveTo(r.pts[0][0], r.pts[0][1]);
      for (let k = 1; k < r.pts.length; k++) g.lineTo(r.pts[k][0], r.pts[k][1]);
      g.lineWidth = r.kind === 'path' ? 3 : r.w + 2;
      g.strokeStyle = r.kind === 'path' ? '#b7a985' : r.kind === 'bridge' ? '#e2e2dc' : '#c9c9c2';
      g.stroke();
    }
    g.fillStyle = '#6a5d50'; g.fillRect(836, WORLD.minZ, 70, D);
    g.strokeStyle = '#2a2a2a'; g.lineWidth = 2; g.setLineDash([10, 10]);
    g.beginPath(); g.moveTo(871, WORLD.minZ); g.lineTo(871, WORLD.maxZ); g.stroke(); g.setLineDash([]);
    this.radarCanvas = cv;
    this.radarScale = PX;
  }

  // ───────────── Infos ─────────────
  getDistrictName(x, z) {
    if (this.edgeAt(x, z) < -1) {
      if (z > CONFLUENCE_Z - 20) return 'Le Rhône';
      return this.saone.sample(x, z).d - this.saone.hwAt(z) < 0 ? 'La Saône' : 'Le Rhône';
    }
    const reg = this.regionAt(x, z);
    if (reg === 1) {
      if (z < -720) return 'Croix-Rousse';
      if (z < -470) return 'Pentes de la Croix-Rousse';
      if (x > -180 && x < 50 && z > 248 && z < 402) return 'Place Bellecour';
      if (z < -380) return 'Terreaux';
      if (z < 248) return "Presqu'île";
      if (z < 590) return 'Ainay';
      if (z < 690) return 'Perrache';
      return 'Confluence';
    }
    if (reg === 2) {
      if (x > 836) return 'Villeurbanne';
      if (z < -628) return "Parc de la Tête d'Or";
      if (x > 480 && z > -360 && z < 60) return 'Part-Dieu';
      if (z < -100) return 'Brotteaux';
      if (z < 620) return 'Guillotière';
      return 'Gerland';
    }
    if (z < -680) return 'Vaise';
    if (z > 560) return 'La Mulatière';
    if (this.edgeAt(x, z) < 100) return 'Vieux Lyon';
    return 'Fourvière';
  }

  /** Allume l'éclairage public et les fenêtres (night : 0 = jour, 1 = nuit). */
  setNight(night) {
    this.night = night;
    for (const { mat, max, min = 0 } of this.nightMaterials) mat.emissiveIntensity = min + (max - min) * night;
    if (this.poolMat) { this.poolMat.opacity = night * 0.55; this.lightPools.visible = night > 0.02; }
  }

  update(dt) {
    this.time += dt;
    for (const f of this.animated) f(dt, this.time);
    for (const m of this.markers) {
      m.arrow.rotation.y += dt * 2;
      m.arrow.position.y = 2.4 + Math.sin(this.time * 3) * 0.2;
      m.ring.material.opacity = 0.75 + Math.sin(this.time * 4) * 0.25;
    }
  }
}
