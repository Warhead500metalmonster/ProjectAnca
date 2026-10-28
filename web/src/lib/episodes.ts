import type { Entry } from "./types";
import { anilist, tmdb } from "./data";
import { today } from "./format";
import { q, sb } from "./supabase";

// İzlenen bölümler: { "1": [1, 2, 3], "2": [1] } (sezon → bölüm numaraları). Animede tek sezon "1".
export type Eps = Record<string, number[]>;

export const countEps = (e?: Eps | null) => Object.values(e || {}).reduce((n, a) => n + a.length, 0);

// Sıradaki bölüm: izlenen son sezonun son bölümünden bir sonrası
export function nextEp(e?: Eps | null): [number, number] {
  const seasons = Object.keys(e || {}).map(Number).filter((s) => (e![String(s)] || []).length).sort((a, b) => a - b);
  if (!seasons.length) return [1, 1];
  const s = seasons[seasons.length - 1];
  return [s, Math.max(...e![String(s)]) + 1];
}

export function toggleEp(e: Eps, season: number, ep: number, on?: boolean): Eps {
  const key = String(season);
  const set = new Set(e[key] || []);
  if (on ?? !set.has(ep)) set.add(ep); else set.delete(ep);
  const next = { ...e, [key]: [...set].sort((a, b) => a - b) };
  if (!next[key].length) delete next[key];
  return next;
}

export const markSeason = (e: Eps, season: number, count: number): Eps => ({ ...e, [String(season)]: Array.from({ length: count }, (_, i) => i + 1) });

// Sezon başına bölüm sayısı: TMDB (dizi) ya da AniList (anime). Elle eklenenlerde bilinmez, hata fırlatır.
export async function seasonCounts(e: Pick<Entry, "ext_id">): Promise<Record<string, number>> {
  const ext = e.ext_id || "";
  if (ext.startsWith("tmdb:tv:")) {
    const d = await tmdb<{ seasons?: { season_number: number; episode_count: number }[] }>(`tv/${ext.split(":")[2]}`);
    const out: Record<string, number> = {};
    for (const s of d.seasons || []) if (s.season_number > 0 && s.episode_count > 0) out[String(s.season_number)] = s.episode_count;
    if (Object.keys(out).length) return out;
  }
  if (ext.startsWith("anilist:")) {
    const d = await anilist<{ Media: { episodes: number | null; nextAiringEpisode: { episode: number } | null } }>(
      "query ($id: Int) { Media(id: $id, type: ANIME) { episodes nextAiringEpisode { episode } } }", { id: Number(ext.slice(8)) });
    const n = d.Media.episodes ?? (d.Media.nextAiringEpisode ? d.Media.nextAiringEpisode.episode - 1 : 0);
    if (n > 0) return { "1": n };
  }
  throw new Error("bölüm sayısı bilinmiyor");
}

// Kaydeder. İlk bölümde "planlandı" → "devam ediyor", hepsi bitince "bitti". Akışta gürültü olmasın diye sadece durum değişince güncelleme zamanı yenilenir.
export async function saveEpisodes(e: Pick<Entry, "id" | "status" | "date">, eps: Eps, total: number | null): Promise<Entry["status"]> {
  const done = countEps(eps);
  let status = e.status;
  if (total && done >= total) status = "completed";
  else if (done > 0 && e.status === "planned") status = "active";
  const patch: Record<string, unknown> = { episodes: eps };
  if (status !== e.status) {
    patch.status = status;
    patch.updated_at = new Date().toISOString();
    if (status === "completed" && !e.date) patch.date = today();
  }
  await q(sb().from("entries").update(patch).eq("id", e.id));
  return status;
}
