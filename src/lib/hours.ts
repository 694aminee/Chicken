// Horaires d'ouverture : tous les jours de 11:00 à 23:00, heure de Paris.

export const OPENING_HOUR = 11;
export const CLOSING_HOUR = 23;
export const HOURS_LABEL = "11:00 – 23:00";

// Pour tester le site en dehors des horaires : mettre
// NEXT_PUBLIC_TOUJOURS_OUVERT=1 dans le fichier .env.local (jamais en ligne).
const ALWAYS_OPEN = process.env.NEXT_PUBLIC_TOUJOURS_OUVERT === "1";

function parisParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return { year: get("year"), month: get("month"), day: get("day"), hour: Number(get("hour")) };
}

export function isOpen(date: Date = new Date()): boolean {
  if (ALWAYS_OPEN) return true;
  const { hour } = parisParts(date);
  return hour >= OPENING_HOUR && hour < CLOSING_HOUR;
}

/** Jour en cours à Paris, au format AAAA-MM-JJ (sert à remettre le numéro de commande à 1) */
export function parisDay(date: Date = new Date()): string {
  const { year, month, day } = parisParts(date);
  return `${year}-${month}-${day}`;
}

export function parisTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("fr-FR", {
    timeZone: "Europe/Paris",
    hour: "2-digit",
    minute: "2-digit",
  });
}
