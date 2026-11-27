import type { Metadata, Viewport } from "next";
import { Great_Vibes, Playfair_Display, Poppins } from "next/font/google";
import "./globals.css";

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

const script = Great_Vibes({
  variable: "--font-greatvibes",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "The Girly Club · Club de sport 100 % Girly à Vaulx-en-Velin",
  description:
    "Pilates Reformer, Pilates au sol, Boxe, Cross Training, Taekwondo et Aquabike en cabine privée. Réservez vos séances au 3 bis rue Léonard de Vinci, Vaulx-en-Velin.",
  openGraph: {
    title: "The Girly Club",
    description: "Club de sport 100 % Girly à Vaulx-en-Velin.",
    locale: "fr_FR",
    type: "website",
  },
};

export const viewport: Viewport = {
  themeColor: "#faf7f4",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="fr" className={`${poppins.variable} ${playfair.variable} ${script.variable} antialiased`}>
      <body className="min-h-svh bg-cream font-sans text-charcoal">{children}</body>
    </html>
  );
}
