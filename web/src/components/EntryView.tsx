"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Comment, Entry } from "@/lib/types";
import { PROFILE_COLS, TYPES, statusLabel } from "@/lib/constants";
import { contentHref, cssUrl, daysTaken, fmtDate, fmtDur, itemOf, num, playSec, safeUrl, scoreText, timeAgo } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { Avatar, Name, Rating, RichText } from "./ui";
import { EpisodeTracker } from "./EpisodeTracker";
import { useApp } from "./AppProvider";

// Bir kaydın ayrıntılarını, beğeni ve yorumlarını gösteren pencere
export function EntryView({ entry: e, onClose, onEdit }: { entry: Entry; onClose: () => void; onEdit: (e: Entry) => void }) {
  const { me, myEntry, scale, openForm, pickList, toast, refresh, isAdmin } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [likers, setLikers] = useState<string[] | null>(null);
  const [comments, setComments] = useState<Comment[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [fav, setFav] = useState(!!e.favorite);
  useEffect(() => { ref.current?.showModal(); }, []);

  const load = useCallback(async () => {
    const db = sb();
    const [l, c] = await Promise.all([
      q<{ user_id: string }[]>(db.from("likes").select("user_id").eq("entry_id", e.id)),
      q<Comment[]>(db.from("comments").select(`*, profiles(${PROFILE_COLS})`).eq("entry_id", e.id).order("created_at").limit(200)),
    ]);
    setLikers(l.map((x) => x.user_id));
    setComments(c);
  }, [e.id]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { load().catch(() => { setLikers([]); setComments([]); }); }, [load]);

  const t = TYPES[e.type];
  const p = e.profiles || {};
  const cover = safeUrl(e.cover);
  const isMine = me?.id === e.user_id;
  const my = me && !isMine ? myEntry(e) : undefined;
  const liked = !!me && !!likers?.includes(me.id);
  const days = daysTaken(e);
  const details = [
    [t.where, [e.platform, e.emulated ? "Emülatör" : ""].filter(Boolean).join(" · ")],
    ["Mağaza", e.store],
    ["Başladı", e.started_on && fmtDate(e.started_on)],
    [e.status === "completed" ? "Bitirdi" : "Tarih", e.date && fmtDate(e.date)],
    ["Kaç günde bitti", days && `${days} gün`],
    [t.time, fmtDur(playSec(e))],
    ["Şu anki ilerleme", fmtDur(e.progress_sec)],
  ].filter(([, v]) => v) as [string, string][];

  async function toggleLike() {
    if (!me) return toast("Beğenmek için giriş yap.");
    try {
      if (liked) await q(sb().from("likes").delete().eq("user_id", me.id).eq("entry_id", e.id));
      else await q(sb().from("likes").insert({ entry_id: e.id }));
      setLikers((l) => (liked ? (l || []).filter((x) => x !== me.id) : [...(l || []), me.id]));
      refresh();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    }
  }

  // Kendi kaydını tek tıkla favorilere ekle / çıkar (her kategoride en fazla 10)
  async function toggleFav() {
    try {
      await q(sb().from("entries").update({ favorite: !fav }).eq("id", e.id));
      setFav(!fav);
      toast(fav ? "Favorilerden çıkarıldı" : "Favorilere eklendi ♥");
      refresh();
    } catch (err) {
      toast((err as Error).message);
    }
  }

  async function sendComment(ev: React.FormEvent) {
    ev.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setBusy(true);
    try {
      const c = await q<Comment>(sb().from("comments").insert({ entry_id: e.id, body }).select(`*, profiles(${PROFILE_COLS})`).single());
      setComments((list) => [...(list || []), c]);
      setText("");
      refresh();
    } catch (err) {
      toast("Yorum gönderilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function deleteComment(c: Comment) {
    if (!confirm("Yorum silinsin mi?")) return;
    try {
      await q(sb().from("comments").delete().eq("id", c.id));
      setComments((list) => (list || []).filter((x) => x.id !== c.id));
      refresh();
    } catch (err) {
      toast("Silinemedi: " + (err as Error).message);
    }
  }

  const diff = my && my.rating && e.rating ? Number(my.rating) - Number(e.rating) : null;
  const close = () => ref.current?.close();

  return (
    <dialog ref={ref} onClose={onClose} onClick={(ev) => ev.target === ref.current && close()}>
      <div className="view-body">
        <div className="view-cover" style={cover ? { backgroundImage: cssUrl(cover) } : { background: "linear-gradient(120deg,#0f3d3a,#2a6f9a)" }}>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={close}>✕</button>
        </div>
        <div className="view-content">
          <div className="chips-row">
            <span className={`badge ${e.status}`}>{statusLabel(e.status, e.type)}</span>
            {isMine
              ? <button type="button" className={`fav-btn ${fav ? "on" : ""}`} onClick={toggleFav}>{fav ? "♥ Favori" : "♡ Favorilere ekle"}</button>
              : fav && <span className="badge fav">♥ Favori</span>}
          </div>
          <h2><Link href={contentHref(e)} onClick={close}>{e.title}</Link></h2>
          {(e.creator || e.year) && <div className="muted">{[e.creator, e.year].filter(Boolean).join(" · ")}</div>}
          <Rating r={e.rating} big />
          {p.username && (
            <div className="view-user"><Avatar p={p} cls="sm" /> <Link href={`/u/${p.username}`} onClick={close}><Name p={p} /></Link> · {timeAgo(e.updated_at)}</div>
          )}

          {my && (
            <div className="compare">
              <div><span>{p.display_name || p.username}</span>{e.rating ? <Rating r={e.rating} /> : <i className="muted">puan yok</i>}</div>
              <div><span>Sen</span>{my.rating ? <Rating r={my.rating} /> : <i className="muted">puan yok</i>}
                <span className={`pill ${my.status}`}>{statusLabel(my.status, my.type)}</span></div>
              {diff !== null && (
                <p>{diff === 0 ? "Aynı puanı vermişsiniz."
                  : `Sen ${scale === 10 ? num(Math.abs(diff)) : num(Math.abs(diff) / 2, 2)} puan ${diff > 0 ? "daha yüksek" : "daha düşük"} vermişsin (${scoreText(Number(my.rating), scale)}).`}</p>
              )}
            </div>
          )}
          {me && !isMine && !my && (
            <div className="compare empty-cmp">
              <span>Bunu henüz loglamadın.</span>
              <button type="button" className="btn" onClick={() => { close(); openForm(null, { item: itemOf(e) }); }}>+ Kütüphaneme ekle</button>
            </div>
          )}

          {details.length > 0 && (
            <div className="view-details">{details.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
          )}
          {(e.type === "show" || e.type === "anime") && <EpisodeTracker e={e} mine={me?.id === e.user_id} />}
          {e.progress && <div className="view-note"><span>Not</span>{e.progress}</div>}
          {e.notes && <div className="view-notes"><span className="muted">İnceleme</span>{"\n"}<RichText text={e.notes} /></div>}

          <div className="social-bar">
            <button type="button" className={`like ${liked ? "on" : ""}`} onClick={toggleLike} disabled={likers === null}>
              {liked ? "♥" : "♡"} {likers?.length ?? "…"} beğeni
            </button>
            <span className="muted">{comments?.length ?? "…"} yorum</span>
          </div>
          <div className="comments">
            {comments?.map((c) => (
              <div className="comment" key={c.id}>
                <Link href={`/u/${c.profiles?.username}`} onClick={close}><Avatar p={c.profiles} cls="sm" /></Link>
                <div>
                  <div className="comment-head">
                    <Link href={`/u/${c.profiles?.username}`} onClick={close}><b><Name p={c.profiles} /></b></Link>
                    <span className="muted">{timeAgo(c.created_at)}</span>
                    {me && (me.id === c.user_id || isMine || isAdmin) && <button type="button" className="link danger" onClick={() => deleteComment(c)}>sil</button>}
                  </div>
                  <p><RichText text={c.body} /></p>
                </div>
              </div>
            ))}
            {me ? (
              <form className="comment-form" onSubmit={sendComment}>
                <input value={text} maxLength={1000} placeholder="Yorum yaz… (spoiler için ||böyle|| yaz)" onChange={(ev) => setText(ev.target.value)} />
                <button className="btn primary" disabled={busy || !text.trim()}>Gönder</button>
              </form>
            ) : <p className="muted" style={{ margin: 0 }}><Link href="/login" onClick={close} className="grad">Giriş yap</Link>, yorum yaz.</p>}
          </div>

          <div className="actions">
            <Link className="btn" href={contentHref(e)} onClick={close}>{e.type === "game" ? "Oyun sayfası" : "İçerik sayfası"} →</Link>
            <button type="button" className="btn" onClick={() => { close(); pickList(itemOf(e)); }}>Listeye ekle</button>
            <span className="spacer" />
            {isMine && <button type="button" className="btn primary" onClick={() => onEdit(e)}>Düzenle</button>}
          </div>
        </div>
      </div>
    </dialog>
  );
}
