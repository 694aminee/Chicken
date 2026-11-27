/**
 * trafficNpc.js — Piétons et circulation routière.
 *
 *  - RoadGraph : graphe routier calculé à partir de map.roads (rues, quais, montées, ponts).
 *    Les intersections deviennent des nœuds ; les voitures roulent sur la voie de droite.
 *  - Voitures IA : suivent leur voie, ralentissent dans les virages, freinent devant un
 *    obstacle (voiture, piéton, joueur). Quelques patrouilles de police dans le trafic.
 *  - Piétons sur les trottoirs : marchent, fuient les coups de feu et les explosions,
 *    peuvent être renversés. Ils sont tous dessinés avec 4 maillages instanciés (rapide).
 */
import * as THREE from 'three';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const damp = (a, b, l, dt) => a + (b - a) * (1 - Math.exp(-l * dt));
function angleDamp(cur, target, l, dt) {
  let d = target - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return cur + d * (1 - Math.exp(-l * dt));
}

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac', '#a0522d', '#d9a066'];
const SHIRTS = ['#e53935', '#1e88e5', '#43a047', '#fdd835', '#8e24aa', '#f4511e', '#ffffff', '#212121', '#00897b', '#6d4c41', '#ec407a', '#90a4ae', '#3949ab'];
const PANTS = ['#263238', '#37474f', '#1a237e', '#3e2723', '#424242', '#5d4037', '#283593', '#9e9e9e', '#000000'];
const pick = (a) => a[Math.floor(Math.random() * a.length)];

// ───────────────────────────── Graphe routier ─────────────────────────────
export class RoadGraph {
  constructor(roads) {
    this.nodes = [];
    this.edges = [];
    const R = roads.filter((r) => r.kind !== 'path' && r.pts.length >= 2)
      .map((r) => ({ pts: r.pts.map((p) => [p[0], p[1]]), w: r.w, kind: r.kind, name: r.name, cuts: [] }));
    const CELL = 40;
    const keyOf = (i, j) => (i + 500) * 2000 + (j + 500);
    const buildHash = () => {
      const h = new Map();
      R.forEach((rr, ri) => {
        for (let k = 0; k < rr.pts.length - 1; k++) {
          const [ax, az] = rr.pts[k], [bx, bz] = rr.pts[k + 1];
          const i0 = Math.floor((Math.min(ax, bx) - 2) / CELL), i1 = Math.floor((Math.max(ax, bx) + 2) / CELL);
          const j0 = Math.floor((Math.min(az, bz) - 2) / CELL), j1 = Math.floor((Math.max(az, bz) + 2) / CELL);
          for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
            const key = keyOf(i, j);
            if (!h.has(key)) h.set(key, []);
            h.get(key).push({ ri, k });
          }
        }
      });
      return h;
    };
    const project = (rr, k, x, z) => {
      const [ax, az] = rr.pts[k], [bx, bz] = rr.pts[k + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const px = ax + dx * t, pz = az + dz * t;
      return { t, x: px, z: pz, d: Math.hypot(x - px, z - pz) };
    };
    // 1) raccorde les bouts de rue à la rue la plus proche (ex. rue → quai, pont → quai)
    let hash = buildHash();
    R.forEach((rr, ri) => {
      for (const end of [0, rr.pts.length - 1]) {
        const p = rr.pts[end];
        const maxD = rr.kind === 'bridge' ? 24 : 11;
        let best = null;
        const ci = Math.floor(p[0] / CELL), cj = Math.floor(p[1] / CELL);
        for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
          for (const sg of hash.get(keyOf(i, j)) || []) {
            if (sg.ri === ri) continue;
            const pr = project(R[sg.ri], sg.k, p[0], p[1]);
            if (pr.d < maxD && (!best || pr.d < best.d)) best = pr;
          }
        }
        if (best && best.d > 0.01) { p[0] = best.x; p[1] = best.z; }
      }
    });
    hash = buildHash();
    for (const rr of R) {
      rr.cum = [0];
      for (let k = 1; k < rr.pts.length; k++) rr.cum.push(rr.cum[k - 1] + Math.hypot(rr.pts[k][0] - rr.pts[k - 1][0], rr.pts[k][1] - rr.pts[k - 1][1]));
      rr.len = rr.cum[rr.cum.length - 1];
      rr.cuts.push({ s: 0, x: rr.pts[0][0], z: rr.pts[0][1] }, { s: rr.len, x: rr.pts[rr.pts.length - 1][0], z: rr.pts[rr.pts.length - 1][1] });
    }
    // 2) intersections
    const seen = new Set();
    for (const list of hash.values()) {
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) {
        const s1 = list[a], s2 = list[b];
        if (s1.ri === s2.ri) continue;
        const pk = s1.ri < s2.ri ? `${s1.ri}:${s1.k}|${s2.ri}:${s2.k}` : `${s2.ri}:${s2.k}|${s1.ri}:${s1.k}`;
        if (seen.has(pk)) continue;
        seen.add(pk);
        const r1 = R[s1.ri], r2 = R[s2.ri];
        const [ax, az] = r1.pts[s1.k], [bx, bz] = r1.pts[s1.k + 1];
        const [cx, cz] = r2.pts[s2.k], [dx2, dz2] = r2.pts[s2.k + 1];
        const d1x = bx - ax, d1z = bz - az, d2x = dx2 - cx, d2z = dz2 - cz;
        const den = d1x * d2z - d1z * d2x;
        if (Math.abs(den) < 1e-9) continue;
        const ex = cx - ax, ez = cz - az;
        const t = (ex * d2z - ez * d2x) / den, u = (ex * d1z - ez * d1x) / den;
        const l1 = Math.hypot(d1x, d1z), l2 = Math.hypot(d2x, d2z);
        const e1 = 0.6 / l1, e2 = 0.6 / l2;
        if (t < -e1 || t > 1 + e1 || u < -e2 || u > 1 + e2) continue;
        const tc = clamp(t, 0, 1), uc = clamp(u, 0, 1);
        const x = ax + d1x * tc, z = az + d1z * tc;
        r1.cuts.push({ s: r1.cum[s1.k] + tc * l1, x, z });
        r2.cuts.push({ s: r2.cum[s2.k] + uc * l2, x, z });
      }
    }
    // 3) nœuds (points proches fusionnés)
    const nodeHash = new Map();
    const nodeAt = (x, z) => {
      const ci = Math.floor(x / 8), cj = Math.floor(z / 8);
      for (let i = ci - 1; i <= ci + 1; i++) for (let j = cj - 1; j <= cj + 1; j++) {
        for (const n of nodeHash.get(keyOf(i, j)) || []) if (Math.hypot(n.x - x, n.z - z) < 6) return n;
      }
      const n = { id: this.nodes.length, x, z, edges: [] };
      this.nodes.push(n);
      const key = keyOf(ci, cj);
      if (!nodeHash.has(key)) nodeHash.set(key, []);
      nodeHash.get(key).push(n);
      return n;
    };
    // 4) tronçons entre nœuds consécutifs
    for (const rr of R) {
      rr.cuts.sort((p, q) => p.s - q.s);
      const nodes = rr.cuts.map((c) => ({ s: c.s, n: nodeAt(c.x, c.z) }));
      for (let i = 0; i < nodes.length - 1; i++) {
        const A = nodes[i], B = nodes[i + 1];
        if (A.n === B.n) continue;
        // évite les doublons quand plusieurs coupures tombent sur le même nœud
        let j = i + 1;
        while (j < nodes.length - 1 && nodes[j + 1].n === B.n) j++;
        const pts = [[A.n.x, A.n.z]];
        for (let k = 0; k < rr.pts.length; k++) if (rr.cum[k] > A.s + 0.5 && rr.cum[k] < B.s - 0.5) pts.push(rr.pts[k]);
        pts.push([B.n.x, B.n.z]);
        const cum = [0];
        for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
        const len = cum[cum.length - 1];
        if (len < 1.5) continue;
        if (A.n.edges.some((e) => (e.b === B.n.id || e.a === B.n.id) && Math.abs(e.len - len) < 2)) continue;
        const e = { id: this.edges.length, a: A.n.id, b: B.n.id, pts, cum, len, w: rr.w, kind: rr.kind, name: rr.name };
        e.mx = (A.n.x + B.n.x) / 2; e.mz = (A.n.z + B.n.z) / 2;
        this.edges.push(e);
        A.n.edges.push(e); B.n.edges.push(e);
      }
    }
  }

  /** Point à la distance s le long du tronçon (dans le sens fwd), décalé de off vers la droite. */
  pointAt(e, fwd, s, off = 0) {
    const L = e.len;
    const d = clamp(fwd ? s : L - s, 0, L);
    let k = 0;
    while (k < e.cum.length - 2 && e.cum[k + 1] < d) k++;
    const [ax, az] = e.pts[k], [bx, bz] = e.pts[k + 1];
    const sl = e.cum[k + 1] - e.cum[k] || 1;
    const t = (d - e.cum[k]) / sl;
    let dx = (bx - ax) / sl, dz = (bz - az) / sl;
    if (!fwd) { dx = -dx; dz = -dz; }
    return { x: ax + (bx - ax) * t - dz * off, z: az + (bz - az) * t + dx * off, dx, dz };
  }
  /** Distance parcourue sur le tronçon pour le point le plus proche de (x, z). */
  project(e, fwd, x, z) {
    let best = 1e9, bs = 0;
    for (let k = 0; k < e.pts.length - 1; k++) {
      const [ax, az] = e.pts[k], [bx, bz] = e.pts[k + 1];
      const dx = bx - ax, dz = bz - az, l2 = dx * dx + dz * dz || 1;
      const t = clamp(((x - ax) * dx + (z - az) * dz) / l2, 0, 1);
      const d = Math.hypot(x - ax - dx * t, z - az - dz * t);
      if (d < best) { best = d; bs = e.cum[k] + t * Math.sqrt(l2); }
    }
    return fwd ? bs : e.len - bs;
  }
  /** Choisit le tronçon suivant au nœud (évite le demi-tour si possible). */
  nextEdge(nodeId, from) {
    const n = this.nodes[nodeId];
    let opts = n.edges.filter((e) => e !== from);
    if (!opts.length) opts = [from];
    const e = opts[Math.floor(Math.random() * opts.length)];
    return { edge: e, fwd: e.a === nodeId };
  }
}

// ───────────────────────────── Rendu de la foule ─────────────────────────────
class CrowdRenderer {
  constructor(scene, cap) {
    this.cap = cap;
    const mat = new THREE.MeshLambertMaterial({ color: '#ffffff' });
    const arm = new THREE.BoxGeometry(0.13, 0.62, 0.13); arm.translate(0, -0.29, 0);
    const leg = new THREE.BoxGeometry(0.17, 0.92, 0.18); leg.translate(0, -0.46, 0);
    const mk = (geo, n) => {
      const m = new THREE.InstancedMesh(geo, mat, n);
      m.castShadow = true; m.frustumCulled = false; m.count = 0;
      m.setColorAt(0, new THREE.Color('#fff'));
      scene.add(m);
      return m;
    };
    this.head = mk(new THREE.BoxGeometry(0.26, 0.3, 0.27), cap);
    this.torso = mk(new THREE.BoxGeometry(0.46, 0.62, 0.26), cap);
    this.arms = mk(arm, cap * 2);
    this.legs = mk(leg, cap * 2);
    this.meshes = [this.head, this.torso, this.arms, this.legs];
    this._root = new THREE.Matrix4(); this._loc = new THREE.Matrix4(); this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion(); this._e = new THREE.Euler(); this._p = new THREE.Vector3(); this._one = new THREE.Vector3(1, 1, 1);
    this._c = new THREE.Color();
  }
  setVisible(on) { for (const m of this.meshes) m.visible = on; }
  render(peds) {
    let n = 0;
    const R = this._root, L = this._loc, M = this._m;
    for (const p of peds) {
      if (p.inCar || n >= this.cap) continue;
      const dead = p.state === 'dead';
      this._e.set(dead ? -Math.PI / 2 : p.lean || 0, p.yaw, 0, 'YXZ');
      this._q.setFromEuler(this._e);
      R.compose(this._p.set(p.pos.x, p.pos.y + (dead ? 0.15 : 0), p.pos.z), this._q, this._one);
      const sw = p.swing || 0;
      L.makeTranslation(0, 1.26, 0); M.multiplyMatrices(R, L); this.torso.setMatrixAt(n, M);
      L.makeTranslation(0, 1.74, 0); M.multiplyMatrices(R, L); this.head.setMatrixAt(n, M);
      const armR = p.aim ? -Math.PI / 2 : -sw * 0.9, armL = p.aim ? 0.1 : sw * 0.9;
      L.makeRotationX(armL).setPosition(0.3, 1.55, 0); M.multiplyMatrices(R, L); this.arms.setMatrixAt(n * 2, M);
      L.makeRotationX(armR).setPosition(-0.3, 1.55, 0); M.multiplyMatrices(R, L); this.arms.setMatrixAt(n * 2 + 1, M);
      L.makeRotationX(sw).setPosition(0.12, 0.95, 0); M.multiplyMatrices(R, L); this.legs.setMatrixAt(n * 2, M);
      L.makeRotationX(-sw).setPosition(-0.12, 0.95, 0); M.multiplyMatrices(R, L); this.legs.setMatrixAt(n * 2 + 1, M);
      const c = this._c;
      this.head.setColorAt(n, c.set(p.colors.skin));
      this.torso.setColorAt(n, c.set(p.colors.shirt));
      this.arms.setColorAt(n * 2, c.set(p.colors.shirt)); this.arms.setColorAt(n * 2 + 1, c);
      this.legs.setColorAt(n * 2, c.set(p.colors.pants)); this.legs.setColorAt(n * 2 + 1, c);
      n++;
    }
    this.head.count = this.torso.count = n;
    this.arms.count = this.legs.count = n * 2;
    for (const m of this.meshes) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }
}

// ───────────────────────────── Piéton ─────────────────────────────
class Ped {
  constructor(opts) {
    this.pos = opts.pos.clone();
    this.yaw = opts.yaw || 0;
    this.role = opts.role || 'civil';
    this.maxHealth = this.health = opts.health || (this.role === 'cop' ? 60 : 30);
    this.colors = opts.colors || { skin: pick(SKINS), shirt: pick(SHIRTS), pants: pick(PANTS) };
    this.state = opts.state || 'walk'; // walk | flee | dead | idle
    this.route = opts.route || null;
    this.speed = 0;
    this.moveDir = new THREE.Vector3();
    this.moveSpeed = 0;
    this.faceYaw = null;
    this.phase = Math.random() * 10;
    this.swing = 0;
    this.timer = 0;
    this.deadTimer = 0;
    this.fleeFrom = new THREE.Vector3();
    this.brain = null;     // IA spéciale (policiers)
    this.walkSpeed = 1.1 + Math.random() * 0.5;
    this.stuck = 0;
    this.money = this.role === 'cop' ? 0 : Math.floor(5 + Math.random() * 40);
    this.inCar = false;
    this.aim = false;
  }
  get alive() { return this.state !== 'dead'; }
}

// ───────────────────────────── Gestionnaire ─────────────────────────────
export class TrafficManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.map = ctx.map;
    this.graph = new RoadGraph(ctx.map.roads);
    this.edgeW = this.graph.edges;
    this.peds = [];
    this.cars = [];
    const touch = ctx.game.isTouch;
    this.maxCars = touch ? 12 : 20;
    this.maxPedestrians = touch ? 18 : 32;
    this.crowd = new CrowdRenderer(ctx.scene, 72);
    this.spawnTimer = 0;
    this._v = new THREE.Vector3();
  }

  setVisible(on) { this.crowd.setVisible(on); }

  // ─── Points aléatoires sur le réseau ───
  randomRoadPoint(minD, maxD, opts = {}) {
    const pp = this.ctx.player.position;
    const near = this.graph.edges.filter((e) => {
      if (opts.parked && e.kind === 'bridge') return false;
      const d = Math.hypot(e.mx - pp.x, e.mz - pp.z);
      return d < maxD + e.len / 2 && d > minD - e.len / 2;
    });
    const cam = this.ctx.camera;
    const cf = new THREE.Vector3(); cam.getWorldDirection(cf);
    for (let tries = 0; tries < 20 && near.length; tries++) {
      const e = near[Math.floor(Math.random() * near.length)];
      const fwd = Math.random() < 0.5;
      const s = Math.random() * e.len;
      let off;
      if (opts.sidewalk) off = (Math.random() < 0.5 ? -1 : 1) * (e.w / 2 + 2.2);
      else if (opts.parked) off = e.w / 2 - 1.25;
      else off = e.w / 4;
      const p = this.graph.pointAt(e, fwd, s, off);
      const d = Math.hypot(p.x - pp.x, p.z - pp.z);
      if (d < minD || d > maxD) continue;
      if (this.map.isWater(p.x, p.z) || this.map.edgeAt(p.x, p.z) < 1.5) continue;
      if (opts.hidden) {
        const toX = p.x - cam.position.x, toZ = p.z - cam.position.z;
        if ((toX * cf.x + toZ * cf.z) / (Math.hypot(toX, toZ) || 1) > 0.35 && d < 170) continue;
      }
      const y = this.map.getSurfaceHeight(p.x, p.z, 1e9);
      if (opts.sidewalk && this.map._pointBlocked(p.x, y + 1, p.z, 0.3)) continue;
      return { edge: e, fwd, s, off, pos: new THREE.Vector3(p.x, y, p.z), yaw: Math.atan2(p.dx, p.dz) };
    }
    return null;
  }

  // ─── Piétons ───
  spawnPed(opts) {
    const p = new Ped(opts);
    this.peds.push(p);
    return p;
  }
  removePed(p) {
    const i = this.peds.indexOf(p);
    if (i >= 0) this.peds.splice(i, 1);
    p.removed = true;
  }

  /** Les piétons proches fuient (coups de feu, explosions, bagarre). */
  alertArea(pos, radius) {
    for (const p of this.peds) {
      if (p.role === 'cop' || p.state === 'dead') continue;
      if (p.pos.distanceTo(pos) < radius) { p.state = 'flee'; p.fleeFrom.copy(pos); p.timer = 6 + Math.random() * 4; }
    }
  }

  /** Inflige des dégâts à un piéton. source = 'player' | 'police' | null. */
  damagePed(p, amount, source = null, from = null) {
    if (p.state === 'dead') return;
    p.health -= amount;
    if (from) { p.fleeFrom.copy(from); }
    if (p.health <= 0) this.killPed(p, source);
    else if (p.role !== 'cop') { p.state = 'flee'; p.timer = 8; if (!from) p.fleeFrom.copy(this.ctx.player.position); }
    if (source === 'player') {
      const pol = this.ctx.game.police;
      if (p.role === 'cop') pol?.reportCrime(p.state === 'dead' ? 'killCop' : 'assaultCop', p.pos);
      else pol?.reportCrime(p.state === 'dead' ? 'murder' : 'assault', p.pos);
    }
  }
  killPed(p, source) {
    p.state = 'dead';
    p.deadTimer = 0;
    p.aim = false;
    this.ctx.game.effects.blood(this._v.copy(p.pos).setY(p.pos.y + 1));
    if (source === 'player') {
      if (p.money > 0) this.ctx.game.weapons?.spawnPickup('money', p.pos, p.money);
      if (p.role === 'cop') this.ctx.game.weapons?.spawnPickup('pistol-ammo', p.pos, 12);
    }
    this.alertArea(p.pos, 25);
    p.onDeath?.();
  }

  hitByVehicle(p, v, speed) {
    const byPlayer = v.driver === 'player';
    const dmg = speed > 9 ? 999 : speed * 4;
    const f = v.forward;
    p.pos.x += f.x * 1.2 * Math.sign(v.speed); p.pos.z += f.z * 1.2 * Math.sign(v.speed);
    this.damagePed(p, dmg, byPlayer ? 'player' : null, v.pos);
    if (byPlayer && p.state === 'dead' && p.role !== 'cop') this.ctx.game.police?.reportCrime('hitPedestrian', p.pos);
  }

  explosionAt(pos, radius, byPlayer) {
    for (const p of [...this.peds]) {
      if (p.state === 'dead') continue;
      const d = p.pos.distanceTo(pos);
      if (d < radius) this.damagePed(p, 200 * (1 - d / radius) + 20, byPlayer ? 'player' : null, pos);
    }
    this.alertArea(pos, 45);
  }

  /** Le conducteur est éjecté (vol de voiture). */
  ejectDriver(v) {
    const r = v.right;
    const pos = new THREE.Vector3(v.pos.x + r.x * (v.t.wid / 2 + 0.9), v.pos.y, v.pos.z + r.z * (v.t.wid / 2 + 0.9));
    const i = this.cars.indexOf(v);
    if (i >= 0) this.cars.splice(i, 1);
    v.route = null;
    if (v.police) {
      this.ctx.game.police?.ejectCops(v, pos);
    } else {
      const p = this.spawnPed({ pos, yaw: v.yaw + Math.PI / 2, state: 'flee' });
      p.fleeFrom.copy(this.ctx.player.position);
      p.timer = 8;
    }
    v.driver = null;
  }

  // ─── Mise à jour ───
  update(dt) {
    const game = this.ctx.game;
    if (game.interiors?.current) return;
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 0.4;
      this._manageCars();
      this._managePeds();
    }
    for (const p of this.peds) {
      if (p.state === 'dead') { p.deadTimer += dt; p.swing = 0; continue; }
      if (p.brain) p.brain(dt); else this._pedBrain(p, dt);
      this._movePed(p, dt);
    }
    this.crowd.render(this.peds);
  }

  _manageCars() {
    const vm = this.ctx.game.vehicles;
    const pp = this.ctx.player.position;
    this.cars = this.cars.filter((v) => vm.vehicles.includes(v) && v.route && v.driver === 'ai');
    for (const v of [...this.cars]) {
      const d = Math.hypot(v.pos.x - pp.x, v.pos.z - pp.z);
      if (d > 300 || (v.state === 'wreck' && d > 80)) { this.cars.splice(this.cars.indexOf(v), 1); vm.remove(v); }
    }
    if (this.cars.length >= this.maxCars) return;
    const spot = this.randomRoadPoint(90, 230, { hidden: true });
    if (!spot) return;
    if (vm.vehicles.some((o) => o.pos.distanceTo(spot.pos) < 16)) return;
    const r = Math.random();
    const type = r < 0.5 ? 'citadine' : r < 0.86 ? 'berline' : 'police';
    const v = vm.spawn(type, spot.pos.x, spot.pos.z, spot.yaw, { driver: 'ai' });
    v.route = { edge: spot.edge, fwd: spot.fwd, s: spot.s, next: null, cruise: 9.5 + Math.random() * 4, stuck: 0, reverse: 0 };
    v.ai = (dt) => this._drive(v, dt);
    this.cars.push(v);
  }

  _managePeds() {
    const pp = this.ctx.player.position;
    for (const p of [...this.peds]) {
      const d = Math.hypot(p.pos.x - pp.x, p.pos.z - pp.z);
      if (p.role === 'cop' && p.brain) continue; // géré par la police
      if (d > 170 || (p.state === 'dead' && (p.deadTimer > 30 || d > 110)) || (p.stuck > 6 && d > 40)) this.removePed(p);
    }
    const civilians = this.peds.filter((p) => p.role !== 'cop' && p.state !== 'dead').length;
    if (civilians >= this.maxPedestrians) return;
    const spot = this.randomRoadPoint(30, 120, { sidewalk: true });
    if (!spot) return;
    const side = spot.off > 0 ? 1 : -1;
    this.spawnPed({ pos: spot.pos, yaw: spot.yaw, route: { edge: spot.edge, fwd: spot.fwd, s: spot.s, side } });
  }

  _pedBrain(p, dt) {
    const g = this.graph;
    if (p.state === 'flee') {
      p.timer -= dt;
      const dx = p.pos.x - p.fleeFrom.x, dz = p.pos.z - p.fleeFrom.z, l = Math.hypot(dx, dz) || 1;
      p.moveDir.set(dx / l, 0, dz / l);
      p.moveSpeed = 4.6;
      p.faceYaw = null;
      if (p.timer <= 0) {
        p.state = 'walk';
        if (p.route) p.route.s = g.project(p.route.edge, p.route.fwd, p.pos.x, p.pos.z);
      }
      return;
    }
    const r = p.route;
    if (!r) { p.moveSpeed = 0; return; }
    const off = r.side * (r.edge.w / 2 + 2.2);
    let t = g.pointAt(r.edge, r.fwd, r.s + 1.2, off);
    const dist = Math.hypot(t.x - p.pos.x, t.z - p.pos.z);
    if (dist < 3) r.s += p.walkSpeed * dt;
    if (r.s > r.edge.len) {
      const node = r.fwd ? r.edge.b : r.edge.a;
      const n = g.nextEdge(node, r.edge);
      r.edge = n.edge; r.fwd = n.fwd; r.s = 0;
      t = g.pointAt(r.edge, r.fwd, 1.2, r.side * (r.edge.w / 2 + 2.2));
    }
    const dx = t.x - p.pos.x, dz = t.z - p.pos.z, l = Math.hypot(dx, dz);
    if (l > 0.15) { p.moveDir.set(dx / l, 0, dz / l); p.moveSpeed = p.walkSpeed; }
    else p.moveSpeed = 0;
    p.faceYaw = null;
  }

  _movePed(p, dt) {
    const map = this.map;
    const before = this._v.copy(p.pos);
    const sp = p.moveSpeed;
    if (sp > 0.01) {
      const nx = p.pos.x + p.moveDir.x * sp * dt, nz = p.pos.z + p.moveDir.z * sp * dt;
      if (map.isWater(nx, nz)) { p.moveDir.multiplyScalar(-1); }
      else { p.pos.x = nx; p.pos.z = nz; }
      map.resolveCircle(p.pos, 0.3, 1.8);
      p.yaw = angleDamp(p.yaw, p.faceYaw ?? Math.atan2(p.moveDir.x, p.moveDir.z), 8, dt);
    } else if (p.faceYaw !== null) {
      p.yaw = angleDamp(p.yaw, p.faceYaw, 8, dt);
    }
    // repousse le joueur / les autres
    const pl = this.ctx.player;
    if (!pl.vehicle) {
      const dx = p.pos.x - pl.position.x, dz = p.pos.z - pl.position.z, d = Math.hypot(dx, dz);
      if (d < 0.65 && d > 1e-3) { p.pos.x += (dx / d) * (0.65 - d); p.pos.z += (dz / d) * (0.65 - d); }
    }
    p.pos.y = map.getSurfaceHeight(p.pos.x, p.pos.z, p.pos.y + 0.5);
    const moved = Math.hypot(p.pos.x - before.x, p.pos.z - before.z);
    p.speed = moved / Math.max(dt, 1e-4);
    p.stuck = sp > 0.3 && moved < sp * dt * 0.2 ? p.stuck + dt : Math.max(0, p.stuck - dt);
    p.phase += dt * (2 + p.speed * 2.2);
    p.swing = Math.sin(p.phase) * Math.min(1, p.speed / 4.5) * 0.9;
  }

  // ─── Conduite IA ───
  _routePoint(r, s, lane) {
    const g = this.graph;
    if (s <= r.edge.len) return g.pointAt(r.edge, r.fwd, s, lane);
    if (!r.next) r.next = g.nextEdge(r.fwd ? r.edge.b : r.edge.a, r.edge);
    return g.pointAt(r.next.edge, r.next.fwd, Math.min(s - r.edge.len, r.next.edge.len), r.next.edge.w / 4);
  }

  _blocked(v) {
    const vm = this.ctx.game.vehicles, pl = this.ctx.player;
    const f = v.forward, rt = v.right;
    const range = 4 + Math.abs(v.speed) * 1.3;
    const test = (pos, rad, widthTol) => {
      const dx = pos.x - v.pos.x, dz = pos.z - v.pos.z;
      const lz = dx * f.x + dz * f.z;
      if (lz <= 0.5 || lz > range + rad) return false;
      return Math.abs(dx * rt.x + dz * rt.z) < widthTol;
    };
    for (const o of vm.vehicles) if (o !== v && test(o.pos, o.radius, 2.0)) return true;
    if (!pl.vehicle && pl.state === 'alive' && test(pl.position, 0.5, 1.6)) return true;
    for (const p of this.peds) if (p.state !== 'dead' && !p.inCar && test(p.pos, 0.4, 1.4)) return true;
    return false;
  }

  _drive(v, dt) {
    const r = v.route;
    if (!r) return;
    const g = this.graph, c = v.controls;
    r.s = g.project(r.edge, r.fwd, v.pos.x, v.pos.z);
    if (r.s >= r.edge.len - 0.8) {
      const n = r.next || g.nextEdge(r.fwd ? r.edge.b : r.edge.a, r.edge);
      r.edge = n.edge; r.fwd = n.fwd; r.next = null;
      r.s = g.project(r.edge, r.fwd, v.pos.x, v.pos.z);
    }
    const lane = r.edge.w / 4;
    const look = 5 + Math.abs(v.speed) * 0.45;
    const tp = this._routePoint(r, r.s + look, lane);
    const fp = this._routePoint(r, r.s + look + 16, lane);
    const f = v.forward, rt = v.right;
    const ang = (p) => {
      const dx = p.x - v.pos.x, dz = p.z - v.pos.z;
      return Math.atan2(dx * rt.x + dz * rt.z, dx * f.x + dz * f.z);
    };
    const a1 = ang(tp), a2 = ang(fp);
    let desired = r.cruise * (1 - Math.min(0.6, Math.abs(a2) * 0.75));
    if (Math.abs(a1) > 1.2) desired = Math.min(desired, 4);
    // bloqué trop longtemps (face à face, embouteillage) : on force le passage un moment
    let blocked = r.pushThrough > 0 ? false : this._blocked(v);
    if (r.pushThrough > 0) r.pushThrough -= dt;
    r.blockT = blocked ? (r.blockT || 0) + dt : 0;
    if (r.blockT > 7) { r.blockT = 0; r.pushThrough = 2.5; blocked = false; }
    if (blocked) desired = 0;
    if (r.reverse > 0) {
      r.reverse -= dt;
      c.throttle = -0.7; c.steer = -clamp(a1 * 2, -1, 1); c.brake = false;
      return;
    }
    c.steer = clamp(a1 * 2.2, -1, 1);
    c.throttle = clamp((desired - v.speed) * 0.35, -1, 1);
    c.brake = blocked && v.speed > 1.5;
    c.wheelie = false;
    if (desired > 2 && Math.abs(v.speed) < 0.6) r.stuck += dt; else r.stuck = Math.max(0, r.stuck - dt);
    if (r.stuck > 4) { r.stuck = 0; r.reverse = 1.4; }
  }
}
