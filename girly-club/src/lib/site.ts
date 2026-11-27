/**
 * Informations générales du club.
 * 👉 C'est LE fichier à modifier pour changer un lien, l'adresse ou les horaires.
 */
export const SITE = {
  name: "The Girly Club",
  tagline: "Club de sport 100 % Girly",
  city: "Vaulx-en-Velin",

  /**
   * ⚠️ À REMPLACER par le lien exact de la page Planity du club
   * (ouvrir la page Planity du club → bouton « Partager » → copier le lien).
   */
  planityUrl: "https://www.planity.com/",

  tiktokUrl: "https://www.tiktok.com/@thegirlyclub69",
  tiktokHandle: "@thegirlyclub69",

  address: {
    street: "3 bis rue Léonard de Vinci",
    zip: "69120",
    city: "Vaulx-en-Velin",
  },

  /** Horaires connus (affichés sur Planity). Les cours se réservent sur Planity. */
  hours: [
    { label: "Cours collectifs", value: "Sur réservation (planning sur Planity)" },
    { label: "Accès machines · lun. → jeu.", value: "9h – 12h · 13h – 20h" },
    { label: "Accès machines · vendredi", value: "17h – 20h" },
  ],

  /** Offre Black Friday : affichée automatiquement uniquement pendant ces dates (heure de Paris). */
  promo: {
    title: "Black Friday",
    text: "Toutes les séances à 15 €",
    start: "2026-11-27T00:00:00+01:00",
    end: "2026-11-29T23:59:59+01:00",
    period: "du 27/11 au 29/11",
  },
} as const;

export const fullAddress = `${SITE.address.street}, ${SITE.address.zip} ${SITE.address.city}`;

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${SITE.name} ${fullAddress}`,
)}`;
