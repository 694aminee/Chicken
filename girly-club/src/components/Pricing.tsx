"use client";

import { useEffect, useRef, useState } from "react";
import {
  DISCIPLINES,
  PLANS,
  SELECT_EVENT,
  formatPrice,
  type DisciplineId,
  type Offer,
} from "@/data/disciplines";
import { SITE } from "@/lib/site";
import { PromoBanner, usePromoActive } from "./PromoBanner";

type Tab = DisciplineId | "abonnements";

const TABS: { id: Tab; label: string }[] = [
  { id: "abonnements", label: "Abonnements" },
  ...DISCIPLINES.map((d) => ({ id: d.id as Tab, label: d.name })),
];

function BookButton({ dark = false }: { dark?: boolean }) {
  return (
    <a
      href={SITE.planityUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-95 ${
        dark ? "bg-rose text-white hover:brightness-110" : "bg-charcoal text-cream hover:bg-charcoal-soft"
      }`}
    >
      Réserver
    </a>
  );
}

function OfferRow({ offer, promoActive }: { offer: Offer; promoActive: boolean }) {
  // L'offre Black Friday n'est affichée que pendant la période de l'offre.
  if (offer.badge === "Black Friday" && !promoActive) return null;
  return (
    <li className="flex flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <p className="font-medium">
          {offer.audience && <span className="font-semibold">{offer.audience} · </span>}
          {offer.label}
          {offer.badge && (
            <span className="ml-2 inline-block rounded-full bg-rose/10 px-2 py-0.5 align-middle text-[11px] font-semibold text-rose">
              {offer.badge}
            </span>
          )}
        </p>
        {offer.detail && <p className="mt-1 text-sm text-muted">{offer.detail}</p>}
      </div>
      <div className="flex items-center justify-between gap-4 sm:justify-end">
        <span className="font-serif text-2xl font-semibold whitespace-nowrap">
          {offer.price !== undefined ? formatPrice(offer.price) : <span className="font-sans text-sm text-muted">Inclus</span>}
        </span>
        <BookButton />
      </div>
    </li>
  );
}

export function Pricing() {
  const [tab, setTab] = useState<Tab>("abonnements");
  const promoActive = usePromoActive();
  const tabsRef = useRef<HTMLDivElement>(null);

  // « Voir les tarifs » (3D ou cartes) ouvre directement le bon onglet.
  useEffect(() => {
    const onSelect = (e: Event) => setTab((e as CustomEvent<Tab>).detail);
    window.addEventListener(SELECT_EVENT, onSelect);
    return () => window.removeEventListener(SELECT_EVENT, onSelect);
  }, []);

  // Garde l'onglet actif visible dans la barre qui défile (horizontalement seulement).
  useEffect(() => {
    const bar = tabsRef.current;
    const el = bar?.querySelector<HTMLElement>(`[data-tab="${tab}"]`);
    if (!bar || !el) return;
    bar.scrollTo({ left: el.offsetLeft - bar.clientWidth / 2 + el.clientWidth / 2, behavior: "smooth" });
  }, [tab]);

  const discipline = DISCIPLINES.find((d) => d.id === tab);

  return (
    <section id="tarifs" className="bg-cream py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.35em] text-terracotta uppercase">Tarifs</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight font-semibold sm:text-5xl">Formules & séances</h2>
          <p className="mt-4 text-muted">
            À la séance, en carte ou en abonnement mensuel. Toutes les réservations se font en ligne sur Planity.
          </p>
        </div>

        <PromoBanner className="mb-8" />

        <div
          ref={tabsRef}
          id="tarifs-onglets"
          role="tablist"
          aria-label="Choisir une discipline"
          className="no-scrollbar sticky top-16 z-20 -mx-4 flex gap-2 overflow-x-auto bg-cream/95 px-4 py-3 backdrop-blur sm:mx-0 sm:px-0"
        >
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              data-tab={t.id}
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-medium transition ${
                tab === t.id ? "bg-charcoal text-cream" : "bg-cream-deep text-charcoal hover:bg-sand"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="mt-6" role="tabpanel">
          {tab === "abonnements" ? (
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {PLANS.map((p, i) => (
                <li
                  key={i}
                  className={`flex flex-col rounded-[1.75rem] p-6 ${
                    p.highlight ? "bg-charcoal text-cream" : "bg-white shadow-[0_0_0_1px_rgba(20,20,20,0.06)]"
                  }`}
                >
                  <p className={`text-xs font-semibold tracking-[0.2em] uppercase ${p.highlight ? "text-terracotta" : "text-terracotta-dark"}`}>
                    {p.period ? "Abonnement mensuel" : "Pour commencer"}
                  </p>
                  <h3 className="mt-2 font-serif text-xl font-semibold">{p.name}</h3>
                  <p className={`mt-1 flex-1 text-sm ${p.highlight ? "text-cream/70" : "text-muted"}`}>{p.detail}</p>
                  <div className="mt-6 flex items-end justify-between gap-4">
                    <p className="font-serif text-4xl font-semibold">
                      {formatPrice(p.price)}
                      {p.period && (
                        <span className={`font-sans text-sm font-normal ${p.highlight ? "text-cream/60" : "text-muted"}`}>
                          {p.period}
                        </span>
                      )}
                    </p>
                    <BookButton dark={p.highlight} />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            discipline && (
              <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_0_0_1px_rgba(20,20,20,0.06)] sm:p-8">
                <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-charcoal/10 pb-5">
                  <h3 className="font-serif text-3xl font-semibold">{discipline.name}</h3>
                  <p className="text-sm text-muted">
                    {discipline.duration === "Accès libre" ? "Accès libre, sans coach" : `Durée du cours : ${discipline.duration}`}
                  </p>
                </div>
                {discipline.id === "machines" && (
                  <p className="mt-5 rounded-2xl bg-cream-deep p-4 text-sm text-muted">{discipline.description}</p>
                )}
                <ul className="divide-y divide-charcoal/10">
                  {discipline.offers.map((o, i) => (
                    <OfferRow key={i} offer={o} promoActive={promoActive} />
                  ))}
                </ul>
              </div>
            )
          )}
        </div>

        <p className="mt-6 text-xs text-muted">
          Tarifs TTC indiqués à titre informatif, repris de la page de réservation du club. Le tarif appliqué est celui
          affiché sur Planity au moment de la réservation.
        </p>
      </div>
    </section>
  );
}
