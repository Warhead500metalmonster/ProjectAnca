// Steam kütüphanesi: /api/steam?profile=https://steamcommunity.com/id/kullanici
// Anahtar Vercel'de STEAM_KEY ortam değişkeni olarak girilir (https://steamcommunity.com/dev/apikey).
// Profilin "Oyun ayrıntıları" herkese açık olmalı.
const API = "https://api.steampowered.com";

export async function GET(request: Request) {
  const key = process.env.STEAM_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 503 });
  const raw = (new URL(request.url).searchParams.get("profile") || "").trim().slice(0, 200);

  // Profil linki, 17 haneli Steam kimliği ya da özel ad kabul edilir
  let id = raw.match(/(?:profiles\/)?(\d{17})/)?.[1] || "";
  if (!id) {
    const vanity = raw.match(/\/id\/([\w-]+)/)?.[1] || (/^[\w-]{2,32}$/.test(raw) ? raw : "");
    if (!vanity) return Response.json({ error: "bad-profile" }, { status: 400 });
    const r = await fetch(`${API}/ISteamUser/ResolveVanityURL/v1/?${new URLSearchParams({ key, vanityurl: vanity })}`);
    id = (await r.json().catch(() => null))?.response?.steamid || "";
    if (!id) return Response.json({ error: "not-found" }, { status: 404 });
  }

  const params = new URLSearchParams({ key, steamid: id, include_appinfo: "1", include_played_free_games: "1" });
  const r = await fetch(`${API}/IPlayerService/GetOwnedGames/v1/?${params}`, { cache: "no-store" });
  const games: { appid: number; name: string; playtime_forever: number; rtime_last_played?: number }[] | undefined =
    (await r.json().catch(() => null))?.response?.games;
  if (!games) return Response.json({ error: "private" }, { status: 404 }); // gizli profil ya da oyun yok
  return Response.json({
    steamid: id,
    games: games.map((g) => ({ appid: g.appid, name: g.name, minutes: g.playtime_forever, last: g.rtime_last_played || 0 })),
  });
}
