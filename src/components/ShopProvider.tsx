"use client";

// Le « cerveau » du site côté téléphone : panier, compte, commandes,
// panneau ouvert, petits messages. Tout est gardé dans la mémoire du
// navigateur pour l'étape 1 ; les commandes passeront par Supabase à l'étape 2.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { findProduct, type Product } from "@/lib/menu";
import { describe, unitPrice, type Selection } from "@/lib/pricing";
import { isOpen, parisDay } from "@/lib/hours";
import { load, save } from "@/lib/storage";

export type CartItem = { key: string; productId: string; sel: Selection; qty: number };
export type CartLine = CartItem & { product: Product; summary: string; unit: number };

export type Customer = { firstName: string; lastName: string; phone: string; email?: string };

export type OrderStatus = "new" | "prep" | "ready";
export const STATUS_LABEL: Record<OrderStatus, string> = {
  new: "Reçue",
  prep: "En préparation",
  ready: "Prête",
};

export type Order = {
  id: string;
  number: number;
  day: string;
  createdAt: string;
  customer: Customer;
  lines: { name: string; summary: string; qty: number; unit: number }[];
  total: number;
  status: OrderStatus;
};

export type Sheet = { kind: "product"; productId: string } | { kind: "cart" } | { kind: "checkout" } | null;

const KEYS = {
  cart: "ck_cart",
  orders: "ck_orders",
  account: "ck_account",
  counter: "ck_counter",
};

type Shop = {
  ready: boolean;
  open: boolean | null;
  /** Jour en cours à Paris (AAAA-MM-JJ), connu une fois la page chargée */
  today: string | null;
  cart: CartLine[];
  cartCount: number;
  cartTotal: number;
  addToCart: (productId: string, sel: Selection, qty: number) => void;
  setQty: (key: string, qty: number) => void;
  removeLine: (key: string) => void;
  account: Customer | null;
  setAccount: (a: Customer | null) => void;
  orders: Order[];
  placeOrder: (customer: Customer) => Order;
  setOrderStatus: (id: string, status: OrderStatus) => void;
  sheet: Sheet;
  openSheet: (s: Sheet) => void;
  toast: (msg: string) => void;
};

const ShopContext = createContext<Shop | null>(null);

export function useShop(): Shop {
  const ctx = useContext(ShopContext);
  if (!ctx) throw new Error("useShop doit être utilisé dans <ShopProvider>");
  return ctx;
}

function randomId() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function ShopProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [open, setOpen] = useState<boolean | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [items, setItems] = useState<CartItem[]>([]);
  const [account, setAccountState] = useState<Customer | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [sheet, setSheet] = useState<Sheet>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Lecture de la mémoire du navigateur, une fois la page chargée
  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect -- lecture unique du localStorage au montage */
    setItems(load<CartItem[]>(KEYS.cart, []));
    setAccountState(load<Customer | null>(KEYS.account, null));
    setOrders(load<Order[]>(KEYS.orders, []));
    setReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    // Si l'écran patron est ouvert dans un autre onglet, on suit ses changements
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEYS.orders) setOrders(load<Order[]>(KEYS.orders, []));
      if (e.key === KEYS.cart) setItems(load<CartItem[]>(KEYS.cart, []));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  // Ouvert / fermé (et changement de jour), vérifié toutes les 30 secondes
  useEffect(() => {
    const tick = () => {
      setOpen(isOpen());
      setToday(parisDay());
    };
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, []);

  const updateItems = useCallback((fn: (prev: CartItem[]) => CartItem[]) => {
    setItems((prev) => {
      const next = fn(prev);
      save(KEYS.cart, next);
      return next;
    });
  }, []);

  const updateOrders = useCallback((fn: (prev: Order[]) => Order[]) => {
    setOrders((prev) => {
      const next = fn(prev);
      save(KEYS.orders, next);
      return next;
    });
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToastMsg(null), 1800);
  }, []);

  // Le prix de chaque ligne est toujours recalculé à partir du menu
  const cart = useMemo<CartLine[]>(
    () =>
      items.flatMap((it) => {
        const product = findProduct(it.productId);
        if (!product) return [];
        return [{ ...it, product, summary: describe(product, it.sel), unit: unitPrice(product, it.sel) }];
      }),
    [items],
  );
  const cartCount = cart.reduce((s, l) => s + l.qty, 0);
  const cartTotal = cart.reduce((s, l) => s + l.unit * l.qty, 0);

  const addToCart = useCallback(
    (productId: string, sel: Selection, qty: number) =>
      updateItems((prev) => [...prev, { key: randomId(), productId, sel, qty }]),
    [updateItems],
  );
  const setQty = useCallback(
    (key: string, qty: number) =>
      updateItems((prev) =>
        qty < 1 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, qty: Math.min(qty, 20) } : l)),
      ),
    [updateItems],
  );
  const removeLine = useCallback((key: string) => updateItems((prev) => prev.filter((l) => l.key !== key)), [updateItems]);

  const setAccount = useCallback((a: Customer | null) => {
    setAccountState(a);
    save(KEYS.account, a);
  }, []);

  // Étape 1 : numéro de commande simulé, remis à 1 chaque jour (heure de Paris).
  // À l'étape 3, il sera attribué par la base au moment où Stripe confirme le paiement.
  const placeOrder = useCallback(
    (customer: Customer): Order => {
      const day = parisDay();
      const counter = load(KEYS.counter, { day: "", n: 0 });
      const n = counter.day === day && counter.n < 999 ? counter.n + 1 : 1;
      save(KEYS.counter, { day, n });
      const order: Order = {
        id: randomId(),
        number: n,
        day,
        createdAt: new Date().toISOString(),
        customer: { firstName: customer.firstName, lastName: customer.lastName, phone: customer.phone },
        lines: cart.map((l) => ({ name: l.product.name, summary: l.summary, qty: l.qty, unit: l.unit })),
        total: cartTotal,
        status: "new",
      };
      updateOrders((prev) => [order, ...prev].slice(0, 200));
      updateItems(() => []);
      return order;
    },
    [cart, cartTotal, updateItems, updateOrders],
  );

  const setOrderStatus = useCallback(
    (id: string, status: OrderStatus) => updateOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o))),
    [updateOrders],
  );

  // Empêche la page de défiler derrière un panneau ouvert
  useEffect(() => {
    document.body.style.overflow = sheet ? "hidden" : "";
  }, [sheet]);

  const value: Shop = {
    ready,
    open,
    today,
    cart,
    cartCount,
    cartTotal,
    addToCart,
    setQty,
    removeLine,
    account,
    setAccount,
    orders,
    placeOrder,
    setOrderStatus,
    sheet,
    openSheet: setSheet,
    toast,
  };

  return (
    <ShopContext.Provider value={value}>
      {children}
      {toastMsg && (
        <div
          role="status"
          className="fixed left-1/2 z-[60] -translate-x-1/2 whitespace-nowrap rounded-full bg-paper px-4 py-2.5 text-sm font-semibold text-ink shadow-[0_6px_20px_rgba(0,0,0,.4)]"
          style={{ bottom: "calc(140px + env(safe-area-inset-bottom, 0px))" }}
        >
          {toastMsg}
        </div>
      )}
    </ShopContext.Provider>
  );
}
