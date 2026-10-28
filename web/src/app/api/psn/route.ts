// PlayStation kütüphanesi: /api/psn?user=PSN_ID
// PlayStation'ın herkese açık bir arayüzü yok; site sahibinin hesabından alınan NPSSO kodu Vercel'de
// PSN_NPSSO ortam değişkeni olarak durur (https://ca.account.sony.com/api/v1/ssocookie). Kodun süresi ~2 ayda dolar.
// Kişinin kupaları "Herkes" görebilecek şekilde açık olmalı.
import {
  exchangeAccessCodeForAuthTokens, exchangeNpssoForAccessCode, exchangeRefreshTokenForAuthTokens,
  getProfileFromUserName, getUserPlayedGames, getUserTitles,
} from "psn-api";

let auth: { accessToken: string; refreshToken: string; expires: number; refreshExpires: number } | null = null;

async function token(npsso: string) {
  const now = Date.now();
  if (auth && auth.expires > now + 60000) return { accessToken: auth.accessToken };
  const t = auth && auth.refreshExpires > now + 60000
    ? await exchangeRefreshTokenForAuthTokens(auth.refreshToken)
    : await exchangeAccessCodeForAuthTokens(await exchangeNpssoForAccessCode(npsso));
  auth = { accessToken: t.accessToken, refreshToken: t.refreshToken, expires: now + t.expiresIn * 1000, refreshExpires: now + t.refreshTokenExpiresIn * 1000 };
  return { accessToken: t.accessToken };
}

const clean = (s: string) => s.replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
const key = (s: string) => clean(s).toLowerCase().replace(/[^a-z0-9]+/g, "");
// "PT228H56M33S" → dakika
const minutesOf = (d?: string) => {
  const m = d?.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
  return m ? (+(m[1] || 0)) * 60 + +(m[2] || 0) : 0;
};
const platformOf = (p: string) =>
  /PS5|ps5/.test(p) ? "PlayStation 5" : /PS4|ps4/.test(p) ? "PlayStation 4" : /PS3/.test(p) ? "PlayStation 3" : /VITA/i.test(p) ? "PS Vita" : /pspc/.test(p) ? "PC" : "PlayStation 5";

export interface PsnGame { id: string; name: string; platform: string; minutes: number; last: string | null; progress: number | null; done: boolean; cover: string | null }

export async function GET(request: Request) {
  const npsso = process.env.PSN_NPSSO;
  if (!npsso) return Response.json({ error: "no-key" }, { status: 503 });
  const user = (new URL(request.url).searchParams.get("user") || "").trim().replace(/^@/, "");
  if (!/^[A-Za-z][\w-]{2,15}$/.test(user)) return Response.json({ error: "bad-user" }, { status: 400 });

  let a: { accessToken: string };
  try { a = await token(npsso); } catch { auth = null; return Response.json({ error: "expired" }, { status: 503 }); }

  const accountId = await getProfileFromUserName(a, user).then((p) => p.profile.accountId).catch(() => "");
  if (!accountId) return Response.json({ error: "not-found" }, { status: 404 });

  // Kupa listesi: bitirme yüzdesi ve platin
  const trophies: Awaited<ReturnType<typeof getUserTitles>>["trophyTitles"] = [];
  try {
    for (let offset = 0; offset < 3000;) {
      const r = await getUserTitles(a, accountId, { limit: 800, offset });
      trophies.push(...(r.trophyTitles || []));
      if (!r.nextOffset || !r.trophyTitles?.length) break;
      offset = r.nextOffset;
    }
  } catch { /* kupalar gizli olabilir; oynanan oyunlar yine gelebilir */ }

  // Oynanan oyunlar: oynama süresi (PS4 / PS5)
  const played: Awaited<ReturnType<typeof getUserPlayedGames>>["titles"] = [];
  try {
    for (let offset = 0; offset < 2000;) {
      const r = await getUserPlayedGames(a, accountId, { limit: 200, offset });
      played.push(...(r.titles || []));
      if (!r.nextOffset || !r.titles?.length) break;
      offset = r.nextOffset;
    }
  } catch { /* gizli */ }

  if (!trophies.length && !played.length) return Response.json({ error: "private" }, { status: 404 });

  const map = new Map<string, PsnGame>();
  for (const t of trophies) {
    const e = t.earnedTrophies, d = t.definedTrophies;
    map.set(key(t.trophyTitleName), {
      id: t.npCommunicationId, name: clean(t.trophyTitleName), platform: platformOf(t.trophyTitlePlatform), minutes: 0,
      last: t.lastUpdatedDateTime || null, progress: t.progress ?? null,
      done: (d.platinum > 0 && e.platinum > 0) || t.progress === 100, cover: t.trophyTitleIconUrl || null,
    });
  }
  for (const p of played) {
    const k = key(p.localizedName || p.name);
    const old = map.get(k);
    if (old) {
      old.minutes += minutesOf(p.playDuration);
      if (p.lastPlayedDateTime && (!old.last || p.lastPlayedDateTime > old.last)) old.last = p.lastPlayedDateTime;
    } else {
      map.set(k, {
        id: p.titleId, name: clean(p.localizedName || p.name), platform: platformOf(p.category), minutes: minutesOf(p.playDuration),
        last: p.lastPlayedDateTime || null, progress: null, done: false, cover: p.localizedImageUrl || p.imageUrl || null,
      });
    }
  }
  return Response.json({ user, games: [...map.values()] });
}
