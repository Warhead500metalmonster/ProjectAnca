// Çıkış takvimi: planladığın oyunların, filmlerin çıkış günü; izlediğin dizilerin ve animelerin bir sonraki bölümü.
// Tarihler RAWG, TMDB ve AniList'ten gelir; günde iki kez tazelenir (tarayıcıda saklanır, kimseye gönderilmez).
import type { Entry, RawgGame } from "./types";
import { anilist, tmdbDetail } from "./data";
import { rawg } from "./rawg";
import { today } from "./format";

export interface Upcoming { id: string; date: string; what: string } // date: YYYY-MM-DD
const TTL = 12 * 3600 * 1000;
const key = (uid: string) => `ancalog.upcoming.${uid}`;

async function pool<T, R>(items: T[], fn: (x: T) => Promise<R>, n = 4): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(Array.from({ length: n }, async () => { while (next < items.length) { const i = next++; out[i] = await fn(items[i]); } }));
  return out;
}

const day = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function loadUpcoming(mine: Entry[]): Promise<Upcoming[]> {
  const now = today();
  const out: Upcoming[] = [];
  const add = (e: Entry, date: string | null | undefined, what: string) => { if (date && date >= now) out.push({ id: e.id, date: date.slice(0, 10), what }); };
  const want = (e: Entry) => e.status === "planned" || e.status === "active" || e.status === "paused";

  const games = mine.filter((e) => e.type === "game" && e.status === "planned" && e.rawg_id).slice(0, 40);
  const movies = mine.filter((e) => e.type === "movie" && e.status === "planned" && e.ext_id?.startsWith("tmdb:movie:")).slice(0, 40);
  const shows = mine.filter((e) => e.type === "show" && want(e) && e.ext_id?.startsWith("tmdb:tv:")).slice(0, 40);
  const anime = mine.filter((e) => e.type === "anime" && want(e) && e.ext_id?.startsWith("anilist:")).slice(0, 50);

  await Promise.all([
    pool(games, async (e) => {
      const g = await rawg<RawgGame & { tba?: boolean }>(`games/${e.rawg_id}`).catch(() => null);
      if (g && !g.tba) add(e, g.released, "Çıkıyor");
    }),
    pool([...movies, ...shows], async (e) => {
      const d = await tmdbDetail(e.ext_id!).catch(() => null);
      if (!d) return;
      if (e.type === "movie") return add(e, d.release_date, "Vizyonda");
      const n = d.next_episode_to_air;
      if (n?.air_date) add(e, n.air_date, `${n.season_number}. sezon ${n.episode_number}. bölüm`);
      else if (e.status === "planned") add(e, d.first_air_date, "Başlıyor");
    }),
    (async () => {
      if (!anime.length) return;
      type M = { id: number; nextAiringEpisode?: { airingAt: number; episode: number } | null; startDate?: { year?: number; month?: number; day?: number } };
      const ids = anime.map((e) => Number(e.ext_id!.split(":")[1])).filter(Boolean);
      const data = await anilist<{ Page: { media: M[] } }>(
        "query ($ids: [Int]) { Page(perPage: 50) { media(id_in: $ids) { id nextAiringEpisode { airingAt episode } startDate { year month day } } } }", { ids },
      ).catch(() => null);
      for (const m of data?.Page.media || []) {
        const e = anime.find((x) => x.ext_id === `anilist:${m.id}`);
        if (!e) continue;
        if (m.nextAiringEpisode) add(e, day(new Date(m.nextAiringEpisode.airingAt * 1000)), `${m.nextAiringEpisode.episode}. bölüm`);
        else if (e.status === "planned" && m.startDate?.year && m.startDate.month && m.startDate.day)
          add(e, `${m.startDate.year}-${String(m.startDate.month).padStart(2, "0")}-${String(m.startDate.day).padStart(2, "0")}`, "Başlıyor");
      }
    })(),
  ]);
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

// Tarayıcıda saklanan liste: taze değilse (ya da force) yeniden hesaplanır
export async function upcoming(uid: string, mine: Entry[], force = false): Promise<Upcoming[]> {
  try {
    const c = JSON.parse(localStorage.getItem(key(uid)) || "null") as { at: number; items: Upcoming[] } | null;
    if (c && !force && Date.now() - c.at < TTL) return c.items.filter((u) => u.date >= today());
  } catch { /* yeniden hesapla */ }
  const items = await loadUpcoming(mine);
  try { localStorage.setItem(key(uid), JSON.stringify({ at: Date.now(), items })); } catch { /* yok say */ }
  return items;
}

// Bugün çıkanlar için bir kez hatırlatma (aynı gün aynı şey için tekrar söylenmez)
export function dueToday(uid: string, items: Upcoming[]): Upcoming[] {
  const k = `ancalog.reminded.${uid}`;
  const now = today();
  let seen: string[] = [];
  try { seen = (JSON.parse(localStorage.getItem(k) || "[]") as string[]).filter((x) => x.endsWith(now)); } catch { /* yok say */ }
  const due = items.filter((u) => u.date === now && !seen.includes(`${u.id}:${now}`));
  try { localStorage.setItem(k, JSON.stringify([...seen, ...due.map((u) => `${u.id}:${now}`)])); } catch { /* yok say */ }
  return due;
}

const DAY = 86400000;

// "Bugün", "Yarın", "3 gün sonra · 1 Kasım Cumartesi"
export function whenText(date: string) {
  const d = new Date(date + "T00:00"), t = new Date(today() + "T00:00");
  const n = Math.round((d.getTime() - t.getTime()) / DAY);
  const name = d.toLocaleDateString("tr", { day: "numeric", month: "long", weekday: "long", ...(d.getFullYear() !== t.getFullYear() && { year: "numeric" }) });
  return n === 0 ? `Bugün · ${name}` : n === 1 ? `Yarın · ${name}` : n < 30 ? `${n} gün sonra · ${name}` : name;
}
