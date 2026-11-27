"use client";

import { DISCIPLINES, formatPrice, fromPrice, showPricing, type Discipline } from "@/data/disciplines";

const TONES: Record<Discipline["tone"], { card: string; accent: string; button: string }> = {
  terracotta: { card: "bg-terracotta text-cream", accent: "text-cream/70", button: "bg-cream text-charcoal" },
  rose: { card: "bg-rose text-white", accent: "text-white/75", button: "bg-white text-charcoal" },
  charcoal: { card: "bg-charcoal text-cream", accent: "text-cream/60", button: "bg-rose text-white" },
  sand: { card: "bg-sand text-charcoal", accent: "text-muted", button: "bg-charcoal text-cream" },
};

/** Grand chiffre de la durée (« 50' ») utilisé comme visuel en attendant les photos. */
function DurationMark({ duration }: { duration: string }) {
  const minutes = duration.match(/\d+/)?.[0];
  return (
    <span aria-hidden className="font-serif text-7xl leading-none font-semibold italic opacity-90 sm:text-8xl">
      {minutes ? `${minutes}'` : "∞"}
    </span>
  );
}

export function Disciplines() {
  return (
    <section id="disciplines" className="bg-cream-deep py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-10 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.35em] text-terracotta uppercase">Nos séances</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight font-semibold sm:text-5xl">Les disciplines</h2>
          <p className="mt-4 text-muted">
            Sept façons de bouger, toutes pensées pour vous. Choisissez votre séance, réservez en quelques secondes.
          </p>
        </div>

        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {DISCIPLINES.map((d, i) => {
            const tone = TONES[d.tone];
            const from = fromPrice(d);
            return (
              <li
                key={d.id}
                // La dernière carte (7e) occupe toute la largeur pour éviter une carte seule sur sa ligne.
                className={`flex flex-col rounded-[1.75rem] p-6 ${tone.card} ${
                  i === DISCIPLINES.length - 1 ? "sm:col-span-2 lg:col-span-3" : ""
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <DurationMark duration={d.duration} />
                  {from !== undefined && (
                    <span className="rounded-full bg-black/10 px-3 py-1 text-xs font-semibold whitespace-nowrap">
                      dès {formatPrice(from)}
                    </span>
                  )}
                </div>
                <h3 className="mt-8 font-serif text-2xl font-semibold">{d.name}</h3>
                <p className={`mt-1 text-xs font-semibold tracking-[0.2em] uppercase ${tone.accent}`}>{d.duration}</p>
                <p className={`mt-3 flex-1 text-sm leading-relaxed ${tone.accent}`}>{d.description}</p>
                <button
                  type="button"
                  onClick={() => showPricing(d.id)}
                  className={`mt-6 self-start rounded-full px-5 py-2.5 text-sm font-semibold transition hover:brightness-95 active:scale-95 ${tone.button}`}
                >
                  Voir les tarifs
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
