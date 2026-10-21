"use client";

// Personnalisation d'un produit : viande, sauces, suppléments, formule…
// Le prix se met à jour en direct et « Ajouter » reste bloqué tant que
// les choix obligatoires ne sont pas faits.

import { useState } from "react";
import type { Product } from "@/lib/menu";
import { formatEuros, groupOk, initialSelection, isVisible, selectionOk, toggleChoice, unitPrice } from "@/lib/pricing";
import { GoButton, Qty, Sheet } from "./Sheet";
import { useShop } from "./ShopProvider";

export function ProductSheet({ product }: { product: Product }) {
  const { addToCart, openSheet, toast } = useShop();
  const [sel, setSel] = useState(() => initialSelection(product));
  const [qty, setQty] = useState(1);

  const groups = product.options.filter((g) => isVisible(g, sel));
  const ok = selectionOk(product, sel);
  const total = unitPrice(product, sel) * qty;

  const add = () => {
    if (!ok) return;
    addToCart(product.id, sel, qty);
    openSheet(null);
    toast(`${product.name} ajouté au panier`);
  };

  return (
    <Sheet
      title={product.name}
      subtitle={product.description}
      onClose={() => openSheet(null)}
      footer={
        <>
          <Qty value={qty} onChange={(v) => setQty(Math.max(1, Math.min(20, v)))} />
          <GoButton disabled={!ok} onClick={add}>
            {ok ? "Ajouter" : "Complète tes choix"} · {formatEuros(total)}
          </GoButton>
        </>
      }
    >
      {groups.length === 0 && <p className="mt-2.5 text-[13px] text-muted">Aucune option pour ce produit.</p>}
      {groups.map((g) => {
        const chosen = sel[g.id] ?? [];
        const full = g.max > 1 && chosen.length >= g.max;
        let badge;
        if (g.min > 0) {
          badge = groupOk(g, sel) ? (
            <Badge tone="good">OK</Badge>
          ) : (
            <Badge tone="bad">{g.min === g.max && g.min > 1 ? `Choisis ${g.min}` : "Obligatoire"}</Badge>
          );
        } else {
          badge = <Badge>{g.hint ?? "Facultatif"}</Badge>;
        }
        return (
          <div key={g.id} className="pt-4">
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <b className="font-label text-[19px] tracking-[.03em] uppercase">{g.label}</b>
              {badge}
            </div>
            <div className="flex flex-wrap gap-2">
              {g.choices.map((c) => {
                const on = chosen.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    aria-pressed={on}
                    disabled={!on && full}
                    onClick={() => setSel((s) => toggleChoice(product, s, g.id, c.id))}
                    className={`flex items-center gap-1.5 rounded-[10px] border px-3 py-[9px] text-[15px] font-medium disabled:opacity-35 ${
                      on ? "border-paper bg-paper text-ink" : "border-line bg-panel"
                    }`}
                  >
                    {c.name}
                    {c.price > 0 && (
                      <em className={`text-[13px] not-italic tabular-nums ${on ? "text-red-deep" : "text-gold"}`}>
                        +{formatEuros(c.price)}
                      </em>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </Sheet>
  );
}

function Badge({ tone, children }: { tone?: "good" | "bad"; children: React.ReactNode }) {
  const color = tone === "good" ? "border-ok text-ok" : tone === "bad" ? "border-red text-red" : "border-line text-muted";
  return (
    <span
      className={`rounded-full border px-[7px] py-0.5 font-label text-xs tracking-[.06em] whitespace-nowrap uppercase ${color}`}
    >
      {children}
    </span>
  );
}
