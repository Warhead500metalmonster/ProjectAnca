"use client";

import { useState } from "react";
import Link from "next/link";
import type { EntryType, ProfileLite } from "@/lib/types";
import { PROFILE_COLS, TYPES, TYPE_KEYS } from "@/lib/constants";
import { num } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar, Name } from "./ui";

type Metric = "entries" | "completed" | "hours";
const METRICS: [Metric, string][] = [["completed", "En çok bitiren"], ["entries", "En çok kayıt"], ["hours", "En çok süre"]];
const STEP = 10;

// Kişi sıralamaları: kim kaç kayıt girdi, kaç şey bitirdi, kaç saat harcadı; genel ya da türe göre.
// Sadece profili herkese açık olanlar ve gizlemedikleri türler sayılır (veritabanı öyle hesaplar).
export function Leaderboard() {
  const { me, version } = useApp();
  const [metric, setMetric] = useState<Metric>("completed");
  const [kind, setKind] = useState<EntryType | "all">("all");
  const [thisYear, setThisYear] = useState(false);
  const [shown, setShown] = useState(STEP);
  const year = new Date().getFullYear();

  const { data, error } = useLoad(async () => {
    const rows = await q<{ user_id: string; n: number }[]>(sb().rpc("leaderboard", {
      p_type: kind === "all" ? null : kind, p_metric: metric, p_year: thisYear ? year : null, p_limit: 100,
    }));
    const people = rows.length ? await q<ProfileLite[]>(sb().from("profiles").select(PROFILE_COLS).in("id", rows.map((r) => r.user_id))) : [];
    const by = new Map(people.map((p) => [p.id, p]));
    return rows.filter((r) => by.has(r.user_id)).map((r) => ({ p: by.get(r.user_id)!, n: Number(r.n) }));
  }, [metric, kind, thisYear, version], supabaseConfigured());

  const unit = metric === "hours" ? " sa" : "";
  const myRank = data ? data.findIndex((r) => r.p.id === me?.id) : -1;
  const reset = () => setShown(STEP);

  return (
    <section className="section">
      <div className="lb-bar">
        <div className="mini-tabs">
          {METRICS.map(([k, label]) => <button key={k} className={metric === k ? "active" : ""} onClick={() => { setMetric(k); reset(); }}>{label}</button>)}
        </div>
        <div className="mini-tabs">
          <button className={!thisYear ? "active" : ""} onClick={() => { setThisYear(false); reset(); }}>Tüm zamanlar</button>
          <button className={thisYear ? "active" : ""} onClick={() => { setThisYear(true); reset(); }}>{year}</button>
        </div>
      </div>
      <div className="chips" style={{ marginBottom: 14 }}>
        {(["all", ...TYPE_KEYS] as (EntryType | "all")[]).map((t) => (
          <button key={t} className={`chip ${kind === t ? "active" : ""}`} onClick={() => { setKind(t); reset(); }}>{t === "all" ? "Genel" : TYPES[t].plural}</button>
        ))}
      </div>
      {error ? <div className="empty">Sıralama şu an yüklenemedi. Biraz sonra tekrar dener misin?</div>
        : !data ? <div className="loading">Yükleniyor…</div>
        : !data.length ? <div className="empty">Burada henüz kimse yok. İlk sıra boş, kapmak sana kalmış!</div>
        : (
          <>
            {myRank >= shown && <p className="lb-me">Sen <b>{myRank + 1}.</b> sıradasın · {num(data[myRank].n)}{unit}</p>}
            <ol className="lb-list">
              {data.slice(0, shown).map((r, i) => (
                <li key={r.p.id} className={`${i < 3 ? `top${i + 1}` : ""} ${r.p.id === me?.id ? "me" : ""}`}>
                  <Link href={`/u/${r.p.username}`}>
                    <span className="lb-rank">{i + 1}</span>
                    <Avatar p={r.p} />
                    <span className="lb-who"><b><Name p={r.p} /></b><small>@{r.p.username}</small></span>
                    <span className="lb-n">{num(r.n)}{unit}</span>
                  </Link>
                </li>
              ))}
            </ol>
            {shown < data.length && <button className="feed-more" onClick={() => setShown((n) => n + STEP * 2)}>Daha fazla göster ({data.length - shown})</button>}
            <p className="muted small lb-note">Sadece profili herkese açık olan üyeler görünür. Görünmek istemezsen profilini <Link className="grad" href="/settings#gizlilik">gizleyebilirsin</Link>.</p>
          </>
        )}
    </section>
  );
}
