import type { MetadataRoute } from "next";

// Permet d'ajouter le site à l'écran d'accueil du téléphone (PWA)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Chicken King",
    short_name: "Chicken King",
    description: "Commande en ligne, retrait au comptoir.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#0d0c0c",
    theme_color: "#0d0c0c",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
