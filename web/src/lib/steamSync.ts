// Steam otomatik senkron: kişi açarsa Steam kimliği steam_links'te (sadece kendisi görür) durur,
// siteyi açtığında günde en fazla bir kez arka planda oynama süreleri tazelenir, son senkrondan beri oynadığı yeni oyunlar Kategorisiz eklenir.
// Kütüphaneden silinen oyunlar geri gelmez: sadece son senkrondan sonra oynanmış yeni oyunlar eklenir.
import type { Entry, RawgGame } from "./types";
import { norm, smallImage } from "./format";
import { rawg } from "./rawg";
import { q, sb } from "./supabase";

export interface SteamGame { appid: number; name: string; minutes: number; last: number }

const DAY = 20 * 3600 * 1000; // günde bir (biraz erken davranır, her sabah tazelensin)
const key = (uid: string) => `ancalog.steamSync.${uid}`;

// Steam oyununu kayıt satırına çevir: RAWG'de bulunursa oyun sayfası, kapak ve çıkış yılı da gelir
export function steamRow(g: SteamGame, hit: RawgGame | null | undefined, status: Entry["status"] = "owned") {
  return {
    type: "game" as const, title: (hit?.name || g.name).slice(0, 200), rawg_id: hit?.id ?? null, ext_id: `steam:${g.appid}`,
    year: parseInt(hit?.released || "") || null,
    cover: hit?.background_image ? smallImage(hit.background_image) : `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
    status, playtime_sec: g.minutes * 60 || null, hours: g.minutes ? Math.round(g.minutes / 6) / 10 : null,
    platform: "PC", store: "Steam", rating: 0, updated_at: new Date((g.last || Date.now() / 1000) * 1000).toISOString(),
  };
}

export async function steamLink(): Promise<string | null> {
  const rows = await q<{ steam_id: string }[]>(sb().from("steam_links").select("steam_id").limit(1));
  return rows[0]?.steam_id || null;
}

export async function setSteamLink(uid: string, steamId: string | null) {
  if (steamId) {
    await q(sb().from("steam_links").upsert({ user_id: uid, steam_id: steamId }));
    try { localStorage.setItem(key(uid), String(Date.now())); } catch { /* yok say */ }
  } else {
    await q(sb().from("steam_links").delete().eq("user_id", uid));
  }
}

// Gün dolduysa senkronla; değişiklik olduysa ne olduğunu döner
export async function steamAutoSync(uid: string, mine: Entry[]): Promise<{ timed: number; added: string[] } | null> {
  let since = 0;
  try {
    since = Number(localStorage.getItem(key(uid))) || 0;
    if (Date.now() - since < DAY) return null;
  } catch { return null; }
  const id = await steamLink().catch(() => null); // tablo henüz yoksa ya da bağlı değilse sessizce geç
  if (!id) return null;
  try { localStorage.setItem(key(uid), String(Date.now())); } catch { /* yok say */ }

  const r = await fetch(`/api/steam?profile=${id}`);
  if (!r.ok) return null;
  const games: SteamGame[] = (await r.json()).games || [];

  // Oynama süreleri
  const byApp = new Map(games.map((g) => [`steam:${g.appid}`, g]));
  const changes = mine.flatMap((e) => {
    const g = e.ext_id ? byApp.get(e.ext_id) : undefined;
    return g && g.minutes && g.minutes * 60 !== e.playtime_sec ? [{ id: e.id, minutes: g.minutes }] : [];
  });
  for (const c of changes) {
    await sb().from("entries").update({ playtime_sec: c.minutes * 60, hours: Math.round(c.minutes / 6) / 10 }).eq("id", c.id);
  }

  // Son senkrondan sonra oynanan, kütüphanede olmayan oyunlar (ilk senkronda hiçbir şey eklenmez)
  const haveExt = new Set(mine.map((e) => e.ext_id).filter(Boolean));
  const haveTitle = new Set(mine.filter((e) => e.type === "game").map((e) => norm(e.title)));
  const haveRawg = new Set(mine.map((e) => e.rawg_id).filter(Boolean));
  const fresh = since ? games.filter((g) => g.minutes > 0 && g.last * 1000 > since && !haveExt.has(`steam:${g.appid}`) && !haveTitle.has(norm(g.name))).slice(0, 20) : [];
  const added: string[] = [];
  for (const g of fresh) {
    const found = (await rawg<{ results?: RawgGame[] }>("games", { search: g.name, search_precise: "true", page_size: 3 }).catch(() => ({ results: [] }))).results || [];
    const hit = found.find((x) => norm(x.name) === norm(g.name));
    if (hit && haveRawg.has(hit.id)) continue;
    const { error } = await sb().from("entries").insert({ ...steamRow(g, hit), user_id: uid });
    if (!error) added.push(hit?.name || g.name);
  }
  return changes.length || added.length ? { timed: changes.length, added } : null;
}
