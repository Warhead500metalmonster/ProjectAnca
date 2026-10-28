"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
  const { openForm, scale } = useApp();

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
  const [flags, setFlags] = useState<Set<"fav" | "review" | "emu" | "dlc">>(new Set());
  // Oyunlar oynama süresine göre, diğer türler son güncellenene göre sıralı açılır; kişi değiştirirse onun seçimi geçerli
  const [sortPick, setSort] = useState<Sort | null>(null);
  const sort: Sort = sortPick ?? (type === "game" ? "time" : "updated");
  const [text, setText] = useState("");
  const [view, setView] = useState<View>("grid");
  const [showFilters, setShowFilters] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { try { if (localStorage.getItem("ancalog.view") === "list") setView("list"); } catch { /* tercih */ } }, []);

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
    (!flags.has("dlc") || e.dlc) &&
    (!needle || `${e.title} ${e.creator || ""} ${e.notes || ""} ${e.progress || ""}`.toLocaleLowerCase("tr").includes(needle)),
  ).sort(sorter);
  const filterCount = statuses.size + [year, finishYear, platform, minRating].filter(Boolean).length + flags.size;
  const statusType = type === "all" ? null : type;
  // Sayfa sayfa göster; filtre ya da sıralama değişince baştan başla
  const pageKey = [type, [...statuses].join(), year, finishYear, platform, minRating, [...flags].join(), sort, needle, view].join("|");
  const [paging, setPaging] = useState({ key: pageKey, n: PAGE });
  const shown = paging.key === pageKey ? paging.n : PAGE;
  const more = () => setPaging({ key: pageKey, n: shown + PAGE });


  function clear() {
    setStatuses(new Set()); setYear(""); setFinishYear(""); setPlatform(""); setMinRating(""); setFlags(new Set());
  }

  return (
    <>
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
                <button className={`chip ${flags.has("dlc") ? "active" : ""}`} onClick={() => setFlags(toggle(flags, "dlc"))}>DLC dahil</button>
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

// Favoriler bölümü (profil ana sayfasında): türler arasında geçiş, sahibi sürükleyerek sıralar
export function FavoritesSection() {
  const { entries, isMe } = useProfile();
  const [favTab, setFavTab] = useState("");
  const favs = entries.filter((e) => e.favorite);
  const favTypes = TYPE_KEYS.filter((k) => favs.some((e) => e.type === k));
  const favType = favTypes.includes(favTab as EntryType) ? (favTab as EntryType) : favTypes[0];
  if (!favs.length) return null;
  return (
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
  );
}

// Favoriler: sahibi kapağı tutup sürükleyerek sıralar, bırakınca sıra kaydedilir.
// Telefonda parmakla sürükleme şeridin kaymasıyla karışmasın diye "Sırala" düğmesi ve oklar kullanılır.
function Favorites({ list, isMe }: { list: Entry[]; isMe: boolean }) {
  const { toast, refresh } = useApp();
  const sorted = [...list].sort((a, b) => (a.fav_pos ?? 99) - (b.fav_pos ?? 99) || b.rating - a.rating);
  const [order, setOrder] = useState<Entry[] | null>(null); // sürüklenirken / düzenlenirken yerel sıra
  const [arrows, setArrows] = useState(false); // telefonda oklarla sıralama
  const [dragId, setDragId] = useState<string | null>(null);
  const press = useRef<{ id: string; x: number; y: number; moved: boolean } | null>(null);
  const justDragged = useRef(false);
  // Favori eklenip çıkarılınca eski yerel sıra geçersiz olur
  const items = order && order.length === list.length && order.every((o) => list.some((l) => l.id === o.id)) ? order : sorted;

  function move(from: number, to: number, base = items) {
    if (to < 0 || to >= base.length || from === to || from < 0) return base;
    const next = [...base];
    const [x] = next.splice(from, 1);
    next.splice(to, 0, x);
    setOrder(next);
    return next;
  }

  async function save(list2 = order) {
    if (!list2) return;
    const changed = list2.map((e, i) => ({ e, i })).filter(({ e, i }) => e.fav_pos !== i);
    if (!changed.length) { setOrder(null); return; }
    try {
      await Promise.all(changed.map(({ e, i }) => q(sb().from("entries").update({ fav_pos: i }).eq("id", e.id))));
      toast("Favori sıran kaydedildi");
      refresh();
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
      setOrder(null);
    }
  }

  // Bilgisayarda: fareyle tut, sürükle, bırak
  function onPointerDown(ev: React.PointerEvent, id: string) {
    if (!isMe || arrows || ev.pointerType !== "mouse" || ev.button !== 0) return;
    press.current = { id, x: ev.clientX, y: ev.clientY, moved: false };
    let current = items;
    const onMove = (m: PointerEvent) => {
      const p = press.current;
      if (!p) return;
      if (!p.moved) {
        if (Math.hypot(m.clientX - p.x, m.clientY - p.y) < 6) return;
        p.moved = true;
        setDragId(p.id);
        document.body.classList.add("fav-dragging");
      }
      const over = document.elementsFromPoint(m.clientX, m.clientY).find((el) => (el as HTMLElement).dataset?.favId) as HTMLElement | undefined;
      const to = over ? current.findIndex((x) => x.id === over.dataset.favId) : -1;
      const from = current.findIndex((x) => x.id === p.id);
      if (to >= 0 && to !== from) current = move(from, to, current);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.classList.remove("fav-dragging");
      const p = press.current;
      press.current = null;
      setDragId(null);
      if (p?.moved) {
        // Bırakınca gelen tıklama kartı açmasın; sonraki normal tıklamalar çalışsın
        justDragged.current = true;
        setTimeout(() => { justDragged.current = false; }, 80);
        save(current);
      }
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }

  return (
    <>
      {isMe && list.length > 1 && (
        <div className="fav-tools">
          {arrows ? (
            <>
              <span className="muted small">Oklarla taşı, sonra kaydet.</span>
              <button className="btn" onClick={() => { setArrows(false); setOrder(null); }}>Vazgeç</button>
              <button className="btn primary" onClick={() => { setArrows(false); save(); }}>Sırayı kaydet</button>
            </>
          ) : (
            <>
              <span className="muted small fav-hint">Sıralamak için kapağı tutup sürükle.</span>
              <button className="link fav-arrows-btn" onClick={() => { setArrows(true); setOrder(sorted); }}>Sırala</button>
            </>
          )}
        </div>
      )}
      <div className={`strip ${isMe && list.length > 1 && !arrows ? "fav-draggable" : ""} ${arrows ? "sorting" : ""}`}>
        {items.map((e, i) => (
          <div key={e.id} data-fav-id={e.id} className={`fav-sort ${dragId === e.id ? "dragging" : ""}`} draggable={false}
            onPointerDown={(ev) => onPointerDown(ev, e.id)} onDragStart={(ev) => ev.preventDefault()}
            onClickCapture={(ev) => { if (justDragged.current) { ev.preventDefault(); ev.stopPropagation(); justDragged.current = false; } }}>
            {(arrows || dragId) && <div className="fav-num">{i + 1}</div>}
            <EntryCard e={e} />
            {arrows && (
              <div className="fav-arrows">
                <button className="icon-btn" aria-label="Sola taşı" disabled={i === 0} onClick={() => move(i, i - 1)}>‹</button>
                <button className="icon-btn" aria-label="Sağa taşı" disabled={i === items.length - 1} onClick={() => move(i, i + 1)}>›</button>
              </div>
            )}
          </div>
        ))}
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
