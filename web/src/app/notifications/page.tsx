"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Entry, Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { friendsOnMyPlans } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { NOTIF_SEEN } from "@/components/Topbar";
import { Avatar, Name } from "@/components/ui";
import { excerptOf } from "@/components/ChatBody";

type Kind = "like" | "comment" | "follow" | "plan" | "reaction" | "pcomment" | "pcomment_reply" | "support" | "support_reply" | "unlinked" | "event_first" | "event";
interface Note { kind: Kind; at: string; who?: Partial<Profile> | null; entry?: { id: string; title: string }; body?: string; done?: boolean; link?: string; unread?: boolean }
interface DbNote { id: string; kind: Kind; body: string | null; link: string | null; created_at: string; read_at: string | null; actor: Partial<Profile> | null }
interface Row { created_at: string; profiles: Partial<Profile> | null; entries: { id: string; title: string }; body?: string }

// Süzgeç: birbirine yakın türler tek düğmede
const KINDS: [string, string, Kind[]][] = [["like", "Beğeniler", ["like"]], ["reaction", "Tepkiler", ["reaction"]], ["comment", "Yorumlar", ["comment", "pcomment", "pcomment_reply"]],
  ["follow", "Takipçiler", ["follow"]], ["plan", "Planladıkların", ["plan"]], ["team", "Ekip", ["support", "support_reply", "unlinked", "event_first", "event"]]];
const groupOf = (at: string) => {
  const days = (Date.now() - new Date(at).getTime()) / 864e5;
  return days < 1 ? "Bugün" : days < 7 ? "Bu hafta" : "Daha eski";
};

// Kayıtlarıma gelen beğeniler, yorumlar ve yeni takipçiler
export default function Notifications() {
  const { me, ready, version, notifAt, following, mine } = useApp();
  const [kind, setKind] = useState("");

  const { data, error } = useLoad(async () => {
    const db = sb();
    const id = me!.id;
    const [likes, comments, follows, plans] = await Promise.all([
      q<Row[]>(db.from("likes").select(`created_at, profiles(${PROFILE_COLS}), entries!inner(id, title, user_id)`)
        .eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(40)),
      q<Row[]>(db.from("comments").select(`created_at, body, profiles(${PROFILE_COLS}), entries!inner(id, title, user_id)`)
        .eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(40)),
      q<{ follower_id: string; created_at: string }[]>(db.from("follows").select("follower_id, created_at").eq("following_id", id)
        .order("created_at", { ascending: false }).limit(40)),
      friendsOnMyPlans([...following], mine).catch(() => [] as Entry[]),
    ]);
    // Veritabanının yazdığı bildirimler (tepki, profil yorumu, ekip sohbeti...); tablo yoksa boş
    const own = await q<DbNote[]>(db.from("notifications").select(`id, kind, body, link, created_at, read_at, actor:profiles!notifications_actor_id_fkey(${PROFILE_COLS})`)
      .eq("user_id", id).order("created_at", { ascending: false }).limit(60)).catch(() => [] as DbNote[]);
    const unread = own.filter((n) => !n.read_at).map((n) => n.id);
    if (unread.length) db.from("notifications").update({ read_at: new Date().toISOString() }).in("id", unread).then(() => {}, () => {});
    const people = follows.length ? await q<Profile[]>(db.from("profiles").select(PROFILE_COLS).in("id", follows.map((f) => f.follower_id))) : [];
    const notes: Note[] = [
      ...likes.map((l): Note => ({ kind: "like", at: l.created_at, who: l.profiles, entry: l.entries })),
      ...comments.map((c): Note => ({ kind: "comment", at: c.created_at, who: c.profiles, entry: c.entries, body: c.body })),
      ...follows.map((f): Note => ({ kind: "follow", at: f.created_at, who: people.find((p) => p.id === f.follower_id) })),
      ...plans.slice(0, 20).map((e): Note => ({ kind: "plan", at: e.updated_at, who: e.profiles, entry: { id: e.id, title: e.title }, done: e.status === "completed" })),
      ...own.map((n): Note => ({ kind: n.kind, at: n.created_at, who: n.actor, body: n.body || "", link: n.link || "/", unread: !n.read_at })),
    ];
    return notes.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  }, [me?.id, version, notifAt, mine.length], !!me);

  // Sayfa açılınca hepsini görülmüş say
  useEffect(() => {
    if (data) try { localStorage.setItem(NOTIF_SEEN, data[0]?.at || new Date().toISOString()); } catch { /* yok say */ }
  }, [data]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bildirimler için giriş yapmalısın.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;

  const group = KINDS.find(([k]) => k === kind)?.[2];
  const list = group ? data.filter((n) => group.includes(n.kind)) : data;
  // Satırın tamamı tıklanır: kayda ya da takip edenin profiline gider
  const hrefOf = (n: Note) => n.link ? n.link : n.kind === "follow" ? `/u/${n.who?.username}`
    : `/u/${n.kind === "plan" ? n.who?.username : me.username}?entry=${n.entry!.id}`;

  return (
    <section className="notes">
      <h1>Bildirimler</h1>
      {data.length > 0 && (
        <div className="chips">
          <button className={`chip ${!kind ? "active" : ""}`} onClick={() => setKind("")}>Hepsi</button>
          {KINDS.filter(([, , ks]) => data.some((n) => ks.includes(n.kind))).map(([k, label]) => (
            <button key={k} className={`chip ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>{label}</button>
          ))}
        </div>
      )}
      {list.length ? list.map((n, i) => (
        <div key={i} className="note-wrap">
          {(i === 0 || groupOf(list[i - 1].at) !== groupOf(n.at)) && <h2 className="note-group">{groupOf(n.at)}</h2>}
          <Link className={`note-row ${n.unread ? "fresh" : ""}`} href={hrefOf(n)}>
            {n.who ? <Avatar p={n.who} /> : <span className="avatar team-avatar" aria-hidden="true">A</span>}
            <div className="grow">
              {n.who ? <b><Name p={n.who} /></b> : <b>Ancalog</b>}{" "}
              {n.kind === "like" && <>kaydını beğendi: <span className="grad">{n.entry!.title}</span> ♥</>}
              {n.kind === "comment" && <>yorum yaptı: <span className="grad">{n.entry!.title}</span>
                <p className="note-body">“{n.body}”</p></>}
              {n.kind === "follow" && <>seni takip etmeye başladı </>}
              {n.kind === "plan" && <>{n.done ? "bitirdi" : "başladı"}, sen de planlamıştın: <span className="grad">{n.entry!.title}</span></>}
              {n.kind === "reaction" && <>yazına tepki verdi: <span className="grad">{n.body!.split(" ")[0]}</span><p className="note-body">“{excerptOf(n.body!.slice(n.body!.indexOf(" ") + 1))}”</p></>}
              {n.kind === "pcomment" && <>profiline yorum yazdı<p className="note-body">“{excerptOf(n.body!)}”</p></>}
              {n.kind === "pcomment_reply" && <>profil yorumuna yanıt verdi<p className="note-body">“{excerptOf(n.body!)}”</p></>}
              {n.kind === "support" && <>ekibe yazdı <span className="ann-tag">Ekip</span><p className="note-body">“{excerptOf(n.body!)}”</p></>}
              {n.kind === "support_reply" && <>Ancalog ekibi adına cevap verdi<p className="note-body">“{excerptOf(n.body!)}”</p></>}
              {n.kind === "unlinked" && <>bir sayfaya bağlı olmayan oyun ekledi: <span className="grad">{n.body}</span> <span className="ann-tag">Ekip</span></>}
              {(n.kind === "event_first" || n.kind === "event") && <>{n.body}</>}
              <div className="muted small">{timeAgo(n.at)}</div>
            </div>
          </Link>
        </div>
      )) : <div className="empty">Henüz bildirim yok. Biri kaydını beğenince, yorum yapınca ya da seni takip edince burada görürsün.</div>}
    </section>
  );
}
