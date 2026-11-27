"use client";

import { useEffect, useRef, useState } from "react";
import { SITE } from "@/lib/site";

/**
 * Section d'accueil avec vidéo d'ambiance.
 * 👉 Déposer la vidéo du club dans `public/videos/hero.mp4` (et une image `public/videos/hero-poster.jpg`).
 * Tant qu'il n'y a pas de vidéo, un fond animé aux couleurs du club s'affiche.
 */
export function Hero() {
  const [videoReady, setVideoReady] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  // La vidéo a pu se charger avant que React ne soit prêt : on vérifie une fois au montage.
  useEffect(() => {
    if ((videoRef.current?.readyState ?? 0) >= 3) setVideoReady(true);
  }, []);

  return (
    <section id="top" className="relative isolate flex min-h-svh items-end overflow-hidden bg-charcoal text-cream">
      {/* Fond animé (toujours présent, visible tant que la vidéo n'est pas prête) */}
      <div aria-hidden className="absolute inset-0 -z-20">
        <div className="absolute -top-24 -left-24 size-[28rem] animate-float rounded-full bg-terracotta/50 blur-3xl" />
        <div
          className="absolute top-1/3 -right-32 size-[26rem] animate-float rounded-full bg-rose/35 blur-3xl"
          style={{ animationDelay: "-2s" }}
        />
        <div
          className="absolute -bottom-32 left-1/4 size-[22rem] animate-float rounded-full bg-sand/25 blur-3xl"
          style={{ animationDelay: "-4s" }}
        />
      </div>

      <video
        ref={videoRef}
        className={`absolute inset-0 -z-10 size-full object-cover transition-opacity duration-1000 motion-reduce:hidden ${
          videoReady ? "opacity-100" : "opacity-0"
        }`}
        autoPlay
        muted
        loop
        playsInline
        preload="metadata"
        poster="/videos/hero-poster.jpg"
        onCanPlay={() => setVideoReady(true)}
      >
        <source src="/videos/hero.mp4" type="video/mp4" />
      </video>

      {/* Voile pour garder le texte lisible sur la vidéo */}
      <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-t from-charcoal via-charcoal/55 to-charcoal/20" />

      <div className="mx-auto w-full max-w-6xl px-4 pt-28 pb-14 sm:px-6 sm:pb-20">
        <p className="mb-5 inline-flex animate-fade-up items-center gap-2 rounded-full border border-cream/25 bg-cream/10 px-3 py-1.5 text-xs font-medium tracking-[0.2em] uppercase backdrop-blur">
          <span className="size-1.5 rounded-full bg-rose" />
          {SITE.city} · Lyon
        </p>

        <h1
          className="max-w-3xl animate-fade-up font-serif text-[2.6rem] leading-[1.05] font-semibold sm:text-6xl lg:text-7xl"
          style={{ animationDelay: "80ms" }}
        >
          Club de sport <span className="whitespace-nowrap text-terracotta italic">100 % Girly</span> à{" "}
          <span className="whitespace-nowrap">Vaulx-en-Velin</span>
        </h1>

        <p
          className="mt-5 max-w-xl animate-fade-up text-base text-cream/80 sm:text-lg"
          style={{ animationDelay: "160ms" }}
        >
          Pilates Reformer, Pilates au sol, Boxe, Cross Training, Taekwondo et Aquabike en cabine privée.
        </p>

        <div
          className="mt-8 flex animate-fade-up flex-col gap-3 sm:flex-row"
          style={{ animationDelay: "240ms" }}
        >
          <a
            href="#disciplines"
            className="rounded-full bg-cream px-6 py-4 text-center font-semibold text-charcoal transition hover:bg-white active:scale-[0.98]"
          >
            Découvrir les séances
          </a>
          <a
            href={SITE.planityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-rose px-6 py-4 text-center font-semibold text-white shadow-xl shadow-rose/30 transition hover:brightness-110 active:scale-[0.98]"
          >
            Réserver sur Planity
          </a>
        </div>

        <dl className="mt-12 grid max-w-xl grid-cols-3 gap-4 border-t border-cream/15 pt-6 text-center sm:text-left">
          {[
            ["7", "disciplines"],
            ["30 min", "aquabike privé"],
            ["dès 15 €", "la séance"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-serif text-2xl font-semibold sm:text-3xl">{v}</dd>
              <dd className="mt-1 text-xs text-cream/65 sm:text-sm">{l}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
