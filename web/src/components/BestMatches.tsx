"use client";

import { useState } from "react";
import Link from "next/link";
import type { EntryType, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { scoreOf } from "@/lib/compat";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar, Name } from "./ui";

interface Row { user_id: string; type: EntryType; common: number; rated: number; diff_sum: number; total: number }
interface Pair { a: string; b: string; score: number; common: number }

// Uyum sıralaması: sitenin en uyumlu ikilileri ya da sana en uyumlu üyeler; genel ve türe göre (oyun, film...).
// Yüzdeler profildeki Uyum ile aynı hesapla, sayılar sunucuda çıkarılır.
export function BestMatches() {
  const { me } = useApp();
  const [scope, setScope] = useState<"site" | "me">("site");
  const [kind, setKind] = useState<EntryType | "all">("all");
  return (
    <section className="section">
      <div className="section-head">
        <h2>Uyum sıralaması</h2>
        {me && (
          <div className="mini-tabs">
            <button className={scope === "site" ? "active" : ""} onClick={() => setScope("site")}>Sitenin en uyumluları</button>
            <button className={scope === "me" ? "active" : ""} onClick={() => setScope("me")}>Bana en uyumlular</button>
          </div>
        )}
      </div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {(["all", ...TYPE_KEYS] as (EntryType | "all")[]).map((t) => (
          <button key={t} className={`chip ${kind === t ? "active" : ""}`} onClick={() => setKind(t)}>{t === "all" ? "Genel" : TYPES[t].label}</button>
        ))}
      </div>
      {scope === "me" && me ? <MineList kind={kind} /> : <SiteList kind={kind} />}
    </section>
  );
}

function SiteList({ kind }: { kind: EntryType | "all" }) {
  const { version } = useApp();
  const { data, error } = useLoad(async () => {
    const pairs = await q<Pair[]>(sb().rpc("compat_leaderboard", { p_type: kind === "all" ? null : kind, p_limit: 15 }));
    const ids = [...new Set(pairs.flatMap((p) => [p.a, p.b]))];
    const people = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids)) : [];
    const by = new Map(people.map((p) => [p.id, p]));
    return pairs.filter((p) => by.has(p.a) && by.has(p.b)).map((p) => ({ ...p, pa: by.get(p.a)!, pb: by.get(p.b)! }));
  }, [kind, version], supabaseConfigured());

  if (error) return <div className="muted">Uyum sıralaması şu an yüklenemedi.</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  if (!data.length) return <div className="muted">Bu türde henüz en az 3 ortak içeriği olan iki üye yok.</div>;
  return (
    <div className="match-list">
      {data.map((p, i) => (
        <div key={p.a + p.b} className="match-row pair">
          <span className="rank">{i + 1}</span>
          <span className="duo"><Avatar p={p.pa} /><Avatar p={p.pb} /></span>
          <span className="who">
            <b><Link href={`/u/${p.pa.username}`}><Name p={p.pa} /></Link> &amp; <Link href={`/u/${p.pb.username}`}><Name p={p.pb} /></Link></b>
            <small>{p.common} ortak içerik</small>
          </span>
          <span className="pct">%{p.score}</span>
        </div>
      ))}
    </div>
  );
}

function MineList({ kind }: { kind: EntryType | "all" }) {
  const { me, mine, version } = useApp();
  const { data, error } = useLoad(async () => {
    const rows = await q<Row[]>(sb().rpc("compat_stats", { p_user: me!.id }));
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const people = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids.slice(0, 500))) : [];
    return { rows, people: new Map(people.map((p) => [p.id, p])) };
  }, [me?.id, version], !!me);

  if (error) return <div className="muted">Uyum şu an hesaplanamadı.</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const myN = kind === "all" ? mine.length : mine.filter((e) => e.type === kind).length;
  const byUser = new Map<string, Row[]>();
  for (const r of data.rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
  const ranked = [...byUser].map(([id, rs]) => {
    const pick = kind === "all" ? rs : rs.filter((r) => r.type === kind);
    const sum = (f: (r: Row) => number) => pick.reduce((s, r) => s + f(r), 0);
    // genelde karşı tarafın bütün kayıtları, türde o türünkiler
    return { p: data.people.get(id), common: sum((r) => r.common), score: scoreOf(sum((r) => r.common), sum((r) => r.rated), sum((r) => Number(r.diff_sum)), myN, sum((r) => r.total)) };
  }).filter((x) => x.p && x.score !== null && x.common >= (kind === "all" ? 2 : 1)).sort((a, b) => b.score! - a.score! || b.common - a.common).slice(0, 10);

  if (!ranked.length) return <div className="muted">Bu türde henüz seninle yeterince ortak içeriği olan kimse yok.</div>;
  return (
    <div className="match-list">
      {ranked.map(({ p, score, common }, i) => (
        <Link key={p!.id} className="match-row" href={`/u/${p!.username}/compare`}>
          <span className="rank">{i + 1}</span>
          <Avatar p={p!} />
          <span className="who"><b><Name p={p!} /></b><small>@{p!.username} · {common} ortak</small></span>
          <span className="pct">%{score}</span>
        </Link>
      ))}
    </div>
  );
}
