// Steam kütüphanesi: /api/steam?profile=https://steamcommunity.com/id/kullanici
// Anahtar Vercel'de STEAM_KEY ortam değişkeni olarak girilir (https://steamcommunity.com/dev/apikey).
// Profilin "Oyun ayrıntıları" herkese açık olmalı.
// Başarımlar: /api/steam?achievements=<steamid>&appids=10,20,... → { ach: { "10": [açılan, toplam] } }
// Bütün başarımları açılmış oyun "bitirdim" sayılır.
const API = "https://api.steampowered.com";

async function achievements(key: string, steamid: string, appids: number[]) {
  const ach: Record<string, [number, number]> = {};
  let next = 0;
  await Promise.all(Array.from({ length: 8 }, async () => {
    while (next < appids.length) {
      const appid = appids[next++];
      const r = await fetch(`${API}/ISteamUserStats/GetPlayerAchievements/v1/?${new URLSearchParams({ key, steamid, appid: String(appid) })}`, { cache: "no-store" }).catch(() => null);
      const list: { achieved: number }[] | undefined = (await r?.json().catch(() => null))?.playerstats?.achievements;
      if (list?.length) ach[appid] = [list.filter((a) => a.achieved).length, list.length];
    }
  }));
  return ach;
}

export async function GET(request: Request) {
  const key = process.env.STEAM_KEY;
  if (!key) return Response.json({ error: "no-key" }, { status: 503 });
  const sp = new URL(request.url).searchParams;
  const achFor = sp.get("achievements") || "";
  if (achFor) {
    const appids = (sp.get("appids") || "").split(",").map(Number).filter((n) => Number.isInteger(n) && n > 0).slice(0, 40);
    if (!/^\d{17}$/.test(achFor) || !appids.length) return Response.json({ error: "bad-request" }, { status: 400 });
    return Response.json({ ach: await achievements(key, achFor, appids) });
  }
  const raw = (sp.get("profile") || "").trim().slice(0, 200);

  // Profil linki, 17 haneli Steam kimliği, telefondaki "Profili paylaş" linki (s.team/p/...), arkadaş kodu ya da özel ad kabul edilir
  let id = raw.match(/(?:profiles\/)?(\d{17})/)?.[1] || "";
  const share = raw.match(/s\.team\/p\/([a-z-]+)/i)?.[1];
  const friendCode = share ? parseInt([...share.replace(/-/g, "").toLowerCase()].map((c) => "0123456789abcdef"["bcdfghjkmnpqrtvw".indexOf(c)]).join(""), 16)
    : /^\d{1,10}$/.test(raw) ? Number(raw) : NaN;
  if (!id && friendCode > 0) id = (BigInt("76561197960265728") + BigInt(friendCode)).toString();
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
