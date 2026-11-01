/* eslint-disable @next/next/no-img-element */
"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Status } from "@/lib/types";
import { statusLabel } from "@/lib/constants";
import { rawg } from "@/lib/rawg";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";

interface SeriesGame { id: number; name: string; year: number; cover: string | null; upcoming: boolean; ids: number[] }

// Oyun sayfasında: oyunun serisi ve kişinin serideki ilerlemesi. Remaster ya da remake bitirmek ana oyunu bitirmiş sayılır.
export function GameSeries({ id }: { id: number }) {
  const { me, mine } = useApp();
  const { data } = useLoad(() => rawg<{ name: string; results: SeriesGame[] }>(`games/${id}/series`).catch(() => null), [id]);
  // Aynı oyunun birkaç logu varsa bitmiş olan sayılır
  const myStatus = useMemo(() => {
    const m = new Map<number, Status>();
    for (const e of mine) if (e.rawg_id != null && (e.status === "completed" || !m.has(e.rawg_id))) m.set(e.rawg_id, e.status);
    return m;
  }, [mine]);
  if (!data?.results?.length) return null;

  const statusOf = (g: SeriesGame): Status | null => {
    const found = g.ids.map((x) => myStatus.get(x)).filter((x) => x !== undefined);
    return found.find((x) => x === "completed") ?? found[0] ?? null;
  };
  const released = data.results.filter((g) => !g.upcoming);
  const done = released.filter((g) => statusOf(g) === "completed").length;
  const next = done ? released.find((g) => statusOf(g) !== "completed") : null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>{data.name} serisi</h2>
        {me && done > 0 && <span className="muted">{done}/{released.length} bitirdin</span>}
      </div>
      {me && done > 0 && (
        <p className="muted small series-next">
          {next ? <>Sıradaki: <Link className="flink" href={`/game/${next.id}`}>{next.name}</Link></> : "Seriyi tamamladın."}
        </p>
      )}
      <div className="strip">
        {data.results.map((g) => {
          const status = me ? statusOf(g) : null;
          return (
            <Link key={g.id} className="card-link" href={`/game/${g.id}`} aria-current={g.ids.includes(id) ? "page" : undefined}>
              <div className="poster">
                <div className="ph">Oyun</div>
                {g.cover && <img src={g.cover} alt="" loading="lazy" decoding="async" />}
                {status ? <span className={`st pill ${status}`}>{statusLabel(status, "game")}</span>
                  : g.upcoming ? <span className="st pill">Çıkacak</span> : null}
              </div>
              <div className="card-title">{g.name}</div>
              <div className="card-meta">{g.year}</div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
