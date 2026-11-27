/**
 * player.js — Personnage jouable à la 3ème personne.
 *
 *  - Déplacements relatifs à la caméra (ZQSD / WASD / flèches), sprint (Maj), saut (Espace)
 *  - Nage dans le Rhône et la Saône
 *  - Caméra TPS orbitale à la souris (verrouillage du pointeur), anti-collision avec les murs
 *  - Statistiques : vie, armure, endurance, argent, indice de recherche
 *  - Mort (« HOSPITALISÉ ») puis réapparition à l'Hôpital de la Croix-Rousse
 */
import * as THREE from 'three';
import { WATER_LEVEL } from '../world/mapLyon.js';

const GRAVITY = 22;
const JUMP_SPEED = 7.0;
const RUN_SPEED = 5.4;
const SPRINT_SPEED = 8.8;
const SWIM_SPEED = 2.4;
const SWIM_FAST = 3.8;
const RADIUS = 0.35;
const HEIGHT = 1.8;
const SWIM_DEPTH = 1.05; // les pieds sont à cette profondeur sous la surface quand on nage

const CAM_DISTANCES = [3.2, 5, 8];

const damp = (current, target, lambda, dt) => THREE.MathUtils.lerp(current, target, 1 - Math.exp(-lambda * dt));
function angleDamp(current, target, lambda, dt) {
  let d = target - current;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return current + d * (1 - Math.exp(-lambda * dt));
}

/** Construit un personnage en blocs (style « jouet »), face vers +Z. */
function buildCharacter(outfit) {
  const mats = {
    skin: new THREE.MeshLambertMaterial({ color: outfit.skin }),
    shirt: new THREE.MeshLambertMaterial({ color: outfit.shirt }),
    stripe1: new THREE.MeshLambertMaterial({ color: outfit.stripe1 }),
    stripe2: new THREE.MeshLambertMaterial({ color: outfit.stripe2 }),
    pants: new THREE.MeshLambertMaterial({ color: outfit.pants }),
    shoes: new THREE.MeshLambertMaterial({ color: outfit.shoes }),
    cap: new THREE.MeshLambertMaterial({ color: outfit.cap }),
    dark: new THREE.MeshLambertMaterial({ color: '#1a1a1a' }),
  };
  const box = (w, h, d, mat, x = 0, y = 0, z = 0) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    m.castShadow = true;
    return m;
  };
  const root = new THREE.Group();
  const body = new THREE.Group(); // pivot pour inclinaison (nage, chute)
  root.add(body);
  const hips = new THREE.Group();
  hips.position.y = 0.95;
  body.add(hips);

  const torso = new THREE.Group();
  hips.add(torso);
  torso.add(box(0.46, 0.62, 0.26, mats.shirt, 0, 0.33, 0));
  torso.add(box(0.47, 0.07, 0.27, mats.stripe1, 0, 0.42, 0));
  torso.add(box(0.47, 0.07, 0.27, mats.stripe2, 0, 0.34, 0));
  torso.add(box(0.12, 0.08, 0.12, mats.skin, 0, 0.68, 0));

  const head = new THREE.Group();
  head.position.y = 0.72;
  torso.add(head);
  head.add(box(0.26, 0.3, 0.27, mats.skin, 0, 0.15, 0));
  head.add(box(0.28, 0.08, 0.29, mats.cap, 0, 0.32, 0));
  head.add(box(0.26, 0.03, 0.14, mats.cap, 0, 0.29, 0.18));
  head.add(box(0.05, 0.04, 0.02, mats.dark, -0.06, 0.18, 0.14));
  head.add(box(0.05, 0.04, 0.02, mats.dark, 0.06, 0.18, 0.14));

  const makeArm = (side) => {
    const arm = new THREE.Group();
    arm.position.set(0.3 * side, 0.6, 0);
    arm.add(box(0.13, 0.32, 0.13, mats.shirt, 0, -0.14, 0));
    const fore = new THREE.Group();
    fore.position.y = -0.3;
    fore.add(box(0.11, 0.3, 0.11, mats.skin, 0, -0.14, 0));
    fore.add(box(0.12, 0.1, 0.12, mats.skin, 0, -0.32, 0));
    arm.add(fore);
    torso.add(arm);
    return { arm, fore };
  };
  const makeLeg = (side) => {
    const leg = new THREE.Group();
    leg.position.set(0.12 * side, 0, 0);
    leg.add(box(0.17, 0.46, 0.19, mats.pants, 0, -0.23, 0));
    const shin = new THREE.Group();
    shin.position.y = -0.46;
    shin.add(box(0.16, 0.42, 0.17, mats.pants, 0, -0.21, 0));
    shin.add(box(0.17, 0.08, 0.28, mats.shoes, 0, -0.45, 0.04));
    leg.add(shin);
    hips.add(leg);
    return { leg, shin };
  };
  const armL = makeArm(-1), armR = makeArm(1);
  const legL = makeLeg(-1), legR = makeLeg(1);
  return { root, body, hips, torso, head, armL, armR, legL, legR, mats };
}

export const DEFAULT_OUTFIT = {
  skin: '#c68a5a', shirt: '#f4f4f4', stripe1: '#d4202a', stripe2: '#1b3f8f',
  pants: '#2b3d63', shoes: '#efefef', cap: '#d4202a',
};

export class Player {
  constructor({ scene, camera, map, input }) {
    this.scene = scene;
    this.camera = camera;
    this.map = map;
    this.input = input;

    this.stats = {
      health: 100, maxHealth: 100,
      armor: 0, maxArmor: 100,
      stamina: 100, maxStamina: 100,
      money: 500,
      wanted: 0, // 0 à 5 étoiles (géré par systems/police.js à l'étape 4)
    };
    this.weapon = { id: 'fist', name: 'Poings', ammo: Infinity, clip: Infinity };

    this.position = new THREE.Vector3();
    this.velocity = new THREE.Vector3();
    this.yaw = 0;              // orientation du personnage (direction (sin yaw, cos yaw))
    this.camYaw = 0;
    this.camPitch = 0.22;
    this.camDistIndex = 1;
    this.camDist = CAM_DISTANCES[1];
    this.camDistTarget = this.camDist;
    this.mouseSensitivity = 0.0024;

    this.onGround = true;
    this.swimming = false;
    this.sprinting = false;
    this.exhausted = false;
    this.state = 'alive';
    this.deathTimer = 0;
    this.onDeath = null;       // callback appelé quand l'écran « HOSPITALISÉ » doit s'afficher
    this.controlsEnabled = true;
    this.visible = true;       // à false quand le joueur est dans un véhicule (étape 2)
    this.walkPhase = 0;
    this.airTime = 0;
    this.speed = 0;

    this.outfit = { ...DEFAULT_OUTFIT };
    this.model = buildCharacter(this.outfit);
    this.mesh = this.model.root;
    this.mesh.name = 'Joueur';
    scene.add(this.mesh);

    this._camTarget = new THREE.Vector3();
    this._tmp = new THREE.Vector3();
    this._tmp2 = new THREE.Vector3();
  }

  /** Place le joueur (et la caméra derrière lui). */
  teleport(x, z, yaw = this.yaw, y = null) {
    const ground = y ?? this.map.getSurfaceHeight(x, z);
    this.position.set(x, Math.max(ground, this.map.isWater(x, z) ? WATER_LEVEL - SWIM_DEPTH : ground), z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.camYaw = yaw + Math.PI;
    this._camTarget.set(x, this.position.y + 1.6, z);
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = yaw;
    this.swimming = this.map.isWater(x, z) && ground < WATER_LEVEL - 1.3;
    this._updateCamera(1);
  }

  /** Change la tenue (utilisé par la garde-robe de la planque à l'étape 3). */
  setOutfit(outfit) {
    Object.assign(this.outfit, outfit);
    for (const [k, mat] of Object.entries(this.model.mats)) if (this.outfit[k]) mat.color.set(this.outfit[k]);
  }

  damage(amount) {
    if (this.state !== 'alive') return;
    const s = this.stats;
    const absorbed = Math.min(s.armor, amount * 0.7);
    s.armor -= absorbed;
    s.health = Math.max(0, s.health - (amount - absorbed));
    if (s.health <= 0) this._die();
  }
  heal(amount = Infinity) { this.stats.health = Math.min(this.stats.maxHealth, this.stats.health + amount); }
  addMoney(v) { this.stats.money = Math.max(0, Math.min(99999999, Math.round(this.stats.money + v))); }

  _die() {
    this.state = 'dead';
    this.deathTimer = 0;
    this._deathNotified = false;
    this.velocity.set(0, 0, 0);
    this.stats.wanted = 0;
  }

  respawn(spawn) {
    this.state = 'alive';
    this.stats.health = this.stats.maxHealth;
    this.stats.stamina = this.stats.maxStamina;
    this.model.body.rotation.set(0, 0, 0);
    this.model.body.position.set(0, 0, 0);
    this.teleport(spawn.x, spawn.z, spawn.yaw ?? 0);
  }

  /** Direction horizontale vers laquelle regarde la caméra. */
  getCameraForward(out = new THREE.Vector3()) {
    return out.set(-Math.sin(this.camYaw), 0, -Math.cos(this.camYaw));
  }

  update(dt) {
    const input = this.input;
    // ─── Caméra à la souris ───
    if (this.controlsEnabled) {
      this.camYaw -= input.mouseDX * this.mouseSensitivity;
      this.camPitch = THREE.MathUtils.clamp(this.camPitch + input.mouseDY * this.mouseSensitivity, -0.45, 1.25);
      if (input.wheel) {
        this.camDistTarget = THREE.MathUtils.clamp(this.camDistTarget + Math.sign(input.wheel) * 0.8, 2.4, 10);
      }
      if (input.wasPressed('KeyV')) {
        this.camDistIndex = (this.camDistIndex + 1) % CAM_DISTANCES.length;
        this.camDistTarget = CAM_DISTANCES[this.camDistIndex];
      }
    }
    this.camDist = damp(this.camDist, this.camDistTarget, 8, dt);

    if (this.state === 'dead') {
      this._updateDeath(dt);
      this._updateCamera(dt);
      return;
    }

    // ─── Entrées de déplacement ───
    let f = 0, r = 0;
    if (this.controlsEnabled) {
      if (input.isDown('KeyW', 'ArrowUp')) f += 1;
      if (input.isDown('KeyS', 'ArrowDown')) f -= 1;
      if (input.isDown('KeyD', 'ArrowRight')) r += 1;
      if (input.isDown('KeyA', 'ArrowLeft')) r -= 1;
      // joystick tactile
      if (input.axisX || input.axisY) { r += input.axisX; f -= input.axisY; }
    }
    const fwd = this.getCameraForward(this._tmp);
    const right = this._tmp2.set(Math.cos(this.camYaw), 0, -Math.sin(this.camYaw));
    const dir = new THREE.Vector3().addScaledVector(fwd, f).addScaledVector(right, r);
    const moving = dir.lengthSq() > 0.001;
    if (moving) dir.normalize();

    // ─── Endurance & sprint ───
    const s = this.stats;
    const wantSprint = this.controlsEnabled && moving && (input.isDown('ShiftLeft', 'ShiftRight') || input.virtualSprint);
    if (s.stamina <= 0) this.exhausted = true;
    if (this.exhausted && s.stamina > 25) this.exhausted = false;
    this.sprinting = wantSprint && !this.exhausted;
    if (this.sprinting) s.stamina = Math.max(0, s.stamina - 16 * dt);
    else s.stamina = Math.min(s.maxStamina, s.stamina + (moving ? 8 : 14) * dt);

    let speed;
    if (this.swimming) speed = this.sprinting ? SWIM_FAST : SWIM_SPEED;
    else speed = this.sprinting ? SPRINT_SPEED : RUN_SPEED;
    if (!moving) speed = 0;

    // ─── Vitesse horizontale (accélération douce) ───
    const accel = this.onGround || this.swimming ? 14 : 2.5;
    this.velocity.x = damp(this.velocity.x, dir.x * speed, accel, dt);
    this.velocity.z = damp(this.velocity.z, dir.z * speed, accel, dt);
    this.speed = Math.hypot(this.velocity.x, this.velocity.z);
    if (moving) this.yaw = angleDamp(this.yaw, Math.atan2(dir.x, dir.z), 12, dt);

    // ─── Déplacement horizontal + collisions ───
    const p = this.position;
    p.x += this.velocity.x * dt;
    p.z += this.velocity.z * dt;
    this.map.resolveCircle(p, RADIUS, HEIGHT);

    // ─── Vertical : sol, saut, nage ───
    const ground = this.map.getSurfaceHeight(p.x, p.z, p.y + 0.1);
    const deepWater = ground < WATER_LEVEL - 1.3;
    const swimY = WATER_LEVEL - SWIM_DEPTH;
    if (this.swimming) {
      if (!deepWater) {
        this.swimming = false;
        p.y = Math.max(p.y, ground);
        this.onGround = true;
      } else {
        p.y = damp(p.y, swimY, 6, dt);
        this.velocity.y = 0;
        this.onGround = false;
      }
    }
    if (!this.swimming) {
      if (this.onGround && this.controlsEnabled && input.wasPressed('Space')) {
        this.velocity.y = JUMP_SPEED;
        this.onGround = false;
      }
      this.velocity.y -= GRAVITY * dt;
      p.y += this.velocity.y * dt;
      if (deepWater && p.y <= swimY) { // plongeon dans le fleuve
        p.y = swimY;
        this.velocity.y = 0;
        this.swimming = true;
        this.onGround = false;
      } else if (p.y <= ground) {
        if (this.velocity.y < -15) this.damage((-this.velocity.y - 15) * 6);
        p.y = ground;
        this.velocity.y = 0;
        this.onGround = true;
      } else if (this.onGround && this.velocity.y <= 0 && p.y - ground < 0.65) {
        p.y = ground; // colle au sol en descendant les pentes et marches
        this.velocity.y = 0;
      } else {
        this.onGround = false;
      }
    }
    this.airTime = this.onGround || this.swimming ? 0 : this.airTime + dt;

    this.mesh.position.copy(p);
    this.mesh.rotation.y = this.yaw;
    this.mesh.visible = this.visible;
    this._animate(dt);
    this._updateCamera(dt);
  }

  _animate(dt) {
    const m = this.model;
    const sp = this.speed;
    this.walkPhase += dt * (sp > 0.2 ? 3.2 + sp * 1.05 : 0);
    const ph = this.walkPhase;
    if (this.swimming) {
      m.body.rotation.x = damp(m.body.rotation.x, 1.25, 6, dt);
      m.body.position.y = damp(m.body.position.y, 0.55, 6, dt);
      const st = ph * 0.7;
      m.armL.arm.rotation.x = Math.sin(st) * 1.6 - 1.6;
      m.armR.arm.rotation.x = Math.sin(st + Math.PI) * 1.6 - 1.6;
      m.armL.fore.rotation.x = m.armR.fore.rotation.x = -0.2;
      m.legL.leg.rotation.x = Math.sin(st * 2) * 0.35;
      m.legR.leg.rotation.x = -Math.sin(st * 2) * 0.35;
      m.legL.shin.rotation.x = m.legR.shin.rotation.x = 0.2;
      m.head.rotation.x = -0.9;
      return;
    }
    m.body.rotation.x = damp(m.body.rotation.x, this.sprinting ? 0.18 : sp > 0.5 ? 0.07 : 0, 8, dt);
    m.body.position.y = damp(m.body.position.y, 0, 8, dt);
    m.head.rotation.x = damp(m.head.rotation.x, 0, 8, dt);
    if (!this.onGround && this.airTime > 0.08) {
      m.legL.leg.rotation.x = damp(m.legL.leg.rotation.x, -0.7, 10, dt);
      m.legR.leg.rotation.x = damp(m.legR.leg.rotation.x, 0.3, 10, dt);
      m.legL.shin.rotation.x = damp(m.legL.shin.rotation.x, 1.0, 10, dt);
      m.legR.shin.rotation.x = damp(m.legR.shin.rotation.x, 0.4, 10, dt);
      m.armL.arm.rotation.x = damp(m.armL.arm.rotation.x, -2.2, 8, dt);
      m.armR.arm.rotation.x = damp(m.armR.arm.rotation.x, -2.2, 8, dt);
      m.armL.arm.rotation.z = damp(m.armL.arm.rotation.z, -0.4, 8, dt);
      m.armR.arm.rotation.z = damp(m.armR.arm.rotation.z, 0.4, 8, dt);
      return;
    }
    const amp = Math.min(1, sp / SPRINT_SPEED) * 1.0;
    m.legL.leg.rotation.x = Math.sin(ph) * amp;
    m.legR.leg.rotation.x = Math.sin(ph + Math.PI) * amp;
    m.legL.shin.rotation.x = Math.max(0, Math.sin(ph + Math.PI * 0.5)) * amp * 1.3;
    m.legR.shin.rotation.x = Math.max(0, Math.sin(ph + Math.PI * 1.5)) * amp * 1.3;
    m.armL.arm.rotation.x = Math.sin(ph + Math.PI) * amp * 0.9;
    m.armR.arm.rotation.x = Math.sin(ph) * amp * 0.9;
    m.armL.arm.rotation.z = damp(m.armL.arm.rotation.z, -0.06, 8, dt);
    m.armR.arm.rotation.z = damp(m.armR.arm.rotation.z, 0.06, 8, dt);
    m.armL.fore.rotation.x = m.armR.fore.rotation.x = -0.25 - amp * 0.6;
    // respiration au repos
    const breathe = sp < 0.2 ? Math.sin(this.map.time * 2) * 0.015 : Math.abs(Math.sin(ph)) * 0.04 * amp;
    m.hips.position.y = 0.95 + breathe;
  }

  _updateDeath(dt) {
    this.deathTimer += dt;
    const m = this.model;
    m.body.rotation.x = damp(m.body.rotation.x, -Math.PI / 2, 5, dt);
    m.body.position.y = damp(m.body.position.y, 0.15, 5, dt);
    m.armL.arm.rotation.z = damp(m.armL.arm.rotation.z, -1.2, 5, dt);
    m.armR.arm.rotation.z = damp(m.armR.arm.rotation.z, 1.2, 5, dt);
    if (this.deathTimer > 1.2 && !this._deathNotified) {
      this._deathNotified = true;
      this.onDeath?.();
    }
  }

  _updateCamera(dt) {
    const cam = this.camera;
    const p = this.position;
    const targetY = p.y + (this.swimming ? 1.2 : 1.6);
    this._camTarget.x = damp(this._camTarget.x, p.x, 18, dt);
    this._camTarget.y = damp(this._camTarget.y, targetY, 10, dt);
    this._camTarget.z = damp(this._camTarget.z, p.z, 18, dt);
    const t = this._camTarget;
    const cp = Math.cos(this.camPitch), sp = Math.sin(this.camPitch);
    const desired = new THREE.Vector3(
      t.x + Math.sin(this.camYaw) * cp * this.camDist,
      t.y + sp * this.camDist,
      t.z + Math.cos(this.camYaw) * cp * this.camDist,
    );
    // léger décalage d'épaule
    const shoulder = 0.35;
    desired.x += Math.cos(this.camYaw) * shoulder;
    desired.z -= Math.sin(this.camYaw) * shoulder;
    const frac = this.map.raycast(t, desired, 0.25);
    const camPos = t.clone().lerp(desired, Math.max(0.12, frac));
    const g = this.map.getGroundHeight(camPos.x, camPos.z);
    camPos.y = Math.max(camPos.y, g + 0.35);
    if (this.map.isWater(camPos.x, camPos.z)) camPos.y = Math.max(camPos.y, WATER_LEVEL + 0.35);
    cam.position.copy(camPos);
    cam.lookAt(t.x, t.y, t.z);
  }
}
