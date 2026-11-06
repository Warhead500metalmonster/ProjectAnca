import { scoreOf } from "./compat";
import type { CatalogItem, Entry, EntryType, Item, PageEdit, RawgGame } from "./types";
import { ENTRY_COLS, TYPES } from "./constants";
import { NON_LATIN, contentKey, likeEsc, norm, smallImage } from "./format";
import { rawg } from "./rawg";
import { q, sb } from "./supabase";

export function fetchFeed({ users, limit = 20 }: { users?: string[]; limit?: number } = {}) {
  let req = sb().from("entries").select(ENTRY_COLS).order("updated_at", { ascending: false }).limit(limit);
  if (users) req = req.in("user_id", users);
  return q<Entry[]>(req);
}

// Veritabanı tek seferde en fazla 1000 satır verir; daha fazlası için sayfa sayfa çek
export async function fetchAll<T>(page: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>, max = 20000): Promise<T[]> {
  const all: T[] = [];
  for (let from = 0; from < max; from += 1000) {
    const rows = await q<T[]>(page(from, from + 999));
    all.push(...rows);
    if (rows.length < 1000) break;
  }
  return all;
}

// Aynı kütüphane aynı anda birden çok yerden istenirse tek sefer indirilir
const entriesLoading = new Map<string, Promise<Entry[]>>();
export function fetchEntries(userId: string) {
  let p = entriesLoading.get(userId);
  if (!p) {
    p = fetchAll<Entry>((from, to) => sb().from("entries").select("*, likes(count), comments(count)").eq("user_id", userId)
      .order("updated_at", { ascending: false }).order("id").range(from, to)).finally(() => entriesLoading.delete(userId));
    entriesLoading.set(userId, p);
  }
  return p;
}

// ---------- Müzik: Apple Music (iTunes) araması; anahtar istemez ----------

interface ItunesHit { collectionId?: number; trackId?: number; collectionName?: string; trackName?: string; artistName: string; releaseDate?: string; artworkUrl100?: string }

// iTunes kapakları 100px gelir; adresteki boyutu değiştirince büyüğü verir
export const bigArtwork = (url: string) => url.replace(/\/\d+x\d+bb\./, "/600x600bb.");

async function itunes(text: string, entity: string, limit: number): Promise<ItunesHit[]> {
  const qs = new URLSearchParams({ term: text, entity, limit: String(limit), country: "TR" });
  const r = await fetch(`https://itunes.apple.com/search?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).results || [];
}

// custom: aramadan değil elle / linkle girilen içerik; kaydedilince ortak kataloğa yazılır
export interface Found extends Item { sub?: string; thumb?: string | null; raw?: RawgGame; custom?: boolean }

interface DeezerHit { id?: number; title: string; artist: { name: string }; cover_medium?: string; cover_xl?: string; album?: { title: string; cover_medium?: string; cover_xl?: string } }

async function deezer(kind: "album" | "track", text: string, limit: number): Promise<DeezerHit[]> {
  const r = await fetch(`/api/deezer?${new URLSearchParams({ kind, q: text, limit: String(limit) })}`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).data || [];
}

// Müzik: Apple Music ve Deezer birlikte aranır (birinde olmayan diğerinde çıkar), aynı albüm/şarkı bir kez gösterilir
export async function searchMusic(text: string): Promise<Found[]> {
  const none = () => [] as never[];
  const [albums, songs, dzAlbums, dzTracks] = await Promise.all([
    itunes(text, "album", 4).catch(none), itunes(text, "song", 3).catch(none),
    deezer("album", text, 4).catch(none), deezer("track", text, 4).catch(none),
  ]);
  // Kaynağın kendi numarası da gelir: içerik sayfasında nereden geldiği ve açıklaması bulunsun
  const map = (h: ItunesHit, title: string, kind: string): Found => ({
    type: "music", title, creator: h.artistName, year: parseInt(h.releaseDate || "") || null,
    cover: h.artworkUrl100 ? bigArtwork(h.artworkUrl100) : null, rawg_id: null,
    ext_id: (kind === "Şarkı" ? h.trackId : h.collectionId) ? `itunes:${kind === "Şarkı" ? h.trackId : h.collectionId}` : null,
    sub: `${kind} · ${h.artistName}`, thumb: h.artworkUrl100 || null,
  });
  const dz = (h: DeezerHit, kind: string, cover?: string, thumb?: string): Found => ({
    type: "music", title: h.title, creator: h.artist.name, year: null, cover: cover || null, rawg_id: null,
    ext_id: h.id ? `deezer:${kind === "Şarkı" ? "track" : "album"}:${h.id}` : null,
    sub: `${kind} · ${h.artist.name}`, thumb: thumb || null,
  });
  const all = [
    ...albums.map((a) => map(a, a.collectionName || "", "Albüm")),
    ...dzAlbums.map((a) => dz(a, "Albüm", a.cover_xl, a.cover_medium)),
    ...songs.map((s) => map(s, s.trackName || "", "Şarkı")),
    ...dzTracks.map((t) => dz(t, "Şarkı", t.album?.cover_xl, t.album?.cover_medium)),
  ].filter((m) => m.title);
  const seen = new Set<string>();
  return all.filter((m) => {
    const k = `${m.sub?.split(" · ")[0]}|${norm(m.title)}|${norm(m.creator)}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  }).slice(0, 10);
}

const gameFound = (g: RawgGame): Found => ({
  type: "game", title: g.name, year: parseInt(g.released || "") || null, creator: null,
  cover: g.background_image ? smallImage(g.background_image) : null, rawg_id: g.id,
  thumb: g.background_image ? smallImage(g.background_image) : null, raw: g,
});

// ---------- Her dilde arama: Wikidata köprüsü (Türkçe, Japonca, Rusça... adla yazılınca gerçek kaydı bulur) ----------
interface WikiHit { label: string; local: string; ids: Record<string, string> }
type Wiki = WikiHit[] & { en?: string | null };
const wikiCache = new Map<string, Promise<Wiki>>();
function viaWikidata(kind: "game" | "movie" | "show" | "anime", text: string): Promise<Wiki> {
  const k = `${kind}|${norm(text)}`;
  if (!wikiCache.has(k)) wikiCache.set(k, fetch(`/api/wikidata?${new URLSearchParams({ q: text, kind })}`).then((r) => (r.ok ? r.json() : { results: [] }))
    .then((d) => Object.assign(d.results || [], { en: d.en || null })).catch(() => []));
  return wikiCache.get(k)!;
}
const plainText = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, "");
// Yazılan ad bulunan sonuçların hiçbirinde geçmiyorsa başka dilde yazılmış demektir: köprüden gelenler öne alınır
const foreignQuery = (found: { title: string }[], text: string) => {
  const t = plainText(text);
  return !found.slice(0, 5).some((f) => { const n = plainText(f.title); return n.includes(t) || t.includes(n); });
};

export async function searchGames(text: string, limit = 6): Promise<Found[]> {
  const [data, wiki] = await Promise.all([
    rawg<{ results?: RawgGame[] }>("games", { search: text, search_precise: "true", page_size: limit }),
    text.trim().length >= 3 ? viaWikidata("game", text) : Promise.resolve([] as Wiki),
  ]);
  let list = (data.results || []).map(gameFound);
  // Oyunun kendisi Wikidata'da yoksa yazılanın İngilizce adıyla da ara ("Örümcek Adam" → "Spider-Man")
  if (wiki.en && plainText(wiki.en) !== plainText(text) && foreignQuery(list, text)) {
    const alt = await rawg<{ results?: RawgGame[] }>("games", { search: wiki.en, search_precise: "true", page_size: limit }).catch(() => ({ results: [] as RawgGame[] }));
    const more = (alt.results || []).map(gameFound).filter((g) => !list.some((x) => x.rawg_id === g.rawg_id));
    list = [...more, ...list];
  }
  const slugs = wiki.map((w) => w.ids.P5794).filter((s) => s && !list.some((g) => g.raw?.slug === s));
  if (!slugs.length) return list;
  const extra = ((await rawg<{ results?: RawgGame[] }>("games", { slugs: slugs.slice(0, 6).join(",") }).catch(() => ({ results: [] }))).results || [])
    .map(gameFound).filter((g) => !list.some((x) => x.rawg_id === g.rawg_id));
  return foreignQuery(list, text) ? [...extra, ...list] : [...list, ...extra.slice(0, 3)];
}

// Arama bulamazsa: YouTube / YouTube Music / Spotify / SoundCloud linkinden bilgileri çek
export const isLink = (text: string) => /^https:\/\/\S+$/i.test(text.trim());

export async function fromLink(link: string): Promise<Found | null> {
  const r = await fetch(`/api/oembed?url=${encodeURIComponent(link.trim())}`);
  if (!r.ok) return null;
  const d: { title: string; author: string; thumbnail: string; provider: string } = await r.json();
  const url = new URL(link.trim());
  let title = d.title, artist = d.author.replace(/\s*-\s*Topic$/i, "").replace(/VEVO$/i, "").trim();
  let ext: string | null = null;
  if (d.provider === "YouTube") {
    const v = url.searchParams.get("v") || (url.hostname === "youtu.be" ? url.pathname.slice(1) : "");
    const list = url.searchParams.get("list");
    ext = v ? `yt:${v}` : list ? `ytpl:${list}` : null;
    // "Sanatçı - Şarkı (Official Video)" → "Şarkı"
    const dash = title.indexOf(" - ");
    if (dash > 0 && (!artist || title.slice(0, dash).toLocaleLowerCase("tr") === artist.toLocaleLowerCase("tr"))) {
      artist ||= title.slice(0, dash);
      title = title.slice(dash + 3);
    }
    title = title.replace(/\s*[([][^)\]]*(official|video|audio|lyric|klip|4k|hd|remaster|visualizer)[^)\]]*[)\]]/gi, "").trim();
    if (title.startsWith("Album - ")) title = title.slice(8);
  } else if (d.provider === "Spotify") {
    const [, kind, id] = url.pathname.split("/");
    ext = kind && id ? `spotify:${kind}:${id}` : null;
  } else if (d.provider === "SoundCloud") {
    // "Şarkı by Sanatçı" → "Şarkı"
    const suffix = ` by ${artist}`;
    if (artist && title.toLocaleLowerCase("tr").endsWith(suffix.toLocaleLowerCase("tr"))) title = title.slice(0, -suffix.length);
  }
  if (!title) return null;
  return {
    type: "music", title: title.slice(0, 200), creator: artist || null, year: null, cover: d.thumbnail || null,
    rawg_id: null, ext_id: ext, sub: `${d.provider} linki${artist ? ` · ${artist}` : ""}`, thumb: d.thumbnail || null, custom: true,
  };
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
  const [data, wiki] = await Promise.all([
    tmdb<{ results?: TmdbHit[] }>(`search/${kind}`, { query: text }),
    text.trim().length >= 3 ? viaWikidata(type, text) : Promise.resolve([] as Wiki),
  ]);
  const hits = (data.results || []).slice(0, 7);
  // Başka dildeki adla bulunanlar (TMDB aramasında çıkmayanlar) numarasıyla getirilir
  const want = wiki.map((w) => Number(w.ids[type === "movie" ? "P4947" : "P4983"])).filter((id) => id && !hits.some((h) => h.id === id)).slice(0, 4);
  const extra = (await Promise.all(want.map((id) => tmdb<TmdbHit>(`${kind}/${id}`).catch(() => null)))).filter((h): h is TmdbHit => !!h?.id);
  const all = extra.length && foreignQuery(hits.map((h) => ({ title: h.title || h.name || "" })), text) ? [...extra, ...hits] : [...hits, ...extra];
  return all.slice(0, 9).map((h) => {
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
  id: number; title?: string; name?: string; overview?: string; overview_lang?: string; tagline?: string; runtime?: number; episode_run_time?: number[];
  release_date?: string; first_air_date?: string; poster_path?: string | null; backdrop_path?: string | null; original_title?: string; original_name?: string;
  vote_average?: number; number_of_seasons?: number; number_of_episodes?: number;
  seasons?: { season_number: number; episode_count: number; name?: string; air_date?: string | null }[];
  next_episode_to_air?: { air_date?: string; season_number: number; episode_number: number } | null; // dizinin bir sonraki bölümü
  genres?: { name: string }[]; created_by?: { name: string }[]; networks?: { name: string }[];
  credits?: { crew?: { job: string; name: string }[]; cast?: { name: string; character?: string }[] };
}

export const tmdbDetail = (extId: string, lang?: "tr" | "en") => {
  const [, kind, id] = extId.split(":");
  return tmdb<TmdbDetail>(`${kind}/${id}`, { append_to_response: "credits", ...(lang === "en" && { lang: "en" }) });
};
export const tmdbCreator = (d: TmdbDetail) =>
  (d.credits?.crew || []).filter((c) => c.job === "Director").map((c) => c.name).slice(0, 2).join(", ")
  || (d.created_by || []).map((c) => c.name).slice(0, 2).join(", ")
  || (d.networks || []).map((n) => n.name)[0] || null;

// ---------- Anime: AniList (anahtar istemez) ----------

interface AniMedia {
  id: number; idMal?: number | null; title: { romaji?: string; english?: string; native?: string }; startDate?: { year?: number };
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

// ---------- MyAnimeList (Jikan, anahtar istemez): AniList'te olmayan animeler için ----------
interface JikanAnime {
  mal_id: number; title: string; title_english?: string | null; title_japanese?: string | null; year?: number | null; episodes?: number | null;
  images?: { jpg?: { image_url?: string; large_image_url?: string } }; studios?: { name: string }[]; synopsis?: string | null; duration?: string | null;
  genres?: { name: string }[]; score?: number | null; type?: string | null; aired?: { prop?: { from?: { year?: number | null } } }; title_synonyms?: string[];
}
async function jikanSearch(text: string): Promise<Found[]> {
  const r = await fetch(`https://api.jikan.moe/v4/anime?${new URLSearchParams({ q: text, limit: "8", sfw: "true" })}`);
  if (!r.ok) throw new Error(String(r.status));
  const list: JikanAnime[] = (await r.json()).data || [];
  return list.map((m) => ({
    type: "anime", title: m.title_english || m.title, year: m.year || m.aired?.prop?.from?.year || null, creator: m.studios?.[0]?.name || null,
    cover: m.images?.jpg?.large_image_url || m.images?.jpg?.image_url || null, rawg_id: null, ext_id: `mal:${m.mal_id}`,
    sub: ["MyAnimeList", m.title_english && m.title !== m.title_english ? m.title : "", m.title_japanese, m.episodes ? `${m.episodes} bölüm` : ""].filter(Boolean).join(" · "),
    thumb: m.images?.jpg?.image_url || null,
  }));
}
export const malDetail = async (extId: string) => {
  const r = await fetch(`https://api.jikan.moe/v4/anime/${extId.split(":")[1]}/full`);
  if (!r.ok) throw new Error(String(r.status));
  return (await r.json()).data as JikanAnime;
};

// Anime: önce AniList; onda olmayanlar MyAnimeList'ten (aynı anime iki kez çıkmaz)
export async function searchAnime(text: string): Promise<Found[]> {
  const [ani, mal] = await Promise.all([aniSearch(text).catch(() => null), jikanSearch(text).catch(() => [] as Found[])]);
  if (!ani) { if (mal.length) return mal.slice(0, 8); throw new Error("anime search"); }
  const known = new Set(ani.malIds);
  return [...ani.list, ...mal.filter((m) => !known.has(Number(m.ext_id!.split(":")[1]))).slice(0, 4)];
}

async function aniSearch(text: string): Promise<{ list: Found[]; malIds: number[] }> {
  const data = await anilist<{ Page: { media: AniMedia[] } }>(
    `query ($s: String) { Page(perPage: 7) { media(search: $s, type: ANIME, sort: SEARCH_MATCH) {
      id idMal title { romaji english native } startDate { year } coverImage { large medium } studios(isMain: true) { nodes { name } } episodes } } }`,
    { s: text });
  return { malIds: data.Page.media.map((m) => m.idMal).filter((x): x is number => !!x), list: data.Page.media.map((m) => {
    const title = m.title.english || m.title.romaji || "";
    return {
      type: "anime", title, year: m.startDate?.year || null, creator: m.studios?.nodes[0]?.name || null,
      cover: m.coverImage?.large || null, rawg_id: null, ext_id: `anilist:${m.id}`,
      sub: [m.title.romaji !== title ? m.title.romaji : "", m.title.native, m.episodes ? `${m.episodes} bölüm` : ""].filter(Boolean).join(" · ") || undefined,
      thumb: m.coverImage?.medium || null,
    } as Found;
  }) };
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

// ---------- Ortak katalog: kullanıcıların elle / linkle eklediği içerikler (her biri bir kez) ----------

export const catalogFound = (c: CatalogItem): Found => ({
  type: c.type, title: c.title, creator: c.creator, year: c.year, cover: c.cover, rawg_id: null, ext_id: c.ext_id,
  sub: `Ancalog'a eklenmiş${c.creator ? ` · ${c.creator}` : ""}`, thumb: c.cover, custom: true,
});

export async function searchCatalog(type: EntryType, text: string): Promise<Found[]> {
  const rows = await q<CatalogItem[]>(sb().from("catalog").select("*").eq("type", type)
    .ilike("title", `%${likeEsc(text)}%`).order("created_at").limit(5)).catch(() => []); // tablo yoksa (SQL çalışmadan) sessiz geç
  return rows.map(catalogFound);
}

// Elle / linkle girilen içeriği kataloğa yaz; aynısı varsa yenisi açılmaz, var olan (yöneticinin düzelttiği hâli) döner
export async function addCatalog(x: Item): Promise<CatalogItem> {
  const { data, error } = await sb().rpc("add_catalog", {
    p_type: x.type, p_title: x.title, p_creator: x.creator || null, p_year: x.year || null, p_cover: x.cover || null, p_ext_id: x.ext_id || null,
  });
  if (error) throw new Error(error.message);
  return data as CatalogItem;
}

// ---------- Yöneticinin içerik sayfasında yaptığı düzeltmeler ----------

// Oyunlarda g:<rawg id>, diğerlerinde tür:isim (contentKey ile aynı)
export const fetchPageEdit = (key: string) =>
  q<{ data: PageEdit } | null>(sb().from("content_edits").select("data").eq("key", key).maybeSingle())
    .then((r) => r?.data || {}).catch(() => ({} as PageEdit));

// Bir türde içerik ara: oyunda IGDB, müzikte iTunes + Deezer, film/dizide TMDB, animede AniList.
// Oyun dışında kullanıcıların daha önce eklediği içerikler de en üstte çıkar (aynı şey iki kez eklenmesin diye).
export async function findContent(type: EntryType, text: string): Promise<Found[]> {
  if (type === "game") return searchGames(text, 20); // öneri kutusu kaydırılır, aranan oyun ilk 6da olmayabilir
  const source = type === "music" ? (isLink(text) ? fromLink(text).then((f) => (f ? [f] : [])) : searchMusic(text))
    : type === "anime" ? searchAnime(text).catch(() => searchLogged(type, text))
    : searchTmdb(type, text).catch(() => searchLogged(type, text));
  const [ours, theirs] = await Promise.all([isLink(text) ? Promise.resolve([]) : searchCatalog(type, text), source]);
  const seen = new Set(ours.map((f) => `${norm(f.title)}|${norm(f.creator)}`));
  return [...ours, ...theirs.filter((f) => !seen.has(`${norm(f.title)}|${norm(f.creator)}`))].slice(0, 12);
}
// Dizi ve anime birlikte (Ayarlar'da seçen için): TMDB ve AniList aynı anda aranır; Japonca, İngilizce, Türkçe adla bulunur.
// Seçilen sonucun türü kaynağından gelir (AniList → anime, TMDB → dizi), veritabanında türler ayrı kalır.
export async function findShowOrAnime(text: string): Promise<Found[]> {
  const [shows, animes] = await Promise.all([findContent("show", text).catch(() => [] as Found[]), findContent("anime", text).catch(() => [] as Found[])]);
  const out: Found[] = [];
  for (let i = 0; out.length < 14 && (i < shows.length || i < animes.length); i++) {
    if (animes[i]) out.push({ ...animes[i], sub: ["Anime", animes[i].sub].filter(Boolean).join(" · ") });
    if (shows[i]) out.push({ ...shows[i], sub: ["Dizi", shows[i].sub].filter(Boolean).join(" · ") });
  }
  return out;
}

// Sadece dış kaynakta ara (ortak katalog hariç): elle eklenen içeriği gerçek karşılığına bağlarken
export async function searchSource(type: EntryType, text: string): Promise<Found[]> {
  if (type === "game") return searchGames(text, 12);
  if (type === "music") return searchMusic(text);
  if (type === "anime") return searchAnime(text);
  return searchTmdb(type, text);
}

export const SEARCH_CREDITS: Record<EntryType, [string, string]> = {
  game: ["IGDB", "https://www.igdb.com"],
  music: ["Apple Music · Deezer", "https://www.deezer.com"],
  movie: ["TMDB", "https://www.themoviedb.org"],
  show: ["TMDB", "https://www.themoviedb.org"],
  anime: ["AniList · MyAnimeList", "https://anilist.co"],
};
export const searchCredit = (type: EntryType) => SEARCH_CREDITS[type];

export const typeLabel = (t: EntryType) => TYPES[t].label;

// Akıllı bildirim: takip ettiklerin, senin planladığın bir şeyi bitirdi ya da başladı
export async function friendsOnMyPlans(following: string[], mine: Entry[]): Promise<Entry[]> {
  const planned = new Set(mine.filter((e) => e.status === "planned").map(contentKey));
  if (!following.length || !planned.size) return [];
  const rows = await q<Entry[]>(sb().from("entries").select(ENTRY_COLS).in("user_id", following).in("status", ["completed", "active"])
    .order("updated_at", { ascending: false }).limit(150));
  return rows.filter((e) => planned.has(contentKey(e)));
}

// Arkadaş önerileri: takip ettiklerinin 9 ve üstü puan verdiği, senin kütüphanende olmayan şeyler.
// Aynı şeyi kaç kişi sevmişse o kadar öne çıkar.
export interface FriendPick { e: Entry; by: Entry[] }
export async function friendPicks(following: string[], mine: Entry[]): Promise<FriendPick[]> {
  if (!following.length) return [];
  const have = new Set(mine.map(contentKey));
  const haveExt = new Set(mine.map((e) => e.ext_id).filter(Boolean));
  const rows = await q<Entry[]>(sb().from("entries").select(ENTRY_COLS).in("user_id", following).gte("rating", 9)
    .order("updated_at", { ascending: false }).limit(300));
  const groups = new Map<string, FriendPick>();
  for (const e of rows) {
    const k = contentKey(e);
    if (have.has(k) || (e.ext_id && haveExt.has(e.ext_id))) continue;
    const g = groups.get(k);
    if (!g) groups.set(k, { e, by: [e] });
    else if (!g.by.some((x) => x.user_id === e.user_id)) { g.by.push(e); if (!g.e.cover && e.cover) g.e = e; }
  }
  return [...groups.values()].sort((a, b) => b.by.length - a.by.length
    || Math.max(...b.by.map((x) => x.rating || 0)) - Math.max(...a.by.map((x) => x.rating || 0))).slice(0, 18);
}

// Keşfet önerileri: sana en uyumlu kişilerin çok sevdiği (8+), sende olmayan şeyler. Sayılar sunucuda, profildeki Uyum ile aynı hesapla.
export async function tastePicks(me: string, mine: Entry[], blocked: Set<string>): Promise<FriendPick[]> {
  if (mine.length < 3) return [];
  const rows = await q<{ user_id: string; common: number; rated: number; diff_sum: number; total: number }[]>(sb().rpc("compat_stats", { p_user: me }));
  const totals = new Map<string, { common: number; rated: number; diff: number; total: number }>();
  for (const r of rows) {
    const t = totals.get(r.user_id) || { common: 0, rated: 0, diff: 0, total: 0 };
    t.common += r.common; t.rated += r.rated; t.diff += Number(r.diff_sum); t.total += r.total;
    totals.set(r.user_id, t);
  }
  const score = new Map([...totals].filter(([id, t]) => t.common >= 3 && !blocked.has(id))
    .map(([id, t]) => [id, scoreOf(t.common, t.rated, t.diff, mine.length, t.total) ?? 0] as const)
    .filter(([, s]) => s >= 50).sort((a, b) => b[1] - a[1]).slice(0, 25));
  if (!score.size) return [];
  const ids = [...score.keys()];
  // Sahibinin gizlediği türler öneriye de girmez
  const hidden = new Map((await q<{ id: string; hidden_types: string[] | null }[]>(sb().from("profiles").select("id, hidden_types").in("id", ids))).map((p) => [p.id, p.hidden_types || []]));
  const good = await q<Entry[]>(sb().from("entries").select(ENTRY_COLS).in("user_id", ids).gte("rating", 8).order("updated_at", { ascending: false }).limit(600));
  const have = new Set(mine.map(contentKey));
  const haveExt = new Set(mine.map((e) => e.ext_id).filter(Boolean));
  const groups = new Map<string, FriendPick & { w: number }>();
  for (const e of good) {
    const k = contentKey(e);
    if (have.has(k) || (e.ext_id && haveExt.has(e.ext_id)) || hidden.get(e.user_id)?.includes(e.type)) continue;
    const g = groups.get(k) || { e, by: [], w: 0 };
    if (g.by.some((x) => x.user_id === e.user_id)) continue;
    g.by.push(e);
    g.w += (score.get(e.user_id)! / 100) * Number(e.rating); // uyumlu kişinin yüksek puanı daha ağır basar
    if (!g.e.cover && e.cover) g.e = e;
    groups.set(k, g);
  }
  return [...groups.values()].sort((a, b) => b.w - a.w).slice(0, 18);
}

// İçe aktarmada albüm / şarkı kapağı bul: önce Deezer, olmazsa Apple Music
export async function musicMeta(kind: "album" | "track", artist: string, title: string): Promise<{ cover: string | null; year: number | null }> {
  const text = `${artist} ${title}`.slice(0, 200);
  const dz = (await deezer(kind, text, 1).catch(() => []))[0];
  const dzCover = kind === "album" ? dz?.cover_xl : dz?.album?.cover_xl;
  if (dzCover) return { cover: dzCover, year: null };
  const it = (await itunes(text, kind === "album" ? "album" : "song", 1).catch(() => []))[0];
  return { cover: it?.artworkUrl100 ? bigArtwork(it.artworkUrl100) : null, year: parseInt(it?.releaseDate || "") || null };
}

// Eski kayıtlarda Japonca / Korece gibi okunmayan film ve dizi adlarını İngilizce adıyla düzelt (kişi kendi kayıtlarını, bir kez)
export async function fixForeignTitles(mine: Entry[]) {
  const bad = mine.filter((e) => (e.type === "movie" || e.type === "show") && e.ext_id?.startsWith("tmdb:") && NON_LATIN.test(e.title)).slice(0, 60);
  for (const e of bad) {
    const d = await tmdbDetail(e.ext_id!).catch(() => null);
    const title = d?.title || d?.name;
    if (title && !NON_LATIN.test(title)) await sb().from("entries").update({ title: title.slice(0, 200) }).eq("id", e.id);
  }
  return bad.length;
}
