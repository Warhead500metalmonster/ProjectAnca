"use client";

import { useState } from "react";
import Link from "next/link";
import type { Item } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { anilist, tmdb, tmdbImage } from "@/lib/data";
import { contentHref } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Cover } from "@/components/ui";

// "İzle": film, dizi ve anime tek paket. Arayıp tek tek eklemek yerine gezip + ile eklenir.
type Kind = "movie" | "show" | "anime";
interface TmdbHit { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null }
interface Row { title: string; kind: Kind; load: () => Promise<Item[]> }

const fromTmdb = (kind: "movie" | "tv") => (r: { results?: TmdbHit[] }): Item[] =>
  (r.results || []).filter((h) => h.poster_path).slice(0, 20).map((h) => ({
    type: kind === "movie" ? "movie" : "show", title: h.title || h.name || "", creator: null, rawg_id: null,
    year: parseInt(h.release_date || h.first_air_date || "") || null, cover: tmdbImage(h.poster_path), ext_id: `tmdb:${kind}:${h.id}`,
  }));

const animeRow = (sort: string) => async (): Promise<Item[]> => {
  const d = await anilist<{ Page: { media: { id: number; title: { romaji?: string; english?: string }; startDate?: { year?: number }; coverImage?: { large?: string }; studios?: { nodes: { name: string }[] } }[] } }>(
    `query ($sort: [MediaSort]) { Page(perPage: 20) { media(type: ANIME, sort: $sort, isAdult: false) {
      id title { romaji english } startDate { year } coverImage { large } studios(isMain: true) { nodes { name } } } } }`, { sort: [sort] });
  return d.Page.media.map((m) => ({
    type: "anime" as const, title: m.title.english || m.title.romaji || "", year: m.startDate?.year || null, creator: m.studios?.nodes[0]?.name || null,
    cover: m.coverImage?.large || null, rawg_id: null, ext_id: `anilist:${m.id}`,
  }));
};

const ROWS: Row[] = [
  { title: "Trend filmler", kind: "movie", load: () => tmdb<{ results?: TmdbHit[] }>("trending/movie/week").then(fromTmdb("movie")) },
  { title: "Trend diziler", kind: "show", load: () => tmdb<{ results?: TmdbHit[] }>("trending/tv/week").then(fromTmdb("tv")) },
  { title: "Trend animeler", kind: "anime", load: animeRow("TRENDING_DESC") },
  { title: "En yüksek puanlı filmler", kind: "movie", load: () => tmdb<{ results?: TmdbHit[] }>("discover/movie", { sort_by: "vote_average.desc", "vote_count.gte": 3000 }).then(fromTmdb("movie")) },
  { title: "En yüksek puanlı diziler", kind: "show", load: () => tmdb<{ results?: TmdbHit[] }>("discover/tv", { sort_by: "vote_average.desc", "vote_count.gte": 1500 }).then(fromTmdb("tv")) },
  { title: "En yüksek puanlı animeler", kind: "anime", load: animeRow("SCORE_DESC") },
];

const FILTERS: [Kind | "all", string][] = [["all", "Hepsi"], ["movie", "Film"], ["show", "Dizi"], ["anime", "Anime"]];

export default function WatchPage() {
  const [kind, setKind] = useState<Kind | "all">("all");
  return (
    <>
      <section className="search-hero">
        <h1>İzle</h1>
        <p className="muted" style={{ margin: 0 }}>Film, dizi ve anime tek yerde. Gez, beğendiğine + ile ekle.</p>
        <div className="chips">
          {FILTERS.map(([k, label]) => <button key={k} className={`chip ${kind === k ? "active" : ""}`} onClick={() => setKind(k)}>{label}</button>)}
        </div>
      </section>
      {ROWS.filter((r) => kind === "all" || r.kind === kind).map((r) => <WatchRow key={r.title} row={r} />)}
      <p className="muted" style={{ fontSize: 12, marginTop: 24 }}>
        Veriler: <a href="https://www.themoviedb.org" target="_blank" rel="noopener">TMDB</a> ve <a href="https://anilist.co" target="_blank" rel="noopener">AniList</a>
      </p>
    </>
  );
}

function WatchRow({ row }: { row: Row }) {
  const { data, error } = useLoad(row.load, []);
  if (error) return null; // anahtar yoksa ya da kaynak çalışmıyorsa satır hiç görünmez
  return (
    <section className="section watch-row">
      <div className="section-head"><h2>{row.title}</h2><Link href={`/search?type=${row.kind}`}>Tümü →</Link></div>
      <div className="wstrip">
        {data ? data.map((it) => <WatchCard key={it.ext_id} item={it} />) : Array.from({ length: 8 }, (_, i) => <div className="wcard sk" key={i}><div className="wposter" /></div>)}
      </div>
    </section>
  );
}

function WatchCard({ item }: { item: Item }) {
  const { openForm } = useApp();
  return (
    <div className="wcard">
      <Link href={contentHref(item)} className="wposter">
        <span className="ph">{TYPES[item.type].label}</span><Cover src={item.cover} />
      </Link>
      <button className="qadd" title="Kütüphaneme ekle" aria-label={`${item.title} ekle`} onClick={() => openForm(null, { item })}>+</button>
      <Link href={contentHref(item)} className="wtitle">{item.title}</Link>
      {item.year && <span className="wmeta">{item.year}</span>}
    </div>
  );
}
