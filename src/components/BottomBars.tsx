"use client";

// Bouton panier rouge flottant + barre de navigation du bas.

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";
import { formatEuros } from "@/lib/pricing";
import { useShop } from "./ShopProvider";

export function CartBar() {
  const { cartCount, cartTotal, openSheet } = useShop();
  if (cartCount === 0) return null;
  return (
    <div className="px-safe fixed inset-x-0 z-[15]" style={{ bottom: "calc(64px + env(safe-area-inset-bottom, 0px))" }}>
      <button
        type="button"
        onClick={() => openSheet({ kind: "cart" })}
        className="mx-auto flex w-full max-w-[528px] items-center gap-3 rounded-[14px] bg-red px-4 py-3.5 font-bold shadow-[0_8px_24px_rgba(0,0,0,.5)]"
      >
        <span className="grid h-7 min-w-7 place-items-center rounded-full bg-ink text-sm text-paper">{cartCount}</span>
        <span>Voir le panier</span>
        <span className="ml-auto tabular-nums">{formatEuros(cartTotal)}</span>
      </button>
    </div>
  );
}

const TABS = [
  {
    href: "/",
    label: "Menu",
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    href: "/commandes",
    label: "Commandes",
    icon: (
      <>
        <path d="M6 3h12v18l-3-2-3 2-3-2-3 2z" />
        <path d="M9 8h6M9 12h6" />
      </>
    ),
  },
  {
    href: "/infos",
    label: "Infos",
    icon: (
      <>
        <circle cx="12" cy="12" r="9" />
        <path d="M12 11v6M12 7.5v.5" />
      </>
    ),
  },
];

export function BottomNav() {
  return (
    <nav aria-label="Navigation" className="pb-safe fixed inset-x-0 bottom-0 z-[16] border-t border-line bg-ink">
      <div className="mx-auto grid max-w-[560px] grid-cols-3">
        {/* L'adresse de la page n'est connue qu'au chargement : en attendant, aucun onglet n'est surligné */}
        <Suspense fallback={<Tabs pathname={null} />}>
          <CurrentTabs />
        </Suspense>
      </div>
    </nav>
  );
}

function CurrentTabs() {
  return <Tabs pathname={usePathname()} />;
}

function Tabs({ pathname }: { pathname: string | null }) {
  return (
    <>
      {TABS.map((t) => {
        const active = t.href === "/" ? pathname === "/" : !!pathname?.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`grid h-16 place-items-center content-center gap-1 font-label text-sm font-bold tracking-[.05em] uppercase ${
              active ? "text-paper" : "text-muted"
            }`}
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className={`h-[22px] w-[22px] ${active ? "text-red" : ""}`}
              aria-hidden="true"
            >
              {t.icon}
            </svg>
            {t.label}
          </Link>
        );
      })}
    </>
  );
}
