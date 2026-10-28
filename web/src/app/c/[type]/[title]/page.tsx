/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Entry, EntryType, Item, PageEdit } from "@/lib/types";
import { ENTRY_COLS, TYPES, statusLabel } from "@/lib/constants";
import { avgText, contentKey, cssUrl, fmtDur, likeEsc, num, playSec, safeUrl, scoreText } from "@/lib/format";
import { aniDetail, fetchPageEdit, tmdbCreator, tmdbDetail, tmdbImage } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Feed } from "@/components/ui";
import { Lightbox } from "@/components/Lightbox";
import { PageEditor } from "@/components/PageEditor";

interface Info { title?: string; year?: number | null; creator?: string | null; cover?: string | null; backdrop?: string | null;
  overview?: string; genres?: string[]; facts: [string, string][]; score?: [string, string] }

// Dış kaynaktan (TMDB / AniList) içerik bilgisi
async function loadInfo(extId: string): Promise<Info | null> {
  if (extId.startsWith("tmdb:")) {
    const d = await tmdbDetail(extId);
    const runtime = d.runtime || d.episode_run_time?.[0];
    return {
      title: d.title || d.name, year: parseInt(d.release_date || d.first_air_date || "") || null, creator: tmdbCreator(d),
      cover: tmdbImage(d.poster_path), backdrop: tmdbImage(d.backdrop_path, "w1280"), overview: d.tagline ? `${d.tagline}\n\n${d.overview || ""}` : d.overview,
      genres: (d.genres || []).map((g) => g.name),
      facts: ([
        ["Yönetmen / Yaratıcı", tmdbCreator(d) || ""],
        ["Oyuncular", (d.credits?.cast || []).slice(0, 5).map((c) => c.name).join("\n")],
        ["Süre", runtime ? `${runtime} dk${d.episode_run_time ? " (bölüm)" : ""}` : ""],
        ["Sezon / bölüm", d.number_of_seasons ? `${d.number_of_seasons} sezon · ${d.number_of_episodes} bölüm` : ""],
        ["Kanal", (d.networks || []).map((n) => n.name).join(", ")],
      ] as [string, string][]).filter(([, v]) => v),
      score: d.vote_average ? [num(d.vote_average), "TMDB"] : undefined,
    };
  }
  if (extId.startsWith("anilist:")) {
    const m = await aniDetail(extId);
    return {
      title: m.title.english || m.title.romaji, year: m.startDate?.year || null, creator: m.studios?.nodes[0]?.name || null,
      cover: m.coverImage?.extraLarge || null, backdrop: m.bannerImage || null,
      overview: (m.description || "").replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, ""),
      genres: m.genres || [],
      facts: ([
        ["Orijinal adı", [m.title.native, m.title.romaji].filter(Boolean).join("\n")],
        ["Stüdyo", m.studios?.nodes.map((s) => s.name).join(", ") || ""],
        ["Bölüm", m.episodes ? `${m.episodes} bölüm${m.duration ? ` · ${m.duration} dk` : ""}` : ""],
        ["Format", m.format || ""],
      ] as [string, string][]).filter(([, v]) => v),
      score: m.averageScore ? [`${m.averageScore}`, "AniList /100"] : undefined,
    };
  }
  return null;
}

export default function ContentPage() {
  const params = useParams<{ type: string; title: string }>();
  const search = useSearchParams();
  const type = params.type as EntryType;
  const title = decodeURIComponent(params.title);
  const { me, version, openForm, pickList, scale, isAdmin } = useApp();
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [editing, setEditing] = useState(false);
  const editKey = contentKey({ type, title, rawg_id: null });

  const { data, error } = useLoad(async () => {
    const ext = search.get("ext");
    // Aynı içerik farklı isimle loglanmış olabilir: isme ve dış kaynak kimliğine göre ara, birleştir
    const [byTitle, byExt, edit] = await Promise.all([
      q<Entry[]>(sb().from("entries").select(ENTRY_COLS).eq("type", type).ilike("title", likeEsc(title)).order("updated_at", { ascending: false }).limit(200)),
      ext ? q<Entry[]>(sb().from("entries").select(ENTRY_COLS).eq("ext_id", ext).order("updated_at", { ascending: false }).limit(200)) : Promise.resolve([]),
      fetchPageEdit(editKey),
    ]);
    const logs = [...new Map([...byTitle, ...byExt].map((l) => [l.id, l])).values()].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    const extId = ext || logs.find((l) => l.ext_id)?.ext_id || null;
    const info = extId ? await loadInfo(extId).catch(() => null) : null;
    return { logs, info, extId, edit };
  }, [type, title, version, search.get("ext")], supabaseConfigured() && type in TYPES);

  if (!(type in TYPES)) return <div className="empty">Böyle bir tür yok.</div>;
  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;

  const { logs, info, extId, edit } = data;
  const t = TYPES[type];
  const ref = logs.find((l) => safeUrl(l.cover)) || logs[0];
  const source: PageEdit = {
    title, creator: info?.creator || ref?.creator || undefined, year: info?.year || ref?.year || undefined,
    cover: safeUrl(info?.cover) || safeUrl(ref?.cover) || undefined, backdrop: safeUrl(info?.backdrop) || undefined,
    description: (info?.overview || "").trim(), genres: info?.genres,
  };
  const name = edit.title || title;
  const cover = safeUrl(edit.cover) || source.cover;
  const backdrop = safeUrl(edit.backdrop) || source.backdrop || cover;
  const year = edit.year || source.year;
  const creator = edit.creator || source.creator;
  const genres = edit.genres || info?.genres;
  const item: Item = { type, title, year: year || null, creator: creator || null, cover: cover || null, rawg_id: null, ext_id: extId };
  const rated = logs.filter((l) => l.rating);
  const avg = rated.length ? rated.reduce((s, l) => s + Number(l.rating), 0) / rated.length : 0;
  const timed = logs.filter((l) => playSec(l) > 0);
  const avgSec = timed.length ? timed.reduce((s, l) => s + playSec(l), 0) / timed.length : 0;
  const mine = me && logs.find((l) => l.user_id === me.id);
  const count = (s: Entry["status"]) => logs.filter((l) => l.status === s).length;
  const desc = edit.description || source.description || "";
  const facts: [string, string][] = [
    ...(info?.facts || (creator ? [[t.creator, creator]] as [string, string][] : [])),
    ...(year ? [["Yıl", String(year)]] as [string, string][] : []),
    ...(avgSec ? [[`Ortalama ${t.time.toLocaleLowerCase("tr")} (Ancalog)`, fmtDur(Math.round(avgSec))]] as [string, string][] : []),
  ];

  return (
    <>
      <section className="gh">
        <div className="gh-bg" style={backdrop ? { backgroundImage: cssUrl(backdrop) } : undefined} />
        <div className="gh-inner">
          <div className="gh-left">
            <div className={`gh-cover ${t.square ? "square" : ""}`}>{cover ? <button className="zoom" onClick={() => setZoom(true)} aria-label="Büyüt"><img src={cover} alt="" /></button> : <div className="ph">{t.icon}</div>}</div>
            <div className="gh-counts">
              <span title="Kütüphanesine ekleyen">📚 {logs.length}</span>
              <span title={t.active}>▶ {count("active")}</span>
              <span title="Bitirdi">🏆 {count("completed")}</span>
              <span title="Planlıyor">📋 {count("planned")}</span>
            </div>
            {!me ? <Link className="btn primary wide" href="/login">+ Kütüphaneme ekle</Link>
              : mine ? <button className="btn primary wide" onClick={() => openForm(mine)}>{t.icon} {statusLabel(mine.status, type)} · Düzenle</button>
              : <button className="btn primary wide" onClick={() => openForm(null, { item })}>+ Kütüphaneme ekle</button>}
            <button className="btn wide" onClick={() => pickList(item)}>📚 Listeye ekle</button>
            {isAdmin && <button className="btn wide ghost" onClick={() => setEditing(true)}>🛡️ Sayfayı düzenle</button>}
          </div>
          <div className="gh-main">
            <div className="crumbs"><Link href={`/search?type=${type}`}>{t.plural}</Link> / {title}</div>
            <h1>{name} {year ? <small>{year}</small> : null}</h1>
            {creator && <div className="gh-dev">{creator}</div>}
            {desc && <p className={`gh-desc ${more ? "" : "clamp"}`}>{desc}</p>}
            {desc.length > 300 && !more && <button className="link" onClick={() => setMore(true)}>Devamını oku</button>}
            {genres?.length ? <div className="genres">{genres.map((x) => <span key={x}>{x}</span>)}</div> : null}
          </div>
          <div className="gh-score">
            <div><b>★ {avg ? avgText(avg, scale) : "–"}</b><span>{rated.length} oy · Ancalog</span></div>
            {mine?.rating ? <div><b className="you">★ {scoreText(Number(mine.rating), scale)}</b><span>Senin puanın</span></div> : null}
            {info?.score && <div><b className="mc">{info.score[0]}</b><span>{info.score[1]}</span></div>}
          </div>
        </div>
      </section>
      <div className="game-body">
        <aside className="facts">
          {facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          {info && extId && <span className="muted" style={{ fontSize: 12 }}>Bilgiler: {extId.startsWith("tmdb:") ? "TMDB" : "AniList"}</span>}
        </aside>
        <section>
          <div className="section-head"><h2>Ancalog&apos;da kimler logladı</h2></div>
          <Feed list={logs} empty={<div className="empty">Henüz kimse loglamadı. İlk sen ol!</div>} />
        </section>
      </div>
      {zoom && cover && <Lightbox images={[cover]} start={0} onClose={() => setZoom(false)} />}
      {editing && <PageEditor editKey={editKey} edit={edit} source={source} creatorLabel={t.creator} onClose={() => setEditing(false)} />}
    </>
  );
}
