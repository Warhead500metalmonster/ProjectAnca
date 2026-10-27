"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Entry, EntryType, Profile } from "@/lib/types";
import { STATUSES, TYPES, statusLabel } from "@/lib/constants";
import { fmtDate, fmtHours } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { countOf, q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, Cover, EntryCard, FollowButton, Stars, Stats, UserRow, displayName } from "@/components/ui";

type Sort = "updated" | "rating" | "title" | "year" | "hours";
type View = "grid" | "list";

const SORTERS: Record<Sort, (a: Entry, b: Entry) => number> = {
  updated: (a, b) => b.updated_at.localeCompare(a.updated_at),
  rating: (a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at),
  title: (a, b) => a.title.localeCompare(b.title, "tr"),
  year: (a, b) => (b.year || 0) - (a.year || 0),
  hours: (a, b) => (Number(b.hours) || 0) - (Number(a.hours) || 0),
};

export default function ProfilePage() {
  const { username } = useParams<{ username: string }>();
  const { version } = useApp();
  const name = decodeURIComponent(username).toLowerCase();

  const { data, error } = useLoad(async () => {
    const db = sb();
    const profile = await q<Profile | null>(db.from("profiles").select("*").eq("username", name).maybeSingle());
    if (!profile) return null;
    const [entries, followers, following] = await Promise.all([
      fetchEntries(profile.id),
      countOf(db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id)),
      countOf(db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id)),
    ]);
    return { profile, entries: entries.map((e) => ({ ...e, profiles: profile })), followers, following };
  }, [name, version], supabaseConfigured());

  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik.</div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  if (data === null || !data.profile) return <div className="empty">@{name} diye bir kullanıcı yok.</div>;
  return <ProfileView key={data.profile.id} {...data} />;
}

function ProfileView({ profile, entries, followers, following }: { profile: Profile; entries: Entry[]; followers: number; following: number }) {
  const { me, openForm, openView } = useApp();
  const isMe = me?.id === profile.id;

  const [type, setType] = useState<EntryType | "all">("all");
  const [status, setStatus] = useState<Entry["status"] | "all">("all");
  const [sort, setSort] = useState<Sort>("updated");
  const [text, setText] = useState("");
  const [view, setView] = useState<View>(() => {
    try { return localStorage.getItem("ancalog.view") === "list" ? "list" : "grid"; } catch { return "grid"; }
  });
  const [userList, setUserList] = useState<{ kind: "followers" | "following"; users: Profile[] | null } | null>(null);
  const listDialog = useRef<HTMLDialogElement>(null);

  // Akıştan gelen /u/ali?entry=ID bağlantısı kaydı açar, sonra adresten silinir
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("entry");
    const e = id && entries.find((x) => x.id === id);
    if (e) { openView(e); history.replaceState(null, "", location.pathname); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);
  useEffect(() => { if (userList) listDialog.current?.showModal(); }, [userList]);

  function pickView(v: View) {
    setView(v);
    try { localStorage.setItem("ancalog.view", v); } catch { /* sadece tercih */ }
  }

  async function openUserList(kind: "followers" | "following") {
    setUserList({ kind, users: null });
    const [col, other] = kind === "followers" ? ["follower_id", "following_id"] : ["following_id", "follower_id"];
    const ids = (await q<Record<string, string>[]>(sb().from("follows").select(col).eq(other, profile.id))).map((r) => r[col]);
    const users = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids)) : [];
    setUserList({ kind, users });
  }

  const scoped = type === "all" ? entries : entries.filter((e) => e.type === type);
  const needle = text.trim().toLocaleLowerCase("tr");
  const list = scoped
    .filter((e) => (status === "all" || e.status === status) &&
      (!needle || `${e.title} ${e.creator || ""} ${e.notes || ""}`.toLocaleLowerCase("tr").includes(needle)))
    .sort(SORTERS[sort]);
  const statusType = type === "all" ? null : type;

  return (
    <>
      <div className="profile-banner" />
      <div className="profile-head">
        <Avatar p={profile} cls="lg" />
        <div className="profile-info"><h1>{displayName(profile)}</h1><div className="handle">@{profile.username}</div></div>
        <div className="profile-actions">
          {isMe
            ? <><Link className="btn" href="/settings">Profili düzenle</Link><button className="btn primary" onClick={() => openForm(null)}>+ Ekle</button></>
            : <FollowButton id={profile.id} />}
        </div>
      </div>
      {profile.bio && <p className="profile-bio">{profile.bio}</p>}
      <div className="profile-meta">
        <span><b>{entries.length}</b> kayıt</span>
        <button onClick={() => openUserList("followers")}><b>{followers}</b> takipçi</button>
        <button onClick={() => openUserList("following")}><b>{following}</b> takip</button>
        <span>📅 {fmtDate(profile.created_at.slice(0, 10))} tarihinde katıldı</span>
      </div>
      <section className="section">
        <div className="tabs">
          {([["all", "✨", "Tümü"], ...Object.entries(TYPES).map(([k, t]) => [k, t.icon, t.label])] as [EntryType | "all", string, string][]).map(([k, icon, label]) => (
            <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setStatus("all"); }}>
              {icon} {label}<span className="count">{k === "all" ? entries.length : entries.filter((e) => e.type === k).length}</span>
            </button>
          ))}
        </div>
        <div className="stats"><Stats list={scoped} /></div>
        <div className="toolbar" style={{ marginTop: 18 }}>
          <div className="chips">
            {([["all", "Hepsi"], ...STATUSES.map((s) => [s, statusLabel(s, statusType)])] as [Entry["status"] | "all", string][]).map(([k, label]) => (
              <button key={k} className={`chip ${status === k ? "active" : ""}`} onClick={() => setStatus(k)}>{label}</button>
            ))}
          </div>
          <div className="right">
            <input className="input" type="search" placeholder="Kütüphanede ara…" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
            <select aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              <option value="updated">Son eklenen</option>
              <option value="rating">Puan (yüksek)</option>
              <option value="title">İsim (A-Z)</option>
              <option value="year">Yıl (yeni)</option>
              <option value="hours">Süre (uzun)</option>
            </select>
            <div className="seg">
              <button type="button" className={view === "grid" ? "active" : ""} title="Izgara" onClick={() => pickView("grid")}>▦</button>
              <button type="button" className={view === "list" ? "active" : ""} title="Liste" onClick={() => pickView("list")}>☰</button>
            </div>
          </div>
        </div>
        {list.length ? (
          view === "list"
            ? <div className="rows">{list.map((e) => <Row key={e.id} e={e} isMe={isMe} />)}</div>
            : <div className="grid">{list.map((e) => <EntryCard key={e.id} e={e} kind={type === "all"} />)}</div>
        ) : (
          <div className="empty">
            {entries.length ? "Bu filtreye uyan kayıt yok." : isMe
              ? <>Henüz hiçbir şey loglamadın.<br /><button className="btn primary" onClick={() => openForm(null, { type: statusType ?? undefined })}>+ İlk kaydını ekle</button></>
              : "Burada henüz kayıt yok."}
          </div>
        )}
      </section>
      {userList && (
        <dialog ref={listDialog} onClose={() => setUserList(null)} onClick={(e) => e.target === listDialog.current && listDialog.current?.close()}>
          <div className="dialog-head pad">
            <h2>{userList.kind === "followers" ? "Takipçiler" : "Takip edilenler"}</h2>
            <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => listDialog.current?.close()}>✕</button>
          </div>
          <div className="user-list" style={{ padding: "0 8px 12px", maxHeight: "60vh", overflowY: "auto" }}>
            {userList.users === null ? <div className="loading">Yükleniyor…</div>
              : userList.users.length ? userList.users.map((p) => <UserRow key={p.id} p={p} />)
              : <div className="muted" style={{ padding: "12px 14px" }}>Henüz kimse yok.</div>}
          </div>
        </dialog>
      )}
    </>
  );
}

// Liste görünümünde bir satır: kapak, başlık, platform/durum/mağaza, ilerleme, süre, puan
function Row({ e, isMe }: { e: Entry; isMe: boolean }) {
  const { openForm, openView } = useApp();
  const t = TYPES[e.type];
  const dates = [e.started_on && fmtDate(e.started_on), e.date && fmtDate(e.date)].filter(Boolean).join(" → ");
  return (
    <div className="lrow">
      <button className={`lrow-cover poster ${t.square ? "square" : ""}`} onClick={() => openView(e)}>
        <div className="ph">{t.icon}</div><Cover src={e.cover} />
      </button>
      <div className="lrow-main">
        <div className="lrow-head">
          <button className="lrow-title" onClick={() => openView(e)}>{e.title}{e.year ? <> <span className="muted">({e.year})</span></> : null}</button>
          <div className="lrow-tags">
            {e.platform && <span className="tag">{e.platform}</span>}
            <span className={`pill ${e.status}`}>{statusLabel(e.status, e.type)}</span>
            {e.store && <span className="tag">{e.store}</span>}
          </div>
        </div>
        {e.progress && <div className="lrow-progress">{e.progress}</div>}
        <div className="lrow-foot">
          {e.rating ? <Stars r={e.rating} /> : <span className="muted">Puan yok</span>}
          {e.hours ? <span>⏱ {fmtHours(e.hours)}</span> : null}
          {dates && <span>📅 {dates}</span>}
          {e.notes && <span>📝 Not</span>}
        </div>
      </div>
      {isMe && <button className="icon-btn lrow-edit" title="Düzenle" onClick={() => openForm(e)}>✎</button>}
    </div>
  );
}
