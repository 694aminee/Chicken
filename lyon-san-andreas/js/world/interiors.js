/**
 * interiors.js — Entrées / sorties des bâtiments et scènes intérieures.
 *
 * ÉTAPE 1 (actuelle) : détection des cercles lumineux posés par mapLyon.js et affichage
 *   de l'aide « E / F : entrer ». Les intérieurs eux-mêmes arrivent à l'étape 3.
 *
 * À VENIR :
 *  - Maison du joueur (planque) : lit = sauvegarde + avance l'heure + soin à 100 %,
 *    garde-robe (player.setOutfit), garage pour garder un véhicule.
 *  - Centre Commercial Part-Dieu : étages, escalators, boutiques, food-court (soins).
 *  - Gares Part-Dieu / Perrache : hall et quais.
 *  - Hôpital de la Croix-Rousse : point de réapparition après la mort.
 *  - Armurerie : achat d'armes et de munitions.
 *
 * Principe prévu : chaque intérieur est un THREE.Group construit à la demande, placé loin
 * sous la carte (ex. y = -500) ; on téléporte le joueur dedans et on masque la ville,
 * sans jamais recréer la scène principale.
 */

const INTERACT_DISTANCE = 2.2;

export class InteriorManager {
  /** @param {{game, scene, map, player, input, hud}} ctx */
  constructor(ctx) {
    this.ctx = ctx;
    this.current = null;   // intérieur dans lequel se trouve le joueur (null = dehors)
    this.nearby = null;    // lieu dont le joueur est proche
  }

  update(dt) {
    const { map, player, input, hud } = this.ctx;
    if (player.state !== 'alive') { hud.showPrompt(null); return; }
    let best = null, bestD = INTERACT_DISTANCE;
    for (const loc of map.locations) {
      if (!loc.marker) continue;
      const d = Math.hypot(loc.x - player.position.x, loc.z - player.position.z);
      if (d < bestD) { best = loc; bestD = d; }
    }
    this.nearby = best;
    hud.showPrompt(best ? `<kbd>E</kbd> Entrer : <b>${best.name}</b>` : null);
    if (best && input.wasPressed('KeyE', 'KeyF')) this.enter(best);
  }

  /** Entre dans un intérieur (implémenté à l'étape 3). */
  enter(loc) {
    this.ctx.hud.toast(`<b>${loc.name}</b> — intérieur disponible dans une prochaine étape 🚧`, 3);
  }

  /** Ressort à l'extérieur, devant la porte (étape 3). */
  exit() {}
}
