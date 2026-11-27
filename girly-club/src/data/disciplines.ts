/**
 * Disciplines et tarifs du club (repris de la page Planity).
 * Pour changer un prix : modifier le nombre `price` ci-dessous.
 */

export type DisciplineId =
  | "reformer"
  | "sol"
  | "boxe"
  | "cross"
  | "aquabike"
  | "taekwondo"
  | "machines";

export type Offer = {
  /** « Abonnée », « Non-abonnée »… (affiché en gras) */
  audience?: "Abonnée" | "Non-abonnée";
  label: string;
  detail?: string;
  /** Prix en euros. Absent = inclus dans un abonnement / forfait. */
  price?: number;
  /** Petite étiquette mise en avant (ex. « Découverte »). */
  badge?: string;
};

export type Discipline = {
  id: DisciplineId;
  name: string;
  /** Durée affichée (ex. « 50 min »). */
  duration: string;
  /** Phrase d'accroche courte (bulle 3D + carte). */
  pitch: string;
  description: string;
  /** Couleur d'accent de la carte. */
  tone: "terracotta" | "rose" | "charcoal" | "sand";
  offers: Offer[];
};

export const DISCIPLINES: Discipline[] = [
  {
    id: "reformer",
    name: "Pilates Reformer",
    duration: "50 min",
    pitch: "Gainage, posture et renforcement sur machine.",
    description:
      "Le Pilates sur machine Reformer : un travail profond et contrôlé pour renforcer le centre du corps, affiner la silhouette et améliorer la posture.",
    tone: "terracotta",
    offers: [
      { label: "1 cours d'essai – Black Friday", detail: "Valable 1 fois", price: 15, badge: "Black Friday" },
      { audience: "Abonnée", label: "1 cours de Pilates Reformer", detail: "Réservé aux abonnées" },
      { audience: "Non-abonnée", label: "1 cours de Pilates Reformer", detail: "Cours à l'unité, sans forfait en cours", price: 30 },
      { label: "Forfait 10 cours", detail: "Validité 6 mois", price: 270 },
    ],
  },
  {
    id: "sol",
    name: "Pilates au sol",
    duration: "50 min",
    pitch: "Le Pilates sur tapis, accessible à toutes.",
    description:
      "Les fondamentaux du Pilates sur tapis : respiration, mobilité et renforcement en douceur. Idéal pour débuter.",
    tone: "sand",
    offers: [
      { audience: "Abonnée", label: "1 cours de Pilates au sol", detail: "Réservé aux personnes ayant un abonnement" },
      { audience: "Non-abonnée", label: "1 cours de Pilates au sol", detail: "Cours à l'unité, sans forfait en cours", price: 20 },
      { audience: "Non-abonnée", label: "Offre découverte · 1 cours", detail: "Valable 1 fois", price: 15, badge: "Découverte" },
      { label: "Forfait 10 cours", price: 170 },
    ],
  },
  {
    id: "boxe",
    name: "Boxe",
    duration: "50 min",
    pitch: "Cardio, technique et confiance en soi.",
    description:
      "Travail au sac, technique et cardio : une séance qui défoule et qui apprend à se défendre, dans une ambiance 100 % girly.",
    tone: "charcoal",
    offers: [
      { audience: "Abonnée", label: "1 cours de Boxe", detail: "Réservé aux personnes ayant un Forfait Flex en cours" },
      { audience: "Non-abonnée", label: "1 cours de Boxe", price: 15 },
    ],
  },
  {
    id: "cross",
    name: "Cross Training",
    duration: "45 min",
    pitch: "Haltères, médecine-ball et circuits intenses.",
    description:
      "Des circuits variés avec haltères, médecine-balls et piste de sprint pour se dépasser et gagner en force comme en endurance.",
    tone: "rose",
    offers: [
      { audience: "Abonnée", label: "1 cours de Cross Training", detail: "Réservé aux personnes ayant un Forfait Flex en cours" },
      { audience: "Non-abonnée", label: "1 cours de Cross Training", detail: "Cours à l'unité, sans Forfait Flex en cours", price: 15 },
      { label: "Balance in body", detail: "Rendez-vous personnalisé", price: 30 },
    ],
  },
  {
    id: "aquabike",
    name: "Aquabike",
    duration: "30 min",
    pitch: "Pédaler dans l'eau, en cabine privée.",
    description:
      "Des séances d'aquabike dans des cabines privées : drainant, doux pour les articulations et redoutablement efficace.",
    tone: "sand",
    offers: [
      { audience: "Abonnée", label: "1 cours d'Aquabike", detail: "Réservé aux personnes ayant une carte d'abonnement" },
      { audience: "Non-abonnée", label: "1 cours d'Aquabike", detail: "Cours à l'unité, sans abonnement en cours", price: 15 },
      { audience: "Non-abonnée", label: "Offre découverte · 1 cours", detail: "Valable 1 seule fois par personne, 30 min", price: 20, badge: "Découverte" },
      { label: "Carte 10 séances", detail: "30 min par séance", price: 249 },
      { label: "Carte 20 séances", detail: "30 min par séance", price: 400 },
      { label: "Abonnement · 1 cours / semaine", detail: "30 min", price: 99 },
    ],
  },
  {
    id: "taekwondo",
    name: "Taekwondo",
    duration: "50 min",
    pitch: "Art martial, souplesse et self-défense.",
    description:
      "Un art martial complet pour travailler la souplesse, la coordination et la self-défense.",
    tone: "terracotta",
    offers: [
      { audience: "Abonnée", label: "1 cours de Taekwondo", detail: "Réservé aux personnes ayant un forfait 5 cours" },
      { audience: "Non-abonnée", label: "1 cours de Taekwondo", detail: "Cours à l'unité, sans forfait en cours", price: 20 },
      { label: "Forfait 5 cours", price: 85 },
    ],
  },
  {
    id: "machines",
    name: "Accès machines",
    duration: "Accès libre",
    pitch: "Entraînement libre, sans coach.",
    description:
      "Accès libre aux machines, sans coach : du lundi au jeudi de 9h à 12h et de 13h à 20h, le vendredi de 17h à 20h. 30 €/mois + 50 € de frais d'inscription.",
    tone: "charcoal",
    offers: [
      { audience: "Abonnée", label: "1 séance accès libre", detail: "Réservé aux titulaires de l'abonnement mensuel" },
      { audience: "Abonnée", label: "Renouvellement abonnement mensuel", price: 30 },
      { label: "1er mois d'abonnement + frais d'inscription", price: 80 },
    ],
  },
];

export type Plan = {
  name: string;
  /** Ce que contient la formule. */
  detail: string;
  price: number;
  /** « /mois » pour les abonnements mensuels. */
  period?: string;
  highlight?: boolean;
};

export const PLANS: Plan[] = [
  { name: "Séance découverte", detail: "3 séances au choix", price: 60, highlight: true },
  { name: "Pilates Reformer", detail: "1 fois par semaine", price: 99, period: "/mois" },
  { name: "Pilates Reformer", detail: "2 fois par semaine", price: 149, period: "/mois" },
  { name: "Pilates Reformer", detail: "3 fois par semaine", price: 180, period: "/mois" },
  { name: "Pilates au sol", detail: "3 fois par semaine · validité 1 an", price: 99, period: "/mois" },
  { name: "Cross Training & Boxe · Flex", detail: "2 cours par semaine", price: 119, period: "/mois" },
  { name: "Cross Training & Boxe · Flex", detail: "4 cours par semaine", price: 149, period: "/mois" },
  { name: "Cross Training & Boxe · Flex", detail: "5 cours par semaine", price: 179, period: "/mois" },
  { name: "Cross Training & Reformer · Flex +", detail: "1 séance de cross training + 1 séance de reformer par semaine", price: 129, period: "/mois" },
  { name: "Body Mix", detail: "1 aquabike + 1 reformer · 2 fois par semaine", price: 149, period: "/mois", highlight: true },
  { name: "Cross + Reformer", detail: "2 cross training + 2 reformer · 4 fois par semaine", price: 200, period: "/mois" },
  { name: "Reformer + Boxe", detail: "2 reformer + 1 boxe · 3 fois par semaine", price: 180, period: "/mois" },
];

export const getDiscipline = (id: DisciplineId) => DISCIPLINES.find((d) => d.id === id)!;

/** Prix « à partir de » d'une discipline (hors offres promo). */
export const fromPrice = (d: Discipline) => {
  const prices = d.offers.filter((o) => o.price !== undefined && o.badge !== "Black Friday").map((o) => o.price!);
  return prices.length ? Math.min(...prices) : undefined;
};

export const formatPrice = (n: number) =>
  `${n.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(n) ? 0 : 2 })} €`;

/** Ouvre l'onglet tarifs d'une discipline et fait défiler la page jusqu'aux tarifs. */
export const SELECT_EVENT = "girly:select-discipline";
export function showPricing(id: DisciplineId | "abonnements") {
  window.dispatchEvent(new CustomEvent(SELECT_EVENT, { detail: id }));
  document.getElementById("tarifs-onglets")?.scrollIntoView({ behavior: "smooth", block: "start" });
}
