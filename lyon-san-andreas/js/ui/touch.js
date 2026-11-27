/**
 * touch.js — Commandes tactiles pour téléphone et tablette (iPhone, iPad, Android).
 *
 *  - Joystick virtuel à gauche : il apparaît sous le doigt ; poussé à fond = sprint
 *  - Glisser le doigt sur la moitié droite : tourner la caméra
 *  - Boutons : Saut, Entrer (E), Caméra (V), Carte (M), Aide (H)
 *
 * Les boutons « appuient » sur les mêmes touches virtuelles que le clavier (input.keys),
 * donc le reste du jeu n'a rien de spécial à faire.
 */

const JOY_RADIUS = 58;
const LOOK_SPEED = 1.7;

export function isTouchDevice() {
  return (window.matchMedia && window.matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window || navigator.maxTouchPoints > 0;
}

export class TouchControls {
  constructor(input) {
    this.input = input;
    this.root = document.getElementById('touch-ui');
    this.joyZone = document.getElementById('joy-zone');
    this.lookZone = document.getElementById('look-zone');
    this.base = document.getElementById('joy-base');
    this.knob = document.getElementById('joy-knob');
    this.joyId = null;
    this.lookId = null;
    this.joyOrigin = { x: 0, y: 0 };
    this.lookLast = { x: 0, y: 0 };
    this._bind();
    this._resetJoystick();
  }

  _bind() {
    const opts = { passive: false };
    const find = (list, id) => { for (const t of list) if (t.identifier === id) return t; return null; };

    // Joystick
    this.joyZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.joyId !== null) return;
      const t = e.changedTouches[0];
      this.joyId = t.identifier;
      this.joyOrigin = { x: t.clientX, y: t.clientY };
      this.base.style.left = `${t.clientX}px`;
      this.base.style.top = `${t.clientY}px`;
      this.base.classList.add('active');
      this._moveJoy(t.clientX, t.clientY);
    }, opts);
    this.joyZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = find(e.changedTouches, this.joyId);
      if (t) this._moveJoy(t.clientX, t.clientY);
    }, opts);
    const endJoy = (e) => {
      e.preventDefault();
      if (find(e.changedTouches, this.joyId)) this._resetJoystick();
    };
    this.joyZone.addEventListener('touchend', endJoy, opts);
    this.joyZone.addEventListener('touchcancel', endJoy, opts);

    // Caméra
    this.lookZone.addEventListener('touchstart', (e) => {
      e.preventDefault();
      if (this.lookId !== null) return;
      const t = e.changedTouches[0];
      this.lookId = t.identifier;
      this.lookLast = { x: t.clientX, y: t.clientY };
    }, opts);
    this.lookZone.addEventListener('touchmove', (e) => {
      e.preventDefault();
      const t = find(e.changedTouches, this.lookId);
      if (!t) return;
      this.input._dx += (t.clientX - this.lookLast.x) * LOOK_SPEED;
      this.input._dy += (t.clientY - this.lookLast.y) * LOOK_SPEED;
      this.lookLast = { x: t.clientX, y: t.clientY };
    }, opts);
    const endLook = (e) => {
      e.preventDefault();
      if (find(e.changedTouches, this.lookId)) this.lookId = null;
    };
    this.lookZone.addEventListener('touchend', endLook, opts);
    this.lookZone.addEventListener('touchcancel', endLook, opts);

    // Boutons
    for (const btn of this.root.querySelectorAll('[data-key]')) {
      const code = btn.dataset.key;
      const down = (e) => {
        e.preventDefault();
        this.input.pressed.add(code);
        this.input.keys.add(code);
        btn.classList.add('down');
      };
      const up = (e) => {
        e.preventDefault();
        this.input.keys.delete(code);
        btn.classList.remove('down');
      };
      btn.addEventListener('touchstart', down, opts);
      btn.addEventListener('touchend', up, opts);
      btn.addEventListener('touchcancel', up, opts);
    }
  }

  _moveJoy(x, y) {
    let dx = x - this.joyOrigin.x, dy = y - this.joyOrigin.y;
    const d = Math.hypot(dx, dy);
    if (d > JOY_RADIUS) { dx *= JOY_RADIUS / d; dy *= JOY_RADIUS / d; }
    this.knob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    const mag = Math.min(1, d / JOY_RADIUS);
    const dead = mag < 0.18;
    this.input.axisX = dead ? 0 : dx / JOY_RADIUS;
    this.input.axisY = dead ? 0 : dy / JOY_RADIUS;
    this.input.virtualSprint = mag > 0.93;
    this.base.classList.toggle('sprint', this.input.virtualSprint);
  }

  _resetJoystick() {
    this.joyId = null;
    this.input.axisX = 0;
    this.input.axisY = 0;
    this.input.virtualSprint = false;
    this.base.classList.remove('active', 'sprint');
    this.base.style.left = '';
    this.base.style.top = '';
    this.knob.style.transform = 'translate(-50%, -50%)';
  }

  /** Relâche tout (changement d'écran, application en arrière-plan). */
  releaseAll() {
    this._resetJoystick();
    this.lookId = null;
    for (const btn of this.root.querySelectorAll('[data-key]')) {
      this.input.keys.delete(btn.dataset.key);
      btn.classList.remove('down');
    }
  }
}
