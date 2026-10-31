"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Message, Profile } from "@/lib/types";
import { timeAgo } from "@/lib/format";
import { q, sb, NO_PERMISSION } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Avatar, Name } from "@/components/ui";
import { SocialTabs } from "@/components/SocialTabs";
import { ChatBody, DraftPhotos, PhotoAdd, ReplyQuote, ReplyingTo, excerptOf, withPhoto, type ReplyTarget } from "@/components/ChatBody";

// Karşılıklı takipleşen arkadaşlar mesajlaşabilir; site sahibine ise herkes yazabilir (soru, sorun, şikayet için)
// ve site sahibi herkese cevap verebilir. Veritabanı da bunu zorunlu tutar.
export default function ChatPage() {
  const params = useParams<{ user?: string[] }>();
  const username = params.user?.[0] ? decodeURIComponent(params.user[0]).toLowerCase() : "";
  const { me, ready, following, followers, checkInbox, toast, badges, isOwner, blocked, toggleBlock, report } = useApp();
  const [friends, setFriends] = useState<Profile[] | null>(null);
  const [msgs, setMsgs] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [reply, setReply] = useState<ReplyTarget | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const friendIds = [...following].filter((id) => followers.has(id));
  const ownerIds = [...badges].filter(([, b]) => b.includes("owner")).map(([id]) => id);
  const partnerIds = [...new Set(msgs.flatMap((m) => [m.sender_id, m.receiver_id]))]; // daha önce yazıştıkların
  const contactIds = [...new Set([...friendIds, ...ownerIds, ...partnerIds])].filter((id) => id !== me?.id);
  const friendKey = contactIds.sort().join(",");

  useEffect(() => {
    if (!me) return;
    const byName = username && isOwner ? sb().from("profiles").select("*").eq("username", username) : null; // sahip herkese yazabilir
    Promise.all([
      contactIds.length ? q<Profile[]>(sb().from("profiles").select("*").in("id", contactIds)) : Promise.resolve([]),
      byName ? q<Profile[]>(byName).catch(() => []) : Promise.resolve([]),
    ]).then(([a, b]) => setFriends([...a, ...b.filter((x) => x.id !== me.id && !a.some((y) => y.id === x.id))]))
      .catch(() => setFriends([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [me?.id, friendKey, username, isOwner]);
  const isSiteOwner = (id: string) => ownerIds.includes(id);

  // Mesajları çek; sohbet açıkken birkaç saniyede bir yenile
  const load = useCallback(async () => {
    if (!me) return;
    const list = await q<Message[]>(sb().from("messages").select("*").order("created_at", { ascending: false }).limit(500));
    setMsgs((old) => (old.length === list.length && old[0]?.id === list[0]?.id && old[0]?.read_at === list[0]?.read_at ? old : list));
  }, [me]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
    load().catch(() => {});
    const timer = setInterval(() => load().catch(() => {}), 4000);
    return () => clearInterval(timer);
  }, [load]);

  const friend = friends?.find((f) => f.username === username);
  const convo = friend ? msgs.filter((m) => m.sender_id === friend.id || m.receiver_id === friend.id).reverse() : [];
  const lastId = convo[convo.length - 1]?.id;

  // Açık sohbetteki okunmamış mesajları okundu yap, en alta kaydır
  useEffect(() => {
    if (!me || !friend) return;
    if (convo.some((m) => m.receiver_id === me.id && !m.read_at)) {
      sb().from("messages").update({ read_at: new Date().toISOString() })
        .eq("receiver_id", me.id).eq("sender_id", friend.id).is("read_at", null)
        .then(() => checkInbox());
    }
    box.current?.scrollTo({ top: box.current.scrollHeight });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [friend?.id, lastId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || !friend) return;
    setSending(true);
    try {
      const m = await q<Message>(sb().from("messages").insert({ receiver_id: friend.id, body, ...(reply && { reply_to: reply.id }) }).select().single());
      setMsgs((list) => [m, ...list]);
      setText("");
      setReply(null);
    } catch (err) {
      toast((err as Error).message === NO_PERMISSION
        ? "Sadece karşılıklı takipleştiğin arkadaşlarına (ve site sahibine) yazabilirsin." : "Gönderilemedi: " + (err as Error).message);
    } finally {
      setSending(false);
    }
  }

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Mesajlaşmak için giriş yapmalısın.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;

  const last = (id: string) => msgs.find((m) => m.sender_id === id || m.receiver_id === id);
  const unreadFrom = (id: string) => msgs.filter((m) => m.sender_id === id && m.receiver_id === me.id && !m.read_at).length;
  const sorted = [...(friends || [])].sort((a, b) => (last(b.id)?.created_at || "").localeCompare(last(a.id)?.created_at || ""));

  return (
    <div className={`chat ${username ? "has-convo" : ""}`}>
      <aside className="chat-list">
        <SocialTabs />
        {friends === null ? <div className="loading">Yükleniyor…</div> : sorted.length ? sorted.map((f) => {
          const m = last(f.id), n = unreadFrom(f.id);
          return (
            <Link key={f.id} href={`/chat/${f.username}`} className={`chat-friend ${f.username === username ? "active" : ""}`}>
              <Avatar p={f} />
              <div className="grow">
                <b><Name p={f} />{isSiteOwner(f.id) && <em className="owner-tag">Kurucu</em>}</b>
                <span>{m ? `${m.sender_id === me.id ? "Sen: " : ""}${excerptOf(m.body)}` : isSiteOwner(f.id) ? "Soru, sorun ya da şikayetin için yaz" : "Henüz mesaj yok"}</span>
              </div>
              {n > 0 && <span className="unread">{n}</span>}
            </Link>
          );
        }) : null}
        {friends && !friendIds.length && (
          <p className="muted small">Arkadaşlarınla mesajlaşmak için karşılıklı takipleşmeniz gerekiyor. <Link className="grad" href="/community">Topluluğa göz at</Link>, arkadaşlarını takip et; onlar da seni takip edince burada görünürler.</p>
        )}
      </aside>
      <section className="chat-main">
        {friend ? (
          <>
            <header className="chat-head">
              <Link href="/chat" className="icon-btn back" aria-label="Geri">←</Link>
              <Avatar p={friend} />
              <Link href={`/u/${friend.username}`}><b><Name p={friend} /></b> <span className="muted">@{friend.username}</span></Link>
              {isSiteOwner(friend.id) && <em className="owner-tag">Kurucu</em>}
              <span style={{ flex: 1 }} />
              <button className="report-link" onClick={() => report({ kind: "message", id: friend.id, user: friend.id,
                excerpt: convo.filter((m) => m.sender_id === friend.id).slice(-5).map((m) => m.body).join(" / ") || null,
                label: `@${friend.username} ile mesajlaşman. Haksız karar verilmesin diye sohbetinizin tamamı yönetime görünür.` })}>Raporla</button>
              <button className="report-link" onClick={() => toggleBlock(friend)}>{blocked.has(friend.id) ? "Engeli kaldır" : "Engelle"}</button>
            </header>
            <div className="msgs" ref={box}>
              {convo.length ? convo.map((m, i) => {
                const mine = m.sender_id === me.id;
                const showTime = i === convo.length - 1 || new Date(convo[i + 1].created_at).getTime() - new Date(m.created_at).getTime() > 600000;
                return (
                  <div key={m.id} id={`msg-${m.id}`} className={`bubble ${mine ? "me" : ""}`}>
                    {m.reply_to && (() => { const pm = convo.find((x) => x.id === m.reply_to); return <ReplyQuote parent={pm && { id: pm.id, body: pm.body }} name={pm && (pm.sender_id === me.id ? "Sen" : friend.display_name || friend.username)} />; })()}
                    <div className="bubble-body"><ChatBody text={m.body} /></div>
                    <div className="bubble-foot">
                      {showTime && <small>{timeAgo(m.created_at)}{mine && m.read_at ? " · görüldü" : ""}</small>}
                      <button type="button" className="link reply-btn" onClick={() => { setReply({ id: m.id, name: mine ? "Kendi mesajın" : friend.display_name || friend.username, body: m.body }); document.getElementById("chat-input")?.focus(); }}>Yanıtla</button>
                    </div>
                  </div>
                );
              }) : <p className="muted center">{isSiteOwner(friend.id) ? "Siteyle ilgili sorunu, sorunu ya da önerini yaz; en kısa sürede cevap verilir." : "İlk mesajı sen yaz"}</p>}
            </div>
            <div className="chat-compose">
              {reply && <ReplyingTo reply={reply} onCancel={() => setReply(null)} />}
              <DraftPhotos text={text} />
              <form className="chat-form" onSubmit={send}>
                <PhotoAdd onAdd={(url) => setText((t) => withPhoto(t, url))} />
                <input id="chat-input" value={text} maxLength={2000} autoFocus placeholder="Mesaj yaz…" onChange={(e) => setText(e.target.value)} />
                <button className="btn primary" disabled={sending || !text.trim()}>Gönder</button>
              </form>
            </div>
          </>
        ) : username && friends ? (
          <div className="empty">@{username} ile karşılıklı takipleşmiyorsunuz. Arkadaşlarınla ve site sahibiyle mesajlaşabilirsin.</div>
        ) : (
          <div className="empty">Soldan bir arkadaşını seç.</div>
        )}
      </section>
    </div>
  );
}
