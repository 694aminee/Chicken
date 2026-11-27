/**
 * hud.js — Interface à l'écran.
 *
 *  - Haut droite : icône d'arme + munitions, horloge, barres vie / armure / endurance,
 *    argent (vert, 8 chiffres), étoiles de recherche
 *  - Bas gauche : radar circulaire qui tourne avec la caméra (routes, fleuves, ponts, icônes)
 *  - Bas droite : nom du quartier quand on en change
 *  - Haut gauche : bulle d'aide contextuelle (ex. « E : entrer »)
 *  - Grande carte (touche M) avec téléportation au clic (mode exploration)
 */
import { WORLD } from '../world/mapLyon.js';

const ICONS = {
  house: { color: '#4cd964', glyph: 'house' },
  garage: { color: '#4fc3f7', glyph: 'G' },
  shop: { color: '#ffd23f', glyph: '$' },
  gun: { color: '#ff9f43', glyph: 'A' },
  hospital: { color: '#ff3b30', glyph: 'cross' },
  train: { color: '#ffffff', glyph: 'T' },
  police: { color: '#2d7bff', glyph: 'P' },
};

const svg = (inner) => `<svg viewBox="0 0 64 64" width="46" height="46" aria-hidden="true">${inner}</svg>`;
const WEAPON_ICONS = {
  fist: '<span class="glyph">✊</span>',
  bat: svg('<path d="M8 56 L14 50 L48 12 Q54 6 58 10 Q62 14 56 20 L18 54 L12 60 Z" fill="#c98a4b" stroke="#000" stroke-width="3"/>'),
  pistol: svg('<path d="M6 18 H52 V28 H30 L26 50 H14 L18 28 H6 Z" fill="#cfd8dc" stroke="#000" stroke-width="3"/><rect x="52" y="20" width="6" height="5" fill="#cfd8dc" stroke="#000" stroke-width="2"/>'),
  rifle: svg('<path d="M2 24 H44 V20 H60 V28 H44 V32 H36 L34 46 H26 L28 32 H16 L10 40 H2 Z" fill="#b0bec5" stroke="#000" stroke-width="3"/>'),
};

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor(map) {
    this.map = map;
    this.el = {
      root: $('hud'),
      clock: $('hud-clock'),
      weaponIcon: $('hud-weapon-icon'),
      weaponAmmo: $('hud-weapon-ammo'),
      health: $('bar-health'),
      armor: $('bar-armor'),
      armorWrap: $('bar-armor-wrap'),
      stamina: $('bar-stamina'),
      money: $('hud-money'),
      stars: [...document.querySelectorAll('#hud-stars .star')],
      zone: $('zone-name'),
      prompt: $('prompt'),
      toast: $('toast'),
      radar: $('radar'),
      mapScreen: $('map-screen'),
      mapCanvas: $('map-canvas'),
      fps: $('fps'),
      starsWrap: $('hud-stars'),
      crosshair: $('crosshair'),
      lock: $('lock'),
      vehicleName: $('vehicle-name'),
      dmg: $('dmg-flash'),
    };
    this.vehicleTimer = 0;
    this.blips = [];
    this.last = {};
    this.zoneTimer = 0;
    this.currentZone = '';
    this.toastTimer = 0;
    this.radarRange = 260; // rayon visible (m)
    this.onMapClick = null;
    this._setupRadar();
    this._setupBigMap();
  }

  _setupRadar() {
    const c = this.el.radar;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const size = c.clientWidth || 210;
    c.width = size * dpr; c.height = size * dpr;
    this.radarCtx = c.getContext('2d');
    this.radarSize = size;
    this.radarDpr = dpr;
  }

  _setupBigMap() {
    const c = this.el.mapCanvas;
    c.addEventListener('click', (e) => {
      if (!this.mapView) return;
      const r = c.getBoundingClientRect();
      const px = (e.clientX - r.left) * (c.width / r.width), py = (e.clientY - r.top) * (c.height / r.height);
      const v = this.mapView;
      const x = WORLD.minX + (px - v.ox) / v.s, z = WORLD.minZ + (py - v.oy) / v.s;
      if (x > WORLD.minX && x < WORLD.maxX && z > WORLD.minZ && z < WORLD.maxZ) this.onMapClick?.(x, z);
    });
  }

  _set(key, el, value, prop = 'textContent') {
    if (this.last[key] === value) return;
    this.last[key] = value;
    if (prop === 'width') el.style.width = value;
    else el[prop] = value;
  }

  showZone(name) {
    if (name === this.currentZone) return;
    this.currentZone = name;
    this.el.zone.textContent = name;
    this.el.zone.classList.remove('show');
    void this.el.zone.offsetWidth;
    this.el.zone.classList.add('show');
    this.zoneTimer = 4;
  }

  showPrompt(text) {
    if (this.last.prompt === text) return;
    this.last.prompt = text;
    if (text) { this.el.prompt.innerHTML = text; this.el.prompt.classList.add('show'); }
    else this.el.prompt.classList.remove('show');
  }

  toast(text, seconds = 3) {
    this.el.toast.innerHTML = text;
    this.el.toast.classList.add('show');
    this.toastTimer = seconds;
  }

  /**
   * data : { player, clock: 'HH:MM', camYaw }
   */
  update(dt, data) {
    const { player, clock } = data;
    const s = player.stats;
    this._set('clock', this.el.clock, clock);
    this._set('hp', this.el.health, `${(s.health / s.maxHealth) * 100}%`, 'width');
    this._set('ar', this.el.armor, `${(s.armor / s.maxArmor) * 100}%`, 'width');
    this._set('arw', this.el.armorWrap, s.armor > 0 ? 'bar' : 'bar hidden', 'className');
    this._set('st', this.el.stamina, `${(s.stamina / s.maxStamina) * 100}%`, 'width');
    this._set('money', this.el.money, '$' + String(Math.floor(s.money)).padStart(8, '0'));
    this._set('wIcon', this.el.weaponIcon, WEAPON_ICONS[player.weapon.id] || WEAPON_ICONS.fist, 'innerHTML');
    const ammo = player.weapon.ammo === Infinity ? '' : `${player.weapon.clip}-${player.weapon.ammo}`;
    this._set('wAmmo', this.el.weaponAmmo, ammo);
    const wanted = Math.round(s.wanted);
    if (this.last.wanted !== wanted) {
      this.last.wanted = wanted;
      this.el.stars.forEach((st, i) => st.classList.toggle('on', i < wanted));
    }
    this.el.health.parentElement.classList.toggle('low', s.health < 25);

    if (this.zoneTimer > 0) {
      this.zoneTimer -= dt;
      if (this.zoneTimer <= 0) this.el.zone.classList.remove('show');
    }
    if (this.vehicleTimer > 0) {
      this.vehicleTimer -= dt;
      if (this.vehicleTimer <= 0) this.el.vehicleName.classList.remove('show');
    }
    if (this.toastTimer > 0) {
      this.toastTimer -= dt;
      if (this.toastTimer <= 0) this.el.toast.classList.remove('show');
    }
    this._drawRadar(player, data.camYaw);
    if (this.el.mapScreen.classList.contains('open')) this._drawBigMap(player);
  }

  _drawIcon(g, x, y, icon, r = 7) {
    const ic = ICONS[icon];
    if (!ic) return;
    g.save();
    g.translate(x, y);
    g.fillStyle = '#111'; g.beginPath(); g.arc(0, 0, r + 1.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = ic.color; g.beginPath(); g.arc(0, 0, r, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#111'; g.strokeStyle = '#111';
    if (ic.glyph === 'house') {
      g.beginPath(); g.moveTo(-r * 0.6, 0); g.lineTo(0, -r * 0.6); g.lineTo(r * 0.6, 0); g.closePath(); g.fill();
      g.fillRect(-r * 0.4, 0, r * 0.8, r * 0.5);
    } else if (ic.glyph === 'cross') {
      g.fillStyle = '#fff';
      g.fillRect(-r * 0.2, -r * 0.6, r * 0.4, r * 1.2); g.fillRect(-r * 0.6, -r * 0.2, r * 1.2, r * 0.4);
    } else {
      g.font = `bold ${Math.round(r * 1.4)}px Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(ic.glyph, 0, 1);
    }
    g.restore();
  }

  _drawRadar(player, camYaw) {
    const g = this.radarCtx, S = this.radarSize, dpr = this.radarDpr, map = this.map;
    const R = S / 2;
    const scale = R / this.radarRange; // px par mètre
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, S, S);
    if (map.interior) {
      g.fillStyle = '#1c2026'; g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#cfd8dc'; g.font = 'bold 13px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('INTÉRIEUR', R, R - 8);
      g.font = '11px Arial, sans-serif'; g.fillStyle = '#90a4ae';
      const name = map.interior.name.length > 22 ? map.interior.name.slice(0, 21) + '…' : map.interior.name;
      g.fillText(name, R, R + 10);
      return;
    }
    g.save();
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#26301f'; g.fillRect(0, 0, S, S);
    // carte qui tourne avec la caméra
    g.translate(R, R);
    g.rotate(camYaw);
    const k = scale / map.radarScale;
    g.scale(k, k);
    const px = (player.position.x - WORLD.minX) * map.radarScale, pz = (player.position.z - WORLD.minZ) * map.radarScale;
    g.drawImage(map.radarCanvas, -px, -pz);
    g.restore();
    // icônes (restent droites)
    const c = Math.cos(camYaw), s = Math.sin(camYaw);
    for (const loc of map.locations) {
      let dx = (loc.x - player.position.x) * scale, dz = (loc.z - player.position.z) * scale;
      let rx = dx * c - dz * s, ry = dx * s + dz * c;
      const d = Math.hypot(rx, ry);
      if (d > R - 10) { rx *= (R - 10) / d; ry *= (R - 10) / d; }
      this._drawIcon(g, R + rx, R + ry, loc.icon, 6.5);
    }
    // policiers et voitures de police (quand on est recherché)
    const blink = Math.floor(performance.now() / 250) % 2 === 0;
    for (const b of this.blips) {
      const dx = (b.x - player.position.x) * scale, dz = (b.z - player.position.z) * scale;
      let rx = dx * c - dz * s, ry = dx * s + dz * c;
      const d = Math.hypot(rx, ry);
      if (d > R - 6) { rx *= (R - 6) / d; ry *= (R - 6) / d; }
      g.fillStyle = b.color === 'police' ? (blink ? '#ff2a2a' : '#2a6bff') : b.color;
      g.strokeStyle = '#000'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(R + rx, R + ry, b.size, 0, Math.PI * 2); g.fill(); g.stroke();
    }
    // nord
    const nx = R + Math.sin(camYaw) * (R - 11), ny = R - Math.cos(camYaw) * (R - 11);
    g.fillStyle = '#111'; g.beginPath(); g.arc(nx, ny, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 12px Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', nx, ny + 1);
    // joueur
    g.save();
    g.translate(R, R);
    g.rotate(camYaw + Math.atan2(Math.sin(player.yaw), -Math.cos(player.yaw)));
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 1.5;
    g.beginPath(); g.moveTo(0, -9); g.lineTo(6.5, 7); g.lineTo(0, 3.5); g.lineTo(-6.5, 7); g.closePath();
    g.fill(); g.stroke();
    g.restore();
  }

  openMap(open) {
    this.el.mapScreen.classList.toggle('open', open);
    if (open) {
      const c = this.el.mapCanvas;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = c.clientWidth * dpr; c.height = c.clientHeight * dpr;
    }
  }

  _drawBigMap(player) {
    const c = this.el.mapCanvas, g = c.getContext('2d'), map = this.map;
    const W = c.width, H = c.height;
    const mw = WORLD.maxX - WORLD.minX, md = WORLD.maxZ - WORLD.minZ;
    const s = Math.min(W / mw, H / md) * 0.96;
    const ox = (W - mw * s) / 2, oy = (H - md * s) / 2;
    this.mapView = { s, ox, oy };
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.fillStyle = '#101418'; g.fillRect(0, 0, W, H);
    g.drawImage(map.radarCanvas, ox, oy, mw * s, md * s);
    const P = (x, z) => [ox + (x - WORLD.minX) * s, oy + (z - WORLD.minZ) * s];
    const k = s / 0.6;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const l of map.labels) {
      if (l.bridge && s < 0.45) continue;
      const [x, y] = P(l.x, l.z);
      const size = Math.max(9, l.size * k * 0.9);
      g.font = `${l.district ? '' : 'bold '}${size}px ${l.district ? '"Bebas Neue", Impact, sans-serif' : 'Arial, sans-serif'}`;
      g.lineWidth = Math.max(2, size / 5); g.strokeStyle = 'rgba(0,0,0,0.85)';
      g.fillStyle = l.district ? '#ffffff' : l.bridge ? '#d7e8ff' : '#ffe9a8';
      g.strokeText(l.text, x, y); g.fillText(l.text, x, y);
    }
    // fleuves
    g.font = `italic bold ${Math.max(12, 16 * k)}px Georgia, serif`; g.fillStyle = '#bfe0ff';
    for (const [t, x, z] of [['Saône', -455, -780], ['Rhône', 300, -800], ['Rhône', 40, 1150]]) {
      const [px, py] = P(x, z);
      g.save(); g.translate(px, py); g.rotate(Math.PI / 2.3); g.strokeText(t, 0, 0); g.fillText(t, 0, 0); g.restore();
    }
    for (const loc of map.locations) { const [x, y] = P(loc.x, loc.z); this._drawIcon(g, x, y, loc.icon, Math.max(7, 8 * k)); }
    const [px, py] = P(player.position.x, player.position.z);
    g.save(); g.translate(px, py); g.rotate(Math.atan2(Math.sin(player.yaw), -Math.cos(player.yaw)));
    g.fillStyle = '#fff'; g.strokeStyle = '#d00'; g.lineWidth = 2.5;
    const a = Math.max(9, 11 * k);
    g.beginPath(); g.moveTo(0, -a); g.lineTo(a * 0.7, a * 0.8); g.lineTo(0, a * 0.4); g.lineTo(-a * 0.7, a * 0.8); g.closePath();
    g.fill(); g.stroke(); g.restore();
  }

  showVehicleName(name) {
    this.el.vehicleName.textContent = name;
    this.el.vehicleName.classList.add('show');
    this.vehicleTimer = 3;
  }
  showCrosshair(on) { if (this.last.cross !== on) { this.last.cross = on; this.el.crosshair.classList.toggle('show', on); } }
  /** Petit triangle rouge au-dessus de la cible verrouillée. pos : Vector3 ou null. */
  showLock(pos) {
    const el = this.el.lock;
    if (!pos || !this.camera) { if (this.last.lock) { el.classList.remove('show'); this.last.lock = false; } return; }
    const v = this._proj || (this._proj = pos.clone());
    v.set(pos.x, pos.y + 2.2, pos.z).project(this.camera);
    if (v.z > 1) { el.classList.remove('show'); this.last.lock = false; return; }
    el.style.transform = `translate(${(v.x * 0.5 + 0.5) * window.innerWidth}px, ${(-v.y * 0.5 + 0.5) * window.innerHeight}px)`;
    if (!this.last.lock) { el.classList.add('show'); this.last.lock = true; }
  }
  setWantedSearching(on) { if (this.last.search !== on) { this.last.search = on; this.el.starsWrap.classList.toggle('searching', on); } }
  flashDamage() {
    const el = this.el.dmg;
    el.classList.remove('hit'); void el.offsetWidth; el.classList.add('hit');
  }

  showFps(fps) { if (this.el.fps) this.el.fps.textContent = `${fps} i/s`; }
}
