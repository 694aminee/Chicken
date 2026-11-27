"use client";

import { useEffect, useState } from "react";
import { SITE } from "@/lib/site";
import { Logo } from "./Logo";

const LINKS = [
  { href: "#disciplines", label: "Disciplines" },
  { href: "#tarifs", label: "Tarifs" },
  { href: "#visite-3d", label: "Visite 3D" },
];

export function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const solid = scrolled || open;

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        solid ? "bg-cream/90 text-charcoal shadow-[0_1px_0_rgba(20,20,20,0.08)] backdrop-blur-md" : "text-cream"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#top" aria-label="The Girly Club — accueil" onClick={() => setOpen(false)}>
          <Logo size={40} />
        </a>

        <ul className="hidden items-center gap-8 text-sm font-medium md:flex">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a href={l.href} className="transition-colors hover:text-terracotta">
                {l.label}
              </a>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          <a
            href={SITE.planityUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-full bg-rose px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-rose/25 transition hover:brightness-110 active:scale-95"
          >
            Réserver
          </a>
          <button
            type="button"
            className="grid size-10 place-items-center rounded-full md:hidden"
            aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            <span className="relative block h-3.5 w-5">
              <span
                className={`absolute left-0 h-0.5 w-5 rounded bg-current transition-all ${open ? "top-1.5 rotate-45" : "top-0"}`}
              />
              <span
                className={`absolute top-1.5 left-0 h-0.5 w-5 rounded bg-current transition-opacity ${open ? "opacity-0" : ""}`}
              />
              <span
                className={`absolute left-0 h-0.5 w-5 rounded bg-current transition-all ${open ? "top-1.5 -rotate-45" : "top-3"}`}
              />
            </span>
          </button>
        </div>
      </nav>

      {/* Menu mobile */}
      <div className={`overflow-hidden transition-[max-height] duration-300 md:hidden ${open ? "max-h-72" : "max-h-0"}`}>
        <ul className="space-y-1 px-4 pb-5">
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-xl px-3 py-3 font-serif text-2xl transition-colors hover:bg-cream-deep"
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </header>
  );
}
