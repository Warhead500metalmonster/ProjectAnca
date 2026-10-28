// Spotify çalma listesi ya da albüm linkinden albümler: /api/spotify?link=https://open.spotify.com/playlist/...
// Giriş gerekmez: herkese açık listeler okunur. Vercel'de SPOTIFY_ID ve SPOTIFY_SECRET ortam değişkenleri olmalı
// (https://developer.spotify.com/dashboard → Create app).
const API = "https://api.spotify.com/v1";
let token: { value: string; expires: number } | null = null;

async function auth(id: string, secret: string) {
  if (token && token.expires > Date.now() + 60000) return token.value;
  const r = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: { Authorization: "Basic " + Buffer.from(`${id}:${secret}`).toString("base64"), "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials", cache: "no-store",
  });
  const d = await r.json().catch(() => null);
  if (!d?.access_token) throw new Error("auth");
  token = { value: d.access_token, expires: Date.now() + d.expires_in * 1000 };
  return token.value;
}

interface SpAlbum { id: string; name: string; release_date?: string; images?: { url: string; width?: number }[]; artists?: { name: string }[] }

export async function GET(request: Request) {
  const id = process.env.SPOTIFY_ID, secret = process.env.SPOTIFY_SECRET;
  if (!id || !secret) return Response.json({ error: "no-key" }, { status: 503 });
  const link = new URL(request.url).searchParams.get("link") || "";
  const m = link.match(/(playlist|album)[/:]([A-Za-z0-9]{10,40})/);
  if (!m) return Response.json({ error: "bad-link" }, { status: 400 });

  let t: string;
  try { t = await auth(id, secret); } catch { return Response.json({ error: "no-key" }, { status: 503 }); }
  const get = (url: string) => fetch(url, { headers: { Authorization: `Bearer ${t}` }, cache: "no-store" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  const pick = (a: SpAlbum, tracks = 1) => ({
    id: a.id, title: a.name, artist: (a.artists || []).map((x) => x.name).join(", "),
    year: parseInt(a.release_date || "") || null, cover: a.images?.[0]?.url || null, tracks,
  });

  if (m[1] === "album") {
    const a: SpAlbum | null = await get(`${API}/albums/${m[2]}?market=TR`);
    return a ? Response.json({ albums: [pick(a)] }) : Response.json({ error: "not-found" }, { status: 404 });
  }

  // Çalma listesindeki şarkıları albümlere topla
  const albums = new Map<string, ReturnType<typeof pick>>();
  let url: string | null = `${API}/playlists/${m[2]}/tracks?limit=100&market=TR&fields=next,items(track(album(id,name,release_date,images,artists(name))))`;
  let pages = 0, any = false;
  while (url && pages++ < 30) {
    let d: { next: string | null; items?: { track?: { album?: SpAlbum } | null; item?: { album?: SpAlbum } | null }[] } | null = await get(url);
    // Yeni Spotify uygulamalarında liste şarkıları /items adresinden okunuyor
    if (!d && !any && url.includes("/tracks?")) { url = url.replace("/tracks?", "/items?").replace("items(track(", "items(item("); d = await get(url); }
    if (!d) break;
    any = true;
    for (const it of d.items || []) {
      const a = (it.track || it.item)?.album;
      if (!a?.id) continue;
      const old = albums.get(a.id);
      if (old) old.tracks++; else albums.set(a.id, pick(a));
    }
    url = d.next;
  }
  if (!any) return Response.json({ error: "not-found" }, { status: 404 });
  return Response.json({ albums: [...albums.values()].sort((a, b) => b.tracks - a.tracks) });
}
