// Albüm / şarkı bilgisi ve açıklaması: /api/musicinfo?title=Discovery&artist=Daft%20Punk&ext=deezer:album:302127&lang=tr
// Bilgiler Deezer ya da Apple Music'ten, açıklama Vikipedi'den (önce seçilen dil, yoksa diğeri), o da yoksa Last.fm'den.
const DAY = 86400;
const norm = (s: string) => s.toLocaleLowerCase("tr").replace(/\(.*?\)|\[.*?\]/g, "").replace(/[^\p{L}\p{N}]+/gu, " ").trim();

interface Info {
  title?: string; artist?: string; cover?: string | null; released?: string | null; label?: string | null; genres?: string[];
  tracks?: { title: string; sec: number }[]; link?: string | null; source?: string;
  description?: string | null; descFrom?: { name: string; url: string } | null;
}

async function json<T>(url: string): Promise<T | null> {
  const r = await fetch(url, { next: { revalidate: DAY }, headers: { "user-agent": "Ancalog/1.0 (https://ancalog.vercel.app)" } }).catch(() => null);
  return r?.ok ? r.json().catch(() => null) : null;
}

interface DzAlbum { id: number; title: string; link?: string; cover_xl?: string; release_date?: string; label?: string; artist?: { name: string };
  genres?: { data?: { name: string }[] }; tracks?: { data?: { title: string; duration: number }[] } }

async function deezerAlbum(id: string): Promise<Info | null> {
  const a = await json<DzAlbum & { error?: unknown }>(`https://api.deezer.com/album/${id}`);
  if (!a || a.error) return null;
  return {
    title: a.title, artist: a.artist?.name, cover: a.cover_xl || null, released: a.release_date || null, label: a.label || null,
    genres: (a.genres?.data || []).map((g) => g.name), tracks: (a.tracks?.data || []).map((t) => ({ title: t.title, sec: t.duration })),
    link: a.link || `https://www.deezer.com/album/${id}`, source: "Deezer",
  };
}

async function fromDeezer(ext: string | null, title: string, artist: string): Promise<Info | null> {
  if (ext?.startsWith("deezer:album:")) return deezerAlbum(ext.split(":")[2]);
  if (ext?.startsWith("deezer:track:")) {
    const t = await json<{ title: string; duration: number; link?: string; release_date?: string; album?: { id: number }; artist?: { name: string } }>(`https://api.deezer.com/track/${ext.split(":")[2]}`);
    if (!t?.album) return null;
    const a = await deezerAlbum(String(t.album.id));
    return a ? { ...a, title: t.title, link: t.link || a.link, released: t.release_date || a.released } : null;
  }
  // Kaynağı bilinmiyorsa adıyla Deezer'da ara, adı ve sanatçısı tutan albümü al
  const hits = await json<{ data?: { id: number; title: string; artist: { name: string } }[] }>(`https://api.deezer.com/search/album?${new URLSearchParams({ q: `${artist} ${title}`.trim(), limit: "5" })}`);
  const hit = (hits?.data || []).find((h) => norm(h.title) === norm(title) && (!artist || norm(h.artist.name) === norm(artist)));
  return hit ? deezerAlbum(String(hit.id)) : null;
}

async function fromItunes(id: string): Promise<Info | null> {
  const d = await json<{ results?: { wrapperType: string; collectionName?: string; trackName?: string; artistName?: string; artworkUrl100?: string; releaseDate?: string;
    primaryGenreName?: string; collectionViewUrl?: string; trackViewUrl?: string; trackTimeMillis?: number; copyright?: string; kind?: string }[] }>(`https://itunes.apple.com/lookup?id=${id}&entity=song&country=TR`);
  const rows = d?.results || [];
  const head = rows[0];
  if (!head) return null;
  const songs = rows.filter((r) => r.wrapperType === "track");
  return {
    title: head.collectionName || head.trackName, artist: head.artistName, cover: head.artworkUrl100?.replace(/\/\d+x\d+bb\./, "/1000x1000bb.") || null,
    released: head.releaseDate?.slice(0, 10) || null, label: head.copyright || null, genres: head.primaryGenreName ? [head.primaryGenreName] : [],
    tracks: head.wrapperType === "collection" ? songs.map((s) => ({ title: s.trackName || "", sec: Math.round((s.trackTimeMillis || 0) / 1000) })) : [],
    link: head.collectionViewUrl || head.trackViewUrl || null, source: "Apple Music",
  };
}

// Vikipedi: "Albüm Sanatçı" diye ara; adı albümle başlayan maddenin özeti
async function wiki(lang: string, title: string, artist: string): Promise<{ text: string; url: string } | null> {
  const s = await json<{ query?: { search?: { title: string }[] } }>(`https://${lang}.wikipedia.org/w/api.php?${new URLSearchParams({
    action: "query", list: "search", srsearch: `${title} ${artist} ${lang === "tr" ? "albüm" : "album"}`, srlimit: "5", format: "json", origin: "*" })}`);
  const want = norm(title);
  const page = (s?.query?.search || []).find((p) => norm(p.title).startsWith(want) || norm(p.title) === want);
  if (!page) return null;
  const sum = await json<{ extract?: string; type?: string; content_urls?: { desktop?: { page?: string } } }>(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.title.replace(/ /g, "_"))}`);
  if (!sum?.extract || sum.type === "disambiguation") return null;
  // Albüm ya da şarkı maddesi mi (sanatçının kendi maddesi gelmesin)
  if (artist && !norm(sum.extract).includes(norm(artist).split(" ")[0])) return null;
  return { text: sum.extract, url: sum.content_urls?.desktop?.page || `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(page.title)}` };
}

async function lastfm(title: string, artist: string): Promise<{ text: string; url: string } | null> {
  const key = process.env.LASTFM_KEY;
  if (!key || !artist) return null;
  const d = await json<{ album?: { url?: string; wiki?: { summary?: string } } }>(`https://ws.audioscrobbler.com/2.0/?${new URLSearchParams({ method: "album.getinfo", api_key: key, artist, album: title, format: "json", autocorrect: "1" })}`);
  const text = d?.album?.wiki?.summary?.replace(/<a [^>]*>.*?<\/a>\.?/g, "").replace(/<[^>]+>/g, "").trim();
  return text ? { text, url: d?.album?.url || "https://www.last.fm" } : null;
}

export async function GET(request: Request) {
  const sp = new URL(request.url).searchParams;
  const title = (sp.get("title") || "").slice(0, 200).trim();
  const artist = (sp.get("artist") || "").slice(0, 200).trim();
  const ext = sp.get("ext");
  const lang = sp.get("lang") === "en" ? "en" : "tr";
  if (!title) return Response.json({ error: "bad request" }, { status: 400 });
  const info: Info = (ext?.startsWith("itunes:") ? await fromItunes(ext.split(":")[1]) : await fromDeezer(ext, title, artist)) || {};
  const name = info.title || title, who = info.artist || artist;
  const desc = await wiki(lang, name, who) || await wiki(lang === "tr" ? "en" : "tr", name, who);
  if (desc) { info.description = desc.text; info.descFrom = { name: "Vikipedi", url: desc.url }; }
  else {
    const lf = await lastfm(name, who);
    if (lf) { info.description = lf.text; info.descFrom = { name: "Last.fm", url: lf.url }; }
  }
  return Response.json(info, { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } });
}
