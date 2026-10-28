// Deezer tarayıcıdan doğrudan sorulamıyor (CORS), bu yüzden sunucu üzerinden: /api/deezer?kind=album&q=tarkan
// Anahtar istemez.
const KINDS = ["album", "track"];

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const kind = searchParams.get("kind") || "";
  const q = (searchParams.get("q") || "").slice(0, 100);
  if (!KINDS.includes(kind) || !q) return Response.json({ error: "bad request" }, { status: 400 });

  const params = new URLSearchParams({ q, limit: String(Math.min(10, Number(searchParams.get("limit")) || 5)) });
  const res = await fetch(`https://api.deezer.com/search/${kind}?${params}`, { next: { revalidate: 3600 } });
  return new Response(res.body, { status: res.status, headers: { "content-type": "application/json" } });
}
