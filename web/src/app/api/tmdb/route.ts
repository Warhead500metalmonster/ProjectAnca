// TMDB anahtarı sunucuda kalsın diye tarayıcı bu adrese sorar: /api/tmdb?path=search/movie&query=dune
// Anahtar Vercel'de TMDB_KEY ortam değişkeni olarak girilir.
const ALLOWED = /^(search\/(movie|tv)|(movie|tv)\/\d+|discover\/(movie|tv)|trending\/(movie|tv)\/week)$/;
const PARAMS = ["query", "page", "primary_release_year", "first_air_date_year", "year", "append_to_response", "sort_by", "with_genres", "with_original_language",
  "primary_release_date.gte", "primary_release_date.lte", "first_air_date.gte", "first_air_date.lte", "vote_count.gte"];
// Japonca, Korece, Çince, Kiril, Arap, Yunan, Tay alfabesi: Türkçe çevirisi yoksa TMDB orijinal adı verir, okunmaz
const NON_LATIN = /[Ͱ-ϿЀ-ӿ֐-ۿ฀-๿぀-ヿ㐀-鿿가-힯]/;

type Hit = { id?: number; title?: string; name?: string };

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";
  if (!ALLOWED.test(path)) return Response.json({ error: "bad path" }, { status: 400 });
  if (!process.env.TMDB_KEY) return Response.json({ error: "TMDB_KEY missing" }, { status: 503 });

  const params = new URLSearchParams({ api_key: process.env.TMDB_KEY, language: "tr-TR" });
  for (const k of PARAMS) {
    const v = searchParams.get(k);
    if (v) params.set(k, v.slice(0, 100));
  }
  const url = (lang: string) => { params.set("language", lang); return `https://api.themoviedb.org/3/${path}?${params}`; };
  const res = await fetch(url("tr-TR"), { next: { revalidate: 3600 } });
  if (!res.ok) return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
  const data = await res.json();

  // Türkçe adı olmayıp okunamayan alfabede gelenler İngilizce adlarıyla değiştirilir (orijinal ad original_title'da kalır)
  const items: Hit[] = Array.isArray(data.results) ? data.results : [data];
  if (items.some((h) => NON_LATIN.test(h.title || h.name || ""))) {
    const en = await fetch(url("en-US"), { next: { revalidate: 3600 } }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
    const enItems: Hit[] = en ? (Array.isArray(en.results) ? en.results : [en]) : [];
    const byId = new Map(enItems.map((h) => [h.id, h]));
    for (const h of items) {
      const e = byId.get(h.id);
      const enTitle = e?.title || e?.name;
      if (!enTitle || NON_LATIN.test(enTitle) || !NON_LATIN.test(h.title || h.name || "")) continue;
      if (h.title) h.title = enTitle; else h.name = enTitle;
    }
  }
  return Response.json(data);
}
