/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { Entry, Profile } from "@/lib/types";
import { TYPES, activityVerb, statusLabel } from "@/lib/constants";
import { fmtHours, safeUrl, timeAgo } from "@/lib/format";
import { useApp } from "./AppProvider";

type Who = Partial<Pick<Profile, "username" | "display_name" | "avatar_url">> | null | undefined;
export const displayName = (p: Who) => p?.display_name || p?.username || "?";

export function Avatar({ p, cls = "" }: { p: Who; cls?: string }) {
  const url = safeUrl(p?.avatar_url);
  if (url) return <img className={`avatar ${cls}`} src={url} alt="" />;
  let h = 0;
  for (const c of p?.username || "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`avatar ${cls}`} style={{ background: `linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 50) % 360} 70% 40%))` }}>
      {[...displayName(p)][0].toLocaleUpperCase("tr")}
    </span>
  );
}

export function Stars({ r, style }: { r: number; style?: React.CSSProperties }) {
  return (
    <span className="stars" style={style}>
      {[1, 2, 3, 4, 5].map((i) => {
        const v = r - (i - 1) * 2;
        return <span key={i} className={`star ${v >= 2 ? "full" : v === 1 ? "half" : ""}`}>★</span>;
      })}
    </span>
  );
}

export function Cover({ src }: { src?: string | null }) {
  const url = safeUrl(src);
  // Yüklenemeyen görsel kaldırılır, altındaki ikon görünür
  return url ? <img src={url} alt="" loading="lazy" onError={(e) => e.currentTarget.remove()} /> : null;
}

export function Stats({ list }: { list: Entry[] }) {
  const rated = list.filter((i) => i.rating > 0);
  const avg = rated.length ? (rated.reduce((s, i) => s + i.rating, 0) / rated.length / 2).toLocaleString("tr", { maximumFractionDigits: 1 }) : "–";
  const year = new Date().getFullYear().toString();
  const hours = list.reduce((s, i) => s + (Number(i.hours) || 0), 0);
  const items: [string | number, string][] = [
    [list.length, "Toplam kayıt"],
    [list.filter((i) => i.status === "completed").length, "Bitirilen"],
    [list.filter((i) => i.status === "active").length, "Devam eden"],
    [list.filter((i) => i.status === "completed" && (i.date || "").startsWith(year)).length, "Bu yıl bitirilen"],
    [avg === "–" ? avg : `${avg} ★`, "Ortalama puan"],
    ...(hours ? [[`⏱ ${Math.round(hours).toLocaleString("tr")}`, "Saat oynandı"] as [string, string]] : []),
  ];
  return <>{items.map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}</>;
}

export function EntryCard({ e, kind = false, edit = false, wall = false }: { e: Entry; kind?: boolean; edit?: boolean; wall?: boolean }) {
  const { openForm, openView } = useApp();
  const t = TYPES[e.type];
  const meta = [e.creator, e.year].filter(Boolean).join(" · ");
  return (
    <button className="card" onClick={() => (edit ? openForm(e) : openView(e))}>
      <div className={`poster ${t.square ? "square" : ""}`}>
        <div className="ph">{t.icon}</div>
        <Cover src={e.cover} />
        {kind && <span className="kind">{t.icon}</span>}
        <span className={`st badge ${e.status}`}>{statusLabel(e.status, e.type)}</span>
        {e.rating ? <span className="rating">★ {(e.rating / 2).toLocaleString("tr")}</span> : null}
        {wall && <div className="hover"><b>{e.title}</b>{meta && <span>{meta}</span>}</div>}
      </div>
      {!wall && <div className="card-title">{e.title}</div>}
      {!wall && meta && <div className="card-meta">{meta}</div>}
    </button>
  );
}

// Akışta notlar gösterilmez; kayda tıklayan, sahibinin profilinde kaydı açar.
export function FeedItem({ e }: { e: Entry }) {
  const p = e.profiles || {};
  const t = TYPES[e.type];
  const profile = `/u/${p.username}`;
  const link = `${profile}?entry=${e.id}`;
  const extra = [e.platform, e.status === "active" ? e.progress : "", e.hours ? fmtHours(e.hours) : ""].filter(Boolean) as string[];
  return (
    <div className="feed-item">
      <Link href={profile}><Avatar p={p} /></Link>
      <div className="text">
        <div className="line">
          <Link href={profile}><b>{displayName(p)}</b></Link> {activityVerb(e)}:{" "}
          <Link className="title-link" href={link}>{e.title}</Link>
        </div>
        <div className="sub">
          <span>{t.icon} {t.label}</span>
          {e.rating ? <Stars r={e.rating} /> : null}
          <span>{timeAgo(e.updated_at)}</span>
        </div>
        {(extra.length > 0 || e.notes) && (
          <div className="chips-row">
            {extra.map((x) => <span className="tag" key={x}>{x}</span>)}
            {e.notes && <span className="tag ghost">📝 not var</span>}
          </div>
        )}
      </div>
      <Link className="thumb" href={link}>{t.icon}<Cover src={e.cover} /></Link>
    </div>
  );
}

export function Feed({ list, empty }: { list: Entry[]; empty?: React.ReactNode }) {
  return list.length
    ? <div className="feed">{list.map((e) => <FeedItem key={e.id} e={e} />)}</div>
    : <>{empty ?? <div className="empty">Henüz hareket yok.</div>}</>;
}

export function FollowButton({ id }: { id: string }) {
  const { me, following, toggleFollow } = useApp();
  if (me?.id === id) return null;
  if (!me) return <Link className="btn primary" href="/login">+ Takip et</Link>;
  const on = following.has(id);
  return <button className={`btn ${on ? "following" : "primary"}`} onClick={() => toggleFollow(id)}>{on ? "✓ Takip ediliyor" : "+ Takip et"}</button>;
}

export function UserRow({ p }: { p: Profile }) {
  return (
    <div className="user-row">
      <Link href={`/u/${p.username}`}><Avatar p={p} /></Link>
      <Link className="who" href={`/u/${p.username}`}><b>{displayName(p)}</b><span>@{p.username}{p.bio ? " · " + p.bio : ""}</span></Link>
      <FollowButton id={p.id} />
    </div>
  );
}
