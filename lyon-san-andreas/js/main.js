/**
 * main.js — Point d'entrée du jeu.
 *
 *  - Création du moteur 3D (renderer, scène, caméra)
 *  - Gestion des entrées clavier / souris / tactile (Input)
 *  - Ciel, soleil, lune, étoiles et cycle jour/nuit (DayNight)
 *  - États du jeu : chargement → menu → en jeu ↔ pause / carte / boutique / mort
 *  - Interactions (touche E), fondus au noir, sauvegarde, écrans HOSPITALISÉ / ARRÊTÉ
 *  - Boucle principale qui met à jour tous les systèmes
 */
import * as THREE from 'three';
import { LyonMap } from './world/mapLyon.js';
import { InteriorManager } from './world/interiors.js';
import { Player } from './entities/player.js';
import { VehicleManager } from './entities/vehicles.js';
import { WeaponSystem } from './entities/weapons.js';
import { TrafficManager } from './entities/trafficNpc.js';
import { PoliceSystem } from './systems/police.js';
import { Effects } from './systems/effects.js';
import { HUD } from './ui/hud.js';
import { TouchControls, isTouchDevice } from './ui/touch.js';

const START_TIME = 10 * 60;  // 10:00
const TIME_SPEED = 1;        // 1 seconde réelle = 1 minute de jeu (journée de 24 min)
const FAST_TIME_SPEED = 45;  // touche T maintenue
const SAVE_KEY = 'lugdunum-save-v1';

// ───────────────────────────── Entrées ─────────────────────────────
class Input {
  constructor() {
    this.keys = new Set();
    this.pressed = new Set();
    this.mouseDX = 0; this.mouseDY = 0; this.wheel = 0;
    this._dx = 0; this._dy = 0; this._wheel = 0; this._wheelAcc = 0;
    this.locked = false;
    this.dragging = false;
    // commandes tactiles (joystick analogique)
    this.axisX = 0; this.axisY = 0; this.virtualSprint = false;
  }
  attach(canvas) {
    const block = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab']);
    window.addEventListener('keydown', (e) => {
      if (block.has(e.code)) e.preventDefault();
      if (!e.repeat) this.pressed.add(e.code);
      this.keys.add(e.code);
    });
    window.addEventListener('keyup', (e) => this.keys.delete(e.code));
    window.addEventListener('blur', () => { this.keys.clear(); });
    window.addEventListener('mousemove', (e) => {
      if (this.locked || this.dragging) { this._dx += e.movementX || 0; this._dy += e.movementY || 0; }
    });
    canvas.addEventListener('mousedown', (e) => {
      if (this.locked) { this.keys.add('Mouse' + e.button); this.pressed.add('Mouse' + e.button); }
      else this.dragging = true;
    });
    window.addEventListener('mouseup', (e) => { this.keys.delete('Mouse' + e.button); this.dragging = false; });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { this._wheel += e.deltaY; }, { passive: true });
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      if (!this.locked) { this.keys.delete('Mouse0'); this.keys.delete('Mouse2'); }
    });
  }
  /** À appeler au début de chaque image. */
  beginFrame() {
    this.mouseDX = this._dx; this.mouseDY = this._dy;
    this._wheelAcc += this._wheel;
    this.wheel = Math.abs(this._wheelAcc) >= 50 ? Math.sign(this._wheelAcc) : 0;
    if (this.wheel) this._wheelAcc = 0;
    this._wheelAcc *= 0.9;
    this._dx = this._dy = this._wheel = 0;
  }
  /** À appeler à la fin de chaque image. */
  endFrame() { this.pressed.clear(); }
  isDown(...codes) { return codes.some((c) => this.keys.has(c)); }
  wasPressed(...codes) { return codes.some((c) => this.pressed.has(c)); }
  isMouseDown(b = 0) { return this.keys.has('Mouse' + b); }
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
  /** Avance l'heure (lit de la planque, mort, arrestation). */
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

    if (this.interior) { // éclairage intérieur fixe (lampes)
      this.sun.color.set('#fff1dc'); this.sun.intensity = 1.1;
      this.hemi.intensity = 1.35; this.hemi.color.set('#fff4e6'); this.hemi.groundColor.set('#8a7a66');
      this.scene.fog.far = 4000;
      this.sun.position.copy(focus).add(new THREE.Vector3(6, 40, 10));
      this.sun.target.position.copy(focus);
      this.sky.position.copy(camera.position);
      this.stars.position.copy(camera.position);
      return;
    }
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
      newGame: document.getElementById('new-button'),
      pause: document.getElementById('pause-screen'),
      help: document.getElementById('help-panel'),
      death: document.getElementById('death-screen'),
      deathText: document.getElementById('death-text'),
      mapClose: document.getElementById('map-close'),
      fade: document.getElementById('fade'),
      fadeText: document.getElementById('fade-text'),
    };
    this._offers = [];
  }

  async init(hot = {}) {
    this.isTouch = isTouchDevice();
    document.body.classList.toggle('touch', this.isTouch);
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: !this.isTouch, powerPreference: 'high-performance' });
    } catch (e) {
      throw new Error("WebGL n'est pas disponible dans ce navigateur. Essayez Chrome, Safari, Edge ou Firefox récents.");
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

    this.map = new LyonMap(this.scene, { anisotropy: Math.min(8, renderer.capabilities.getMaxAnisotropy()) });
    await this.map.build((text, frac) => {
      this.ui.loadingText.textContent = text + '…';
      this.ui.loadingBar.style.width = `${Math.round(frac * 90)}%`;
    });
    this.ui.loadingText.textContent = 'Circulation, piétons et police…';
    await new Promise((r) => setTimeout(r, 16));

    this.effects = new Effects(this.scene, this.camera);
    this.player = new Player({ scene: this.scene, camera: this.camera, map: this.map, input: this.input });
    const sp = this.map.spawn;
    this.player.teleport(sp.x, sp.z, sp.yaw);
    this.player.onDeath = () => this.gameOver('wasted');
    if (this.isTouch) this.touch = new TouchControls(this.input);

    this.hud = new HUD(this.map);
    this.hud.camera = this.camera;
    this.hud.onMapClick = (x, z) => {
      if (this.player.vehicle) this.vehicles.exitPlayer(true);
      this.player.teleport(x, z, this.player.yaw);
      this.hud.toast(`Téléportation : ${this.map.getDistrictName(x, z)}`);
    };
    const ctx = { game: this, scene: this.scene, map: this.map, player: this.player, input: this.input, hud: this.hud, camera: this.camera };
    this.interiors = new InteriorManager(ctx);
    this.traffic = new TrafficManager(ctx);
    this.vehicles = new VehicleManager(ctx);
    this.weapons = new WeaponSystem(ctx);
    this.police = new PoliceSystem(ctx);

    // garde la partie en cours quand la page en ligne est mise à jour
    window.claude?.hot?.snapshot?.(() => ({ save: this._saveData(), pos: { x: this.player.position.x, z: this.player.position.z, yaw: this.player.yaw } }));
    this.hot = hot && hot.save ? hot : null;

    // compilation des shaders avant d'afficher le menu
    this.dayNight.update(0, this.camera, this.player.position);
    this.map.setNight(this.dayNight.night);
    renderer.compile(this.scene, this.camera);

    this._bindUi();
    this.ui.loading.classList.add('hidden');
    this._refreshMenu();
    this._setState('menu');
    this.clock = new THREE.Clock();
    this._fpsAcc = 0; this._fpsFrames = 0;
    renderer.setAnimationLoop(() => this._frame());
    window.game = this; // pratique pour déboguer dans la console
  }

  // ─── Sauvegarde ───
  _saveData() {
    const p = this.player;
    return {
      v: 1, money: p.stats.money, health: p.stats.health, armor: p.stats.armor, outfit: p.outfit,
      weapons: this.weapons.serialize(), minutes: this.dayNight.minutes, garage: this.vehicles.garage,
    };
  }
  saveGame(toast = true) {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this._saveData())); if (toast) this.hud.toast('Partie sauvegardée'); return true; }
    catch (e) { if (toast) this.hud.toast('Sauvegarde impossible sur ce navigateur'); return false; }
  }
  _readSave() {
    try { const s = localStorage.getItem(SAVE_KEY); return s ? JSON.parse(s) : null; } catch (e) { return null; }
  }
  _applySave(d) {
    const p = this.player;
    if (typeof d.money === 'number') p.stats.money = d.money;
    if (typeof d.health === 'number') p.stats.health = Math.max(20, d.health);
    if (typeof d.armor === 'number') p.stats.armor = d.armor;
    if (d.outfit) p.setOutfit(d.outfit);
    this.weapons.load(d.weapons);
    if (typeof d.minutes === 'number') this.dayNight.minutes = d.minutes;
    this.vehicles.garage = d.garage || null;
  }
  _refreshMenu() {
    const save = this._readSave();
    this.ui.play.textContent = save ? 'CONTINUER' : 'JOUER';
    this.ui.newGame.classList.toggle('hidden', !save);
  }

  _bindUi() {
    const start = (fresh) => {
      if (this.state === 'menu' && !this._started) {
        this._started = true;
        const save = fresh ? null : (this.hot?.save || this._readSave());
        if (fresh) { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* rien */ } }
        if (save) {
          this._applySave(save);
          const pos = this.hot?.pos;
          if (pos) this.player.teleport(pos.x, pos.z, pos.yaw);
          else {
            const home = this.map.locations.find((l) => l.id === 'planque');
            this.player.teleport(home.x, home.z + 3, 0);
          }
          this.hud.toast('Partie chargée — bienvenue à la planque !', 3);
        }
      }
      this.effects.sfx.unlock();
      this._startPlaying();
    };
    this.ui.play.addEventListener('click', () => start(false));
    this.ui.newGame.addEventListener('click', () => start(true));
    this.ui.pause.addEventListener('click', () => this._startPlaying());
    this.ui.mapClose.addEventListener('click', () => this._toggleMap(false));
    document.addEventListener('pointerlockchange', () => {
      if (!this.input.locked && this.state === 'playing') this._setState('paused');
    });
    document.addEventListener('pointerlockerror', () => {
      if (this.state === 'paused' || this.state === 'menu') this._setState('playing');
    });
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.touch?.releaseAll(); });
  }

  _startPlaying() {
    this._setState('playing');
    if (this.isTouch) return;
    try {
      const p = this.canvas.requestPointerLock?.();
      if (p && p.catch) p.catch(() => {});
    } catch (e) { /* le jeu reste jouable au clic-glisser */ }
  }

  _setState(s) {
    this.state = s;
    this.touch?.releaseAll();
    this.ui.menu.classList.toggle('hidden', s !== 'menu');
    this.ui.pause.classList.toggle('hidden', s !== 'paused');
    document.body.classList.toggle('in-game', s === 'playing' || s === 'map' || s === 'dead' || s === 'panel');
  }

  openPanelState() {
    this._setState('panel');
    document.exitPointerLock?.();
  }
  closePanelState() { this._startPlaying(); }

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

  /** Propose une action sur la touche E (la priorité la plus haute gagne). text = null : action sans bulle. */
  offerInteraction(text, priority, action) { this._offers.push({ text, priority, action }); }

  /** Fondu au noir : action au milieu, puis retour à l'image. */
  fade(action, text = '', hold = 350, after = null) {
    const f = this.ui.fade;
    this.ui.fadeText.textContent = text || '';
    f.classList.add('on');
    this._fading = true;
    setTimeout(() => {
      try { action(); } catch (e) { console.error(e); }
      setTimeout(() => { f.classList.remove('on'); this._fading = false; after?.(); }, hold);
    }, 320);
  }

  /** Fin de partie : 'wasted' (mort → hôpital) ou 'busted' (arrêté → commissariat). */
  gameOver(kind) {
    if (this.state === 'dead') return;
    const p = this.player;
    if (p.vehicle) this.vehicles.exitPlayer(true);
    if (kind === 'busted') p.state = 'busted';
    this.ui.deathText.textContent = kind === 'busted' ? 'ARRÊTÉ' : 'HOSPITALISÉ';
    this.ui.death.classList.toggle('busted', kind === 'busted');
    this.ui.death.classList.add('show');
    this._setState('dead');
    setTimeout(() => {
      this.police.reset();
      if (this.interiors.current) this.interiors.exit(undefined, true);
      this.dayNight.advance(kind === 'busted' ? 60 * 4 : 60 * 2);
      p.addMoney(-100);
      if (kind === 'busted') {
        this.weapons.loseAll();
        const pol = this.map.locations.find((l) => l.id === 'police');
        p.respawn(pol.spawn);
        this.hud.toast('Libéré du commissariat : <b>-$100</b>, armes confisquées', 4);
      } else {
        const hosp = this.map.locations.find((l) => l.id === 'hopital');
        p.respawn(hosp.spawn);
        const it = this.interiors.get('hospital');
        this.interiors.enter('hospital', hosp, it.bedSpawn, true);
        this.hud.toast('Soigné à l\'Hôpital de la Croix-Rousse : <b>-$100</b>', 4);
      }
      this.ui.death.classList.remove('show');
      this._setState('playing');
      if (!this.isTouch) this._startPlaying();
    }, 3800);
  }

  _onResize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h);
    this.hud?._setupRadar();
  }

  _updateBodyClasses() {
    const p = this.player, b = document.body.classList;
    const v = p.vehicle;
    if (this._lastV !== v) { this._lastV = v; b.toggle('in-vehicle', !!v); b.toggle('on-bike', !!v && v.isBike); }
  }

  _frame() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const input = this.input;
    input.beginFrame();

    this._fpsAcc += dt; this._fpsFrames++;
    if (this._fpsAcc > 1) { this.hud.showFps(Math.round(this._fpsFrames / this._fpsAcc)); this._fpsAcc = 0; this._fpsFrames = 0; }

    if (input.wasPressed('KeyH')) this.ui.help.classList.toggle('hidden');
    if (input.wasPressed('KeyM') && (this.state === 'playing' || this.state === 'map')) this._toggleMap(this.state !== 'map');

    if (this.state === 'menu') {
      const t = performance.now() * 0.00004;
      this.camera.position.set(-65 + Math.cos(t) * 520, 190, 300 + Math.sin(t) * 520);
      this.camera.lookAt(-40, 20, 0);
      this.dayNight.update(dt * 0.3, this.camera, new THREE.Vector3(-65, 0, 300));
      this.map.setNight(smoothstep(0.35, 0.9, this.dayNight.night));
      this.map.update(dt);
    } else if (this.state === 'playing' || this.state === 'dead') {
      const inside = !!this.interiors.current;
      this._offers.length = 0;
      this.dayNight.speed = input.isDown('KeyT') ? FAST_TIME_SPEED : TIME_SPEED;
      this.player.controlsEnabled = this.state === 'playing' && !this._fading;
      if (!inside) this.vehicles.update(dt);
      this.player.update(dt);
      this.traffic.update(dt);
      this.weapons.update(dt);
      this.police.update(dt);
      this.interiors.update(dt);
      this.effects.update(dt);
      this.map.update(dt);
      this.dayNight.update(dt, this.camera, this.player.position);
      this.map.setNight(smoothstep(0.35, 0.9, this.dayNight.night));
      // interaction (E / F)
      let best = null;
      for (const o of this._offers) if (!best || o.priority > best.priority) best = o;
      const shown = this._offers.filter((o) => o.text).sort((a, b) => b.priority - a.priority)[0];
      this.hud.showPrompt(shown && this.state === 'playing' ? `<kbd>E</kbd> ${shown.text}` : null);
      if (best && this.state === 'playing' && !this._fading && input.wasPressed('KeyE', 'KeyF')) best.action();
      if (!inside) this.hud.showZone(this.map.getDistrictName(this.player.position.x, this.player.position.z));
      this.hud.blips = this.police.blips();
      // tremblement de caméra (explosions, chocs)
      const sh = this.effects.shake;
      if (sh > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh, (Math.random() - 0.5) * sh));
    }
    if (this.state !== 'menu') {
      this._updateBodyClasses();
      this.hud.update(dt, { player: this.player, clock: this.dayNight.clockText, camYaw: this.player.camYaw });
    }
    this.renderer.render(this.scene, this.camera);
    input.endFrame();
  }
}

// ───────────────────────────── Lancement ─────────────────────────────
const game = new Game();
const start = (saved) => game.init(saved || {}).catch((err) => {
  console.error(err);
  const t = document.getElementById('loading-text');
  t.textContent = `Erreur : ${err.message}`;
  t.classList.add('error');
});
if (window.claude?.hot?.ready) window.claude.hot.ready(start);
else start(window.claude?.hot?.data ?? {});
