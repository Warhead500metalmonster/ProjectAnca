import type { MetadataRoute } from "next";

// Telefonda "Ana ekrana ekle" ile uygulama gibi açılsın (tam ekran, kendi simgesiyle)
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ancalog",
    short_name: "Ancalog",
    description: "Oyun, film, dizi, müzik ve anime günlüğün.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#080c0d",
    theme_color: "#080c0d",
    lang: "tr",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Keşfet", url: "/search" },
      { name: "Mesajlar", url: "/chat" },
    ],
  };
}
