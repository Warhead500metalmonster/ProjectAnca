"use client";

import { useEffect } from "react";
import Link from "next/link";
import type { Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { timeAgo } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { NOTIF_SEEN } from "@/components/Topbar";
import { Avatar, Name } from "@/components/ui";

interface Note { kind: "like" | "comment" | "follow"; at: string; who?: Partial<Profile> | null; entry?: { id: string; title: string }; body?: string }
interface Row { created_at: string; profiles: Partial<Profile> | null; entries: { id: string; title: string }; body?: string }

// Kayıtlarıma gelen beğeniler, yorumlar ve yeni takipçiler
export default function Notifications() {
  const { me, ready, version, notifAt } = useApp();

  const { data, error } = useLoad(async () => {
    const db = sb();
    const id = me!.id;
    const [likes, comments, follows] = await Promise.all([
      q<Row[]>(db.from("likes").select(`created_at, profiles(${PROFILE_COLS}), entries!inner(id, title, user_id)`)
        .eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(40)),
      q<Row[]>(db.from("comments").select(`created_at, body, profiles(${PROFILE_COLS}), entries!inner(id, title, user_id)`)
        .eq("entries.user_id", id).neq("user_id", id).order("created_at", { ascending: false }).limit(40)),
      q<{ follower_id: string; created_at: string }[]>(db.from("follows").select("follower_id, created_at").eq("following_id", id)
        .order("created_at", { ascending: false }).limit(40)),
    ]);
    const people = follows.length ? await q<Profile[]>(db.from("profiles").select(PROFILE_COLS).in("id", follows.map((f) => f.follower_id))) : [];
    const notes: Note[] = [
      ...likes.map((l): Note => ({ kind: "like", at: l.created_at, who: l.profiles, entry: l.entries })),
      ...comments.map((c): Note => ({ kind: "comment", at: c.created_at, who: c.profiles, entry: c.entries, body: c.body })),
      ...follows.map((f): Note => ({ kind: "follow", at: f.created_at, who: people.find((p) => p.id === f.follower_id) })),
    ];
    return notes.sort((a, b) => b.at.localeCompare(a.at)).slice(0, 60);
  }, [me?.id, version, notifAt], !!me);

  // Sayfa açılınca hepsini görülmüş say
  useEffect(() => {
    if (data) try { localStorage.setItem(NOTIF_SEEN, data[0]?.at || new Date().toISOString()); } catch { /* yok say */ }
  }, [data]);

  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bildirimler için giriş yapmalısın.<br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;

  return (
    <section className="notes">
      <h1>🔔 Bildirimler</h1>
      {data.length ? data.map((n, i) => (
        <div key={i} className="note-row">
          <Link href={`/u/${n.who?.username}`}><Avatar p={n.who} /></Link>
          <div className="grow">
            <Link href={`/u/${n.who?.username}`}><b><Name p={n.who} /></b></Link>{" "}
            {n.kind === "like" && <>kaydını beğendi: <Link className="grad" href={`/u/${me.username}?entry=${n.entry!.id}`}>{n.entry!.title}</Link> ♥</>}
            {n.kind === "comment" && <>yorum yaptı: <Link className="grad" href={`/u/${me.username}?entry=${n.entry!.id}`}>{n.entry!.title}</Link>
              <p className="note-body">“{n.body}”</p></>}
            {n.kind === "follow" && <>seni takip etmeye başladı 👋</>}
            <div className="muted small">{timeAgo(n.at)}</div>
          </div>
        </div>
      )) : <div className="empty">Henüz bildirim yok. Biri kaydını beğenince, yorum yapınca ya da seni takip edince burada görürsün.</div>}
    </section>
  );
}
