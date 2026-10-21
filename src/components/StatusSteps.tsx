import { STATUS_LABEL, type OrderStatus } from "./ShopProvider";

const ORDER: OrderStatus[] = ["new", "prep", "ready"];

/** Reçue → En préparation → Prête */
export function StatusSteps({ status }: { status: OrderStatus }) {
  const reached = ORDER.indexOf(status);
  return (
    <div className="mt-3.5 mb-1 flex flex-wrap justify-center gap-1.5">
      {ORDER.map((s, i) => (
        <span
          key={s}
          aria-current={i === reached ? "step" : undefined}
          className={`rounded-full border px-2.5 py-[5px] font-label text-sm tracking-[.05em] uppercase ${
            i <= reached ? "border-ok bg-ok text-ink" : "border-line text-muted"
          }`}
        >
          {STATUS_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
