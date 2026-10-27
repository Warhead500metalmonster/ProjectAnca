import { Suspense } from "react";
import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Topbar } from "@/components/Topbar";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Ancalog",
  description: "Oyun, film, dizi, müzik ve anime günlüğün. Logla, puanla, arkadaşlarını takip et.",
  icons: { icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>📒</text></svg>" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${outfit.variable}`}>
      <body>
        <AppProvider>
          <Suspense fallback={null}><Topbar /></Suspense>
          <main className="app"><Suspense fallback={<div className="loading">Yükleniyor…</div>}>{children}</Suspense></main>
          <footer className="footer">
            <span>📒 Ancalog</span>
            <span>Oyun verileri: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a></span>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
