/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Entry, EntryType, Item, PageEdit } from "@/lib/types";
import { ENTRY_COLS, TYPES } from "@/lib/constants";
import { NON_LATIN, avgText, contentKey, cssUrl, fmtDate, fmtDur, forumHref, likeEsc, num, oneRatingEach, playSec, safeUrl, scoreText, wideImage } from "@/lib/format";
import { needsLocal, useLocalized } from "@/lib/localize";
import { aniDetail, fetchPageEdit, tmdbCreator, tmdbDetail, tmdbImage } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { MyLogs } from "@/components/MyLogs";
import { RatingBars, PeopleLogs } from "@/components/ui";
import { GameLinker } from "@/components/GameLinker";
import { Lightbox } from "@/components/Lightbox";
import { PageEditor } from "@/components/PageEditor";
import { ListsWith } from "@/components/ListsWith";

interface Info { title?: string; year?: number | null; creator?: string | null; cover?: string | null; backdrop?: string | null;
  overview?: string; genres?: string[]; facts: [string, string][]; score?: [string, string];
  overviewNote?: string; tracks?: { title: string; sec: number }[]; link?: string | null; source?: string; descFrom?: { name: string; url: string } | null }

// Müzik: albüm bilgisi Deezer / Apple Music'ten, açıklaması Vikipedi'den (ya da Last.fm)
async function loadMusic(title: string, artist: string | null, extId: string | null, lang: string): Promise<Info | null> {
  const r = await fetch(`/api/musicinfo?${new URLSearchParams({ title, artist: artist || "", lang, ...(extId && { ext: extId }) })}`).catch(() => null);
  if (!r?.ok) return null;
  const d: { title?: string; artist?: string; cover?: string | null; released?: string | null; label?: string | null; genres?: string[];
    tracks?: { title: string; sec: number }[]; link?: string | null; source?: string; description?: string | null; descFrom?: { name: string; url: string } | null } = await r.json();
  const total = (d.tracks || []).reduce((s, t) => s + t.sec, 0);
  return {
    // Adıyla bulunan albümün kapağı yanlış olabilir: kapak sadece kaynağı belli olanda gelir, yoksa kayıtlardaki kalır
    creator: d.artist || null, year: parseInt(d.released || "") || null, cover: extId ? d.cover || null : null, overview: d.description || "", genres: d.genres || [],
    facts: ([
      ["Sanatçı", d.artist || ""],
      ["Çıkış", d.released && /^\d{4}-\d\d-\d\d$/.test(d.released) ? fmtDate(d.released) : d.released || ""],
      ["Şarkılar", d.tracks?.length ? `${d.tracks.length} şarkı${total ? ` · ${fmtDur(total)}` : ""}` : ""],
      ["Plak şirketi", d.label || ""],
    ] as [string, string][]).filter(([, v]) => v),
    tracks: d.tracks, link: d.link, source: d.source, descFrom: d.descFrom,
  };
}

// Dış kaynaktan (TMDB / AniList) içerik bilgisi; lang: açıklamaların dili (Ayarlar → Dil ve içerik)
async function loadInfo(extId: string, lang?: "tr" | "en"): Promise<Info | null> {
  if (extId.startsWith("tmdb:")) {
    const d = await tmdbDetail(extId, lang);
    const runtime = d.runtime || d.episode_run_time?.[0];
    return {
      title: d.title || d.name, year: parseInt(d.release_date || d.first_air_date || "") || null, creator: tmdbCreator(d),
      cover: tmdbImage(d.poster_path), backdrop: tmdbImage(d.backdrop_path, "w1280"), overview: d.tagline ? `${d.tagline}\n\n${d.overview || ""}` : d.overview,
      genres: (d.genres || []).map((g) => g.name),
      facts: ([
        ["Orijinal adı", ((o) => (o && o !== (d.title || d.name) ? o : ""))(d.original_title || d.original_name)],
        ["Yönetmen / Yaratıcı", tmdbCreator(d) || ""],
        ["Oyuncular", (d.credits?.cast || []).slice(0, 5).map((c) => c.name).join("\n")],
        ["Süre", runtime ? `${runtime} dk${d.episode_run_time ? " (bölüm)" : ""}` : ""],
        ["Sezon / bölüm", d.number_of_seasons ? `${d.number_of_seasons} sezon · ${d.number_of_episodes} bölüm` : ""],
        ["Kanal", (d.networks || []).map((n) => n.name).join(", ")],
      ] as [string, string][]).filter(([, v]) => v),
      score: d.vote_average ? [num(d.vote_average), "TMDB"] : undefined,
      overviewNote: d.overview_lang === "en" ? "Türkçe özeti yok, İngilizcesi gösteriliyor." : undefined,
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

// Bu sayfanın bilgileri nereden geliyor: kaynağın adı ve kendi sayfasına link
function SourceLine({ ext, info, mine }: { ext: string | null; info: Info | null; mine: boolean }) {
  const [kind, a, b] = (ext || "").split(":");
  const link = (name: string, url: string) => <a href={url} target="_blank" rel="noopener">{name}</a>;
  const src = kind === "tmdb" ? link("TMDB", `https://www.themoviedb.org/${a}/${b}`)
    : kind === "anilist" ? link("AniList", `https://anilist.co/anime/${a}`)
    : (kind === "deezer" || kind === "itunes") && info?.link ? link(info.source || "Kaynak", info.link)
    : kind === "deezer" ? link("Deezer", `https://www.deezer.com/${a}/${b}`)
    : kind === "yt" ? link("YouTube", `https://www.youtube.com/watch?v=${a}`)
    : kind === "ytpl" ? link("YouTube", `https://www.youtube.com/playlist?list=${a}`)
    : kind === "spotify" ? link("Spotify", `https://open.spotify.com/${a}/${b}`)
    : !ext && info?.link ? link(info.source || "Kaynak", info.link)
    : null;
  return (
    <div className="source-line">
      <span>Kaynak</span>
      <b>
        {src ? <>Bilgiler: {src}</> : kind === "cat" ? "Ancalog üyelerinin eklediği ortak katalog" : "Bir kaynağa bağlı değil; bilgiler kayıtlardan"}
        {info?.descFrom && <> · Açıklama: {link(info.descFrom.name, info.descFrom.url)}</>}
      </b>
      {!ext && mine && <Link className="small" href="/fix">Gerçek sayfasına bağla →</Link>}
    </div>
  );
}

export default function ContentPage() {
  const params = useParams<{ type: string; title: string }>();
  const search = useSearchParams();
  const type = params.type as EntryType;
  const title = decodeURIComponent(params.title);
  const { me, version, openForm, pickList, scale, isAdmin, following, prefs } = useApp();
  const [tracksOpen, setTracksOpen] = useState(false);
  const [more, setMore] = useState(false);
  const [zoom, setZoom] = useState(false);
  const [editing, setEditing] = useState(false);
  const [linking, setLinking] = useState(false);
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
    const info = type === "music" ? await loadMusic(title, logs.find((l) => l.creator)?.creator || null, extId, prefs.lang || "tr").catch(() => null)
      : extId ? await loadInfo(extId, prefs.lang).catch(() => null) : null;
    return { logs, info, extId, edit };
  }, [type, title, version, search.get("ext"), prefs.lang], supabaseConfigured() && type in TYPES);
  // Ayarlar'da seçilen dildeki ad ve kapak
  const loc = useLocalized(prefs, { type, title, cover: null, ext_id: data?.extId ?? null });

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
  const localOn = needsLocal(prefs, type, extId);
  const name = edit.title || (localOn && loc.title !== title ? loc.title : NON_LATIN.test(title) && info?.title && !NON_LATIN.test(info.title) ? info.title : title); // okunmayan alfabede kayıtlıysa İngilizce adı
  const cover = safeUrl(edit.cover) || (localOn && safeUrl(loc.cover)) || source.cover;
  const backdrop = safeUrl(edit.backdrop) || source.backdrop || wideImage(cover);
  const year = edit.year || source.year;
  const creator = edit.creator || source.creator;
  const genres = edit.genres || info?.genres;
  const item: Item = { type, title, year: year || null, creator: creator || null, cover: cover || null, rawg_id: null, ext_id: extId };
  const rated = oneRatingEach(logs);
  const avg = rated.length ? rated.reduce((s, l) => s + Number(l.rating), 0) / rated.length : 0;
  // Takip ettiklerinin ortalaması (en az bir kişi puan verdiyse)
  const fr = rated.filter((l) => following.has(l.user_id));
  const friendAvg = fr.length ? { avg: fr.reduce((s, l) => s + Number(l.rating), 0) / fr.length, n: fr.length } : null;
  const timed = logs.filter((l) => playSec(l) > 0);
  const avgSec = timed.length ? timed.reduce((s, l) => s + playSec(l), 0) / timed.length : 0;
  const mine = me && logs.find((l) => l.user_id === me.id);
  const count = (s: Entry["status"]) => logs.filter((l) => l.status === s && !l.replay).length;
  const desc = edit.description || source.description || "";
  const facts: [string, string][] = [
    ...(info?.facts || (creator ? [[t.creator, creator]] as [string, string][] : [])),
    ...(year ? [["Yıl", String(year)]] as [string, string][] : []),
    ...(avgSec ? [[`Ortalama ${t.time.toLocaleLowerCase("tr")} (Ancalog)`, fmtDur(avgSec >= 3600 ? Math.round(avgSec / 60) * 60 : Math.round(avgSec))]] as [string, string][] : []),
  ];

  return (
    <>
      <section className="gh">
        <div className="gh-bg" style={backdrop ? { backgroundImage: cssUrl(backdrop) } : undefined} />
        <div className="gh-inner">
          <div className="gh-left">
            <div className={`gh-cover ${t.square ? "square" : ""}`}>{cover ? <button className="zoom" onClick={() => setZoom(true)} aria-label="Büyüt"><img src={cover} alt="" /></button> : <div className="ph">{t.label}</div>}</div>
            <div className="gh-counts">
              <span><b>{logs.length}</b>kayıt</span>
              <span><b>{count("active")}</b>devam</span>
              <span><b>{count("completed")}</b>bitirdi</span>
              <span><b>{count("planned")}</b>planlı</span>
            </div>
            {!me ? <Link className="btn primary wide" href="/login">+ Kütüphaneme ekle</Link>
              : mine ? <MyLogs logs={logs} item={item} />
              : <button className="btn primary wide" onClick={() => openForm(null, { item })}>+ Kütüphaneme ekle</button>}
            <div className="gh-pair">
              <button className="btn" onClick={() => pickList(item)}>Listeye ekle</button>
              <Link className="btn" href={forumHref(item)}>Tartış</Link>
            </div>
            {isAdmin && <button className="btn wide ghost" onClick={() => setEditing(true)}>Sayfayı düzenle</button>}
            {isAdmin && type === "game" && <button className="btn wide primary" onClick={() => setLinking(true)}>IGDB ile eşleştir</button>}
          </div>
          <div className="gh-main">
            <div className="crumbs"><Link href={`/search?type=${type}`}>{t.plural}</Link> / {title}</div>
            <h1>{name} {year ? <small>{year}</small> : null}</h1>
            {creator && <div className="gh-dev">{creator}</div>}
            {desc && <p className={`gh-desc ${more ? "" : "clamp"}`}>{desc}</p>}
            {desc.length > 300 && !more && <button className="link" onClick={() => setMore(true)}>Devamını oku</button>}
            {desc && !edit.description && (info?.overviewNote || info?.descFrom) && (
              <p className="muted small desc-from">{info.overviewNote}{info.descFrom && <> Açıklama: <a href={info.descFrom.url} target="_blank" rel="noopener">{info.descFrom.name}</a></>}</p>
            )}
            {genres?.length ? <div className="genres">{genres.map((x) => <span key={x}>{x}</span>)}</div> : null}
          </div>
          <div className="gh-score">
            <div><b>★ {avg ? avgText(avg, scale) : "–"}</b><span>{rated.length} oy · Ancalog</span><RatingBars ratings={rated.map((l) => Number(l.rating))} /></div>
            {mine?.rating ? <div><b className="you">★ {scoreText(Number(mine.rating), scale)}</b><span>Senin puanın</span></div> : null}
            {friendAvg ? <div title="Takip ettiklerinin bu içeriğe verdiği puanların ortalaması"><b className="friends">★ {avgText(friendAvg.avg, scale)}</b><span>{friendAvg.n} takip ettiğin</span></div> : null}
            {info?.score && <div><b className="mc">{info.score[0]}</b><span>{info.score[1]}</span></div>}
          </div>
        </div>
      </section>
      <div className="game-body">
        <aside className="facts">
          {facts.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
          <SourceLine ext={extId} info={info} mine={!!mine} />
        </aside>
        <section>
          {info?.tracks && info.tracks.length > 1 && (
            <div className="tracks">
              <div className="section-head"><h2>Şarkılar</h2>{info.link && <a className="muted small" href={info.link} target="_blank" rel="noopener">{info.source}&apos;da dinle →</a>}</div>
              <ol>
                {info.tracks.slice(0, tracksOpen ? 200 : 12).map((t, i) => <li key={i}><span>{t.title}</span>{t.sec ? <small>{Math.floor(t.sec / 60)}:{String(t.sec % 60).padStart(2, "0")}</small> : null}</li>)}
              </ol>
              {info.tracks.length > 12 && !tracksOpen && <button className="link" onClick={() => setTracksOpen(true)}>Bütün şarkılar ({info.tracks.length})</button>}
            </div>
          )}
          <div className="section-head"><h2>Loglayanlar</h2></div>
          <PeopleLogs list={logs} empty={<div className="empty">Henüz kimse loglamadı. İlk sen ol!</div>} />
          <ListsWith type={type} title={title} ext={extId} />
        </section>
      </div>
      {linking && <GameLinker rawgId={null} title={title} onClose={() => setLinking(false)} />}
      {zoom && cover && <Lightbox images={[cover]} start={0} onClose={() => setZoom(false)} />}
      {editing && <PageEditor editKey={editKey} edit={edit} source={source} creatorLabel={t.creator} onClose={() => setEditing(false)} />}
    </>
  );
}
