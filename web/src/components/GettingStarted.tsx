"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Entry, Profile } from "@/lib/types";
import { useApp } from "./AppProvider";

const HIDE = "ancalog.startHidden";

// Yeni gelenler için dört adımlık "nereden başlarım" kartı; hepsi bitince ya da kapatınca bir daha çıkmaz
export function GettingStarted({ user, mine }: { user: Profile; mine: Entry[] }) {
  const { openForm, following } = useApp();
  const [hidden, setHidden] = useState(true);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan gelen veri
  useEffect(() => { try { setHidden(localStorage.getItem(HIDE) === "1"); } catch { setHidden(false); } }, []);

  const steps = [
    { done: mine.length >= 20, title: "Kütüphaneni getir", text: "Steam, PlayStation, Xbox, Backloggd, HowLongToBeat, Letterboxd, MyAnimeList, Spotify... Yıllardır biriktirdiğin her şey birkaç dakikada gelir.",
      action: <Link className="btn primary" href="/import">Kütüphanemi getir</Link> },
    { done: mine.length > 0, title: "İlk kaydını ekle", text: "Oynadığın, izlediğin ya da dinlediğin bir şeyi ara, durumunu ve puanını seç.",
      action: <button className="btn" onClick={() => openForm(null)}>+ Ekle</button> },
    { done: following.size > 0, title: "Arkadaşlarını bul", text: "Takip ettiklerinin ne oynadığını ana sayfanda görürsün.",
      action: <Link className="btn" href="/community">Topluluk</Link> },
    { done: !!(user.avatar_url || user.bio), title: "Profilini süsle", text: "Fotoğraf, tema, arka plan resmi ve profil şarkısı ekle.",
      action: <Link className="btn" href="/settings">Profili düzenle</Link> },
  ];
  const left = steps.filter((s) => !s.done).length;
  if (hidden || !left) return null;

  function hide() {
    setHidden(true);
    try { localStorage.setItem(HIDE, "1"); } catch { /* yok say */ }
  }

  return (
    <section className="section start-card">
      <div className="start-head">
        <div><h2>Nasıl başlarım?</h2><span className="muted small">{steps.length - left} / {steps.length} tamam · <Link className="link" href="/help">Sıkça sorulanlar</Link></span></div>
        <button className="icon-btn" aria-label="Kapat" title="Bir daha gösterme" onClick={hide}>✕</button>
      </div>
      <ol className="start-steps">
        {steps.map((s, i) => (
          <li key={s.title} className={s.done ? "done" : ""}>
            <span className="num">{s.done ? "✓" : i + 1}</span>
            <div className="grow"><b>{s.title}</b><span className="muted small">{s.text}</span></div>
            {!s.done && s.action}
          </li>
        ))}
      </ol>
    </section>
  );
}
