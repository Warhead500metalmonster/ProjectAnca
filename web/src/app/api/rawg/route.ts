// RAWG anahtarı sunucuda kalsın diye tarayıcı bu adrese sorar: /api/rawg?path=games&search=zelda
const ALLOWED = /^games(\/\d+(\/screenshots)?)?$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";
  if (!ALLOWED.test(path)) return Response.json({ error: "bad path" }, { status: 400 });
  if (!process.env.RAWG_KEY) return Response.json({ error: "RAWG_KEY missing" }, { status: 503 });

  const params = new URLSearchParams({ key: process.env.RAWG_KEY });
  for (const k of ["search", "page_size"]) {
    const v = searchParams.get(k);
    if (v) params.set(k, v.slice(0, 100));
  }
  const res = await fetch(`https://api.rawg.io/api/${path}?${params}`, { next: { revalidate: 3600 } });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
