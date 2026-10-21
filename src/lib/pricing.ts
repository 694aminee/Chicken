// Calcul des prix et vérification des choix d'un produit.
// Ces fonctions serviront aussi côté serveur (étape 2) pour recalculer
// le prix à partir de la base, sans jamais faire confiance au navigateur.

import type { OptionGroup, Product } from "./menu";

/** Choix faits par le client : id du groupe -> ids des choix cochés */
export type Selection = Record<string, string[]>;

export function initialSelection(product: Product): Selection {
  const sel: Selection = {};
  for (const g of product.options) sel[g.id] = g.defaultChoice ? [g.defaultChoice] : [];
  return sel;
}

export function isVisible(group: OptionGroup, sel: Selection): boolean {
  if (!group.showIf) return true;
  return (sel[group.showIf.group] ?? []).includes(group.showIf.choice);
}

export function groupOk(group: OptionGroup, sel: Selection): boolean {
  if (!isVisible(group, sel)) return true;
  const n = (sel[group.id] ?? []).length;
  return n >= group.min && n <= group.max;
}

export function selectionOk(product: Product, sel: Selection): boolean {
  return product.options.every((g) => groupOk(g, sel));
}

/** Coche ou décoche un choix, en respectant le min/max du groupe */
export function toggleChoice(product: Product, sel: Selection, groupId: string, choiceId: string): Selection {
  const group = product.options.find((g) => g.id === groupId);
  if (!group) return sel;
  const current = sel[groupId] ?? [];
  let next: string[];
  if (group.max === 1) {
    // Un seul choix possible : on remplace (ou on décoche si c'est facultatif)
    next = current[0] === choiceId && group.min === 0 ? [] : [choiceId];
  } else if (current.includes(choiceId)) {
    next = current.filter((c) => c !== choiceId);
  } else if (current.length < group.max) {
    next = [...current, choiceId];
  } else {
    next = current;
  }
  const result: Selection = { ...sel, [groupId]: next };
  // Les groupes devenus invisibles (ex. boisson quand on repasse en « Seul ») sont vidés
  for (const g of product.options) if (!isVisible(g, result)) result[g.id] = [];
  return result;
}

/** Prix d'un exemplaire, options comprises, en centimes */
export function unitPrice(product: Product, sel: Selection): number {
  let total = product.price;
  for (const g of product.options) {
    if (!isVisible(g, sel)) continue;
    for (const id of sel[g.id] ?? []) total += g.choices.find((c) => c.id === id)?.price ?? 0;
  }
  return total;
}

/** Résumé lisible des choix, ex. « Poulet · Sauces : Mayo, Curry · Seul » */
export function describe(product: Product, sel: Selection): string {
  return product.options
    .filter((g) => isVisible(g, sel) && (sel[g.id] ?? []).length > 0)
    .map((g) => {
      const names = sel[g.id].map((id) => g.choices.find((c) => c.id === id)?.name ?? id).join(", ");
      return g.labelInSummary ? `${g.label} : ${names}` : names;
    })
    .join(" · ");
}

/** Vérifie qu'une sélection reçue est valable (choix existants, min/max respectés) */
export function validateSelection(product: Product, sel: Selection): string | null {
  for (const key of Object.keys(sel)) {
    if (!product.options.some((g) => g.id === key)) return `Option inconnue : ${key}`;
  }
  for (const g of product.options) {
    const ids = sel[g.id] ?? [];
    if (new Set(ids).size !== ids.length) return `Choix en double dans « ${g.label} »`;
    if (ids.some((id) => !g.choices.some((c) => c.id === id))) return `Choix inconnu dans « ${g.label} »`;
    if (!isVisible(g, sel) && ids.length > 0) return `« ${g.label} » ne s'applique pas ici`;
    if (!groupOk(g, sel)) return `Choix incomplet : ${g.label}`;
  }
  return null;
}

export function formatEuros(cents: number): string {
  return (cents / 100).toFixed(2).replace(".", ",") + "\u00a0€"; // espace insécable : « €» ne passe jamais seul à la ligne
}
