/**
 * weapons.js — Armes, visée, tirs, impacts et objets à ramasser.
 *
 *  - 1 Poings · 2 Batte · 3 Pistolet · 4 Fusil d'assaut (molette ou bouton ARME pour changer)
 *  - Clic droit : viser au réticule · Clic gauche : frapper / tirer · R : recharger
 *  - Sans viser (et sur téléphone) : verrouillage automatique sur la cible la plus proche
 *  - Les tirs en public font fuir les piétons et alertent la police
 *  - Objets à ramasser : billets (piétons), armes et munitions cachées dans Lyon, soins, gilet
 */
import * as THREE from 'three';

export const WEAPONS = [
  { id: 'fist', name: 'Poings', melee: true, damage: 10, range: 1.8, rate: 2.6 },
  { id: 'bat', name: 'Batte', melee: true, damage: 30, range: 2.3, rate: 1.6 },
  { id: 'pistol', name: 'Pistolet', damage: 28, range: 70, rate: 3.2, clip: 12, spread: 0.012 },
  { id: 'rifle', name: "Fusil d'assaut", damage: 20, range: 120, rate: 9, clip: 30, auto: true, spread: 0.024 },
];
const byId = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

const PICKUPS = {
  money: { color: '#3ddc6a', label: (n) => `+$${n}` },
  bat: { color: '#c58b4a', label: () => 'Batte' },
  pistol: { color: '#9aa4ae', label: () => 'Pistolet' },
  rifle: { color: '#5d6d7e', label: () => "Fusil d'assaut" },
  'pistol-ammo': { color: '#ffd23f', label: (n) => `+${n} balles de pistolet` },
  'rifle-ammo': { color: '#ff9f43', label: (n) => `+${n} balles de fusil` },
  health: { color: '#ff4d4d', label: () => 'Soins' },
  armor: { color: '#4fc3f7', label: () => 'Gilet pare-balles' },
};

export class WeaponSystem {
  /** @param {{game, scene, map, player, input, hud, camera}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.owned = new Set(['fist']);
    this.ammo = { pistol: { clip: 0, reserve: 0 }, rifle: { clip: 0, reserve: 0 } };
    this.current = 0;
    this.cooldown = 0;
    this.reloading = 0;
    this.meleePending = -1;
    this.lastCrime = 0;
    this.lockTarget = null;
    this.lockTimer = 0;
    this.pickups = [];
    this._v = new THREE.Vector3(); this._d = new THREE.Vector3(); this._o = new THREE.Vector3();
    this._initPickupModels();
    this._placeWorldPickups();
    this._syncPlayer();
  }

  get weapon() { return WEAPONS[this.current]; }

  // ─── Inventaire ───
  give(id, ammo = 0) {
    this.owned.add(id);
    if (this.ammo[id]) {
      this.ammo[id].reserve += ammo;
      if (this.ammo[id].clip === 0) this._reloadNow(id);
    }
    if (WEAPONS.findIndex((w) => w.id === id) > this.current) this.select(WEAPONS.findIndex((w) => w.id === id));
    this._syncPlayer();
  }
  addAmmo(id, n) {
    if (!this.ammo[id]) return;
    this.ammo[id].reserve += n;
    if (this.ammo[id].clip === 0) this._reloadNow(id);
    this._syncPlayer();
  }
  loseAll() {
    this.owned = new Set(['fist']);
    this.ammo = { pistol: { clip: 0, reserve: 0 }, rifle: { clip: 0, reserve: 0 } };
    this.current = 0;
    this._syncPlayer();
  }
  select(i) {
    const w = WEAPONS[i];
    if (!w || !this.owned.has(w.id)) return;
    this.current = i;
    this.reloading = 0;
    this._syncPlayer();
  }
  cycle(dir) {
    for (let k = 1; k <= WEAPONS.length; k++) {
      const i = (this.current + dir * k + WEAPONS.length * 4) % WEAPONS.length;
      if (this.owned.has(WEAPONS[i].id)) { this.select(i); return; }
    }
  }
  _reloadNow(id) {
    const a = this.ammo[id], w = byId[id];
    const n = Math.min(w.clip - a.clip, a.reserve);
    a.clip += n; a.reserve -= n;
  }
  _syncPlayer() {
    const w = this.weapon, p = this.ctx.player;
    const a = this.ammo[w.id];
    p.weapon = { id: w.id, name: w.name, gun: !w.melee, ammo: a ? a.reserve : Infinity, clip: a ? a.clip : Infinity };
    p.setWeaponVisual?.(w.id);
  }
  serialize() {
    return { owned: [...this.owned], ammo: JSON.parse(JSON.stringify(this.ammo)), current: this.current };
  }
  load(d) {
    if (!d) return;
    this.owned = new Set(d.owned || ['fist']);
    this.owned.add('fist');
    if (d.ammo) this.ammo = { pistol: { clip: 0, reserve: 0, ...d.ammo.pistol }, rifle: { clip: 0, reserve: 0, ...d.ammo.rifle } };
    this.current = 0;
    this.select(d.current || 0);
    this._syncPlayer();
  }

  // ─── Mise à jour ───
  update(dt) {
    const { input, player, game, hud } = this.ctx;
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.lockTimer = Math.max(0, this.lockTimer - dt);
    if (this.lockTimer <= 0) this.lockTarget = null;
    this._updatePickups(dt);
    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) { this._reloadNow(this.weapon.id); this._syncPlayer(); }
    }
    if (this.meleePending >= 0) {
      this.meleePending -= dt;
      if (this.meleePending < 0) this._meleeHit();
    }
    const canAct = player.state === 'alive' && !player.vehicle && player.controlsEnabled;
    if (canAct) {
      for (let i = 0; i < 4; i++) if (input.wasPressed(`Digit${i + 1}`)) this.select(i);
      if (input.wheel) this.cycle(Math.sign(input.wheel));
      if (input.wasPressed('WeaponNext', 'KeyQ')) this.cycle(1);
      if (input.wasPressed('KeyR')) this._startReload();
      const w = this.weapon;
      const firing = w.auto ? input.isDown('Mouse0') : input.wasPressed('Mouse0');
      if (firing && this.cooldown <= 0) this._fire();
    }
    // marqueur de cible verrouillée
    hud.showLock(this.lockTarget && this.lockTarget.state !== 'dead' ? this.lockTarget.pos : null);
    hud.showCrosshair(canAct && player.aimMode && !this.weapon.melee);
  }

  _startReload() {
    const w = this.weapon, a = this.ammo[w.id];
    if (!a || this.reloading > 0 || a.clip >= w.clip || a.reserve <= 0) return;
    this.reloading = 1.3;
  }

  /** Cherche la cible la plus proche devant le joueur (verrouillage automatique). */
  _findTarget(range, coneCos) {
    const { player, game, map } = this.ctx;
    const peds = game.traffic?.peds || [];
    const fwd = player.getCameraForward(this._d);
    const wanted = player.stats.wanted;
    let best = null, bestScore = Infinity;
    const eye = this._o.set(player.position.x, player.position.y + 1.5, player.position.z);
    for (const p of peds) {
      if (p.state === 'dead' || p.inCar) continue;
      const dx = p.pos.x - player.position.x, dz = p.pos.z - player.position.z;
      const d = Math.hypot(dx, dz);
      if (d > range || d < 0.3 || Math.abs(p.pos.y - player.position.y) > 4) continue;
      const cos = (dx * fwd.x + dz * fwd.z) / d;
      if (cos < coneCos) continue;
      let score = d * (2 - cos);
      if (p.role === 'cop' && wanted > 0) score *= 0.5;
      if (score >= bestScore) continue;
      if (range > 4 && map.raycast(eye, this._v.set(p.pos.x, p.pos.y + 1.3, p.pos.z), 0) < 0.97) continue;
      best = p; bestScore = score;
    }
    return best;
  }

  _fire() {
    const { player, game, camera, map } = this.ctx;
    const w = this.weapon;
    const fx = game.effects;
    fx.sfx.unlock();
    if (w.melee) {
      this.cooldown = 1 / w.rate;
      const t = this._findTarget(3, 0.35);
      if (t) { player.aimYaw = Math.atan2(t.pos.x - player.position.x, t.pos.z - player.position.z); player.aimHold = 0.35; }
      player.attackTimer = 0.32;
      this.meleePending = 0.12;
      return;
    }
    const a = this.ammo[w.id];
    if (this.reloading > 0) return;
    if (a.clip <= 0) { this._startReload(); this.cooldown = 0.25; return; }
    a.clip--;
    this.cooldown = 1 / w.rate;
    // direction du tir
    const pp = player.position;
    let dir = this._d;
    let target = null;
    if (player.aimMode) {
      // tir au réticule : on vise le point au centre de l'écran
      const camDir = new THREE.Vector3(); camera.getWorldDirection(camDir);
      const hit = this.fireRay(camera.position, camDir, w.range + 10, null);
      const aimPoint = camera.position.clone().addScaledVector(camDir, hit.dist);
      player.aimYaw = player.camYaw + Math.PI;
      const muzzle = this._muzzle();
      dir.copy(aimPoint).sub(muzzle).normalize();
    } else {
      target = this._findTarget(w.range * 0.6, 0.72);
      if (target) {
        this.lockTarget = target; this.lockTimer = 1.2;
        player.aimYaw = Math.atan2(target.pos.x - pp.x, target.pos.z - pp.z);
      } else {
        player.aimYaw = player.camYaw + Math.PI;
      }
      player.aimHold = 0.6;
      const muzzle = this._muzzle();
      if (target) dir.set(target.pos.x - muzzle.x, target.pos.y + 1.25 - muzzle.y, target.pos.z - muzzle.z).normalize();
      else { player.getCameraForward(dir); dir.y = Math.sin(-player.camPitch * 0.5); dir.normalize(); }
    }
    const muzzle = this._muzzle();
    const sp = w.spread * (player.speed > 2 ? 2 : 1);
    dir.x += (Math.random() - 0.5) * sp * 2; dir.y += (Math.random() - 0.5) * sp * 2; dir.z += (Math.random() - 0.5) * sp * 2;
    dir.normalize();
    const hit = this.fireRay(muzzle, dir, w.range, player.vehicle);
    const end = muzzle.clone().addScaledVector(dir, hit.dist);
    fx.muzzle(muzzle);
    fx.tracer(muzzle, end);
    fx.sfx.gunshot(w.id, 0);
    if (hit.ped) {
      game.traffic.damagePed(hit.ped, w.damage, 'player', pp);
      fx.blood(end);
    } else if (hit.vehicle) {
      hit.vehicle.damage(w.damage * 1.6, true);
      fx.sparks(end);
      if (hit.vehicle.police && hit.vehicle.driver) game.police?.reportCrime('assaultCop', hit.vehicle.pos);
    } else if (hit.dist < w.range - 0.5) {
      fx.impact(end);
    }
    const now = performance.now();
    if (now - this.lastCrime > 600) { this.lastCrime = now; game.police?.reportCrime('gunshot', pp); }
    game.traffic?.alertArea(pp, 45);
    if (a.clip === 0 && a.reserve > 0) this._startReload();
    this._syncPlayer();
  }

  _muzzle() {
    const p = this.ctx.player;
    const yaw = p.aimHold > 0 || p.aimMode ? (p.aimYaw ?? p.yaw) : p.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    return new THREE.Vector3(p.position.x + fx * 0.55 - fz * 0.25, p.position.y + 1.42, p.position.z + fz * 0.55 + fx * 0.25);
  }

  _meleeHit() {
    const { player, game } = this.ctx;
    const w = this.weapon;
    const peds = game.traffic?.peds || [];
    const yaw = player.aimHold > 0 ? player.aimYaw : player.yaw;
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    let hitSomething = false;
    for (const p of peds) {
      if (p.state === 'dead' || p.inCar) continue;
      const dx = p.pos.x - player.position.x, dz = p.pos.z - player.position.z, d = Math.hypot(dx, dz);
      if (d > w.range || Math.abs(p.pos.y - player.position.y) > 1.2) continue;
      if ((dx * fx + dz * fz) / (d || 1) < 0.35) continue;
      game.traffic.damagePed(p, w.damage, 'player', player.position);
      p.pos.x += fx * 0.4; p.pos.z += fz * 0.4;
      hitSomething = true;
      break;
    }
    if (!hitSomething && w.id === 'bat') {
      for (const v of game.vehicles?.vehicles || []) {
        if (v.pos.distanceTo(player.position) < v.radius + 1.2) { v.damage(30, true); game.effects.sparks(v.pos.clone().setY(v.pos.y + 0.8)); hitSomething = true; break; }
      }
    }
    if (hitSomething) game.effects.sfx.punch();
  }

  /**
   * Lancer de rayon de tir : murs, piétons, véhicules (et le joueur pour les tirs de la police).
   * Retourne { dist, ped, vehicle, player }.
   */
  fireRay(origin, dir, range, ignoreVehicle = null, includePlayer = false) {
    const { map, game, player } = this.ctx;
    const res = { dist: map.raycastDist(origin, dir, range), ped: null, vehicle: null, player: false };
    const capsule = (px, py, pz, r) => {
      const h2 = dir.x * dir.x + dir.z * dir.z;
      if (h2 < 1e-6) return null;
      const t = ((px - origin.x) * dir.x + (pz - origin.z) * dir.z) / h2;
      if (t < 0 || t > res.dist) return null;
      const cx = origin.x + dir.x * t - px, cz = origin.z + dir.z * t - pz;
      const d2 = cx * cx + cz * cz;
      if (d2 > r * r) return null;
      const y = origin.y + dir.y * t;
      if (y < py - 0.05 || y > py + 1.9) return null;
      return Math.max(0, t - Math.sqrt(r * r - d2) / Math.sqrt(h2));
    };
    for (const p of game.traffic?.peds || []) {
      if (p.state === 'dead' || p.inCar) continue;
      const t = capsule(p.pos.x, p.pos.y, p.pos.z, 0.42);
      if (t !== null && t < res.dist) { res.dist = t; res.ped = p; res.vehicle = null; }
    }
    if (includePlayer && !player.vehicle) {
      const t = capsule(player.position.x, player.position.y, player.position.z, 0.45);
      if (t !== null && t < res.dist) { res.dist = t; res.player = true; res.ped = null; res.vehicle = null; }
    }
    for (const v of game.vehicles?.vehicles || []) {
      if (v === ignoreVehicle) continue;
      const dx = origin.x - v.pos.x, dz = origin.z - v.pos.z;
      if (dx * dx + dz * dz > (res.dist + 6) * (res.dist + 6)) continue;
      const c = Math.cos(v.yaw), s = Math.sin(v.yaw);
      const ox = c * dx - s * dz, oz = s * dx + c * dz, oy = origin.y - v.pos.y;
      const ddx = c * dir.x - s * dir.z, ddz = s * dir.x + c * dir.z, ddy = dir.y;
      const hx = v.t.wid / 2, hz = v.t.len / 2;
      let tmin = 0, tmax = res.dist;
      const slab = (o, d, lo, hi) => {
        if (Math.abs(d) < 1e-8) return o >= lo && o <= hi;
        let t1 = (lo - o) / d, t2 = (hi - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        return tmin <= tmax;
      };
      if (slab(ox, ddx, -hx, hx) && slab(oz, ddz, -hz, hz) && slab(oy, ddy, 0.25, v.t.hgt)) {
        if (tmin < res.dist) {
          res.dist = tmin; res.vehicle = v; res.ped = null;
          if (player.vehicle === v && includePlayer) res.player = true; else res.player = false;
        }
      }
    }
    return res;
  }

  /** Tir d'un PNJ (policier) vers le joueur. accuracy : probabilité de toucher. */
  npcFire(from, { damage = 7, accuracy = 0.4, kind = 'pistol' } = {}) {
    const { player, game } = this.ctx;
    const fx = game.effects;
    const target = player.vehicle ? player.vehicle.pos.clone().setY(player.vehicle.pos.y + 0.9) : player.position.clone().setY(player.position.y + 1.2);
    const miss = Math.random() > accuracy;
    if (miss) { target.x += (Math.random() - 0.5) * 3; target.y += (Math.random() - 0.3) * 1.5; target.z += (Math.random() - 0.5) * 3; }
    const dir = target.clone().sub(from);
    const len = dir.length();
    dir.divideScalar(len || 1);
    const hit = this.fireRay(from, dir, len + 2, null, true);
    const end = from.clone().addScaledVector(dir, hit.dist);
    fx.muzzle(from);
    fx.tracer(from, end);
    fx.sfx.gunshot(kind, from.distanceTo(this.ctx.camera.position));
    if (hit.player && !miss) {
      if (player.vehicle) player.vehicle.damage(damage * 4, false);
      else { player.damage(damage); fx.blood(end); this.ctx.hud.flashDamage(); }
    } else if (hit.ped) {
      game.traffic.damagePed(hit.ped, damage, 'police', from);
    } else if (hit.vehicle) {
      hit.vehicle.damage(damage * 3, false); fx.sparks(end);
    } else fx.impact(end);
  }

  // ─── Objets à ramasser ───
  _initPickupModels() {
    this.pickupGeo = {
      money: new THREE.BoxGeometry(0.5, 0.06, 0.26),
      weapon: new THREE.BoxGeometry(0.7, 0.18, 0.18),
      box: new THREE.BoxGeometry(0.42, 0.42, 0.42),
      ring: new THREE.TorusGeometry(0.55, 0.05, 6, 24),
    };
    this.pickupMats = {};
    for (const [k, v] of Object.entries(PICKUPS)) this.pickupMats[k] = new THREE.MeshBasicMaterial({ color: v.color });
  }

  spawnPickup(type, pos, amount = 0, opts = {}) {
    const g = new THREE.Group();
    const geo = type === 'money' ? this.pickupGeo.money : ['bat', 'pistol', 'rifle'].includes(type) ? this.pickupGeo.weapon : this.pickupGeo.box;
    const m = new THREE.Mesh(geo, this.pickupMats[type]);
    m.position.y = 0.7;
    const ring = new THREE.Mesh(this.pickupGeo.ring, this.pickupMats[type]);
    ring.rotation.x = Math.PI / 2; ring.position.y = 0.08;
    g.add(m, ring);
    const y = this.ctx.map.getSurfaceHeight(pos.x, pos.z, (pos.y ?? 0) + 1);
    g.position.set(pos.x, y, pos.z);
    this.ctx.scene.add(g);
    const pk = { type, amount, group: g, mesh: m, home: opts.respawn ? { x: pos.x, z: pos.z } : null, respawn: opts.respawn || 0, timer: 0, life: opts.respawn ? Infinity : 90 };
    this.pickups.push(pk);
    return pk;
  }

  _placeWorldPickups() {
    const map = this.ctx.map;
    const list = [
      ['bat', -150, 285, 0], ['pistol', -120, -600, 24], ['rifle', -558, -40, 60], ['pistol-ammo', 784, -10, 24],
      ['health', 560, -800, 0], ['armor', map.museum ? map.museum.x : -30, map.museum ? map.museum.z - 34 : 900, 0],
      ['health', 30, -872, 0], ['rifle-ammo', 600, 455, 60], ['bat', 454, 404, 0],
    ];
    for (const [type, x, z, n] of list) this.spawnPickup(type, { x, z }, n, { respawn: 120 });
  }

  _collect(pk) {
    const { player, hud } = this.ctx;
    const t = pk.type;
    if (t === 'money') player.addMoney(pk.amount);
    else if (t === 'health') { if (player.stats.health >= player.stats.maxHealth) return false; player.heal(); }
    else if (t === 'armor') { if (player.stats.armor >= player.stats.maxArmor) return false; player.stats.armor = player.stats.maxArmor; }
    else if (t === 'pistol-ammo') { if (!this.owned.has('pistol')) this.owned.add('pistol'); this.addAmmo('pistol', pk.amount || 12); }
    else if (t === 'rifle-ammo') { if (!this.owned.has('rifle')) return false; this.addAmmo('rifle', pk.amount || 30); }
    else this.give(t, pk.amount || 0);
    hud.toast(`<b>${PICKUPS[t].label(pk.amount)}</b>`, 2);
    this.ctx.game.effects.sfx.punch();
    return true;
  }

  _updatePickups(dt) {
    const { player } = this.ctx;
    const time = performance.now() * 0.001;
    for (const pk of [...this.pickups]) {
      if (pk.timer > 0) {
        pk.timer -= dt;
        if (pk.timer <= 0) pk.group.visible = true;
        continue;
      }
      pk.mesh.rotation.y = time * 2;
      pk.mesh.position.y = 0.7 + Math.sin(time * 3) * 0.12;
      pk.life -= dt;
      if (pk.life <= 0) { this.ctx.scene.remove(pk.group); this.pickups.splice(this.pickups.indexOf(pk), 1); continue; }
      if (player.state !== 'alive' || player.vehicle) continue;
      const d = Math.hypot(pk.group.position.x - player.position.x, pk.group.position.z - player.position.z);
      if (d < 1.3 && Math.abs(pk.group.position.y - player.position.y) < 2 && this._collect(pk)) {
        if (pk.respawn) { pk.timer = pk.respawn; pk.group.visible = false; }
        else { this.ctx.scene.remove(pk.group); this.pickups.splice(this.pickups.indexOf(pk), 1); }
      }
    }
  }

  setVisible(on) { for (const pk of this.pickups) pk.group.visible = on && pk.timer <= 0; }
}
