"use client";

import { formatEuros } from "@/lib/pricing";
import { GoButton, Qty, Sheet } from "./Sheet";
import { useShop } from "./ShopProvider";

export function CartSheet() {
  const { cart, cartTotal, setQty, removeLine, openSheet } = useShop();
  const close = () => openSheet(null);

  if (cart.length === 0) {
    return (
      <Sheet title="Ton panier" subtitle="Retrait au comptoir" onClose={close}>
        <p className="py-8 text-center text-muted">Ton panier est vide.</p>
      </Sheet>
    );
  }

  return (
    <Sheet
      title="Ton panier"
      subtitle="Retrait au comptoir"
      onClose={close}
      footer={<GoButton onClick={() => openSheet({ kind: "checkout" })}>Commander · {formatEuros(cartTotal)}</GoButton>}
    >
      {cart.map((l) => (
        <div key={l.key} className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1.5 border-b border-line py-3.5">
          <div>
            <h4 className="m-0 font-label text-lg tracking-[.02em] uppercase">{l.product.name}</h4>
            {l.summary && <p className="mt-0.5 text-[13px] leading-[1.35] text-muted">{l.summary}</p>}
          </div>
          <div className="text-right font-bold tabular-nums">{formatEuros(l.unit * l.qty)}</div>
          <div className="col-span-full flex items-center gap-2.5">
            <Qty small value={l.qty} onChange={(v) => setQty(l.key, v)} />
            <button type="button" className="text-[13px] text-muted underline" onClick={() => removeLine(l.key)}>
              Retirer
            </button>
          </div>
        </div>
      ))}
      <div className="flex justify-between pt-3.5 pb-1 font-label text-[22px] uppercase">
        <span>Total</span>
        <span className="tabular-nums">{formatEuros(cartTotal)}</span>
      </div>
    </Sheet>
  );
}
