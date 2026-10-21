"use client";

// « Tes infos » : prénom, nom, téléphone, et création de compte facultative.
// Étape 1 : le paiement est simulé, aucun argent n'est prélevé.

import { useRouter } from "next/navigation";
import { useState } from "react";
import { HOURS_LABEL, isOpen } from "@/lib/hours";
import { normalizePhone } from "@/lib/phone";
import { formatEuros } from "@/lib/pricing";
import { load, save } from "@/lib/storage";
import { GoButton, Sheet } from "./Sheet";
import { useShop } from "./ShopProvider";

type Fields = { firstName: string; lastName: string; phone: string; email: string; password: string };
type Errors = Partial<Record<keyof Fields, string>>;

const DRAFT_KEY = "ck_draft";

export function CheckoutSheet() {
  const { cartTotal, account, setAccount, placeOrder, openSheet, open } = useShop();
  const router = useRouter();
  const [mode, setMode] = useState<"invite" | "compte">(account ? "compte" : "invite");
  const [fields, setFields] = useState<Fields>(() => ({
    ...{ firstName: "", lastName: "", phone: "", email: "" },
    ...load<Partial<Fields>>(DRAFT_KEY, {}),
    ...(account ?? {}),
    password: "",
  }));
  const [errors, setErrors] = useState<Errors>({});
  const [paying, setPaying] = useState(false);

  const creatingAccount = mode === "compte" && !account;

  const set = (k: keyof Fields) => (e: React.ChangeEvent<HTMLInputElement>) => setFields((f) => ({ ...f, [k]: e.target.value }));

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (paying) return;
    const firstName = fields.firstName.trim();
    const lastName = fields.lastName.trim();
    const email = fields.email.trim();
    const phone = normalizePhone(fields.phone);
    const err: Errors = {};
    if (!firstName) err.firstName = "Écris ton prénom.";
    if (!lastName) err.lastName = "Écris ton nom.";
    if (!phone) err.phone = "Écris un numéro à 10 chiffres, par exemple 06 12 34 56 78.";
    if (creatingAccount) {
      if (!/^\S+@\S+\.\S+$/.test(email)) err.email = "Écris une adresse e-mail valide.";
      if (fields.password.length < 6) err.password = "6 caractères minimum.";
    }
    save(DRAFT_KEY, { firstName, lastName, phone: fields.phone, email });
    setErrors(err);
    if (Object.keys(err).length || !phone) return;
    if (!isOpen()) return; // le bouton est déjà bloqué, double sécurité

    const customer = { firstName, lastName, phone };
    if (creatingAccount) setAccount({ ...customer, email });
    else if (mode === "compte" && account) setAccount({ ...account, ...customer });

    setPaying(true);
    // Paiement simulé : à l'étape 3, ce sera Stripe Checkout.
    setTimeout(() => {
      const order = placeOrder(customer);
      openSheet(null);
      router.push(`/commande/${order.id}`);
    }, 1200);
  };

  const closed = open === false;

  return (
    <Sheet
      title="Tes infos"
      subtitle="Pour qu'on t'appelle si besoin et qu'on te reconnaisse au comptoir."
      onClose={() => openSheet(null)}
      footer={
        <>
          <button
            type="button"
            className="h-12 rounded-xl border border-line px-3.5 font-semibold"
            onClick={() => openSheet({ kind: "cart" })}
          >
            Panier
          </button>
          <GoButton type="submit" form="checkout" disabled={paying || closed}>
            {closed ? "Fermé" : paying ? "Paiement en cours…" : `Payer ${formatEuros(cartTotal)}`}
          </GoButton>
        </>
      }
    >
      <div role="group" aria-label="Mode" className="mt-3.5 grid grid-cols-2 rounded-xl border border-line bg-panel p-1">
        {(["invite", "compte"] as const).map((m) => (
          <button
            key={m}
            type="button"
            aria-pressed={mode === m}
            onClick={() => setMode(m)}
            className={`h-10 rounded-[9px] font-semibold ${mode === m ? "bg-paper text-ink" : "text-muted"}`}
          >
            {m === "invite" ? "Invité" : account ? "Mon compte" : "Créer un compte"}
          </button>
        ))}
      </div>

      <form id="checkout" noValidate onSubmit={submit}>
        <Field
          id="firstName"
          label="Prénom"
          autoComplete="given-name"
          value={fields.firstName}
          onChange={set("firstName")}
          error={errors.firstName}
        />
        <Field
          id="lastName"
          label="Nom"
          autoComplete="family-name"
          value={fields.lastName}
          onChange={set("lastName")}
          error={errors.lastName}
        />
        <Field
          id="phone"
          label="Téléphone"
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          placeholder="06 12 34 56 78"
          value={fields.phone}
          onChange={set("phone")}
          error={errors.phone}
        />
        {creatingAccount && (
          <>
            <Field
              id="email"
              label="E-mail"
              type="email"
              autoComplete="email"
              value={fields.email}
              onChange={set("email")}
              error={errors.email}
            />
            <Field
              id="password"
              label="Mot de passe"
              type="password"
              autoComplete="new-password"
              value={fields.password}
              onChange={set("password")}
              error={errors.password}
            />
          </>
        )}
        {mode === "compte" && account && (
          <p className="mt-2.5 text-[13px] text-muted">
            Connecté : {account.email} ·{" "}
            <button
              type="button"
              className="text-[13px] underline"
              onClick={() => {
                setAccount(null);
                setMode("invite");
              }}
            >
              Se déconnecter
            </button>
          </p>
        )}
        {closed && (
          <p className="mt-4 rounded-xl border border-red p-3 text-[13.5px] text-paper">
            <b>Le snack est fermé.</b> Les commandes en ligne sont ouvertes tous les jours de {HOURS_LABEL}.
          </p>
        )}
        <div className="mt-4 rounded-xl border border-dashed border-line p-3 text-[13.5px] text-muted">
          <b className="text-paper">Retrait :</b> dès que possible
          <br />
          <b className="text-paper">Paiement :</b> carte bancaire en ligne. Dans cette version d&apos;essai, aucun paiement réel
          n&apos;est effectué.
        </div>
      </form>
    </Sheet>
  );
}

type FieldProps = React.InputHTMLAttributes<HTMLInputElement> & { id: string; label: string; error?: string };

function Field({ id, label, error, ...input }: FieldProps) {
  return (
    <div className="mt-3 grid gap-[5px]">
      <label htmlFor={id} className="text-[13px] font-semibold text-muted">
        {label}
      </label>
      <input
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-err` : undefined}
        className="h-12 w-full rounded-xl border border-line bg-panel px-3.5 text-base text-paper aria-[invalid=true]:border-red"
        {...input}
      />
      {error && (
        <span id={`${id}-err`} className="text-[13px] text-err">
          {error}
        </span>
      )}
    </div>
  );
}
