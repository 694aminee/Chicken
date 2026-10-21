import type { Metadata } from "next";
import { AccountCard } from "@/components/AccountCard";
import { HOURS_LABEL } from "@/lib/hours";

export const metadata: Metadata = { title: "Infos · Chicken King" };

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export default function InfosPage() {
  return (
    <section className="pt-[22px]">
      <h2 className="m-0 font-display text-[30px] leading-[1.05] uppercase">Infos</h2>
      <p className="mt-1 mb-3 text-sm text-muted">Horaires, adresse et contact.</p>
      <div className="grid gap-2.5">
        <Card title="Horaires">
          {DAYS.map((d) => (
            <div key={d} className="flex justify-between gap-3 border-b border-line py-[9px] last:border-b-0">
              <span>{d}</span>
              <span className="tabular-nums">{HOURS_LABEL}</span>
            </div>
          ))}
        </Card>
        <Card title="Adresse">
          <p className="m-0">
            Résidence Quai des Lilas
            <br />
            136 rue Antoine Arnaud
            <br />
            69400 Villefranche-sur-Saône
          </p>
          <a
            className="mt-2 inline-block text-[13px] text-muted underline"
            href="https://www.google.com/maps/search/?api=1&query=136+rue+Antoine+Arnaud+69400+Villefranche-sur-Sa%C3%B4ne"
            target="_blank"
            rel="noopener noreferrer"
          >
            Voir sur la carte
          </a>
        </Card>
        <Card title="Téléphone">
          <a href="tel:+33426473432" className="text-xl font-bold tabular-nums">
            04 26 47 34 32
          </a>
        </Card>
        <AccountCard />
      </div>
    </section>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[14px] border border-line bg-panel p-3.5">
      <b className="mb-2 block font-label text-[19px] tracking-[.03em] uppercase">{title}</b>
      {children}
    </div>
  );
}
