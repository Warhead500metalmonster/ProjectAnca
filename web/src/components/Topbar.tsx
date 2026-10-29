"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./ui";
import { useApp } from "./AppProvider";
import { q, sb } from "@/lib/supabase";
import { eventState, fetchEvents } from "@/lib/events";
import { useLoad } from "@/lib/useLoad";

export const NOTIF_SEEN = "ancalog.notifSeen";

export function Topbar() {
  const { me: user, openForm, unread, notifAt, isAdmin, version } = useApp();
  // Sunucu girişi bilmez; ilk çizim sunucuyla aynı olsun (yoksa sayfa baştan çizilir), giriş bir an sonra görünür
  const [ready, setReady] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- yalnızca ilk çizimden sonra bir kez
  useEffect(() => setReady(true), []);
  const me = ready ? user : null;
  const path = usePathname();
  const [seen, setSeen] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { try { setSeen(localStorage.getItem(NOTIF_SEEN) || ""); } catch { /* yok say */ } }, [path, notifAt]);

  // Süren ya da yaklaşan, henüz katılmadığın etkinlik varsa menüde parlayan işaret
  const { data: freshEvents } = useLoad(async () => {
    const open = (await fetchEvents()).filter((e) => eventState(e) !== "ended");
    if (!open.length || !me) return open.length;
    const joined = await q<{ event_id: string }[]>(sb().from("event_members").select("event_id").eq("user_id", me.id)).catch(() => []);
    return open.filter((e) => !joined.some((j) => j.event_id === e.id)).length;
  }, [me?.id, version, path.startsWith("/events")], ready);
  const mine = me ? `/u/${me.username}` : "/login";
  const active = (key: string) => ({
    home: path === "/",
    search: path.startsWith("/search"),
    community: path.startsWith("/community"),
    events: path.startsWith("/events"),
    chat: path.startsWith("/chat") || path.startsWith("/forum"),
    me: path === mine || path.startsWith(mine + "/") || path === "/settings",
  })[key] ? "active" : "";

  return (
    <header className="topbar">
      <Link href="/" className="brand"><span>Ancalog</span></Link>
      <nav className="nav">
        <Link href="/" className={active("home")}>
          <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg><span>Ana Sayfa</span>
        </Link>
        <Link href="/community" className={active("community")}>
          <svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.3.9 2.1 2.2 2.1 3.9v2h7v-2c0-2.7-5.3-4-8-4z" /></svg><span>Topluluk</span>
        </Link>
        <Link href="/events" className={`nav-events ${active("events")}`}>
          <svg viewBox="0 0 24 24"><path d="M12 2.5l2.6 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7l-5.7 3.4 1.5-6.5-5-4.4 6.6-.6z" /></svg><span>Etkinlikler</span>{freshEvents ? <i className="nav-spark" title="Katılabileceğin etkinlik var" /> : null}
        </Link>
        {/* Kütüphane: sitedeki ve dışarıdaki her oyunu, filmi, diziyi, animeyi, albümü tek kutudan ara (telefonda üstteki büyüteç) */}
        <Link href="/search" className={`nav-lib ${active("search")}`}>
          <svg viewBox="0 0 24 24"><path d="M10.5 3a7.5 7.5 0 0 1 5.96 12.05l4.74 4.75-1.4 1.4-4.75-4.74A7.5 7.5 0 1 1 10.5 3zm0 2a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11z" /></svg><span>Kütüphane</span>
        </Link>
        {/* Telefonda alt menünün ortasında büyük ekle düğmesi (bilgisayarda gizli, orada üstte "+ Ekle" var) */}
        {me && (
          <button className="nav-add" aria-label="Yeni kayıt ekle" onClick={() => openForm(null)}>
            <svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6z" /></svg>
          </button>
        )}
        <Link href="/chat" className={active("chat")}>
          <svg viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6v2h2V9zm4 0v2h2V9zm4 0v2h2V9z" /></svg>
          <span>Sosyal</span>{ready && unread > 0 && <b className="nav-badge">{unread > 9 ? "9+" : unread}</b>}
        </Link>
        <Link href={mine} className={active("me")}>
          <svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5z" /></svg><span>Profilim</span>
        </Link>
      </nav>
      <span className="top-gap" />
      <div className="top-actions">
        {/* Telefonda alt menü dolu: Etkinlikler üstte, yıldız simgesiyle */}
        <Link className={`icon-link mobile-events ${active("events")}`} href="/events" aria-label="Etkinlikler" title="Etkinlikler">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2.5l2.6 6.1 6.6.6-5 4.4 1.5 6.5L12 16.7l-5.7 3.4 1.5-6.5-5-4.4 6.6-.6z" /></svg>
          {freshEvents ? <span className="dot spark" /> : null}
        </Link>
        <Link className="icon-link mobile-search" href="/search" aria-label="Kütüphane: ara" title="Kütüphane">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
        </Link>
        {me ? (
          <>
            {isAdmin && <Link className="top-link admin-link" href="/admin" title="Yönetim paneli">Yönetim</Link>}
            <Link className="icon-link" href="/notifications" title="Bildirimler">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {notifAt && notifAt > seen && <span className="dot" />}
            </Link>
            <Link className="btn import-top" href="/import" title="Steam, PlayStation, Backloggd, Letterboxd, MyAnimeList... bütün kütüphaneni getir">İçe aktar</Link>
            <button className="btn primary top-add" onClick={() => openForm(null)}>+ Ekle</button>
            <UserMenu mine={mine} isAdmin={isAdmin} />
          </>
        ) : (
          <>
            <Link className="btn import-top" href="/signup" title="Steam, PlayStation, Backloggd, Letterboxd, MyAnimeList... bütün kütüphaneni getir">Kütüphaneni getir</Link>
            <Link className="top-link" href="/login">Giriş yap</Link>
            <Link className="btn primary" href="/signup">Katıl</Link>
          </>
        )}
      </div>
    </header>
  );
}

// Sağ üstteki profil fotoğrafı: tıklayınca profil, ayarlar ve çıkış menüsü açılır
function UserMenu({ mine, isAdmin }: { mine: string; isAdmin: boolean }) {
  const { me } = useApp();
  const path = usePathname();
  const [openAt, setOpenAt] = useState<string | null>(null);
  const open = openAt === path; // başka sayfaya geçince kendiliğinden kapanır
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpenAt(null);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  if (!me) return null;
  return (
    <div className="user-menu" ref={box}>
      <button className="avatar-btn" aria-haspopup="menu" aria-expanded={open} title="Hesabım" onClick={() => setOpenAt(open ? null : path)}>
        <Avatar p={me} />
      </button>
      {open && (
        <div className="menu" role="menu">
          <div className="menu-head"><b>{me.display_name || me.username}</b><span>@{me.username}</span></div>
          <Link role="menuitem" href={mine}>Profilim</Link>
          <Link role="menuitem" href="/settings">Ayarlar</Link>
          <Link role="menuitem" href={`${mine}/badges`}>Rozetlerim</Link>
          <Link role="menuitem" href="/import">İçe aktar</Link>
          <Link role="menuitem" href="/events">Etkinlikler</Link>
          <Link role="menuitem" href="/calendar">Çıkış takvimi</Link>
          {isAdmin && <Link role="menuitem" href="/admin">Yönetim paneli</Link>}
          <Link role="menuitem" href="/help">Nasıl kullanılır?</Link>
          <hr />
          <button role="menuitem" className="danger" onClick={() => { setOpenAt(null); sb().auth.signOut(); }}>Çıkış yap</button>
        </div>
      )}
    </div>
  );
}
