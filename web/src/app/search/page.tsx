"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { Entry, EntryType, Item, Profile, RawgGame } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { avgText, contentHref, contentKey, likeEsc, smallImage } from "@/lib/format";
import { anilist, fetchAll, searchMusic, tmdb, tmdbImage, SEARCH_CREDITS } from "@/lib/data";
import { rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { Cover, UserRow } from "@/components/ui";

type Sort = "logged" | "completed" | "active" | "rating" | "newest" | "oldest" | "title";
const SORTS: [Sort, string][] = [
  ["logged", "En çok loglanan"],
  ["completed", "En çok bitirilen"],
  ["active", "Şu an en çok oynanan / izlenen"],
  ["rating", "En yüksek puanlı"],
  ["newest", "En yeni çıkan"],
  ["oldest", "En eski çıkan"],
  ["title", "İsim (A-Z)"],
];

interface Agg extends Item { n: number; done: number; active: number; avg: number }

// Ancalog kayıtlarını içerik bazında topla: kaç kişi logladı, kaç kişi bitirdi, ortalama puan
function aggregate(rows: Entry[]): Agg[] {
  const m = new Map<string, Agg & { sum: number; rated: number }>();
  for (const r of rows) {
    const k = contentKey(r);
    const a = m.get(k) || { type: r.type, title: r.title, year: r.year, creator: r.creator, cover: r.cover, rawg_id: r.rawg_id, ext_id: r.ext_id, n: 0, done: 0, active: 0, avg: 0, sum: 0, rated: 0 };
    a.n++;
    if (r.status === "completed") a.done++;
    if (r.status === "active") a.active++;
    if (r.rating) { a.sum += Number(r.rating); a.rated++; }
    if (!a.cover && r.cover) a.cover = r.cover;
    if (!a.ext_id && r.ext_id) a.ext_id = r.ext_id;
    m.set(k, a);
  }
  return [...m.values()].map((a) => ({ ...a, avg: a.rated ? a.sum / a.rated : 0 }));
}

const SORTERS: Record<Sort, (a: Agg, b: Agg) => number> = {
  logged: (a, b) => b.n - a.n || b.done - a.done,
  completed: (a, b) => b.done - a.done || b.n - a.n,
  active: (a, b) => b.active - a.active || b.n - a.n,
  rating: (a, b) => b.avg - a.avg || b.n - a.n,
  newest: (a, b) => (b.year || 0) - (a.year || 0),
  oldest: (a, b) => (a.year || 9999) - (b.year || 9999),
  title: (a, b) => a.title.localeCompare(b.title, "tr"),
};

export default function SearchPage() {
  const params = useSearchParams();
  const router = useRouter();
  const path = usePathname();
  const { scale } = useApp();

  const [text, setText] = useState(params.get("q") || "");
  const [type, setType] = useState<EntryType | "all">((params.get("type") as EntryType) || "all");
  const [from, setFrom] = useState(params.get("from") || "");
  const [to, setTo] = useState(params.get("to") || "");
  const [sort, setSort] = useState<Sort>((params.get("sort") as Sort) || "logged");
  const [users, setUsers] = useState<Profile[]>([]);
  const [local, setLocal] = useState<Agg[] | null>(null);
  const [external, setExternal] = useState<(Item & { sub?: string })[] | null>(null);
  const seq = useRef(0);
  const written = useRef(params.get("q") || ""); // adrese en son bizim yazdığımız arama

  // Üst çubuktan yeni arama gelince kutuyu güncelle (kendi yazdığımız adres değişikliğini yok say)
  useEffect(() => {
    const pq = params.get("q") || "";
    if (pq !== written.current) { written.current = pq; setText(pq); }
  }, [params]);

  useEffect(() => {
    const s = ++seq.current;
    const timer = setTimeout(async () => {
      const qs = new URLSearchParams(Object.entries({ q: text.trim(), type: type === "all" ? "" : type, from, to, sort: sort === "logged" ? "" : sort }).filter(([, v]) => v));
      written.current = text.trim();
      router.replace(`${path}${qs.size ? `?${qs}` : ""}`, { scroll: false });
      setLocal(null);
      setExternal(null);
      const [u, l, x] = await Promise.all([findUsers(text), findLocal(text, type, from, to), findExternal(text, type, from, to, sort)]);
      if (s !== seq.current) return;
      setUsers(u);
      setLocal(l.sort(SORTERS[sort]).slice(0, 48));
      setExternal(x);
    }, 300);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, type, from, to, sort]);

  const yearOk = (v: string) => !v || /^\d{4}$/.test(v);
  const credit = type !== "all" ? SEARCH_CREDITS[type] : SEARCH_CREDITS.game;

  return (
    <>
      <section className="search-hero">
        <h1>Keşfet</h1>
        <p className="muted search-sub">Her oyun, film, dizi, anime ve albüm burada. Adını yaz, aynı anda her yerde aransın; bir şeye tıkla, sayfasını gör, kütüphanene ekle.</p>
        <input className="input big" type="search" autoFocus value={text} placeholder="Ne arıyorsun? Ör. Zelda, Breaking Bad, Frieren…" onChange={(e) => setText(e.target.value)} />
        <div className="tabs">
          {([["all", "", "Tümü"], ...TYPE_KEYS.map((k) => [k, "", TYPES[k].label])] as [EntryType | "all", string, string][]).map(([k, icon, label]) => (
            <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => setType(k)}>{icon} {label}</button>
          ))}
        </div>
        <div className="filters">
          <label className="inline">Çıkış yılı
            <input className="input year" inputMode="numeric" maxLength={4} placeholder="2006" value={from} onChange={(e) => setFrom(e.target.value.replace(/\D/g, ""))} />
            –
            <input className="input year" inputMode="numeric" maxLength={4} placeholder="2006" value={to} onChange={(e) => setTo(e.target.value.replace(/\D/g, ""))} />
          </label>
          <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} aria-label="Sırala">
            {SORTS.map(([k, l]) => <option key={k} value={k}>↕ {l}</option>)}
          </select>
          {(from || to || sort !== "logged" || type !== "all") && <button className="link" onClick={() => { setFrom(""); setTo(""); setSort("logged"); setType("all"); }}>Filtreleri temizle</button>}
        </div>
        {(!yearOk(from) || !yearOk(to)) && <p className="form-error">Yılı 4 haneli yaz (ör. 2006).</p>}
      </section>

      {users.length > 0 && (
        <section className="section">
          <div className="section-head"><h2>Kişiler</h2></div>
          <div className="members">{users.map((p) => <UserRow key={p.id} p={p} />)}</div>
        </section>
      )}

      {/* Arama yapılınca sitede kimse loglamadıysa boş kutu göstermeyelim: aşağıda her yerden sonuçlar var */}
      {!(local?.length === 0 && text.trim() && external?.length) && <section className="section">
        <div className="section-head"><h2>Ancalog&apos;da loglananlar</h2><span className="muted">{local ? `${local.length} içerik` : ""}</span></div>
        {local === null ? <div className="loading">Aranıyor…</div>
          : local.length ? (
            <div className="grid">
              {local.map((a) => (
                <Link key={contentKey(a)} className="card" href={contentHref(a)}>
                  <div className={`poster ${TYPES[a.type].square ? "square" : ""}`}>
                    <div className="ph">{TYPES[a.type].label}</div><Cover src={a.cover} />
                    {type === "all" && <span className="kind">{TYPES[a.type].label}</span>}
                    {a.avg ? <span className="rating">★ {avgText(a.avg, scale).split("/")[0]}</span> : null}
                  </div>
                  <div className="card-title">{a.title}</div>
                  <div className="card-meta">{a.n} kişi · {a.done} {TYPES[a.type as keyof typeof TYPES]?.done || "bitirdi"}{a.active ? ` · ${a.active} devam` : ""}{a.year ? ` · ${a.year}` : ""}</div>
                </Link>
              ))}
            </div>
          ) : <div className="empty">Bu filtrelere uyan loglanmış içerik yok.</div>}
      </section>}

      {external === null ? <section className="section"><div className="loading">Her yerde aranıyor…</div></section>
        : (type === "all" ? TYPE_KEYS : [type]).map((k) => {
          const list = external.filter((x) => x.type === k);
          if (!list.length) return null;
          const [src, url] = type === "all" ? SEARCH_CREDITS[k] : credit;
          return (
            <section className="section" key={k}>
              <div className="section-head">
                <h2>{TYPES[k].plural}</h2>
                <span className="muted small">
                  {type === "all" && <button className="link" onClick={() => setType(k)}>Daha fazla {TYPES[k].plural.toLocaleLowerCase("tr")} →</button>}
                  {" "}<a href={url} target="_blank" rel="noopener" className="muted">Veri: {src}</a>
                </span>
              </div>
              <div className="grid">
                {list.map((x, i) => (
                  <Link key={i} className="card" href={contentHref(x)}>
                    <div className={`poster ${TYPES[x.type].square ? "square" : ""}`}><div className="ph">{TYPES[x.type].label}</div><Cover src={x.cover} /></div>
                    <div className="card-title">{x.title}</div>
                    <div className="card-meta">{[x.sub, x.year].filter(Boolean).join(" · ")}</div>
                  </Link>
                ))}
              </div>
            </section>
          );
        })}
    </>
  );
}

async function findUsers(text: string): Promise<Profile[]> {
  const term = text.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (term.length < 2) return [];
  return q<Profile[]>(sb().from("profiles").select("*").ilike("username", `%${term}%`).limit(8)).catch(() => []);
}

async function findLocal(text: string, type: EntryType | "all", from: string, to: string): Promise<Agg[]> {
  const rows = await fetchAll<Entry>((a, b) => {
    let req = sb().from("entries").select("type, title, year, creator, cover, rawg_id, ext_id, status, rating").order("id").range(a, b);
    if (type !== "all") req = req.eq("type", type);
    if (/^\d{4}$/.test(from)) req = req.gte("year", Number(from));
    if (/^\d{4}$/.test(to)) req = req.lte("year", Number(to));
    if (text.trim()) req = req.ilike("title", `%${likeEsc(text.trim())}%`);
    return req;
  }, 10000).catch(() => []);
  return aggregate(rows);
}

// Dış kaynaktan arama: oyun RAWG, film/dizi TMDB, anime AniList, müzik iTunes
async function findExternal(text: string, type: EntryType | "all", from: string, to: string, sort: Sort): Promise<(Item & { sub?: string })[]> {
  const t = text.trim();
  const y1 = /^\d{4}$/.test(from) ? Number(from) : null, y2 = /^\d{4}$/.test(to) ? Number(to) : null;
  const lo = y1 ?? y2, hi = y2 ?? y1;
  const inRange = (y: number | null) => !lo || (y !== null && y >= lo && y <= hi!);
  // Tümü: oyun, film, dizi, anime ve müzikte aynı anda ara (Google gibi tek kutu); her türden ilk 12
  if (type === "all") {
    const kinds: EntryType[] = t ? ["game", "movie", "show", "anime", "music"] : ["game", "movie", "show", "anime"];
    const all = await Promise.all(kinds.map((k) => findExternal(text, k, from, to, sort).then((r) => r.slice(0, 12))));
    return all.flat();
  }
  try {
    if (type === "game") {
      const ordering = { rating: "-rating", newest: "-released", oldest: "released", title: "name" }[sort as string] || "-added";
      const p: Record<string, string | number> = { page_size: 18, ordering };
      if (t) p.search = t;
      if (lo) p.dates = `${lo}-01-01,${hi}-12-31`;
      if (!t && sort === "oldest" && !lo) p.dates = "1970-01-01,2100-12-31";
      const data = await rawg<{ results?: RawgGame[] }>("games", p);
      return (data.results || []).map((g) => ({
        type: "game", title: g.name, year: parseInt(g.released || "") || null, creator: null,
        cover: g.background_image ? smallImage(g.background_image) : null, rawg_id: g.id, ext_id: null,
        sub: g.genres?.slice(0, 2).map((x) => x.name).join(", "),
      }));
    }
    if (type === "movie" || type === "show") {
      const kind = type === "movie" ? "movie" : "tv";
      const dateKey = kind === "movie" ? "primary_release_date" : "first_air_date";
      const sortBy = { rating: "vote_average.desc", newest: `${dateKey}.desc`, oldest: `${dateKey}.asc`, title: "original_title.asc" }[sort as string] || "popularity.desc";
      let results: { id: number; title?: string; name?: string; release_date?: string; first_air_date?: string; poster_path?: string | null }[];
      if (t) {
        const p: Record<string, string | number> = { query: t };
        if (lo && lo === hi) p[kind === "movie" ? "primary_release_year" : "first_air_date_year"] = lo;
        results = (await tmdb<{ results: typeof results }>(`search/${kind}`, p)).results || [];
      } else {
        const p: Record<string, string | number> = { sort_by: sortBy, "vote_count.gte": sort === "rating" ? 300 : 20 };
        if (lo) { p[`${dateKey}.gte`] = `${lo}-01-01`; p[`${dateKey}.lte`] = `${hi}-12-31`; }
        results = (await tmdb<{ results: typeof results }>(`discover/${kind}`, p)).results || [];
      }
      return results.map((h) => ({
        type, title: h.title || h.name || "", year: parseInt(h.release_date || h.first_air_date || "") || null, creator: null,
        cover: tmdbImage(h.poster_path), rawg_id: null, ext_id: `tmdb:${kind}:${h.id}`,
      })).filter((x) => inRange(x.year)).slice(0, 18);
    }
    if (type === "anime") {
      const sortKey = { rating: "SCORE_DESC", newest: "START_DATE_DESC", oldest: "START_DATE", title: "TITLE_ROMAJI" }[sort as string] || (t ? "SEARCH_MATCH" : "POPULARITY_DESC");
      const data = await anilist<{ Page: { media: { id: number; title: { romaji?: string; english?: string }; startDate?: { year?: number }; coverImage?: { large?: string }; studios?: { nodes: { name: string }[] } }[] } }>(
        `query ($s: String, $sort: [MediaSort], $gt: FuzzyDateInt, $lt: FuzzyDateInt) { Page(perPage: 18) {
          media(search: $s, type: ANIME, sort: $sort, startDate_greater: $gt, startDate_lesser: $lt, isAdult: false) {
          id title { romaji english } startDate { year } coverImage { large } studios(isMain: true) { nodes { name } } } } }`,
        { s: t || undefined, sort: [sortKey], gt: lo ? lo * 10000 : undefined, lt: hi ? hi * 10000 + 1231 : undefined });
      return data.Page.media.map((m) => ({
        type: "anime", title: m.title.english || m.title.romaji || "", year: m.startDate?.year || null, creator: m.studios?.nodes[0]?.name || null,
        cover: m.coverImage?.large || null, rawg_id: null, ext_id: `anilist:${m.id}`, sub: m.studios?.nodes[0]?.name,
      }));
    }
    if (type === "music" && t) return (await searchMusic(t)).filter((m) => inRange(m.year));
  } catch { /* dış kaynak çalışmazsa sadece Ancalog sonuçları görünür */ }
  return [];
}
