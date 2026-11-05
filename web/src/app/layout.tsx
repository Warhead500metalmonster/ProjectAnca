import { Suspense } from "react";
import Link from "next/link";
import type { Metadata, Viewport } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { AppProvider } from "@/components/AppProvider";
import { Topbar } from "@/components/Topbar";
import { NavProgress } from "@/components/NavProgress";
import { Announcement } from "@/components/Announcement";
import { WarningBanner } from "@/components/WarningBanner";
import { GuestBar } from "@/components/GuestBar";
import { UnlinkedNotice } from "@/components/UnlinkedNotice";
import { PrefsAsk } from "@/components/PrefsPanel";
import { themeBootScript } from "@/lib/theme";

const inter = Inter({ variable: "--font-inter", subsets: ["latin", "latin-ext"] });
const outfit = Outfit({ variable: "--font-outfit", subsets: ["latin", "latin-ext"], weight: ["600", "700", "800"] });

export const metadata: Metadata = {
  metadataBase: new URL("https://ancalog.vercel.app"),
  title: "Ancalog",
  description: "Oyun, film, dizi, müzik ve anime günlüğün. Logla, puanla, listeler yap, arkadaşlarını takip et.",
  openGraph: { siteName: "Ancalog", locale: "tr_TR", type: "website", title: "Ancalog", description: "Oyun, film, dizi, müzik ve anime günlüğün. Logla, puanla, listeler yap, her yerden içe aktar." },
  twitter: { card: "summary_large_image" },
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
          <link rel="preconnect" href="https://images.igdb.com" />
          <link rel="preconnect" href="https://rsdhrnjycttihsduhasl.supabase.co" />
          <Suspense fallback={null}><NavProgress /></Suspense>
          <Suspense fallback={null}><Topbar /></Suspense>
          <Announcement />
          <WarningBanner />
          <Suspense fallback={null}><GuestBar /></Suspense>
          <main className="app"><Suspense fallback={<div className="loading">Yükleniyor…</div>}>{children}</Suspense></main>
          <Suspense fallback={null}><UnlinkedNotice /><PrefsAsk /></Suspense>
          <footer className="footer">
            <span className="footer-links"><Link href="/import">Kütüphaneni getir</Link><Link href="/top">Sıralamalar</Link><Link href="/forum">Forum</Link><Link href="/help">Sıkça sorulanlar</Link><Link href="/about">Biz kimiz?</Link><Link href="/support">Bize yaz</Link><Link href="/terms">Kullanım Koşulları</Link><Link href="/privacy">Gizlilik ve KVKK</Link></span>
            <span className="muted">© 2026 Ancalog. Kâr amacı gütmeden, eğlence ve hobi için yapay zekâ desteğiyle geliştirilmiştir. Veriler: <a href="https://www.igdb.com" target="_blank" rel="noopener">IGDB</a> · <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a> · <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a> · <a href="https://music.apple.com" target="_blank" rel="noopener">Apple Music</a> · <a href="https://www.deezer.com" target="_blank" rel="noopener">Deezer</a></span>
            <span className="muted">Oyun, film, dizi, albüm ve anime adları, kapakları ve logoları sahiplerine aittir; Ancalog bu şirketlerle bağlantılı değildir.
              Bu site TMDB API&apos;sini kullanır ancak TMDB tarafından onaylanmış değildir. <Link href="/terms">Fikri mülkiyet</Link></span>
          </footer>
        </AppProvider>
      </body>
    </html>
  );
}
