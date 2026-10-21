"use client";

// Écran patron, pensé pour une tablette posée au comptoir.
// Étape 1 (démo) : il affiche les commandes passées depuis ce même navigateur.
// Étape 2 : il sera protégé par connexion et recevra en direct (Supabase
// Realtime) les commandes payées de tous les clients.

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { parisTime } from "@/lib/hours";
import { formatPhone } from "@/lib/phone";
import { formatEuros } from "@/lib/pricing";
import { STATUS_LABEL, useShop, type OrderStatus } from "./ShopProvider";

const BORDER: Record<OrderStatus, string> = {
  new: "border-l-red",
  prep: "border-l-gold",
  ready: "border-l-ok",
};

export function BossBoard() {
  const { orders, ready, today, setOrderStatus, toast } = useShop();
  const [filter, setFilter] = useState<"current" | "done">("current");
  const [sound, setSound] = useState(false);
  const audio = useRef<AudioContext | null>(null);
  const seen = useRef<Set<string> | null>(null);

  const todays = orders.filter((o) => o.day === today);
  const current = todays.filter((o) => o.status !== "ready");
  const done = todays.filter((o) => o.status === "ready");
  // Les plus anciennes en premier : c'est l'ordre de préparation
  const shown = [...(filter === "current" ? current : done)].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  // Son à l'arrivée d'une nouvelle commande
  useEffect(() => {
    if (!ready) return;
    const ids = new Set(orders.map((o) => o.id));
    if (seen.current && sound && audio.current) {
      if ([...ids].some((id) => !seen.current!.has(id))) ding(audio.current);
    }
    seen.current = ids;
  }, [orders, ready, sound]);

  const enableSound = () => {
    audio.current ??= new AudioContext();
    void audio.current.resume();
    ding(audio.current);
    setSound(true);
  };

  const change = (id: string, num: number, s: OrderStatus) => {
    setOrderStatus(id, s);
    toast(`Commande ${num} : ${STATUS_LABEL[s]}`);
  };

  return (
    <div className="px-safe mx-auto max-w-[1100px] pt-4 pb-10">
      <header className="flex flex-wrap items-center gap-3 border-b border-line pb-4">
        <Image src="/logo.png" alt="Logo Chicken King" width={56} height={56} className="rounded-full" />
        <h1 className="m-0 font-display text-4xl uppercase">
          Commandes <span className="text-red">du jour</span>
        </h1>
        <span className="rounded-full border border-gold px-2 py-0.5 font-label text-xs tracking-[.06em] text-gold uppercase">
          Démo
        </span>
        <button
          type="button"
          onClick={enableSound}
          aria-pressed={sound}
          className={`ml-auto h-14 rounded-xl px-5 text-lg font-bold ${sound ? "border border-ok text-ok" : "bg-red"}`}
        >
          {sound ? "Son activé" : "Activer le son"}
        </button>
      </header>

      <p className="mt-3 text-[15px] text-muted">
        Démo : cet écran affiche les commandes passées depuis ce navigateur. Dans la vraie version, il sera protégé par un mot de
        passe et recevra en direct les commandes de tous les clients.
      </p>

      <div role="group" aria-label="Filtre" className="mt-4 grid max-w-md grid-cols-2 rounded-xl border border-line bg-panel p-1">
        {(
          [
            ["current", `En cours (${current.length})`],
            ["done", `Terminées (${done.length})`],
          ] as const
        ).map(([k, label]) => (
          <button
            key={k}
            type="button"
            aria-pressed={filter === k}
            onClick={() => setFilter(k)}
            className={`h-12 rounded-[9px] text-lg font-semibold ${filter === k ? "bg-paper text-ink" : "text-muted"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {ready && shown.length === 0 && (
        <p className="py-12 text-center text-lg text-muted">
          {filter === "current" ? "Aucune commande en cours." : "Aucune commande terminée aujourd'hui."}
          <br />
          Passe une commande test depuis le menu pour la voir arriver ici.
        </p>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {shown.map((o) => (
          <article
            key={o.id}
            className={`grid gap-3 rounded-xl border border-l-[6px] border-line bg-panel p-4 ${BORDER[o.status]}`}
          >
            <div className="flex items-center gap-3">
              <span className="font-display text-5xl leading-none tabular-nums">{o.number}</span>
              <div className="min-w-0">
                <b className="block text-xl">
                  {o.customer.firstName} {o.customer.lastName}
                </b>
                <span className="text-muted">
                  <a href={`tel:${o.customer.phone}`} className="underline">
                    {formatPhone(o.customer.phone)}
                  </a>{" "}
                  · {parisTime(o.createdAt)}
                </span>
              </div>
              <span className="ml-auto text-xl font-bold tabular-nums">{formatEuros(o.total)}</span>
            </div>
            <ul className="m-0 grid gap-1.5 pl-5 text-lg">
              {o.lines.map((l, i) => (
                <li key={i}>
                  <b>
                    {l.qty} × {l.name}
                  </b>
                  {l.summary && <div className="text-[15px] text-muted">{l.summary}</div>}
                </li>
              ))}
            </ul>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS_LABEL) as OrderStatus[]).map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={o.status === s}
                  onClick={() => change(o.id, o.number, s)}
                  className={`h-14 rounded-xl border text-base font-bold ${
                    o.status === s ? "border-paper bg-paper text-ink" : "border-line"
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

/** Petit « ding » à deux notes */
function ding(ctx: AudioContext) {
  const t = ctx.currentTime;
  [880, 1320].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0.0001, t + i * 0.18);
    gain.gain.exponentialRampToValueAtTime(0.4, t + i * 0.18 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.35);
    osc.connect(gain).connect(ctx.destination);
    osc.start(t + i * 0.18);
    osc.stop(t + i * 0.18 + 0.4);
  });
}
