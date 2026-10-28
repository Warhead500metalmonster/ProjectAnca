"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Entry, RawgGame, Status } from "@/lib/types";
import { norm, smallImage } from "@/lib/format";
import { musicMeta, tmdb, tmdbImage } from "@/lib/data";
import { STATUSES, STORES, TYPES, statusLabel } from "@/lib/constants";
import { rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { psBookmarklet } from "@/lib/psBookmarklet";

// Başka sitelerden kütüphane aktarma: Steam, PlayStation, Xbox, Epic / Switch / HowLongToBeat listeleri, Letterboxd, Simkl, Spotify ve Last.fm
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
      <AccountGames kind="xbox" />
      <ListImport />
      <Letterboxd />
      <Simkl />
      <Music />
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
  let failed = 0;
  for (let i = 0; i < rows.length; i += 50) {
    const chunk = rows.slice(i, i + 50).map((r) => ({ ...r, user_id: userId }));
    const { error } = await sb().from("entries").insert(chunk);
    if (!error) continue;
    // Paketteki tek bir bozuk satır (ör. geçersiz tarih) yüzünden diğerleri kaybolmasın
    for (const row of chunk) if ((await sb().from("entries").insert(row)).error) failed++;
  }
  return failed;
}

// Aynı oyunu farklı yazılışlarla da tanı: "The Witcher 3 - GOTY Edition" = "The Witcher 3"
const EDITION = /\b(the|game of the year|goty|definitive|complete|deluxe|ultimate|enhanced|standard|edition|director'?s cut)\b/g;
const looseKey = (t: string) =>
  norm(t).replace(/ı/g, "i").replace(/[™®©]/g, "").replace(EDITION, "").replace(/[^a-z0-9ğüşöç]+/g, "");
// RAWG sonucunu ancak adı gerçekten benziyorsa kabul et (yoksa alakasız bir oyuna eşleşiyordu)
function similarHit(found: RawgGame[], title: string) {
  const k = looseKey(title);
  if (!k) return null;
  const exact = found.find((x) => looseKey(x.name) === k);
  if (exact) return exact;
  // Biri diğerinin başıysa (ör. "Cyberpunk 2077 Ultimate" = "Cyberpunk 2077") ama devam oyunu değilse (Dark Souls ≠ Dark Souls III)
  const near = found.map((x) => ({ x, n: looseKey(x.name) })).filter(({ n }) => {
    if (k.length < 4 || n.length < 4 || !(n.startsWith(k) || k.startsWith(n))) return false;
    const rest = n.length > k.length ? n.slice(k.length) : k.slice(n.length);
    return !/^(\d|i{1,3}$|iv$|v$|vi{1,3}$|ix$|x$)/.test(rest);
  }).sort((p, q) => Math.abs(p.n.length - k.length) - Math.abs(q.n.length - k.length));
  return near[0]?.x || null;
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
      toast(changes.length ? `${timed} oyunun süresi güncellendi${finished ? `, ${finished} oyun Oynandı yapıldı` : ""}.` : "Her şey zaten güncel.");
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
          <label className="check-line"><input type="checkbox" checked={useAch} disabled={busy} onChange={(e) => setUseAch(e.target.checked)} /> Bütün başarımlarını açtığım oyunları <b>Oynandı</b> yap (isteğe bağlı)</label>
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
  text = text.replace(/^\uFEFF/, "");
  // Ayırıcıyı ilk satırdan anla: virgül, noktalı virgül ya da sekme
  const first = text.slice(0, text.search(/\r?\n/) >>> 0 || text.length);
  const sep = [",", ";", "\t"].map((d) => [d, first.split(d).length] as const).sort((a, b) => b[1] - a[1])[0][0];
  const rows: string[][] = [];
  let row: string[] = [], cell = "", quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { cell += '"'; i++; }
      // Tırnak ancak hücre bitiyorsa kapanır; ad içinde kalan tek tırnak (ör. 12" Vinyl) yazının parçası sayılır
      else if (c === '"' && (i + 1 >= text.length || text[i + 1] === sep || text[i + 1] === "\n" || text[i + 1] === "\r")) quoted = false;
      else cell += c;
    } else if (c === '"' && cell === "") quoted = true; // tırnak sadece hücre başında açılır
    else if (c === sep) { row.push(cell); cell = ""; }
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

interface Album { artist: string; title: string; kind: "album" | "track"; uri: string; ms: number; last: string | null; keep?: boolean }

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
      if (a.keep) x.keep = true;
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
        const lib = data as {
          albums?: { artist: string; album: string; uri: string }[]; tracks?: { artist: string; album: string; track: string; uri: string }[];
          playlists?: { items?: { track?: { artistName?: string; albumName?: string } | null }[] }[];
        };
        for (const a of lib.albums || []) add({ artist: a.artist, title: a.album, kind: "album", uri: a.uri });
        // Çalma listelerindeki şarkıların albümleri
        for (const p of lib.playlists || []) {
          for (const it of p.items || []) {
            const t = it.track;
            if (t?.albumName && t.artistName) add({ artist: t.artistName, title: t.albumName, kind: "album", uri: "", keep: true });
          }
        }
        for (const t of lib.tracks || []) add({ artist: t.artist, title: t.track, kind: "track", uri: t.uri });
      }
    }
    // Dinleme sürelerini albümlere dağıt; geçmişte az dinlenen (30 dk altı) ve kütüphanede olmayan albümleri at
    for (const [k, a] of map) {
      if (a.kind !== "album") continue;
      const h = history.get(key(a));
      if (h) { a.ms = h.ms; a.last = h.last; }
      if (!a.uri && !a.keep && a.ms < 1800000) map.delete(k);
    }
    const list = [...map.values()].sort((a, b) => b.ms - a.ms);
    if (!list.length) return toast("Bu dosyalarda albüm ya da şarkı bulunamadı. Spotify'dan gelen YourLibrary.json ya da Playlist dosyalarını seç.");
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
    <>
      <ol className="muted small import-steps">
        <li><a className="grad" href="https://www.spotify.com/account/privacy/" target="_blank" rel="noreferrer">Spotify gizlilik sayfasını</a> aç, en altta <b>Hesap verileri</b>ni seçip <b>Veri iste</b>&apos;ye bas.</li>
        <li>Spotify birkaç gün içinde e-postana bir zip gönderir. Zip&apos;i aç.</li>
        <li>İçindeki <b>YourLibrary.json</b> ve çalma listelerin için <b>Playlist</b> dosyalarını (dinleme süreleri de gelsin istersen <b>StreamingHistory</b> dosyalarını da) aşağıdan seç.</li>
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
    </>
  );
}

// ---------- PlayStation, Epic, Switch, HowLongToBeat, Playnite: liste ya da CSV ----------

// Bu mağazaların herkese açık kütüphane bağlantısı yok; oyun adlarını yapıştırmak ya da CSV seçmek yeterli
const SOURCES: Record<string, { name: string; platform: string; store: string; help: React.ReactNode }> = {
  ps: { name: "PlayStation", platform: "PlayStation 5", store: "PlayStation Store", help: <>
    <a className="grad" href="https://library.playstation.com/recently-purchased" target="_blank" rel="noreferrer">PlayStation oyun kütüphaneni</a> aç
    (oynadıkların için üstteki <b>Oynananlar</b> sekmesine geç),
    sayfanın tamamını seç (Ctrl+A), kopyala (Ctrl+C) ve aşağıya yapıştır. Menü, &quot;İndir&quot; gibi yazılar elenir; PS4 / PS5 kendiliğinden anlaşılır.
    <PsCopyLink /></> },
  epic: { name: "Epic Games", platform: "PC", store: "Epic Games Store", help: <>
    <a className="grad" href="https://www.epicgames.com/account/transactions" target="_blank" rel="noreferrer">Epic satın alma geçmişini</a> ya da
    Epic Launcher&apos;daki <b>Kütüphane</b>&apos;yi aç, sayfanın tamamını seçip (Ctrl+A) kopyala ve yapıştır.</> },
  switch: { name: "Nintendo Switch", platform: "Nintendo Switch", store: "Nintendo eShop", help: <>
    Konsolda ya da Nintendo hesabındaki oyun adlarını kopyalayıp yapıştır.</> },
  hltb: { name: "HowLongToBeat", platform: "", store: "", help: <>
    HowLongToBeat&apos;te <b>profilin → Games → Options (dişli) → Export</b>&apos;a bas, inen <b>.csv</b> dosyasını aşağıdan seç.
    Bitirdiklerin, oynadıkların, listende olanlar, puanların ve sürelerin gelir.
    HowLongToBeat bir dosyada en fazla 500 oyun veriyor: daha fazlaysa her sekmeyi (Completed, Backlog, Playing…) ayrı ayrı indirip
    <b>hepsini birlikte seç</b>; aynı oyun bir kez sayılır.</> },
  playnite: { name: "Playnite / diğer", platform: "", store: "", help: <>
    Playnite ya da başka bir uygulamadan dışa aktardığın <b>.csv</b> dosyasını seç. &quot;Name&quot; ya da &quot;Title&quot; sütunu olması yeter;
    durum, puan, süre, platform sütunları varsa onlar da okunur.</> },
  xbox: { name: "Xbox (liste)", platform: "Xbox Series X|S", store: "Xbox Store", help: <>
    <a className="grad" href="https://www.xbox.com/play/library" target="_blank" rel="noreferrer">Xbox oyun kütüphaneni</a> ya da
    <a className="grad" href="https://account.xbox.com/Profile?activetab=main:mainTab2" target="_blank" rel="noreferrer"> Xbox profilindeki Oyunlar</a> sekmesini aç,
    oyun adlarını kopyalayıp yapıştır.</> },
  xboxpc: { name: "Xbox PC (liste)", platform: "PC", store: "PC Game Pass", help: <>
    Bilgisayarda <b>Xbox uygulaması → Kitaplığım</b>&apos;daki oyun adlarını kopyalayıp yapıştır.</> },
};

const GAME_PLATFORMS = ["PlayStation 5", "PlayStation 4", "Xbox Series X|S", "Xbox One", "PC", "Nintendo Switch", "Nintendo Switch 2", "Steam Deck", "Mobil"];

// cat: dosyadaki, bizde karşılığı olmayan kategori (ör. HLTB'de Replay ya da kendi açtığın sekme); kullanıcı eşler
interface ListGame { title: string; status: Status | null; cat?: string | null; rating: number; sec: number | null; date: string | null; started: string | null; platform: string; store: string; notes: string }

const col = (r: Record<string, string>, ...names: string[]) => {
  for (const n of names) {
    const k = Object.keys(r).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === n);
    if (k && r[k] && r[k] !== "--") return r[k]; // HowLongToBeat boş değeri "--" yazar
  }
  return "";
};
const isoDate = (s: string) => {
  const d = s.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  return d && +d.slice(0, 4) > 1970 && +d.slice(0, 4) <= 2100 && !isNaN(Date.parse(d)) ? d : null;
};
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
const NOT_CATEGORY = /^(title|name|game|gamename|oyun|platforms?|storefront|source|store|library|progress|mainstory|mainextras|mainplusextras|completionist|speed.*|review.*|notes?|not|rating|userscore|score|puan|playtime|timeplayed|sure|.*date|addedon|started|finished|lastactivity|completionstatus|status|durum|id|.*id|genres?|developers?|publishers?|releasedate|year|hours?)$/;
const KNOWN_CATEGORY = /^(completed|playing|retired|backlog|onhold)$/;
const FLAG = /^(x|1|true|yes|evet|✓|✔)$/i;
function categoryColumns(rows: Record<string, string>[]) {
  const heads = Object.keys(rows[0] || {});
  return heads.filter((h) => {
    const k = h.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (!k || NOT_CATEGORY.test(k) || KNOWN_CATEGORY.test(k)) return false;
    const vals = rows.map((x) => x[h]).filter((v) => v && v !== "0" && v !== "--" && v.toLowerCase() !== "false");
    return vals.length > 0 && vals.every((v) => FLAG.test(v)); // sadece işaret değerleri (X, 1, true...)
  });
}
// Durum yazısı tanınmayan satırın ham kategorisi (Playnite'ta yazı, HLTB'de işaretli sütun adı)
function categoryOf(r: Record<string, string>, cols: string[]) {
  const text = col(r, "completionstatus", "status", "durum");
  if (text) return text;
  return cols.find((h) => FLAG.test(r[h] || "")) || null;
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
  const on = (n: string) => FLAG.test(col(r, n));
  if (on("completed")) return "completed";
  if (on("playing")) return "active";
  if (on("onhold")) return "paused";
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
  const [catMap, setCatMap] = useState<Record<string, Status | "skip">>({}); // bizde olmayan kategori → durum
  const [fixRatings, setFixRatings] = useState(false);
  const [fileInfo, setFileInfo] = useState(""); // "dosyada 812 satır, 812 oyun okundu" // eski aktarımda yanlış gelen puanları dosyadakiyle değiştir
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const s = SOURCES[src];
  const fileMode = src === "hltb" || src === "playnite";
  const myGames = mine.filter((e) => e.type === "game");
  const fileStatus = (g: ListGame): Status | "skip" | null => g.status || (g.cat ? catMap[g.cat] ?? "owned" : null);
  const byKey = new Map(myGames.map((e) => [looseKey(e.title), e]));

  function pick(k: string) {
    setSrc(k);
    setCsv(null);
    if (SOURCES[k].platform) setPlatform(SOURCES[k].platform);
  }

  async function read(files: FileList | null) {
    if (!files?.length) return;
    const list: ListGame[] = [];
    let lines = 0, rowsRead = 0;
    for (const f of [...files]) {
      const raw = await f.text();
      lines += raw.split(/\r?\n/).filter((l) => l.trim()).length - 1;
      const rowsOf = parseCsv(raw);
      rowsRead += rowsOf.length;
      const cats = categoryColumns(rowsOf);
      const scoreOf = (r: Record<string, string>) => Number(col(r, "review", "userscore", "rating", "score", "puan").replace(",", ".")) || 0;
      const outOf100 = src === "hltb" || src === "playnite" || rowsOf.some((r) => scoreOf(r) > 10);
      for (const r of rowsOf) {
        const title = col(r, "title", "name", "game", "gamename", "oyun");
        if (!title) continue;
        const score = scoreOf(r);
        const known = statusFrom(r);
        list.push({
          title, status: known, cat: known ? null : categoryOf(r, cats), rating: Math.max(0, Math.min(10, Math.round(outOf100 ? score / 10 : score))),
          sec: seconds(col(r, "progress", "playtime", "timeplayed", "sure", "mainstory", "mainsides", "completionist"), !!col(r, "playtime") && src === "playnite"),
          date: isoDate(col(r, "completiondate", "completed", "lastactivity", "finished", "date")),
          started: isoDate(col(r, "startdate", "started")),
          platform: platformFrom(col(r, "platform", "platforms")), store: storeFrom(col(r, "storefront", "source", "store", "library")),
          notes: col(r, "reviewnotes", "notes", "not").slice(0, 5000),
        });
      }
    }
    if (!list.length) return toast("Dosyada oyun bulunamadı. İçinde \"Title\" ya da \"Name\" sütunu olan bir .csv seç.");
    setFileInfo(`${files.length > 1 ? `${files.length} dosyada` : "Dosyada"} yaklaşık ${lines.toLocaleString("tr")} satır vardı, ${rowsRead.toLocaleString("tr")} satır okundu, ${list.length.toLocaleString("tr")} oyun bulundu.`);
    setCatMap(Object.fromEntries([...new Set(list.map((g) => g.cat).filter(Boolean) as string[])].map((c) => [c, "owned" as Status])));
    setCsv(list);
  }

  const ps = src === "ps" ? psParse(text) : null; // PlayStation sayfası: sadece altında PS4 / PS5 etiketi olan satırlar oyundur
  const ownPage = /Ancalog'a kopyala|PlayStation, Epic, Switch ve diğerleri|Başka yerdeki kütüphaneni/.test(text); // yanlışlıkla Ancalog'un kendi sayfası yapıştırıldı
  const pasted: ListGame[] = ps?.length ? ps : ownPage ? [] : cleanPaste(text)
    .map((title) => ({ title, status: null, rating: 0, sec: null, date: null, started: null, platform: "", store: "", notes: "" }));
  const all = fileMode ? csv || [] : pasted;
  // Aynı oyunun birden fazla satırı (HLTB'de her yeniden oynayış ayrı satır) tek kayıtta birleşir:
  // süreler toplanır, en son bitirme tarihi ve en yüksek puan alınır, biri bitmişse oyun bitmiş sayılır
  const merged = new Map<string, ListGame>();
  for (const g of all) {
    const k = looseKey(g.title);
    if (!k || fileStatus(g) === "skip") continue;
    const o = merged.get(k);
    if (!o) { merged.set(k, { ...g }); continue; }
    o.sec = (o.sec || 0) + (g.sec || 0) || null;
    o.rating = Math.max(o.rating, g.rating);
    if (g.date && (!o.date || g.date > o.date)) o.date = g.date;
    if (g.started && (!o.started || g.started < o.started)) o.started = g.started;
    if (g.status === "completed" || (!o.status && g.status)) { o.status = g.status; o.cat = null; }
    if (!o.notes && g.notes) o.notes = g.notes;
  }
  const unique = [...merged.values()];
  const cats = Object.keys(catMap);
  const catCount = (c: string) => all.filter((g) => !g.status && g.cat === c).length;
  const known = unique.filter((g) => byKey.has(looseKey(g.title))).length; // ada göre kütüphanede olanlar

  // Kütüphanede olan oyunun sadece boş alanlarını doldur (senin girdiğin hiçbir şeyin üstüne yazmaz)
  function patchFor(e: Entry, g: ListGame): Row | null {
    const p: Row = {};
    if (!e.date && g.date) p.date = g.date;
    if (!e.started_on && g.started) p.started_on = g.started;
    if ((!e.rating || fixRatings) && g.rating && g.rating !== e.rating) p.rating = g.rating;
    if (!e.playtime_sec && !e.hours && g.sec) { p.playtime_sec = g.sec; p.hours = Math.round(g.sec / 360) / 10; }
    if (!e.notes?.trim() && g.notes) p.notes = g.notes;
    if (!e.platform && (g.platform || platform)) p.platform = (g.platform || platform).slice(0, 60);
    // Dosyada durum yazıyorsa: Kategorisiz ya da Planlandı olanı güncelle
    const fs = fileStatus(g);
    if (fs && fs !== "skip" && fs !== e.status && (e.status === "owned" || (e.status === "planned" && fs !== "planned"))) p.status = fs;
    return Object.keys(p).length ? p : null;
  }

  async function run() {
    if (!me || !unique.length) return;
    setBusy(true);
    setStep({ done: 0, total: unique.length });
    try {
      const byRawg = new Map(myGames.filter((e) => e.rawg_id).map((e) => [e.rawg_id!, e]));
      const used = new Set<number>(); // bu aktarımda aynı oyuna iki kez eşleşmesin
      const updates: { id: string; patch: Row }[] = [];
      let same = 0;
      const rows = (await pool(unique, async (g): Promise<Row | null> => {
        let old = byKey.get(looseKey(g.title));
        let hit: RawgGame | null = null;
        if (!old) {
          const found = (await rawg<{ results?: RawgGame[] }>("games", { search: g.title, search_precise: "true", page_size: 5 }).catch(() => ({ results: [] }))).results || [];
          hit = similarHit(found, g.title);
          if (hit) old = byRawg.get(hit.id);
        }
        if (old) {
          const patch = patchFor(old, g);
          if (patch) updates.push({ id: old.id, patch }); else same++;
          return null;
        }
        if (hit && used.has(hit.id)) { same++; return null; }
        if (hit) used.add(hit.id);
        const fs = fileStatus(g);
        const st = fs && fs !== "skip" ? fs : status;
        return {
          type: "game", title: (hit?.name || g.title).slice(0, 200), rawg_id: hit?.id ?? null, year: parseInt(hit?.released || "") || null,
          cover: hit?.background_image ? smallImage(hit.background_image) : null, status: st, rating: g.rating,
          playtime_sec: g.sec, hours: g.sec ? Math.round(g.sec / 360) / 10 : null, date: g.date,
          started_on: g.started, notes: g.notes || null,
          platform: (g.platform || platform || "").slice(0, 60) || null, store: (g.store || s.store || "").slice(0, 60) || null,
          ...(src === "ps" && !hit && { ext_id: `psn:${looseKey(g.title)}`.slice(0, 60) }),
          updated_at: new Date(g.date ? g.date + "T12:00" : Date.now()).toISOString(),
        };
      }, (done) => setStep({ done, total: unique.length }))).filter(Boolean) as Row[];
      const failed = await insertAll(rows, me.id);
      setStep({ done: 0, total: updates.length });
      let upFailed = 0;
      await pool(updates, async ({ id, patch }) => { if ((await sb().from("entries").update(patch).eq("id", id)).error) upFailed++; },
        (done) => setStep({ done, total: updates.length }));
      toast([
        `${rows.length - failed} yeni oyun eklendi`,
        updates.length ? `${updates.length - upFailed} oyunun tarih / puan / süresi güncellendi` : "",
        same ? `${same} tanesi zaten aynıydı` : "",
        failed + upFailed ? `${failed + upFailed} tanesi kaydedilemedi` : "",
      ].filter(Boolean).join(", "));
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
      <div className="section-head"><h2>PlayStation, Epic, Switch ve diğerleri</h2></div>
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
      {fileMode && cats.length > 0 && (
        <div className="cat-map">
          <b>Bizde karşılığı olmayan kategoriler</b>
          <span className="muted small">Dosyandaki bu kategorilerdeki oyunlar hangi duruma geçsin?</span>
          {cats.map((c) => (
            <label key={c}>
              <span>{c} <small className="muted">({catCount(c)} oyun)</small></span>
              <select value={catMap[c]} onChange={(e) => setCatMap((m) => ({ ...m, [c]: e.target.value as Status | "skip" }))}>
                {STATUSES.map((x) => <option key={x} value={x}>{statusLabel(x, "game")}</option>)}
                <option value="skip">Aktarma (atla)</option>
              </select>
            </label>
          ))}
        </div>
      )}
      {fileMode && csv && csv.some((g) => g.rating) && (
        <label className="check-line"><input type="checkbox" checked={fixRatings} disabled={busy} onChange={(e) => setFixRatings(e.target.checked)} />
          Kütüphanemde olan oyunların puanlarını da dosyadakiyle düzelt (daha önce yanlış puanla aktardıysan)</label>
      )}
      {fileMode ? (
        !csv && <label className="btn file-btn">CSV dosyasını seç<input type="file" accept=".csv,text/csv" multiple onChange={(e) => read(e.target.files)} /></label>
      ) : (
        <>
        {ownPage && !ps?.length && <p className="form-error">Bu yazı Ancalog&apos;un kendi sayfası. PlayStation kütüphane sayfasından kopyalayıp öyle yapıştır.</p>}
        <textarea className="input import-paste" rows={7} placeholder={"Her satıra bir oyun ya da sayfanın tamamı:\nElden Ring\nGod of War Ragnarök\nHalo Infinite\n(fiyat, tarih, düğme yazıları kendiliğinden ayıklanır)"} value={text} onChange={(e) => setText(e.target.value)} />
        </>
      )}
      {all.length > 0 && (
        <>
          {fileMode && fileInfo && <p className="muted small" style={{ margin: "10px 0 0" }}>{fileInfo}</p>}
          <div className="import-bar" style={{ marginTop: 10 }}>
            <span><b>{unique.length}</b> oyun{known ? ` · ${known} tanesi zaten kütüphanende: tekrar eklenmez, boş kalan tarih, puan ve süreleri doldurulur` : ""}</span>
          </div>
          {fileMode && (
            <div className="import-list">
              {unique.slice(0, 300).map((g) => (
                <label key={g.title} className={byKey.has(looseKey(g.title)) ? "off" : ""}><span className="name">{g.title}</span>
                  <small>{byKey.has(looseKey(g.title)) ? "kütüphanende" : statusLabel(((fs) => (fs && fs !== "skip" ? fs : status))(fileStatus(g)), "game")}{g.date ? ` · ${g.date}` : ""}{g.rating ? ` · ${g.rating}/10` : ""}</small></label>
              ))}
              {unique.length > 300 && <label className="off"><span className="name muted">…ve {unique.length - 300} oyun daha (hepsi aktarılır)</span></label>}
            </div>
          )}
          {step && <Progress done={step.done} total={step.total} label="Oyunlar eşleştiriliyor…" />}
          <div className="actions">
            {fileMode && <button className="btn" disabled={busy} onClick={() => { setCsv(null); setCatMap({}); }}>Vazgeç</button>}
            <button className="btn primary" disabled={busy || !unique.length} onClick={run}>{busy ? "Aktarılıyor…" : known ? `Aktar (${unique.length - known} yeni, ${known} güncelleme)` : `${unique.length} oyunu ekle`}</button>
          </div>
        </>
      )}
    </section>
  );
}

// ---------- Xbox: sadece gamertag'i yaz ----------

interface RemoteGame { id: string; name: string; platform: string; minutes: number; last: string | null; progress: number | null; done: boolean; cover: string | null }

const ACCOUNT = {
  xbox: {
    title: "Xbox ve Xbox PC", placeholder: "Gamertag'in", store: "Xbox Store", doneText: "Bütün başarımlarını açtığım oyunları",
    help: <>Gamertag&apos;ini yaz; Xbox konsolunda ve bilgisayardaki Xbox uygulamasında (Game Pass dahil) oynadığın oyunlar gelir.
      Oyun geçmişin herkese açık olmalı: <a className="grad" href="https://account.xbox.com/Settings" target="_blank" rel="noreferrer">Xbox gizlilik ayarları</a> → <b>Oyun geçmişini başkaları görebilir: Herkes</b>.</>,
    errors: {
      "not-found": "Bu gamertag bulunamadı. Yazımını kontrol et.",
      private: "Oyun geçmişin gizli görünüyor. Xbox gizlilik ayarlarından herkese aç, sonra tekrar dene.",
      busy: "Xbox bağlantısı şu an çok yoğun. Biraz sonra tekrar dene.",
    } as Record<string, string>,
  },
};

function AccountGames({ kind }: { kind: "xbox" }) {
  const cfg = ACCOUNT[kind];
  const { me, mine, toast, refresh } = useApp();
  const [user, setUser] = useState("");
  const [games, setGames] = useState<RemoteGame[] | null>(null);
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [markDone, setMarkDone] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);

  const haveExt = new Set(mine.map((e) => e.ext_id).filter(Boolean));
  const haveTitle = new Set(mine.filter((e) => e.type === "game").map((e) => norm(e.title)));
  const already = (g: RemoteGame) => haveExt.has(`${kind}:${g.id}`) || haveTitle.has(norm(g.name));

  async function load(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch(`/api/${kind}?user=${encodeURIComponent(user.trim())}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        return setError(cfg.errors[d.error] || {
          "no-key": "Bu bağlantı henüz kurulmadı. Şimdilik aşağıdaki \"PlayStation, Epic, Switch ve diğerleri\" bölümünden oyun adlarını yapıştırabilirsin.",
          "bad-user": "Kullanıcı adını doğru yaz.",
        }[d.error as string] || "Bağlanılamadı, biraz sonra tekrar dene.");
      }
      const list: RemoteGame[] = (d.games as RemoteGame[]).sort((a, b) => (b.last || "").localeCompare(a.last || ""));
      setGames(list);
      setPicked(new Set(list.filter((g) => !already(g)).map((g) => g.id)));
    } finally {
      setBusy(false);
    }
  }

  async function run() {
    if (!me || !games) return;
    const chosen = games.filter((g) => picked.has(g.id) && !already(g));
    if (!chosen.length) return;
    setBusy(true);
    setStep({ done: 0, total: chosen.length });
    try {
      const myRawg = new Set(mine.map((e) => e.rawg_id).filter(Boolean));
      const rows = (await pool(chosen, async (g): Promise<Row | null> => {
        const found = (await rawg<{ results?: RawgGame[] }>("games", { search: g.name, search_precise: "true", page_size: 3 }).catch(() => ({ results: [] }))).results || [];
        const hit = found.find((x) => norm(x.name) === norm(g.name)) || found[0];
        if (hit && myRawg.has(hit.id)) return null;
        if (hit) myRawg.add(hit.id);
        return {
          type: "game", title: (hit?.name || g.name).slice(0, 200), rawg_id: hit?.id ?? null, ext_id: `${kind}:${g.id}`.slice(0, 60),
          year: parseInt(hit?.released || "") || null,
          cover: hit?.background_image ? smallImage(hit.background_image) : g.cover,
          status: markDone && g.done ? "completed" : "owned", rating: 0,
          playtime_sec: g.minutes ? g.minutes * 60 : null, hours: g.minutes ? Math.round(g.minutes / 6) / 10 : null,
          platform: g.platform, store: g.platform === "PC" && kind === "xbox" ? "PC Game Pass" : cfg.store,
          updated_at: g.last || new Date().toISOString(),
        };
      }, (done) => setStep({ done, total: chosen.length }))).filter(Boolean) as Row[];
      await insertAll(rows, me.id);
      toast(`${rows.length} oyun kütüphanene eklendi`);
      setGames(null);
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const fresh = games?.filter((g) => !already(g)) || [];

  return (
    <section className="section import-card">
      <div className="section-head"><h2>{cfg.title}</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>{cfg.help} Oyunlar <b>Kategorisiz</b> eklenir.</p>
      {!games ? (
        <form className="admin-add" onSubmit={load}>
          <input className="input" placeholder={cfg.placeholder} value={user} onChange={(e) => setUser(e.target.value)} />
          <button className="btn primary" disabled={busy || !user.trim()}>{busy ? "Getiriliyor…" : "Oyunlarımı getir"}</button>
        </form>
      ) : (
        <>
          <div className="import-bar">
            <span><b>{games.length}</b> oyun bulundu{games.length - fresh.length ? ` · ${games.length - fresh.length} tanesi zaten kütüphanende` : ""}</span>
            <button className="link" onClick={() => setPicked(new Set(fresh.map((g) => g.id)))}>Hepsini seç</button>
            <button className="link" onClick={() => setPicked(new Set())}>Hiçbiri</button>
          </div>
          {games.some((g) => g.done) && (
            <label className="check-line"><input type="checkbox" checked={markDone} disabled={busy} onChange={(e) => setMarkDone(e.target.checked)} /> {cfg.doneText} <b>Oynandı</b> yap (isteğe bağlı)</label>
          )}
          <div className="import-list">
            {games.map((g) => (
              <label key={g.id} className={already(g) ? "off" : ""}>
                <input type="checkbox" disabled={already(g) || busy} checked={!already(g) && picked.has(g.id)} onChange={() => toggle(g.id)} />
                <span className="name">{g.name}</span>
                <small>{already(g) ? "zaten var" : [g.platform, g.minutes ? `${Math.round(g.minutes / 60).toLocaleString("tr")} sa` : "", g.progress !== null ? `%${g.progress}` : ""].filter(Boolean).join(" · ")}</small>
              </label>
            ))}
          </div>
          {step && <Progress done={step.done} total={step.total} label="Oyunlar eşleştiriliyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setGames(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !picked.size} onClick={run}>{busy ? "Ekleniyor…" : `${[...picked].filter((id) => fresh.some((g) => g.id === id)).length} oyunu ekle`}</button>
          </div>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}

// ---------- Müzik: Spotify listesi linki, Last.fm ya da Spotify veri dosyası ----------

interface RemoteAlbum { title: string; artist: string; cover: string | null; year?: number | null; plays?: number; tracks?: number; id?: string }

function Music() {
  const [mode, setMode] = useState<"link" | "lastfm" | "file">("lastfm");
  return (
    <section className="section import-card">
      <div className="section-head"><h2>Spotify ve Last.fm</h2></div>
      <div className="chips" style={{ marginBottom: 12 }}>
        <button className={`chip ${mode === "lastfm" ? "active" : ""}`} onClick={() => setMode("lastfm")}>Last.fm</button>
        <button className={`chip ${mode === "file" ? "active" : ""}`} onClick={() => setMode("file")}>Spotify veri dosyası</button>
        <button className={`chip ${mode === "link" ? "active" : ""}`} onClick={() => setMode("link")}>Spotify albüm linki</button>
      </div>
      {mode === "file" ? <Spotify /> : <AlbumImport key={mode} mode={mode} />}
    </section>
  );
}

function AlbumImport({ mode }: { mode: "link" | "lastfm" }) {
  const { me, mine, toast, refresh } = useApp();
  const [text, setText] = useState("");
  const [albums, setAlbums] = useState<RemoteAlbum[] | null>(null);
  const [minPlays, setMinPlays] = useState(20);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const have = new Set(mine.filter((e) => e.type === "music").map((e) => `${norm(e.title)}|${norm(e.creator)}`));
  const isNew = (a: RemoteAlbum) => !have.has(`${norm(a.title)}|${norm(a.artist)}`);
  const lastfm = mode === "lastfm";

  async function load(ev: React.FormEvent) {
    ev.preventDefault();
    setError("");
    setBusy(true);
    try {
      const r = await fetch(lastfm ? `/api/lastfm?user=${encodeURIComponent(text.trim())}` : `/api/spotify?link=${encodeURIComponent(text.trim())}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        return setError({
          "no-key": "Bu bağlantı henüz kurulmadı. Şimdilik \"Spotify veri dosyası\" seçeneğini kullanabilirsin.",
          "bad-link": "Spotify'da albüme sağ tıkla (telefonda üç nokta) → Paylaş → Albüm bağlantısını kopyala, sonra buraya yapıştır.",
          "playlist-blocked": "Spotify artık çalma listelerinin içini başka sitelere göstermiyor. Listeni almak için Last.fm'i ya da \"Spotify veri dosyası\"nı kullan.",
          "bad-user": "Last.fm kullanıcı adını doğru yaz.",
          "not-found": lastfm ? "Bu Last.fm kullanıcısı bulunamadı." : "Albüm bulunamadı. Linki kontrol et.",
          empty: "Bu Last.fm hesabında dinleme kaydı yok.",
        }[d.error as string] || "Bağlanılamadı, biraz sonra tekrar dene.");
      }
      setAlbums(d.albums);
    } finally {
      setBusy(false);
    }
  }

  const chosen = (albums || []).filter((a) => isNew(a) && (!lastfm || (a.plays || 0) >= minPlays));

  async function run() {
    if (!me || !chosen.length) return;
    setBusy(true);
    setStep({ done: 0, total: chosen.length });
    try {
      const rows = await pool(chosen, async (a): Promise<Row> => {
        const meta = a.cover ? { cover: a.cover, year: a.year ?? null } : await musicMeta("album", a.artist, a.title);
        return {
          type: "music", title: a.title.slice(0, 200), creator: a.artist.slice(0, 200) || null, year: a.year ?? meta.year, cover: meta.cover, rawg_id: null,
          ext_id: a.id ? `spotify:album:${a.id}` : null, status: "completed", rating: 0, store: lastfm ? "Last.fm" : "Spotify",
          progress: a.plays ? `${a.plays.toLocaleString("tr")} kez dinlendi` : null,
        };
      }, (done) => setStep({ done, total: chosen.length }));
      await insertAll(rows, me.id);
      toast(`${rows.length} albüm kütüphanene eklendi`);
      setAlbums(null);
      refresh();
    } catch (err) {
      toast("Aktarılamadı: " + (err as Error).message);
    } finally {
      setBusy(false);
      setStep(null);
    }
  }

  return (
    <>
      <p className="muted small" style={{ marginTop: 0 }}>
        {lastfm
          ? <>Last.fm kullanıcı adını yaz; en çok dinlediğin albümler dinleme sayılarıyla gelir. Spotify&apos;ı Last.fm&apos;e bağladıysan bütün geçmişin oradadır.</>
          : <>Spotify&apos;da bir albümün linkini yapıştır (Paylaş → Albüm bağlantısını kopyala). Çalma listeleri için Last.fm&apos;i ya da veri dosyasını kullan; Spotify listelerin içini artık başka sitelere vermiyor.</>}
      </p>
      {!albums ? (
        <form className="admin-add" onSubmit={load}>
          <input className="input" placeholder={lastfm ? "Last.fm kullanıcı adın" : "https://open.spotify.com/album/…"} value={text} onChange={(e) => setText(e.target.value)} />
          <button className="btn primary" disabled={busy || !text.trim()}>{busy ? "Getiriliyor…" : "Albümleri getir"}</button>
        </form>
      ) : (
        <>
          <div className="import-bar">
            <span><b>{albums.length}</b> albüm bulundu{albums.length - albums.filter(isNew).length ? ` · ${albums.length - albums.filter(isNew).length} tanesi zaten kütüphanende` : ""}</span>
            {lastfm && (
              <label className="check">En az
                <select value={minPlays} onChange={(e) => setMinPlays(Number(e.target.value))}>
                  {[1, 5, 10, 20, 50, 100].map((n) => <option key={n} value={n}>{n}</option>)}
                </select> kez dinlediklerim
              </label>
            )}
          </div>
          <div className="import-list">
            {chosen.slice(0, 300).map((a) => (
              <label key={`${a.title}|${a.artist}`}><span className="name">{a.title} <span className="muted">· {a.artist}</span></span>
                <small>{a.plays ? `${a.plays.toLocaleString("tr")} dinleme` : a.tracks ? `${a.tracks} şarkı` : ""}</small></label>
            ))}
          </div>
          {step && <Progress done={step.done} total={step.total} label="Ekleniyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setAlbums(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !chosen.length} onClick={run}>{busy ? "Ekleniyor…" : `${chosen.length} albümü ekle`}</button>
          </div>
        </>
      )}
      {error && <p className="form-error">{error}</p>}
    </>
  );
}

// Mağaza sayfasından kopyalanan metindeki fiyat, tarih, düğme yazısı gibi gereksiz satırları ayıkla
const NOISE = /^(konsola indir|indirme durumunu görüntüle|view download status|download to (your )?console|gta\+|ps plus|playstation plus|oyun kütüphanesi|game library|satın alınanlar|oynananlar|indirilenler|purchased|played|collection|koleksiyon|ps vr2?|satın al(ındı)?|purchased|owned|sahip olunan|yükle(ndi)?|install(ed)?|oyna|play|indir|download|güncelle|update|kütüphane|library|kitaplığım|my games|oyunlarım|sırala|sort|filtre|filter|ara|search|tümü|all|favoriler|favorites|ücretsiz|free|ödendi|paid|iade|refund|detaylar|details|daha fazla|more|games?|oyunlar|apps?|uygulamalar|hepsi|yüklü|hazır|ready|ps5|ps4|pc|xbox( series x\|s| one)?|nintendo switch|dlc|eklenti|add-?on|demo|beta|trial)$/i;
// Sayfa sayfa kopyalamak yerine: yer imleri çubuğuna sürüklenen düğme, PlayStation'da bütün sayfaları kendisi toplar
function PsCopyLink() {
  const { toast } = useApp();
  const link = useRef<HTMLAnchorElement>(null);
  // React "javascript:" linklerini engellediği için adres sayfa açıldıktan sonra verilir
  useEffect(() => { link.current?.setAttribute("href", psBookmarklet()); }, []);
  return (
    <span className="ps-helper">
      <b>Çok sayfa mı var?</b> Şu düğmeyi fareyle tutup tarayıcının yer imleri çubuğuna sürükle (çubuk görünmüyorsa Ctrl+Shift+B):
      <a ref={link} className="btn bookmarklet" draggable onClick={(e) => { e.preventDefault(); toast("Buna basma; fareyle tutup yer imleri çubuğuna sürükle."); }}>Ancalog&apos;a kopyala</a>
      Sonra PlayStation kütüphanende bu yer imine bas: bütün sayfaları kendisi toplar, sen çıkan kutudaki <b>Kopyala</b>&apos;ya basıp buraya yapıştırırsın.
    </span>
  );
}

// PlayStation kütüphane sayfasından kopyalanan metin: her oyunun adının hemen altında platform etiketi (PS5, PS4...) olur.
// Menü ve sayfa altı yazılarının altında böyle bir etiket olmadığı için onlar kendiliğinden elenir.
const PS_TAG = /^(ps5|ps4|ps3|ps vita|psvita|ps vr2?)(\s|$)/i;
const PS_MENU = /^(mağaza|store|oyunlar|games|aksesuarlar|accessories|haberler|news|destek|support|arama|search|filtre|filter|tümü|all|ps plus|playstation plus|playstation|sony)$/;
function psParse(text: string): ListGame[] {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const out = new Map<string, ListGame>();
  for (let i = 0; i < lines.length - 1; i++) {
    const tag = lines[i + 1].match(PS_TAG)?.[1]?.toLowerCase();
    if (!tag || PS_TAG.test(lines[i])) continue;
    const title = lines[i].replace(/[™®©]/g, "").replace(/\s+/g, " ").trim();
    const low = title.toLocaleLowerCase("tr");
    if (NOISE.test(title) || NOISE.test(low) || PS_MENU.test(low)) continue;
    if (title.length < 2 || title.length > 150) continue;
    const platform = tag === "ps5" ? "PlayStation 5" : tag === "ps4" ? "PlayStation 4" : tag === "ps3" ? "PlayStation 3" : tag.includes("vita") ? "PS Vita" : "PlayStation 5";
    const key = title.toLocaleLowerCase("tr");
    const old = out.get(key);
    // Aynı oyunun hem PS4 hem PS5 sürümü varsa PS5'i tut
    if (!old || (old.platform !== "PlayStation 5" && platform === "PlayStation 5")) {
      out.set(key, { title, status: null, rating: 0, sec: null, date: null, started: null, platform, store: "PlayStation Store", notes: "" });
    }
  }
  return [...out.values()];
}

function cleanPaste(text: string) {
  const seen = new Set<string>();
  return text.split(/\r?\n/)
    .map((l) => l.replace(/[™®©]/g, "").replace(/^\s*(?:[-*•]\s*|\d{1,4}[.)]\s+)/, "").replace(/\s+/g, " ").trim())
    .filter((l) => {
      if (l.length < 2 || l.length > 120) return false;
      const low = l.toLocaleLowerCase("tr"); // "İndir" de "indir" sayılsın
      if (NOISE.test(l) || NOISE.test(low)) return false;
      if (/^(indirilenler|downloads?|bildirimler|notifications?)\s*\d*$/.test(low)) return false;
      if (/^[\d\s.,:/%-]+$/.test(l)) return false;                              // sayı, tarih, yüzde
      if (/(₺|tl\b|\$|€|£|usd|eur|try)\s*\d|\d\s*(₺|tl\b|\$|€|£)/i.test(l)) return false; // fiyat
      if (/^(order|sipariş|fatura|invoice|işlem|transaction)\b/i.test(l)) return false;
      if (/^(satın alınanlar|oynananlar|purchased|played)\s*\(/i.test(l)) return false; // "Satın Alınanlar (1 - 24/693)"
      if (/^(ps[45]|ps vr2?|gta\+|ps plus)(\s+(ps[45]|ps vr2?|gta\+|ps plus))*$/i.test(l)) return false;
      if (/^\d+\s*(saat|sa|dk|dakika|hours?|hrs?|mins?|minutes?)\b/i.test(l)) return false;
      if (/^(son oynama|last played|oynama süresi|play time|eklendi|added)\b/i.test(l)) return false;
      const k = l.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

// ---------- Simkl: dizi, film ve anime (kodla bağlan) ----------

interface SimklItem { type: "show" | "movie" | "anime"; title: string; year: number | null; status: Status; rating: number; date: string | null; cover: string | null; ext_id: string | null; progress: string | null }

function Simkl() {
  const { me, mine, toast, refresh } = useApp();
  const [code, setCode] = useState<{ code: string; url: string } | null>(null);
  const [items, setItems] = useState<SimklItem[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<{ done: number; total: number } | null>(null);
  const have = new Set(mine.map((e) => `${e.type}|${norm(e.title)}`));
  const haveExt = new Set(mine.map((e) => e.ext_id).filter(Boolean));
  const isNew = (x: SimklItem) => !have.has(`${x.type}|${norm(x.title)}`) && !(x.ext_id && haveExt.has(x.ext_id));

  // Kod alındıktan sonra birkaç saniyede bir "onaylandı mı?" diye sor (en fazla 15 dakika)
  useEffect(() => {
    if (!code) return;
    let stop = false, tries = 0;
    const tick = async () => {
      if (stop || tries++ > 180) return;
      const d = await fetch(`/api/simkl?code=${code.code}`).then((r) => r.json()).catch(() => ({ pending: true }));
      if (stop) return;
      if (d.items) { setItems(d.items); setCode(null); return; }
      if (d.error) { setError("Simkl'dan veri alınamadı, biraz sonra tekrar dene."); setCode(null); return; }
      setTimeout(tick, 5000);
    };
    const t = setTimeout(tick, 5000);
    return () => { stop = true; clearTimeout(t); };
  }, [code]);

  async function start() {
    setError("");
    setBusy(true);
    try {
      const r = await fetch("/api/simkl?start=1");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) return setError(d.error === "no-key" ? "Simkl bağlantısı henüz kurulmadı. Site sahibine haber ver." : "Simkl'a ulaşılamadı, biraz sonra tekrar dene.");
      setCode({ code: d.code, url: d.url });
      window.open(d.url, "_blank", "noopener");
    } finally {
      setBusy(false);
    }
  }

  const fresh = (items || []).filter(isNew);
  const count = (t: SimklItem["type"]) => (items || []).filter((x) => x.type === t).length;

  async function run() {
    if (!me || !fresh.length) return;
    setBusy(true);
    setStep({ done: 0, total: fresh.length });
    try {
      const rows: Row[] = fresh.map((x) => ({
        type: x.type, title: x.title.slice(0, 200), year: x.year, creator: null, cover: x.cover, rawg_id: null, ext_id: x.ext_id,
        status: x.status, rating: x.rating, date: x.date, progress: x.progress,
        updated_at: new Date(x.date ? x.date + "T12:00" : Date.now()).toISOString(),
      }));
      const failed = await insertAll(rows, me.id);
      toast(`${rows.length - failed} kayıt eklendi${failed ? `, ${failed} tanesi kaydedilemedi` : ""}`);
      setItems(null);
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
      <div className="section-head"><h2>Simkl</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>
        Simkl&apos;daki dizilerin, filmlerin ve animelerin durumları, puanların ve izleme tarihleriyle gelir. Şifreni girmezsin:
        bir kod alırsın, Simkl sitesinde onaylarsın, o kadar.
      </p>
      {items ? (
        <>
          <div className="import-bar">
            <span><b>{count("show")}</b> dizi, <b>{count("movie")}</b> film, <b>{count("anime")}</b> anime bulundu
              {items.length - fresh.length ? ` · ${items.length - fresh.length} tanesi zaten kütüphanende` : ""}</span>
          </div>
          <div className="import-list">
            {fresh.slice(0, 300).map((x) => (
              <label key={`${x.type}|${x.title}`}><span className="name">{x.title}{x.year ? ` (${x.year})` : ""}</span>
                <small>{TYPES[x.type].label} · {statusLabel(x.status, x.type)}{x.rating ? ` · ${x.rating}/10` : ""}</small></label>
            ))}
            {fresh.length > 300 && <label className="off"><span className="name muted">…ve {fresh.length - 300} kayıt daha (hepsi aktarılır)</span></label>}
          </div>
          {step && <Progress done={step.done} total={step.total} label="Ekleniyor…" />}
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => setItems(null)}>Vazgeç</button>
            <button className="btn primary" disabled={busy || !fresh.length} onClick={run}>{busy ? "Ekleniyor…" : `${fresh.length} kaydı ekle`}</button>
          </div>
        </>
      ) : code ? (
        <div className="pin-box">
          <span className="muted small">Simkl sayfası yeni sekmede açıldı. Orada bu kodu gir ve onayla:</span>
          <b className="pin">{code.code}</b>
          <a className="grad" href={code.url} target="_blank" rel="noreferrer">Simkl sayfası açılmadıysa buraya bas</a>
          <span className="muted small">Onaylayınca listen burada kendiliğinden belirecek…</span>
          <button className="link" onClick={() => setCode(null)}>Vazgeç</button>
        </div>
      ) : (
        <button className="btn primary" disabled={busy} onClick={start}>{busy ? "Bağlanılıyor…" : "Simkl'a bağlan"}</button>
      )}
      {error && <p className="form-error">{error}</p>}
    </section>
  );
}
