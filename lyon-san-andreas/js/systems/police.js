/**
 * police.js — Indice de recherche et comportement de la police.  (ÉTAPE 4)
 *
 * Prévu :
 *  - 0 à 5 étoiles (player.stats.wanted), affichées par le HUD.
 *  - Déclencheurs : coups de feu en public, vol de véhicule devant la police,
 *    piétons renversés, agression d'un policier.
 *  - 1-2 ★ : patrouilles à pied et en voiture ; 3 ★ : poursuites agressives ;
 *    4-5 ★ : barrages sur les ponts du Rhône et de la Saône.
 *  - Semer la police : rester hors de vue un certain temps (le compteur clignote).
 */

export class PoliceSystem {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.heat = 0;        // jauge interne qui fait monter les étoiles
    this.lostTimer = 0;   // temps passé hors de vue
  }

  /** Signale un délit (type : 'gunshot', 'carjack', 'hitPedestrian', 'assaultCop'). */
  reportCrime(type, position) {}

  setWanted(level) {
    this.ctx.player.stats.wanted = Math.max(0, Math.min(5, level));
  }

  update(dt) {}
}
