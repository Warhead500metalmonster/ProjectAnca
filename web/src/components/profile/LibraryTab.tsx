"use client";

import { useEffect, useMemo, useState } from "react";
import type { Entry, EntryType, Status } from "@/lib/types";
import { STATUSES, TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { daysTaken, fmtDate, fmtDur, num, playSec } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";
import { Cover, EntryCard, Rating, commentCount, entryTags, likeCount } from "@/components/ui";

type Sort = "updated" | "rating" | "rating_asc" | "title" | "year" | "year_asc" | "finished" | "time" | "fastest";
type View = "grid" | "list";

const SORTS: [Sort, string, (a: Entry, b: Entry) => number][] = [
  ["updated", "Son güncellenen", (a, b) => b.updated_at.localeCompare(a.updated_at)],
  ["rating", "Puan (yüksek)", (a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at)],
  ["rating_asc", "Puan (düşük)", (a, b) => (a.rating || 99) - (b.rating || 99)],
  ["title", "İsim (A-Z)", (a, b) => a.title.localeCompare(b.title, "tr")],
  ["year", "Çıkış yılı (yeni)", (a, b) => (b.year || 0) - (a.year || 0)],
  ["year_asc", "Çıkış yılı (eski)", (a, b) => (a.year || 9999) - (b.year || 9999)],
  ["finished", "Bitirme tarihi (yeni)", (a, b) => (b.status === "completed" ? b.date || "" : "").localeCompare(a.status === "completed" ? a.date || "" : "")],
  ["time", "Oynama süresi (uzun)", (a, b) => playSec(b) - playSec(a) || b.updated_at.localeCompare(a.updated_at)],
  ["fastest", "En hızlı bitirilen", (a, b) => (daysTaken(a) ?? 1e9) - (daysTaken(b) ?? 1e9)],
];

const PAGE = 24; // bir seferde gösterilen kayıt: devamı "Daha fazla göster" ile gelir, sayfa kasmasın

const uniqSorted = (list: (string | number | null | undefined)[], desc = true) =>
  [...new Set(list.filter((x) => x !== null && x !== undefined && x !== ""))].sort((a, b) =>
    (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "tr")) * (desc ? -1 : 1)) as (string | number)[];

export function LibraryTab() {
  const { profile, entries, isMe } = useProfile();
  const { openForm, openView, scale } = useApp();

  // Önce oyunlar açılır; oyunu yoksa ilk sahip olduğu tür, o da yoksa Tümü. Başka profile geçince yeniden seçilir.
  const firstType = TYPE_KEYS.find((k) => entries.some((e) => e.type === k)) ?? "all";
  const [pick, setPick] = useState<{ pid: string; t: EntryType | "all" } | null>(null);
  const picked = pick?.pid === profile.id ? pick.t : null;
  const type = picked && (picked === "all" || entries.some((e) => e.type === picked)) ? picked : firstType;
  const setType = (t: EntryType | "all") => setPick({ pid: profile.id, t });
  const [statuses, setStatuses] = useState<Set<Status>>(new Set());
  const [year, setYear] = useState("");
  const [finishYear, setFinishYear] = useState("");
  const [platform, setPlatform] = useState("");
  const [minRating, setMinRating] = useState("");
  const [flags, setFlags] = useState<Set<"fav" | "review" | "emu">>(new Set());
  // Oyunlar oynama süresine göre, diğer türler son güncellenene göre sıralı açılır; kişi değiştirirse onun seçimi geçerli
  const [sortPick, setSort] = useState<Sort | null>(null);
  const sort: Sort = sortPick ?? (type === "game" ? "time" : "updated");
  const [text, setText] = useState("");
  const [view, setView] = useState<View>("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [favTab, setFavTab] = useState("");
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { try { if (localStorage.getItem("ancalog.view") === "list") setView("list"); } catch { /* tercih */ } }, []);

  // Akıştan gelen /u/ali?entry=ID bağlantısı kaydı açar, sonra adresten silinir
  useEffect(() => {
    const id = new URLSearchParams(location.search).get("entry");
    const e = id && entries.find((x) => x.id === id);
    if (e) { openView(e); history.replaceState(null, "", location.pathname); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile.id]);

  function pickView(v: View) {
    setView(v);
    try { localStorage.setItem("ancalog.view", v); } catch { /* sadece tercih */ }
  }
  const toggle = <T,>(set: Set<T>, x: T) => { const n = new Set(set); if (n.has(x)) n.delete(x); else n.add(x); return n; };

  const scoped = type === "all" ? entries : entries.filter((e) => e.type === type);
  const years = useMemo(() => uniqSorted(scoped.map((e) => e.year)), [scoped]);
  const finishYears = useMemo(() => uniqSorted(scoped.filter((e) => e.status === "completed").map((e) => e.date?.slice(0, 4))), [scoped]);
  const platforms = useMemo(() => uniqSorted(scoped.map((e) => e.platform), false), [scoped]);
  const ratingSteps = scale === 10 ? [9, 8, 7, 6, 5] : [9, 8, 6, 4];

  const needle = text.trim().toLocaleLowerCase("tr");
  const sorter = SORTS.find(([k]) => k === sort)![2];
  const list = scoped.filter((e) =>
    (!statuses.size || statuses.has(e.status)) &&
    (!year || String(e.year) === year) &&
    (!finishYear || (e.status === "completed" && e.date?.startsWith(finishYear))) &&
    (!platform || e.platform === platform) &&
    (!minRating || (minRating === "none" ? !e.rating : e.rating >= Number(minRating))) &&
    (!flags.has("fav") || e.favorite) &&
    (!flags.has("review") || e.notes) &&
    (!flags.has("emu") || e.emulated) &&
    (!needle || `${e.title} ${e.creator || ""} ${e.notes || ""} ${e.progress || ""}`.toLocaleLowerCase("tr").includes(needle)),
  ).sort(sorter);
  const filterCount = statuses.size + [year, finishYear, platform, minRating].filter(Boolean).length + flags.size;
  const statusType = type === "all" ? null : type;
  const favs = entries.filter((e) => e.favorite);
  // Sayfa sayfa göster; filtre ya da sıralama değişince baştan başla
  const pageKey = [type, [...statuses].join(), year, finishYear, platform, minRating, [...flags].join(), sort, needle, view].join("|");
  const [paging, setPaging] = useState({ key: pageKey, n: PAGE });
  const shown = paging.key === pageKey ? paging.n : PAGE;
  const more = () => setPaging({ key: pageKey, n: shown + PAGE });

  const favTypes = TYPE_KEYS.filter((k) => favs.some((e) => e.type === k));
  const favType = favTypes.includes(favTab as EntryType) ? (favTab as EntryType) : favTypes[0];

  function clear() {
    setStatuses(new Set()); setYear(""); setFinishYear(""); setPlatform(""); setMinRating(""); setFlags(new Set());
  }

  return (
    <>
      {favs.length > 0 && (
        <section className="section favs">
          <div className="section-head">
            <h2>♥ Favoriler</h2>
            {favTypes.length > 1 && (
              <div className="mini-tabs">
                {favTypes.map((k) => (
                  <button key={k} className={favType === k ? "active" : ""} onClick={() => setFavTab(k)} title={TYPES[k].plural}>{TYPES[k].label}</button>
                ))}
              </div>
            )}
          </div>
          <Favorites list={favs.filter((e) => e.type === favType)} isMe={isMe} />
        </section>
      )}
      <section className="section">
        <div className="tabs">
          {([...TYPE_KEYS.map((k) => [k, "", TYPES[k].label]), ["all", "", "Tümü"]] as [EntryType | "all", string, string][])
            .filter(([k]) => k === "all" || entries.some((e) => e.type === k))
            .map(([k, icon, label]) => (
              <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setYear(""); setFinishYear(""); setPlatform(""); }}>
                {icon} {label}<span className="count">{k === "all" ? entries.length : entries.filter((e) => e.type === k).length}</span>
              </button>
            ))}
        </div>
        <div className="lib-bar">
          <input className="input" type="search" placeholder="Kütüphanede ara…" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
          <button className={`btn ${showFilters || filterCount ? "on" : ""}`} onClick={() => setShowFilters(!showFilters)}>
            Filtrele{filterCount ? ` (${filterCount})` : ""}
          </button>
          <select aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
            {SORTS.map(([k, label]) => <option key={k} value={k}>↕ {label}</option>)}
          </select>
          <div className="seg">
            <button type="button" className={view === "grid" ? "active" : ""} title="Izgara" onClick={() => pickView("grid")}>▦</button>
            <button type="button" className={view === "list" ? "active" : ""} title="Liste" onClick={() => pickView("list")}>☰</button>
          </div>
        </div>
        {showFilters && (
          <div className="filter-panel">
            <div className="fp-row">
              <span className="fp-label">Durum</span>
              <div className="chips">
                {STATUSES.map((s) => (
                  <button key={s} className={`chip ${statuses.has(s) ? "active" : ""}`} onClick={() => setStatuses(toggle(statuses, s))}>{statusLabel(s, statusType)}</button>
                ))}
              </div>
            </div>
            <div className="fp-row">
              <span className="fp-label">Ayrıntı</span>
              <div className="chips">
                <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Çıkış yılı">
                  <option value="">Çıkış yılı: hepsi</option>
                  {years.map((y) => <option key={y} value={y}>Çıkış yılı: {y}</option>)}
                </select>
                <select value={finishYear} onChange={(e) => setFinishYear(e.target.value)} aria-label="Bitirme yılı">
                  <option value="">Bitirme yılı: hepsi</option>
                  {finishYears.map((y) => <option key={y} value={y}>Bitirme yılı: {y}</option>)}
                </select>
                <select value={platform} onChange={(e) => setPlatform(e.target.value)} aria-label="Platform">
                  <option value="">Platform: hepsi</option>
                  {platforms.map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
                <select value={minRating} onChange={(e) => setMinRating(e.target.value)} aria-label="Puan">
                  <option value="">Puan: hepsi</option>
                  {ratingSteps.map((r) => <option key={r} value={r}>{scale === 10 ? `${r}/10 ve üstü` : `${num(r / 2)} yıldız ve üstü`}</option>)}
                  <option value="none">Puansız</option>
                </select>
              </div>
            </div>
            <div className="fp-row">
              <span className="fp-label">Sadece</span>
              <div className="chips">
                <button className={`chip ${flags.has("fav") ? "active" : ""}`} onClick={() => setFlags(toggle(flags, "fav"))}>♥ Favoriler</button>
                <button className={`chip ${flags.has("review") ? "active" : ""}`} onClick={() => setFlags(toggle(flags, "review"))}>İncelemeli</button>
                <button className={`chip ${flags.has("emu") ? "active" : ""}`} onClick={() => setFlags(toggle(flags, "emu"))}>Emülatör</button>
              </div>
            </div>
            {filterCount > 0 && <button className="link" onClick={clear}>Filtreleri temizle</button>}
          </div>
        )}
        {(filterCount > 0 || needle) && <p className="muted count-note">{list.length} sonuç</p>}
        {list.length ? (
          view === "list"
            ? <div className="rows">{list.slice(0, shown).map((e) => <Row key={e.id} e={e} isMe={isMe} />)}</div>
            : <div className="grid">{list.slice(0, shown).map((e) => <EntryCard key={e.id} e={e} kind={type === "all"} />)}</div>
        ) : (
          <div className="empty">
            {entries.length ? "Bu filtreye uyan kayıt yok." : isMe
              ? <>Henüz hiçbir şey loglamadın.<br /><button className="btn primary" onClick={() => openForm(null, { type: statusType ?? undefined })}>+ İlk kaydını ekle</button></>
              : "Burada henüz kayıt yok."}
          </div>
        )}
        {shown < list.length && (
          <div className="load-more">
            <button className="btn" onClick={more}>Daha fazla göster ({Math.min(PAGE, list.length - shown)} / {list.length - shown} kaldı)</button>
          </div>
        )}
      </section>
    </>
  );
}

// Favoriler: sahibi "Sırala"ya basınca sürükleyip bırakarak (telefonda oklarla) sırasını değiştirir
function Favorites({ list, isMe }: { list: Entry[]; isMe: boolean }) {
  const { toast, refresh } = useApp();
  const sorted = [...list].sort((a, b) => (a.fav_pos ?? 99) - (b.fav_pos ?? 99) || b.rating - a.rating);
  const [order, setOrder] = useState<Entry[] | null>(null); // düzenlenirken yerel sıra
  const [drag, setDrag] = useState<string | null>(null);
  const items = order || sorted;

  function move(from: number, to: number) {
    if (to < 0 || to >= items.length || from === to) return;
    const next = [...items];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
  }

  async function save() {
    if (!order) return;
    try {
      await Promise.all(order.map((e, i) => (e.fav_pos === i ? null : q(sb().from("entries").update({ fav_pos: i }).eq("id", e.id)))));
      toast("Favori sıran kaydedildi ✓");
      setOrder(null);
      refresh();
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
    }
  }

  return (
    <>
      {isMe && list.length > 1 && (
        <div className="fav-tools">
          {order ? (
            <>
              <span className="muted small">Kapakları sürükleyip bırak ya da oklarla taşı.</span>
              <button className="btn" onClick={() => setOrder(null)}>Vazgeç</button>
              <button className="btn primary" onClick={save}>Sırayı kaydet</button>
            </>
          ) : <button className="link" onClick={() => setOrder(sorted)}>Sırala</button>}
        </div>
      )}
      <div className={`strip ${order ? "sorting" : ""}`}>
        {items.map((e, i) => order ? (
          <div key={e.id} className={`fav-sort ${drag === e.id ? "dragging" : ""}`} draggable
            onDragStart={(ev) => { setDrag(e.id); ev.dataTransfer.effectAllowed = "move"; }}
            onDragOver={(ev) => { ev.preventDefault(); if (drag && drag !== e.id) move(items.findIndex((x) => x.id === drag), i); }}
            onDragEnd={() => setDrag(null)}>
            <div className="fav-num">{i + 1}</div>
            <EntryCard e={e} />
            <div className="fav-arrows">
              <button className="icon-btn" aria-label="Sola taşı" disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
              <button className="icon-btn" aria-label="Sağa taşı" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>›</button>
            </div>
          </div>
        ) : <EntryCard key={e.id} e={e} />)}
      </div>
    </>
  );
}

// Liste görünümünde bir satır: kapak, başlık, platform/durum/mağaza, not, süre, puan
function Row({ e, isMe }: { e: Entry; isMe: boolean }) {
  const { openForm, openView } = useApp();
  const t = TYPES[e.type];
  const dates = [e.started_on && fmtDate(e.started_on), e.date && fmtDate(e.date)].filter(Boolean).join(" → ");
  const likes = likeCount(e), comments = commentCount(e);
  return (
    <div className="lrow">
      <button className={`lrow-cover poster ${t.square ? "square" : ""}`} onClick={() => openView(e)}>
        <div className="ph">{t.label}</div><Cover src={e.cover} />
      </button>
      <div className="lrow-main">
        <div className="lrow-head">
          <button className="lrow-title" onClick={() => openView(e)}>{e.favorite ? "♥ " : ""}{e.title}{e.year ? <> <span className="muted">({e.year})</span></> : null}</button>
          <div className="lrow-tags">
            <span className={`pill ${e.status}`}>{statusLabel(e.status, e.type)}</span>
            {entryTags(e, { store: true, time: false }).map((x) => <span className="tag" key={x}>{x}</span>)}
          </div>
        </div>
        {e.progress && <div className="lrow-progress">{e.progress}</div>}
        <div className="lrow-foot">
          {e.rating ? <Rating r={e.rating} /> : <span className="muted">Puan yok</span>}
          {playSec(e) ? <span>{fmtDur(playSec(e))}</span> : null}
          {dates && <span>{dates}</span>}
          {e.notes && <span>İnceleme</span>}
          {likes > 0 && <span>♥ {likes}</span>}
          {comments > 0 && <span>{comments}</span>}
        </div>
      </div>
      {isMe && <button className="icon-btn lrow-edit" title="Düzenle" onClick={() => openForm(e)}>✎</button>}
    </div>
  );
}
