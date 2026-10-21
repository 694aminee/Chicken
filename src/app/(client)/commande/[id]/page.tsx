"use client";

// Page de confirmation : numéro de commande en très grand et statut en direct.

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense } from "react";
import { useShop } from "@/components/ShopProvider";
import { StatusSteps } from "@/components/StatusSteps";
import { formatEuros } from "@/lib/pricing";

export default function ConfirmationPage() {
  return (
    <Suspense>
      <Confirmation />
    </Suspense>
  );
}

function Confirmation() {
  const { id } = useParams<{ id: string }>();
  const { orders, ready } = useShop();
  if (!ready) return null;

  const order = orders.find((o) => o.id === id);
  if (!order) {
    return (
      <div className="py-10 text-center text-muted">
        Commande introuvable.
        <br />
        <Link href="/" className="mt-4 inline-block underline">
          Retour au menu
        </Link>
      </div>
    );
  }

  return (
    <section className="pt-[22px] text-center">
      <h2 className="m-0 font-display text-[30px] leading-[1.05] uppercase">Merci {order.customer.firstName} !</h2>
      <p className="mt-1 text-sm text-muted">Paiement accepté · {formatEuros(order.total)}</p>

      <div className="mt-6 font-label text-[15px] tracking-[.08em] text-muted uppercase">Ton numéro de commande</div>
      <div className="ticket mx-auto my-2.5 inline-block rounded-2xl bg-paper px-[30px] pt-3.5 pb-2 font-display text-[96px] leading-none text-ink tabular-nums">
        {order.number}
      </div>
      <p className="mt-2.5 text-[13px] text-muted">Donne ce numéro au comptoir. On te prévient quand c&apos;est prêt.</p>
      <div aria-live="polite">
        <StatusSteps status={order.status} />
      </div>

      <div className="mt-6 rounded-[14px] border border-line bg-panel p-3.5 text-left">
        <b className="mb-1 block font-label text-[19px] tracking-[.03em] uppercase">Ta commande</b>
        {order.lines.map((l, i) => (
          <div key={i} className="flex justify-between gap-3 border-b border-line py-2.5 last:border-b-0">
            <div>
              <div className="font-semibold">
                {l.qty} × {l.name}
              </div>
              {l.summary && <div className="text-[13px] text-muted">{l.summary}</div>}
            </div>
            <span className="font-bold tabular-nums">{formatEuros(l.unit * l.qty)}</span>
          </div>
        ))}
        <p className="mt-2 mb-0 text-[13px] text-muted">Retrait : dès que possible, au comptoir.</p>
      </div>

      <Link href="/" className="mt-5 flex h-12 items-center justify-center rounded-xl bg-red font-bold">
        Retour au menu
      </Link>
    </section>
  );
}
