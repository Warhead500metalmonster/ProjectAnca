"use client";

import { useState } from "react";
import type { Entry } from "@/lib/types";
import { Eps, countEps, markSeason, nextEp, saveEpisodes, seasonCounts, toggleEp } from "@/lib/episodes";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";

// Dizi ve animede bölüm bölüm ilerleme. Sahibi işaretler, diğerleri sadece görür.
export function EpisodeTracker({ e, mine }: { e: Entry; mine: boolean }) {
  const { toast, refresh } = useApp();
  const [eps, setEps] = useState<Eps>(e.episodes || {});
  const [status, setStatus] = useState(e.status);
  const { data: counts } = useLoad(() => seasonCounts(e), [e.id]);
  const total = counts ? Object.values(counts).reduce((a, b) => a + b, 0) : null;
  const done = countEps(eps);
  if (!mine && !done) return null;
  const [ns, ne] = nextEp(eps);
  const seasons = counts ? Object.entries(counts) : [];

  async function change(next: Eps) {
    const prev = eps;
    setEps(next);
    try {
      setStatus(await saveEpisodes({ id: e.id, status, date: e.date }, next, total));
      refresh();
    } catch (err) {
      setEps(prev);
      toast("Kaydedilemedi: " + (err as Error).message);
    }
  }

  const grid = (s: string, n: number) => (
    <>
      <div className="eps-grid">
        {Array.from({ length: n }, (_, i) => i + 1).map((k) => (
          <button key={k} type="button" className={(eps[s] || []).includes(k) ? "on" : ""} disabled={!mine} title={`Sezon ${s}, bölüm ${k}`}
            onClick={() => change(toggleEp(eps, Number(s), k))}>{k}</button>
        ))}
      </div>
      {mine && (eps[s] || []).length < n && <button type="button" className="link" onClick={() => change(markSeason(eps, Number(s), n))}>{seasons.length > 1 ? "Sezonu işaretle" : "Hepsini işaretle"}</button>}
    </>
  );

  return (
    <div className="eps">
      <div className="eps-head"><b>Bölümler</b><span>{done}{total ? ` / ${total}` : ""} bölüm</span></div>
      {total ? <div className="eps-bar"><i style={{ width: `${Math.min(100, (done / total) * 100)}%` }} /></div> : null}
      {mine && (!total || done < total) && (
        <button type="button" className="btn" onClick={() => change(toggleEp(eps, ns, ne, true))}>Sıradaki bölümü izledim · S{ns} B{ne}</button>
      )}
      {seasons.length === 1 && grid(seasons[0][0], seasons[0][1])}
      {seasons.length > 1 && seasons.map(([s, n]) => (
        <details key={s} className="eps-season" open={Number(s) === ns}>
          <summary>Sezon {s} <small>{(eps[s] || []).length}/{n}</small></summary>
          {grid(s, n)}
        </details>
      ))}
      {!counts && done > 0 && <p className="muted small">Bölüm listesi alınamadı, sadece izlediklerin sayılıyor.</p>}
    </div>
  );
}
