"use client";

import { useState } from "react";
import Link from "next/link";
import type { EntryType, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { scoreOf } from "@/lib/compat";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar, Name } from "./ui";

interface Row { user_id: string; type: EntryType; common: number; rated: number; diff_sum: number; total: number }

// Sitede sana en uyumlu üyeler: genel uyum ve türe göre (oyun, film...). Sayılar sunucuda, yüzde profildeki Uyum ile aynı hesapla.
export function BestMatches() {
  const { me, mine, version } = useApp();
  const [kind, setKind] = useState<EntryType | "all">("all");
  const { data } = useLoad(async () => {
    const rows = await q<Row[]>(sb().rpc("compat_stats", { p_user: me!.id })).catch(() => null);
    if (!rows?.length) return null;
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const people = await q<Profile[]>(sb().from("profiles").select("*").in("id", ids.slice(0, 500)));
    return { rows, people: new Map(people.map((p) => [p.id, p])) };
  }, [me?.id, version], !!me);

  if (!me || !data) return null;
  const myN = (t: EntryType | "all") => (t === "all" ? mine.length : mine.filter((e) => e.type === t).length);
  const byUser = new Map<string, Row[]>();
  for (const r of data.rows) byUser.set(r.user_id, [...(byUser.get(r.user_id) || []), r]);
  const ranked = [...byUser].map(([id, rs]) => {
    const pick = kind === "all" ? rs : rs.filter((r) => r.type === kind);
    const sum = (f: (r: Row) => number) => pick.reduce((s, r) => s + f(r), 0);
    const their = sum((r) => r.total); // genelde karşı tarafın bütün kayıtları, türde o türünkiler
    return { p: data.people.get(id), common: sum((r) => r.common), score: scoreOf(sum((r) => r.common), sum((r) => r.rated), sum((r) => Number(r.diff_sum)), myN(kind), their) };
  }).filter((x) => x.p && x.score !== null && x.common >= (kind === "all" ? 2 : 1)).sort((a, b) => b.score! - a.score! || b.common - a.common).slice(0, 10);
  const kinds = TYPE_KEYS.filter((t) => data.rows.some((r) => r.type === t && r.common > 0));

  return (
    <section className="section">
      <div className="section-head">
        <h2>Sana en uyumlu üyeler</h2>
        {kinds.length > 1 && (
          <div className="mini-tabs">
            <button className={kind === "all" ? "active" : ""} onClick={() => setKind("all")}>Genel</button>
            {kinds.map((t) => <button key={t} className={kind === t ? "active" : ""} onClick={() => setKind(t)}>{TYPES[t].label}</button>)}
          </div>
        )}
      </div>
      {ranked.length ? (
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
      ) : <div className="muted">Bu türde henüz yeterince ortak içeriğin olan kimse yok.</div>}
    </section>
  );
}
