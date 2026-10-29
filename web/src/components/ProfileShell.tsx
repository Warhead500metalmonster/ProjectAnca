"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { Entry, Profile } from "@/lib/types";
import { fmtDate, cssUrl, num, safeUrl } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { PROFILE_THEMES, TYPES } from "@/lib/constants";
import { compat } from "@/lib/compat";
import { bannerOn, countedEntries, countsOf } from "@/lib/profileLayout";
import { countOf, q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, BadgeChips, FollowButton, Name, Socials, UserRow } from "@/components/ui";
import { ProfileSong } from "@/components/ProfileSong";
import { CoverMarquee } from "@/components/CoverMarquee";

interface ProfileData { profile: Profile; entries: Entry[]; followers: number; following: number; memberNo?: number }
const ProfileCtx = createContext<(ProfileData & { isMe: boolean }) | null>(null);
export const useProfile = () => useContext(ProfileCtx)!;

// Profilin üst kısmı (kapak, isim, rozetler, bağlantılar, sekmeler) bütün profil sekmelerinde ortak
// Kapak / arka plan kadrajı: odak noktası ve yakınlık (sahibi Ayarlar'da seçer)
const cropStyle = (c?: { x: number; y: number; z: number } | null): React.CSSProperties =>
  c ? { backgroundPosition: `${c.x}% ${c.y}%`, ...(c.z > 1 && { transform: `scale(${c.z})`, transformOrigin: `${c.x}% ${c.y}%` }) } : {};

export function ProfileShell({ children }: { children: React.ReactNode }) {
  const { username } = useParams<{ username: string }>();
  const { version } = useApp();
  const name = decodeURIComponent(username).toLowerCase();

  const { data, error } = useLoad(async () => {
    const db = sb();
    const profile = await q<Profile | null>(db.from("profiles").select("*").eq("username", name).maybeSingle());
    if (!profile) return null;
    const [entries, followers, following, memberNo] = await Promise.all([
      fetchEntries(profile.id),
      countOf(db.from("follows").select("*", { count: "exact", head: true }).eq("following_id", profile.id)),
      countOf(db.from("follows").select("*", { count: "exact", head: true }).eq("follower_id", profile.id)),
      // Kaçıncı üye: kendisinden önce (ve aynı anda) katılanların sayısı
      countOf(db.from("profiles").select("id", { count: "exact", head: true }).lte("created_at", profile.created_at)).catch(() => 0),
    ]);
    return { profile, entries: entries.map((e) => ({ ...e, profiles: profile })), followers, following, memberNo };
  }, [name, version], supabaseConfigured());

  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (data === undefined) return <div className="loading">Yükleniyor…</div>;
  if (data === null) return <div className="empty">@{name} diye bir kullanıcı yok.</div>;
  return <Shell key={data.profile.id} data={data}>{children}</Shell>;
}

function Shell({ data: raw, children }: { data: ProfileData; children: React.ReactNode }) {
  const { me, openForm, openView, isFriend, mine, isOwner, badges, blocked, toggleBlock, report } = useApp();
  const path = usePathname();
  const isMe = me?.id === raw.profile.id;
  // Sahibinin gizlediği türler (ör. oyunlar) başkalarına profilin hiçbir yerinde görünmez; sahibi hepsini görür
  const hidden = raw.profile.hidden_types || [];
  const data = isMe || !hidden.length ? raw : { ...raw, entries: raw.entries.filter((e) => !hidden.includes(e.type)) };
  const { profile, entries, followers, following } = data;
  const base = `/u/${profile.username}`;
  const [userList, setUserList] = useState<{ kind: "followers" | "following"; users: Profile[] | null } | null>(null);
  const listDialog = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (userList) listDialog.current?.showModal(); }, [userList]);

  // Akıştan gelen /u/ali?entry=ID bağlantısı kaydı açar, sonra adresten silinir
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("entry");
    const e = id && entries.find((x) => x.id === id);
    if (e) { openView(e); history.replaceState(null, "", location.pathname); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  async function openUserList(kind: "followers" | "following") {
    setUserList({ kind, users: null });
    const [col, other] = kind === "followers" ? ["follower_id", "following_id"] : ["following_id", "follower_id"];
    const ids = (await q<Record<string, string>[]>(sb().from("follows").select(col).eq(other, profile.id))).map((r) => r[col]);
    const users = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids)) : [];
    setUserList({ kind, users });
  }

  // Steam'deki gibi: hazır tema ya da özel renk, profil kutusunun zemini ve sayfanın arkasındaki resim
  const theme = PROFILE_THEMES[profile.profile_theme || ""];
  const accent = theme?.accent || (/^#[0-9a-f]{6}$/i.test(profile.accent || "") ? profile.accent! : null);
  const bg = profile.bg_url?.startsWith("https://") ? profile.bg_url : null;
  // Şeffaf profil: düzen diğer temalarla aynı, sadece arka plan resmi renkle örtülmez, daha açık görünür
  const glass = profile.profile_theme === "glass" && !!bg;
  const tint = glass ? null : theme?.tint || (accent ? `color-mix(in srgb, ${accent} 14%, rgba(10, 12, 14, .86))` : bg ? "rgba(10, 12, 14, .84)" : null);
  const vars = { ...(accent && { "--pa": accent }), ...(tint && { "--ptint": tint }) } as React.CSSProperties;
  const showBanner = bannerOn(profile); // sahibi kapak görselini kapatabilir
  const banner = showBanner && profile.banner_url ? safeUrl(profile.banner_url) : "";
  const cnt = countsOf(profile);
  const counted = countedEntries(entries, cnt.types);
  const tab = path.split("/")[3] || "home"; // /u/ali/library → library
  const song = profile.song_url || null; // profilde arkada çalan şarkı
  const match = me && !isMe ? compat(mine, entries).score : null;
  const year = String(new Date().getFullYear());
  // Steam gibi gizli profil: fotoğraf, ad, kapak ve arka plan görünür; kütüphane ve sayılar görünmez (veritabanı da vermez)
  const privacy = profile.privacy || "public";
  const founder = (badges.get(raw.profile.id) || []).includes("owner");
  const memberLine = raw.memberNo ? <b className="member-no">Ancalog&apos;un {num(raw.memberNo)}. üyesi</b> : null; // gizli profilde de görünür
  const iBlocked = blocked.has(raw.profile.id); // engellediğim kişinin profilinde içerik gösterilmez
  const locked = !isMe && (iBlocked || privacy === "private" || (privacy === "friends" && !isFriend(profile.id)));

  return (
    <ProfileCtx.Provider value={{ ...data, isMe }}>
      {bg && (/\.(mp4|webm)(\?|$)/i.test(bg)
        ? <video className="profile-bg" src={bg} autoPlay muted loop playsInline aria-hidden="true" />
        : <div className="profile-bg" style={{ backgroundImage: cssUrl(bg), ...cropStyle(profile.home_layout?.bgCrop) }} aria-hidden="true" />)}
      {/* Tema rengi eskiden profili bir kutuya alıyordu; artık sayfanın arka planını boyar, düzen herkeste aynı (yeni tasarım) */}
      {(bg || tint) && <div className={`profile-bg-shade ${glass ? "light" : ""}`} aria-hidden="true"
        style={tint ? { background: `linear-gradient(to bottom, rgba(8, 12, 13, ${bg ? ".2" : "0"}), ${tint} ${bg ? "45%" : "35%"})` } : undefined} />}
      <div className={`profile ${accent ? "has-pa" : ""} ${tint ? "themed" : ""} ${glass ? "glass" : ""}`} style={vars}>
        {/* Kapak görseli kapalıysa (ya da şeffaf temada kapak yoksa) kapak alanı boş kalır, arkadaki resim görünür;
            arkada resim yoksa boş alan daralır, ad ve fotoğraf yukarı çıkar */}
        <div className={`profile-banner ${banner ? "img" : ""} ${!banner && (glass || !showBanner) ? `clear ${bg ? "" : "short"}` : ""}`} >
          {banner && <div className="pb-img" style={{ backgroundImage: cssUrl(banner), ...cropStyle(profile.home_layout?.bannerCrop) }} aria-hidden="true" />}
          {!banner && !glass && showBanner && <CoverMarquee covers={[...new Set(entries.map((e) => safeUrl(e.cover)).filter(Boolean))].slice(0, 24)} />}
        </div>
        <div className="profile-head">
          <Avatar p={profile} cls="lg" />
          <div className="profile-info">
            <h1><Name p={profile} /></h1>
            <div className="handle">@{profile.username}{profile.pronouns ? ` · ${profile.pronouns}` : ""}</div>
          </div>
          {/* Büyük sayaçlar: kaç şey loglamış, bu yıl kaç tane bitirmiş, sırada ne kadar var, takipçi */}
          {/* Sahibi Ana sayfayı düzenle'den hangilerinin görüneceğini ve hangi türlerin sayılacağını seçer; yeni profillerde kapalı başlar */}
          {!locked && cnt.show && <div className="profile-counts">
            {cnt.items.includes("entries") && <span><b>{num(counted.filter((e) => e.status !== "planned").length)}</b>Kayıt</span>}
            {cnt.items.includes("year") && <span><b>{num(counted.filter((e) => e.status === "completed" && (e.date || "").startsWith(year)).length)}</b>Bu yıl bitti</span>}
            {cnt.items.includes("planned") && <span><b>{num(counted.filter((e) => e.status === "planned").length)}</b>Planlanan</span>}
            {cnt.items.includes("followers") && <button onClick={() => openUserList("followers")}><b>{num(followers)}</b>Takipçi</button>}
            {cnt.items.includes("following") && <button onClick={() => openUserList("following")}><b>{num(following)}</b>Takip</button>}
            {isMe && <Link className="counts-edit" href="/settings#sayilar" title="Hangi sayıların görüneceğini ve neyin sayılacağını seç" aria-label="Sayıları düzenle">⚙</Link>}
          </div>}
          <div className="profile-actions">
            {isMe
              ? <><Link className="btn" href="/settings">Profili düzenle</Link><button className="btn primary" onClick={() => openForm(null)}>+ Ekle</button></>
              : <>
                {match !== null && !locked && <Link className="match-pill" href={`/u/${profile.username}/compare`} title="Zevkleriniz ne kadar uyuşuyor">Uyum %{match}</Link>}
                {/* Arkadaşlar birbirine; site sahibi herkese, herkes de site sahibine yazabilir */}
                {(isFriend(profile.id) || isOwner || badges.get(profile.id)?.includes("owner")) && <Link className="btn" href={`/chat/${profile.username}`}>Mesaj</Link>}{!iBlocked && <FollowButton id={profile.id} />}
                {me && (
                  <details className="more-menu">
                    <summary className="btn" aria-label="Diğer seçenekler" title="Diğer seçenekler">⋯</summary>
                    <div className="menu" role="menu">
                      <button role="menuitem" onClick={(ev) => { ev.currentTarget.closest("details")?.removeAttribute("open");
                        report({ kind: "profile", id: profile.id, user: profile.id, excerpt: [profile.display_name, profile.bio].filter(Boolean).join(" / ") || null, label: `@${profile.username} profili` }); }}>Raporla</button>
                      <button role="menuitem" className="danger" onClick={(ev) => { ev.currentTarget.closest("details")?.removeAttribute("open"); toggleBlock(profile); }}>
                        {iBlocked ? "Engeli kaldır" : "Engelle"}</button>
                    </div>
                  </details>
                )}
              </>}
          </div>
        </div>
        <BadgeChips id={profile.id} max={3} more={`/u/${profile.username}/badges`} />
        {profile.bio && !locked && <p className="profile-bio">{profile.bio}</p>}
        {isMe && privacy !== "public" && (
          <p className="muted small profile-note" style={{ margin: "6px 0 0" }}>
            Profilin {privacy === "private" ? "gizli: kütüphaneni sadece sen görüyorsun" : "sadece arkadaşlarına açık"}. <Link href="/settings">Değiştir</Link>
          </p>
        )}
        {isMe && hidden.length > 0 && (
          <p className="muted small profile-note" style={{ margin: "6px 0 0" }}>
            Başkaları profilinde {hidden.map((t) => TYPES[t].plural.toLocaleLowerCase("tr")).join(", ")} göremez. <Link href="/settings">Değiştir</Link>
          </p>
        )}
        {locked ? (
          <div className="profile-locked">
            {memberLine && <span className="profile-locked-no">{memberLine}</span>}
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a5 5 0 0 0-5 5v3H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2h-1V7a5 5 0 0 0-5-5zm-3 8V7a3 3 0 1 1 6 0v3z" /></svg>
            <b>{iBlocked ? "Bu kişiyi engelledin" : privacy === "private" ? "Bu profil gizli" : "Bu profili sadece arkadaşları görebilir"}</b>
            <span className="muted">{iBlocked
              ? <>Hareketlerini ve yorumlarını görmüyorsun. <button className="link" onClick={() => toggleBlock(profile)}>Engeli kaldır</button></>
              : privacy === "private"
              ? <>@{profile.username} kütüphanesini kendine saklamayı seçmiş.</>
              : <>Karşılıklı takipleşince kütüphanesini, listelerini ve istatistiklerini görebilirsin.</>}</span>
          </div>
        ) : (
          <>
          <div className="profile-meta">
            {profile.location && <span>{profile.location}</span>}
            {/* Kurucunun profilinde katılma tarihi yerine sadece kaçıncı üye olduğu yazar */}
            {founder ? memberLine
              : <span>{fmtDate(profile.created_at.slice(0, 10))} tarihinde katıldı{memberLine && <> · {memberLine}</>}</span>}
          </div>
          <Socials socials={profile.socials} />
          <nav className="subnav">
            <Link href={base} className={tab === "home" ? "active" : ""}>Ana sayfa</Link>
            <Link href={`${base}/library`} className={tab === "library" ? "active" : ""}>Kütüphane</Link>
            <Link href={`${base}/reviews`} className={tab === "reviews" ? "active" : ""}>İncelemeler</Link>
            <Link href={`${base}/likes`} className={tab === "likes" ? "active" : ""}>Beğendikleri</Link>
            <Link href={`${base}/lists`} className={tab === "lists" ? "active" : ""}>Listeler</Link>
            <Link href={`${base}/stats`} className={tab === "stats" ? "active" : ""}>İstatistikler</Link>
            <Link href={`${base}/badges`} className={tab === "badges" ? "active" : ""}>Rozetler</Link>
            {me && !isMe && <Link href={`${base}/compare`} className={tab === "compare" ? "active" : ""}>Uyum</Link>}
          </nav>
          {children}
          </>
        )}
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
