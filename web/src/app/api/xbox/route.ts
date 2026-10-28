// Xbox kütüphanesi (konsol ve PC): /api/xbox?user=GAMERTAG
// Microsoft'un herkese açık arayüzü yok; ücretsiz OpenXBL servisi kullanılır (https://xbl.io).
// Anahtar Vercel'de XBL_KEY ortam değişkeni olarak durur. Kişinin oyun geçmişi herkese açık olmalı.
const API = "https://xbl.io/api/v2";

type Title = {
  titleId: string | number; name: string; displayImage?: string; devices?: string[]; type?: string;
  achievement?: { currentAchievements?: number; totalAchievements?: number; currentGamerscore?: number; totalGamerscore?: number; progressPercentage?: number };
  titleHistory?: { lastTimePlayed?: string };
};

const clean = (s: string) => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
function platformOf(devices: string[] = []) {
  if (devices.includes("XboxSeries")) return "Xbox Series X|S";
  if (devices.includes("XboxOne")) return "Xbox One";
  if (devices.includes("Xbox360")) return "Xbox 360";
  if (devices.includes("PC") || devices.includes("Win32")) return "PC";
  return "Xbox Series X|S";
}

export async function GET(request: Request) {
  const keyEnv = process.env.XBL_KEY;
  if (!keyEnv) return Response.json({ error: "no-key" }, { status: 503 });
  const user = (new URL(request.url).searchParams.get("user") || "").trim();
  if (!/^[A-Za-z0-9 ]{1,15}(#\d{1,4})?$/.test(user)) return Response.json({ error: "bad-user" }, { status: 400 });
  const get = (path: string) => fetch(`${API}${path}`, {
    headers: { "X-Authorization": keyEnv, Accept: "application/json", "Accept-Language": "tr-TR" }, cache: "no-store",
  }).then(async (r) => (r.status === 429 ? Promise.reject(new Error("busy")) : r.ok ? r.json() : null)).catch((e) => (e.message === "busy" ? Promise.reject(e) : null));

  try {
    // Gamertag → xuid
    const found = await get(`/search/${encodeURIComponent(user)}`);
    const people: { xuid?: string; gamertag?: string }[] = found?.people || [];
    let xuid = (people.find((p) => p.gamertag?.toLowerCase() === user.toLowerCase()) || people[0])?.xuid;
    if (!xuid) {
      const alt = await get(`/friends/search?gt=${encodeURIComponent(user)}`);
      xuid = alt?.profileUsers?.[0]?.id;
    }
    if (!xuid) return Response.json({ error: "not-found" }, { status: 404 });

    const data = (await get(`/achievements/player/${xuid}`)) || (await get(`/player/titleHistory/${xuid}`));
    const titles: Title[] = data?.titles || [];
    if (!titles.length) return Response.json({ error: "private" }, { status: 404 });

    const games = titles
      .filter((t) => t.name && (!t.type || t.type === "Game") && !(t.devices?.length === 1 && t.devices[0] === "Mobile"))
      .map((t) => {
        const a = t.achievement || {};
        const progress = a.progressPercentage ?? (a.totalGamerscore ? Math.round(((a.currentGamerscore || 0) / a.totalGamerscore) * 100) : null);
        return {
          id: String(t.titleId), name: clean(t.name), platform: platformOf(t.devices), minutes: 0,
          last: t.titleHistory?.lastTimePlayed || null, progress, done: progress === 100 && (a.totalGamerscore || 1) > 0,
          cover: t.displayImage || null,
        };
      });
    return Response.json({ user, games });
  } catch {
    return Response.json({ error: "busy" }, { status: 429 });
  }
}
