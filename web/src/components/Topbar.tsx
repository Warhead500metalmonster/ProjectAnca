"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Avatar } from "./ui";
import { useApp } from "./AppProvider";

export const NOTIF_SEEN = "ancalog.notifSeen";

export function Topbar() {
  const { me, openForm, unread, notifAt } = useApp();
  const path = usePathname();
  const router = useRouter();
  const [seen, setSeen] = useState("");
  const [text, setText] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { try { setSeen(localStorage.getItem(NOTIF_SEEN) || ""); } catch { /* yok say */ } }, [path, notifAt]);

  const mine = me ? `/u/${me.username}` : "/login";
  const active = (key: string) => ({
    home: path === "/",
    search: path.startsWith("/search"),
    community: path.startsWith("/community"),
    chat: path.startsWith("/chat"),
    me: path === mine || path.startsWith(mine + "/") || path === "/settings",
  })[key] ? "active" : "";

  function search(e: React.FormEvent) {
    e.preventDefault();
    router.push(`/search?q=${encodeURIComponent(text.trim())}`);
    setText("");
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand"><span>Ancalog</span></Link>
      <nav className="nav">
        <Link href="/" className={active("home")}>
          <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg><span>Ana Sayfa</span>
        </Link>
        <Link href="/search" className={active("search")}>
          <svg viewBox="0 0 24 24"><path d="M10 2a8 8 0 0 1 6.32 12.9l5.39 5.4-1.41 1.41-5.4-5.39A8 8 0 1 1 10 2zm0 2a6 6 0 1 0 0 12 6 6 0 0 0 0-12z" /></svg><span>Keşfet</span>
        </Link>
        <Link href="/community" className={active("community")}>
          <svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.3.9 2.1 2.2 2.1 3.9v2h7v-2c0-2.7-5.3-4-8-4z" /></svg><span>Topluluk</span>
        </Link>
        <Link href="/chat" className={active("chat")}>
          <svg viewBox="0 0 24 24"><path d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm3 6v2h2V9zm4 0v2h2V9zm4 0v2h2V9z" /></svg>
          <span>Mesajlar</span>{unread > 0 && <b className="nav-badge">{unread > 9 ? "9+" : unread}</b>}
        </Link>
        <Link href={mine} className={active("me")}>
          <svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5z" /></svg><span>Profilim</span>
        </Link>
      </nav>
      <form className="top-search" onSubmit={search} role="search">
        <input type="search" value={text} placeholder="Oyun, film, kişi ara…" aria-label="Ara" onChange={(e) => setText(e.target.value)} />
      </form>
      <div className="top-actions">
        {me ? (
          <>
            <Link className="icon-link" href="/notifications" title="Bildirimler">
              <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
              {notifAt && notifAt > seen && <span className="dot" />}
            </Link>
            <button className="btn primary" onClick={() => openForm(null)}>+ Ekle</button>
            <Link href={mine} title="Profilim"><Avatar p={me} /></Link>
          </>
        ) : (
          <>
            <Link className="btn ghost" href="/login">Giriş yap</Link>
            <Link className="btn primary" href="/signup">Kayıt ol</Link>
          </>
        )}
      </div>
    </header>
  );
}
