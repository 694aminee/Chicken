"use client";

import dynamic from "next/dynamic";
import { Component, useCallback, useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { getDiscipline, showPricing } from "@/data/disciplines";
import { HOTSPOTS, type HotspotId } from "./hotspots";
import type { SceneHandle } from "./ClubScene";

// La 3D n'est chargée que dans le navigateur, et seulement quand la section approche de l'écran.
const ClubScene = dynamic(() => import("./ClubScene"), {
  ssr: false,
  loading: () => <SceneLoading />,
});

function SceneLoading() {
  return (
    <div className="absolute inset-0 grid place-items-center text-sm text-muted">
      <span className="flex items-center gap-3">
        <span className="size-4 animate-spin rounded-full border-2 border-terracotta border-t-transparent" />
        Chargement de la visite 3D…
      </span>
    </div>
  );
}

/** Si le téléphone ne gère pas la 3D (WebGL), on affiche un message au lieu d'une page cassée. */
class WebGLBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed)
      return (
        <div className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-muted">
          La visite 3D n&apos;est pas disponible sur cet appareil. Découvrez les espaces ci-dessous 👇
        </div>
      );
    return this.props.children;
  }
}

function useMediaQuery(query: string) {
  const subscribe = useCallback(
    (cb: () => void) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query],
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function CamButton({ label, icon, onClick }: { label: string; icon: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className="grid size-10 place-items-center rounded-full bg-cream/90 text-charcoal shadow-md backdrop-blur transition hover:bg-white active:scale-95"
    >
      <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
        <path d={icon} strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>
  );
}

export function ClubTour() {
  const container = useRef<HTMLDivElement>(null);
  const scene = useRef<SceneHandle>(null);
  const [mounted, setMounted] = useState(false); // la scène a été chargée
  const [onScreen, setOnScreen] = useState(false); // la scène est visible (sinon rendu en pause)
  const [selected, setSelected] = useState<HotspotId | null>(null);
  const [touchActive, setTouchActive] = useState(false);

  const isTouch = useMediaQuery("(pointer: coarse)");
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)");

  // Sur mobile, la scène ne « capture » pas le doigt tant qu'on n'a pas touché « Explorer » :
  // la page défile normalement. Sur ordinateur, on peut tourner directement.
  const interactive = !isTouch || touchActive;

  useEffect(() => {
    const el = container.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        setOnScreen(entry.isIntersecting);
        if (entry.isIntersecting) setMounted(true);
      },
      { rootMargin: "300px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const spot = HOTSPOTS.find((h) => h.id === selected);
  const discipline = spot ? getDiscipline(spot.discipline) : null;

  return (
    <section id="visite-3d" className="relative bg-cream py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-8 max-w-2xl">
          <p className="text-xs font-semibold tracking-[0.35em] text-terracotta uppercase">Visite immersive</p>
          <h2 className="mt-3 font-serif text-4xl leading-tight font-semibold sm:text-5xl">
            Explorez le Club <span className="italic text-terracotta">en 3D</span>
          </h2>
          <p className="mt-4 text-muted">
            {isTouch
              ? "Touchez un équipement pour découvrir la séance. Touchez « Explorer » pour tourner autour de la salle."
              : "Faites glisser pour tourner autour de la salle, cliquez sur un équipement pour découvrir la séance."}
          </p>
        </div>

        <div
          ref={container}
          className="relative h-[76svh] max-h-[720px] min-h-[460px] overflow-hidden rounded-[2rem] bg-gradient-to-b from-cream-deep to-sand shadow-[inset_0_0_0_1px_rgba(20,20,20,0.06)]"
        >
          <div className={`absolute inset-0 ${interactive ? "" : "pointer-events-none"}`}>
            {mounted && (
              <WebGLBoundary>
                <ClubScene
                  ref={scene}
                  selected={selected}
                  onSelect={setSelected}
                  interactive={interactive}
                  allowZoom={isTouch && touchActive}
                  running={onScreen}
                  reducedMotion={reducedMotion}
                />
              </WebGLBoundary>
            )}
          </div>

          {/* Mobile : activer / quitter l'exploration */}
          {isTouch && !touchActive && !selected && (
            <button
              type="button"
              onClick={() => setTouchActive(true)}
              className="absolute bottom-4 left-1/2 z-30 flex -translate-x-1/2 items-center gap-2 rounded-full bg-charcoal px-5 py-3 text-sm font-semibold text-cream shadow-xl"
            >
              <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M3 12a9 9 0 0 1 15.5-6.2M21 12a9 9 0 0 1-15.5 6.2" strokeLinecap="round" />
                <path d="M18 2v4h-4M6 22v-4h4" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Explorer en 3D
            </button>
          )}
          {isTouch && touchActive && (
            <button
              type="button"
              onClick={() => setTouchActive(false)}
              className="absolute top-4 right-4 z-30 rounded-full bg-charcoal px-4 py-2 text-xs font-semibold text-cream shadow-lg"
            >
              Terminer la visite
            </button>
          )}

          {/* Commandes caméra */}
          <div className="absolute top-4 left-4 z-30 flex flex-col gap-2">
            <CamButton label="Zoomer" icon="M12 5v14M5 12h14" onClick={() => scene.current?.zoom(0.8)} />
            <CamButton label="Dézoomer" icon="M5 12h14" onClick={() => scene.current?.zoom(1.25)} />
            <CamButton
              label="Recentrer la vue"
              icon="M4 12a8 8 0 1 0 2.3-5.7M4 4v4h4"
              onClick={() => {
                setSelected(null);
                scene.current?.reset();
              }}
            />
          </div>

          {/* Bulle d'info de l'équipement choisi */}
          {discipline && (
            <div
              key={discipline.id}
              role="dialog"
              aria-label={discipline.name}
              className="absolute inset-x-3 bottom-3 z-40 animate-fade-up sm:inset-x-auto sm:bottom-6 sm:left-6 sm:w-96"
            >
              <div className="relative rounded-3xl bg-cream p-5 shadow-2xl shadow-charcoal/20">
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  aria-label="Fermer"
                  className="absolute top-3 right-3 grid size-8 place-items-center rounded-full text-muted transition hover:bg-cream-deep hover:text-charcoal"
                >
                  <svg viewBox="0 0 24 24" className="size-4" fill="none" stroke="currentColor" strokeWidth="2.4" aria-hidden>
                    <path d="M6 6l12 12M18 6L6 18" strokeLinecap="round" />
                  </svg>
                </button>
                <p className="text-xs font-semibold tracking-[0.25em] text-terracotta uppercase">{discipline.duration}</p>
                <h3 className="mt-1 pr-8 font-serif text-2xl font-semibold">
                  {discipline.name} – {discipline.duration}
                </h3>
                <p className="mt-2 text-sm text-muted">{discipline.pitch}</p>
                <button
                  type="button"
                  onClick={() => showPricing(discipline.id)}
                  className="mt-4 w-full rounded-full bg-rose px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-rose/25 transition hover:brightness-110 active:scale-[0.98]"
                >
                  Voir les tarifs
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Raccourcis accessibles (clavier / lecteurs d'écran) */}
        <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {HOTSPOTS.map((h) => (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelected(h.id)}
              aria-pressed={selected === h.id}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm font-medium transition ${
                selected === h.id
                  ? "border-rose bg-rose text-white"
                  : "border-charcoal/15 bg-white/60 hover:border-charcoal/40"
              }`}
            >
              {getDiscipline(h.discipline).name}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
