import { igdbProxy } from "@/lib/igdb";

// Oyun bilgileri IGDB'den gelir; tarayıcı anahtarları görmesin diye bu adrese sorar: /api/rawg?path=games&search=zelda
const ALLOWED = /^(games(\/-?\d+(\/screenshots)?)?|genres)$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get("path") || "";
  if (!ALLOWED.test(path)) return Response.json({ error: "bad path" }, { status: 400 });
  try {
    return await igdbProxy(path, searchParams);
  } catch (e) {
    return Response.json({ error: (e as Error).message }, { status: 502 });
  }
}
