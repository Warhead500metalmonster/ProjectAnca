"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry, RawgGame, Status } from "@/lib/types";
import { norm, smallImage } from "@/lib/format";
import { tmdb, tmdbImage } from "@/lib/data";
import { rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";

// Başka sitelerden kütüphane aktarma: Steam oyunları ve Letterboxd filmleri
export default function ImportPage() {
  const { me, ready } = useApp();
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me) return <div className="empty">Bu sayfa için giriş yapmalısın. <br /><Link className="btn" href="/login">Giriş yap</Link></div>;
  return (
    <div className="import-page">
      <section className="search-hero">
        <h1>İçe aktar</h1>
        <p className="muted" style={{ margin: 0 }}>Başka yerdeki kütüphaneni tek seferde Ancalog&apos;a taşı. Zaten kütüphanende olanlar tekrar eklenmez.</p>
      </section>
      <Steam />
      <Letterboxd />
    </div>
  );
}

type Row = Omit<Partial<Entry>, "id" | "profiles" | "likes" | "comments">;

// Aynı anda en fazla 4 istek: dış siteleri yormadan hızlıca eşleştir
async function pool<T, R>(items: T[], fn: (x: T) => Promise<R>, onStep: (done: number) => void) {
  const out: R[] = new Array(items.length);
  let next = 0, done = 0;
  await Promise.all(Array.from({ length: 4 }, async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
      onStep(++done);
    }
  }));
  return out;
}

async function insertAll(rows: Row[], userId: string) {
  for (let i = 0; i < rows.length; i += 50) await q(sb().from("entries").insert(rows.slice(i, i + 50).map((r) => ({ ...r, user_id: userId }))));
}

function Progress({ done, total, label }: { done: number; total: number; label: string }) {
  return (
    <div className="import-progress">
      <span>{label} {done} / {total}</span>
      <div><i style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div>
    </div>
  );
}

// ---------- Steam ----------

interface SteamGame { appid: number; name: string; minutes: number; last: number }
const MONTH = 30 * 86400;

function steamStatus(g: SteamGame): Status {
  if (!g.minutes) return "planned";
  return Date.now() / 1000 - g.last < MONTH ? "active" : "paused";
}

function Steam() {
  const { me, mine, toast, refresh } = useApp();
  const [link, setLink] = useState("");
  const [games, setGames] = useState<SteamGame[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);

  const haveSteam = new Set(mine.map((e) => e.ext_id).filter((x) => x?.startsWith("steam:")));
  const haveTitle = new Set(mine.filter((e) => e.type === "game").map((e) => norm(e.title)));
  const already = (g: SteamGame) => haveSteam.has(`steam:${g.appid}`) || haveTitle.has(norm(g.name));

  async function load(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch(`/api/steam?profile=${encodeURIComponent(link.trim())}`);
      const d = await r.json();
      if (!r.ok) {
        return setError({
          "no-key": "Steam bağlantısı henüz kurulmadı. Site sahibine haber ver.",
          "bad-profile": "Steam profil linkini yapıştır (ör. https://steamcommunity.com/id/kullaniciadin).",
          "not-found": "Bu Steam profili bulunamadı.",
          private: "Oyun listen gizli. Steam'de Profil → Profili Düzenle → Gizlilik Ayarları → Oyun ayrıntıları: Herkese açık yap, sonra tekrar dene.",
        }[d.error as string] || "Steam'e ulaşılamadı, biraz sonra tekrar dene.");
      }
      const list: SteamGame[] = d.games.sort((a: SteamGame, b: SteamGame) => b.minutes - a.minutes);
      setGames(list);
      setPicked(new Set(list.filter((g) => g.minutes > 0 && !already(g)).map((g) => g.appid)));
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!me || !games) return;
    const chosen = games.filter((g) => picked.has(g.appid) && !already(g));
    if (!chosen.length) return;
    setBusy(true);
    setStep({ done: 0, total: chosen.length });
    try {
      const myRawg = new Set(mine.map((e) => e.rawg_id).filter(Boolean));
      const rows = (await pool(chosen, async (g): Promise<Row | null> => {
        // RAWG'de eşleştir: oyun sayfası, kapak ve çıkış yılı gelsin
        const found = (await rawg<{ results?: RawgGame[] }>("games", { search: g.name, search_precise: "true", page_size: 3 }).catch(() => ({ results: [] }))).results || [];
        const hit = found.find((x) => norm(x.name) === norm(g.name)) || found[0];
        if (hit && myRawg.has(hit.id)) return null;
        if (hit) myRawg.add(hit.id);
        return {
          type: "game", title: (hit?.name || g.name).slice(0, 200), rawg_id: hit?.id ?? null, ext_id: `steam:${g.appid}`,
          year: parseInt(hit?.released || "") || null,
          cover: hit?.background_image ? smallImage(hit.background_image) : `https://cdn.cloudflare.steamstatic.com/steam/apps/${g.appid}/header.jpg`,
          status: steamStatus(g), playtime_sec: g.minutes * 60 || null, hours: g.minutes ? Math.round(g.minutes / 6) / 10 : null,
          platform: "PC", store: "Steam", rating: 0, updated_at: new Date((g.last || Date.now() / 1000) * 1000).toISOString(),
        };
      }, (done) => setStep({ done, total: chosen.length }))).filter(Boolean) as Row[];
      await insertAll(rows, me.id);
      toast(`${rows.length} oyun kütüphanene eklendi ✓`);
      setGames(null);
      setLink("");
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  const toggle = (id: number) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fresh = games?.filter((g) => !already(g)) || [];

  return (
    <section className="section import-card">
      <div className="section-head"><h2>Steam</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>Oyunların ve oynama sürelerin gelir. Son bir ayda oynadıkların <b>Oynuyorum</b>, daha önce oynadıkların <b>Ara verdim</b>, hiç açmadıkların <b>Planlandı</b> olarak eklenir; sonra tek tek değiştirebilirsin.</p>
      {!games ? (
        <form className="admin-add" onSubmit={load}>
          <input className="input" placeholder="Steam profil linkin (https://steamcommunity.com/id/…)" value={link} onChange={(e) => setLink(e.target.value)} />
          <button className="btn primary" disabled={busy || !link.trim()}>{busy ? "Getiriliyor…" : "Oyunlarımı getir"}</button>
        </form>
      ) : (
        <>
          <div className="import-bar">
            <span><b>{games.length}</b> oyun bulundu{games.length - fresh.length ? ` · ${games.length - fresh.length} tanesi zaten kütüphanende` : ""}</span>
            <button className="link" onClick={() => setPicked(new Set(fresh.map((g) => g.appid)))}>Hepsini seç</button>
            <button className="link" onClick={() => setPicked(new Set(fresh.filter((g) => g.minutes > 0).map((g) => g.appid)))}>Sadece oynadıklarım</button>
            <button className="link" onClick={() => setPicked(new Set())}>Hiçbiri</button>
          </div>
          <div className="import-list">
            {games.map((g) => (
              <label key={g.appid} className={already(g) ? "off" : ""}>
                <input type="checkbox" disabled={already(g) || busy} checked={!already(g) && picked.has(g.appid)} onChange={() => toggle(g.appid)} />
                <span className="name">{g.name}</span>
                <small>{already(g) ? "zaten var" : g.minutes ? `${Math.round(g.minutes / 60).toLocaleString("tr")} sa` : "oynanmamış"}</small>
              </label>
            ))}
          </div>
          {step && <Progress done={step.done} total={step.total} label="Oyunlar eşleştiriliyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setGames(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !picked.size} onClick={run}>{busy ? "Ekleniyor…" : `${[...picked].filter((id) => fresh.some((g) => g.appid === id)).length} oyunu ekle`}</button>
          </div>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

// ---------- Letterboxd ----------

// Basit CSV okuyucu: tırnak içindeki virgül ve satır sonlarını doğru böler
function parseCsv(text: string): Record<string, string>[] {
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(cell); rows.push(row); row = []; cell = "";
    } else cell += c;
  }
  if (cell || row.length) { row.push(cell); rows.push(row); }
  const [head, ...body] = rows;
  return body.filter((r) => r.some(Boolean)).map((r) => Object.fromEntries((head || []).map((h, i) => [h.trim(), (r[i] || "").trim()])));
}

interface Film { name: string; year: number | null; rating: number; date: string | null; review: string; planned: boolean }

function Letterboxd() {
  const { me, mine, toast, refresh } = useApp();
  const [films, setFilms] = useState<Film[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const have = new Set(mine.filter((e) => e.type === "movie").map((e) => norm(e.title)));

  // Letterboxd dışa aktarmasındaki dosyalar: diary, ratings, watched, reviews, watchlist (.csv). Birden fazlası birlikte seçilebilir.
  async function read(files: FileList | null) {
    if (!files?.length) return;
    const map = new Map<string, Film>();
    for (const f of [...files]) {
      const kind = f.name.toLowerCase();
      for (const r of parseCsv(await f.text())) {
        if (!r.Name) continue;
        const key = `${norm(r.Name)}|${r.Year}`;
        const film = map.get(key) || { name: r.Name, year: parseInt(r.Year) || null, rating: 0, date: null, review: "", planned: true };
        if (kind.includes("watchlist")) { map.set(key, film); continue; }
        film.planned = false;
        if (r.Rating) film.rating = Math.min(10, Math.round(Number(r.Rating) * 2 * 2) / 2);
        const d = r["Watched Date"] || r.Date;
        if (/^\d{4}-\d{2}-\d{2}$/.test(d) && (!film.date || d > film.date)) film.date = d;
        if (r.Review) film.review = r.Review.slice(0, 5000);
        map.set(key, film);
      }
    }
    const list = [...map.values()];
    if (!list.length) return toast("Bu dosyada film bulunamadı. Letterboxd'dan indirdiğin .csv dosyalarını seç.");
    setFilms(list);
  }

  async function run() {
    if (!me || !films) return;
    const chosen = films.filter((f) => !have.has(norm(f.name)));
    setBusy(true);
    setStep({ done: 0, total: chosen.length });
    try {
      const rows = await pool(chosen, async (f): Promise<Row> => {
        // TMDB'de eşleştir: afiş ve film sayfası gelsin
        const p: Record<string, string | number> = { query: f.name };
        if (f.year) p.primary_release_year = f.year;
        const hit = (await tmdb<{ results?: { id: number; title?: string; poster_path?: string | null; release_date?: string }[] }>("search/movie", p).catch(() => ({ results: [] }))).results?.[0];
        return {
          type: "movie", title: (hit?.title || f.name).slice(0, 200), year: f.year || parseInt(hit?.release_date || "") || null,
          cover: tmdbImage(hit?.poster_path), ext_id: hit ? `tmdb:movie:${hit.id}` : null, rawg_id: null,
          status: f.planned ? "planned" : "completed", rating: f.rating, date: f.date, notes: f.review || null,
          updated_at: new Date(f.date ? f.date + "T12:00" : Date.now()).toISOString(),
        };
      }, (done) => setStep({ done, total: chosen.length }));
      await insertAll(rows, me.id);
      toast(`${rows.length} film kütüphanene eklendi ✓`);
      setFilms(null);
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  const fresh = films?.filter((f) => !have.has(norm(f.name))) || [];
  return (
    <section className="section import-card">
      <div className="section-head"><h2>Letterboxd</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Letterboxd&apos;da <b>Settings → Data → Export Your Data</b>&apos;ya bas, inen zip dosyasını aç ve içindeki <b>.csv</b> dosyalarını aşağıdan seç
        (hepsini birden seçebilirsin). Puanların, izleme tarihlerin, incelemelerin ve izleme listen gelir.
      </p>
      {!films ? (
        <label className="btn file-btn">CSV dosyalarını seç<input type="file" accept=".csv,text/csv" multiple onChange={(e) => read(e.target.files)} /></label>
      ) : (
        <>
          <div className="import-bar">
            <span><b>{films.length}</b> film bulundu{films.length - fresh.length ? ` · ${films.length - fresh.length} tanesi zaten kütüphanende` : ""} · {fresh.filter((f) => f.planned).length} izleme listesinde</span>
          </div>
          {step && <Progress done={step.done} total={step.total} label="Filmler eşleştiriliyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setFilms(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !fresh.length} onClick={run}>{busy ? "Ekleniyor…" : `${fresh.length} filmi ekle`}</button>
          </div>
        </>
      )}
    </section>
  );
}
