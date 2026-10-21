"use client";

// Panneau qui monte du bas de l'écran (personnalisation, panier, infos client).

import { useEffect } from "react";

type Props = {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  onClose: () => void;
  footer?: React.ReactNode;
  children: React.ReactNode;
};

export function Sheet({ title, subtitle, onClose, footer, children }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="sheet-anim flex max-h-[92%] w-full max-w-[560px] flex-col rounded-t-[20px] border border-b-0 border-line bg-ink"
      >
        <div className="px-safe flex items-start gap-3 border-b border-line pt-4 pb-2.5">
          <div>
            <h3 className="m-0 font-display text-[26px] leading-[1.05] uppercase">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button
            type="button"
            aria-label="Fermer"
            onClick={onClose}
            className="ml-auto h-9 w-9 flex-none rounded-full border border-line bg-panel text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="px-safe flex-1 overflow-y-auto pt-1.5 pb-4">{children}</div>
        {footer && (
          <div
            className="px-safe flex items-center gap-2.5 border-t border-line pt-3"
            style={{ paddingBottom: "calc(12px + env(safe-area-inset-bottom, 0px))" }}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}

/** Gros bouton rouge d'action */
export function GoButton(props: React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={`flex h-12 flex-1 items-center justify-center gap-2.5 rounded-xl bg-red px-3.5 text-base font-bold tabular-nums disabled:bg-line disabled:text-muted ${props.className ?? ""}`}
    />
  );
}

/** Sélecteur de quantité − 1 + */
export function Qty({ value, onChange, small }: { value: number; onChange: (v: number) => void; small?: boolean }) {
  const btn = small ? "h-9 w-9" : "h-[46px] w-10";
  return (
    <div className="flex flex-none items-center rounded-xl border border-line">
      <button type="button" aria-label="Moins" className={`${btn} text-[22px]`} onClick={() => onChange(value - 1)}>
        −
      </button>
      <span className="min-w-[22px] text-center font-bold tabular-nums">{value}</span>
      <button type="button" aria-label="Plus" className={`${btn} text-[22px]`} onClick={() => onChange(value + 1)}>
        +
      </button>
    </div>
  );
}
