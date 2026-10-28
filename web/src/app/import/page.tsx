"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry, RawgGame, Status } from "@/lib/types";
import { norm, smallImage } from "@/lib/format";
import { musicMeta, tmdb, tmdbImage } from "@/lib/data";
import { STATUSES, STORES, statusLabel } from "@/lib/constants";
import { rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";

// Başka sitelerden kütüphane aktarma: Steam, PlayStation / Xbox / Epic / HowLongToBeat listeleri, Letterboxd ve Spotify
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
      <ListImport />
      <Letterboxd />
      <Spotify />
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

type Ach = Record<string, [number, number]>;

// Steam'den gelen oyunlar kategorisiz eklenir (Bitti / Oynuyorum / Backlog'a konmaz).
// İsteyen, bütün başarımlarını açtığı oyunları "Bitti" yapabilir.
const allDone = (g: SteamGame, ach?: Ach) => { const a = ach?.[g.appid]; return !!a && a[1] > 0 && a[0] === a[1]; };
function steamStatus(g: SteamGame, ach?: Ach): Status {
  return allDone(g, ach) ? "completed" : "owned";
}

// Oynanmış oyunların başarımlarını 40'arlı paketlerle sor (Steam'i yormadan)
async function steamAchievements(steamid: string, games: SteamGame[], onStep: (done: number) => void): Promise<Ach> {
  const played = games.filter((g) => g.minutes > 0).map((g) => g.appid);
  const chunks: number[][] = [];
  for (let i = 0; i < played.length; i += 40) chunks.push(played.slice(i, i + 40));
  const parts = await pool(chunks, (ids) => fetch(`/api/steam?achievements=${steamid}&appids=${ids.join(",")}`)
    .then((r) => r.json()).then((d) => (d.ach || {}) as Ach).catch(() => ({} as Ach)), (n) => onStep(Math.min(played.length, n * 40)));
  return Object.assign({}, ...parts);
}

function Steam() {
  const { me, mine, toast, refresh } = useApp();
  const [link, setLink] = useState("");
  const [games, setGames] = useState<SteamGame[] | null>(null);
  const [steamid, setSteamid] = useState("");
  const [useAch, setUseAch] = useState(false); // başarımların hepsi açık olanları "Bitti" yap
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
      setSteamid(d.steamid);
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
    try {
      let ach: Ach = {};
      if (useAch) {
        setStep({ done: 0, total: chosen.filter((g) => g.minutes > 0).length });
        ach = await steamAchievements(steamid, chosen, (done) => setStep((s) => s && { ...s, done }));
      }
      setStep({ done: 0, total: chosen.length });
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
          status: steamStatus(g, ach), playtime_sec: g.minutes * 60 || null, hours: g.minutes ? Math.round(g.minutes / 6) / 10 : null,
          platform: "PC", store: "Steam", rating: 0, updated_at: new Date((g.last || Date.now() / 1000) * 1000).toISOString(),
        };
      }, (done) => setStep({ done, total: chosen.length }))).filter(Boolean) as Row[];
      await insertAll(rows, me.id);
      const done = rows.filter((r) => r.status === "completed").length;
      toast(`${rows.length} oyun kütüphanene eklendi${done ? `, ${done} tanesi bitirildi olarak` : ""}`);
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

  // Daha önce aktarılmış Steam oyunlarını tazele: oynama süresi ve başarımların hepsi açıldıysa "Bitirdim"
  async function resync() {
    if (!me || !games) return;
    const byApp = new Map(games.map((g) => [`steam:${g.appid}`, g]));
    const old = mine.filter((e) => e.ext_id && byApp.has(e.ext_id));
    if (!old.length) return toast("Kütüphanende Steam'den gelen oyun yok.");
    setBusy(true);
    try {
      const list = old.map((e) => byApp.get(e.ext_id!)!);
      let ach: Ach = {};
      if (useAch) {
        setStep({ done: 0, total: list.filter((g) => g.minutes > 0).length });
        ach = await steamAchievements(steamid, list, (done) => setStep((s) => s && { ...s, done }));
      }
      let finished = 0, timed = 0;
      const changes = old.flatMap((e) => {
        const g = byApp.get(e.ext_id!)!;
        const patch: Row = {};
        if (g.minutes && g.minutes * 60 !== e.playtime_sec) { patch.playtime_sec = g.minutes * 60; patch.hours = Math.round(g.minutes / 6) / 10; timed++; }
        if (e.status !== "completed" && allDone(g, ach)) { patch.status = "completed"; finished++; }
        return Object.keys(patch).length ? [{ id: e.id, patch }] : [];
      });
      setStep({ done: 0, total: changes.length });
      await pool(changes, ({ id, patch }) => q(sb().from("entries").update(patch).eq("id", id)), (done) => setStep({ done, total: changes.length }));
      toast(changes.length ? `${timed} oyunun süresi güncellendi${finished ? `, ${finished} oyun Bitti yapıldı` : ""}.` : "Her şey zaten güncel.");
      refresh();
    } catch (err) {
      toast("Güncellenemedi: " + (err as Error).message);
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
      <p className="muted small" style={{ marginTop: 0 }}>Oyunların ve oynama sürelerin gelir. Oyunlar hiçbir kategoriye konmadan (<b>Kategorisiz</b>) eklenir; Bitti, Oynuyorum ya da Backlog&apos;a istediğini sonra sen taşırsın.
        Daha önce aktardıysan aynı linkle tekrar getirip <b>Kütüphanemdekileri güncelle</b>&apos;ye bas: oynama süreleri tazelenir.</p>
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
            {games.length > fresh.length && <button className="btn" disabled={busy} onClick={resync}>Kütüphanemdekileri güncelle</button>}
          </div>
          <label className="check-line"><input type="checkbox" checked={useAch} disabled={busy} onChange={(e) => setUseAch(e.target.checked)} /> Bütün başarımlarını açtığım oyunları <b>Bitti</b> yap (isteğe bağlı)</label>
          <div className="import-list">
            {games.map((g) => (
              <label key={g.appid} className={already(g) ? "off" : ""}>
                <input type="checkbox" disabled={already(g) || busy} checked={!already(g) && picked.has(g.appid)} onChange={() => toggle(g.appid)} />
                <span className="name">{g.name}</span>
                <small>{already(g) ? "zaten var" : g.minutes ? `${Math.round(g.minutes / 60).toLocaleString("tr")} sa` : "oynanmamış"}</small>
              </label>
            ))}
          </div>
          {step && <Progress done={step.done} total={step.total} label="İşleniyor…" />}
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

// ---------- Spotify ----------

interface Album { artist: string; title: string; kind: "album" | "track"; uri: string; ms: number; last: string | null }

// Spotify'ın "Hesap verileri" dışa aktarması: YourLibrary.json (kaydedilen albüm ve şarkılar)
// ve isteğe bağlı dinleme geçmişi (Streaming_History_Audio_*.json / StreamingHistory_music_*.json → dinleme süresi)
function Spotify() {
  const { me, mine, toast, refresh } = useApp();
  const [items, setItems] = useState<Album[] | null>(null);
  const [withTracks, setWithTracks] = useState(false);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const have = new Set(mine.filter((e) => e.type === "music").map((e) => `${norm(e.title)}|${norm(e.creator)}`));
  const key = (a: Pick<Album, "title" | "artist">) => `${norm(a.title)}|${norm(a.artist)}`;

  async function read(files: FileList | null) {
    if (!files?.length) return;
    const map = new Map<string, Album>();
    const add = (a: Omit<Album, "ms" | "last">, ms = 0, last: string | null = null) => {
      if (!a.title || !a.artist) return;
      const k = `${a.kind}|${key(a)}`;
      const x = map.get(k) || { ...a, ms: 0, last: null };
      x.ms += ms;
      if (last && (!x.last || last > x.last)) x.last = last;
      map.set(k, x);
    };
    const history = new Map<string, { ms: number; last: string | null }>(); // albüm başına dinleme süresi
    for (const f of [...files]) {
      let data: unknown;
      try { data = JSON.parse(await f.text()); } catch { continue; }
      if (Array.isArray(data)) {
        for (const h of data as Record<string, string | number | null>[]) {
          const artist = String(h.master_metadata_album_artist_name || h.artistName || "");
          const album = String(h.master_metadata_album_album_name || "");
          const ms = Number(h.ms_played ?? h.msPlayed) || 0;
          const when = String(h.ts || h.endTime || "").slice(0, 10) || null;
          if (!artist) continue;
          const k = album ? `${norm(album)}|${norm(artist)}` : `artist|${norm(artist)}`;
          const x = history.get(k) || { ms: 0, last: null };
          x.ms += ms;
          if (when && (!x.last || when > x.last)) x.last = when;
          history.set(k, x);
          // Genişletilmiş geçmişte albüm adı var: 30 dakikadan çok dinlenen albümler de gelsin
          if (album) add({ artist, title: album, kind: "album", uri: "" }, 0, null);
        }
      } else if (data && typeof data === "object") {
        const lib = data as { albums?: { artist: string; album: string; uri: string }[]; tracks?: { artist: string; album: string; track: string; uri: string }[] };
        for (const a of lib.albums || []) add({ artist: a.artist, title: a.album, kind: "album", uri: a.uri });
        for (const t of lib.tracks || []) add({ artist: t.artist, title: t.track, kind: "track", uri: t.uri });
      }
    }
    // Dinleme sürelerini albümlere dağıt; geçmişte az dinlenen (30 dk altı) ve kütüphanede olmayan albümleri at
    for (const [k, a] of map) {
      if (a.kind !== "album") continue;
      const h = history.get(key(a));
      if (h) { a.ms = h.ms; a.last = h.last; }
      if (!a.uri && a.ms < 1800000) map.delete(k);
    }
    const list = [...map.values()].sort((a, b) => b.ms - a.ms);
    if (!list.length) return toast("Bu dosyalarda albüm ya da şarkı bulunamadı. Spotify'dan gelen YourLibrary.json dosyasını seç.");
    setItems(list);
  }

  const chosen = (items || []).filter((a) => (a.kind === "album" || withTracks) && !have.has(key(a)));

  async function run() {
    if (!me || !chosen.length) return;
    setBusy(true);
    setStep({ done: 0, total: chosen.length });
    try {
      const rows = await pool(chosen, async (a): Promise<Row> => {
        const meta = await musicMeta(a.kind, a.artist, a.title);
        const id = a.uri.match(/^spotify:(album|track):(\w+)$/);
        return {
          type: "music", title: a.title.slice(0, 200), creator: a.artist.slice(0, 200), year: meta.year, cover: meta.cover, rawg_id: null,
          ext_id: id ? `spotify:${id[1]}:${id[2]}` : null, status: "completed", rating: 0, store: "Spotify",
          playtime_sec: a.ms ? Math.round(a.ms / 1000) : null, date: a.last,
          progress: a.kind === "track" ? "Şarkı" : null,
          updated_at: new Date(a.last ? a.last + "T12:00" : Date.now()).toISOString(),
        };
      }, (done) => setStep({ done, total: chosen.length }));
      await insertAll(rows, me.id);
      toast(`${rows.length} müzik kütüphanene eklendi`);
      setItems(null);
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  const albums = items?.filter((a) => a.kind === "album").length || 0;
  const tracks = (items?.length || 0) - albums;
  return (
    <section className="section import-card">
      <div className="section-head"><h2>Spotify</h2></div>
      <ol className="muted small import-steps">
        <li><a className="grad" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">Spotify gizlilik sayfasını</a> aç, en altta <b>Hesap verileri</b>ni seçip <b>Veri iste</b>&apos;ye bas.</li>
        <li>Spotify birkaç gün içinde e-postana bir zip gönderir. Zip&apos;i aç.</li>
        <li>İçindeki <b>YourLibrary.json</b> dosyasını (dinleme süreleri de gelsin istersen <b>StreamingHistory</b> dosyalarını da) aşağıdan seç.</li>
      </ol>
      {!items ? (
        <label className="btn file-btn">JSON dosyalarını seç<input type="file" accept=".json,application/json" multiple onChange={(e) => read(e.target.files)} /></label>
      ) : (
        <>
          <div className="import-bar">
            <span><b>{albums}</b> albüm{tracks ? <>, <b>{tracks}</b> beğenilen şarkı</> : null} bulundu</span>
            {tracks > 0 && <label className="check"><input type="checkbox" checked={withTracks} onChange={(e) => setWithTracks(e.target.checked)} /> Beğendiğim şarkıları da tek tek ekle</label>}
          </div>
          <div className="import-list">
            {chosen.slice(0, 200).map((a) => (
              <label key={`${a.kind}|${key(a)}`}><span className="name">{a.title} <span className="muted">· {a.artist}</span></span><small>{a.ms ? `${Math.round(a.ms / 3600000).toLocaleString("tr")} sa` : a.kind === "track" ? "şarkı" : "albüm"}</small></label>
            ))}
          </div>
          {step && <Progress done={step.done} total={step.total} label="Kapaklar bulunuyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setItems(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !chosen.length} onClick={run}>{busy ? "Ekleniyor…" : `${chosen.length} müziği ekle`}</button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- PlayStation, Xbox, Epic, Switch, HowLongToBeat, Playnite: liste ya da CSV ----------

// Bu mağazaların herkese açık kütüphane bağlantısı yok; oyun adlarını yapıştırmak ya da CSV seçmek yeterli
const SOURCES: Record<string, { name: string; platform: string; store: string; help: React.ReactNode }> = {
  ps: { name: "PlayStation", platform: "PlayStation 5", store: "PlayStation Store", help: <>
    <a className="grad" href="https://library.playstation.com/recently-purchased" target="_blank" rel="noreferrer">PlayStation oyun kütüphaneni</a> aç,
    oyun adlarını seçip kopyala ve aşağıya yapıştır (her satıra bir oyun). PS4 oyunlarıysa yukarıdan platformu değiştir.</> },
  xbox: { name: "Xbox", platform: "Xbox Series X|S", store: "Xbox Store", help: <>
    <a className="grad" href="https://www.xbox.com/play/library" target="_blank" rel="noreferrer">Xbox oyun kütüphaneni</a> ya da
    <a className="grad" href="https://account.xbox.com/Profile?activetab=main:mainTab2" target="_blank" rel="noreferrer"> Xbox profilindeki Oyunlar</a> sekmesini aç,
    oyun adlarını kopyalayıp yapıştır.</> },
  xboxpc: { name: "Xbox PC / Game Pass", platform: "PC", store: "PC Game Pass", help: <>
    Bilgisayarda <b>Xbox uygulaması → Kitaplığım</b>&apos;daki oyun adlarını kopyalayıp yapıştır.</> },
  epic: { name: "Epic Games", platform: "PC", store: "Epic Games Store", help: <>
    <a className="grad" href="https://www.epicgames.com/account/transactions" target="_blank" rel="noreferrer">Epic satın alma geçmişini</a> ya da
    Epic Launcher&apos;daki <b>Kütüphane</b>&apos;yi aç, oyun adlarını kopyalayıp yapıştır.</> },
  switch: { name: "Nintendo Switch", platform: "Nintendo Switch", store: "Nintendo eShop", help: <>
    Konsolda ya da Nintendo hesabındaki oyun adlarını kopyalayıp yapıştır.</> },
  hltb: { name: "HowLongToBeat", platform: "", store: "", help: <>
    HowLongToBeat&apos;te <b>profilin → Games → Options (dişli) → Export</b>&apos;a bas, inen <b>.csv</b> dosyasını aşağıdan seç.
    Bitirdiklerin, oynadıkların, listende olanlar, puanların ve sürelerin gelir.</> },
  playnite: { name: "Playnite / diğer", platform: "", store: "", help: <>
    Playnite ya da başka bir uygulamadan dışa aktardığın <b>.csv</b> dosyasını seç. &quot;Name&quot; ya da &quot;Title&quot; sütunu olması yeter;
    durum, puan, süre, platform sütunları varsa onlar da okunur.</> },
};

const GAME_PLATFORMS = ["PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "PC", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "Mobil"];

interface ListGame { title: string; status: Status | null; rating: number; sec: number | null; date: string | null; started: string | null; platform: string; store: string; notes: string }

const col = (r: Record<string, string>, ...names: string[]) => {
  for (const n of names) {
    const k = Object.keys(r).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === n);
    if (k && r[k]) return r[k];
  }
  return "";
};
const isoDate = (s: string) => s.match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
// "12:34:56", "12h 30m", "3600" (saniye) ya da "12.5" (saat)
function seconds(s: string, unitSec = false) {
  if (!s) return null;
  const hms = s.match(/^(\d+):(\d{1,2})(?::(\d{1,2}))?$/);
  if (hms) return +hms[1] * 3600 + +hms[2] * 60 + +(hms[3] || 0);
  const hm = s.match(/(\d+)\s*h(?:\s*(\d+)\s*m)?/i);
  if (hm) return +hm[1] * 3600 + +(hm[2] || 0) * 60;
  const n = Number(s.replace(",", "."));
  return n > 0 ? Math.round(unitSec ? n : n * 3600) : null;
}
function statusFrom(r: Record<string, string>): Status | null {
  const s = col(r, "completionstatus", "status", "durum").toLowerCase();
  if (s) {
    if (/complet|beaten|finish|bitti|100/.test(s)) return "completed";
    if (/playing|oynuyor|active/.test(s)) return "active";
    if (/hold|pause|ara/.test(s)) return "paused";
    if (/abandon|drop|retire|bırak/.test(s)) return "dropped";
    if (/plan|backlog|not played|wish/.test(s)) return "planned";
  }
  // HowLongToBeat: her durum ayrı sütun, işaretliyse dolu
  const on = (n: string) => { const v = col(r, n); return !!v && v !== "0" && v.toLowerCase() !== "false"; };
  if (on("completed")) return "completed";
  if (on("playing")) return "active";
  if (on("retired")) return "dropped";
  if (on("backlog")) return "planned";
  return null;
}
function platformFrom(s: string) {
  const p = s.toLowerCase();
  if (/ps5|playstation 5/.test(p)) return "PlayStation 5";
  if (/ps4|playstation 4/.test(p)) return "PlayStation 4";
  if (/series/.test(p)) return "Xbox Series X|S";
  if (/xbox one/.test(p)) return "Xbox One";
  if (/switch/.test(p)) return "Nintendo Switch";
  if (/pc|windows|steam|epic|gog/.test(p)) return "PC";
  return "";
}
function storeFrom(s: string) {
  const p = s.toLowerCase();
  return STORES.find((x) => p.includes(x.toLowerCase().split(" ")[0])) || "";
}

function ListImport() {
  const { me, mine, toast, refresh } = useApp();
  const [src, setSrc] = useState("ps");
  const [platform, setPlatform] = useState(SOURCES.ps.platform);
  const [status, setStatus] = useState<Status>("completed");
  const [text, setText] = useState("");
  const [csv, setCsv] = useState<ListGame[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const s = SOURCES[src];
  const fileMode = src === "hltb" || src === "playnite";
  const haveTitle = new Set(mine.filter((e) => e.type === "game").map((e) => norm(e.title)));

  function pick(k: string) {
    setSrc(k);
    setCsv(null);
    if (SOURCES[k].platform) setPlatform(SOURCES[k].platform);
  }

  async function read(files: FileList | null) {
    if (!files?.length) return;
    const list: ListGame[] = [];
    for (const f of [...files]) {
      for (const r of parseCsv(await f.text())) {
        const title = col(r, "title", "name", "game", "gamename", "oyun");
        if (!title) continue;
        const score = Number(col(r, "review", "userscore", "rating", "score", "puan").replace(",", ".")) || 0;
        list.push({
          title, status: statusFrom(r), rating: Math.max(0, Math.min(10, Math.round(score > 10 ? score / 10 : score))),
          sec: seconds(col(r, "progress", "playtime", "timeplayed", "sure"), !!col(r, "playtime") && src === "playnite"),
          date: isoDate(col(r, "completiondate", "completed", "lastactivity", "finished", "date")),
          started: isoDate(col(r, "startdate", "started")),
          platform: platformFrom(col(r, "platform", "platforms")), store: storeFrom(col(r, "storefront", "source", "store", "library")),
          notes: col(r, "reviewnotes", "notes", "not").slice(0, 5000),
        });
      }
    }
    if (!list.length) return toast("Dosyada oyun bulunamadı. İçinde \"Title\" ya da \"Name\" sütunu olan bir .csv seç.");
    setCsv(list);
  }

  const pasted: ListGame[] = text.split(/\r?\n/).map((l) => l.replace(/^[\s\-*•\d.)]+/, "").trim()).filter((l) => l.length > 1)
    .map((title) => ({ title, status: null, rating: 0, sec: null, date: null, started: null, platform: "", store: "", notes: "" }));
  const all = fileMode ? csv || [] : pasted;
  const seen = new Set<string>();
  const fresh = all.filter((g) => { const k = norm(g.title); if (haveTitle.has(k) || seen.has(k)) return false; seen.add(k); return true; });

  async function run() {
    if (!me || !fresh.length) return;
    setBusy(true);
    setStep({ done: 0, total: fresh.length });
    try {
      const myRawg = new Set(mine.map((e) => e.rawg_id).filter(Boolean));
      const rows = (await pool(fresh, async (g): Promise<Row | null> => {
        const found = (await rawg<{ results?: RawgGame[] }>("games", { search: g.title, search_precise: "true", page_size: 3 }).catch(() => ({ results: [] }))).results || [];
        const hit = found.find((x) => norm(x.name) === norm(g.title)) || found[0];
        if (hit && myRawg.has(hit.id)) return null;
        if (hit) myRawg.add(hit.id);
        const st = g.status || status;
        return {
          type: "game", title: (hit?.name || g.title).slice(0, 200), rawg_id: hit?.id ?? null, year: parseInt(hit?.released || "") || null,
          cover: hit?.background_image ? smallImage(hit.background_image) : null, status: st, rating: g.rating,
          playtime_sec: g.sec, hours: g.sec ? Math.round(g.sec / 360) / 10 : null, date: g.date,
          started_on: g.started, notes: g.notes || null,
          platform: (g.platform || platform || "").slice(0, 60) || null, store: (g.store || s.store || "").slice(0, 60) || null,
          updated_at: new Date(g.date ? g.date + "T12:00" : Date.now()).toISOString(),
        };
      }, (done) => setStep({ done, total: fresh.length }))).filter(Boolean) as Row[];
      await insertAll(rows, me.id);
      toast(`${rows.length} oyun kütüphanene eklendi`);
      setText("");
      setCsv(null);
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <section className="section import-card">
      <div className="section-head"><h2>PlayStation, Xbox, Epic ve diğerleri</h2></div>
      <div className="chips" style={{ marginBottom: 12 }}>
        {Object.entries(SOURCES).map(([k, v]) => <button key={k} className={`chip ${src === k ? "active" : ""}`} onClick={() => pick(k)}>{v.name}</button>)}
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>{s.help}</p>
      <div className="import-opts">
        <label>Platform
          <select value={platform} onChange={(e) => setPlatform(e.target.value)}>
            <option value="">Belirtme</option>
            {GAME_PLATFORMS.map((p) => <option key={p}>{p}</option>)}
          </select>
        </label>
        <label>{fileMode ? "Durumu olmayanlar" : "Hepsinin durumu"}
          <select value={status} onChange={(e) => setStatus(e.target.value as Status)}>
            {STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x, "game")}</option>)}
          </select>
        </label>
      </div>
      {fileMode ? (
        !csv && <label className="btn file-btn">CSV dosyasını seç<input type="file" accept=".csv,text/csv" multiple onChange={(e) => read(e.target.files)} /></label>
      ) : (
        <textarea className="input import-paste" rows={7} placeholder={"Her satıra bir oyun:\nElden Ring\nGod of War Ragnarök\nHalo Infinite"} value={text} onChange={(e) => setText(e.target.value)} />
      )}
      {all.length > 0 && (
        <>
          <div className="import-bar" style={{ marginTop: 10 }}>
            <span><b>{all.length}</b> oyun{all.length - fresh.length ? ` · ${all.length - fresh.length} tanesi zaten kütüphanende` : ""}</span>
          </div>
          {fileMode && (
            <div className="import-list">
              {fresh.slice(0, 300).map((g) => (
                <label key={g.title}><span className="name">{g.title}</span><small>{statusLabel(g.status || status, "game")}{g.rating ? ` · ${g.rating}/10` : ""}</small></label>
              ))}
            </div>
          )}
          {step && <Progress done={step.done} total={step.total} label="Oyunlar eşleştiriliyor…" />}
          <div className="actions">
            {fileMode && <button className="btn" disabled={busy} onClick={() => setCsv(null)}>Vazgeç</button>}
            <button className="btn primary" disabled={busy || !fresh.length} onClick={run}>{busy ? "Ekleniyor…" : `${fresh.length} oyunu ekle`}</button>
          </div>
        </>
      )}
    </section>
  );
}
