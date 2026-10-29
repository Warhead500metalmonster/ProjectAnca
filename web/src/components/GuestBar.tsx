"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useApp } from "./AppProvider";

// Üye olmadan gezenlere her sayfada: en büyük farkımız, başka yerdeki kütüphaneni getirebilmek
const KEY = "ancalog.guestBarClosed";

export function GuestBar() {
  const { me, ready } = useApp();
  const path = usePathname();
  const [closed, setClosed] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan okunan tercih
  useEffect(() => { try { setClosed(sessionStorage.getItem(KEY) === "1"); } catch { setClosed(false); } }, []);
  // Karşılama sayfası ve içe aktar sayfası zaten büyük tanıtımı gösteriyor; iki kez söylemeyelim
  if (!ready || me || closed || path === "/" || /^\/(signup|login|import)/.test(path)) return null;

  function close() {
    try { sessionStorage.setItem(KEY, "1"); } catch { /* yok say */ }
    setClosed(true);
  }

  return (
    <div className="guest-bar" role="region" aria-label="Kütüphaneni getir">
      <p>
        <b>Sıfırdan başlama.</b> Steam, PlayStation, Xbox, HowLongToBeat, Backloggd, Letterboxd, MyAnimeList, Spotify… Yıllardır biriktirdiğin
        <b> bütün kütüphaneni birkaç dakikada</b> buraya getir.
      </p>
      <Link className="btn primary" href="/signup">Ücretsiz katıl, getir</Link>
      <button className="icon-btn" aria-label="Kapat" onClick={close}>✕</button>
    </div>
  );
}
