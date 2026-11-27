import Link from "next/link";
import { SITE, fullAddress, mapsUrl } from "@/lib/site";
import { Logo } from "./Logo";

export function Footer() {
  return (
    <footer className="bg-charcoal text-cream">
      <div className="mx-auto max-w-6xl px-4 pt-16 pb-12 sm:px-6">
        {/* Appel à l'action final */}
        <div className="flex flex-col gap-6 border-b border-cream/10 pb-12 sm:flex-row sm:items-end sm:justify-between">
          <h2 className="max-w-lg font-serif text-4xl leading-tight font-semibold sm:text-5xl">
            Prête pour votre <span className="italic text-terracotta">première séance</span> ?
          </h2>
          <a
            href={SITE.planityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-rose px-6 py-4 text-center font-semibold text-white shadow-xl shadow-rose/20 transition hover:brightness-110"
          >
            Réserver sur Planity
          </a>
        </div>

        <div className="grid gap-10 py-12 sm:grid-cols-3">
          <div>
            <Logo size={48} onDark />
            <p className="mt-4 text-sm text-cream/60">{SITE.tagline} 🌷</p>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.3em] text-terracotta uppercase">Adresse</h3>
            <address className="mt-3 text-sm leading-relaxed not-italic text-cream/80">
              {SITE.address.street}
              <br />
              {SITE.address.zip} {SITE.address.city}
            </address>
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 inline-block text-sm font-semibold underline decoration-terracotta underline-offset-4"
              aria-label={`Itinéraire vers ${fullAddress}`}
            >
              Itinéraire →
            </a>
          </div>

          <div>
            <h3 className="text-xs font-semibold tracking-[0.3em] text-terracotta uppercase">Horaires</h3>
            <dl className="mt-3 space-y-2 text-sm">
              {SITE.hours.map((h) => (
                <div key={h.label}>
                  <dt className="text-cream/50">{h.label}</dt>
                  <dd className="text-cream/85">{h.value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div className="flex flex-col gap-4 border-t border-cream/10 pt-8 text-sm text-cream/60 sm:flex-row sm:items-center sm:justify-between">
          <a
            href={SITE.tiktokUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-cream transition hover:text-rose"
          >
            <svg viewBox="0 0 24 24" className="size-5" fill="currentColor" aria-hidden>
              <path d="M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
            </svg>
            TikTok {SITE.tiktokHandle}
          </a>
          <div className="flex gap-6">
            <Link href="/mentions-legales" className="hover:text-cream">
              Mentions légales
            </Link>
            <span>© {SITE.name}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
