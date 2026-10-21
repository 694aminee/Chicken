import { BottomNav, CartBar } from "@/components/BottomBars";
import { Header } from "@/components/Header";
import { SheetLayer } from "@/components/SheetLayer";

// Habillage des pages clients : en-tête, bouton panier, navigation du bas
export default function ClientLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main className="px-safe mx-auto max-w-[560px]" style={{ paddingBottom: "calc(150px + env(safe-area-inset-bottom, 0px))" }}>
        {children}
      </main>
      <CartBar />
      <BottomNav />
      <SheetLayer />
    </>
  );
}
