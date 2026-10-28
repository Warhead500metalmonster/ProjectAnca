"use client";

import { useState } from "react";
import Link from "next/link";
import type { EntryType } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { avgText, contentHref } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Cover } from "@/components/ui";

interface Ranked { type: EntryType; title: string; year: number | null; creator: string | null; cover: string | null; rawg_id: number | null; ext_id: string | null; avg: number; votes: number }

const fetchRanked = (type: EntryType, min: number, asc: boolean, limit: number) =>
  q<Ranked[]>(sb().rpc("ranked_content", { p_type: type, p_min: min, p_asc: asc, p_limit: limit }));

// Ancalog sıralaması: üyelerin verdiği puanların ortalamasına göre en yüksek ve en düşük içerikler
export default function TopPage() {
  const { scale } = useApp();
  const [type, setType] = useState<EntryType>("game");
  const [asc, setAsc] = useState(false);
  const [min, setMin] = useState(2);
  const { data, error } = useLoad(() => fetchRanked(type, min, asc, 100), [type, asc, min], supabaseConfigured());

  return (
    <>
      <section className="search-hero">
        <h1>Ancalog sıralaması</h1>
        <p className="muted" style={{ margin: 0 }}>Üyelerin verdiği puanların ortalamasına göre. Az kişinin puanladığı içerikler yanıltmasın diye en az oy sayısını seçebilirsin.</p>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TYPE_KEYS.map((t) => <button key={t} className={`tab ${type === t ? "active" : ""}`} onClick={() => setType(t)}>{TYPES[t].plural}</button>)}
        </div>
      </section>
      <section className="section">
        <div className="rank-bar">
          <div className="mini-tabs">
            <button className={!asc ? "active" : ""} onClick={() => setAsc(false)}>En yüksek puanlılar</button>
            <button className={asc ? "active" : ""} onClick={() => setAsc(true)}>En düşük puanlılar</button>
          </div>
          <label className="muted small">En az
            <select value={min} onChange={(e) => setMin(Number(e.target.value))}>
              {[1, 2, 3, 5, 10].map((n) => <option key={n} value={n}>{n} oy</option>)}
            </select>
          </label>
        </div>
        {error ? <div className="empty">Sıralama şu an yüklenemedi.</div>
          : !data ? <div className="loading">Yükleniyor…</div>
          : !data.length ? <div className="empty">Bu türde en az {min} kişinin puanladığı içerik henüz yok. En az oy sayısını düşürmeyi dene.</div>
          : (
            <ol className="rank-list">
              {data.map((r, i) => (
                <li key={`${r.rawg_id}|${r.ext_id}|${r.title}`}>
                  <Link href={contentHref(r)}>
                    <span className="rank">{i + 1}</span>
                    <span className={`poster ${TYPES[r.type].square ? "square" : ""}`}><span className="ph">{TYPES[r.type].label}</span><Cover src={r.cover} /></span>
                    <span className="who"><b>{r.title}</b><small>{[r.creator, r.year].filter(Boolean).join(" · ")}</small></span>
                    <span className="score"><b>★ {avgText(Number(r.avg), scale)}</b><small>{r.votes} oy</small></span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
      </section>
    </>
  );
}
