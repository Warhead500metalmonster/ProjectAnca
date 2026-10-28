import { Suspense } from "react";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Topbar } from "@/components/Topbar";
import { Announcement } from "@/components/Announcement";
import { themeBootScript } from "@/lib/theme";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  title: "Ancalog",
  description: "Oyun, film, dizi, müzik ve anime günlüğün. Logla, puanla, listeler yap, arkadaşlarını takip et.",
  appleWebApp: { capable: true, title: "Ancalog", statusBarStyle: "black-translucent" },
  icons: { apple: "/apple-icon.png", icon: "data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='black'/><text x='50' y='72' font-size='64' text-anchor='middle' fill='white' font-family='sans-serif'>A</text></svg>" },
};

export const viewport: Viewport = { themeColor: "#080c0d", viewportFit: "cover" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr" className={`${inter.variable} ${outfit.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeBootScript }} /></head>
      <body>
        <AppProvider>
          <Suspense fallback={null}><Topbar /></Suspense>
          <Announcement />
          <main className="app"><Suspense fallback={<div className="loading">Yükleniyor…</div>}>{children}</Suspense></main>
          <footer className="footer">
            <span>Ancalog</span>
            <span>Veriler: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a> · <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a> · <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> · <a href="https://music.apple.com" target="_blank" rel="noopener">Apple Music</a> · <a href="https://www.deezer.com" target="_blank" rel="noopener">Deezer</a></span>
            <span className="muted">Bu site TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmış değildir.</span>
            <span><Link href="/about">Biz kimiz?</Link> · <Link href="/help">Nasıl kullanılır?</Link> · <Link href="/forum">Forum</Link> · <Link href="/chat">Site sahibine yaz</Link></span>
            <span><Link href="/terms">Kullanım Koşulları</Link> · <Link href="/privacy">Gizlilik ve KVKK</Link> · © 2026 Ancalog</span>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
