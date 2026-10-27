"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Avatar } from "./ui";
import { useApp } from "./AppProvider";

export function Topbar() {
  const { me, openForm } = useApp();
  const path = usePathname();
  const mine = me ? `/u/${me.username}` : "/login";
  const active = (key: string) =>
    (key === "home" ? path === "/" : key === "community" ? path.startsWith("/community") : path === mine || path === "/settings") ? "active" : "";

  return (
    <header className="topbar">
      <Link href="/" className="brand">📒 <span>Ancalog</span></Link>
      <nav className="nav">
        <Link href="/" className={active("home")}>
          <svg viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" /></svg><span>Ana Sayfa</span>
        </Link>
        <Link href="/community" className={active("community")}>
          <svg viewBox="0 0 24 24"><path d="M16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm0 2c-2.7 0-8 1.3-8 4v2h16v-2c0-2.7-5.3-4-8-4zm8 0c-.3 0-.7 0-1.1.1 1.3.9 2.1 2.2 2.1 3.9v2h7v-2c0-2.7-5.3-4-8-4z" /></svg><span>Topluluk</span>
        </Link>
        <Link href={mine} className={active("me")}>
          <svg viewBox="0 0 24 24"><path d="M12 12a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zm0 2c-3 0-9 1.5-9 4.5V21h18v-2.5c0-3-6-4.5-9-4.5z" /></svg><span>Profilim</span>
        </Link>
      </nav>
      <div className="top-actions">
        {me ? (
          <>
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
