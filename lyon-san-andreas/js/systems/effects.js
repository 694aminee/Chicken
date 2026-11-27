/**
 * effects.js — Effets visuels et sonores partagés par tous les systèmes.
 *
 *  - Particules (fumée, feu, explosions, poussière d'impact, sang, étincelles) :
 *    deux maillages instanciés seulement → très peu coûteux, même sur téléphone
 *  - Traçantes de balles
 *  - Sons synthétisés avec la Web Audio API (aucun fichier à télécharger) :
 *    coups de feu, explosion, coups de poing, sirène, moteur
 */
import * as THREE from 'three';
import { makeRadialTexture } from '../world/mapLyon.js';

const _m4 = new THREE.Matrix4();
const _v = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();

class ParticlePool {
  constructor(scene, capacity, material) {
    this.cap = capacity;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), material, capacity);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.mesh.setColorAt(0, _c.set('#ffffff'));
    this.mesh.renderOrder = 5;
    scene.add(this.mesh);
    this.list = [];
  }
  emit(x, y, z, vx, vy, vz, life, s0, s1, color, gravity = 0) {
    if (this.list.length >= this.cap) this.list.shift();
    this.list.push({ x, y, z, vx, vy, vz, life, age: 0, s0, s1, color: new THREE.Color(color), gravity });
  }
  update(dt, camera) {
    const keep = [];
    for (const p of this.list) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.vy -= p.gravity * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.z += p.vz * dt;
      keep.push(p);
    }
    this.list = keep;
    let i = 0;
    for (const p of keep) {
      const t = p.age / p.life;
      let size = p.s0 + (p.s1 - p.s0) * t;
      if (t > 0.75) size *= (1 - t) / 0.25;
      _m4.compose(_v.set(p.x, p.y, p.z), camera.quaternion, _s.set(size, size, size));
      this.mesh.setMatrixAt(i, _m4);
      this.mesh.setColorAt(i, p.color);
      i++;
    }
    this.mesh.count = i;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}

export class Effects {
  constructor(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    const tex = makeRadialTexture('rgba(255,255,255,1)', 'rgba(255,255,255,0)');
    this.smokePool = new ParticlePool(scene, 260, new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity: 0.55, depthWrite: false, fog: true }));
    this.firePool = new ParticlePool(scene, 260, new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    // traçantes
    this.tracers = [];
    const tracerMat = new THREE.LineBasicMaterial({ color: '#ffe9a0', transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false });
    for (let i = 0; i < 16; i++) {
      const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3(0, 0, 1)]);
      const line = new THREE.Line(g, tracerMat);
      line.visible = false; line.frustumCulled = false;
      scene.add(line);
      this.tracers.push({ line, t: 0 });
    }
    this.tracerIndex = 0;
    this.shake = 0;
    this.sfx = new Sfx();
  }

  smoke(pos, dark = false, size = 1) {
    const g = dark ? 0.12 + Math.random() * 0.1 : 0.45 + Math.random() * 0.2;
    this.smokePool.emit(pos.x + (Math.random() - 0.5) * 0.4, pos.y, pos.z + (Math.random() - 0.5) * 0.4,
      (Math.random() - 0.5) * 0.6, 1.4 + Math.random(), (Math.random() - 0.5) * 0.6,
      1.8 + Math.random(), 0.7 * size, 3.2 * size, _c.setRGB(g, g, g));
  }
  fire(pos, size = 1) {
    const col = Math.random() < 0.5 ? '#ff7a1a' : '#ffb347';
    this.firePool.emit(pos.x + (Math.random() - 0.5) * 0.8 * size, pos.y, pos.z + (Math.random() - 0.5) * 0.8 * size,
      (Math.random() - 0.5) * 0.4, 2 + Math.random() * 1.5, (Math.random() - 0.5) * 0.4,
      0.45 + Math.random() * 0.3, 1.2 * size, 0.3 * size, col);
  }
  explosion(pos) {
    for (let i = 0; i < 46; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 1.2, sp = 4 + Math.random() * 9;
      this.firePool.emit(pos.x, pos.y + 0.8, pos.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 2, Math.sin(a) * Math.cos(e) * sp,
        0.5 + Math.random() * 0.5, 2.5 + Math.random() * 2, 0.5, i % 3 ? '#ff8a2a' : '#ffe08a', 4);
    }
    this.firePool.emit(pos.x, pos.y + 1.5, pos.z, 0, 0, 0, 0.25, 14, 22, '#fff1c0');
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, sp = 1 + Math.random() * 3;
      this.smokePool.emit(pos.x, pos.y + 1, pos.z, Math.cos(a) * sp, 2 + Math.random() * 3, Math.sin(a) * sp,
        2.5 + Math.random() * 2, 2.5, 7, _c.setRGB(0.12, 0.12, 0.12));
    }
    this.shakeAt(pos, 1.4);
    this.sfx.explosion(this._dist(pos));
  }
  impact(pos, color = '#bdb6a8') {
    for (let i = 0; i < 5; i++) {
      this.smokePool.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 2, Math.random() * 2, (Math.random() - 0.5) * 2, 0.45, 0.15, 0.6, color);
    }
    this.firePool.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.06, 0.35, 0.1, '#ffd27a');
  }
  blood(pos) {
    for (let i = 0; i < 9; i++) {
      this.smokePool.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 2.5, Math.random() * 2.5, (Math.random() - 0.5) * 2.5, 0.5, 0.18, 0.35, '#8a0d0d', 9);
    }
  }
  sparks(pos) {
    for (let i = 0; i < 6; i++) {
      this.firePool.emit(pos.x, pos.y, pos.z, (Math.random() - 0.5) * 6, Math.random() * 4, (Math.random() - 0.5) * 6, 0.25, 0.18, 0.05, '#ffd27a', 12);
    }
  }
  muzzle(pos) {
    this.firePool.emit(pos.x, pos.y, pos.z, 0, 0, 0, 0.05, 0.55, 0.3, '#fff0b0');
  }
  tracer(from, to) {
    const tr = this.tracers[this.tracerIndex++ % this.tracers.length];
    const p = tr.line.geometry.attributes.position;
    p.setXYZ(0, from.x, from.y, from.z); p.setXYZ(1, to.x, to.y, to.z);
    p.needsUpdate = true;
    tr.line.geometry.computeBoundingSphere();
    tr.line.visible = true; tr.t = 0.05;
  }
  shakeAt(pos, amount) {
    const d = this._dist(pos);
    this.shake = Math.max(this.shake, amount * Math.max(0, 1 - d / 60));
  }
  _dist(pos) { return this.camera.position.distanceTo(pos); }

  update(dt) {
    this.smokePool.update(dt, this.camera);
    this.firePool.update(dt, this.camera);
    for (const tr of this.tracers) {
      if (!tr.line.visible) continue;
      tr.t -= dt;
      if (tr.t <= 0) tr.line.visible = false;
    }
    this.shake = Math.max(0, this.shake - dt * 2.5);
  }
}

// ───────────────────────────── Sons ─────────────────────────────
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noise = null;
    this.siren = null;
    this.engine = null;
  }
  /** À appeler après un toucher / clic (obligatoire sur iPhone pour avoir du son). */
  unlock() {
    try {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        this.ctx = new AC();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.ctx.destination);
        const len = this.ctx.sampleRate * 1.5;
        this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
    } catch (e) { this.ctx = null; }
  }
  _vol(dist) { return Math.max(0, 1 - dist / 140); }
  _burst(duration, freq, type, vol, attack = 0.002) {
    if (!this.ctx || vol <= 0.01) return;
    const t = this.ctx.currentTime;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + duration);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t, Math.random() * 0.5); src.stop(t + duration + 0.05);
  }
  gunshot(kind = 'pistol', dist = 0) {
    const v = this._vol(dist);
    if (kind === 'rifle') { this._burst(0.16, 1800, 'lowpass', 0.8 * v); this._burst(0.08, 4000, 'highpass', 0.25 * v); }
    else { this._burst(0.22, 1300, 'lowpass', 0.9 * v); this._burst(0.05, 3500, 'highpass', 0.3 * v); }
  }
  explosion(dist = 0) {
    const v = this._vol(dist * 0.6);
    this._burst(1.4, 380, 'lowpass', 1.0 * v, 0.01);
    this._burst(0.4, 1500, 'lowpass', 0.5 * v, 0.003);
  }
  punch() {
    if (!this.ctx) return;
    this._burst(0.12, 500, 'lowpass', 0.7);
  }
  crash(intensity = 1) {
    this._burst(0.35, 900, 'bandpass', Math.min(1, 0.3 + intensity * 0.5));
  }
  /** Sirène de police continue (on = en poursuite). */
  setSiren(on, dist = 0) {
    if (!this.ctx) return;
    if (!this.siren) {
      const o = this.ctx.createOscillator(); o.type = 'square';
      const lfo = this.ctx.createOscillator(); lfo.frequency.value = 0.5;
      const lfoGain = this.ctx.createGain(); lfoGain.gain.value = 220;
      lfo.connect(lfoGain); lfoGain.connect(o.frequency);
      o.frequency.value = 720;
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 1600;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start(); lfo.start();
      this.siren = g;
    }
    const target = on ? 0.06 * this._vol(dist * 0.8) : 0;
    this.siren.gain.setTargetAtTime(target, this.ctx.currentTime, 0.15);
  }
  /** Moteur du véhicule conduit par le joueur (ratio = vitesse / vitesse max). */
  setEngine(on, ratio = 0, bike = false) {
    if (!this.ctx) return;
    if (!this.engine) {
      const o = this.ctx.createOscillator(); o.type = 'sawtooth';
      const f = this.ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 500;
      const g = this.ctx.createGain(); g.gain.value = 0;
      o.connect(f); f.connect(g); g.connect(this.master);
      o.start();
      this.engine = { o, g, f };
    }
    const now = this.ctx.currentTime;
    const base = bike ? 70 : 45;
    this.engine.o.frequency.setTargetAtTime(base + Math.abs(ratio) * (bike ? 190 : 120), now, 0.08);
    this.engine.f.frequency.setTargetAtTime(400 + Math.abs(ratio) * 900, now, 0.08);
    this.engine.g.gain.setTargetAtTime(on ? 0.035 + Math.abs(ratio) * 0.03 : 0, now, 0.1);
  }
}
