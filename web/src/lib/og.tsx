/* eslint-disable @next/next/no-img-element */
// Link önizleme kartları: bir profil, oyun, liste ya da yıl özeti linki WhatsApp, Discord, X gibi yerlere atılınca çıkan görsel ve yazı.
// Sunucuda çalışır; veritabanına herkese açık anahtarla (RLS geçerli) sorar, yani gizli profillerin kayıtları kartlara da girmez.
import { ImageResponse } from "next/og";
import { SUPABASE_KEY, SUPABASE_URL } from "./supabase";

export const SITE = "https://ancalog.vercel.app";
const DB = SUPABASE_URL, KEY = SUPABASE_KEY;

export const OG_SIZE = { width: 1200, height: 630 };

// Supabase REST: hata olursa boş döner, kart yine de çizilir
export async function rest<T>(path: string): Promise<T | null> {
  try {
    const r = await fetch(`${DB}/rest/v1/${path}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` }, next: { revalidate: 600 } });
    return r.ok ? ((await r.json()) as T) : null;
  } catch { return null; }
}

// Sadece kaç tane olduğunu sorar (satırları indirmeden)
export async function restCount(path: string): Promise<number> {
  try {
    const r = await fetch(`${DB}/rest/v1/${path}`, {
      method: "HEAD", headers: { apikey: KEY, authorization: `Bearer ${KEY}`, prefer: "count=exact", range: "0-0" }, next: { revalidate: 600 },
    });
    return Number(r.headers.get("content-range")?.split("/")[1]) || 0;
  } catch { return 0; }
}

export async function rawgGame(id: string) {
  if (!/^\d+$/.test(id)) return null;
  try {
    // Anahtar sunucudaki /api/rawg'de duruyor; kart da oradan sorar
    const r = await fetch(`${SITE}/api/rawg?path=games/${id}`, { next: { revalidate: 86400 } });
    return r.ok ? (await r.json() as { name?: string; released?: string; background_image?: string; developers?: { name: string }[]; description_raw?: string }) : null;
  } catch { return null; }
}

export const clip = (s: string | null | undefined, n: number) => {
  const t = (s || "").replace(/\s+/g, " ").trim();
  return t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t;
};

// Görseli önceden indirip gömülü hale getirir; açılmayan ya da desteklenmeyen biçimdekiler atlanır (kart bozulmasın)
async function embed(url: string | null | undefined): Promise<string | null> {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(4000), next: { revalidate: 86400 } });
    const type = (r.headers.get("content-type") || "").split(";")[0];
    if (!r.ok || !/^image\/(png|jpeg|jpg|gif)$/.test(type)) return null;
    const buf = Buffer.from(await r.arrayBuffer());
    return buf.length > 4_000_000 ? null : `data:${type};base64,${buf.toString("base64")}`;
  } catch { return null; }
}

// Kartta geçen harfler için Google Fonts'tan sadece o harfleri içeren yazı tipi (Türkçe harfler düzgün çıksın diye)
async function font(family: string, weight: number, text: string) {
  try {
    const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`)).text();
    const src = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!src) return null;
    const r = await fetch(src[1]);
    return r.ok ? await r.arrayBuffer() : null;
  } catch { return null; }
}

export interface OgData {
  kicker?: string;       // en üstteki küçük yazı: "Profil", "Oyun", "Liste"
  title: string;         // büyük başlık
  sub?: string;          // başlığın altı: @kullanıcı, yıl · geliştirici
  line?: string;         // altta sayılar: "248 kayıt · 31'i bu yıl bitti"
  avatar?: string | null;
  covers?: (string | null | undefined)[]; // sağdaki / alttaki kapaklar
  backdrop?: string | null;               // arkada soluk görsel
  accent?: string | null;
}

export async function ogImage(d: OgData) {
  const accent = /^#[0-9a-f]{6}$/i.test(d.accent || "") ? d.accent! : "#58a98a";
  const [avatar, backdrop, ...covers] = await Promise.all([embed(d.avatar), embed(d.backdrop), ...(d.covers || []).slice(0, 8).map(embed)]);
  const shown = covers.filter(Boolean).slice(0, 4) as string[];
  const title = clip(d.title, 60);
  const text = [d.kicker, title, d.sub, d.line, "Ancalog", "ancalog.vercel.app", "…"].join(" ");
  const [bold, regular] = await Promise.all([font("Outfit", 700, text), font("Inter", 500, text)]);
  const fonts = [
    ...(bold ? [{ name: "Outfit", data: bold, weight: 700 as const, style: "normal" as const }] : []),
    ...(regular ? [{ name: "Inter", data: regular, weight: 500 as const, style: "normal" as const }] : []),
  ];

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", position: "relative", background: "#080c0d", color: "#f2f5f4", fontFamily: "Inter" }}>
        {backdrop && <img src={backdrop} alt="" width={1200} height={630} style={{ position: "absolute", inset: 0, width: 1200, height: 630, objectFit: "cover", opacity: 0.28 }} />}
        <div style={{ position: "absolute", inset: 0, display: "flex", background: `linear-gradient(90deg, #080c0d 30%, rgba(8,12,13,.75) 65%, rgba(8,12,13,.35))` }} />
        <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 12, background: accent, display: "flex" }} />
        <div style={{ display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 0 56px 76px", width: shown.length ? 620 : 1100, position: "relative" }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {d.kicker && <div style={{ fontSize: 26, letterSpacing: 4, textTransform: "uppercase", color: accent, marginBottom: 22 }}>{d.kicker}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
              {avatar ? <img src={avatar} alt="" width={128} height={128} style={{ width: 128, height: 128, borderRadius: 64, objectFit: "cover", border: `4px solid ${accent}` }} />
                : d.avatar !== undefined && <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 128, height: 128, borderRadius: 64, background: accent, color: "#080c0d", fontFamily: "Outfit", fontWeight: 700, fontSize: 64 }}>{[...title][0]?.toLocaleUpperCase("tr")}</div>}
              <div style={{ display: "flex", flexDirection: "column" }}>
                <div style={{ fontFamily: "Outfit", fontWeight: 700, fontSize: title.length > (shown.length ? 18 : 28) ? 52 : 72, lineHeight: 1.05 }}>{title}</div>
                {d.sub && <div style={{ fontSize: 30, color: "#a8b5b1", marginTop: 12 }}>{clip(d.sub, 60)}</div>}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
            {d.line && <div style={{ fontSize: 32, color: "#dfe7e4" }}>{clip(d.line, 70)}</div>}
            <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 26, color: "#8a9894" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 44, height: 44, borderRadius: 10, background: "#fff", color: "#000", fontFamily: "Outfit", fontWeight: 700, fontSize: 30 }}>A</div>
              <span style={{ fontFamily: "Outfit", fontWeight: 700, color: "#f2f5f4" }}>Ancalog</span>
              <span>ancalog.vercel.app</span>
            </div>
          </div>
        </div>
        {shown.length > 0 && (
          <div style={{ position: "absolute", right: 56, top: 0, bottom: 0, display: "flex", alignItems: "center" }}>
            {shown.map((c, i) => (
              <img key={i} src={c} alt="" width={180} height={270}
                style={{ width: 180, height: 270, objectFit: "cover", borderRadius: 12, marginLeft: i ? -60 : 0, border: "3px solid #080c0d", boxShadow: "0 12px 40px rgba(0,0,0,.6)", transform: `rotate(${(i - (shown.length - 1) / 2) * 4}deg) translateY(${Math.abs(i - (shown.length - 1) / 2) * 14}px)` }} />
            ))}
          </div>
        )}
      </div>
    ),
    { ...OG_SIZE, fonts: fonts.length ? fonts : undefined },
  );
}

// ---------- Her sayfa türünün kart verisi (hem <meta> yazıları hem görsel aynı veriden) ----------

type Card = OgData & { description: string };
const LABEL: Record<string, [string, string]> = { game: ["Oyun", "Oyunlar"], movie: ["Film", "Filmler"], show: ["Dizi", "Diziler"], music: ["Müzik", "Müzikler"], anime: ["Anime", "Animeler"] };
const avg = (rs: { rating: number | null }[]) => {
  const r = rs.map((x) => Number(x.rating) || 0).filter((x) => x > 0);
  return r.length ? (r.reduce((a, b) => a + b, 0) / r.length).toFixed(1).replace(".", ",") : "";
};
const big = (url?: string | null) => (url || "").replace(/\/media\/(games|screenshots)\//, "/media/resize/640/-/$1/");

interface OgProfile { id: string; username: string; display_name: string | null; bio: string | null; avatar_url: string | null; accent?: string | null; hidden_types?: string[] | null; privacy?: string | null }

async function profileOf(username: string) {
  const rows = await rest<OgProfile[]>(`profiles?username=eq.${encodeURIComponent(username)}&select=*&limit=1`);
  return rows?.[0] || null;
}

export async function profileCard(username: string): Promise<Card | null> {
  const p = await profileOf(username);
  if (!p) return null;
  const name = p.display_name || p.username;
  const hide = (p.hidden_types || []).filter((t) => t in LABEL);
  const notHidden = hide.length ? `&type=not.in.(${hide.join(",")})` : "";
  const year = new Date().getFullYear();
  const [total, doneYear, covers] = await Promise.all([
    restCount(`entries?user_id=eq.${p.id}${notHidden}`),
    restCount(`entries?user_id=eq.${p.id}&status=eq.completed&date=gte.${year}-01-01${notHidden}`),
    rest<{ cover: string | null }[]>(`entries?user_id=eq.${p.id}&cover=not.is.null&select=cover&order=rating.desc.nullslast,updated_at.desc&limit=8${notHidden}`),
  ]);
  const line = total ? `${total.toLocaleString("tr")} kayıt${doneYear ? ` · bu yıl ${doneYear.toLocaleString("tr")} tane bitirdi` : ""}` : "Ancalog'da";
  return {
    kicker: "Profil", title: name, sub: `@${p.username}`, line, avatar: p.avatar_url, accent: p.accent,
    covers: (covers || []).map((c) => big(c.cover)),
    // Gizli ya da sadece arkadaşlara açık profilin hakkında yazısı da profilde gösterilmediği için karta girmez
    description: (p.privacy === "public" || !p.privacy ? clip(p.bio, 160) : "") || `${name} Ancalog'da: oyunları, filmleri, dizileri, animeleri ve müzikleri. ${line}.`,
  };
}

export async function gameCard(id: string): Promise<Card | null> {
  const [g, logs] = await Promise.all([
    rawgGame(id),
    /^\d+$/.test(id) ? rest<{ rating: number | null; title: string; cover: string | null; year: number | null; creator: string | null }[]>(`entries?rawg_id=eq.${id}&select=rating,title,cover,year,creator&limit=500`) : null,
  ]);
  const title = g?.name || logs?.[0]?.title;
  if (!title) return null;
  const year = parseInt(g?.released || "") || logs?.[0]?.year || null;
  const dev = (g?.developers || []).map((d) => d.name).join(", ") || logs?.[0]?.creator || "";
  const n = logs?.length || 0, a = avg(logs || []);
  const line = n ? `${n} kişi logladı${a ? ` · ortalama ${a}/10` : ""}` : "Ancalog'da logla, puanla, listene ekle";
  const art = big(g?.background_image) || logs?.find((l) => l.cover)?.cover;
  return {
    kicker: "Oyun", title, sub: [year, dev].filter(Boolean).join(" · "), line, backdrop: art,
    description: clip(g?.description_raw, 160) || `${title} Ancalog'da. ${line}.`,
  };
}

export async function contentCard(type: string, rawTitle: string): Promise<Card | null> {
  if (!(type in LABEL)) return null;
  const t = decodeURIComponent(rawTitle);
  const logs = await rest<{ rating: number | null; title: string; cover: string | null; year: number | null; creator: string | null }[]>(
    `entries?type=eq.${type}&title=ilike.${encodeURIComponent(t.replace(/[*%_]/g, "\$&"))}&select=rating,title,cover,year,creator&limit=500`);
  const f = logs?.[0];
  const title = f?.title || t;
  const n = logs?.length || 0, a = avg(logs || []);
  const line = n ? `${n} kişi logladı${a ? ` · ortalama ${a}/10` : ""}` : "Ancalog'da logla, puanla, listene ekle";
  const cover = logs?.find((l) => l.cover)?.cover;
  return {
    kicker: LABEL[type][0], title, sub: [f?.year, f?.creator].filter(Boolean).join(" · "), line, covers: [cover], backdrop: cover,
    description: `${title} (${LABEL[type][0]}) Ancalog'da. ${line}.`,
  };
}

export async function listCard(id: string): Promise<Card | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const rows = await rest<{ title: string; description: string | null; profiles: { username: string; display_name: string | null } | null; list_items: { cover: string | null; position: number }[] }[]>(
    `lists?id=eq.${id}&select=title,description,profiles(username,display_name),list_items(cover,position)&list_items.order=position&limit=1`);
  const l = rows?.[0];
  if (!l) return null;
  const by = l.profiles ? (l.profiles.display_name || l.profiles.username) : "";
  const n = l.list_items?.length || 0;
  return {
    kicker: "Liste", title: l.title, sub: by ? `${by} hazırladı` : undefined, line: `${n} şey`,
    covers: (l.list_items || []).filter((i) => i.cover).map((i) => big(i.cover)),
    description: clip(l.description, 160) || `${by ? by + " hazırladı: " : ""}${l.title}, ${n} şeylik bir Ancalog listesi.`,
  };
}

export async function wrapCard(username: string, year = String(new Date().getFullYear())): Promise<Card | null> {
  const p = await profileOf(username);
  if (!p) return null;
  const name = p.display_name || p.username;
  const hide = (p.hidden_types || []).filter((t) => t in LABEL);
  const done = await rest<{ type: string; cover: string | null; rating: number | null }[]>(
    `entries?user_id=eq.${p.id}&status=eq.completed&date=gte.${year}-01-01&date=lt.${Number(year) + 1}-01-01&select=type,cover,rating&order=rating.desc.nullslast&limit=1000`);
  const list = (done || []).filter((e) => !hide.includes(e.type));
  const by = Object.keys(LABEL).map((t) => [t, list.filter((e) => e.type === t).length] as const).filter(([, c]) => c);
  const line = list.length ? by.map(([t, c]) => `${c} ${LABEL[t][0].toLocaleLowerCase("tr")}`).join(" · ") : "Yılın özeti";
  return {
    kicker: `${year} özeti`, title: name, sub: list.length ? `${year} yılında ${list.length} şey bitirdi` : `@${p.username}`, line,
    avatar: p.avatar_url, accent: p.accent, covers: list.filter((e) => e.cover).map((e) => big(e.cover)),
    description: `${name} ${year} yılında ${list.length} şey bitirdi: ${line}. Ancalog yıl özeti.`,
  };
}

// <head> içine: başlık, açıklama, paylaşım yazıları (görseli aynı klasördeki opengraph-image ekler)
export function metaOf(c: Card | null, path: string, fallback: string) {
  if (!c) return { title: `${fallback} · Ancalog` };
  const title = `${c.title}${c.sub && c.kicker === "Profil" ? ` (${c.sub})` : ""} · Ancalog`;
  return {
    title, description: c.description,
    openGraph: { title, description: c.description, url: `${SITE}${path}`, siteName: "Ancalog", locale: "tr_TR", type: "website" as const },
    twitter: { card: "summary_large_image" as const, title, description: c.description },
  };
}

// Kart bulunamazsa sitenin genel kartı
export const siteCard: OgData = { kicker: "Ancalog", title: "Oyun, film, dizi, anime ve müzik günlüğün", line: "Logla, puanla, listeler yap. Her yerden içe aktar." };
