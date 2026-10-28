// Müzik linkinden ad, sanatçı ve kapak: YouTube / YouTube Music, Spotify, SoundCloud (oEmbed, anahtar istemez)
// /api/oembed?url=https://music.youtube.com/watch?v=...
const enc = encodeURIComponent;
const PROVIDERS: [RegExp, (u: string) => string][] = [
  [/^((www|music|m)\.)?youtube\.com$|^youtu\.be$/, (u) => `https://www.youtube.com/oembed?format=json&url=${enc(u)}`],
  [/^open\.spotify\.com$/, (u) => `https://open.spotify.com/oembed?url=${enc(u)}`],
  [/^((www|m)\.)?soundcloud\.com$/, (u) => `https://soundcloud.com/oembed?format=json&url=${enc(u)}`],
];

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("url") || "";
  let url: URL;
  try { url = new URL(raw); } catch { return Response.json({ error: "bad url" }, { status: 400 }); }
  const provider = url.protocol === "https:" && PROVIDERS.find(([host]) => host.test(url.hostname));
  if (!provider) return Response.json({ error: "unsupported" }, { status: 400 });

  const res = await fetch(provider[1](url.href), { next: { revalidate: 86400 } });
  if (!res.ok) return Response.json({ error: "not found" }, { status: 404 });
  const d = await res.json();
  return Response.json({ title: d.title || "", author: d.author_name || "", thumbnail: d.thumbnail_url || "", provider: d.provider_name || "" });
}
