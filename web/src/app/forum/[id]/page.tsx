/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { ForumPost, ForumThread } from "@/lib/types";
import { FORUM_CATS, PROFILE_COLS } from "@/lib/constants";
import { contentHref, safeUrl, timeAgo } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { SocialTabs } from "@/components/SocialTabs";
import { Avatar, Name, RichText } from "@/components/ui";

export default function ThreadPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { me, isAdmin, toast, blocked, report } = useApp();
  const [tick, setTick] = useState(0);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  const { data, error } = useLoad(async () => {
    const [thread, posts] = await Promise.all([
      q<ForumThread>(sb().from("forum_threads").select(`*, profiles(${PROFILE_COLS})`).eq("id", id).single()),
      q<ForumPost[]>(sb().from("forum_posts").select(`*, profiles(${PROFILE_COLS})`).eq("thread_id", id).order("created_at").limit(1000)),
    ]);
    return { thread, posts };
  }, [id, tick], supabaseConfigured());

  if (error) return <div className="forum"><SocialTabs /><div className="empty">Konu bulunamadı ya da silinmiş. <Link className="grad" href="/forum">Foruma dön</Link></div></div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { thread: t, posts } = data;

  async function reply(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    try {
      await q(sb().from("forum_posts").insert({ thread_id: id, body }));
      setText("");
      setTick((n) => n + 1);
    } catch (err) {
      toast("Gönderilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function run(what: Promise<unknown>, ok: string) {
    try { await what; toast(ok); setTick((n) => n + 1); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  async function removeThread() {
    if (!confirm("Bu konu ve bütün cevapları silinsin mi?")) return;
    try {
      await q(sb().from("forum_threads").delete().eq("id", id));
      toast("Konu silindi");
      router.push("/forum");
    } catch (err) { toast("Silinemedi: " + (err as Error).message); }
  }

  const mineOrAdmin = (uid: string) => me && (me.id === uid || isAdmin);

  return (
    <div className="forum">
      <SocialTabs />
      <Link className="link small" href={t.item ? `/forum?type=${t.item.type}&title=${encodeURIComponent(t.item.title)}${t.item.rawg_id ? `&rawg=${t.item.rawg_id}` : ""}` : "/forum"}>← {t.item ? `${t.item.title} konuları` : "Forum"}</Link>
      <article className="post first">
        <header>
          <Avatar p={t.profiles} />
          <div className="grow">
            <h1>{t.pinned && <span className="t-tag">Sabit</span>}{t.locked && <span className="t-tag">Kilitli</span>}{t.title}</h1>
            <span className="muted small">
              <Link href={`/u/${t.profiles?.username}`}><Name p={t.profiles} /></Link> · {FORUM_CATS[t.category] || "Genel"} · {timeAgo(t.created_at)}
            </span>
          </div>
        </header>
        {t.item && (
          <Link className="forum-item" href={contentHref(t.item)}>
            {t.item.cover && <img src={safeUrl(t.item.cover)} alt="" />}
            <div className="grow"><span className="muted small">Tartışılan</span><b>{t.item.title}{t.item.year ? ` (${t.item.year})` : ""}</b></div>
          </Link>
        )}
        <p className="post-body"><RichText text={t.body} /></p>
        {mineOrAdmin(t.user_id) && (
          <div className="post-tools">
            {isAdmin && <button className="link" onClick={() => run(q(sb().from("forum_threads").update({ pinned: !t.pinned }).eq("id", id)), t.pinned ? "Sabitleme kalktı" : "Konu sabitlendi")}>{t.pinned ? "Sabitlemeyi kaldır" : "Sabitle"}</button>}
            {isAdmin && <button className="link" onClick={() => run(q(sb().from("forum_threads").update({ locked: !t.locked }).eq("id", id)), t.locked ? "Konu açıldı" : "Konu kilitlendi")}>{t.locked ? "Kilidi aç" : "Kilitle"}</button>}
            <button className="link danger" onClick={removeThread}>Konuyu sil</button>
          </div>
        )}
        {me && me.id !== t.user_id && (
          <div className="post-tools"><button className="report-link" onClick={() => report({ kind: "forum_thread", id: t.id, user: t.user_id,
            excerpt: `${t.title} / ${t.body}`, label: `@${t.profiles?.username} kullanıcısının "${t.title}" konusu` })}>Raporla</button></div>
        )}
      </article>

      <h3 className="set-h">{posts.length ? `${posts.length} cevap` : "Henüz cevap yok"}</h3>
      {posts.filter((p) => !blocked.has(p.user_id)).map((p) => (
        <article key={p.id} className="post">
          <header>
            <Avatar p={p.profiles} />
            <div className="grow">
              <Link href={`/u/${p.profiles?.username}`}><b><Name p={p.profiles} /></b></Link>
              {p.user_id === t.user_id && <span className="t-tag">Konuyu açan</span>}
              <span className="muted small"> · {timeAgo(p.created_at)}</span>
            </div>
            {mineOrAdmin(p.user_id) && (
              <button className="link danger small" onClick={() => confirm("Bu cevap silinsin mi?") && run(q(sb().from("forum_posts").delete().eq("id", p.id)), "Cevap silindi")}>Sil</button>
            )}
            {me && me.id !== p.user_id && (
              <button className="report-link" onClick={() => report({ kind: "forum_post", id: p.id, user: p.user_id, excerpt: p.body,
                label: `@${p.profiles?.username} kullanıcısının "${t.title}" konusundaki cevabı` })}>Raporla</button>
            )}
          </header>
          <p className="post-body"><RichText text={p.body} /></p>
        </article>
      ))}

      {t.locked ? <div className="empty">Bu konu kilitlendi, yeni cevap yazılamaz.</div> : me ? (
        <form className="forum-new" onSubmit={reply}>
          <textarea className="input" rows={4} maxLength={5000} placeholder="Cevabını yaz… (spoiler için ||böyle|| yaz)" value={text} onChange={(e) => setText(e.target.value)} />
          <div className="row-end"><button className="btn primary" disabled={busy || !text.trim()}>{busy ? "Gönderiliyor…" : "Cevapla"}</button></div>
        </form>
      ) : (
        <div className="empty"><Link className="btn primary" href="/login">Cevap yazmak için giriş yap</Link></div>
      )}
    </div>
  );
}
