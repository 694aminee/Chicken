/**
 * main.js — Point d'entrée du jeu.
 *
 *  - Création du moteur 3D (renderer, scène, caméra)
 *  - Gestion des entrées clavier/souris (Input)
 *  - Ciel, soleil, lune, étoiles et cycle jour/nuit (DayNight)
 *  - États du jeu : chargement → menu → en jeu ↔ pause / carte / mort
 *  - Boucle principale qui met à jour tous les systèmes
 */
import * as THREE from 'three';
import { LyonMap, WORLD } from './world/mapLyon.js';
import { InteriorManager } from './world/interiors.js';
import { Player } from './entities/player.js';
import { VehicleManager } from './entities/vehicles.js';
import { WeaponSystem } from './entities/weapons.js';
import { TrafficManager } from './entities/trafficNpc.js';
import { PoliceSystem } from './systems/police.js';
import { HUD } from './ui/hud.js';

const START_TIME = 10 * 60;  // 10:00
const TIME_SPEED = 1;        // 1 seconde réelle = 1 minute de jeu (journée de 24 min)
const FAST_TIME_SPEED = 45;  // touche T maintenue

// ───────────────────────────── Entrées ─────────────────────────────
class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseButtons = new Set();
    this.clicked = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this._dx = 0; this._dy = 0; this._wheel = 0;
    this.locked = false;
    this.dragging = false;
  }
  attach(canvas) {
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); this.mouseButtons.clear(); });
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) { this._dx += e.movementX || 0; this._dy += e.movementY || 0; }
    });
    canvas.addEventListener('mousedown', (e) => {
      this.mouseButtons.add(e.button); this.clicked.add(e.button);
      if (!this.locked) this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => { this.mouseButtons.delete(e.button); this.dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this._wheel += e.deltaY; }, { passive: true });
    document.addEventListener('pointerlockchange', () => { this.locked = document.pointerLockElement === canvas; });
  }
  /** À appeler au début de chaque image. */
  beginFrame() {
    this.mouseDX = this._dx; this.mouseDY = this._dy; this.wheel = this._wheel;
    this._dx = this._dy = this._wheel = 0;
  }
  /** À appeler à la fin de chaque image. */
  endFrame() { this.pressed.clear(); this.clicked.clear(); }
  isDown(...codes) { return codes.some((c) => this.keys.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  isMouseDown(b = 0) { return this.mouseButtons.has(b); }
  wasClicked(b = 0) { return this.clicked.has(b); }
}

// ───────────────────────────── Ciel & jour/nuit ─────────────────────────────
const SKY_VERT = /* glsl */`
  varying vec3 vDir;
  void main() {
    vDir = normalize(position);
    vec4 p = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * p;
  }`;
const SKY_FRAG = /* glsl */`
  uniform vec3 topColor; uniform vec3 horizonColor; uniform vec3 bottomColor;
  uniform vec3 sunDir; uniform vec3 sunColor; uniform vec3 moonDir; uniform float night;
  varying vec3 vDir;
  void main() {
    vec3 d = normalize(vDir);
    float h = d.y;
    vec3 col = h > 0.0 ? mix(horizonColor, topColor, pow(clamp(h, 0.0, 1.0), 0.55)) : mix(horizonColor, bottomColor, clamp(-h * 4.0, 0.0, 1.0));
    float s = max(dot(d, sunDir), 0.0);
    float sunVis = smoothstep(-0.12, 0.05, sunDir.y);
    col += sunColor * (pow(s, 900.0) * 3.0 + pow(s, 12.0) * 0.35 + pow(s, 3.0) * 0.08) * sunVis;
    float m = max(dot(d, moonDir), 0.0);
    col += vec3(0.85, 0.9, 1.0) * (smoothstep(0.9993, 0.9996, m) * 1.2 + pow(m, 60.0) * 0.08) * night;
    gl_FragColor = vec4(col, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }`;

const C = (hex) => new THREE.Color(hex);
const PALETTE = {
  dayTop: C('#2f6fd0'), dayHorizon: C('#a9cdee'),
  duskTop: C('#3a4f8f'), duskHorizon: C('#f2925a'),
  nightTop: C('#02050f'), nightHorizon: C('#0c1530'),
  bottom: C('#3b3f44'),
};
const smoothstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

class DayNight {
  constructor(scene) {
    this.scene = scene;
    this.minutes = START_TIME;
    this.speed = TIME_SPEED;

    this.hemi = new THREE.HemisphereLight('#bcd7ff', '#5a4e3d', 1.0);
    scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight('#fff4e0', 2.6);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -110; sc.right = 110; sc.top = 110; sc.bottom = -110; sc.near = 10; sc.far = 1000;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.04;
    scene.add(this.sun, this.sun.target);

    this.skyUniforms = {
      topColor: { value: new THREE.Color() }, horizonColor: { value: new THREE.Color() }, bottomColor: { value: PALETTE.bottom.clone() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunColor: { value: new THREE.Color('#fff2d0') },
      moonDir: { value: new THREE.Vector3(0, -1, 0) }, night: { value: 0 },
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(2500, 32, 16), new THREE.ShaderMaterial({
      uniforms: this.skyUniforms, vertexShader: SKY_VERT, fragmentShader: SKY_FRAG, side: THREE.BackSide, depthWrite: false, fog: false,
    }));
    sky.frustumCulled = false; sky.renderOrder = -10;
    this.sky = sky;
    scene.add(sky);

    const starGeo = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 1800; i++) {
      const u = Math.random(), v = Math.random() * 0.95 + 0.05;
      const th = u * Math.PI * 2, y = v;
      const r = Math.sqrt(1 - y * y);
      pts.push(Math.cos(th) * r * 2300, y * 2300, Math.sin(th) * r * 2300);
    }
    starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.stars = new THREE.Points(starGeo, new THREE.PointsMaterial({ color: '#ffffff', size: 1.6, sizeAttenuation: false, transparent: true, opacity: 0, fog: false, depthWrite: false }));
    this.stars.frustumCulled = false;
    scene.add(this.stars);

    scene.fog = new THREE.Fog('#a9cdee', 260, 1500);
    this.night = 0;
    this.horizon = new THREE.Color();
  }

  get clockText() {
    const m = Math.floor(this.minutes);
    return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
  }
  /** Avance l'heure (utilisé par le lit de la planque à l'étape 3). */
  advance(minutes) { this.minutes = (this.minutes + minutes) % 1440; }

  update(dt, camera, focus) {
    this.minutes = (this.minutes + dt * this.speed) % 1440;
    const theta = ((this.minutes - 360) / 720) * Math.PI; // 6h = lever (est), 12h = zénith, 18h = coucher (ouest)
    const sunDir = new THREE.Vector3(Math.cos(theta), Math.sin(theta), 0.35).normalize();
    const elev = sunDir.y;
    const day = smoothstep(-0.1, 0.22, elev);
    const dusk = Math.max(0, 1 - Math.abs(elev) / 0.3) * (elev > -0.25 ? 1 : 0);
    this.night = 1 - day;

    const top = PALETTE.nightTop.clone().lerp(PALETTE.dayTop, day).lerp(PALETTE.duskTop, dusk * 0.45);
    const hor = PALETTE.nightHorizon.clone().lerp(PALETTE.dayHorizon, day).lerp(PALETTE.duskHorizon, dusk * 0.65);
    this.horizon.copy(hor);
    const u = this.skyUniforms;
    u.topColor.value.copy(top); u.horizonColor.value.copy(hor);
    u.bottomColor.value.copy(PALETTE.bottom).lerp(hor, 0.3).multiplyScalar(0.4 + day * 0.6);
    u.sunDir.value.copy(sunDir);
    u.sunColor.value.set('#ffb070').lerp(C('#fff2d0'), smoothstep(0, 0.4, elev));
    const moonDir = new THREE.Vector3(-sunDir.x, -sunDir.y, -0.25).normalize();
    u.moonDir.value.copy(moonDir);
    u.night.value = this.night;

    this.scene.fog.color.copy(hor);
    this.scene.fog.far = 1100 + day * 500;
    this.stars.material.opacity = Math.pow(this.night, 2);

    // lumière principale : soleil le jour, lune la nuit
    const useSun = elev > -0.05;
    const lightDir = useSun ? sunDir : moonDir;
    this.sun.color.copy(useSun ? u.sunColor.value : C('#8fa8d8'));
    this.sun.intensity = useSun ? 0.2 + 2.6 * smoothstep(-0.05, 0.3, elev) : 0.9 * smoothstep(-0.05, 0.3, moonDir.y);
    this.hemi.intensity = 0.85 + 0.32 * day;
    this.hemi.color.copy(C('#93a6dc')).lerp(C('#bcd7ff'), day).lerp(C('#ffc49a'), dusk * 0.4);
    this.hemi.groundColor.set('#4a4038').lerp(C('#5a4e3d'), day);

    this.sun.position.copy(focus).addScaledVector(lightDir, 450);
    this.sun.target.position.copy(focus);
    this.sky.position.copy(camera.position);
    this.stars.position.copy(camera.position);
  }
}

// ───────────────────────────── Jeu ─────────────────────────────
class Game {
  constructor() {
    this.state = 'loading';
    this.canvas = document.getElementById('game-canvas');
    this.ui = {
      loading: document.getElementById('loading-screen'),
      loadingText: document.getElementById('loading-text'),
      loadingBar: document.getElementById('loading-bar'),
      menu: document.getElementById('menu-screen'),
      play: document.getElementById('play-button'),
      pause: document.getElementById('pause-screen'),
      help: document.getElementById('help-panel'),
      death: document.getElementById('death-screen'),
      mapClose: document.getElementById('map-close'),
    };
  }

  async init() {
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error("WebGL n'est pas disponible dans ce navigateur. Essayez Chrome, Edge ou Firefox récents.");
    }
    this.renderer = renderer;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.0;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 3000);
    this.camera.position.set(0, 80, 400);
    window.addEventListener('resize', () => this._onResize());

    this.input = new Input();
    this.input.attach(this.canvas);
    this.dayNight = new DayNight(this.scene);

    this.map = new LyonMap(this.scene, { anisotropy: renderer.capabilities.getMaxAnisotropy() });
    await this.map.build((text, frac) => {
      this.ui.loadingText.textContent = text + '…';
      this.ui.loadingBar.style.width = `${Math.round(frac * 100)}%`;
    });

    this.player = new Player({ scene: this.scene, camera: this.camera, map: this.map, input: this.input });
    const sp = this.map.spawn;
    this.player.teleport(sp.x, sp.z, sp.yaw);
    this.player.onDeath = () => this._onPlayerDeath();

    this.hud = new HUD(this.map);
    this.hud.onMapClick = (x, z) => {
      this.player.teleport(x, z, this.player.yaw);
      this.hud.toast(`Téléportation : ${this.map.getDistrictName(x, z)}`);
    };
    const ctx = { game: this, scene: this.scene, map: this.map, player: this.player, input: this.input, hud: this.hud, camera: this.camera };
    this.interiors = new InteriorManager(ctx);
    this.vehicles = new VehicleManager(ctx);
    this.weapons = new WeaponSystem(ctx);
    this.traffic = new TrafficManager(ctx);
    this.police = new PoliceSystem(ctx);
    this.systems = [this.interiors, this.vehicles, this.weapons, this.traffic, this.police];

    // compilation des shaders avant d'afficher le menu
    this.dayNight.update(0, this.camera, this.player.position);
    this.map.setNight(this.dayNight.night);
    renderer.compile(this.scene, this.camera);

    this._bindUi();
    this.ui.loading.classList.add('hidden');
    this._setState('menu');
    this.clock = new THREE.Clock();
    this._fpsAcc = 0; this._fpsFrames = 0;
    renderer.setAnimationLoop(() => this._frame());
    window.game = this; // pratique pour déboguer dans la console
  }

  _bindUi() {
    this.ui.play.addEventListener('click', () => this._startPlaying());
    this.ui.pause.addEventListener('click', () => this._startPlaying());
    this.ui.mapClose.addEventListener('click', () => this._toggleMap(false));
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.state === 'playing') this._setState('paused');
    });
    document.addEventListener('pointerlockerror', () => {
      // Certains navigateurs refusent le verrouillage : on joue quand même (caméra au clic-glisser)
      if (this.state === 'paused' || this.state === 'menu') this._setState('playing');
    });
  }

  _startPlaying() {
    this._setState('playing');
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* le jeu reste jouable au clic-glisser */ }
  }

  _setState(s) {
    this.state = s;
    this.ui.menu.classList.toggle('hidden', s !== 'menu');
    this.ui.pause.classList.toggle('hidden', s !== 'paused');
    document.body.classList.toggle('in-game', s === 'playing' || s === 'map' || s === 'dead');
  }

  _toggleMap(open) {
    if (open) {
      this._setState('map');
      document.exitPointerLock?.();
      this.hud.openMap(true);
    } else {
      this.hud.openMap(false);
      this._startPlaying();
    }
  }

  _onPlayerDeath() {
    this.ui.death.classList.add('show');
    this._setState('dead');
    setTimeout(() => {
      const hosp = this.map.locations.find((l) => l.id === 'hopital');
      this.player.respawn(hosp.spawn);
      this.player.addMoney(-100);
      this.dayNight.advance(60 * 2);
      this.ui.death.classList.remove('show');
      this._setState('playing');
      this.hud.toast('Soins à l\'Hôpital de la Croix-Rousse : <b>-$100</b>', 4);
    }, 3500);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hud?._setupRadar();
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const input = this.input;
    input.beginFrame();

    // fps
    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc > 1) { this.hud.showFps(Math.round(this._fpsFrames / this._fpsAcc)); this._fpsAcc = 0; this._fpsFrames = 0; }

    if (input.wasPressed('KeyH')) this.ui.help.classList.toggle('hidden');
    if (input.wasPressed('KeyM') && (this.state === 'playing' || this.state === 'map')) this._toggleMap(this.state !== 'map');

    if (this.state === 'menu') {
      // caméra de présentation qui tourne autour de la Presqu'île
      const t = performance.now() * 0.00004;
      this.camera.position.set(-65 + Math.cos(t) * 520, 190, 300 + Math.sin(t) * 520);
      this.camera.lookAt(-40, 20, 0);
      this.dayNight.update(dt * 0.3, this.camera, new THREE.Vector3(-65, 0, 300));
      this.map.setNight(smoothstep(0.35, 0.9, this.dayNight.night));
      this.map.update(dt);
    } else if (this.state === 'playing' || this.state === 'dead') {
      const fast = input.isDown('KeyT');
      this.dayNight.speed = fast ? FAST_TIME_SPEED : TIME_SPEED;
      this.player.controlsEnabled = this.state === 'playing';
      this.player.update(dt);
      for (const s of this.systems) s.update(dt);
      this.map.update(dt);
      this.dayNight.update(dt, this.camera, this.player.position);
      this.map.setNight(smoothstep(0.35, 0.9, this.dayNight.night));
      this.hud.showZone(this.map.getDistrictName(this.player.position.x, this.player.position.z));
    }
    if (this.state !== 'menu') {
      this.hud.update(dt, { player: this.player, clock: this.dayNight.clockText, camYaw: this.player.camYaw });
    }
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }
}

// ───────────────────────────── Lancement ─────────────────────────────
const game = new Game();
game.init().catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  t.innerHTML = `<span class="error">Erreur : ${err.message}</span>`;
});
