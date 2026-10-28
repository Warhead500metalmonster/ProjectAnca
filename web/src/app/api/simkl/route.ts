// Simkl kütüphanesi (dizi, film, anime), Simkl'ın resmi kodla bağlanma yolu ile:
//   /api/simkl?start=1      → { code, url } : kişi simkl.com/pin sayfasına bu kodu girer
//   /api/simkl?code=ABCDE   → onaylanmadıysa { pending: true }, onaylandıysa { items: [...] }
// Giriş anahtarı sunucuda kullanılır, tarayıcıya gönderilmez ve saklanmaz.
// Vercel'de SIMKL_ID ortam değişkeni olmalı (https://simkl.com/settings/developer → yeni uygulama → Client ID).
const API = "https://api.simkl.com";

type Ids = { simkl?: number; tmdb?: string | number; anilist?: string | number; mal?: string | number };
type Media = { title?: string; year?: number; poster?: string; ids?: Ids };
type Item = {
  status?: string; user_rating?: number | null; last_watched_at?: string | null;
  watched_episodes_count?: number; total_episodes_count?: number;
  show?: Media; movie?: Media;
};

const STATUS: Record<string, string> = { watching: "active", plantowatch: "planned", completed: "completed", hold: "paused", dropped: "dropped" };

function map(kind: "show" | "movie" | "anime", it: Item) {
  const m = (kind === "movie" ? it.movie : it.show) || {};
  const status = STATUS[it.status || ""];
  if (!m.title || !status) return null;
  const ids = m.ids || {};
  const ext = kind === "movie" ? (ids.tmdb ? `tmdb:movie:${ids.tmdb}` : null)
    : kind === "show" ? (ids.tmdb ? `tmdb:tv:${ids.tmdb}` : null)
    : ids.anilist ? `anilist:${ids.anilist}` : null;
  const eps = it.total_episodes_count ? `${it.watched_episodes_count || 0} / ${it.total_episodes_count} bölüm` : null;
  return {
    type: kind, title: m.title, year: m.year || null, status, rating: Math.max(0, Math.min(10, Math.round(it.user_rating || 0))),
    date: status === "completed" && it.last_watched_at ? it.last_watched_at.slice(0, 10) : null,
    cover: m.poster ? `https://simkl.in/posters/${m.poster}_m.jpg` : null, ext_id: ext, progress: kind === "movie" ? null : eps,
  };
}

export async function GET(request: Request) {
  const id = process.env.SIMKL_ID;
  if (!id) return Response.json({ error: "no-key" }, { status: 503 });
  const sp = new URL(request.url).searchParams;
  const get = (path: string, token?: string) => fetch(`${API}${path}`, {
    headers: { "simkl-api-key": id, "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, cache: "no-store",
  }).then((r) => r.json()).catch(() => null);

  if (sp.get("start")) {
    const d = await get(`/oauth/pin?client_id=${encodeURIComponent(id)}`);
    if (!d?.user_code) return Response.json({ error: "simkl-down" }, { status: 502 });
    return Response.json({ code: d.user_code, url: d.verification_url || "https://simkl.com/pin/", interval: d.interval || 5, expires: d.expires_in || 900 });
  }

  const code = sp.get("code") || "";
  if (!/^[A-Za-z0-9]{3,12}$/.test(code)) return Response.json({ error: "bad-code" }, { status: 400 });
  const d = await get(`/oauth/pin/${code}?client_id=${encodeURIComponent(id)}`);
  if (!d?.access_token) return Response.json({ pending: true });

  const all = await get("/sync/all-items/", d.access_token);
  if (!all) return Response.json({ error: "simkl-down" }, { status: 502 });
  const items = [
    ...((all.shows || []) as Item[]).map((x) => map("show", x)),
    ...((all.movies || []) as Item[]).map((x) => map("movie", x)),
    ...((all.anime || []) as Item[]).map((x) => map("anime", x)),
  ].filter(Boolean);
  return Response.json({ items });
}
