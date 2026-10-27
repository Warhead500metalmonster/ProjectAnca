/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, EntryType, FormGame, RawgGame } from "@/lib/types";
import { STATUSES, STORES, TYPES, statusLabel } from "@/lib/constants";
import { safeUrl, smallImage, today } from "@/lib/format";
import { gameFromRawg, rawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

interface Props { entry: Entry | null; game: RawgGame | null; type?: EntryType; onClose: () => void }

export function EntryForm({ entry, game, type: initialType, onClose }: Props) {
  const { me, toast, refresh } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const searchSeq = useRef(0);       // geç gelen eski cevapları yok saymak için
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  const [type, setType] = useState<EntryType>(entry?.type || (game ? "game" : initialType) || "game");
  const [picked, setPicked] = useState<FormGame | null>(
    entry?.type === "game" && entry.rawg_id
      ? { rawg_id: entry.rawg_id, title: entry.title, year: entry.year, cover: entry.cover, creator: entry.creator }
      : game ? gameFromRawg(game) : null,
  );
  const [title, setTitle] = useState(entry && !picked ? entry.title : "");
  const [year, setYear] = useState(entry?.year?.toString() || "");
  const [creator, setCreator] = useState(entry?.creator || "");
  const [status, setStatus] = useState(entry?.status || "completed");
  const [platform, setPlatform] = useState(entry?.platform || "");
  const [store, setStore] = useState(entry?.store || "");
  const [hours, setHours] = useState(entry?.hours?.toString() || "");
  const [started, setStarted] = useState(entry?.started_on || "");
  const [date, setDate] = useState(entry?.date || "");
  const [progress, setProgress] = useState(entry?.progress || "");
  const [cover, setCover] = useState(entry?.cover || "");
  const [notes, setNotes] = useState(entry?.notes || "");
  const [rating, setRating] = useState(entry?.rating || 0); // 0-10 (yarım yıldız = 1 puan)
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<RawgGame[] | null>(null);
  const [suggestNote, setSuggestNote] = useState("");

  const t = TYPES[type];
  const isGame = type === "game";

  useEffect(() => {
    ref.current?.showModal();
    // Kayıtlı oyunu düzenlerken platform/mağaza önerileri için RAWG'den detayı çek
    if (entry?.type === "game" && entry.rawg_id && !game) loadGameOptions(entry.rawg_id);
    return () => clearTimeout(searchTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadGameOptions(id: number) {
    try {
      const full = gameFromRawg(await rawg<RawgGame>(`games/${id}`));
      setPicked((g) => (g?.rawg_id === id ? { ...g, platforms: full.platforms, stores: full.stores, creator: g.creator || full.creator } : g));
    } catch { /* öneriler olmadan da yazılabilir */ }
  }

  function onTitleChange(text: string) {
    setTitle(text);
    clearTimeout(searchTimer.current);
    searchSeq.current++;
    setSuggestions(null);
    setSuggestNote("");
    if (!isGame || text.trim().length < 2) return;
    searchTimer.current = setTimeout(() => searchGames(text.trim()), 300);
  }

  async function searchGames(text: string) {
    const seq = ++searchSeq.current;
    try {
      const data = await rawg<{ results?: RawgGame[] }>("games", { search: text, page_size: 6 });
      if (seq !== searchSeq.current) return;
      setSuggestions(data.results || []);
      setSuggestNote(data.results?.length ? "" : "Sonuç yok. Farklı yazmayı dene.");
    } catch {
      if (seq === searchSeq.current) { setSuggestions([]); setSuggestNote("Arama şu an çalışmıyor."); }
    }
  }

  function pickGame(g: RawgGame) {
    searchSeq.current++;
    setSuggestions(null);
    setError("");
    setPicked(gameFromRawg(g));
    loadGameOptions(g.id); // arama sonucunda geliştirici yok, detaydan gelir
  }

  function changeType(next: EntryType) {
    setType(next);
    setError("");
    setSuggestions(null);
  }

  async function submit(ev: React.FormEvent) {
    ev.preventDefault();
    if (!me) return;
    setError("");
    let data: Partial<Entry>;
    if (isGame) {
      if (!picked) return setError("Listeden bir oyun seçmelisin.");
      const { rawg_id, title, year, cover, creator } = picked;
      data = { rawg_id, title, year, cover, creator };
    } else {
      const name = title.trim();
      const url = cover.trim();
      if (!name) return setError("İsim boş olamaz.");
      if (url && !safeUrl(url)) return setError("Kapak linki http:// ya da https:// ile başlamalı.");
      data = { title: name, year: parseInt(year) || null, creator: creator.trim() || null, cover: url || null, rawg_id: null };
    }
    const startedOn = started || null;
    // Bitti işaretlenip tarih girilmediyse bugünü yaz (yıllık istatistik için)
    const finished = date || (status === "completed" ? today() : null);
    if (startedOn && finished && startedOn > finished) return setError("Başlama tarihi bitirme tarihinden sonra olamaz.");
    const h = isGame && hours !== "" ? Number(hours) : null;
    if (h !== null && !(h >= 0 && h < 100000)) return setError("Oynama süresi geçerli bir sayı olmalı.");
    Object.assign(data, {
      type, status, date: finished, started_on: startedOn,
      platform: platform.trim() || null,
      store: isGame ? store.trim() || null : null,
      hours: h,
      progress: progress.trim() || null,
      rating,
      notes: notes.trim() || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(true);
    try {
      const db = sb();
      if (data.rawg_id && entry?.rawg_id !== data.rawg_id) {
        const dupe = await q<{ id: string }[]>(db.from("entries").select("id").eq("user_id", me.id).eq("rawg_id", data.rawg_id).limit(1));
        if (dupe.length) return setError("Bu oyun zaten kütüphanende var.");
      }
      if (entry) await q(db.from("entries").update(data).eq("id", entry.id));
      else await q(db.from("entries").insert({ ...data, user_id: me.id }));
      ref.current?.close();
      toast(entry ? "Kayıt güncellendi ✓" : "Kütüphanene eklendi ✓");
      refresh();
    } catch (err) {
      setError("Kaydedilemedi: " + (err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!entry || !confirm(`“${entry.title}” silinsin mi?`)) return;
    try {
      await q(sb().from("entries").delete().eq("id", entry.id));
      ref.current?.close();
      toast("Kayıt silindi");
      refresh();
    } catch (err) {
      setError("Silinemedi: " + (err as Error).message);
    }
  }

  const uniq = (list: string[]) => [...new Set(list)];
  const places = uniq([...(isGame ? picked?.platforms || [] : []), ...t.places]);
  const stores = uniq([...(picked?.stores || []), ...STORES]);

  return (
    <dialog ref={ref} onClose={onClose}>
      <form id="form" onSubmit={submit}>
        <div className="dialog-head">
          <h2>{entry ? "Kaydı düzenle" : "Yeni kayıt"}</h2>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <div className="field">
          <label>Tür</label>
          <div className="type-picker">
            {(Object.entries(TYPES) as [EntryType, (typeof TYPES)[EntryType]][]).map(([k, v]) => (
              <button type="button" key={k} className={type === k ? "active" : ""} onClick={() => changeType(k)}>{v.icon} {v.label}</button>
            ))}
          </div>
        </div>
        <div className="field suggest-wrap">
          <label htmlFor="f-title">{isGame ? "Oyun ara" : "İsim"}</label>
          {isGame && picked ? (
            <div className="picked">
              {safeUrl(picked.cover) ? <img src={picked.cover!} alt="" /> : <span className="noimg" />}
              <div className="info"><b>{picked.title}</b><span>{[picked.year, picked.creator].filter(Boolean).join(" · ")}</span></div>
              <button type="button" className="btn" onClick={() => { setPicked(null); setTitle(""); }}>Değiştir</button>
            </div>
          ) : (
            <input id="f-title" maxLength={200} autoComplete="off" autoFocus value={title}
              placeholder={isGame ? "Oyunun adını yaz ve listeden seç…" : ""}
              onChange={(e) => onTitleChange(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") { e.preventDefault(); (e.currentTarget.parentElement?.querySelector(".suggest button") as HTMLElement | null)?.focus(); }
              }} />
          )}
          {suggestions && (
            <div className="suggest" onKeyDown={(e) => {
              const b = document.activeElement as HTMLElement;
              if (e.key === "ArrowDown") { e.preventDefault(); (b.nextElementSibling as HTMLElement | null)?.focus?.(); }
              if (e.key === "ArrowUp") { e.preventDefault(); ((b.previousElementSibling as HTMLElement | null) || document.getElementById("f-title"))?.focus(); }
              if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); setSuggestions(null); document.getElementById("f-title")?.focus(); }
            }}>
              {suggestions.map((g) => (
                <button type="button" key={g.id} onClick={() => pickGame(g)}>
                  {g.background_image
                    ? <img src={smallImage(g.background_image)} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                    : <span className="noimg" />}
                  <span className="name">{g.name}</span>
                  <span className="year">{(g.released || "").slice(0, 4)}</span>
                </button>
              ))}
              {suggestNote && <div className="note">{suggestNote}</div>}
              <span className="credit">Veri: <a href="https://rawg.io" target="_blank" rel="noopener">RAWG</a></span>
            </div>
          )}
        </div>
        {!isGame && (
          <div className="row">
            <div className="field grow">
              <label htmlFor="f-creator">{t.creator}</label>
              <input id="f-creator" maxLength={200} value={creator} onChange={(e) => setCreator(e.target.value)} />
            </div>
            <div className="field small">
              <label htmlFor="f-year">Yıl</label>
              <input id="f-year" type="number" min={1800} max={2100} value={year} onChange={(e) => setYear(e.target.value)} />
            </div>
          </div>
        )}
        <div className="row">
          <div className="field grow">
            <label htmlFor="f-status">Durum</label>
            <select id="f-status" value={status} onChange={(e) => setStatus(e.target.value as Entry["status"])}>
              {STATUSES.map((s) => <option key={s} value={s}>{statusLabel(s, type)}</option>)}
            </select>
          </div>
          <div className="field grow">
            <label htmlFor="f-platform">{t.where}</label>
            <input id="f-platform" list="platformList" maxLength={60} autoComplete="off" value={platform} onChange={(e) => setPlatform(e.target.value)} />
            <datalist id="platformList">{places.map((p) => <option key={p} value={p} />)}</datalist>
          </div>
        </div>
        {isGame && (
          <div className="row">
            <div className="field grow">
              <label htmlFor="f-store">Mağaza</label>
              <input id="f-store" list="storeList" maxLength={60} autoComplete="off" value={store} onChange={(e) => setStore(e.target.value)} />
              <datalist id="storeList">{stores.map((s) => <option key={s} value={s} />)}</datalist>
            </div>
            <div className="field grow">
              <label htmlFor="f-hours">Oynama süresi (saat)</label>
              <input id="f-hours" type="number" min={0} max={99999} step={0.5} inputMode="decimal" value={hours} onChange={(e) => setHours(e.target.value)} />
            </div>
          </div>
        )}
        <div className="row">
          <div className="field grow">
            <label htmlFor="f-start">Başlama tarihi</label>
            <input id="f-start" type="date" value={started} onChange={(e) => setStarted(e.target.value)} />
          </div>
          <div className="field grow">
            <label htmlFor="f-date">Bitirme tarihi</label>
            <input id="f-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
        </div>
        <div className="field">
          <label htmlFor="f-progress">Şu anki ilerleme</label>
          <input id="f-progress" maxLength={200} placeholder={t.progress} value={progress} onChange={(e) => setProgress(e.target.value)} />
        </div>
        <div className="field">
          <label>Puan <span className="muted">{rating ? `(${(rating / 2).toLocaleString("tr")} / 5)` : ""}</span></label>
          <div className="stars input">
            {[1, 2, 3, 4, 5].map((i) => {
              const v = rating - (i - 1) * 2;
              return (
                <span key={i} className={`star ${v >= 2 ? "full" : v === 1 ? "half" : ""}`}
                  onClick={(e) => setRating(i * 2 - (e.nativeEvent.offsetX < e.currentTarget.offsetWidth / 2 ? 1 : 0))}>★</span>
              );
            })}
            <button type="button" className="link clear" onClick={() => setRating(0)}>temizle</button>
          </div>
        </div>
        {!isGame && (
          <div className="field">
            <label htmlFor="f-cover">Kapak görseli (URL)</label>
            <input id="f-cover" type="url" placeholder="https://…" value={cover} onChange={(e) => setCover(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="f-notes">Notlar / inceleme <span className="muted">· sadece profilinde bu kayda tıklayanlar görür</span></label>
          <textarea id="f-notes" rows={3} maxLength={5000} value={notes} onChange={(e) => setNotes(e.target.value)} />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="actions">
          {entry && <button type="button" className="btn danger" onClick={remove}>Sil</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Vazgeç</button>
          <button type="submit" className="btn primary" disabled={saving}>Kaydet</button>
        </div>
      </form>
    </dialog>
  );
}
