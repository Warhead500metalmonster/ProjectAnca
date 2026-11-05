// Simkl kütüphanesi (dizi, film, anime), Simkl'ın resmi kodla bağlanma yolu ile:
//   /api/simkl?start=1      → { code, url } : kişi simkl.com/pin sayfasına bu kodu girer
//   /api/simkl?code=ABCDE   → onaylanmadıysa { pending: true }, onaylandıysa { raw: {shows, movies, anime} }
// Giriş anahtarı sunucuda kullanılır, tarayıcıya gönderilmez ve saklanmaz.
// Vercel'de SIMKL_ID ortam değişkeni olmalı (https://simkl.com/settings/developer → yeni uygulama → Client ID).
const API = "https://api.simkl.com";

export async function GET(request: Request) {
  const id = process.env.SIMKL_ID;
  if (!id) return Response.json({ error: "no-key" }, { status: 503 });
  const sp = new URL(request.url).searchParams;
  const get = (path: string, token?: string) => fetch(`${API}${path}`, {
    headers: { "simkl-api-key": id, "Content-Type": "application/json", ...(token && { Authorization: `Bearer ${token}` }) }, cache: "no-store",
  }).then((r) => r.json()).catch(() => null);

  if (sp.get("start")) {
    const d = await get(`/oauth/pin?client_id=${encodeURIComponent(id)}`);
    if (!d?.user_code) return Response.json({ error: "simkl-down" }, { status: 502 });
    return Response.json({ code: d.user_code, url: d.verification_url || "https://simkl.com/pin/", interval: d.interval || 5, expires: d.expires_in || 900 });
  }

  const code = sp.get("code") || "";
  if (!/^[A-Za-z0-9]{3,12}$/.test(code)) return Response.json({ error: "bad-code" }, { status: 400 });
  const d = await get(`/oauth/pin/${code}?client_id=${encodeURIComponent(id)}`);
  if (!d?.access_token) return Response.json({ pending: true });

  const all = await get("/sync/all-items/", d.access_token);
  if (!all) return Response.json({ error: "simkl-down" }, { status: 502 });
  // Liste olduğu gibi gönderilir; tarayıcı dosyadan gelenle aynı yolla okur ve eksik numaraları bağlar (lib/simkl.ts)
  return Response.json({ raw: all });
}
