// TMDB anahtarı sunucuda kalsın diye tarayıcı bu adrese sorar: /api/tmdb?path=search/movie&query=dune
// Anahtar Vercel'de TMDB_KEY ortam değişkeni olarak girilir.
const ALLOWED = /^(search\/(movie|tv)|(movie|tv)\/\d+|discover\/(movie|tv)|trending\/(movie|tv)\/week)$/;
const PARAMS = ["query", "page", "primary_release_year", "first_air_date_year", "year", "append_to_response", "sort_by", "with_genres", "with_original_language",
  "primary_release_date.gte", "primary_release_date.lte", "first_air_date.gte", "first_air_date.lte", "vote_count.gte"];

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
  const res = await fetch(`https://api.themoviedb.org/3/${path}?${params}`, { next: { revalidate: 3600 } });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
