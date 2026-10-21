"use client";

// En-tête : logo, nom, pastille Ouvert/Fermé et barre de catégories
// (la barre n'apparaît que sur le menu).

import Image from "next/image";
import { usePathname } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { MENU } from "@/lib/menu";
import { useShop } from "./ShopProvider";

export function Header() {
  return (
    <header className="sticky z-20 border-b border-line bg-ink" style={{ top: "env(safe-area-inset-top, 0px)" }}>
      <div className="px-safe mx-auto max-w-[560px]">
        <div className="flex items-center gap-3 pt-3 pb-2.5">
          <Image src="/logo.png" alt="Logo Chicken King" width={48} height={48} priority className="flex-none rounded-full" />
          <div>
            <h1 className="m-0 font-display text-2xl leading-none tracking-[.02em] uppercase">Chicken King</h1>
            <p className="mt-[3px] text-[13px] text-muted">Click &amp; collect</p>
          </div>
          <OpenStatus />
        </div>
        <Suspense>
          <RailOnMenu />
        </Suspense>
      </div>
    </header>
  );
}

function RailOnMenu() {
  return usePathname() === "/" ? <CategoryRail /> : null;
}

function OpenStatus() {
  const { open } = useShop();
  if (open === null) return null;
  return (
    <span
      className={`ml-auto rounded-full border px-2 py-1 font-label text-[13px] tracking-[.06em] whitespace-nowrap uppercase ${
        open ? "border-ok text-ok" : "border-red text-red"
      }`}
    >
      {open ? "Ouvert" : "Fermé"}
    </span>
  );
}

function CategoryRail() {
  const [current, setCurrent] = useState(MENU[0].id);

  // La catégorie visible à l'écran est mise en avant pendant le défilement
  useEffect(() => {
    if (!("IntersectionObserver" in window)) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const en of entries) if (en.isIntersecting) setCurrent(en.target.id.slice(2));
      },
      { rootMargin: "-140px 0px -65% 0px" },
    );
    document.querySelectorAll("section[id^='s-']").forEach((s) => io.observe(s));
    return () => io.disconnect();
  }, []);

  // La pastille active reste visible dans la barre
  useEffect(() => {
    document.getElementById(`chip-${current}`)?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [current]);

  const go = (id: string) => {
    setCurrent(id);
    const smooth = !window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: smooth ? "smooth" : "auto" });
  };

  return (
    <nav aria-label="Catégories" className="no-scrollbar flex gap-2 overflow-x-auto pb-3">
      {MENU.map((c) => (
        <button
          key={c.id}
          id={`chip-${c.id}`}
          type="button"
          aria-current={current === c.id}
          onClick={() => go(c.id)}
          className={`flex-none rounded-full border px-3.5 py-[7px] font-label text-[15px] font-bold tracking-[.04em] uppercase ${
            current === c.id ? "border-paper bg-paper text-ink" : "border-line text-muted"
          }`}
        >
          {c.title}
        </button>
      ))}
    </nav>
  );
}
