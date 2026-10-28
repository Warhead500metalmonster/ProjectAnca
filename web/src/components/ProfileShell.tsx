"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { Entry, Profile } from "@/lib/types";
import { fmtDate, cssUrl, safeUrl } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { countOf, q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, BadgeChips, FollowButton, Name, Socials, UserRow } from "@/components/ui";
import { ProfileSong } from "@/components/ProfileSong";

interface ProfileData { profile: Profile; entries: Entry[]; followers: number; following: number }
const ProfileCtx = createContext<(ProfileData & { isMe: boolean }) | null>(null);
export const useProfile = () => useContext(ProfileCtx)!;

// Profilin üst kısmı (kapak, isim, rozetler, bağlantılar, sekmeler) bütün profil sekmelerinde ortak
export function ProfileShell({ children }: { children: React.ReactNode }) {
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

  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (data === undefined) return <div className="loading">Yükleniyor…</div>;
  if (data === null) return <div className="empty">@{name} diye bir kullanıcı yok.</div>;
  return <Shell key={data.profile.id} data={data}>{children}</Shell>;
}

function Shell({ data, children }: { data: ProfileData; children: React.ReactNode }) {
  const { me, openForm, isFriend, badges } = useApp();
  const path = usePathname();
  const { profile, entries, followers, following } = data;
  const isMe = me?.id === profile.id;
  const base = `/u/${profile.username}`;
  const [userList, setUserList] = useState<{ kind: "followers" | "following"; users: Profile[] | null } | null>(null);
  const listDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (userList) listDialog.current?.showModal(); }, [userList]);

  async function openUserList(kind: "followers" | "following") {
    setUserList({ kind, users: null });
    const [col, other] = kind === "followers" ? ["follower_id", "following_id"] : ["following_id", "follower_id"];
    const ids = (await q<Record<string, string>[]>(sb().from("follows").select(col).eq(other, profile.id))).map((r) => r[col]);
    const users = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids)) : [];
    setUserList({ kind, users });
  }

  const accent = /^#[0-9a-f]{6}$/i.test(profile.accent || "") ? profile.accent! : null;
  const banner = profile.banner_url && safeUrl(profile.banner_url);
  const tab = path.endsWith("/lists") ? "lists" : path.endsWith("/stats") ? "stats" : "library";
  // Profil şarkısı şimdilik sadece site sahibinde (veritabanı da başkasına izin vermiyor)
  const song = profile.song_url && badges.get(profile.id)?.includes("owner") ? profile.song_url : null;

  return (
    <ProfileCtx.Provider value={{ ...data, isMe }}>
      <div className="profile" style={accent ? ({ "--pa": accent } as React.CSSProperties) : undefined}>
        <div className={`profile-banner ${banner ? "img" : ""}`} style={banner ? { backgroundImage: cssUrl(banner) } : undefined} />
        <div className="profile-head">
          <Avatar p={profile} cls="lg" />
          <div className="profile-info">
            <h1><Name p={profile} /></h1>
            <div className="handle">@{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}</div>
          </div>
          <div className="profile-actions">
            {isMe
              ? <><Link className="btn" href="/settings">Profili düzenle</Link><button className="btn primary" onClick={() => openForm(null)}>+ Ekle</button></>
              : <>{isFriend(profile.id) && <Link className="btn" href={`/chat/${profile.username}`}>💬 Mesaj</Link>}<FollowButton id={profile.id} /></>}
          </div>
        </div>
        <BadgeChips id={profile.id} />
        {profile.bio && <p className="profile-bio">{profile.bio}</p>}
        <div className="profile-meta">
          <span><b>{entries.length}</b> kayıt</span>
          <button onClick={() => openUserList("followers")}><b>{followers}</b> takipçi</button>
          <button onClick={() => openUserList("following")}><b>{following}</b> takip</button>
          {profile.location && <span>📍 {profile.location}</span>}
          <span>📅 {fmtDate(profile.created_at.slice(0, 10))} tarihinde katıldı</span>
        </div>
        <Socials socials={profile.socials} />
        <nav className="subnav">
          <Link href={base} className={tab === "library" ? "active" : ""}>📚 Kütüphane</Link>
          <Link href={`${base}/lists`} className={tab === "lists" ? "active" : ""}>📝 Listeler</Link>
          <Link href={`${base}/stats`} className={tab === "stats" ? "active" : ""}>📊 İstatistikler</Link>
        </nav>
        {children}
      </div>
      {song && <ProfileSong url={song} title={profile.song_title} volume={profile.song_volume} />}
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
    </ProfileCtx.Provider>
  );
}
