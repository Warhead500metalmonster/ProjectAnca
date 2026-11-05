// İçeriğin farklı dillerdeki adı ve kapağı: /api/titles?ids=tmdb:movie:603,tmdb:tv:1396,anilist:154587
// Ayarlar → Görünüm'de "film adları İngilizce, anime Japonca" gibi seçenler için. Her içerik bir hafta önbellekte kalır.
// Dönen: { "tmdb:movie:603": { tr: { title, cover }, en: {...}, orig: {...} }, "anilist:1": { en, romaji, orig } }
type Loc = { title?: string; cover?: string | null };
type Out = Record<string, Partial<Record<"tr" | "en" | "orig" | "romaji", Loc>>>;

const WEEK = 604800;
const IMG = (p?: string | null) => (p ? `https://image.tmdb.org/t/p/w500${p}` : null);

interface TmdbFull {
  title?: string; name?: string; original_title?: string; original_name?: string; original_language?: string; poster_path?: string | null;
  translations?: { translations?: { iso_639_1: string; data?: { title?: string; name?: string } }[] };
  images?: { posters?: { iso_639_1: string | null; file_path: string; vote_average?: number }[] };
}

async function tmdbOne(ext: string): Promise<Out[string] | null> {
  const [, kind, id] = ext.split(":");
  if (!/^(movie|tv)$/.test(kind) || !/^\d+$/.test(id) || !process.env.TMDB_KEY) return null;
  const qs = new URLSearchParams({ api_key: process.env.TMDB_KEY, language: "en-US", append_to_response: "translations,images", include_image_language: "en,tr,ja,ko,zh,null" });
  const r = await fetch(`https://api.themoviedb.org/3/${kind}/${id}?${qs}`, { next: { revalidate: WEEK } }).catch(() => null);
  if (!r?.ok) return null;
  const d: TmdbFull = await r.json();
  const tr = (d.translations?.translations || []).find((t) => t.iso_639_1 === "tr")?.data;
  const poster = (lang: string | null) => (d.images?.posters || []).filter((p) => p.iso_639_1 === lang).sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0))[0]?.file_path;
  const en = d.title || d.name;
  const orig = d.original_title || d.original_name;
  return {
    en: { title: en, cover: IMG(poster("en") || d.poster_path) },
    tr: { title: tr?.title || tr?.name || undefined, cover: IMG(poster("tr")) },
    orig: { title: orig, cover: IMG(poster(d.original_language || "") || null) },
  };
}

async function anilist(ids: number[]): Promise<Out> {
  if (!ids.length) return {};
  const r = await fetch("https://graphql.anilist.co", {
    method: "POST", headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({ query: "query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids, type: ANIME) { id title { romaji english native } coverImage { extraLarge } } } }", variables: { ids } }),
    next: { revalidate: WEEK },
  }).catch(() => null);
  if (!r?.ok) return {};
  const media: { id: number; title: { romaji?: string; english?: string; native?: string }; coverImage?: { extraLarge?: string } }[] = (await r.json()).data?.Page?.media || [];
  const out: Out = {};
  for (const m of media) {
    const cover = m.coverImage?.extraLarge || null;
    out[`anilist:${m.id}`] = { en: { title: m.title.english || m.title.romaji, cover }, romaji: { title: m.title.romaji, cover }, orig: { title: m.title.native || m.title.romaji, cover } };
  }
  return out;
}

export async function GET(request: Request) {
  const ids = [...new Set((new URL(request.url).searchParams.get("ids") || "").split(",").map((x) => x.trim()).filter(Boolean))].slice(0, 50);
  const out: Out = {};
  const tmdbIds = ids.filter((x) => /^tmdb:(movie|tv):\d+$/.test(x));
  const aniIds = ids.filter((x) => /^anilist:\d+$/.test(x)).map((x) => Number(x.split(":")[1]));
  // TMDB saniyede 40'tan fazla isteğe kızar: 8'er 8'er
  for (let i = 0; i < tmdbIds.length; i += 8) {
    const part = tmdbIds.slice(i, i + 8);
    const got = await Promise.all(part.map((x) => tmdbOne(x).catch(() => null)));
    part.forEach((x, j) => { if (got[j]) out[x] = got[j]!; });
  }
  Object.assign(out, await anilist(aniIds));
  return Response.json(out, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
