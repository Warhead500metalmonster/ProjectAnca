"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry, HomeLayout, List } from "@/lib/types";
import { PROFILE_COLS, TYPES } from "@/lib/constants";
import { fmtDate, playSec } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";
import { Cover, EntryCard, FeedItem, Rating, RatingBars, RichText, Stats } from "@/components/ui";
import { ListCard } from "@/components/ListCard";
import { FavoritesSection } from "./LibraryTab";

// Profil ana sayfasının bölümleri: sahibi hangilerinin hangi sırayla görüneceğini seçer
const SECTIONS: [string, string][] = [
  ["favs", "Favoriler"],
  ["played", "Son bitirdikleri"],
  ["playing", "Şu an devam ettikleri"],
  ["recent", "Son eklenenler"],
  ["top", "En yüksek puan verdikleri"],
  ["longest", "En çok oynadığı oyunlar"],
  ["reviews", "Son incelemeler"],
  ["liked", "Son beğendikleri"],
  ["lists", "Listeler"],
  ["stats", "Özet"],
];
const DEFAULT = ["favs", "played", "playing", "recent", "reviews", "stats"];
const label = (k: string) => SECTIONS.find(([x]) => x === k)?.[1] || k;

export function HomeTab() {
  const { profile, entries, isMe } = useProfile();
  const [editing, setEditing] = useState(false);
  const layout = profile.home_layout;
  const sections = (layout?.sections?.length ? layout.sections : DEFAULT).filter((k) => SECTIONS.some(([x]) => x === k));

  return (
    <>
      {isMe && !editing && (
        <div className="home-edit-bar"><button className="btn" onClick={() => setEditing(true)}>Ana sayfayı düzenle</button></div>
      )}
      {editing && <HomeEditor layout={layout} sections={sections} onClose={() => setEditing(false)} />}
      {layout?.text?.trim() && <section className="section home-text"><RichText text={layout.text} /></section>}
      {!entries.length && !layout?.text?.trim() && (
        <div className="empty">{isMe ? <>Henüz kaydın yok. Steam, PlayStation, Backloggd, Letterboxd, MyAnimeList... başka yerdeki kütüphaneni birkaç dakikada getir.<br />
          <Link className="btn primary" href="/import">Kütüphanemi getir</Link></> : "Henüz kayıt yok."}</div>
      )}
      {sections.map((k) => <HomeSection key={k} k={k} />)}
    </>
  );
}

function HomeSection({ k }: { k: string }) {
  const { profile, entries } = useProfile();
  const base = `/u/${profile.username}`;
  const strip = (list: Entry[], more?: string) => list.length ? (
    <section className="section">
      <div className="section-head"><h2>{label(k)}</h2>{more && <Link className="link" href={more}>Tümü</Link>}</div>
      <div className="strip">{list.map((e) => <EntryCard key={e.id} e={e} />)}</div>
    </section>
  ) : null;
  const byUpdated = (a: Entry, b: Entry) => b.updated_at.localeCompare(a.updated_at);

  switch (k) {
    case "favs": return <FavoritesSection />;
    case "played": {
      // Ekleme tarihine göre değil, bitirme tarihine göre (en son bitirilen önce)
      const list = entries.filter((e) => e.status === "completed" && e.date).sort((a, b) => b.date!.localeCompare(a.date!) || byUpdated(a, b)).slice(0, 12);
      return list.length ? (
        <section className="section">
          <div className="section-head"><h2>{label(k)}</h2><Link className="link" href={`${base}/library`}>Tümü</Link></div>
          <div className="strip">{list.map((e) => <DatedCard key={e.id} e={e} />)}</div>
        </section>
      ) : null;
    }
    case "playing": return strip(entries.filter((e) => e.status === "active").sort(byUpdated).slice(0, 12));
    case "recent": return strip(entries.filter((e) => e.status !== "planned").sort(byUpdated).slice(0, 12), `${base}/library`); // planlananlar kalabalık etmesin
    case "top": return strip(entries.filter((e) => e.rating > 0).sort((a, b) => b.rating - a.rating || byUpdated(a, b)).slice(0, 12));
    case "longest": return strip(entries.filter((e) => e.type === "game" && playSec(e) > 0).sort((a, b) => playSec(b) - playSec(a)).slice(0, 12));
    case "reviews": {
      const list = reviewsOf(entries).slice(0, 3);
      return list.length ? (
        <section className="section">
          <div className="section-head"><h2>{label(k)}</h2><Link className="link" href={`${base}/reviews`}>Tümü</Link></div>
          <div className="feed">{list.map((e) => <FeedItem key={e.id} e={e} />)}</div>
        </section>
      ) : null;
    }
    case "liked": return <LikedSection limit={3} />;
    case "lists": return <ListsSection />;
    case "stats": return entries.length ? (
      <section className="section">
        <div className="section-head"><h2>{label(k)}</h2><Link className="link" href={`${base}/stats`}>Ayrıntılı istatistik</Link></div>
        <div className="stats"><Stats list={entries} /></div>
        <RatingBars wide ratings={entries.filter((e) => e.rating).map((e) => Number(e.rating))} />
      </section>
    ) : null;
  }
  return null;
}

// Kapak, altında bitirme tarihi ve puan (Backloggd'daki "Recently Played" gibi)
function DatedCard({ e }: { e: Entry }) {
  const { openView } = useApp();
  const t = TYPES[e.type];
  return (
    <button className="card dated" onClick={() => openView(e)} title={e.title}>
      <div className={`poster ${t.square ? "square" : ""}`}><div className="ph">{t.label}</div><Cover src={e.cover} /></div>
      <div className="dated-meta"><span>{fmtDate(e.date!).replace(/ \d{4}$/, (y) => (y.trim() === String(new Date().getFullYear()) ? "" : y))}</span>{e.rating ? <Rating r={e.rating} /> : null}</div>
    </button>
  );
}

// Sahibinin düzenleme kutusu: bölümleri aç / kapat, sırala, üste bir yazı ekle
function HomeEditor({ layout, sections, onClose }: { layout?: HomeLayout | null; sections: string[]; onClose: () => void }) {
  const { me, toast, refresh } = useApp();
  const [on, setOn] = useState(sections);
  const [text, setText] = useState(layout?.text || "");
  const [busy, setBusy] = useState(false);
  const off = SECTIONS.map(([k]) => k).filter((k) => !on.includes(k));

  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= on.length) return;
    const next = [...on];
    [next[i], next[j]] = [next[j], next[i]];
    setOn(next);
  }

  async function save() {
    if (!me) return;
    setBusy(true);
    try {
      await q(sb().from("profiles").update({ home_layout: { sections: on, text: text.trim() } }).eq("id", me.id));
      toast("Ana sayfan kaydedildi");
      onClose();
      refresh();
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="section home-editor">
      <h2>Ana sayfanı düzenle</h2>
      <p className="muted small">Profiline girenler önce bu sayfayı görür. Görünmesini istediğin bölümleri seç, oklarla sırala.</p>
      <div className="field">
        <label htmlFor="home-text">Üstte duracak yazı <span className="muted">· isteğe bağlı</span></label>
        <textarea id="home-text" rows={3} maxLength={2000} placeholder="ör. Soulslike ve eski JRPG'ler oynarım. En sevdiğim seri Persona." value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="home-rows">
        {on.map((k, i) => (
          <div className="home-row" key={k}>
            <label className="check"><input type="checkbox" checked onChange={() => setOn(on.filter((x) => x !== k))} /> {label(k)}</label>
            <span className="spacer" />
            <button className="icon-btn" aria-label="Yukarı taşı" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
            <button className="icon-btn" aria-label="Aşağı taşı" disabled={i === on.length - 1} onClick={() => move(i, 1)}>↓</button>
          </div>
        ))}
        {off.map((k) => (
          <div className="home-row off" key={k}>
            <label className="check"><input type="checkbox" checked={false} onChange={() => setOn([...on, k])} /> {label(k)}</label>
          </div>
        ))}
      </div>
      <div className="actions">
        <button className="link" onClick={() => { setOn(DEFAULT); setText(""); }}>Varsayılana dön</button>
        <span className="spacer" />
        <button className="btn" onClick={onClose}>Vazgeç</button>
        <button className="btn primary" disabled={busy} onClick={save}>Kaydet</button>
      </div>
    </section>
  );
}

const reviewsOf = (entries: Entry[]) => entries.filter((e) => e.notes?.trim()).sort((a, b) => b.updated_at.localeCompare(a.updated_at));

// İncelemeler sekmesi: kişinin yazdığı bütün incelemeler, en yenisi üstte
export function ReviewsTab() {
  const { entries, isMe } = useProfile();
  const [shown, setShown] = useState(10);
  const list = reviewsOf(entries);
  return (
    <section className="section">
      <div className="section-head"><h2>İncelemeler</h2><span className="muted">{list.length}</span></div>
      {list.length ? (
        <div className="feed">
          {list.slice(0, shown).map((e) => <FeedItem key={e.id} e={e} />)}
          {list.length > shown && <button className="feed-more" onClick={() => setShown(shown + 20)}>Daha fazla göster ({list.length - shown})</button>}
        </div>
      ) : <div className="empty">{isMe ? "Henüz inceleme yazmadın. Bir kaydı açıp düzenle, İnceleme kutusuna yaz." : "Henüz inceleme yazmamış."}</div>}
    </section>
  );
}

// Kişinin beğendiği kayıtlar (başkalarının incelemeleri, oyunları...)
function useLiked() {
  const { profile } = useProfile();
  const { version } = useApp();
  return useLoad(async () => {
    const rows = await q<{ created_at: string; entries: Entry | null }[]>(sb().from("likes")
      .select(`created_at, entries(*, profiles(${PROFILE_COLS}), likes(count), comments(count))`)
      .eq("user_id", profile.id).order("created_at", { ascending: false }).limit(200));
    return rows.map((r) => r.entries).filter(Boolean) as Entry[];
  }, [profile.id, version]);
}

function LikedSection({ limit }: { limit: number }) {
  const { profile } = useProfile();
  const { data } = useLiked();
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>{label("liked")}</h2><Link className="link" href={`/u/${profile.username}/likes`}>Tümü</Link></div>
      <div className="feed">{data.slice(0, limit).map((e) => <FeedItem key={e.id} e={e} />)}</div>
    </section>
  );
}

export function LikesTab() {
  const { isMe } = useProfile();
  const { data, error } = useLiked();
  const [shown, setShown] = useState(10);
  return (
    <section className="section">
      <div className="section-head"><h2>Beğendikleri</h2>{data && <span className="muted">{data.length}</span>}</div>
      {error ? <div className="empty">Bir şeyler ters gitti: {error}</div>
        : !data ? <div className="loading">Yükleniyor…</div>
        : data.length ? (
          <div className="feed">
            {data.slice(0, shown).map((e) => <FeedItem key={e.id} e={e} />)}
            {data.length > shown && <button className="feed-more" onClick={() => setShown(shown + 20)}>Daha fazla göster ({data.length - shown})</button>}
          </div>
        ) : <div className="empty">{isMe ? "Henüz bir şey beğenmedin. Bir kaydı açınca altındaki kalbe basarak beğenebilirsin." : "Henüz bir şey beğenmemiş."}</div>}
    </section>
  );
}

function ListsSection() {
  const { profile } = useProfile();
  const { version } = useApp();
  const { data } = useLoad(() => q<List[]>(sb().from("lists").select("*, list_items(id, type, title, cover, rawg_id, position)")
    .eq("user_id", profile.id).eq("is_public", true).order("updated_at", { ascending: false }).limit(4)), [profile.id, version]);
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>{label("lists")}</h2><Link className="link" href={`/u/${profile.username}/lists`}>Tümü</Link></div>
      <div className="list-grid">{data.map((l) => <ListCard key={l.id} l={l} />)}</div>
    </section>
  );
}
