// RAWG anahtarı sunucuda kalsın diye tarayıcı bu adrese sorar: /api/rawg?path=games&search=zelda
const ALLOWED = /^games(\/\d+(\/screenshots)?)?$/;
const PARAMS = ["search", "page_size", "page", "dates", "ordering", "search_precise"];
// Ortam değişkeni girilmemişse eski sitedeki (zaten herkese açık olan) anahtar kullanılır
const KEY = process.env.RAWG_KEY || "7e702c5680bd4bc9b428ecd8409200fb";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";
  if (!ALLOWED.test(path)) return Response.json({ error: "bad path" }, { status: 400 });

  const params = new URLSearchParams({ key: KEY });
  for (const k of PARAMS) {
    const v = searchParams.get(k);
    if (v) params.set(k, v.slice(0, 100));
  }
  const res = await fetch(`https://api.rawg.io/api/${path}?${params}`, { next: { revalidate: 3600 } });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
