import type { FormGame, RawgGame } from "./types";
import { norm, smallImage } from "./format";

// RAWG'ye doğrudan değil, anahtarı saklayan /api/rawg üzerinden sorulur
export async function rawg<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ path, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`/api/rawg?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  const data = await r.json();
  if (Array.isArray(data?.results)) data.results = data.results.filter((g: RawgGame) => !RAWG_MOVED[g.id]);
  return data;
}

// RAWG'deki sahte kopyalar: aramada hiç çıkmasın, eski linkler gerçek oyuna gitsin ("God Of War" 2023 → God of War 2018)
export const RAWG_MOVED: Record<number, number> = { 930477: 58175 };

// Bir ağ hatası aramayı boş bırakmasın: bir kez daha dene
export async function retry<T>(fn: () => Promise<T>): Promise<T> {
  try { return await fn(); } catch {
    await new Promise((r) => setTimeout(r, 700));
    return fn();
  }
}

// Ada göre doğru oyunu seç: sondaki "(2018)" sayılmaz, aynı adlılardan önce yılı tutan, sonra en çok kişinin eklediği
export function bestGame(found: RawgGame[], name: string, year?: number | null): RawgGame | null {
  const key = (s: string) => norm(s).replace(/\s*\((19|20)\d\d\)\s*$/, "");
  const same = found.filter((g) => key(g.name) === key(name));
  if (!same.length) return null;
  const inYear = year ? same.filter((g) => parseInt(g.released || "") === year) : [];
  return [...(inYear.length ? inYear : same)].sort((a, b) => (b.added || 0) - (a.added || 0))[0];
}

export function gameFromRawg(g: RawgGame): FormGame {
  return {
    rawg_id: g.id,
    title: g.name,
    year: parseInt(g.released || "") || null,
    cover: g.background_image ? smallImage(g.background_image) : null,
    creator: (g.developers || []).map((d) => d.name).join(", ") || null,
    platforms: (g.platforms || []).map((p) => p.platform.name),
    stores: (g.stores || []).map((s) => s.store.name),
  };
}
