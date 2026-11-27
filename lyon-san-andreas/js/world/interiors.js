/**
 * interiors.js — Bâtiments accessibles (cercles lumineux devant les portes, touche E / F).
 *
 * Chaque intérieur est construit à la demande, très loin sous la ville (y = -300),
 * puis on y téléporte le joueur et on masque la ville : la scène principale n'est jamais
 * recréée, donc rien ne « plante ».
 *
 *  - Planque : lit (sauvegarde + avance l'heure + soins), garde-robe, coin cuisine
 *  - Centre Commercial Part-Dieu : 2 étages, escalators, boutiques, food-court (soins)
 *  - Gares Part-Dieu / Perrache : hall, quai, train pour passer d'une gare à l'autre
 *  - Hôpital de la Croix-Rousse : soins, réapparition après « HOSPITALISÉ »
 *  - Armurerie : armes, munitions et gilet pare-balles
 */
import * as THREE from 'three';
import { resolveSolids, pointInSolids, makeSolid, makeSignTexture, makeCanvas, canvasTexture, STEP_UP } from './mapLyon.js';
import { DEFAULT_OUTFIT } from '../entities/player.js';

const BASE_Y = -300;
const INTERACT_DISTANCE = 1.7;

export const OUTFITS = [
  { name: 'Maillot lyonnais', outfit: DEFAULT_OUTFIT },
  { name: 'Survêtement noir', outfit: { shirt: '#1b1b1b', stripe1: '#f2f2f2', stripe2: '#f2f2f2', pants: '#1b1b1b', shoes: '#f2f2f2', cap: '#1b1b1b' } },
  { name: 'Costume chic', outfit: { shirt: '#2d3142', stripe1: '#2d3142', stripe2: '#c9a227', pants: '#2d3142', shoes: '#3b2a1a', cap: '#2d3142' } },
  { name: 'Été sur les quais', outfit: { shirt: '#ffb703', stripe1: '#fb8500', stripe2: '#219ebc', pants: '#8ecae6', shoes: '#ffffff', cap: '#219ebc' } },
  { name: 'Rouge et noir', outfit: { shirt: '#c1121f', stripe1: '#111111', stripe2: '#111111', pants: '#111111', shoes: '#c1121f', cap: '#111111' } },
  { name: 'Treillis', outfit: { shirt: '#4b5320', stripe1: '#3b3b2e', stripe2: '#6b6b47', pants: '#3d4a2a', shoes: '#2b2b2b', cap: '#4b5320' } },
  { name: 'Canut (blouse bleue)', outfit: { shirt: '#3a5ba0', stripe1: '#3a5ba0', stripe2: '#2b437a', pants: '#2f2f2f', shoes: '#4a3424', cap: '#1f1f1f' } },
];

// ───────────────────────────── Un intérieur ─────────────────────────────
class Interior {
  constructor(id, name, ox, oz, height) {
    this.id = id;
    this.name = name;
    this.origin = new THREE.Vector3(ox, BASE_Y, oz);
    this.height = height;
    this.group = new THREE.Group();
    this.group.position.copy(this.origin);
    this.group.visible = false;
    this.solids = [];
    this.floors = [];
    this.ramps = [];
    this.spots = [];
    this.spawn = { x: 0, z: 0, yaw: 0 };
    this.mats = new Map();
  }
  mat(color, opts = {}) {
    const key = color + JSON.stringify(opts);
    if (!this.mats.has(key)) this.mats.set(key, opts.basic ? new THREE.MeshBasicMaterial({ color, ...opts.extra }) : new THREE.MeshLambertMaterial({ color, ...opts.extra }));
    return this.mats.get(key);
  }
  /** Boîte (coordonnées locales, y = bas). solid : collision. walk : on peut marcher dessus. */
  box(x, y, z, w, h, d, color, { solid = true, shadow = true, basic = false, rotY = 0 } = {}) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), this.mat(color, { basic }));
    m.position.set(x, y + h / 2, z); m.rotation.y = rotY;
    m.castShadow = shadow; m.receiveShadow = true;
    this.group.add(m);
    if (solid) this.solids.push(makeSolid(this.origin.x + x, this.origin.z + z, w / 2, d / 2, this.origin.y + y, this.origin.y + y + h, rotY));
    return m;
  }
  floor(x0, z0, x1, z1, y, color, thick = 0.3) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0, thick, z1 - z0), this.mat(color));
    m.position.set((x0 + x1) / 2, y - thick / 2, (z0 + z1) / 2);
    m.receiveShadow = true;
    this.group.add(m);
    this.floors.push({ x0: this.origin.x + x0, z0: this.origin.z + z0, x1: this.origin.x + x1, z1: this.origin.z + z1, top: this.origin.y + y });
    return m;
  }
  /** Pièce fermée : sol, 4 murs, plafond. */
  room(x0, z0, x1, z1, h, { wall = '#eee', floor = '#999', ceil = '#f5f5f5' } = {}) {
    if (floor) this.floor(x0, z0, x1, z1, 0, floor);
    const t = 0.3;
    this.box((x0 + x1) / 2, 0, z0 - t / 2, x1 - x0 + 2 * t, h, t, wall, { shadow: false });
    this.box((x0 + x1) / 2, 0, z1 + t / 2, x1 - x0 + 2 * t, h, t, wall, { shadow: false });
    this.box(x0 - t / 2, 0, (z0 + z1) / 2, t, h, z1 - z0, wall, { shadow: false });
    this.box(x1 + t / 2, 0, (z0 + z1) / 2, t, h, z1 - z0, wall, { shadow: false });
    const c = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, z1 - z0), this.mat(ceil));
    c.rotation.x = Math.PI / 2; c.position.set((x0 + x1) / 2, h, (z0 + z1) / 2);
    this.group.add(c);
    this.bounds = { x0, z0, x1, z1 };
  }
  /** Rampe / escalator montant vers +z local après rotation a. */
  ramp(x, z, a, hw, hl, y, h, color) {
    const shape = new THREE.Shape();
    shape.moveTo(-hl, 0); shape.lineTo(hl, 0); shape.lineTo(hl, h); shape.lineTo(-hl, 0);
    const geo = new THREE.ExtrudeGeometry(shape, { depth: hw * 2, bevelEnabled: false });
    geo.translate(0, 0, -hw); geo.rotateY(-Math.PI / 2);
    const m = new THREE.Mesh(geo, this.mat(color));
    m.position.set(x, y, z); m.rotation.y = a; m.receiveShadow = true;
    this.group.add(m);
    this.ramps.push({ x: this.origin.x + x, z: this.origin.z + z, y: this.origin.y + y, c: Math.cos(a), s: Math.sin(a), hw, hl, h });
  }
  sign(text, x, y, z, w, h, rotY, opts) {
    const tex = makeSignTexture(text, opts);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex }));
    m.position.set(x, y, z); m.rotation.y = rotY;
    this.group.add(m);
    return m;
  }
  light(x, y, z, w, d) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, d), this.mat('#fffbe8', { basic: true }));
    m.rotation.x = Math.PI / 2; m.position.set(x, y, z);
    this.group.add(m);
  }
  /** Point d'interaction (cercle lumineux). */
  spot(x, z, text, action, { color = '#ffd23f', y = 0 } = {}) {
    const g = new THREE.Group();
    g.position.set(x, y, z);
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.7, 24, 1, true),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.45, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending }));
    ring.position.y = 0.35;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.75, 24), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.35, depthWrite: false }));
    disc.rotation.x = -Math.PI / 2; disc.position.y = 0.03;
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.22, 0.45, 4), new THREE.MeshBasicMaterial({ color }));
    arrow.rotation.x = Math.PI; arrow.position.y = 1.6;
    g.add(ring, disc, arrow);
    this.group.add(g);
    this.spots.push({ x: this.origin.x + x, z: this.origin.z + z, y: this.origin.y + y, text, action, arrow });
  }

  // ─── Physique ───
  getSurfaceHeight(x, z, feetY) {
    let h = -1e9;
    for (const f of this.floors) if (x >= f.x0 && x <= f.x1 && z >= f.z0 && z <= f.z1 && feetY >= f.top - 0.7) h = Math.max(h, f.top);
    for (const r of this.ramps) {
      const dx = x - r.x, dz = z - r.z;
      const lx = r.c * dx - r.s * dz, lz = r.s * dx + r.c * dz;
      if (Math.abs(lx) < r.hw && Math.abs(lz) < r.hl) {
        const top = r.y + ((lz + r.hl) / (2 * r.hl)) * r.h;
        if (feetY > top - 1.2) h = Math.max(h, top);
      }
    }
    for (const s of this.solids) {
      if (feetY < s.maxY - STEP_UP - 0.1) continue;
      const dx = x - s.cx, dz = z - s.cz;
      const lx = s.c * dx - s.s * dz, lz = s.s * dx + s.c * dz;
      if (Math.abs(lx) <= s.hx && Math.abs(lz) <= s.hz) h = Math.max(h, s.maxY);
    }
    return h === -1e9 ? this.origin.y - 30 : h;
  }
  resolveCircle(pos, r, h) { return resolveSolids(this.solids, pos, r, h); }
  pointBlocked(x, y, z, pad) {
    if (y > this.origin.y + this.height - 0.15) return true;
    if (y < this.getSurfaceHeight(x, z, y) + 0.15) return true;
    const b = this.bounds;
    if (b && (x < this.origin.x + b.x0 + 0.1 || x > this.origin.x + b.x1 - 0.1 || z < this.origin.z + b.z0 + 0.1 || z > this.origin.z + b.z1 - 0.1)) return true;
    return pointInSolids(this.solids, x, y, z, pad);
  }
}

// ───────────────────────────── Gestionnaire ─────────────────────────────
export class InteriorManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.interiors = {};
    this.current = null;
    this.returnTo = null;
    this.snackCooldown = 0;
    this.panel = document.getElementById('panel');
    this.panelTitle = document.getElementById('panel-title');
    this.panelSub = document.getElementById('panel-sub');
    this.panelItems = document.getElementById('panel-items');
    document.getElementById('panel-close').addEventListener('click', () => this.closePanel());
  }

  get(id) {
    if (!this.interiors[id]) {
      const builders = {
        house: () => this._buildHouse(),
        mall: () => this._buildMall(),
        'gare-part-dieu': () => this._buildStation('gare-part-dieu', 'Gare Part-Dieu', 'gare-perrache', 'Gare de Perrache', -3600),
        'gare-perrache': () => this._buildStation('gare-perrache', 'Gare de Perrache', 'gare-part-dieu', 'Gare Part-Dieu', -3900),
        hospital: () => this._buildHospital(),
        gunshop: () => this._buildGunshop(),
      };
      const it = builders[id]();
      this.ctx.scene.add(it.group);
      this.interiors[id] = it;
    }
    return this.interiors[id];
  }

  _loc(interiorId) { return this.ctx.map.locations.find((l) => l.interior === interiorId); }

  update(dt) {
    const { map, player, game } = this.ctx;
    this.snackCooldown = Math.max(0, this.snackCooldown - dt);
    if (player.state !== 'alive') return;
    if (this.current) {
      const it = this.current;
      const t = performance.now() * 0.003;
      let best = null, bestD = INTERACT_DISTANCE;
      for (const s of it.spots) {
        s.arrow.position.y = 1.6 + Math.sin(t) * 0.12;
        s.arrow.rotation.y = t;
        if (Math.abs(s.y - player.position.y) > 1.5) continue;
        const d = Math.hypot(s.x - player.position.x, s.z - player.position.z);
        if (d < bestD) { best = s; bestD = d; }
      }
      if (best) game.offerInteraction(best.text, 2, best.action);
      if (player.position.y < it.origin.y - 8) player.teleport(it.origin.x + it.spawn.x, it.origin.z + it.spawn.z, it.spawn.yaw, it.origin.y);
      return;
    }
    if (player.vehicle) return;
    let best = null, bestD = 2.2;
    for (const loc of map.locations) {
      if (!loc.marker || !loc.interior) continue;
      const d = Math.hypot(loc.x - player.position.x, loc.z - player.position.z);
      if (d < bestD) { best = loc; bestD = d; }
    }
    if (best) game.offerInteraction(`Entrer : <b>${best.name}</b>`, 2, () => this.enter(best.interior, best));
  }

  /** Entre dans un intérieur. spawn optionnel : { x, z, yaw } en coordonnées locales. */
  enter(id, loc, spawn = null, instant = false) {
    const { game } = this.ctx;
    const go = () => {
      const it = this.get(id);
      this._show(it);
      this.returnTo = loc || this._loc(id);
      const s = spawn || it.spawn;
      this.ctx.player.teleport(it.origin.x + s.x, it.origin.z + s.z, s.yaw, it.origin.y);
      this.ctx.hud.showZone(it.name);
    };
    if (instant) go(); else game.fade(go, this.interiors[id]?.name || loc?.name || '');
  }

  _show(it) {
    const { map, game } = this.ctx;
    if (this.current && this.current !== it) this.current.group.visible = false;
    this.current = it;
    it.group.visible = true;
    map.interior = it;
    map.group.visible = false;
    game.vehicles.setVisible(false);
    game.traffic.setVisible(false);
    game.weapons.setVisible(false);
    game.dayNight.interior = true;
  }

  /** Ressort devant la porte (ou devant une autre porte, pour le train). */
  exit(loc = this.returnTo, instant = false) {
    const { map, game, player } = this.ctx;
    if (!this.current) return;
    loc = loc || this.ctx.map.locations.find((l) => l.id === 'planque');
    const go = () => {
      if (this.current) this.current.group.visible = false;
      this.current = null;
      map.interior = null;
      map.group.visible = true;
      game.vehicles.setVisible(true);
      game.traffic.setVisible(true);
      game.weapons.setVisible(true);
      game.dayNight.interior = false;
      const face = loc.face ?? 0;
      player.teleport(loc.x + Math.sin(face) * 3, loc.z + Math.cos(face) * 3, face);
      this.ctx.hud.showZone(map.getDistrictName(player.position.x, player.position.z));
    };
    if (instant) go(); else game.fade(go, '');
  }

  // ─── Panneau (boutiques, garde-robe) ───
  openPanel(title, sub, items) {
    const { game } = this.ctx;
    this.panelItemsDef = items;
    this.panelTitle.textContent = title;
    this.panelSub.textContent = sub || '';
    this._renderPanel();
    this.panel.classList.remove('hidden');
    game.openPanelState();
  }
  _renderPanel() {
    const money = this.ctx.player.stats.money;
    this.panelItems.innerHTML = '';
    for (const it of this.panelItemsDef) {
      const b = document.createElement('button');
      b.className = 'item';
      const dis = it.disabled?.() || (it.price > money);
      b.disabled = !!dis;
      const name = document.createElement('span'); name.className = 'name'; name.textContent = it.label;
      const price = document.createElement('span'); price.className = 'price'; price.textContent = it.price ? `$${it.price}` : 'Gratuit';
      const desc = document.createElement('span'); desc.className = 'desc'; desc.textContent = it.disabled?.() ? (it.disabledText || 'Déjà possédé') : (it.desc || '');
      if (it.swatch) { const sw = document.createElement('span'); sw.className = 'swatch'; sw.style.background = `linear-gradient(90deg, ${it.swatch.join(',')})`; b.appendChild(sw); }
      b.append(name, price, desc);
      b.addEventListener('click', () => {
        if (b.disabled) return;
        this.ctx.player.addMoney(-(it.price || 0));
        it.onBuy();
        this.ctx.game.effects.sfx.punch();
        this._renderPanel();
      });
      this.panelItems.appendChild(b);
    }
    const m = document.createElement('p');
    m.className = 'panel-money';
    m.textContent = `Votre argent : $${money}`;
    this.panelItems.appendChild(m);
  }
  closePanel() {
    this.panel.classList.add('hidden');
    this.ctx.game.closePanelState();
  }
  isPanelOpen() { return !this.panel.classList.contains('hidden'); }

  _wardrobe(price) {
    const p = this.ctx.player;
    this.openPanel(price ? 'Boutique de vêtements' : 'Garde-robe', price ? 'Changez de style (payant).' : 'Choisissez votre tenue.', OUTFITS.map((o) => ({
      label: o.name, price, desc: 'Porter cette tenue',
      swatch: [o.outfit.shirt, o.outfit.stripe1, o.outfit.stripe2, o.outfit.pants],
      onBuy: () => { p.setOutfit({ ...DEFAULT_OUTFIT, ...o.outfit }); this.ctx.hud.toast(`Tenue : <b>${o.name}</b>`); },
    })));
  }

  _gunshop() {
    const w = this.ctx.game.weapons, p = this.ctx.player;
    this.openPanel('Armurerie', 'Armes et protections.', [
      { label: 'Batte de baseball', price: 50, desc: 'Arme de corps à corps', disabled: () => w.owned.has('bat'), onBuy: () => w.give('bat') },
      { label: 'Pistolet + 36 balles', price: 300, desc: 'Précis, 12 balles par chargeur', disabled: () => w.owned.has('pistol'), onBuy: () => w.give('pistol', 36) },
      { label: 'Balles de pistolet ×24', price: 60, desc: 'Munitions', disabled: () => !w.owned.has('pistol'), disabledText: 'Achetez d\'abord le pistolet', onBuy: () => w.addAmmo('pistol', 24) },
      { label: "Fusil d'assaut + 90 balles", price: 1500, desc: 'Tir automatique, 30 balles par chargeur', disabled: () => w.owned.has('rifle'), onBuy: () => w.give('rifle', 90) },
      { label: 'Balles de fusil ×60', price: 120, desc: 'Munitions', disabled: () => !w.owned.has('rifle'), disabledText: "Achetez d'abord le fusil", onBuy: () => w.addAmmo('rifle', 60) },
      { label: 'Gilet pare-balles', price: 200, desc: 'Armure à 100 %', disabled: () => p.stats.armor >= p.stats.maxArmor, disabledText: 'Armure déjà pleine', onBuy: () => { p.stats.armor = p.stats.maxArmor; } },
    ]);
  }

  _eat(label, price, heal) {
    return () => {
      const p = this.ctx.player, hud = this.ctx.hud;
      if (p.stats.health >= p.stats.maxHealth) { hud.toast('Vous n\'avez pas faim 🙂'); return; }
      if (p.stats.money < price) { hud.toast('Pas assez d\'argent'); return; }
      p.addMoney(-price);
      p.heal(heal);
      hud.toast(`${label} : <b>+${heal} vie</b> (−$${price})`);
      this.ctx.game.effects.sfx.punch();
    };
  }

  _sleep() {
    const { game, player, hud } = this.ctx;
    game.fade(() => {
      game.dayNight.advance(6 * 60);
      player.heal();
      game.saveGame(false);
    }, 'Bonne nuit… 💤', 1400, () => hud.toast('Partie <b>sauvegardée</b> · 6 heures plus tard · vie à 100 %', 4));
  }

  _train(fromId, toId, toName) {
    const { game, player, hud } = this.ctx;
    return () => {
      if (player.stats.money < 10) { hud.toast('Le billet coûte $10'); return; }
      player.addMoney(-10);
      game.fade(() => {
        const it = this.get(toId);
        this._show(it);
        this.returnTo = this._loc(toId);
        player.teleport(it.origin.x, it.origin.z + 16, Math.PI, it.origin.y);
        hud.showZone(it.name);
      }, `Trajet en train vers ${toName}… 🚆`, 1800);
    };
  }

  // ─── Plans des intérieurs ───
  _buildHouse() {
    const it = new Interior('house', 'Planque', -3000, 0, 3.2);
    it.room(-6, -5, 6, 5, 3.2, { wall: '#efe3cf', floor: '#8a5a3b', ceil: '#f6f1e8' });
    it.light(0, 3.18, 0, 1.2, 1.2);
    // lit
    it.box(-4.2, 0, -3.3, 2.1, 0.45, 2.5, '#5b3a29');
    it.box(-4.2, 0.45, -3.3, 1.95, 0.22, 2.35, '#f5f5f5', { solid: false });
    it.box(-4.2, 0.62, -2.8, 1.97, 0.08, 1.4, '#c62828', { solid: false });
    it.box(-4.2, 0.67, -4.15, 1.2, 0.15, 0.45, '#ffffff', { solid: false });
    it.spot(-2.5, -3.2, 'Dormir : <b>sauvegarder</b> (+6 h, vie 100 %)', () => this._sleep(), { color: '#66ff88' });
    // garde-robe
    it.box(4.6, 0, -4.4, 1.8, 2.2, 0.6, '#6d4c41');
    it.box(4.6, 0.1, -4.08, 0.04, 2, 0.02, '#3e2723', { solid: false });
    it.spot(4.6, -3.3, 'Ouvrir la <b>garde-robe</b>', () => this._wardrobe(0), { color: '#4fc3f7' });
    // salon
    it.box(2.4, 0, 1.4, 0.95, 0.45, 2.4, '#37474f');
    it.box(1.95, 0, 1.4, 0.25, 0.95, 2.4, '#37474f');
    it.box(5.45, 0, 1.4, 0.5, 0.6, 1.8, '#212121');
    it.box(5.62, 0.65, 1.4, 0.08, 0.85, 1.5, '#111111', { solid: false });
    const tv = new THREE.Mesh(new THREE.PlaneGeometry(1.35, 0.72), new THREE.MeshBasicMaterial({ color: '#2a6fdb' }));
    tv.position.set(5.57, 1.07, 1.4); tv.rotation.y = -Math.PI / 2; it.group.add(tv);
    // cuisine
    it.box(-0.2, 0, -4.6, 3.4, 0.9, 0.7, '#cfd8dc');
    it.box(-0.2, 0.9, -4.6, 3.45, 0.05, 0.75, '#455a64', { solid: false });
    it.box(2.1, 0, -4.6, 0.8, 1.8, 0.7, '#eceff1');
    it.spot(-0.2, -3.6, 'Grignoter : <b>+25 vie</b>', () => {
      if (this.snackCooldown > 0) { this.ctx.hud.toast('Le frigo est vide pour l\'instant'); return; }
      this.snackCooldown = 60; this.ctx.player.heal(25); this.ctx.hud.toast('Un bon saucisson brioché : <b>+25 vie</b>');
    }, { color: '#ffd23f' });
    // table + tapis + affiche
    it.box(-3.4, 0, 2, 1.4, 0.75, 0.9, '#795548');
    it.box(-3.4, 0, 2.9, 0.5, 0.45, 0.5, '#5d4037'); it.box(-3.4, 0, 1.1, 0.5, 0.45, 0.5, '#5d4037');
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3, 2), new THREE.MeshLambertMaterial({ color: '#b71c1c' }));
    rug.rotation.x = -Math.PI / 2; rug.position.set(3.2, 0.01, 1.4); it.group.add(rug);
    it.sign('LYON ❤', -2.5, 1.9, -4.84, 2, 0.8, 0, { bg: '#1b3f8f', fg: '#ffffff' });
    it.box(0, 0, 4.84, 1.1, 2.2, 0.05, '#6d4c41', { solid: false });
    it.spot(0, 4.1, '<b>Sortir</b>', () => this.exit(), { color: '#ffffff' });
    it.spawn = { x: 0, z: 3.3, yaw: Math.PI };
    return it;
  }

  _buildMall() {
    const it = new Interior('mall', 'Centre Commercial Part-Dieu', -3300, 0, 12);
    it.room(-40, -25, 40, 25, 12, { wall: '#eee8dc', floor: '#d9d4cc', ceil: '#f7f4ee' });
    for (let x = -30; x <= 30; x += 15) it.light(x, 11.9, 0, 6, 26);
    // mezzanine (étage) : 4 bandes
    const slab = '#cfc8bc';
    const S = (x0, z0, x1, z1) => {
      it.box((x0 + x1) / 2, 5.6, (z0 + z1) / 2, x1 - x0, 0.4, z1 - z0, slab, { shadow: false });
      it.floors.push({ x0: it.origin.x + x0, z0: it.origin.z + z0, x1: it.origin.x + x1, z1: it.origin.z + z1, top: it.origin.y + 6 });
    };
    S(-40, -25, 40, -17); S(-40, 17, 40, 25); S(-40, -17, -32, 17); S(32, -17, 40, 17);
    // garde-corps
    const rail = '#9fb3c8';
    it.box(0, 6, -17, 64, 1.1, 0.12, rail); it.box(0, 6, 17, 64, 1.1, 0.12, rail);
    for (const x of [-32, 32]) { it.box(x, 6, -9.5, 0.12, 1.1, 15, rail); it.box(x, 6, 9.5, 0.12, 1.1, 15, rail); }
    // escalators
    it.ramp(-24, 0, -Math.PI / 2, 1.5, 8, 0, 6, '#8d99a6');
    it.ramp(24, 0, Math.PI / 2, 1.5, 8, 0, 6, '#8d99a6');
    for (const x of [-24, 24]) for (const z of [-1.6, 1.6]) it.box(x, 0, z, 16, 1, 0.1, '#56616b', { solid: false });
    // fontaine
    const f = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.2, 0.7, 32), it.mat('#b0a99b'));
    f.position.set(0, 0.35, 0); it.group.add(f);
    it.solids.push(makeSolid(it.origin.x, it.origin.z, 3.6, 3.6, it.origin.y, it.origin.y + 0.7));
    const water = new THREE.Mesh(new THREE.CircleGeometry(3.7, 32), it.mat('#4fa3d9', { basic: true }));
    water.rotation.x = -Math.PI / 2; water.position.set(0, 0.72, 0); it.group.add(water);
    for (const [x, z] of [[-12, -10], [12, -10], [-12, 10], [12, 10]]) {
      it.box(x, 0, z, 1, 0.8, 1, '#795548');
      const plant = new THREE.Mesh(new THREE.IcosahedronGeometry(0.9, 1), it.mat('#2e7d32'));
      plant.position.set(x, 1.6, z); it.group.add(plant);
    }
    // boutiques (rez-de-chaussée)
    const shops = [
      ['MODE LYONNAISE', '#c2185b'], ['SPORT 69', '#1565c0'], ['ÉLECTRO PART-DIEU', '#37474f'], ['LIBRAIRIE DES TRABOULES', '#6d4c41'], ['BIJOUTERIE BELLECOUR', '#b8860b'],
    ];
    shops.forEach(([name, col], i) => {
      const x = -28 + i * 14;
      it.box(x, 0, -24.6, 12, 5.2, 0.6, col, { shadow: false });
      it.box(x, 0.2, -24.25, 10, 4, 0.1, '#1d2733', { solid: false });
      it.sign(name, x, 4.6, -24.18, 10, 1, 0, { bg: col, fg: '#ffffff' });
    });
    it.spot(-14, -21.5, '<b>Boutique de vêtements</b> ($50 la tenue)', () => this._wardrobe(50), { color: '#4fc3f7' });
    [['PHARMACIE', '#2e7d32'], ['CAFÉ DES CANUTS', '#5d4037'], ['JOUETS', '#f57c00'], ['OPTICIEN', '#455a64']].forEach(([name, col], i) => {
      const x = -21 + i * 14;
      it.box(x, 0, 24.6, 12, 5.2, 0.6, col, { shadow: false });
      it.box(x, 0.2, 24.25, 10, 4, 0.1, '#1d2733', { solid: false });
      it.sign(name, x, 4.6, 24.18, 10, 1, Math.PI, { bg: col, fg: '#ffffff' });
    });
    it.spot(-21, 21.5, '<b>Pharmacie</b> : soins (+50 vie) $30', this._eat('Pharmacie', 30, 50), { color: '#66ff88' });
    // food-court (étage, côté nord)
    [['BOUCHON LYONNAIS', '#8d1c1c', 'Quenelle sauce Nantua', 12, 60], ['KEBAB DU RHÔNE', '#e65100', 'Kebab frites', 8, 40], ['CRÊPERIE DES CANUTS', '#1565c0', 'Crêpe à la praline rose', 5, 25]].forEach(([name, col, food, price, heal], i) => {
      const x = -20 + i * 20;
      it.box(x, 6, -24, 8, 1.1, 1.4, col);
      it.sign(name, x, 9.2, -24.6, 8, 1.2, 0, { bg: col, fg: '#ffffff' });
      it.spot(x, -21.6, `Manger : <b>${food}</b> ($${price}, +${heal} vie)`, this._eat(food, price, heal), { color: '#ff9f43', y: 6 });
    });
    for (let x = -30; x <= 30; x += 10) {
      it.box(x, 6, -19.2, 1.4, 0.75, 1.4, '#eeeeee');
    }
    it.sign('CENTRE COMMERCIAL PART-DIEU', 0, 10, 24.7, 30, 2.2, Math.PI, { bg: '#0d2a52', fg: '#ffffff' });
    // bancs
    for (const z of [-12, 12]) for (const x of [-6, 6]) it.box(x, 0, z, 3, 0.45, 0.7, '#6d4c41');
    it.box(-39.8, 0, 0, 0.1, 3, 4, '#2b3c4a', { solid: false });
    it.spot(-38, 0, '<b>Sortir</b>', () => this.exit(), { color: '#ffffff' });
    it.spawn = { x: -36, z: 0, yaw: Math.PI / 2 };
    return it;
  }

  _buildStation(id, name, otherId, otherName, ox) {
    const it = new Interior(id, name, ox, 0, 12);
    it.room(-30, -12, 30, 28, 12, { wall: '#e6e2da', floor: null, ceil: '#dfe9f2' });
    it.floor(-30, -12, 30, 20, 0, '#c9c3b8');
    it.floor(-30, 20, 30, 28, -1.2, '#5b4f45');
    for (let x = -24; x <= 24; x += 12) it.light(x, 11.9, 4, 8, 30);
    // quai : bande jaune + voies
    it.box(0, 0, 19.85, 60, 0.02, 0.3, '#ffd23f', { solid: false, shadow: false });
    for (const z of [23.3, 24.7]) it.box(0, -1.2, z, 60, 0.15, 0.1, '#8d8d8d', { solid: false });
    // train
    const tz = 24;
    for (let k = 0; k < 3; k++) {
      const x = -19 + k * 19;
      it.box(x, -0.8, tz, 18.4, 3.8, 3, '#f4f4f4');
      it.box(x, 1.2, tz - 1.52, 17, 0.9, 0.05, '#1c2733', { solid: false });
      it.box(x, 0.2, tz - 1.53, 18.4, 0.3, 0.05, '#2a4b8d', { solid: false });
    }
    // guichets + panneau des départs
    it.box(0, 0, -10.6, 16, 1.2, 1.2, '#455a64');
    it.sign('BILLETS', 0, 3, -11.84, 6, 1, 0, { bg: '#b3122a', fg: '#ffffff' });
    const cv = makeCanvas(1024, 384), g = cv.getContext('2d');
    g.fillStyle = '#0a1a3a'; g.fillRect(0, 0, 1024, 384);
    g.fillStyle = '#ffd23f'; g.font = 'bold 52px Arial'; g.fillText('DÉPARTS', 30, 64);
    g.font = '36px monospace'; g.fillStyle = '#ffffff';
    [['14:05', 'PARIS GARE DE LYON', 'V2'], ['14:12', otherName.toUpperCase(), 'A'], ['14:20', 'MARSEILLE ST-CHARLES', 'L'], ['14:31', 'GRENOBLE', 'B'], ['14:47', 'GENÈVE', 'J']].forEach((r, i) => {
      g.fillText(r[0], 30, 130 + i * 52); g.fillText(r[1], 190, 130 + i * 52); g.fillText(r[2], 900, 130 + i * 52);
    });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(12, 4.5), new THREE.MeshBasicMaterial({ map: canvasTexture(cv) }));
    board.position.set(0, 7, -11.84); it.group.add(board);
    it.sign(name.toUpperCase(), 0, 10.5, -11.84, 24, 2, 0, { bg: '#ffffff', fg: '#b3122a' });
    for (const z of [-3, 4, 11]) for (const x of [-16, 16]) it.box(x, 0, z, 6, 0.45, 0.7, '#6d4c41');
    it.spot(0, 17.5, `Prendre le train → <b>${otherName}</b> ($10)`, this._train(id, otherId, otherName), { color: '#ffd23f' });
    it.box(-29.85, 0, -8, 0.1, 3, 3, '#2b3c4a', { solid: false });
    it.spot(-27, -8, '<b>Sortir</b>', () => this.exit(), { color: '#ffffff' });
    it.spawn = { x: -26, z: -6, yaw: Math.PI / 2 };
    return it;
  }

  _buildHospital() {
    const it = new Interior('hospital', 'Hôpital de la Croix-Rousse', -4200, 0, 4);
    it.room(-12, -9, 12, 9, 4, { wall: '#ffffff', floor: '#d7ecea', ceil: '#f7fbfb' });
    for (const x of [-6, 6]) it.light(x, 3.98, 0, 2, 10);
    it.box(0, 0, -5.2, 6, 1.1, 1.2, '#90caf9');
    it.sign('ACCUEIL · URGENCES', 0, 2.8, -8.84, 8, 1, 0, { bg: '#c62828', fg: '#ffffff' });
    it.spot(0, -3.8, 'Soins complets : <b>vie 100 %</b> ($50)', () => {
      const p = this.ctx.player;
      if (p.stats.health >= p.stats.maxHealth) { this.ctx.hud.toast('Vous êtes en pleine forme !'); return; }
      if (p.stats.money < 50) { this.ctx.hud.toast('Pas assez d\'argent'); return; }
      p.addMoney(-50); p.heal(); this.ctx.hud.toast('Soigné : <b>vie 100 %</b>');
    }, { color: '#ff5252' });
    for (const z of [-6, -2, 2, 6]) {
      it.box(8.5, 0, z, 2.2, 0.6, 1.1, '#eceff1');
      it.box(9.3, 0.6, z, 0.6, 0.15, 0.9, '#ffffff', { solid: false });
      it.box(7.2, 0, z + 1.4, 0.05, 2.2, 1.4, '#80cbc4', { solid: false });
    }
    for (const z of [-4, -1, 2, 5]) it.box(-9.5, 0, z, 1.2, 0.5, 2, '#64b5f6');
    it.box(0, 0, 8.84, 2, 2.4, 0.05, '#b0bec5', { solid: false });
    it.spot(0, 7.7, '<b>Sortir</b>', () => this.exit(), { color: '#ffffff' });
    it.spawn = { x: 0, z: 6.5, yaw: Math.PI };
    it.bedSpawn = { x: 6.6, z: -6, yaw: -Math.PI / 2 };
    return it;
  }

  _buildGunshop() {
    const it = new Interior('gunshop', 'Armurerie', -4500, 0, 3.6);
    it.room(-8, -6, 8, 6, 3.6, { wall: '#6d6258', floor: '#4e4a45', ceil: '#3e3833' });
    it.light(0, 3.58, -1, 6, 1);
    it.box(0, 0, -1.8, 12, 1.1, 0.8, '#3e2723');
    it.box(0, 1.1, -1.8, 12, 0.05, 0.85, '#90a4ae', { solid: false });
    for (let i = 0; i < 6; i++) {
      const x = -6 + i * 2.4;
      it.box(x, 1.4, -5.85, 2, 1.4, 0.06, '#5d4037', { solid: false });
      it.box(x, 1.8, -5.8, 1.4, 0.18, 0.08, '#263238', { solid: false });
      it.box(x + 0.2, 2.3, -5.8, 0.9, 0.15, 0.08, '#37474f', { solid: false });
    }
    it.sign('ARMURERIE LYONNAISE', 0, 3.1, -5.84, 8, 0.8, 0, { bg: '#111', fg: '#ff3b30' });
    it.spot(0, -0.6, '<b>Acheter</b> armes et munitions', () => this._gunshop(), { color: '#ff9f43' });
    it.box(0, 0, 5.84, 1.2, 2.3, 0.05, '#3e2723', { solid: false });
    it.spot(0, 4.8, '<b>Sortir</b>', () => this.exit(), { color: '#ffffff' });
    it.spawn = { x: 0, z: 3.8, yaw: Math.PI };
    return it;
  }
}
