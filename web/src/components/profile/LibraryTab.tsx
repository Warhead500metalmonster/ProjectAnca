"use client";

import { Fragment, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import type { Entry, EntryType, Status } from "@/lib/types";
import { STATUSES, TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { MONTHS_TR, daysTaken, fmtDate, fmtDur, num, playSec } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { cameBack, useScrollMemory } from "@/lib/useLoad";
import { onUnlinked, unlinkedCount } from "@/lib/unlinked";
import { useApp } from "@/components/AppProvider";
import { BulkBar } from "@/components/profile/BulkBar";
import { FavPicker } from "@/components/FavPicker";
import { useProfile } from "@/components/ProfileShell";
import { EntryCard, Rating, commentCount, entryTags, likeCount, LCover, LTitle } from "@/components/ui";

type Sort = "updated" | "rating" | "rating_asc" | "title" | "year" | "year_asc" | "finished" | "time" | "fastest";
type View = "grid" | "list" | "diary";

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

// Bir içeriğe gidip geri gelince kütüphane aynı sekme, süzgeç, arama ve "daha fazla" ile açılsın (kaydırma yeri de korunur)
interface Snap { t: EntryType | "all" | null; statuses: Status[]; year: string; finishYear: string; platform: string; minRating: string; tag: string; flags: string[]; sort: Sort | null; text: string; n: number }
const snaps = new Map<string, Snap>();

const uniqSorted = (list: (string | number | null | undefined)[], desc = true) =>
  [...new Set(list.filter((x) => x !== null && x !== undefined && x !== ""))].sort((a, b) =>
    (typeof a === "number" && typeof b === "number" ? a - b : String(a).localeCompare(String(b), "tr")) * (desc ? -1 : 1)) as (string | number)[];

export function LibraryTab() {
  const { profile, entries: allEntries, isMe } = useProfile();
  const { openForm, scale, prefs, me } = useApp();
  // Dizi ve anime birlikte seçildiyse animeler Dizi sekmesinde görünür (veritabanında türleri ayrı kalır)
  const merge = !!prefs.merge;
  const entries = allEntries;
  const snapKey = `${profile.id}|${typeof location !== "undefined" ? location.search : ""}`;
  const [back] = useState(() => (cameBack() ? snaps.get(snapKey) : undefined));
  const fixCount = useSyncExternalStore(onUnlinked, () => unlinkedCount(me?.id), () => 0);

  // Önce oyunlar açılır; oyunu yoksa ilk sahip olduğu tür, o da yoksa Tümü. Başka profile geçince yeniden seçilir.
  const firstType = TYPE_KEYS.find((k) => entries.some((e) => e.type === k)) ?? "all";
  const params = useSearchParams();
  const urlType = params.get("type") as EntryType | null; // profildeki yan panelden gelince o tür açılır
  const [pick, setPick] = useState<{ pid: string; t: EntryType | "all" } | null>(back?.t ? { pid: profile.id, t: back.t } : null);
  const picked = pick?.pid === profile.id ? pick.t : null;
  const rawType = picked && (picked === "all" || entries.some((e) => e.type === picked)) ? picked
    : urlType && entries.some((e) => e.type === urlType) ? urlType : firstType;
  const type = merge && rawType === "anime" ? "show" : rawType;
  const inTab = (e: Entry, t: EntryType | "all") => t === "all" || e.type === t || (merge && t === "show" && e.type === "anime");
  const setType = (t: EntryType | "all") => setPick({ pid: profile.id, t });
  const urlStatus = params.get("status") as Status | null; // profildeki Planlanan sayısından gelince
  const [statuses, setStatuses] = useState<Set<Status>>(new Set(back ? back.statuses : urlStatus && STATUSES.includes(urlStatus) ? [urlStatus] : []));
  const [year, setYear] = useState(back?.year || "");
  const [finishYear, setFinishYear] = useState(back?.finishYear || "");
  const [platform, setPlatform] = useState(back?.platform || "");
  const [minRating, setMinRating] = useState(back?.minRating || "");
  const [tag, setTag] = useState(back?.tag || ""); // kendi etiketlerinden biri
  const [flags, setFlags] = useState<Set<"fav" | "review" | "emu" | "dlc">>(new Set((back?.flags || []) as ("fav" | "review" | "emu" | "dlc")[]));
  // Oyunlar oynama süresine göre, diğer türler son güncellenene göre sıralı açılır; kişi değiştirirse onun seçimi geçerli
  const [sortPick, setSort] = useState<Sort | null>(back?.sort ?? null);
  const sort: Sort = sortPick ?? (type === "game" ? "time" : "updated");
  const [text, setText] = useState(back?.text || "");
  const [view, setView] = useState<View>("grid");
  const [showFilters, setShowFilters] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
  useEffect(() => { try { const v = localStorage.getItem("ancalog.view"); if (v === "list" || v === "diary") setView(v); } catch { /* tercih */ } }, []);
  // Toplu düzenleme: seçilen kayıtlar filtre değişse de seçili kalır
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const closeSelect = () => { setSelecting(false); setSelected(new Set()); };

  function pickView(v: View) {
    setView(v);
    try { localStorage.setItem("ancalog.view", v); } catch { /* sadece tercih */ }
  }
  const toggle = <T,>(set: Set<T>, x: T) => { const n = new Set(set); if (n.has(x)) n.delete(x); else n.add(x); return n; };

  // Binlerce logda her tuşta baştan süzüp sıralamak yazmayı yavaşlatıyordu: her hesap sadece kendi girdisi değişince yapılır
  // Planlananlar (backlog, istek listesi) kalabalık etmesin diye Hepsi'nde yok; kendi sekmesinde görünür
  const hidePlanned = !statuses.has("planned");
  const visible = useMemo(() => hidePlanned ? entries.filter((e) => e.status !== "planned") : entries, [entries, hidePlanned]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const scoped = useMemo(() => type === "all" ? visible : visible.filter((e) => inTab(e, type)), [visible, type, merge]);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const plannedHere = useMemo(() => entries.filter((e) => e.status === "planned" && inTab(e, type)).length, [entries, type, merge]);
  const tabCounts = useMemo(() => {
    const m = new Map<EntryType | "all", number>();
    for (const e of entries) if (e.status !== "planned") {
      const k = merge && e.type === "anime" ? "show" : e.type;
      m.set(k, (m.get(k) || 0) + 1); m.set("all", (m.get("all") || 0) + 1);
    }
    return m;
  }, [entries, merge]);
  const statusCounts = useMemo(() => {
    const m = new Map<Status, number>();
    for (const e of entries) if (inTab(e, type)) m.set(e.status, (m.get(e.status) || 0) + 1);
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, type, merge]);
  const years = useMemo(() => uniqSorted(scoped.map((e) => e.year)), [scoped]);
  const finishYears = useMemo(() => uniqSorted(scoped.filter((e) => e.status === "completed").map((e) => e.date?.slice(0, 4))), [scoped]);
  const platforms = useMemo(() => uniqSorted(scoped.map((e) => e.platform), false), [scoped]);
  const tagList = useMemo(() => {
    const n = new Map<string, number>();
    for (const e of scoped) for (const x of e.tags || []) n.set(x, (n.get(x) || 0) + 1);
    return [...n].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "tr"));
  }, [scoped]);
  const ratingSteps = scale === 10 ? [9, 8, 7, 6, 5] : [9, 8, 6, 4];

  const needle = text.trim().toLocaleLowerCase("tr");
  const sorter = SORTS.find(([k]) => k === sort)![2];
  const sorted = useMemo(() => [...scoped].sort(sorter), [scoped, sorter]);
  const haystack = useMemo(() => new Map(entries.map((e) => [e.id, `${e.title} ${e.creator || ""} ${e.notes || ""} ${e.progress || ""} ${(e.tags || []).join(" ")}`.toLocaleLowerCase("tr")])), [entries]);
  const list = useMemo(() => sorted.filter((e) =>
    (!statuses.size || statuses.has(e.status)) &&
    (!year || String(e.year) === year) &&
    (!finishYear || (e.status === "completed" && e.date?.startsWith(finishYear))) &&
    (!platform || e.platform === platform) &&
    (!tag || (e.tags || []).includes(tag)) &&
    (!minRating || (minRating === "none" ? !e.rating : e.rating >= Number(minRating))) &&
    (!flags.has("fav") || e.favorite) &&
    (!flags.has("review") || e.notes) &&
    (!flags.has("emu") || e.emulated) &&
    (!flags.has("dlc") || e.dlc) &&
    (!needle || haystack.get(e.id)!.includes(needle)),
  ), [sorted, haystack, statuses, year, finishYear, platform, tag, minRating, flags, needle]);
  const filterCount = [year, finishYear, platform, minRating, tag].filter(Boolean).length + flags.size;
  const statusType = type === "all" ? null : type;
  // Sayfa sayfa göster; filtre ya da sıralama değişince baştan başla
  const pageKey = [type, [...statuses].join(), year, finishYear, platform, minRating, tag, [...flags].join(), sort, needle, view].join("|");
  const [paging, setPaging] = useState({ key: pageKey, n: back?.n || PAGE });
  const shown = paging.key === pageKey ? paging.n : PAGE;
  const more = () => setPaging({ key: pageKey, n: shown + PAGE });
  // Durum her değişince saklanır; geri gelince buradan açılır
  useEffect(() => {
    snaps.set(snapKey, { t: pick?.pid === profile.id ? pick.t : null, statuses: [...statuses], year, finishYear, platform, minRating, tag, flags: [...flags], sort: sortPick, text, n: shown });
  }, [snapKey, pick, profile.id, statuses, year, finishYear, platform, minRating, tag, flags, sortPick, text, shown]);
  useScrollMemory(`lib|${snapKey}`, entries.length > 0);
  // Günlük: sadece bitirme tarihi olanlar, en yeni en üstte
  const dated = useMemo(() => list.filter((e) => e.status === "completed" && e.date).sort((a, b) => b.date!.localeCompare(a.date!)), [list]);
  const paged = view === "diary" ? dated : list;
  // Tümü'de süzgeç ve arama yokken her tür kendi şeridinde: eski tarihli içe aktarılmış animeler yüzlerce oyunun arkasında kaybolmasın
  const grouped = type === "all" && view === "grid" && !filterCount && !statuses.size && !needle && !sortPick && !selecting;
  // Seçim modunda kartın üstüne dokunmak kaydı açmak yerine seçer
  const selectable = (e: Entry, child: React.ReactNode, cls = "") => !selecting ? child : (
    <div key={e.id} className={`sel-wrap ${cls} ${selected.has(e.id) ? "on" : ""}`}>
      {child}
      <button type="button" className="sel-over" aria-pressed={selected.has(e.id)} aria-label={`${e.title} seç`} onClick={() => setSelected(toggle(selected, e.id))}><span>✓</span></button>
    </div>
  );


  function clear() {
    setStatuses(new Set()); setYear(""); setFinishYear(""); setPlatform(""); setMinRating(""); setFlags(new Set()); setTag("");
  }

  return (
    <>
      <section className="section">
        {/* Bütün araçlar tek kutuda: tür, durum, arama, filtre, sıralama */}
        <div className="tool-panel lib-tools">
        <div className="tabs">
          {([...TYPE_KEYS.map((k) => [k, "", merge && k === "show" ? "Dizi / Anime" : TYPES[k].label]), ["all", "", "Tümü"]] as [EntryType | "all", string, string][])
            .filter(([k]) => k === "all" || (!(merge && k === "anime") && entries.some((e) => inTab(e, k))))
            .map(([k, icon, label]) => (
              <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setStatuses(new Set()); setYear(""); setFinishYear(""); setPlatform(""); }}>
                {icon} {label}<span className="count">{tabCounts.get(k) || 0}</span>
              </button>
            ))}
        </div>
        {/* En çok kullanılan süzgeç hep görünür: Oynandı, Oynuyorum, Planlandı... */}
        <div className="chips status-tabs">
          <button className={`chip ${!statuses.size ? "active" : ""}`} onClick={() => setStatuses(new Set())}>Hepsi</button>
          {STATUSES.filter((s) => statusCounts.get(s)).map((s) => (
            <button key={s} className={`chip ${statuses.has(s) ? "active" : ""}`} onClick={() => setStatuses(new Set([s]))}>{statusLabel(s, statusType)} <span className="muted">{num(statusCounts.get(s)!)}</span></button>
          ))}
        </div>
        <div className="lib-bar">
          <input className="input" type="search" placeholder="Kütüphanede ara…" value={text} autoComplete="off" onChange={(e) => setText(e.target.value)} />
          <button className={`btn ${showFilters || filterCount ? "on" : ""}`} onClick={() => setShowFilters(!showFilters)}>
            Filtrele{filterCount ? ` (${filterCount})` : ""}
          </button>
          {view !== "diary" && (
            <select aria-label="Sırala" value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
              {SORTS.map(([k, label]) => <option key={k} value={k}>Sırala: {label}</option>)}
            </select>
          )}
          {isMe && list.length > 0 && <button type="button" className={`btn ${selecting ? "on" : ""}`} onClick={() => (selecting ? closeSelect() : setSelecting(true))}>Seç</button>}
          <div className="seg">
            <button type="button" className={view === "grid" ? "active" : ""} title="Kapaklar" aria-label="Kapaklar" onClick={() => pickView("grid")}>▦</button>
            <button type="button" className={view === "list" ? "active" : ""} title="Liste" aria-label="Liste" onClick={() => pickView("list")}>☰</button>
            <button type="button" className={view === "diary" ? "active" : ""} title="Ne zaman ne bitirdim?" onClick={() => pickView("diary")}>Günlük</button>
          </div>
        </div>
        </div>
        {showFilters && (
          <div className="filter-panel">
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
            {tagList.length > 0 && (
              <div className="fp-row">
                <span className="fp-label">Etiket</span>
                <div className="lib-tags" style={{ margin: 0 }}>
                  {tagList.slice(0, 30).map(([x, n]) => (
                    <button key={x} className={`tag ${tag === x ? "active" : ""}`} onClick={() => setTag(tag === x ? "" : x)}>#{x} <span className="muted">{n}</span></button>
                  ))}
                </div>
              </div>
            )}
            {filterCount > 0 && <button className="link" onClick={clear}>Filtreleri temizle</button>}
          </div>
        )}
        {isMe && fixCount > 0 && (
          <p className="fix-note"><span>Kütüphanende bir sayfaya bağlı olmayan <b>{fixCount}</b> kayıt var.</span> <Link className="btn small" href="/fix">Bağla</Link></p>
        )}
        {(filterCount > 0 || statuses.size > 0 || needle) && <p className="muted count-note">{list.length} sonuç</p>}
        {list.length && grouped ? (
          <div className="lib-groups">
            {TYPE_KEYS.filter((k) => !(merge && k === "anime")).map((k) => {
              const items = list.filter((e) => inTab(e, k));
              if (!items.length) return null;
              return (
                <div key={k} className="lib-group">
                  <div className="section-head">
                    <h3>{merge && k === "show" ? "Dizi / Anime" : TYPES[k].plural} <span className="count">{num(items.length)}</span></h3>
                    {items.length > 12 && <button className="link" onClick={() => { setType(k); window.scrollTo({ top: 0 }); }}>Hepsini gör →</button>}
                  </div>
                  <div className="grid">{items.slice(0, 12).map((e) => <EntryCard key={e.id} e={e} />)}</div>
                </div>
              );
            })}
          </div>
        ) : list.length ? (
          view === "diary"
            ? <Diary list={dated.slice(0, shown)} username={profile.username} wrap={selectable} empty={list.length} />
            : view === "list"
            ? <div className="rows">{list.slice(0, shown).map((e) => <Fragment key={e.id}>{selectable(e, <Row e={e} isMe={isMe} />)}</Fragment>)}</div>
            : <div className="grid">{list.slice(0, shown).map((e) => <Fragment key={e.id}>{selectable(e, <EntryCard e={e} kind={type === "all"} />)}</Fragment>)}</div>
        ) : (
          <div className="empty">
            {entries.length ? (
              filterCount > 0 || statuses.size > 0 || needle ? <>Bu aramaya uyan kayıt yok.<br /><button className="btn" onClick={() => { clear(); setText(""); }}>Filtreleri temizle</button></>
                : plannedHere > 0 ? <>Burada sadece planladıkların var.<br /><button className="btn" onClick={() => setStatuses(new Set(["planned"]))}>Planlananları göster ({plannedHere})</button></>
                : "Burada henüz kayıt yok."
            ) : isMe
              ? <>Henüz hiçbir şey loglamadın. Başka sitelerdeki kütüphaneni birkaç dakikada getirebilirsin.<br />
                <Link className="btn primary" href="/import">Kütüphanemi getir</Link>{" "}
                <button className="btn" onClick={() => openForm(null, { type: statusType ?? undefined })}>+ Tek tek ekle</button></>
              : "Burada henüz kayıt yok."}
          </div>
        )}
        {!grouped && shown < paged.length && (
          <div className="load-more">
            <button className="btn" onClick={more}>Daha fazla göster ({Math.min(PAGE, paged.length - shown)} / {paged.length - shown} kaldı)</button>
          </div>
        )}
        {selecting && (
          <BulkBar entries={entries} ids={selected} type={statusType} total={paged.length} onAll={() => setSelected(new Set(paged.map((e) => e.id)))}
            onDone={closeSelect} onClose={closeSelect} />
        )}
      </section>
    </>
  );
}

// Günlük: ay ay ne zaman ne bitirildi (Letterboxd'daki gibi)
function Diary({ list, username, wrap, empty }: { list: Entry[]; username: string; wrap: (e: Entry, child: React.ReactNode, cls?: string) => React.ReactNode; empty: number }) {
  const { openView } = useApp();
  if (!list.length) return <div className="empty">{empty} kayıt var ama bitirme tarihi girilmiş olan yok. Bir kaydı düzenleyip bitirme tarihini yazınca burada görünür.</div>;
  return (
    <div className="diary">
      {list.map((e, i) => {
        const ym = e.date!.slice(0, 7);
        const t = TYPES[e.type];
        return (
          <Fragment key={e.id}>
            {(i === 0 || list[i - 1].date!.slice(0, 7) !== ym) && (
              <div className="diary-month">
                <h3>{MONTHS_TR[Number(ym.slice(5)) - 1]} {ym.slice(0, 4)}</h3>
                <Link className="link" href={`/wrap/${username}?m=${ym}`}>Ay özeti →</Link>
              </div>
            )}
            {wrap(e, (
              <button type="button" className="diary-row" onClick={() => openView(e)}>
                <span className="diary-day">{Number(e.date!.slice(8))}</span>
                <span className={`diary-cover ${t.square ? "square" : ""}`}><span>{t.label}</span><LCover x={e} /></span>
                <span className="diary-title"><b>{e.favorite ? "♥ " : ""}<LTitle x={e} /></b><small>{[t.label, e.year].filter(Boolean).join(" · ")}</small></span>
                {e.rating ? <Rating r={e.rating} /> : null}
              </button>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
}

// Favoriler bölümü (profil ana sayfasında): türler arasında geçiş, sahibi sürükleyerek sıralar
// types: bu bölümde gösterilecek türler (boşsa hepsi); title: sahibinin verdiği başlık
export function FavoritesSection({ types = null, title = null }: { types?: EntryType[] | null; title?: string | null }) {
  const { entries, isMe } = useProfile();
  const [favTab, setFavTab] = useState("");
  const favs = entries.filter((e) => e.favorite && (!types || types.includes(e.type)));
  const favTypes = TYPE_KEYS.filter((k) => favs.some((e) => e.type === k));
  const favType = favTypes.includes(favTab as EntryType) ? (favTab as EntryType) : favTypes[0];
  const [picking, setPicking] = useState(false);
  if (!favs.length && !isMe) return null;
  return (
    <section className="section favs">
      <div className="section-head">
        <h2>♥ {title || (types?.length === 1 ? `Favori ${TYPES[types[0]].plural.toLocaleLowerCase("tr")}` : "Favoriler")}</h2>
        {favTypes.length > 1 && (
          <div className="mini-tabs">
            {favTypes.map((k) => (
              <button key={k} className={favType === k ? "active" : ""} onClick={() => setFavTab(k)} title={TYPES[k].plural}>{TYPES[k].label}</button>
            ))}
          </div>
        )}
        {isMe && <button className="link" onClick={() => setPicking(true)}>+ Favori ekle</button>}
      </div>
      {favs.length ? <Favorites list={favs.filter((e) => e.type === favType)} isMe={isMe} />
        : <p className="muted small">Henüz favorin yok. <button className="link" onClick={() => setPicking(true)}>Favori ekle</button>: kütüphanende olmasa da bulup eklersin.</p>}
      {picking && <FavPicker type={favType || types?.[0] || "game"} onClose={() => setPicking(false)} />}
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
        <div className="ph">{t.label}</div><LCover x={e} />
      </button>
      <div className="lrow-main">
        <div className="lrow-head">
          <button className="lrow-title" onClick={() => openView(e)}>{e.favorite ? "♥ " : ""}<LTitle x={e} />{e.year ? <> <span className="muted">({e.year})</span></> : null}</button>
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
