"use client";

import Image from "next/image";
import { HOURS_LABEL } from "@/lib/hours";
import { MENU, type Product } from "@/lib/menu";
import { formatEuros } from "@/lib/pricing";
import { useShop } from "./ShopProvider";

export function MenuList() {
  const { openSheet, open } = useShop();
  return (
    <>
      {open === false && (
        <p className="mt-4 rounded-[14px] border border-red bg-panel p-3.5 text-sm">
          <b className="text-red">Fermé pour le moment.</b> Tu peux regarder le menu ; les commandes sont ouvertes tous les jours
          de {HOURS_LABEL}.
        </p>
      )}
      {MENU.map((c) => (
        <section key={c.id} id={`s-${c.id}`} className="scroll-mt-[130px] pt-[22px]">
          <h2 className="m-0 font-display text-[30px] leading-[1.05] tracking-[.01em] uppercase">{c.title}</h2>
          <p className="mt-1 mb-3 text-sm text-muted">{c.subtitle}</p>
          <div className="grid gap-2.5">
            {c.products.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => openSheet({ kind: "product", productId: p.id })}
                className="grid w-full grid-cols-[92px_1fr] items-center gap-3.5 rounded-[14px] border border-line bg-panel p-2.5 text-left active:scale-[.99]"
              >
                <Thumb product={p} />
                <div className="min-w-0">
                  <h3 className="m-0 font-label text-xl leading-[1.1] font-bold tracking-[.02em] uppercase">{p.name}</h3>
                  <p className="mt-[3px] mb-1.5 text-[13.5px] leading-[1.3] text-muted">{p.description}</p>
                  <span className="inline-block rounded-md bg-gold px-2 py-0.5 font-label text-base font-bold text-ink tabular-nums">
                    {formatEuros(p.price)}
                  </span>
                  {p.menuPrice && (
                    <span className="ml-1.5 inline-block rounded-md border border-gold px-2 py-0.5 font-label text-sm font-bold text-gold tabular-nums">
                      Menu {formatEuros(p.menuPrice)}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>
      ))}
    </>
  );
}

function Thumb({ product }: { product: Product }) {
  if (product.image) {
    return (
      <div className="relative h-[76px] w-[92px] overflow-hidden rounded-[10px] bg-white">
        <Image src={product.image} alt="" fill sizes="92px" className="object-contain" />
      </div>
    );
  }
  const [big, small] = product.tag ?? [product.name, ""];
  return (
    <div className="grid h-[76px] w-[92px] place-items-center overflow-hidden rounded-[10px] bg-ink">
      <div className="text-center font-display text-2xl leading-[.95] text-paper uppercase">
        {big}
        <small className="block text-xs tracking-[.05em] text-red">{small}</small>
      </div>
    </div>
  );
}
