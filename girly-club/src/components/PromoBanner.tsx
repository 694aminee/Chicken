"use client";

import { useSyncExternalStore } from "react";
import { SITE } from "@/lib/site";

/** Vrai uniquement pendant la période de l'offre (calculé dans le navigateur). */
const noSubscribe = () => () => {};
const isPromoNow = () => {
  const now = Date.now();
  return now >= Date.parse(SITE.promo.start) && now <= Date.parse(SITE.promo.end);
};

export function usePromoActive() {
  // Côté serveur : false (la page est générée à l'avance) ; dans le navigateur : date réelle.
  return useSyncExternalStore(noSubscribe, isPromoNow, () => false);
}

export function PromoBanner({ className = "" }: { className?: string }) {
  const active = usePromoActive();
  if (!active) return null;

  return (
    <a
      href={SITE.planityUrl}
      target="_blank"
      rel="noopener noreferrer"
      className={`group flex items-center justify-between gap-4 rounded-3xl bg-charcoal p-5 text-cream sm:p-6 ${className}`}
    >
      <div>
        <p className="text-xs font-semibold tracking-[0.35em] text-terracotta uppercase">{SITE.promo.title}</p>
        <p className="mt-1 font-serif text-xl sm:text-2xl">
          {SITE.promo.text} <span className="text-cream/60">· {SITE.promo.period}</span>
        </p>
      </div>
      <span className="shrink-0 rounded-full bg-rose px-4 py-2 text-sm font-semibold transition group-hover:brightness-110">
        J&apos;en profite
      </span>
    </a>
  );
}
