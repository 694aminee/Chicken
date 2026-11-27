/**
 * weapons.js — Armes, visée, tirs et impacts.  (ÉTAPE 4)
 *
 * Prévu :
 *  - Armes : 1 Poings, 2 Batte, 3 Pistolet, 4 Fusil d'assaut (molette pour changer).
 *  - Clic droit : viser (caméra rapprochée par-dessus l'épaule + réticule).
 *  - Clic gauche : frapper / tirer ; munitions et rechargement ; impacts sur les murs.
 *  - Les coups de feu en public alertent les piétons (fuite) et la police (étoiles).
 *  - Achat de munitions à l'armurerie (interiors.js).
 */

export const WEAPONS = [
  { id: 'fist', name: 'Poings', damage: 8, range: 1.4, rate: 2.5, melee: true },
  { id: 'bat', name: 'Batte', damage: 22, range: 1.9, rate: 1.6, melee: true },
  { id: 'pistol', name: 'Pistolet', damage: 25, range: 60, rate: 3, clip: 12, price: 300 },
  { id: 'rifle', name: "Fusil d'assaut", damage: 18, range: 110, rate: 9, clip: 30, price: 1500, auto: true },
];

export class WeaponSystem {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.owned = new Set(['fist']);
    this.current = 0;
  }

  update(dt) {}
}
