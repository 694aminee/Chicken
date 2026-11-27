/**
 * vehicles.js — Voitures, motos et véhicules de police.  (ÉTAPE 2)
 *
 * Prévu :
 *  - Types : citadine compacte, berline rapide, moto/scooter (wheeling, inclinaison), police
 *    (bandes + gyrophare clignotant).
 *  - Monter / descendre : E ou F près d'un véhicule (player.visible = false au volant).
 *  - Conduite : ZQSD ou flèches, frein à main Espace ; caméra de poursuite.
 *  - Physique arcade : sol via map.getSurfaceHeight (ponts, pentes de la Croix-Rousse,
 *    tremplins), collisions via map.resolveCircle, sauts.
 *  - Dégâts progressifs → fumée → feu → explosion quand les PV tombent à 0.
 *  - Garage de la planque : sauvegarde d'un véhicule.
 */

export const VEHICLE_TYPES = {
  citadine: { name: 'Citadine', maxSpeed: 38, accel: 9, grip: 6.5, hp: 900 },
  berline: { name: 'Berline sport', maxSpeed: 52, accel: 13, grip: 7.5, hp: 1000 },
  moto: { name: 'Moto', maxSpeed: 55, accel: 16, grip: 9, hp: 500, twoWheels: true },
  scooter: { name: 'Scooter', maxSpeed: 30, accel: 10, grip: 8, hp: 400, twoWheels: true },
  police: { name: 'Police', maxSpeed: 50, accel: 12, grip: 7.5, hp: 1200, siren: true },
};

export class VehicleManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.vehicles = [];
    this.playerVehicle = null; // véhicule conduit par le joueur
  }

  /** Fait apparaître un véhicule (étape 2). */
  spawn(type, x, z, yaw = 0) { return null; }

  update(dt) {}
}
