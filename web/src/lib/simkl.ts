// Simkl'dan içe aktarma: Simkl'ın yedek dosyası (ZIP içinde JSON, ya da CSV) ya da kodla bağlanınca gelen liste.
// Her kayıt doğru sayfaya bağlansın diye: TMDB numarası varsa o, yoksa IMDb numarasından TMDB bulunur; animede AniList, yoksa MyAnimeList numarasından AniList.
import type { Status } from "./types";
import { anilist, tmdb, tmdbImage } from "./data";

export interface SimklItem {
  type: "show" | "movie" | "anime"; title: string; year: number | null; status: Status; rating: number; date: string | null; cover: string | null;
  ext_id: string | null; imdb?: string | null; mal?: number | null; episode?: number | null; episodes_total?: number | null;
}

const STATUS: Record<string, Status> = {
  watching: "active", plantowatch: "planned", "plan to watch": "planned", plan_to_watch: "planned", completed: "completed", watched: "completed",
  hold: "paused", "on hold": "paused", onhold: "paused", dropped: "dropped", notinteresting: "dropped",
};
const statusOf = (s: unknown) => STATUS[String(s || "").toLowerCase().replace(/[-]/g, " ").trim()] || STATUS[String(s || "").toLowerCase().replace(/[\s_-]/g, "")] || null;
const num = (x: unknown) => { const n = Number(x); return Number.isFinite(n) && n > 0 ? n : null; };
const day = (x: unknown) => (typeof x === "string" && /^\d{4}-\d\d-\d\d/.test(x) ? x.slice(0, 10) : null);
const poster = (p: unknown) => (typeof p === "string" && p ? (/^https?:/.test(p) ? p : `https://simkl.in/posters/${p}_m.jpg`) : null);

type Ids = Record<string, unknown>;
function item(kind: SimklItem["type"], it: Record<string, unknown>): SimklItem | null {
  const m = ((it.show || it.movie || it.anime || it) as Record<string, unknown>) || {};
  const title = String(m.title || m.name || "").trim();
  const status = statusOf(it.status ?? it.watchlist ?? it.list);
  if (!title || !status) return null;
  const ids = (m.ids || {}) as Ids;
  const tmdbId = num(ids.tmdb), ani = num(ids.anilist), mal = num(ids.mal);
  const ext = kind === "movie" ? (tmdbId ? `tmdb:movie:${tmdbId}` : null) : kind === "show" ? (tmdbId ? `tmdb:tv:${tmdbId}` : null) : ani ? `anilist:${ani}` : null;
  const rating = Math.max(0, Math.min(10, Math.round(Number(it.user_rating ?? it.rating ?? 0) || 0)));
  const last = day(it.last_watched_at ?? it.watched_at ?? it.last_watched);
  return {
    type: kind, title, year: num(m.year), status, rating, date: status === "completed" ? last : null, cover: poster(m.poster), ext_id: ext,
    imdb: typeof ids.imdb === "string" ? ids.imdb : null, mal,
    episode: kind === "movie" ? null : num(it.watched_episodes_count), episodes_total: kind === "movie" ? null : num(it.total_episodes_count),
  };
}

// Yedek dosyasındaki ya da bağlanınca gelen JSON: {shows: [...], movies: [...], anime: [...]} (iç içe de olabilir)
export function fromSimklJson(data: unknown): SimklItem[] {
  const out: SimklItem[] = [];
  const kindOf = (key: string): SimklItem["type"] | null => /movie/i.test(key) ? "movie" : /anime/i.test(key) ? "anime" : /show|tv|series/i.test(key) ? "show" : null;
  const walk = (node: unknown, kind: SimklItem["type"] | null, depth: number) => {
    if (!node || depth > 6) return;
    if (Array.isArray(node)) {
      for (const x of node) {
        if (x && typeof x === "object") {
          const o = x as Record<string, unknown>;
          const k = o.movie ? "movie" : o.anime ? "anime" : o.show ? (kind || "show") : kind;
          const got = k && (o.status || o.watchlist) ? item(k, o) : null;
          if (got) out.push(got); else walk(x, kind, depth + 1);
        }
      }
      return;
    }
    if (typeof node === "object") for (const [key, v] of Object.entries(node as Record<string, unknown>)) walk(v, kindOf(key) || kind, depth + 1);
  };
  walk(data, null, 0);
  return out;
}

// CSV yedeği: başlık adları farklı yazılabilir, en yakını bulunur
export function fromSimklCsv(rows: Record<string, string>[]): SimklItem[] {
  const pick = (r: Record<string, string>, ...names: string[]) => {
    for (const [k, v] of Object.entries(r)) if (names.includes(k.toLowerCase().replace(/[^a-z]/g, ""))) return v;
    return "";
  };
  return rows.map((r) => {
    const t = pick(r, "type", "kind", "category").toLowerCase();
    const kind: SimklItem["type"] = /movie|film/.test(t) ? "movie" : /anime/.test(t) ? "anime" : "show";
    const tm = pick(r, "tmdb", "tmdbid"), ani = pick(r, "anilist", "anilistid"), mal = pick(r, "mal", "malid", "myanimelist");
    return item(kind, {
      status: pick(r, "watchlist", "status", "list", "watchliststatus"), user_rating: pick(r, "rating", "userrating", "myrating"),
      last_watched_at: pick(r, "watcheddate", "lastwatched", "lastwatchedat", "date", "watchedat"),
      watched_episodes_count: pick(r, "watchedepisodes", "episodeswatched", "lastepwatched"), total_episodes_count: pick(r, "totalepisodes", "episodes"),
      show: { title: pick(r, "title", "name"), year: pick(r, "year", "releaseyear"), poster: "",
        ids: { tmdb: tm, anilist: ani, mal, imdb: pick(r, "imdb", "imdbid") } },
    });
  }).filter((x): x is SimklItem => !!x);
}

// Numarası eksik olanları bağla: IMDb → TMDB, MyAnimeList → AniList (kapak da gelir)
export async function resolveSimkl(items: SimklItem[], onStep?: (done: number, total: number) => void): Promise<SimklItem[]> {
  const needImdb = items.filter((x) => !x.ext_id && x.type !== "anime" && x.imdb);
  const needMal = items.filter((x) => !x.ext_id && x.type === "anime" && x.mal);
  const total = needImdb.length + needMal.length;
  let done = 0;
  for (let i = 0; i < needMal.length; i += 50) {
    const part = needMal.slice(i, i + 50);
    const got = await anilist<{ Page: { media: { id: number; idMal: number; coverImage?: { large?: string } }[] } }>(
      "query ($ids: [Int]) { Page(perPage: 50) { media(idMal_in: $ids, type: ANIME) { id idMal coverImage { large } } } }", { ids: part.map((x) => x.mal) }).catch(() => null);
    for (const m of got?.Page.media || []) for (const x of part) if (x.mal === m.idMal) { x.ext_id = `anilist:${m.id}`; x.cover ||= m.coverImage?.large || null; }
    done += part.length;
    onStep?.(done, total);
  }
  for (let i = 0; i < needImdb.length; i += 6) {
    await Promise.all(needImdb.slice(i, i + 6).map(async (x) => {
      const d = await tmdb<{ movie_results?: { id: number; poster_path?: string }[]; tv_results?: { id: number; poster_path?: string }[] }>(`find/${x.imdb}`, { external_source: "imdb_id" }).catch(() => null);
      const hit = x.type === "movie" ? d?.movie_results?.[0] : d?.tv_results?.[0];
      if (hit) { x.ext_id = `tmdb:${x.type === "movie" ? "movie" : "tv"}:${hit.id}`; x.cover ||= tmdbImage(hit.poster_path); }
    }));
    done += Math.min(6, needImdb.length - i);
    onStep?.(done, total);
  }
  return items;
}

// ---------- ZIP içinden JSON okuma (Simkl yedeği .zip gelir): tarayıcının kendi açıcısıyla, ek kütüphane yok ----------
export async function jsonFromZip(file: Blob): Promise<unknown[]> {
  const buf = new Uint8Array(await file.arrayBuffer());
  const view = new DataView(buf.buffer);
  const out: unknown[] = [];
  // Merkez dizinin sonunu bul (dosyanın sonundan geriye)
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 66000); i--) if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  if (eocd < 0) throw new Error("ZIP dosyası okunamadı");
  const count = view.getUint16(eocd + 10, true);
  let p = view.getUint32(eocd + 16, true);
  for (let n = 0; n < count; n++) {
    if (view.getUint32(p, true) !== 0x02014b50) break;
    const method = view.getUint16(p + 10, true), size = view.getUint32(p + 20, true);
    const nameLen = view.getUint16(p + 28, true), extraLen = view.getUint16(p + 30, true), commentLen = view.getUint16(p + 32, true);
    const local = view.getUint32(p + 42, true);
    const name = new TextDecoder().decode(buf.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + commentLen;
    if (!/\.(json|csv)$/i.test(name)) continue;
    const start = local + 30 + view.getUint16(local + 26, true) + view.getUint16(local + 28, true);
    const raw = buf.subarray(start, start + size);
    let bytes: Uint8Array;
    if (method === 0) bytes = raw;
    else if (method === 8) bytes = new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream("deflate-raw"))).arrayBuffer());
    else continue;
    const text = new TextDecoder().decode(bytes);
    if (/\.json$/i.test(name)) { try { out.push(JSON.parse(text)); } catch { /* bozuksa geç */ } }
    else out.push({ __csv: text });
  }
  return out;
}
