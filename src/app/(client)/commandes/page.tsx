"use client";

import Link from "next/link";
import { useShop } from "@/components/ShopProvider";
import { StatusSteps } from "@/components/StatusSteps";
import { parisTime } from "@/lib/hours";
import { formatEuros } from "@/lib/pricing";

export default function CommandesPage() {
  const { orders, ready, today } = useShop();
  const mine = orders.filter((o) => o.day === today);
  return (
    <section className="pt-[22px]">
      <h2 className="m-0 font-display text-[30px] leading-[1.05] uppercase">Mes commandes</h2>
      <p className="mt-1 mb-3 text-sm text-muted">Les commandes passées aujourd&apos;hui.</p>
      {ready && mine.length === 0 && (
        <p className="py-8 text-center text-muted">
          Aucune commande aujourd&apos;hui.
          <br />
          Choisis un produit dans le menu pour commencer.
        </p>
      )}
      <div className="grid gap-2.5">
        {mine.map((o) => (
          <Link key={o.id} href={`/commande/${o.id}`} className="block rounded-[14px] border border-line bg-panel p-3.5">
            <div className="flex items-center gap-2.5">
              <span className="font-display text-[34px] leading-none tabular-nums">{o.number}</span>
              <div className="min-w-0">
                <b className="block">{o.lines.reduce((s, l) => s + l.qty, 0)} article(s)</b>
                <small className="text-muted">{parisTime(o.createdAt)}</small>
              </div>
              <span className="ml-auto font-bold tabular-nums">{formatEuros(o.total)}</span>
            </div>
            <StatusSteps status={o.status} />
          </Link>
        ))}
      </div>
    </section>
  );
}
