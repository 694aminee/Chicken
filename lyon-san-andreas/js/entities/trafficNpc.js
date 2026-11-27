/**
 * trafficNpc.js — Piétons et circulation routière.  (ÉTAPE 2)
 *
 * Prévu :
 *  - Graphe routier construit à partir de map.roads (rues, quais, montées, ponts) :
 *    les intersections deviennent des nœuds, les voitures suivent leur voie à droite.
 *  - Piétons sur les trottoirs (largeur de rue / 2 + 2 m), qui fuient les tirs et les
 *    véhicules fous, et qui peuvent être renversés (→ étoiles de recherche).
 *  - Apparition / disparition autour du joueur pour garder de bonnes performances.
 */

export class TrafficManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.cars = [];
    this.pedestrians = [];
    this.maxCars = 24;
    this.maxPedestrians = 40;
  }

  update(dt) {}
}
