// Bir sayfaya bağlı olmayan kayıtlar: oyun verileri yeni kaynağa (IGDB) taşınınca eski numarası karşılık bulamayan ya da hiç numarası olmayan
// oyunlar; film, dizi, animede kaynağı (TMDB / AniList) olmayan, elle ya da içe aktarmayla adıyla gelmiş kayıtlar.
import type { Entry } from "./types";
import { q, sb } from "./supabase";

export async function unlinkedOf(mine: Entry[]): Promise<Entry[]> {
  const games = mine.filter((e) => e.type === "game");
  const old = [...new Set(games.filter((e) => e.rawg_id && e.rawg_id > 0).map((e) => e.rawg_id!))];
  const mapped = new Set<number>();
  try {
    for (let i = 0; i < old.length; i += 300) {
      const rows = await q<{ rawg_id: number }[]>(sb().from("game_map").select("rawg_id").in("rawg_id", old.slice(i, i + 300)));
      rows.forEach((r) => mapped.add(r.rawg_id));
    }
  } catch {
    old.forEach((id) => mapped.add(id)); // eşleştirme tablosu okunamadıysa kimseyi boşuna uyarma
  }
  return mine.filter((e) => e.type === "game"
    ? !e.rawg_id || (e.rawg_id > 0 && !mapped.has(e.rawg_id))
    : (e.type === "movie" || e.type === "show" || e.type === "anime") && !e.ext_id);
}

// "Böyle kalsın" denenler: tekrar uyarılmaz (tarayıcıda, kişi başına)
const skipKey = (uid: string) => `ancalog.fixSkip.${uid}`;
export function skipped(uid: string): Set<string> {
  try { return new Set(JSON.parse(localStorage.getItem(skipKey(uid)) || "[]")); } catch { return new Set(); }
}
export function skip(uid: string, ids: string[]) {
  const s = skipped(uid);
  ids.forEach((id) => s.add(id));
  try { localStorage.setItem(skipKey(uid), JSON.stringify([...s].slice(-5000))); } catch { /* yok say */ }
}

export function resetSkips(uid: string) {
  try { localStorage.removeItem(skipKey(uid)); } catch { /* yok say */ }
}

// Kütüphane sekmesi ve uyarı aynı sayıyı göstersin
let current: { uid: string; n: number } | null = null;
const subs = new Set<() => void>();
export const unlinkedCount = (uid?: string | null) => (current && current.uid === uid ? current.n : 0);
export const onUnlinked = (fn: () => void) => { subs.add(fn); return () => { subs.delete(fn); }; };
export function setUnlinked(uid: string, n: number) { current = { uid, n }; subs.forEach((f) => f()); }
