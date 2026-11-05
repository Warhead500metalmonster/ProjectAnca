"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, Name } from "@/components/ui";
import { Reactions } from "@/components/Reactions";
import { ChatBody, DraftPhotos, PhotoAdd, ReplyQuote, ReplyingTo, withPhoto, type ReplyTarget } from "@/components/ChatBody";
import { useProfile } from "@/components/ProfileShell";

interface PComment { id: string; profile_id: string; user_id: string; body: string; reply_to: string | null; created_at: string; profiles?: Partial<Profile> | null }

const MODES: [string, string][] = [["all", "Herkes yazabilir"], ["friends", "Sadece arkadaşlarım"], ["off", "Yorumlar kapalı"]];

// Steam'deki gibi profil yorumları: en yeni üstte; yanıtla, fotoğraf, spoiler, tepki, sil, raporla
export function ProfileComments() {
  const { profile, isMe } = useProfile();
  const { me, isAdmin, isFriend, blocked, toast, report, setMe } = useApp();
  const [v, setV] = useState(0);
  const [text, setText] = useState("");
  const [replyTo, setReplyTo] = useState<ReplyTarget | null>(null);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState(10);
  const mode = (isMe ? me?.comments_mode : profile.comments_mode) || "all";

  const { data, error } = useLoad(() => q<PComment[]>(sb().from("profile_comments").select(`*, profiles!profile_comments_user_id_fkey(${PROFILE_COLS})`)
    .eq("profile_id", profile.id).order("created_at", { ascending: false }).limit(300)), [profile.id, v]);

  // Bildirimden /u/ali#yorumlar ile gelince yorumlar yüklenince oraya kay
  useEffect(() => {
    if (data && location.hash === "#yorumlar") document.getElementById("yorumlar")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [data]);
  // Tablo yoksa (SQL çalışmadıysa) bölüm hiç görünmez
  if (error) return null;
  const list = (data || []).filter((c) => !blocked.has(c.user_id));
  const canWrite = !!me && (isMe || mode === "all" || (mode === "friends" && isFriend(profile.id))) && !blocked.has(profile.id);

  async function send(ev: React.FormEvent) {
    ev.preventDefault();
    const body = text.trim();
    if (!body || !me) return;
    setBusy(true);
    try {
      await q(sb().from("profile_comments").insert({ profile_id: profile.id, body, ...(replyTo && { reply_to: replyTo.id }) }));
      setText("");
      setReplyTo(null);
      setV((x) => x + 1);
    } catch (err) {
      toast("Gönderilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(c: PComment) {
    if (!confirm("Bu yorum silinsin mi?")) return;
    try { await q(sb().from("profile_comments").delete().eq("id", c.id)); setV((x) => x + 1); } catch (err) { toast("Silinemedi: " + (err as Error).message); }
  }

  async function setMode(m: string) {
    try {
      setMe(await q<Profile>(sb().from("profiles").update({ comments_mode: m }).eq("id", profile.id).select().single()));
      toast(m === "off" ? "Profil yorumları kapandı" : m === "friends" ? "Artık sadece arkadaşların yazabilir" : "Herkes yorum yazabilir");
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
    }
  }

  if (!isMe && mode === "off" && !list.length) return null;
  return (
    <section className="section pcomments" id="yorumlar">
      <div className="section-head">
        <h2>Yorumlar {list.length ? <span className="muted small">{list.length}</span> : null}</h2>
        {isMe && (
          <select className="btn small" value={mode} onChange={(e) => setMode(e.target.value)} aria-label="Kimler yorum yazabilir">
            {MODES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        )}
      </div>
      {canWrite ? (
        <div className="comment-compose pc-compose">
          {replyTo && <ReplyingTo reply={replyTo} onCancel={() => setReplyTo(null)} />}
          <DraftPhotos text={text} />
          <form className="comment-form" onSubmit={send}>
            <PhotoAdd onAdd={(url) => setText((x) => withPhoto(x, url))} />
            <input id="pc-input" value={text} maxLength={1000} placeholder={isMe ? "Profiline bir not bırak…" : `${profile.display_name || profile.username} için bir yorum yaz… (spoiler için ||böyle||)`}
              onChange={(e) => setText(e.target.value)} />
            <button className="btn primary" disabled={busy || !text.trim()}>Gönder</button>
          </form>
        </div>
      ) : !me ? (
        <p className="muted small"><Link className="grad" href="/login">Giriş yap</Link>, yorum yaz.</p>
      ) : mode !== "all" && !isMe ? (
        <p className="muted small">{mode === "off" ? "Bu profilde yorumlar kapalı." : "Bu profile sadece arkadaşları yorum yazabilir."}</p>
      ) : null}
      {data === undefined ? <div className="loading">Yükleniyor…</div> : !list.length ? (
        canWrite && <p className="muted small" style={{ margin: "4px 0 0" }}>Henüz yorum yok. {isMe ? "" : "İlk yorumu sen yaz!"}</p>
      ) : (
        <div className="comments pc-list">
          {list.slice(0, shown).map((c) => {
            const parent = c.reply_to ? (data || []).find((x) => x.id === c.reply_to) : null;
            return (
              <div className="comment" key={c.id} id={`msg-${c.id}`}>
                <Link href={`/u/${c.profiles?.username}`}><Avatar p={c.profiles} cls="sm" /></Link>
                <div>
                  <div className="comment-head">
                    <Link href={`/u/${c.profiles?.username}`}><b><Name p={c.profiles} /></b></Link>
                    <span className="muted">{timeAgo(c.created_at)}</span>
                    {me && (me.id === c.user_id || isMe || isAdmin) && <button type="button" className="link danger" onClick={() => remove(c)}>sil</button>}
                    {me && me.id !== c.user_id && (
                      <button type="button" className="report-link" onClick={() => report({ kind: "pcomment", id: c.id, user: c.user_id, excerpt: c.body,
                        label: `@${c.profiles?.username} kullanıcısının @${profile.username} profiline yorumu` })}>Raporla</button>
                    )}
                  </div>
                  {c.reply_to && <ReplyQuote parent={parent && { id: parent.id, user_id: parent.user_id, body: parent.body }} name={parent?.profiles?.display_name || parent?.profiles?.username} />}
                  <ChatBody text={c.body} />
                  <div className="post-tools">
                    {canWrite && <button type="button" className="link reply-btn" onClick={() => { setReplyTo({ id: c.id, name: c.profiles?.display_name || c.profiles?.username || "Bu kişi", body: c.body }); document.getElementById("pc-input")?.focus(); }}>Yanıtla</button>}
                    <Reactions kind="pcomment" id={c.id} />
                  </div>
                </div>
              </div>
            );
          })}
          {list.length > shown && <button className="feed-more" onClick={() => setShown((n) => n + 20)}>Daha eski yorumlar ({list.length - shown})</button>}
        </div>
      )}
    </section>
  );
}
