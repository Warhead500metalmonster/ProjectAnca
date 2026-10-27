import type { Entry, EntryType, Item, RawgGame } from "./types";
import { ENTRY_COLS, TYPES } from "./constants";
import { contentKey, likeEsc, smallImage } from "./format";
import { rawg } from "./rawg";
import { q, sb } from "./supabase";

export function fetchFeed({ users, limit = 20 }: { users?: string[]; limit?: number } = {}) {
  let req = sb().from("entries").select(ENTRY_COLS).order("updated_at", { ascending: false }).limit(limit);
  if (users) req = req.in("user_id", users);
  return q<Entry[]>(req);
}

export const fetchEntries = (userId: string) =>
  q<Entry[]>(sb().from("entries").select("*, likes(count), comments(count)").eq("user_id", userId)
    .order("updated_at", { ascending: false }).limit(2000));

// ---------- Müzik: Apple Music (iTunes) araması; anahtar istemez ----------

interface ItunesHit { collectionName?: string; trackName?: string; artistName: string; releaseDate?: string; artworkUrl100?: string }

// iTunes kapakları 100px gelir; adresteki boyutu değiştirince büyüğü verir
export const bigArtwork = (url: string) => url.replace(/\/\d+x\d+bb\./, "/600x600bb.");

async function itunes(text: string, entity: string, limit: number): Promise<ItunesHit[]> {
  const qs = new URLSearchParams({ term: text, entity, limit: String(limit), country: "TR" });
  const r = await fetch(`https://itunes.apple.com/search?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).results || [];
}

export interface Found extends Item { sub?: string; thumb?: string | null; raw?: RawgGame }

export async function searchMusic(text: string): Promise<Found[]> {
  const [albums, songs] = await Promise.all([itunes(text, "album", 4), itunes(text, "song", 3)]);
  const map = (h: ItunesHit, title: string, kind: string): Found => ({
    type: "music", title, creator: h.artistName, year: parseInt(h.releaseDate || "") || null,
    cover: h.artworkUrl100 ? bigArtwork(h.artworkUrl100) : null, rawg_id: null,
    sub: `${kind} · ${h.artistName}`, thumb: h.artworkUrl100 || null,
  });
  return [
    ...albums.map((a) => map(a, a.collectionName || "", "Albüm")),
    ...songs.map((s) => map(s, s.trackName || "", "Şarkı")),
  ].filter((m) => m.title);
}

export async function searchGames(text: string, limit = 6): Promise<Found[]> {
  const data = await rawg<{ results?: RawgGame[] }>("games", { search: text, page_size: limit });
  return (data.results || []).map((g) => ({
    type: "game", title: g.name, year: parseInt(g.released || "") || null, creator: null,
    cover: g.background_image ? smallImage(g.background_image) : null, rawg_id: g.id,
    thumb: g.background_image ? smallImage(g.background_image) : null, raw: g,
  }));
}

// ---------- Film ve dizi: TMDB (anahtar sunucuda, /api/tmdb üzerinden) ----------

export const tmdbImage = (path?: string | null, size = "w500") => (path ? `https://image.tmdb.org/t/p/${size}${path}` : null);

export async function tmdb<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ path, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`/api/tmdb?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
}

interface TmdbHit { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null; original_title?: string; original_name?: string }

export async function searchTmdb(type: "movie" | "show", text: string): Promise<Found[]> {
  const kind = type === "movie" ? "movie" : "tv";
  const data = await tmdb<{ results?: TmdbHit[] }>(`search/${kind}`, { query: text });
  return (data.results || []).slice(0, 7).map((h) => {
    const title = h.title || h.name || "";
    const orig = h.original_title || h.original_name;
    return {
      type, title, creator: null, year: parseInt(h.release_date || h.first_air_date || "") || null,
      cover: tmdbImage(h.poster_path), rawg_id: null, ext_id: `tmdb:${kind}:${h.id}`,
      sub: orig && orig !== title ? orig : undefined, thumb: tmdbImage(h.poster_path, "w92"),
    };
  });
}

export interface TmdbDetail {
  id: number; title?: string; name?: string; overview?: string; tagline?: string; runtime?: number; episode_run_time?: number[];
  release_date?: string; first_air_date?: string; poster_path?: string | null; backdrop_path?: string | null;
  vote_average?: number; number_of_seasons?: number; number_of_episodes?: number;
  genres?: { name: string }[]; created_by?: { name: string }[]; networks?: { name: string }[];
  credits?: { crew?: { job: string; name: string }[]; cast?: { name: string; character?: string }[] };
}

export const tmdbDetail = (extId: string) => {
  const [, kind, id] = extId.split(":");
  return tmdb<TmdbDetail>(`${kind}/${id}`, { append_to_response: "credits" });
};
export const tmdbCreator = (d: TmdbDetail) =>
  (d.credits?.crew || []).filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2).join(", ")
  || (d.created_by || []).map((c) => c.name).slice(0, 2).join(", ")
  || (d.networks || []).map((n) => n.name)[0] || null;

// ---------- Anime: AniList (anahtar istemez) ----------

interface AniMedia {
  id: number; title: { romaji?: string; english?: string }; startDate?: { year?: number };
  coverImage?: { large?: string; medium?: string }; studios?: { nodes: { name: string }[] }; episodes?: number;
}

export async function anilist<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).data;
}

export async function searchAnime(text: string): Promise<Found[]> {
  const data = await anilist<{ Page: { media: AniMedia[] } }>(
    `query ($s: String) { Page(perPage: 7) { media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
      id title { romaji english } startDate { year } coverImage { large medium } studios(isMain: true) { nodes { name } } episodes } } }`,
    { s: text });
  return data.Page.media.map((m) => {
    const title = m.title.english || m.title.romaji || "";
    return {
      type: "anime", title, year: m.startDate?.year || null, creator: m.studios?.nodes[0]?.name || null,
      cover: m.coverImage?.large || null, rawg_id: null, ext_id: `anilist:${m.id}`,
      sub: [m.title.romaji !== title ? m.title.romaji : "", m.episodes ? `${m.episodes} bölüm` : ""].filter(Boolean).join(" · ") || undefined,
      thumb: m.coverImage?.medium || null,
    };
  });
}

export interface AniDetail {
  id: number; title: { romaji?: string; english?: string; native?: string }; description?: string; episodes?: number; duration?: number;
  bannerImage?: string | null; coverImage?: { extraLarge?: string }; genres?: string[]; averageScore?: number;
  startDate?: { year?: number }; studios?: { nodes: { name: string }[] }; format?: string; status?: string;
}
export const aniDetail = (extId: string) => anilist<{ Media: AniDetail }>(
  `query ($id: Int) { Media(id: $id, type: ANIME) { id title { romaji english native } description(asHtml: false) episodes duration
    bannerImage coverImage { extraLarge } genres averageScore startDate { year } studios(isMain: true) { nodes { name } } format status } }`,
  { id: Number(extId.split(":")[1]) }).then((d) => d.Media);

// Ancalog'da loglanmış isimlerden öner (dış kaynak yoksa ya da çalışmıyorsa)
export async function searchLogged(type: EntryType, text: string): Promise<Found[]> {
  const rows = await q<Entry[]>(sb().from("entries").select("type, title, year, creator, cover, rawg_id, ext_id")
    .eq("type", type).ilike("title", `%${likeEsc(text)}%`).limit(60));
  const seen = new Map<string, Found>();
  for (const r of rows) {
    const k = contentKey(r);
    if (!seen.has(k)) seen.set(k, { ...r, sub: [r.creator, r.year].filter(Boolean).join(" · "), thumb: r.cover });
  }
  return [...seen.values()].slice(0, 6);
}

// Bir türde içerik ara: oyunda RAWG, müzikte iTunes, film/dizide TMDB, animede AniList
export function findContent(type: EntryType, text: string): Promise<Found[]> {
  if (type === "game") return searchGames(text);
  if (type === "music") return searchMusic(text);
  if (type === "anime") return searchAnime(text).catch(() => searchLogged(type, text));
  return searchTmdb(type, text).catch(() => searchLogged(type, text));
}
export const SEARCH_CREDITS: Record<EntryType, [string, string]> = {
  game: ["RAWG", "https://rawg.io"],
  music: ["Apple Music", "https://music.apple.com"],
  movie: ["TMDB", "https://www.themoviedb.org"],
  show: ["TMDB", "https://www.themoviedb.org"],
  anime: ["AniList", "https://anilist.co"],
};
export const searchCredit = (type: EntryType) => SEARCH_CREDITS[type];

export const typeLabel = (t: EntryType) => TYPES[t].label;
