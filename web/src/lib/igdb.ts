// IGDB'den gelen oyunları sitenin kullandığı biçime çevirir (sadece sunucuda çalışır, anahtarlar burada kalır).
// Oyun kimliği: kayıtlardaki rawg_id hiç değişmez. Eski oyunlar game_map tablosuyla IGDB'ye bağlanır;
// tabloda olmayan yeni oyunlar eksi işaretli IGDB numarasıyla kaydedilir (-1020 = IGDB'deki 1020), böylece iki numara karışmaz.
import type { RawgGame, RawgRef } from "./types";
import { norm } from "./format";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

interface Ref { id: number; name: string; slug?: string }
interface Img { image_id: string }
interface IgdbGame {
  id: number; name: string; slug?: string; game_type?: number; first_release_date?: number; summary?: string;
  cover?: Img; artworks?: Img[]; screenshots?: Img[];
  aggregated_rating?: number; total_rating?: number; total_rating_count?: number;
  genres?: Ref[]; platforms?: Ref[];
  involved_companies?: { developer?: boolean; publisher?: boolean; company?: Ref }[];
}

const CARD = "name,slug,game_type,first_release_date,cover.image_id,aggregated_rating,total_rating,total_rating_count,genres.name,genres.slug,platforms.name,platforms.slug";
const FULL = `${CARD},artworks.image_id,summary,involved_companies.developer,involved_companies.publisher,involved_companies.company.name,involved_companies.company.slug`;
// Paketler, modlar, bölümler, sezonlar, güncellemeler aramayı kirletmesin
const REAL_GAMES = "version_parent = null & game_type != (3,5,6,7,12,13,14)";
const SORTS: Record<string, string> = {
  "-added": "total_rating_count desc", "-metacritic": "aggregated_rating desc", "-rating": "total_rating desc",
  "-released": "first_release_date desc", released: "first_release_date asc", name: "name asc",
};
const SHORT_PLATFORMS: Record<string, string> = { "PC (Microsoft Windows)": "PC", "PlayStation Portable": "PSP", "Nintendo Entertainment System": "NES", "Super Nintendo Entertainment System": "SNES" };

let token: { value: string; until: number } | null = null;

async function getToken() {
  if (token && token.until > Date.now()) return token.value;
  const r = await fetch("https://id.twitch.tv/oauth2/token", {
    method: "POST", next: { revalidate: 86400 }, // her sunucu açılışında yeniden istenip aramayı yavaşlatmasın
    body: new URLSearchParams({ client_id: process.env.IGDB_CLIENT_ID!, client_secret: process.env.IGDB_CLIENT_SECRET!, grant_type: "client_credentials" }),
  });
  if (!r.ok) throw new Error(`token ${r.status}`);
  const d: { access_token: string; expires_in: number } = await r.json();
  token = { value: d.access_token, until: Date.now() + (d.expires_in - 3600) * 1000 };
  return token.value;
}

// IGDB saniyede 4 isteğe izin verir: sınıra takılırsa kısa bekleyip yeniden dener
async function ask<T>(endpoint: string, body: string, tries = 4): Promise<{ rows: T[]; count: number }> {
  const r = await fetch(`https://api.igdb.com/v4/${endpoint}`, {
    method: "POST", body, next: { revalidate: 3600 },
    headers: { "Client-ID": process.env.IGDB_CLIENT_ID!, Authorization: `Bearer ${await getToken()}` },
  });
  if (r.status === 401 && tries > 1) { token = null; return ask(endpoint, body, tries - 1); }
  if (r.status === 429 && tries > 1) { await new Promise((ok) => setTimeout(ok, 350)); return ask(endpoint, body, tries - 1); }
  if (!r.ok) throw new Error(`igdb ${r.status}`);
  return { rows: await r.json(), count: Number(r.headers.get("x-count")) || 0 };
}

// Veritabanındaki eşleştirme tablosu. Okunamazsa hata verir: yanlış numarayla yeni kayıt açılıp loglar bölünmesin
async function mapRows(filter: string) {
  const r = await fetch(`${SUPABASE_URL}/rest/v1/game_map?select=rawg_id,igdb_id&order=n.desc&${filter}`, {
    headers: { apikey: SUPABASE_KEY, authorization: `Bearer ${SUPABASE_KEY}` }, next: { revalidate: 60 }, // yönetici eşleştirince kısa sürede görünsün
  });
  if (!r.ok) throw new Error(`game_map ${r.status}`);
  return (await r.json()) as { rawg_id: number; igdb_id: number }[];
}

const image = (id: string | undefined, size: string) => (id ? `https://images.igdb.com/igdb/image/upload/${size}/${id}.jpg` : null);
const ref = (x: Ref): RawgRef => ({ id: x.id, name: SHORT_PLATFORMS[x.name] || x.name, slug: x.slug || String(x.id) });
const companies = (g: IgdbGame, role: "developer" | "publisher") => (g.involved_companies || []).filter((c) => c[role] && c.company).map((c) => ref(c.company!));

function toGame(g: IgdbGame, id: number): RawgGame & { artwork?: string | null; tba?: boolean; igdb_id: number } {
  return {
    id, igdb_id: g.id, name: g.name, slug: g.slug,
    released: g.first_release_date ? new Date(g.first_release_date * 1000).toISOString().slice(0, 10) : null,
    tba: !g.first_release_date,
    background_image: image(g.cover?.image_id, "t_cover_big_2x"),
    artwork: image(g.artworks?.[0]?.image_id, "t_1080p"),
    description_raw: g.summary || "",
    metacritic: g.aggregated_rating ? Math.round(g.aggregated_rating) : null,
    rating: g.total_rating ? g.total_rating / 20 : 0,
    added: g.total_rating_count || 0,
    developers: companies(g, "developer"), publishers: companies(g, "publisher"),
    genres: (g.genres || []).map(ref), platforms: (g.platforms || []).map((p) => ({ platform: ref(p) })), stores: [],
  };
}

async function withIds(list: IgdbGame[]) {
  const map = new Map<number, number>();
  if (list.length) {
    // n'e göre sıralı: iki eski kayıt aynı oyuna bağlıysa en çok logu olan kazanır
    for (const m of (await mapRows(`igdb_id=in.(${list.map((g) => g.id).join(",")})`)).reverse()) map.set(m.igdb_id, m.rawg_id);
  }
  return list.map((g) => toGame(g, map.get(g.id) ?? -g.id));
}

// Yazıyla aramada önce adı tam tutan, sonra adı onunla başlayan, sonra en bilinen; DLC'ler ana oyunun altında kalır
// Noktalama sayılmaz: "demons souls" yazan da "Demon's Souls"u bulsun
const plain = (s: string) => norm(s).replace(/[^\p{L}\p{N}]+/gu, "");
function rankByName(list: IgdbGame[], text: string) {
  const k = plain(text);
  const score = (g: IgdbGame) => { const n = plain(g.name); return g.game_type === 1 ? -1 : n === k ? 3 : n.startsWith(k) ? 2 : n.includes(k) ? 1 : 0; };
  return [...list].sort((a, b) => score(b) - score(a) || (b.total_rating_count || 0) - (a.total_rating_count || 0));
}

function filters(p: URLSearchParams) {
  const w = [REAL_GAMES];
  const num = (k: string) => p.get(k)?.split(",").map(Number).filter(Boolean).join(",");
  if (p.get("genres")) w.push(`genres.slug = "${p.get("genres")!.replace(/[^a-z0-9-]/gi, "")}"`);
  if (num("platforms")) w.push(`platforms = (${num("platforms")})`);
  if (num("developers")) w.push(`involved_companies.company = (${num("developers")}) & involved_companies.developer = true`);
  if (num("publishers")) w.push(`involved_companies.company = (${num("publishers")}) & involved_companies.publisher = true`);
  const dates = p.get("dates")?.match(/^(\d{4}-\d\d-\d\d),(\d{4}-\d\d-\d\d)$/);
  if (dates) w.push(`first_release_date >= ${Date.parse(dates[1]) / 1000} & first_release_date <= ${Date.parse(dates[2]) / 1000}`);
  return w;
}

async function list(p: URLSearchParams) {
  const size = Math.min(Number(p.get("page_size")) || 20, 50);
  const page = Math.max(Number(p.get("page")) || 1, 1);
  const text = p.get("search")?.trim().replace(/["\\]/g, "");
  const ordering = p.get("ordering") || "";
  const where = filters(p);
  if (text) {
    // IGDB araması yarım kelimeyi bulmaz ("hollow kn"): yazarken de sonuç çıksın diye kelimeleri adında geçenlere de bakılır
    const [found, partial] = await Promise.all([
      ask<IgdbGame>("games", `search "${text}"; fields ${CARD}; where ${where.join(" & ")}; limit 30;`),
      ask<IgdbGame>("games", `fields ${CARD}; where ${[...text.split(/\s+/).map((w) => `name ~ *"${w}"*`), ...where].join(" & ")}; sort total_rating_count desc; limit 30;`),
    ]);
    const rows = [...new Map([...found.rows, ...partial.rows].map((g) => [g.id, g])).values()];
    const ranked = !ordering ? rankByName(rows, text) : rows;
    return { count: rows.length, results: await withIds(ranked.slice((page - 1) * size, page * size)) };
  }
  const sort = SORTS[ordering] || SORTS["-added"];
  const field = sort.split(" ")[0];
  where.push(`${field} != null`);
  if (ordering === "-metacritic") where.push("aggregated_rating_count > 2");
  if (ordering === "-rating") where.push("total_rating_count > 10");
  if (ordering === "-released") where.push(`first_release_date <= ${Math.floor(Date.now() / 1000)}`);
  const { rows, count } = await ask<IgdbGame>("games", `fields ${CARD}; where ${where.join(" & ")}; sort ${sort}; limit ${size}; offset ${(page - 1) * size};`);
  return { count, results: await withIds(rows) };
}

// Sitedeki numara → IGDB numarası. Eşleşmemiş eski oyunda null: sayfa loglarıyla ve kendi kapağıyla açılır
async function igdbIdOf(id: number) {
  if (id < 0) return -id;
  return (await mapRows(`rawg_id=eq.${id}&limit=1`))[0]?.igdb_id ?? null;
}

export async function igdbProxy(path: string, params: URLSearchParams): Promise<Response> {
  if (path === "genres") {
    const { rows } = await ask<Ref>("genres", "fields name,slug; sort name asc; limit 40;");
    return Response.json({ results: rows.map(ref) });
  }
  if (path === "games") return Response.json(await list(params));
  const [, rawId, sub] = path.split("/");
  const id = Number(rawId);
  const igdbId = await igdbIdOf(id);
  if (!igdbId) return sub ? Response.json({ results: [] }) : Response.json({ error: "not found" }, { status: 404 });
  if (sub === "screenshots") {
    const { rows } = await ask<{ screenshots?: Img[] }>("games", `fields screenshots.image_id; where id = ${igdbId}; limit 1;`);
    return Response.json({ results: (rows[0]?.screenshots || []).slice(0, 10).map((s) => ({ image: image(s.image_id, "t_screenshot_huge") })) });
  }
  const { rows } = await ask<IgdbGame>("games", `fields ${FULL}; where id = ${igdbId}; limit 1;`);
  return rows[0] ? Response.json(toGame(rows[0], id)) : Response.json({ error: "not found" }, { status: 404 });
}
