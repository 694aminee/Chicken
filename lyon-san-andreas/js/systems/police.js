/**
 * police.js — Indice de recherche (0 à 5 étoiles) et comportement de la police.
 *
 *  - Les délits font monter une « chaleur » ; les étoiles dépendent de cette chaleur.
 *    Un délit commis sous les yeux d'un policier compte beaucoup plus.
 *  - 1 ★ : les policiers essaient de vous arrêter (ARRÊTÉ si l'un d'eux vous attrape)
 *  - 2 ★ et plus : ils tirent ; plus de voitures en poursuite
 *  - 4-5 ★ : barrages sur les ponts du Rhône et de la Saône
 *  - Semer la police : rester hors de vue (les étoiles clignotent), puis elles disparaissent
 */
import * as THREE from 'three';

const THRESHOLDS = [0, 30, 150, 400, 800, 1400];
const CRIMES = {
  gunshot: { seen: 25, unseen: 6 },
  assault: { seen: 30, unseen: 6 },
  murder: { seen: 140, unseen: 45 },
  hitPedestrian: { seen: 90, unseen: 30 },
  carjack: { seen: 45, unseen: 0 },
  stealPolice: { seen: 80, unseen: 40 },
  assaultCop: { seen: 160, unseen: 160, min: 1 },
  killCop: { seen: 320, unseen: 260, min: 2 },
  explosion: { seen: 90, unseen: 40 },
};
const COP_COLORS = { skin: '#d9a066', shirt: '#22345e', pants: '#151b2b' };
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);

export class PoliceSystem {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.heat = 0;
    this.unseen = 0;
    this.searching = false;
    this.units = [];        // { vehicle, cops:[], deployed }
    this.cops = [];         // policiers à pied (Ped)
    this.roadblocks = [];   // { bridge, vehicles, cops }
    this.spawnTimer = 0;
    this.seenTimer = 0;
    this.seen = false;
    this.roadblockTimer = 0;
    this.arrest = 0;
    this._v = new THREE.Vector3();
  }

  get wanted() { return this.ctx.player.stats.wanted; }

  setWanted(level) {
    this.ctx.player.stats.wanted = clamp(Math.round(level), 0, 5);
    if (level <= 0) { this.heat = 0; this.unseen = 0; this.searching = false; }
    else if (this.heat < THRESHOLDS[level]) this.heat = THRESHOLDS[level];
  }

  /** Un policier (à pied ou en voiture) voit-il la position pos ? */
  _witnessed(pos, radius = 55) {
    const game = this.ctx.game;
    for (const c of this.cops) if (c.state !== 'dead' && c.pos.distanceTo(pos) < radius) return true;
    for (const v of game.vehicles.vehicles) if (v.police && (v.driver === 'ai' || v.driver === 'police') && v.pos.distanceTo(pos) < radius) return true;
    return false;
  }

  /** Signale un délit commis par le joueur. */
  reportCrime(type, pos) {
    const c = CRIMES[type];
    if (!c || this.ctx.game.interiors?.current) return;
    const seen = this._witnessed(pos || this.ctx.player.position);
    const add = seen ? c.seen : c.unseen;
    if (add <= 0) return;
    const before = this.wanted;
    this.heat = Math.min(2000, this.heat + add);
    let lvl = 0;
    for (let i = 1; i < THRESHOLDS.length; i++) if (this.heat >= THRESHOLDS[i]) lvl = i;
    if (c.min) lvl = Math.max(lvl, c.min);
    lvl = Math.max(lvl, before);
    if (lvl !== before) this.ctx.player.stats.wanted = lvl;
    if (lvl > 0) { this.unseen = 0; this.searching = false; }
  }

  // ─── Apparition des unités ───
  _spawnCar(pos, yaw, pursuing = true) {
    const v = this.ctx.game.vehicles.spawn('police', pos.x, pos.z, yaw, { driver: 'police' });
    v.siren = pursuing;
    const unit = { vehicle: v, cops: [], deployed: false, reverse: 0, stuck: 0 };
    v.ai = (dt) => this._pursue(unit, dt);
    v.onRemove = () => { const i = this.units.indexOf(unit); if (i >= 0) this.units.splice(i, 1); };
    this.units.push(unit);
    return unit;
  }

  _spawnCop(pos, yaw = 0) {
    const traffic = this.ctx.game.traffic;
    const p = traffic.spawnPed({ pos, yaw, role: 'cop', colors: { ...COP_COLORS }, health: 60, state: 'idle' });
    p.brain = (dt) => this._copBrain(p, dt);
    p.shootTimer = 0.8 + Math.random();
    p.onDeath = () => { p.brain = null; };
    this.cops.push(p);
    return p;
  }

  /** Une voiture de police volée : ses policiers sortent. */
  ejectCops(v, pos) {
    const cop = this._spawnCop(pos, v.yaw);
    cop.state = 'idle';
    const unit = this.units.find((u) => u.vehicle === v);
    if (unit) { this.units.splice(this.units.indexOf(unit), 1); }
    v.siren = false;
    return cop;
  }

  _deploy(unit) {
    const v = unit.vehicle;
    unit.deployed = true;
    const r = v.right;
    for (const side of [-1, 1]) {
      const pos = new THREE.Vector3(v.pos.x + r.x * side * (v.t.wid / 2 + 0.9), v.pos.y, v.pos.z + r.z * side * (v.t.wid / 2 + 0.9));
      if (this.ctx.map._pointBlocked(pos.x, pos.y + 1, pos.z, 0.25)) continue;
      unit.cops.push(this._spawnCop(pos, v.yaw));
    }
    v.controls.throttle = 0; v.controls.brake = true;
  }

  _spawnRoadblock() {
    const { map, player, game } = this.ctx;
    const pp = player.position;
    const used = new Set(this.roadblocks.map((r) => r.bridge));
    let best = null, bestD = 500;
    for (const b of map.bridges) {
      if (used.has(b)) continue;
      const d = Math.hypot((b.x0 + b.x1) / 2 - pp.x, b.z - pp.z);
      if (d < bestD && d > 70) { best = b; bestD = d; }
    }
    if (!best) return;
    // bout du pont le plus proche du joueur
    const end = Math.abs(pp.x - best.x0) < Math.abs(pp.x - best.x1) ? best.x0 + 5 : best.x1 - 5;
    const vehicles = [];
    for (const dz of [-3.6, 3.6]) {
      const v = game.vehicles.spawn('police', end, best.z + dz, 0, { driver: null });
      v.siren = true; v.persistent = true;
      vehicles.push(v);
    }
    const cops = [this._spawnCop(new THREE.Vector3(end + (pp.x < end ? 3 : -3), best.top, best.z), 0)];
    this.roadblocks.push({ bridge: best, vehicles, cops });
    this.ctx.hud.toast('🚨 Barrage de police sur le <b>' + best.name + '</b>', 3);
  }

  _clearRoadblocks(force = false) {
    const vm = this.ctx.game.vehicles;
    const pp = this.ctx.player.position;
    for (const rb of [...this.roadblocks]) {
      const d = Math.hypot((rb.bridge.x0 + rb.bridge.x1) / 2 - pp.x, rb.bridge.z - pp.z);
      if (force || d > 260 || this.wanted < 4) {
        if (d < 120 && !force) continue;
        for (const v of rb.vehicles) if (vm.vehicles.includes(v) && v !== this.ctx.player.vehicle) vm.remove(v);
        this.roadblocks.splice(this.roadblocks.indexOf(rb), 1);
      }
    }
  }

  // ─── IA ───
  _pursue(unit, dt) {
    const v = unit.vehicle, c = v.controls, { player } = this.ctx;
    if (this.wanted === 0) { // fin de poursuite : la voiture s'arrête puis disparaît
      v.siren = false;
      c.throttle = 0; c.brake = true; c.steer = 0;
      return;
    }
    v.siren = true;
    const target = player.vehicle ? player.vehicle.pos : player.position;
    const dx = target.x - v.pos.x, dz = target.z - v.pos.z, d = Math.hypot(dx, dz);
    const f = v.forward, rt = v.right;
    const ang = Math.atan2(dx * rt.x + dz * rt.z, dx * f.x + dz * f.z);
    if (unit.reverse > 0) {
      unit.reverse -= dt;
      c.throttle = -0.8; c.steer = -clamp(ang * 2, -1, 1); c.brake = false;
      return;
    }
    const playerSlow = !player.vehicle || Math.abs(player.vehicle.speed) < 3;
    if (d < 13 && playerSlow) {
      c.throttle = 0; c.brake = true; c.steer = 0;
      if (!unit.deployed && Math.abs(v.speed) < 2) this._deploy(unit);
      return;
    }
    if (unit.deployed && d > 40) unit.deployed = unit.cops.some((p) => p.state !== 'dead' && p.pos.distanceTo(v.pos) < 60);
    if (unit.deployed && playerSlow) { c.throttle = 0; c.brake = true; return; }
    c.steer = clamp(ang * 2.2, -1, 1);
    const desired = d > 40 ? v.t.maxSpeed * 0.9 : clamp(d * 0.7, 4, v.t.maxSpeed);
    c.throttle = Math.abs(ang) > 2.2 && d < 25 ? -0.6 : clamp((desired - v.speed) * 0.3, -1, 1);
    c.brake = Math.abs(ang) > 1.2 && v.speed > 14;
    if (c.throttle > 0.5 && Math.abs(v.speed) < 0.8) unit.stuck += dt; else unit.stuck = Math.max(0, unit.stuck - dt);
    if (unit.stuck > 1.8) { unit.stuck = 0; unit.reverse = 1.3; }
  }

  _copBrain(p, dt) {
    const { player, map, game } = this.ctx;
    const wanted = this.wanted;
    const target = player.vehicle ? player.vehicle.pos : player.position;
    const dx = target.x - p.pos.x, dz = target.z - p.pos.z, d = Math.hypot(dx, dz);
    p.aim = false;
    if (wanted === 0 || player.state !== 'alive') {
      // patrouille calme : reste sur place
      p.moveSpeed = 0; p.faceYaw = null;
      return;
    }
    const toYaw = Math.atan2(dx, dz);
    const run = (speed) => { p.moveDir.set(dx / (d || 1), 0, dz / (d || 1)); p.moveSpeed = speed; p.faceYaw = toYaw; };
    if (wanted === 1) {
      if (!player.vehicle) {
        if (d > 1.2) run(d > 6 ? 5.2 : 3.2); else { p.moveSpeed = 0; p.faceYaw = toYaw; }
        if (d < 1.6) {
          this.arrest += dt;
          if (this.arrest > 1.3) { this.arrest = 0; game.gameOver('busted'); }
        }
      } else run(5);
      return;
    }
    // 2 étoiles et plus : on tire
    p.shootTimer -= dt;
    const range = 38;
    if (d > 16) run(5.4);
    else if (d < 5) { p.moveDir.set(-dx / (d || 1), 0, -dz / (d || 1)); p.moveSpeed = 2; p.faceYaw = toYaw; }
    else { p.moveSpeed = 0; p.faceYaw = toYaw; }
    if (d < range) {
      p.aim = true;
      if (p.shootTimer <= 0) {
        p.shootTimer = (wanted >= 4 ? 0.55 : 0.95) + Math.random() * 0.6;
        const from = this._v.set(p.pos.x + Math.sin(p.yaw) * 0.5, p.pos.y + 1.45, p.pos.z + Math.cos(p.yaw) * 0.5).clone();
        const eye = from.clone();
        const tgt = new THREE.Vector3(target.x, target.y + 1.2, target.z);
        if (map.raycast(eye, tgt, 0) > 0.96) {
          let acc = clamp(0.62 - d * 0.012, 0.15, 0.6);
          if (player.sprinting) acc *= 0.6;
          game.weapons.npcFire(from, { damage: wanted >= 4 ? 9 : 7, accuracy: acc, kind: wanted >= 4 ? 'rifle' : 'pistol' });
        }
      }
    }
  }

  // ─── Mise à jour ───
  update(dt) {
    const { player, game, hud } = this.ctx;
    if (game.interiors?.current) return;
    this.cops = this.cops.filter((c) => !c.removed);
    const wanted = this.wanted;
    const pp = player.position;

    // vu ou pas vu ?
    this.seenTimer -= dt;
    if (this.seenTimer <= 0) {
      this.seenTimer = 0.4;
      this.seen = false;
      if (wanted > 0) {
        const eye = new THREE.Vector3(pp.x, pp.y + 1.5, pp.z);
        const watchers = [
          ...this.cops.filter((c) => c.state !== 'dead').map((c) => c.pos),
          ...game.vehicles.vehicles.filter((v) => v.police && v.driver && v.state !== 'wreck').map((v) => v.pos),
        ];
        for (const w of watchers) {
          const d = w.distanceTo(pp);
          if (d > 85) continue;
          if (d < 18 || game.map.raycast(new THREE.Vector3(w.x, w.y + 1.4, w.z), eye, 0) > 0.97) { this.seen = true; break; }
        }
      }
    }
    if (wanted > 0) {
      if (this.seen) { this.unseen = 0; this.searching = false; }
      else {
        this.unseen += dt;
        this.searching = this.unseen > 1.5;
        if (this.unseen > 9 + wanted * 4) {
          this.setWanted(0);
          hud.toast('Vous avez semé la police 😎', 3);
        }
      }
    } else { this.searching = false; this.arrest = 0; }
    hud.setWantedSearching(this.searching && wanted > 0);
    this.arrest = Math.max(0, this.arrest - dt * 0.5);

    // voitures en poursuite
    this.units = this.units.filter((u) => game.vehicles.vehicles.includes(u.vehicle));
    const active = this.units.filter((u) => u.vehicle.state !== 'wreck');
    const desired = wanted === 0 ? 0 : Math.min(6, wanted + (wanted >= 3 ? 1 : 0));
    this.spawnTimer -= dt;
    if (active.length < desired && this.spawnTimer <= 0) {
      this.spawnTimer = 3;
      const spot = game.traffic.randomRoadPoint(90, 190, { hidden: true });
      if (spot) {
        const yaw = Math.atan2(pp.x - spot.pos.x, pp.z - spot.pos.z);
        this._spawnCar(spot.pos, yaw);
      }
    }
    // nettoyage : unités loin ou inutiles
    for (const u of [...this.units]) {
      const d = u.vehicle.pos.distanceTo(pp);
      if (d > 320 || (wanted === 0 && d > 90) || (u.vehicle.state === 'wreck' && d > 120)) {
        if (u.vehicle !== player.vehicle) game.vehicles.remove(u.vehicle);
      }
    }
    for (const c of [...this.cops]) {
      const d = c.pos.distanceTo(pp);
      if (d > 220 || (wanted === 0 && d > 70) || (c.state === 'dead' && (c.deadTimer > 30 || d > 110))) {
        game.traffic.removePed(c);
        c.removed = true;
      }
    }
    // barrages
    this.roadblockTimer -= dt;
    if (wanted >= 4 && this.roadblockTimer <= 0) {
      this.roadblockTimer = 18;
      if (this.roadblocks.length < (wanted >= 5 ? 2 : 1)) this._spawnRoadblock();
    }
    this._clearRoadblocks(false);

    // sirène
    let nearest = Infinity;
    for (const u of this.units) if (u.vehicle.siren) nearest = Math.min(nearest, u.vehicle.pos.distanceTo(this.ctx.camera.position));
    game.effects.sfx.setSiren(nearest < 200, nearest);
  }

  /** Après une mort / arrestation : tout le monde rentre au poste. */
  reset() {
    this.setWanted(0);
    const { game } = this.ctx;
    for (const u of [...this.units]) if (u.vehicle !== this.ctx.player.vehicle) game.vehicles.remove(u.vehicle);
    for (const c of this.cops) { game.traffic.removePed(c); c.removed = true; }
    this.cops = [];
    this._clearRoadblocks(true);
    game.effects.sfx.setSiren(false);
  }

  /** Points pour le radar. */
  blips() {
    if (this.wanted === 0) return [];
    const out = [];
    for (const u of this.units) if (u.vehicle.state !== 'wreck') out.push({ x: u.vehicle.pos.x, z: u.vehicle.pos.z, color: 'police', size: 5 });
    for (const c of this.cops) if (c.state !== 'dead') out.push({ x: c.pos.x, z: c.pos.z, color: 'police', size: 3.5 });
    return out;
  }
}
