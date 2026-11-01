import { igdbProxy } from "@/lib/igdb";

// Oyun bilgileri IGDB'den gelir; tarayıcı anahtarları görmesin diye bu adrese sorar: /api/rawg?path=games&search=zelda
const ALLOWED = /^(games(\/-?\d+(\/(screenshots|series))?)?|genres)$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";
  if (!ALLOWED.test(path)) return Response.json({ error: "bad path" }, { status: 400 });
  try {
    const res = await igdbProxy(path, searchParams);
    // Aynı arama ikinci kez anında gelsin
    if (res.ok) res.headers.set("Cache-Control", "public, s-maxage=600, stale-while-revalidate=3600");
    return res;
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
