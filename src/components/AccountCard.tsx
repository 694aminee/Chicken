"use client";

import { formatPhone } from "@/lib/phone";
import { useShop } from "./ShopProvider";

export function AccountCard() {
  const { account } = useShop();
  if (!account) return null;
  return (
    <div className="rounded-[14px] border border-line bg-panel p-3.5">
      <b className="mb-2 block font-label text-[19px] tracking-[.03em] uppercase">Mon compte</b>
      <p className="m-0">
        {account.firstName} {account.lastName}
        <br />
        <span className="text-[13px] text-muted">
          {account.email} · {formatPhone(account.phone)}
        </span>
      </p>
    </div>
  );
}
