"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry, EntryType, HomeBlock, HomeLayout, List } from "@/lib/types";
import { PROFILE_COLS, TYPES, TYPE_KEYS } from "@/lib/constants";
import { fmtDate, playSec } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";
import { Cover, EntryCard, FeedItem, Rating, RatingBars, RichText, Stats } from "@/components/ui";
import { ListCard } from "@/components/ListCard";
import { FavoritesSection } from "./LibraryTab";

// Profil ana sayfasının bölümleri: sahibi istediği bölümü istediği kadar ekler, her birinde türleri ve başlığı ayrı seçer
const SECTIONS: [string, string][] = [
  ["favs", "Favoriler"],
  ["played", "Son bitirdikleri"],
  ["playing", "Şu an devam ettikleri"],
  ["recent", "Son eklenenler"],
  ["top", "En yüksek puan verdikleri"],
  ["longest", "En çok vakit geçirdikleri"],
  ["reviews", "Son incelemeler"],
  ["liked", "Son beğendikleri"],
  ["lists", "Listeler"],
  ["stats", "Özet"],
];
const NO_TYPES = ["lists"]; // türe göre ayrılamayan bölümler
const DEFAULT = ["favs", "played", "playing", "recent", "reviews", "stats"];
const label = (k: string) => SECTIONS.find(([x]) => x === k)?.[1] || k;
const newId = () => Math.random().toString(36).slice(2, 9);

// Eski düzen sadece bölüm adlarıydı ("favs"); yenisinde her bölüm kendi türleri ve başlığıyla gelir
function toBlocks(sections?: HomeLayout["sections"] | null): HomeBlock[] {
  const raw = sections?.length ? sections : DEFAULT;
  return raw.map((x, i) => (typeof x === "string" ? { id: `${x}-${i}`, k: x } : x)).filter((b) => SECTIONS.some(([k]) => k === b.k));
}
// Seçili türler: hiçbiri ya da hepsi seçiliyse "hepsi" sayılır
const typesOf = (b: HomeBlock) => (b.types?.length && b.types.length < TYPE_KEYS.length ? b.types : null);
function titleOf(b: HomeBlock) {
  if (b.title?.trim()) return b.title.trim();
  const t = typesOf(b);
  // Bir iki tür seçildiyse başlığa eklenir (Favoriler · Animeler); birini çıkarmak başlığı uzatmasın
  return t && t.length <= 2 ? `${label(b.k)} · ${t.map((x) => TYPES[x].plural).join(", ")}` : label(b.k);
}

export function HomeTab() {
  const { profile, entries, isMe } = useProfile();
  const [editing, setEditing] = useState(false);
  const layout = profile.home_layout;
  const blocks = toBlocks(layout?.sections);

  return (
    <>
      {isMe && !editing && (
        <div className="home-edit-bar"><button className="btn" onClick={() => setEditing(true)}>Ana sayfayı düzenle</button></div>
      )}
      {editing && <HomeEditor layout={layout} blocks={blocks} onClose={() => setEditing(false)} />}
      {layout?.text?.trim() && <section className="section home-text"><RichText text={layout.text} /></section>}
      {!entries.length && !layout?.text?.trim() && (
        <div className="empty">{isMe ? <>Henüz kaydın yok. Steam, PlayStation, Backloggd, Letterboxd, MyAnimeList... başka yerdeki kütüphaneni birkaç dakikada getir.<br />
          <Link className="btn primary" href="/import">Kütüphanemi getir</Link></> : "Henüz kayıt yok."}</div>
      )}
      {blocks.map((b) => <HomeSection key={b.id} b={b} />)}
    </>
  );
}

function HomeSection({ b }: { b: HomeBlock }) {
  const { profile, entries: all } = useProfile();
  const base = `/u/${profile.username}`;
  const types = typesOf(b);
  const entries = types ? all.filter((e) => types.includes(e.type)) : all; // bu bölüm için seçilen türler
  const title = titleOf(b);
  const strip = (list: Entry[], more?: string) => list.length ? (
    <section className="section">
      <div className="section-head"><h2>{title}</h2>{more && <Link className="link" href={more}>Tümü</Link>}</div>
      <div className="strip">{list.map((e) => <EntryCard key={e.id} e={e} />)}</div>
    </section>
  ) : null;
  const byUpdated = (a: Entry, b: Entry) => b.updated_at.localeCompare(a.updated_at);

  switch (b.k) {
    case "favs": return <FavoritesSection types={types} title={b.title?.trim() || null} />;
    case "played": {
      // Ekleme tarihine göre değil, bitirme tarihine göre (en son bitirilen önce)
      const list = entries.filter((e) => e.status === "completed" && e.date).sort((a, b) => b.date!.localeCompare(a.date!) || byUpdated(a, b)).slice(0, 12);
      return list.length ? (
        <section className="section">
          <div className="section-head"><h2>{title}</h2><Link className="link" href={`${base}/library`}>Tümü</Link></div>
          <div className="strip">{list.map((e) => <DatedCard key={e.id} e={e} />)}</div>
        </section>
      ) : null;
    }
    case "playing": return strip(entries.filter((e) => e.status === "active").sort(byUpdated).slice(0, 12));
    case "recent": return strip(entries.filter((e) => e.status !== "planned").sort(byUpdated).slice(0, 12), `${base}/library`); // planlananlar kalabalık etmesin
    case "top": return strip(entries.filter((e) => e.rating > 0).sort((a, b) => b.rating - a.rating || byUpdated(a, b)).slice(0, 12));
    case "longest": return strip(entries.filter((e) => playSec(e) > 0).sort((a, b) => playSec(b) - playSec(a)).slice(0, 12));
    case "reviews": {
      const list = reviewsOf(entries).slice(0, 3);
      return list.length ? (
        <section className="section">
          <div className="section-head"><h2>{title}</h2><Link className="link" href={`${base}/reviews`}>Tümü</Link></div>
          <div className="feed">{list.map((e) => <FeedItem key={e.id} e={e} />)}</div>
        </section>
      ) : null;
    }
    case "liked": return <LikedSection limit={3} types={types} title={title} />;
    case "lists": return <ListsSection title={title} />;
    case "stats": return entries.length ? (
      <section className="section">
        <div className="section-head"><h2>{title}</h2><Link className="link" href={`${base}/stats`}>Ayrıntılı istatistik</Link></div>
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

// Sahibinin düzenleme kutusu: istediği bölümü istediği kadar ekler; her bölümde türleri, başlığı ve sırayı seçer
function HomeEditor({ layout, blocks, onClose }: { layout?: HomeLayout | null; blocks: HomeBlock[]; onClose: () => void }) {
  const { me, toast, refresh } = useApp();
  const [list, setList] = useState<HomeBlock[]>(blocks);
  const [text, setText] = useState(layout?.text || "");
  const [busy, setBusy] = useState(false);

  const patch = (id: string, p: Partial<HomeBlock>) => setList((l) => l.map((b) => (b.id === id ? { ...b, ...p } : b)));
  function move(i: number, d: -1 | 1) {
    const j = i + d;
    if (j < 0 || j >= list.length) return;
    const next = [...list];
    [next[i], next[j]] = [next[j], next[i]];
    setList(next);
  }
  // Tür düğmesi: "Hepsi" seçiliyken birine basmak onu çıkarır; son kalanı çıkarmak "Hepsi"ne döner
  function toggleType(b: HomeBlock, t: EntryType) {
    const cur = typesOf(b) || TYPE_KEYS;
    const next = cur.includes(t) ? cur.filter((x) => x !== t) : [...cur, t];
    patch(b.id, { types: next.length && next.length < TYPE_KEYS.length ? next : undefined });
  }

  async function save() {
    if (!me) return;
    setBusy(true);
    try {
      const sections = list.map((b) => ({ id: b.id, k: b.k, ...(typesOf(b) && { types: typesOf(b)! }), ...(b.title?.trim() && { title: b.title.trim().slice(0, 60) }) }));
      await q(sb().from("profiles").update({ home_layout: { sections, text: text.trim() } }).eq("id", me.id));
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
      <p className="muted small">Profiline girenler önce bu sayfayı görür. İstediğin bölümü istediğin kadar ekle; her birinde hangi türlerin görüneceğini ve başlığını ayrı seç.
        Örneğin bir Favoriler sadece oyunlar, bir başkası animeler olabilir.</p>
      <div className="field">
        <label htmlFor="home-text">Üstte duracak yazı <span className="muted">· isteğe bağlı</span></label>
        <textarea id="home-text" rows={3} maxLength={2000} placeholder="ör. Soulslike ve eski JRPG'ler oynarım. En sevdiğim seri Persona." value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      <div className="home-rows">
        {list.map((b, i) => {
          const t = typesOf(b);
          return (
            <div className="home-row" key={b.id}>
              <div className="home-row-top">
                <span className="home-kind">{label(b.k)}</span>
                <input className="input home-title" maxLength={60} placeholder={`Başlık (boş kalırsa: ${titleOf({ ...b, title: "" })})`} value={b.title || ""}
                  onChange={(e) => patch(b.id, { title: e.target.value })} aria-label="Bölüm başlığı" />
                <button className="icon-btn" aria-label="Yukarı taşı" title="Yukarı" disabled={i === 0} onClick={() => move(i, -1)}>↑</button>
                <button className="icon-btn" aria-label="Aşağı taşı" title="Aşağı" disabled={i === list.length - 1} onClick={() => move(i, 1)}>↓</button>
                <button className="icon-btn" aria-label="Kopyasını ekle" title="Kopyasını ekle" onClick={() => setList((l) => [...l.slice(0, i + 1), { ...b, id: newId(), title: "" }, ...l.slice(i + 1)])}>⧉</button>
                <button className="icon-btn danger" aria-label="Bölümü kaldır" title="Kaldır" onClick={() => setList((l) => l.filter((x) => x.id !== b.id))}>✕</button>
              </div>
              {!NO_TYPES.includes(b.k) && (
                <div className="chips home-types">
                  <button type="button" className={`chip ${!t ? "active" : ""}`} onClick={() => patch(b.id, { types: undefined })}>Hepsi</button>
                  {TYPE_KEYS.map((k) => (
                    <button type="button" key={k} className={`chip ${!t || t.includes(k) ? "active" : ""}`} onClick={() => toggleType(b, k)}>{TYPES[k].plural}</button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
        {!list.length && <div className="muted small">Hiç bölüm yok; ana sayfanda sadece üstteki yazı görünür. Aşağıdan bölüm ekle.</div>}
      </div>
      <div className="home-add">
        <span className="muted small">Bölüm ekle:</span>
        {SECTIONS.map(([k, name]) => (
          <button type="button" key={k} className="chip" onClick={() => setList((l) => [...l, { id: newId(), k }])}>+ {name}</button>
        ))}
      </div>
      <div className="actions">
        <button className="link" onClick={() => { setList(toBlocks(null)); setText(""); }}>Varsayılana dön</button>
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

function LikedSection({ limit, types, title }: { limit: number; types: EntryType[] | null; title: string }) {
  const { profile } = useProfile();
  const { data: all } = useLiked();
  const data = types ? all?.filter((e) => types.includes(e.type)) : all;
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>{title}</h2><Link className="link" href={`/u/${profile.username}/likes`}>Tümü</Link></div>
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

function ListsSection({ title }: { title: string }) {
  const { profile } = useProfile();
  const { version } = useApp();
  const { data } = useLoad(() => q<List[]>(sb().from("lists").select("*, list_items(id, type, title, cover, rawg_id, position)")
    .eq("user_id", profile.id).eq("is_public", true).order("updated_at", { ascending: false }).limit(4)), [profile.id, version]);
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>{title}</h2><Link className="link" href={`/u/${profile.username}/lists`}>Tümü</Link></div>
      <div className="list-grid">{data.map((l) => <ListCard key={l.id} l={l} />)}</div>
    </section>
  );
}
