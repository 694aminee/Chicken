import type { Metadata } from "next";
import Link from "next/link";
import { SITE, fullAddress } from "@/lib/site";

export const metadata: Metadata = {
  title: "Mentions légales · The Girly Club",
  robots: { index: false },
};

/**
 * ⚠️ MODÈLE À COMPLÉTER ET À FAIRE RELIRE.
 * Les éléments entre crochets [ ] doivent être remplacés par les vraies informations de l'entreprise.
 */
export default function MentionsLegales() {
  const todo = (t: string) => <span className="rounded bg-rose/10 px-1 text-rose">[{t}]</span>;
  return (
    <main className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
      <Link href="/" className="text-sm font-semibold text-terracotta">
        ← Retour au site
      </Link>
      <h1 className="mt-6 font-serif text-4xl font-semibold">Mentions légales</h1>

      <div className="mt-10 space-y-8 text-sm leading-relaxed text-charcoal/85 [&_h2]:mb-2 [&_h2]:font-serif [&_h2]:text-xl [&_h2]:font-semibold [&_h2]:text-charcoal">
        <section>
          <h2>Éditeur du site</h2>
          <p>
            {SITE.name} — {todo("forme juridique : SAS, SARL, EI…")} au capital de {todo("montant")} €<br />
            Siège : {fullAddress}
            <br />
            SIRET : {todo("numéro SIRET")} · RCS {todo("ville")}
            <br />
            Responsable de la publication : {todo("nom du ou de la gérante")}
            <br />
            Contact : {todo("e-mail")} · {todo("téléphone")}
          </p>
        </section>
        <section>
          <h2>Hébergement</h2>
          <p>Vercel Inc., 440 N Barranca Ave #4133, Covina, CA 91723, États-Unis — vercel.com</p>
        </section>
        <section>
          <h2>Réservations et paiements</h2>
          <p>
            Les réservations et paiements sont réalisés sur la plateforme Planity, selon ses propres conditions
            générales. Ce site ne collecte aucune donnée de paiement.
          </p>
        </section>
        <section>
          <h2>Données personnelles</h2>
          <p>
            Ce site ne dépose pas de cookie publicitaire et ne collecte pas de données personnelles. Pour toute
            question, contactez-nous à {todo("e-mail")}.
          </p>
        </section>
        <section>
          <h2>Propriété intellectuelle</h2>
          <p>
            Les textes, photos, vidéos et logos de ce site appartiennent à {SITE.name}. Toute reproduction sans
            autorisation est interdite.
          </p>
        </section>
      </div>
    </main>
  );
}
