/**
 * vehicles.js — Voitures, motos, scooters et véhicules de police.
 *
 *  - Monter / descendre : E ou F (voler la voiture si un conducteur est dedans)
 *  - Conduite : ZQSD / flèches (ou joystick), frein à main Espace, cabrer (moto) Maj
 *  - Physique arcade : pentes, ponts, tremplins (sauts), dérapages, collisions
 *  - Dégâts progressifs → fumée → feu → explosion
 *  - Garage de la planque : garer un véhicule et le récupérer plus tard
 */
import * as THREE from 'three';
import { WATER_LEVEL, GeoBuilder } from '../world/mapLyon.js';

export const VEHICLE_TYPES = {
  citadine: { name: 'Citadine', kind: 'car', len: 3.8, wid: 1.7, hgt: 1.5, maxSpeed: 34, accel: 9, brake: 20, steer: 2.2, grip: 7, hp: 900, camDist: 7 },
  berline: { name: 'Berline sport', kind: 'car', len: 4.6, wid: 1.86, hgt: 1.36, maxSpeed: 52, accel: 14, brake: 24, steer: 1.95, grip: 8, hp: 1000, camDist: 7.5 },
  police: { name: 'Voiture de police', kind: 'car', len: 4.6, wid: 1.86, hgt: 1.5, maxSpeed: 50, accel: 13, brake: 24, steer: 2.05, grip: 8, hp: 1300, camDist: 7.5, police: true },
  moto: { name: 'Moto sportive', kind: 'bike', len: 2.1, wid: 0.7, hgt: 1.15, maxSpeed: 56, accel: 16, brake: 22, steer: 2.6, grip: 9, hp: 500, camDist: 5 },
  scooter: { name: 'Scooter', kind: 'bike', len: 1.8, wid: 0.65, hgt: 1.1, maxSpeed: 27, accel: 9, brake: 16, steer: 2.8, grip: 9, hp: 400, camDist: 4.6 },
};
const PAINTS = ['#c62828', '#1565c0', '#f9a825', '#2e7d32', '#212121', '#eeeeee', '#6a1b9a', '#ef6c00', '#455a64', '#8d6e63', '#00838f', '#ad1457', '#9e9e9e', '#0d47a1'];
const GRAVITY = 22;

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));

// ───────────────────────────── Modèles 3D ─────────────────────────────
const geoCache = {};
function vehicleGeometries(type) {
  if (geoCache[type]) return geoCache[type];
  const t = VEHICLE_TYPES[type];
  const paint = new GeoBuilder(), det = new GeoBuilder(), lights = new GeoBuilder();
  const W = t.wid, L = t.len, H = t.hgt, white = new THREE.Color('#ffffff');
  const C = (h) => new THREE.Color(h);
  if (t.kind === 'car') {
    const cabLen = type === 'citadine' ? L * 0.3 : L * 0.25, cabZ = type === 'citadine' ? -L * 0.05 : -L * 0.06;
    paint.obox(0, 0, W / 2, L / 2, 0.32, 0.92, 0, white);
    paint.obox(0, cabZ, W / 2 - 0.12, cabLen, 0.92, H, 0, white);
    det.obox(0, cabZ, W / 2 - 0.08, cabLen + 0.04, 0.97, H - 0.08, 0, C('#1b2530'));
    for (const s of [-1, 1]) det.obox(0, s * (L / 2 + 0.03), W / 2 - 0.04, 0.07, 0.3, 0.55, 0, C('#2a2a2a'));
    det.obox(0, L / 2 + 0.04, W / 2 - 0.45, 0.03, 0.55, 0.8, 0, C('#151515'));
    for (const s of [-1, 1]) det.obox(s * (W / 2 + 0.02), L / 2 - 0.75, 0.04, 0.45, 0.3, 0.62, 0, C('#1a1a1a'));
    for (const s of [-1, 1]) det.obox(s * (W / 2 + 0.02), -L / 2 + 0.75, 0.04, 0.45, 0.3, 0.62, 0, C('#1a1a1a'));
    for (const s of [-1, 1]) det.obox(s * (W / 2 + 0.06), cabZ + cabLen - 0.1, 0.06, 0.06, 0.95, 1.05, 0, C('#222'));
    if (t.police) {
      for (const s of [-1, 1]) det.obox(s * (W / 2 + 0.005), 0, 0.01, L / 2 - 0.2, 0.55, 0.72, 0, C('#1f4fbf'));
      det.obox(0, cabZ, 0.55, 0.16, H, H + 0.06, 0, C('#222'));
    }
    for (const s of [-1, 1]) {
      lights.obox(s * (W / 2 - 0.3), L / 2 + 0.03, 0.2, 0.03, 0.62, 0.8, 0, C('#fff6cc'));
      lights.obox(s * (W / 2 - 0.25), -L / 2 - 0.03, 0.2, 0.03, 0.62, 0.8, 0, C('#d8102a'));
    }
  } else {
    const sc = type === 'scooter';
    paint.obox(0, sc ? 0.25 : 0.12, 0.17, sc ? 0.3 : 0.5, sc ? 0.4 : 0.55, sc ? 0.75 : 0.88, 0, white);
    paint.obox(0, -0.5, 0.13, 0.34, 0.6, sc ? 0.8 : 0.86, 0, white);
    paint.obox(0, sc ? 0.62 : 0.66, 0.2, 0.14, sc ? 0.35 : 0.62, sc ? 1.05 : 1.02, 0, white);
    if (sc) det.obox(0, 0.05, 0.16, 0.35, 0.33, 0.4, 0, C('#2a2a2a'));
    det.obox(0, -0.25, 0.16, 0.36, sc ? 0.8 : 0.86, sc ? 0.9 : 0.94, 0, C('#141414'));
    det.obox(0, 0.76, 0.04, 0.04, 0.3, 1.02, 0, C('#9aa0a6'));
    det.obox(0, 0.74, 0.36, 0.03, 1.02, 1.06, 0, C('#1d1d1d'));
    if (!sc) det.obox(0, 0, 0.15, 0.28, 0.3, 0.55, 0, C('#5f6368'));
    det.obox(0.17, -0.45, 0.05, 0.3, 0.35, 0.45, 0, C('#8d9196'));
    lights.obox(0, sc ? 0.77 : 0.81, 0.08, 0.02, 0.82, 0.94, 0, C('#fff6cc'));
    lights.obox(0, -0.86, 0.07, 0.02, 0.74, 0.82, 0, C('#d8102a'));
  }
  geoCache[type] = { paint: paint.build(), details: det.build(), lights: lights.build() };
  return geoCache[type];
}

function wheelLayout(t) {
  if (t.kind === 'bike') return [{ x: 0, z: 0.72, r: 0.32, w: 0.12, front: true }, { x: 0, z: -0.72, r: 0.32, w: 0.14, front: false }];
  const r = 0.34, x = t.wid / 2 - 0.06, z = t.len / 2 - 0.75;
  return [{ x, z, r, w: 0.24, front: true }, { x: -x, z, r, w: 0.24, front: true }, { x, z: -z, r, w: 0.24, front: false }, { x: -x, z: -z, r, w: 0.24, front: false }];
}

// ───────────────────────────── Véhicule ─────────────────────────────
export class Vehicle {
  constructor(manager, type, x, z, yaw = 0, opts = {}) {
    this.manager = manager;
    this.type = type;
    this.t = VEHICLE_TYPES[type];
    this.isBike = this.t.kind === 'bike';
    this.police = !!this.t.police;
    this.pos = new THREE.Vector3(x, manager.map.getSurfaceHeight(x, z, Math.max(0, manager.map.getGroundHeight(x, z)) + 1), z);
    this.yaw = yaw;
    this.speed = 0; this.lat = 0; this.vy = 0; this.vyEst = 0;
    this.onGround = true;
    this.pitch = 0; this.roll = 0; this.lean = 0; this.wheelie = 0;
    this.steerAngle = 0; this.wheelSpin = 0;
    this.hp = this.t.hp;
    this.state = 'ok';          // ok | burning | wreck
    this.burnTimer = 0;
    this.controls = { throttle: 0, steer: 0, brake: false, wheelie: false };
    this.driver = opts.driver || null; // null | 'player' | 'ai' | 'police'
    this.ai = null;            // fonction (dt) qui remplit this.controls
    this.persistent = !!opts.persistent;
    this.siren = false;
    this.color = opts.color || (this.police ? '#f4f4f4' : PAINTS[Math.floor(Math.random() * PAINTS.length)]);
    this.wreckTimer = 0;
    this.lastHitByPlayer = 0;
    this.stuckTimer = 0;

    const g = vehicleGeometries(type);
    this.group = new THREE.Group();
    this.pivot = new THREE.Group();
    this.body = new THREE.Group();
    const pz = this.isBike ? -0.72 : 0, py = 0.33;
    this.pivot.position.set(0, py, pz);
    this.body.position.set(0, -py, -pz);
    this.group.add(this.pivot); this.pivot.add(this.body);
    this.paintMat = new THREE.MeshLambertMaterial({ color: this.color });
    const paint = new THREE.Mesh(g.paint, this.paintMat);
    paint.castShadow = true;
    const det = new THREE.Mesh(g.details, manager.detailMat);
    det.castShadow = true;
    const lights = new THREE.Mesh(g.lights, manager.lightMat);
    this.body.add(paint, det, lights);
    if (this.police) {
      const H = this.t.hgt;
      const r = new THREE.Mesh(manager.sirenGeo, manager.sirenRed); r.position.set(0.27, H + 0.13, -this.t.len * 0.06);
      const b = new THREE.Mesh(manager.sirenGeo, manager.sirenBlue); b.position.set(-0.27, H + 0.13, -this.t.len * 0.06);
      this.body.add(r, b);
    }
    // siège (la moto porte le joueur)
    this.seat = new THREE.Group();
    this.seat.position.set(0, this.isBike ? 0.42 : 0.4, this.isBike ? -0.25 : 0);
    this.body.add(this.seat);
    this.wheels = wheelLayout(this.t);
    this._syncGroup();
    manager.scene.add(this.group);
  }

  get forward() { return new THREE.Vector3(Math.sin(this.yaw), 0, Math.cos(this.yaw)); }
  get right() { return new THREE.Vector3(-Math.cos(this.yaw), 0, Math.sin(this.yaw)); }
  get radius() { return this.isBike ? 0.9 : this.t.len / 2; }
  get alive() { return this.state !== 'wreck'; }

  damage(amount, byPlayer = false) {
    if (this.state === 'wreck' || amount <= 0) return;
    this.hp -= amount;
    if (byPlayer) this.lastHitByPlayer = performance.now();
    if (this.hp <= 0 && this.state === 'ok') {
      this.state = 'burning';
      this.burnTimer = 4.5;
    }
  }

  _ground(x, z) { return this.manager.map.getSurfaceHeight(x, z, this.pos.y + 0.25); }

  update(dt) {
    const t = this.t, c = this.controls, map = this.manager.map;
    const dead = this.state === 'wreck';
    const throttle = dead ? 0 : clamp(c.throttle, -1, 1);
    const steer = dead ? 0 : clamp(c.steer, -1, 1);
    this.steerAngle = damp(this.steerAngle, steer, 9, dt);
    const sp = this.speed;
    let yawRate = 0;
    if (this.onGround) {
      if (throttle > 0) {
        if (sp < -0.5) this.speed += t.brake * throttle * dt;
        else this.speed += t.accel * throttle * Math.max(0.12, 1 - sp / t.maxSpeed) * dt;
      } else if (throttle < 0) {
        if (sp > 0.5) this.speed += t.brake * throttle * dt;
        else this.speed = Math.max(-t.maxSpeed * 0.3, this.speed + t.accel * 0.6 * throttle * dt);
      } else {
        this.speed -= Math.sign(sp) * Math.min(Math.abs(sp), 2.2 * dt);
      }
      if (c.brake && !dead) this.speed -= Math.sign(this.speed) * Math.min(Math.abs(this.speed), 11 * dt);
      this.speed -= this.speed * 0.06 * dt;
      this.speed -= GRAVITY * Math.sin(this.pitch) * dt * 0.6;
      if (dead) this.speed = damp(this.speed, 0, 1.5, dt);
      const sf = clamp(this.speed / 5, -1, 1);
      yawRate = -t.steer * this.steerAngle * sf * (1 - 0.45 * Math.min(1, Math.abs(this.speed) / t.maxSpeed));
      if (c.brake) yawRate *= 1.4;
      this.yaw += yawRate * dt;
      this.lat += yawRate * this.speed * dt * (c.brake ? 0.5 : 0.16);
      this.lat = damp(this.lat, 0, c.brake ? t.grip * 0.22 : t.grip, dt);
    } else {
      this.speed -= this.speed * 0.02 * dt;
    }
    this.yawRate = yawRate;
    const f = this.forward, r = this.right;
    const vx = f.x * this.speed + r.x * this.lat, vz = f.z * this.speed + r.z * this.lat;
    const p = this.pos;
    p.x += vx * dt; p.z += vz * dt;

    // collisions avec la ville
    this._collideWorld();

    // sol / vol
    const half = this.isBike ? 0.72 : t.len / 2 - 0.7, hw = t.wid / 2 - 0.15;
    const hF = this._ground(p.x + f.x * half, p.z + f.z * half);
    const hB = this._ground(p.x - f.x * half, p.z - f.z * half);
    let groundY = (hF + hB) / 2, roll = 0;
    if (!this.isBike) {
      const hL = this._ground(p.x - r.x * hw, p.z - r.z * hw), hR = this._ground(p.x + r.x * hw, p.z + r.z * hw);
      groundY = Math.max(groundY, (hF + hB + hL + hR) / 4);
      roll = Math.atan2(hL - hR, 2 * hw);
    }
    // marche trop haute (bord d'un tremplin, trottoir élevé) : c'est un mur
    if (this.onGround && groundY - p.y > 0.7) {
      p.x -= vx * dt; p.z -= vz * dt;
      const impact = Math.abs(this.speed);
      if (impact > 6) this.damage((impact - 6) * 18, this.driver === 'player');
      this.speed *= -0.2; this.lat = 0;
      groundY = p.y;
    }
    const targetPitch = Math.atan2(hF - hB, 2 * half);
    if (this.onGround) {
      if (groundY >= p.y - 0.45) {
        const climb = clamp((groundY - p.y) / Math.max(dt, 1e-3), -20, Math.abs(this.speed) * 0.45);
        this.vyEst = damp(this.vyEst, climb, 25, dt);
        p.y = groundY;
        this.pitch = damp(this.pitch, targetPitch, 14, dt);
        this.roll = damp(this.roll, roll, 10, dt);
      } else {
        this.onGround = false;
        this.vy = Math.min(9, Math.max(0, this.vyEst) * 1.7 + 0.5);
      }
    } else {
      this.vy -= GRAVITY * dt;
      p.y += this.vy * dt;
      this.pitch = damp(this.pitch, -0.12, 1.2, dt);
      if (p.y <= groundY) {
        if (this.vy < -11) {
          this.damage((-this.vy - 11) * 45, this.driver === 'player');
          this.manager.fx.shakeAt(p, 0.6);
          this.manager.fx.sfx.crash(0.6);
        }
        p.y = groundY; this.vy = 0; this.onGround = true; this.vyEst = 0;
      }
    }
    // eau
    if (map.isWater(p.x, p.z) && p.y < WATER_LEVEL - 0.3) {
      this.speed = damp(this.speed, 0, 2, dt);
      this.inWater = true;
      p.y = Math.max(p.y, WATER_LEVEL - 1.6);
      if (this.state !== 'wreck') { this.hp -= 250 * dt; if (this.hp <= 0) { this.state = 'wreck'; this._wreckLook(); } }
    } else this.inWater = false;

    // moto : inclinaison + roue arrière
    if (this.isBike) {
      this.lean = damp(this.lean, clamp(-yawRate * Math.abs(this.speed) * 0.09, -0.75, 0.75), 6, dt);
      const wantWheelie = c.wheelie && this.onGround && this.speed > 4 && !dead;
      this.wheelie = damp(this.wheelie, wantWheelie ? 0.55 : 0, wantWheelie ? 3 : 6, dt);
    }
    this.wheelSpin += (this.speed / 0.33) * dt;
    this._syncGroup();

    // état : feu → explosion
    if (this.state === 'burning') {
      this.burnTimer -= dt;
      if (this.burnTimer <= 0) this.manager.explode(this);
    } else if (this.state === 'wreck') {
      this.wreckTimer += dt;
    }
  }

  _collideWorld() {
    const map = this.manager.map, f = this.forward, p = this.pos;
    const circles = this.isBike ? [[0, 0.45]] : [[this.t.len / 2 - this.t.wid / 2, this.t.wid / 2 + 0.05], [-(this.t.len / 2 - this.t.wid / 2), this.t.wid / 2 + 0.05]];
    let px = 0, pz = 0;
    const tmp = this.manager._tmp;
    for (const [off, rad] of circles) {
      tmp.set(p.x + f.x * off, p.y + 0.1, p.z + f.z * off);
      const bx = tmp.x, bz = tmp.z;
      if (map.resolveCircle(tmp, rad, 1.4)) { px += tmp.x - bx; pz += tmp.z - bz; }
    }
    const push = Math.hypot(px, pz);
    if (push > 0.001) {
      p.x += px / circles.length; p.z += pz / circles.length;
      const nx = px / push, nz = pz / push;
      const along = Math.abs(f.x * nx + f.z * nz);
      const impact = Math.abs(this.speed) * along;
      if (impact > 6) {
        this.damage((impact - 6) * 22, this.driver === 'player');
        if (this.driver === 'player') { this.manager.fx.shakeAt(p, Math.min(1, impact / 25)); this.manager.fx.sfx.crash(impact / 25); }
      }
      this.speed *= along > 0.7 ? -0.22 : 1 - 0.6 * along;
      this.lat *= 0.5;
    }
  }

  _syncGroup() {
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.yaw;
    this.pivot.rotation.set(-(this.pitch + this.wheelie), 0, this.isBike ? this.lean : this.roll);
  }

  _wreckLook() {
    this.paintMat.color.set('#1e1c1a');
    this.siren = false;
  }

  remove() {
    this.manager.scene.remove(this.group);
    this.paintMat.dispose();
  }
}

// ───────────────────────────── Gestionnaire ─────────────────────────────
export class VehicleManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.scene = ctx.scene;
    this.map = ctx.map;
    this.fx = ctx.game.effects;
    this.vehicles = [];
    this.maxParked = ctx.game.isTouch ? 4 : 6;
    this.detailMat = new THREE.MeshLambertMaterial({ vertexColors: true });
    this.lightMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.sirenGeo = new THREE.BoxGeometry(0.42, 0.14, 0.26);
    this.sirenRed = new THREE.MeshBasicMaterial({ color: '#550000' });
    this.sirenBlue = new THREE.MeshBasicMaterial({ color: '#000055' });
    const wheelGeo = new THREE.CylinderGeometry(1, 1, 1, 14); wheelGeo.rotateZ(Math.PI / 2);
    this.wheelMesh = new THREE.InstancedMesh(wheelGeo, new THREE.MeshLambertMaterial({ color: '#1c1c1c' }), 300);
    this.wheelMesh.count = 0; this.wheelMesh.castShadow = true; this.wheelMesh.frustumCulled = false;
    this.scene.add(this.wheelMesh);
    this._tmp = new THREE.Vector3();
    this._m = new THREE.Matrix4(); this._m2 = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._s = new THREE.Vector3(); this._p = new THREE.Vector3();
    this.blink = 0;
    this.parkTimer = 0;
    this.garage = null; // { type, color } véhicule rangé
    this._spawnStarters();
  }

  _spawnStarters() {
    // quelques véhicules garés pour commencer (près de Bellecour et de la planque)
    this.spawn('moto', -58, 414, Math.PI / 2, { persistent: false });
    this.spawn('citadine', -36, 414, Math.PI / 2, { color: '#d32f2f' });
    this.spawn('scooter', -96, 245, Math.PI / 2, {});
    this.spawn('berline', 488, 414, Math.PI / 2, { color: '#212121' });
  }

  spawn(type, x, z, yaw = 0, opts = {}) {
    const v = new Vehicle(this, type, x, z, yaw, opts);
    this.vehicles.push(v);
    return v;
  }

  remove(v) {
    const i = this.vehicles.indexOf(v);
    if (i >= 0) this.vehicles.splice(i, 1);
    if (this.ctx.player.vehicle === v) this.ctx.player.exitVehicle();
    v.ai = null;
    v.onRemove?.();
    v.remove();
  }

  setVisible(on) {
    for (const v of this.vehicles) v.group.visible = on;
    this.wheelMesh.visible = on;
  }

  /** Explosion d'un véhicule : dégâts autour, épave fumante. */
  explode(v) {
    const { player, game } = this.ctx;
    v.state = 'wreck';
    v._wreckLook();
    v.vy = 6; v.onGround = false;
    this.fx.explosion(v.pos);
    const byPlayer = performance.now() - v.lastHitByPlayer < 15000 || v.driver === 'player';
    if (player.vehicle === v) { this.exitPlayer(true); player.damage(999); }
    else if (player.state === 'alive') {
      const d = player.position.distanceTo(v.pos);
      if (d < 9) player.damage(110 * (1 - d / 9));
    }
    for (const o of this.vehicles) {
      if (o === v || o.state === 'wreck') continue;
      const d = o.pos.distanceTo(v.pos);
      if (d < 9) o.damage(1400 * (1 - d / 9), byPlayer);
    }
    game.traffic?.explosionAt(v.pos, 9, byPlayer);
    if (byPlayer) game.police?.reportCrime(v.police ? 'killCop' : 'explosion', v.pos);
    if (v.driver === 'ai' || v.driver === 'police') { v.driver = null; v.ai = null; }
  }

  /** Le joueur monte dans le véhicule v. */
  enterPlayer(v) {
    const { player, game, hud } = this.ctx;
    if (v.driver === 'ai' || v.driver === 'police') {
      game.traffic?.ejectDriver(v);
      game.police?.reportCrime(v.police ? 'stealPolice' : 'carjack', v.pos);
    } else if (v.police) game.police?.reportCrime('stealPolice', v.pos);
    v.ai = null;
    v.driver = 'player';
    v.persistent = true;
    for (const o of this.vehicles) if (o !== v && o.driver !== 'ai' && o.driver !== 'police' && o.persistent && o.lastPlayer) o.persistent = false;
    v.lastPlayer = true;
    player.enterVehicle(v);
    hud.showVehicleName(v.t.name);
    this.fx.sfx.unlock();
  }

  /** Fait descendre le joueur (côté conducteur si possible). */
  exitPlayer(force = false) {
    const { player } = this.ctx;
    const v = player.vehicle;
    if (!v) return;
    const fast = Math.abs(v.speed) > 9;
    const r = v.right;
    const side = v.isBike ? 0.9 : v.t.wid / 2 + 0.7;
    const candidates = [[-side, 0], [side, 0], [0, -(v.t.len / 2 + 0.9)], [0, v.t.len / 2 + 0.9]];
    let out = null;
    for (const [lx, lz] of candidates) {
      const x = v.pos.x + r.x * lx + v.forward.x * lz, z = v.pos.z + r.z * lx + v.forward.z * lz;
      const y = this.map.getSurfaceHeight(x, z, v.pos.y + 1);
      if (!this.map._pointBlocked(x, y + 1, z, 0.25)) { out = { x, y, z }; break; }
    }
    if (!out) out = { x: v.pos.x, y: v.pos.y + 1.6, z: v.pos.z };
    v.driver = null;
    v.controls.throttle = 0; v.controls.steer = 0; v.controls.brake = !fast;
    player.exitVehicle(out.x, out.y, out.z);
    if (fast && !force) player.damage(Math.min(30, Math.abs(v.speed) * 1.2));
    this.fx.sfx.setEngine(false);
  }

  _playerControls(v) {
    const { input, player } = this.ctx;
    const c = v.controls;
    if (!player.controlsEnabled) { c.throttle = 0; c.steer = 0; c.brake = true; c.wheelie = false; return; }
    let th = 0, st = 0;
    if (input.isDown('KeyW', 'ArrowUp')) th += 1;
    if (input.isDown('KeyS', 'ArrowDown')) th -= 1;
    if (input.isDown('KeyD', 'ArrowRight')) st += 1;
    if (input.isDown('KeyA', 'ArrowLeft')) st -= 1;
    if (input.axisX || input.axisY) { st += input.axisX; th -= input.axisY * 1.25; }
    c.throttle = clamp(th, -1, 1);
    c.steer = clamp(st, -1, 1);
    c.brake = input.isDown('Space');
    c.wheelie = input.isDown('ShiftLeft', 'ShiftRight');
  }

  update(dt) {
    const { player, game, hud } = this.ctx;
    const pv = player.vehicle;
    if (pv) this._playerControls(pv);
    for (const v of this.vehicles) {
      if (v.ai && v !== pv && v.state !== 'wreck') v.ai(dt);
    }
    const pp = player.position;
    for (const v of this.vehicles) {
      const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
      if (d > 450 && !v.persistent) continue;
      v.update(dt);
    }
    this._vehicleCollisions();
    this._hitWalkers(dt);
    this._fxAndCleanup(dt);
    this._renderWheels();

    // entrée / sortie
    if (player.state === 'alive') {
      if (pv) {
        game.offerInteraction(null, 3, () => this.exitPlayer());
        this._garageOffer(pv);
      } else {
        let best = null, bestD = 3.4;
        for (const v of this.vehicles) {
          if (v.state === 'wreck' || v.inWater) continue;
          const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) - (v.isBike ? 0 : 0.6);
          if (d < bestD && Math.abs(v.pos.y - pp.y) < 2.5) { best = v; bestD = d; }
        }
        if (best) {
          const verb = best.driver === 'ai' || best.driver === 'police' ? 'Voler' : 'Monter';
          game.offerInteraction(`${verb} : <b>${best.t.name}</b>`, 1, () => this.enterPlayer(best));
        }
        this._garageOffer(null);
      }
    }
    // son du moteur
    if (pv) this.fx.sfx.setEngine(true, pv.speed / pv.t.maxSpeed, pv.isBike);
    this._manageParked(dt);
  }

  _garageOffer(pv) {
    const { game, player, hud } = this.ctx;
    const loc = this.map.locations.find((l) => l.garage);
    if (!loc) return;
    const d = Math.hypot(loc.x - player.position.x, loc.z - player.position.z);
    if (pv && d < 7 && Math.abs(pv.speed) < 4) {
      game.offerInteraction(`Garer : <b>${pv.t.name}</b>`, 4, () => {
        this.garage = { type: pv.type, color: pv.color };
        this.exitPlayer(true);
        this.remove(pv);
        player.teleport(loc.x, loc.z + 2, 0);
        hud.toast('Véhicule rangé au garage 🔧');
        game.saveGame(false);
      });
    } else if (!pv && d < 2.2 && this.garage) {
      game.offerInteraction(`Sortir du garage : <b>${VEHICLE_TYPES[this.garage.type].name}</b>`, 4, () => {
        const v = this.spawn(this.garage.type, loc.x, loc.z + 6.5, Math.PI / 2, { color: this.garage.color });
        this.garage = null;
        this.enterPlayer(v);
        game.saveGame(false);
      });
    }
  }

  _vehicleCollisions() {
    const list = this.vehicles;
    for (let i = 0; i < list.length; i++) {
      const a = list[i];
      for (let j = i + 1; j < list.length; j++) {
        const b = list[j];
        const dx = b.pos.x - a.pos.x, dz = b.pos.z - a.pos.z;
        const maxR = a.radius + b.radius;
        if (dx * dx + dz * dz > maxR * maxR || Math.abs(a.pos.y - b.pos.y) > 2) continue;
        // test précis : cercles avant/arrière
        const ca = this._circles(a), cb = this._circles(b);
        let hit = false, nx = 0, nz = 0, pen = 0;
        for (const p of ca) for (const q of cb) {
          const ex = q[0] - p[0], ez = q[1] - p[1], rr = p[2] + q[2], d = Math.hypot(ex, ez);
          if (d < rr && d > 1e-4) { hit = true; const k = rr - d; if (k > pen) { pen = k; nx = ex / d; nz = ez / d; } }
        }
        if (!hit) continue;
        a.pos.x -= nx * pen * 0.5; a.pos.z -= nz * pen * 0.5;
        b.pos.x += nx * pen * 0.5; b.pos.z += nz * pen * 0.5;
        const va = a.forward.multiplyScalar(a.speed), vb = b.forward.multiplyScalar(b.speed);
        const rel = (va.x - vb.x) * nx + (va.z - vb.z) * nz;
        if (rel > 0) {
          a.speed *= 0.55; b.speed = b.speed * 0.6 + rel * 0.3 * Math.sign(b.forward.x * nx + b.forward.z * nz || 1);
          if (rel > 5) {
            const byPlayer = a.driver === 'player' || b.driver === 'player';
            a.damage((rel - 5) * 25, byPlayer); b.damage((rel - 5) * 25, byPlayer);
            if (byPlayer) {
              this.fx.shakeAt(a.pos, Math.min(1, rel / 20)); this.fx.sfx.crash(rel / 20);
              const other = a.driver === 'player' ? b : a;
              if (other.police && rel > 8) this.ctx.game.police?.reportCrime('assaultCop', other.pos);
            }
          }
        }
      }
    }
  }

  _circles(v) {
    const f = v.forward;
    if (v.isBike) return [[v.pos.x, v.pos.z, 0.5]];
    const o = v.t.len / 2 - v.t.wid / 2, r = v.t.wid / 2 + 0.05;
    return [[v.pos.x + f.x * o, v.pos.z + f.z * o, r], [v.pos.x - f.x * o, v.pos.z - f.z * o, r]];
  }

  /** Véhicule lancé contre un piéton ou le joueur à pied. */
  _hitWalkers(dt) {
    const { player, game } = this.ctx;
    const peds = game.traffic ? game.traffic.peds : [];
    for (const v of this.vehicles) {
      const sp = Math.abs(v.speed);
      if (sp < 3.5) continue;
      const f = v.forward, r = v.right, hl = v.t.len / 2 + 0.3, hw = v.t.wid / 2 + 0.35;
      const test = (pos) => {
        const dx = pos.x - v.pos.x, dz = pos.z - v.pos.z;
        if (Math.abs(pos.y - v.pos.y) > 1.8) return false;
        return Math.abs(dx * f.x + dz * f.z) < hl && Math.abs(dx * r.x + dz * r.z) < hw;
      };
      if (!player.vehicle && player.state === 'alive' && test(player.position) && v !== player.vehicle) {
        player.damage(sp * 2.2);
        const push = Math.sign(v.speed) * sp * 0.5;
        player.velocity.x += f.x * push; player.velocity.z += f.z * push; player.velocity.y = 4; player.onGround = false;
        v.speed *= 0.7;
      }
      for (const ped of peds) {
        if (ped.state === 'dead' || ped.inCar) continue;
        if (test(ped.pos)) {
          game.traffic.hitByVehicle(ped, v, sp);
          v.speed *= 0.85;
        }
      }
    }
  }

  _fxAndCleanup(dt) {
    const { player } = this.ctx;
    this.blink += dt;
    const on = Math.floor(this.blink * 6) % 2 === 0;
    this.sirenRed.color.set(on ? '#ff1a1a' : '#4a0000');
    this.sirenBlue.color.set(on ? '#000055' : '#2a5cff');
    this.smokeAcc = (this.smokeAcc || 0) + dt;
    const emit = this.smokeAcc > 0.08;
    if (emit) this.smokeAcc = 0;
    const camPos = this.ctx.camera.position;
    for (const v of [...this.vehicles]) {
      const ratio = v.hp / v.t.hp;
      const d = camPos.distanceTo(v.pos);
      if (emit && d < 160) {
        const top = this._p.set(v.pos.x + v.forward.x * (v.t.len * 0.35), v.pos.y + 0.9, v.pos.z + v.forward.z * (v.t.len * 0.35));
        if (v.state === 'burning') { this.fx.fire(top, 1.2); this.fx.fire(top, 1); this.fx.smoke(top, true, 1.3); }
        else if (v.state === 'wreck' && v.wreckTimer < 25) this.fx.smoke(top, true, 1.1);
        else if (ratio < 0.25) { this.fx.smoke(top, true); if (Math.random() < 0.4) this.fx.fire(top, 0.6); }
        else if (ratio < 0.5) this.fx.smoke(top, false, 0.8);
      }
      // nettoyage : épaves et véhicules oubliés loin du joueur
      const far = Math.hypot(v.pos.x - player.position.x, v.pos.z - player.position.z);
      if (v !== player.vehicle && ((v.state === 'wreck' && v.wreckTimer > 60 && far > 60) || (!v.persistent && !v.ai && far > 320))) this.remove(v);
    }
  }

  _renderWheels() {
    let n = 0;
    const m = this._m, m2 = this._m2, q = this._q, e = this._e, s = this._s, p = this._p;
    for (const v of this.vehicles) {
      if (!v.group.visible) continue;
      v.group.updateMatrixWorld(true);
      for (const w of v.wheels) {
        if (n >= 300) break;
        e.set(v.wheelSpin, w.front ? -v.steerAngle * 0.5 : 0, 0, 'YXZ');
        q.setFromEuler(e);
        m2.compose(p.set(w.x, w.r, w.z), q, s.set(w.w, w.r, w.r));
        m.multiplyMatrices(v.body.matrixWorld, m2);
        this.wheelMesh.setMatrixAt(n++, m);
      }
    }
    this.wheelMesh.count = n;
    this.wheelMesh.instanceMatrix.needsUpdate = true;
  }

  /** Garde quelques véhicules garés près du joueur (à voler !). */
  _manageParked(dt) {
    this.parkTimer -= dt;
    if (this.parkTimer > 0) return;
    this.parkTimer = 2.5;
    const traffic = this.ctx.game.traffic;
    if (!traffic?.graph || this.ctx.game.interiors?.current) return;
    const pp = this.ctx.player.position;
    const parked = this.vehicles.filter((v) => !v.ai && v.driver !== 'player' && v.state !== 'wreck' && Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z) < 180);
    if (parked.length >= this.maxParked) return;
    const spot = traffic.randomRoadPoint(60, 170, { parked: true });
    if (!spot) return;
    if (this.vehicles.some((v) => v.pos.distanceTo(spot.pos) < 10)) return;
    const r = Math.random();
    const type = r < 0.4 ? 'citadine' : r < 0.65 ? 'berline' : r < 0.82 ? 'moto' : r < 0.97 ? 'scooter' : 'police';
    this.spawn(type, spot.pos.x, spot.pos.z, spot.yaw, {});
  }
}
