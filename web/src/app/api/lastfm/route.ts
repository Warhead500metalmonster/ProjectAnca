// Last.fm'de en çok dinlenen albümler: /api/lastfm?user=KULLANICI
// Vercel'de LASTFM_KEY ortam değişkeni olmalı (https://www.last.fm/api/account/create).
export async function GET(request: Request) {
  const key = process.env.LASTFM_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 503 });
  const user = (new URL(request.url).searchParams.get("user") || "").trim().replace(/^.*last\.fm\/user\//i, "").replace(/\/.*$/, "");
  if (!/^[A-Za-z][\w-]{1,14}$/.test(user)) return Response.json({ error: "bad-user" }, { status: 400 });

  const albums: { title: string; artist: string; plays: number; cover: string | null }[] = [];
  for (let page = 1; page <= 4; page++) {
    const qs = new URLSearchParams({ method: "user.gettopalbums", user, api_key: key, format: "json", period: "overall", limit: "500", page: String(page) });
    const d = await fetch(`https://ws.audioscrobbler.com/2.0/?${qs}`, { cache: "no-store" }).then((r) => r.json()).catch(() => null);
    if (d?.error === 6) return Response.json({ error: "not-found" }, { status: 404 });
    const list: { name: string; playcount: string; artist: { name: string }; image?: { "#text": string; size: string }[] }[] = d?.topalbums?.album || [];
    for (const a of list) {
      const img = a.image?.find((i) => i.size === "extralarge")?.["#text"] || a.image?.at(-1)?.["#text"] || "";
      albums.push({ title: a.name, artist: a.artist?.name || "", plays: Number(a.playcount) || 0, cover: img.startsWith("https://") ? img : null });
    }
    if (list.length < 500 || Number(list.at(-1)?.playcount) < 5) break;
  }
  if (!albums.length) return Response.json({ error: "empty" }, { status: 404 });
  return Response.json({ user, albums });
}
