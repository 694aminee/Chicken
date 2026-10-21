import type { Metadata } from "next";
import { BossBoard } from "@/components/BossBoard";

export const metadata: Metadata = { title: "Patron · Chicken King" };

export default function PatronPage() {
  return <BossBoard />;
}
