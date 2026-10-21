"use client";

import { findProduct } from "@/lib/menu";
import { CartSheet } from "./CartSheet";
import { CheckoutSheet } from "./CheckoutSheet";
import { ProductSheet } from "./ProductSheet";
import { useShop } from "./ShopProvider";

/** Affiche le panneau ouvert (produit, panier ou infos client) */
export function SheetLayer() {
  const { sheet } = useShop();
  if (!sheet) return null;
  if (sheet.kind === "product") {
    const product = findProduct(sheet.productId);
    return product ? <ProductSheet key={product.id} product={product} /> : null;
  }
  if (sheet.kind === "cart") return <CartSheet />;
  return <CheckoutSheet />;
}
