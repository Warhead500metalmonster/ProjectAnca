"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar, Name } from "@/components/ui";
import { SocialTabs } from "@/components/SocialTabs";
import { Reactions } from "@/components/Reactions";
import { ChatBody, DraftPhotos, PhotoAdd, ReplyQuote, ReplyingTo, excerptOf, withPhoto, type ReplyTarget } from "@/components/ChatBody";

interface SupportMsg { id: string; user_id: string; sender_id: string; body: string; reply_to: string | null; created_at: string; profiles?: Partial<Profile> | null }
interface Thread { user_id: string; last_at: string; last_sender: string | null; last_body: string | null; user_seen_at: string | null; done: boolean; profiles?: Partial<Profile> | null }

// Bize yaz: üye ekiple konuşur; bütün yöneticiler aynı konuşmayı görür, herhangi biri cevap verir, hepsine bildirim gider
export default function SupportPage() {
  const { user } = useParams<{ user?: string[] }>();
  const username = user?.[0] ? decodeURIComponent(user[0]).toLowerCase() : null;
  const { me, ready, isAdmin } = useApp();
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Ekibe yazmak için giriş yapmalısın.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  return <Support key={`${me.id}|${isAdmin}`} username={isAdmin ? username : null} />;
}

function Support({ username }: { username: string | null }) {
  const { me, isAdmin, toast } = useApp();
  const [threads, setThreads] = useState<Thread[] | null>(null);
  const [owner, setOwner] = useState<Profile | null>(null); // konuşmanın sahibi (üye kendisi ya da yöneticinin açtığı üye)
  const [msgs, setMsgs] = useState<SupportMsg[] | null>(null);
  const [missing, setMissing] = useState(false);
  const [text, setText] = useState("");
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const [sending, setSending] = useState(false);
  const [filter, setFilter] = useState<"open" | "all">("open");
  const box = useRef<HTMLDivElement>(null);
  const teamView = isAdmin; // yönetici gelen kutusunu görür

  // Kimin konuşması açık: üye için kendisi; yönetici için adresteki kişi
  useEffect(() => {
    if (!me) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- adresten gelen kişi
    if (!teamView) { setOwner(me); return; }
    if (!username) { setOwner(null); return; }
    q<Profile | null>(sb().from("profiles").select("*").eq("username", username).maybeSingle()).then((p) => { setOwner(p); setMissing(!p); }).catch(() => setMissing(true));
  }, [me, teamView, username]);

  const loadThreads = useCallback(async () => {
    if (!teamView) return;
    const rows = await q<Thread[]>(sb().from("support_threads").select(`*, profiles(${PROFILE_COLS})`).order("last_at", { ascending: false }).limit(200)).catch(() => null);
    setThreads(rows);
  }, [teamView]);

  const loadMsgs = useCallback(async () => {
    if (!owner) return;
    const rows = await q<SupportMsg[]>(sb().from("support_messages").select(`*, profiles!support_messages_sender_id_fkey(${PROFILE_COLS})`)
      .eq("user_id", owner.id).order("created_at").limit(500)).catch(() => null);
    setMsgs(rows);
    if (rows && owner.id === me?.id) sb().rpc("support_mark", { p_user: owner.id }).then(() => {}, () => {});
  }, [owner, me?.id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- ağdan gelen veri
    loadThreads();
    loadMsgs();
    const t = setInterval(() => { if (document.visibilityState === "visible") { loadThreads(); loadMsgs(); } }, 8000);
    return () => clearInterval(t);
  }, [loadThreads, loadMsgs]);

  const lastId = msgs?.[msgs.length - 1]?.id;
  useEffect(() => { box.current?.scrollTo({ top: box.current.scrollHeight }); }, [lastId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !owner) return;
    setSending(true);
    try {
      await q(sb().from("support_messages").insert({ user_id: owner.id, body, ...(reply && { reply_to: reply.id }) }));
      setText("");
      setReply(null);
      await Promise.all([loadMsgs(), loadThreads()]);
    } catch (err) {
      toast("Gönderilemedi: " + (err as Error).message);
    } finally {
      setSending(false);
    }
  }

  async function markDone(done: boolean) {
    if (!owner) return;
    const { error } = await sb().rpc("support_mark", { p_user: owner.id, p_done: done });
    if (error) return toast("Olmadı: " + error.message);
    toast(done ? "Çözüldü olarak işaretlendi" : "Yeniden açıldı");
    loadThreads();
  }

  const waiting = (t: Thread) => t.last_sender === t.user_id && !t.done;
  const list = (threads || []).filter((t) => filter === "all" || waiting(t));
  const thread = threads?.find((t) => t.user_id === owner?.id);
  const nameOf = (m: SupportMsg) => m.sender_id === me?.id ? "Sen" : m.profiles?.display_name || m.profiles?.username || "Ekip";

  return (
    <div className={`chat support ${owner ? "has-convo" : ""}`}>
      <aside className="chat-list">
        <SocialTabs />
        {teamView ? (
          <>
            <div className="support-inbox-head">
              <b>Ekip gelen kutusu</b>
              <div className="mini-tabs">
                <button className={filter === "open" ? "active" : ""} onClick={() => setFilter("open")}>Cevap bekleyen</button>
                <button className={filter === "all" ? "active" : ""} onClick={() => setFilter("all")}>Hepsi</button>
              </div>
            </div>
            {threads === null ? <p className="muted small">Ekip sohbeti için veritabanı güncellemesi (035) gerekiyor ya da yükleniyor…</p>
              : !list.length ? <p className="muted small">{filter === "open" ? "Cevap bekleyen mesaj yok. Her şey yolunda." : "Henüz kimse yazmadı."}</p>
              : list.map((t) => (
                <Link key={t.user_id} href={`/support/${t.profiles?.username}`} className={`chat-friend ${t.user_id === owner?.id ? "active" : ""}`}>
                  <Avatar p={t.profiles} />
                  <div className="grow">
                    <b><Name p={t.profiles} /></b>
                    <span>{t.last_sender !== t.user_id ? "Ekip: " : ""}{excerptOf(t.last_body || "")}</span>
                  </div>
                  {waiting(t) ? <span className="unread" title="Cevap bekliyor">!</span> : t.done ? <span className="muted small">çözüldü</span> : null}
                </Link>
              ))}
          </>
        ) : (
          <Link href="/support" className="chat-friend active">
            <span className="avatar team-avatar" aria-hidden="true">A</span>
            <div className="grow"><b>Ancalog ekibi</b><span>Soru, sorun, şikayet, öneri</span></div>
          </Link>
        )}
      </aside>
      <section className="chat-main">
        {owner ? (
          <>
            <header className="chat-head">
              <Link href={teamView ? "/support" : "/chat"} className="icon-btn back" aria-label="Geri">←</Link>
              {teamView ? (
                <>
                  <Avatar p={owner} />
                  <Link href={`/u/${owner.username}`}><b><Name p={owner} /></b> <span className="muted">@{owner.username}</span></Link>
                  <span style={{ flex: 1 }} />
                  {thread && <button className="btn small" onClick={() => markDone(!thread.done)}>{thread.done ? "Yeniden aç" : "Çözüldü"}</button>}
                </>
              ) : (
                <>
                  <span className="avatar team-avatar" aria-hidden="true">A</span>
                  <div className="grow"><b>Ancalog ekibi</b><div className="muted small">Yazdığını bütün ekip görür, ilk müsait olan cevap verir.</div></div>
                </>
              )}
            </header>
            <div className="msgs" ref={box}>
              {msgs === null ? <p className="muted center">Ekip sohbeti henüz açılmadı (veritabanı güncellemesi bekleniyor). Şimdilik <Link className="grad" href="/chat/arno4436">site sahibine yaz</Link>.</p>
                : msgs.length ? msgs.map((m) => {
                  const mine = m.sender_id === me?.id;
                  const team = m.sender_id !== m.user_id;
                  const parent = m.reply_to ? msgs.find((x) => x.id === m.reply_to) : null;
                  return (
                    <div key={m.id} id={`msg-${m.id}`} className={`bubble ${mine ? "me" : ""}`}>
                      {!mine && <div className="bubble-who">{team ? <>{m.profiles?.display_name || m.profiles?.username} <em className="owner-tag">Ekip</em></> : <Name p={m.profiles} />}</div>}
                      {m.reply_to && <ReplyQuote parent={parent && { id: parent.id, body: parent.body }} name={parent && nameOf(parent)} />}
                      <div className="bubble-body"><ChatBody text={m.body} /></div>
                      <div className="bubble-foot">
                        <small>{timeAgo(m.created_at)}</small>
                        <button type="button" className="link reply-btn" onClick={() => { setReply({ id: m.id, name: nameOf(m), body: m.body }); document.getElementById("support-input")?.focus(); }}>Yanıtla</button>
                        <Reactions kind="support" id={m.id} />
                      </div>
                    </div>
                  );
                }) : <p className="muted center">{teamView ? "Bu kişiyle henüz yazışma yok. İlk mesajı ekip adına sen yazabilirsin." : "Siteyle ilgili sorunu, şikayetini ya da önerini yaz. Bütün ekip görür, en kısa sürede cevap verilir."}</p>}
            </div>
            {msgs !== null && (
              <div className="chat-compose">
                {reply && <ReplyingTo reply={reply} onCancel={() => setReply(null)} />}
                <DraftPhotos text={text} />
                <form className="chat-form" onSubmit={send}>
                  <PhotoAdd onAdd={(url) => setText((t) => withPhoto(t, url))} />
                  <input id="support-input" value={text} maxLength={2000} autoFocus placeholder={teamView ? "Ekip adına cevap yaz…" : "Ekibe yaz…"} onChange={(e) => setText(e.target.value)} />
                  <button className="btn primary" disabled={sending || !text.trim()}>Gönder</button>
                </form>
              </div>
            )}
          </>
        ) : missing ? <div className="empty">@{username} diye bir kullanıcı yok.</div>
          : <div className="empty">Soldan bir konuşma seç. Üyelerin <b>Bize yaz</b>&apos;dan gönderdikleri burada toplanır; herhangi biriniz cevap verebilir.</div>}
      </section>
    </div>
  );
}
