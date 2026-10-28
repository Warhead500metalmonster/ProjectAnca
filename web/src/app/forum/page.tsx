/* eslint-disable @next/next/no-img-element */
"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { ForumThread, Item } from "@/lib/types";
import { FORUM_CATS, PROFILE_COLS } from "@/lib/constants";
import { contentHref, contentKey, likeEsc, safeUrl, timeAgo } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { SocialTabs } from "@/components/SocialTabs";
import { Avatar, Name } from "@/components/ui";

export default function ForumPage() {
  return <Suspense fallback={<div className="loading">Yükleniyor…</div>}><Forum /></Suspense>;
}

// Bir içerik sayfasından "Forumda tartış" ile gelince o içerik hazır seçili gelir
function itemFromQuery(s: URLSearchParams): Item | null {
  const type = s.get("type"), title = s.get("title");
  if (!type || !title) return null;
  const rawg = Number(s.get("rawg")) || null;
  return { type: type as Item["type"], title, year: Number(s.get("year")) || null, creator: s.get("creator"), cover: safeUrl(s.get("cover")) || null, rawg_id: rawg, ext_id: s.get("ext") };
}

function Forum() {
  const search = useSearchParams();
  const router = useRouter();
  const { me, version, toast } = useApp();
  const item = itemFromQuery(search);
  const key = item ? contentKey(item) : null;
  const [cat, setCat] = useState("");
  const [text, setText] = useState("");
  const [writing, setWriting] = useState(search.get("new") === "1");

  const { data, error } = useLoad(async () => {
    let req = sb().from("forum_threads").select(`*, profiles(${PROFILE_COLS})`)
      .order("pinned", { ascending: false }).order("last_post_at", { ascending: false }).limit(100);
    if (key) req = req.eq("content_key", key);
    if (cat) req = req.eq("category", cat);
    if (text.trim().length > 1) req = req.ilike("title", `%${likeEsc(text.trim())}%`);
    return q<ForumThread[]>(req);
  }, [key, cat, text, version], supabaseConfigured());

  return (
    <div className="forum">
      <SocialTabs />
      <div className="forum-head">
        <div>
          <h1>Forum</h1>
          <p className="muted">Oyunları, filmleri, dizileri konuş. Spoiler vereceksen yazıyı ||böyle|| iki çizgi arasına al.</p>
        </div>
        {me ? <button className="btn primary" onClick={() => setWriting(!writing)}>{writing ? "Vazgeç" : "Yeni konu aç"}</button>
          : <Link className="btn primary" href="/login">Konu açmak için giriş yap</Link>}
      </div>

      {item && (
        <div className="forum-item">
          {item.cover && <img src={item.cover} alt="" />}
          <div className="grow"><span className="muted small">Bu içerikle ilgili konular</span><b><Link href={contentHref(item)}>{item.title}</Link></b></div>
          <Link className="btn" href="/forum">Tüm forum</Link>
        </div>
      )}

      {writing && me && (
        <NewThread item={item} onDone={(id) => { setWriting(false); toast("Konu açıldı"); router.push(`/forum/${id}`); }} />
      )}

      <div className="toolbar">
        <div className="chips">
          <button className={`chip ${cat === "" ? "active" : ""}`} onClick={() => setCat("")}>Hepsi</button>
          {Object.entries(FORUM_CATS).map(([k, v]) => <button key={k} className={`chip ${cat === k ? "active" : ""}`} onClick={() => setCat(k)}>{v}</button>)}
        </div>
        <div className="right"><input className="input" type="search" placeholder="Konu ara…" value={text} onChange={(e) => setText(e.target.value)} /></div>
      </div>

      {error ? <div className="empty">Forum yüklenemedi: {error}</div> : !data ? <div className="loading">Yükleniyor…</div> : data.length ? (
        <div className="threads">
          {data.map((t) => (
            <Link key={t.id} href={`/forum/${t.id}`} className={`thread-row ${t.pinned ? "pinned" : ""}`}>
              {t.item?.cover ? <img className="t-cover" src={safeUrl(t.item.cover)} alt="" loading="lazy" /> : <Avatar p={t.profiles} />}
              <div className="grow">
                <b>{t.pinned && <span className="t-tag">Sabit</span>}{t.locked && <span className="t-tag">Kilitli</span>}{t.title}</b>
                <span className="muted small">
                  {FORUM_CATS[t.category] || "Genel"}{t.item ? ` · ${t.item.title}` : ""} · <Name p={t.profiles} /> · {timeAgo(t.created_at)}
                </span>
              </div>
              <div className="t-meta"><b>{t.reply_count}</b><span>cevap</span><small>{timeAgo(t.last_post_at)}</small></div>
            </Link>
          ))}
        </div>
      ) : (
        <div className="empty">{item ? "Bu içerik hakkında henüz konu yok. İlk konuyu sen aç!" : "Henüz konu yok. İlk konuyu sen aç!"}</div>
      )}
    </div>
  );
}

function NewThread({ item, onDone }: { item: Item | null; onDone: (id: string) => void }) {
  const { toast } = useApp();
  const guess = item ? ({ game: "oyun", movie: "film", show: "dizi", music: "muzik", anime: "anime" } as const)[item.type] : "genel";
  const [title, setTitle] = useState(item ? `${item.title} hakkında` : "");
  const [body, setBody] = useState("");
  const [category, setCategory] = useState<string>(guess);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (title.trim().length < 3 || !body.trim()) return toast("Başlık ve yazı boş olamaz.");
    setBusy(true);
    try {
      const t = await q<ForumThread>(sb().from("forum_threads").insert({
        title: title.trim(), body: body.trim(), category, item: item || null, content_key: item ? contentKey(item) : null,
      }).select("id").single());
      onDone(t.id);
    } catch (err) {
      toast("Açılamadı: " + (err as Error).message);
      setBusy(false);
    }
  }

  return (
    <form className="forum-new" onSubmit={submit}>
      <input className="input" maxLength={140} placeholder="Başlık" value={title} autoFocus onChange={(e) => setTitle(e.target.value)} />
      <select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Bölüm">
        {Object.entries(FORUM_CATS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
      </select>
      <textarea className="input" rows={6} maxLength={8000} placeholder="Ne konuşmak istiyorsun?" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="row-end"><button className="btn primary" disabled={busy}>{busy ? "Açılıyor…" : "Konuyu aç"}</button></div>
    </form>
  );
}
