"use client";

import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import type { Entry, EntryType, Item, RawgGame } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentHref, contentKey, likeEsc, norm, smallImage } from "@/lib/format";
import { anilist, tmdb, tmdbImage } from "@/lib/data";
import { rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { LCover, LTitle, QuickAdd } from "@/components/ui";

type Work = Item & { sub?: string; n?: number };
interface Shelf { title: string; items: Work[]; credit?: [string, string] }

// Bir sanatçının, yönetmenin, oyuncunun, stüdyonun ya da geliştiricinin öbür işleri.
// Önce Ancalog'da loglananlar, sonra kaynaktan (Deezer, TMDB, AniList, IGDB) bütün işleri.
const ROLE: Record<EntryType, string> = { music: "Sanatçı", movie: "Yönetmen / oyuncu", show: "Yaratıcı / oyuncu", anime: "Stüdyo", game: "Geliştirici" };

async function logged(type: EntryType, name: string): Promise<Work[]> {
  const rows = await q<Entry[]>(sb().from("entries").select("type, title, year, creator, cover, rawg_id, ext_id").eq("type", type)
    .ilike("creator", `%${likeEsc(name)}%`).limit(800)).catch(() => [] as Entry[]);
  const want = norm(name);
  const map = new Map<string, Work>();
  for (const r of rows) {
    // "A, B" diye yazılmış yaratıcılarda adı tam tutanlar (Daft Punk ararken "Daft Punkers" gelmesin)
    if (!(r.creator || "").split(/,|&|\n/).some((c) => norm(c) === want)) continue;
    const k = contentKey(r);
    const w = map.get(k);
    if (w) { w.n = (w.n || 1) + 1; if (!w.cover && r.cover) w.cover = r.cover; } else map.set(k, { ...r, n: 1 });
  }
  return [...map.values()].sort((a, b) => (b.n || 0) - (a.n || 0) || (b.year || 0) - (a.year || 0));
}

async function fromSource(type: EntryType, name: string, id: string | null): Promise<Shelf[]> {
  if (type === "music") {
    const found: { data?: { id: number; name: string; nb_fan?: number }[] } = await fetch(`/api/deezer?${new URLSearchParams({ kind: "artist", q: name, limit: "5" })}`).then((r) => r.json());
    const a = (found.data || []).find((x) => norm(x.name) === norm(name)) || found.data?.[0];
    if (!a) return [];
    const albums: { data?: { id: number; title: string; cover_xl?: string; release_date?: string; record_type?: string }[] } = await fetch(`/api/deezer?albums=${a.id}`).then((r) => r.json());
    const list = (albums.data || []).map((x) => ({
      type: "music" as const, title: x.title, year: parseInt(x.release_date || "") || null, creator: a.name, cover: x.cover_xl || null, rawg_id: null,
      ext_id: `deezer:album:${x.id}`, sub: x.record_type === "single" ? "Tekli" : x.record_type === "ep" ? "EP" : "Albüm",
    }));
    const albumsOnly = list.filter((x) => x.sub === "Albüm"), others = list.filter((x) => x.sub !== "Albüm");
    return [
      { title: "Albümleri", items: albumsOnly, credit: ["Deezer", `https://www.deezer.com/artist/${a.id}`] },
      ...(others.length ? [{ title: "Tekliler ve EP'ler", items: others.slice(0, 40), credit: ["Deezer", `https://www.deezer.com/artist/${a.id}`] as [string, string] }] : []),
    ];
  }
  if (type === "movie" || type === "show") {
    const people = await tmdb<{ results?: { id: number; name: string; popularity?: number }[] }>("search/person", { query: name });
    const p = (people.results || []).find((x) => norm(x.name) === norm(name)) || people.results?.[0];
    if (!p) return [];
    type Credit = { id: number; media_type: "movie" | "tv"; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null; job?: string; character?: string; vote_count?: number };
    const c = await tmdb<{ cast?: Credit[]; crew?: Credit[] }>(`person/${p.id}/combined_credits`);
    const toWork = (x: Credit): Work => ({
      type: x.media_type === "tv" ? "show" : "movie", title: x.title || x.name || "", year: parseInt(x.release_date || x.first_air_date || "") || null, creator: null,
      cover: tmdbImage(x.poster_path), rawg_id: null, ext_id: `tmdb:${x.media_type}:${x.id}`, sub: x.job || (x.character ? `Rol: ${x.character}` : undefined),
    });
    const uniq = (list: Credit[]) => [...new Map(list.filter((x) => x.poster_path && (x.vote_count || 0) > 5).map((x) => [`${x.media_type}${x.id}`, x])).values()]
      .sort((a, b) => (b.vote_count || 0) - (a.vote_count || 0)).map(toWork);
    const crew = uniq((c.crew || []).filter((x) => /Director|Creator|Screenplay|Writer|Novel/.test(x.job || "")));
    const cast = uniq(c.cast || []);
    const credit: [string, string] = ["TMDB", `https://www.themoviedb.org/person/${p.id}`];
    return [
      ...(crew.length ? [{ title: "Yönettikleri ve yazdıkları", items: crew.slice(0, 48), credit }] : []),
      ...(cast.length ? [{ title: "Oynadıkları", items: cast.slice(0, 48), credit }] : []),
    ];
  }
  if (type === "anime") {
    const d = await anilist<{ Studio: { id: number; name: string; media: { nodes: { id: number; type: string; title: { romaji?: string; english?: string }; startDate?: { year?: number }; coverImage?: { large?: string } }[] } } | null }>(
      `query ($s: String) { Studio(search: $s) { id name media(sort: POPULARITY_DESC, isMain: true, perPage: 50) { nodes { id type title { romaji english } startDate { year } coverImage { large } } } } }`, { s: name });
    if (!d.Studio) return [];
    return [{ title: "Stüdyonun animeleri", credit: ["AniList", `https://anilist.co/studio/${d.Studio.id}`], items: d.Studio.media.nodes.filter((m) => m.type === "ANIME").map((m) => ({
      type: "anime" as const, title: m.title.english || m.title.romaji || "", year: m.startDate?.year || null, creator: d.Studio!.name, cover: m.coverImage?.large || null,
      rawg_id: null, ext_id: `anilist:${m.id}`,
    })) }];
  }
  // Oyun: adresle gelen şirket numarası ya da adıyla IGDB'de bulunan şirket
  let company = id ? Number(id) : null;
  if (!company) {
    const c = await rawg<{ results?: { id: number; name: string }[] }>("companies", { search: name });
    company = c.results?.[0]?.id ?? null;
  }
  if (!company) return [];
  const g = await rawg<{ results?: RawgGame[] }>("games", { developers: company, ordering: "-added", page_size: 48 });
  return [{ title: "Geliştirdiği oyunlar", credit: ["IGDB", "https://www.igdb.com"], items: (g.results || []).map((x) => ({
    type: "game" as const, title: x.name, year: parseInt(x.released || "") || null, creator: name, cover: x.background_image ? smallImage(x.background_image) : null,
    rawg_id: x.id, ext_id: null,
  })) }];
}

export default function CreatorPage() {
  const params = useParams<{ type: string; name: string }>();
  const type = params.type as EntryType;
  const name = decodeURIComponent(params.name);
  const id = useSearchParams().get("id"); // oyunda IGDB şirket numarası (oyun sayfasından gelince)
  const { mine, openForm } = useApp();
  const have = new Set(mine.map(contentKey));
  const { data: ours } = useLoad(() => logged(type, name), [type, name], type in TYPES);
  const { data: shelves, error } = useLoad(() => fromSource(type, name, id), [type, name], type in TYPES);
  if (!(type in TYPES)) return <div className="empty">Böyle bir tür yok.</div>;

  const card = (x: Work, i: number) => (
    <div className="card-wrap" key={`${x.ext_id || x.rawg_id || x.title}|${i}`}>
      <Link className="card" href={contentHref(x)}>
        <div className={`poster ${TYPES[x.type].square ? "square" : ""}`}><div className="ph">{TYPES[x.type].label}</div><LCover x={x} /></div>
        <div className="card-title"><LTitle x={x} /></div>
        <div className="card-meta">{[x.sub, x.year, x.n ? `${x.n} kişi logladı` : ""].filter(Boolean).join(" · ")}</div>
      </Link>
      <QuickAdd has={have.has(contentKey(x))} onAdd={() => openForm(null, { item: x })} />
    </div>
  );

  return (
    <div className="creator-page">
      <section className="search-hero">
        <span className="muted small">{ROLE[type]}</span>
        <h1>{name}</h1>
        {type === "game" && id && <Link className="link" href={`/games?developers=${id}`}>Bütün oyunlarına göz at →</Link>}
      </section>
      {ours && ours.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Ancalog&apos;da loglananlar</h2><span className="muted small">{ours.length} içerik</span></div>
          <div className="grid">{ours.slice(0, 36).map(card)}</div>
        </section>
      )}
      {error ? <div className="empty">Kaynağa şu an ulaşılamadı. Biraz sonra tekrar dener misin?</div>
        : !shelves ? <section className="section"><div className="loading">İşleri getiriliyor…</div></section>
        : !shelves.length ? (ours?.length ? null : <div className="empty">{name} için başka bir şey bulunamadı.</div>)
        : shelves.filter((s) => s.items.length).map((s) => (
          <section className="section" key={s.title}>
            <div className="section-head">
              <h2>{s.title}</h2>
              {s.credit && <a className="muted small" href={s.credit[1]} target="_blank" rel="noopener">Veri: {s.credit[0]}</a>}
            </div>
            <div className="grid">{s.items.map(card)}</div>
          </section>
        ))}
    </div>
  );
}
