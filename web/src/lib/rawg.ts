import type { FormGame, RawgGame } from "./types";
import { smallImage } from "./format";

// RAWG'ye doğrudan değil, anahtarı saklayan /api/rawg üzerinden sorulur
export async function rawg<T>(path: string, params: Record<string, string | number> = {}): Promise<T> {
  const qs = new URLSearchParams({ path, ...Object.fromEntries(Object.entries(params).map(([k, v]) => [k, String(v)])) });
  const r = await fetch(`/api/rawg?${qs}`);
  if (!r.ok) throw new Error(String(r.status));
  return r.json();
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
