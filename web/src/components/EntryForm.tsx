/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, EntryType, FormGame, Item, RawgGame } from "@/lib/types";
import { STATUSES, STORES, TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { safeUrl, scoreText, today } from "@/lib/format";
import { gameFromRawg, rawg } from "@/lib/rawg";
import { type Found, addCatalog, findContent, isLink, searchCredit, tmdbCreator, tmdbDetail } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";
import { HmsInput } from "./ui";

interface Props { entry: Entry | null; game?: RawgGame | null; type?: EntryType; item?: Item | null; onClose: () => void }

export function EntryForm({ entry, game, type: initialType, item, onClose }: Props) {
  const { me, toast, refresh, scale } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const searchSeq = useRef(0);       // geç gelen eski cevapları yok saymak için
  const searchTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const src = entry || item;         // düzenlenen kayıt ya da önceden doldurulacak içerik

  const [type, setType] = useState<EntryType>(src?.type || (game ? "game" : initialType) || "game");
  const [picked, setPicked] = useState<FormGame | null>(
    src?.type === "game" && src.rawg_id
      ? { rawg_id: src.rawg_id, title: src.title, year: src.year, cover: src.cover, creator: src.creator }
      : game ? gameFromRawg(game) : null,
  );
  const [title, setTitle] = useState(src && src.type !== "game" ? src.title : "");
  const [year, setYear] = useState(src?.year?.toString() || "");
  const [creator, setCreator] = useState(src?.creator || "");
  const [cover, setCover] = useState(src?.cover || "");
  const [extId, setExtId] = useState(src?.ext_id || null); // seçilen film/dizi/animenin dış kaynak kimliği
  const [custom, setCustom] = useState(false);              // elle / linkle girildi: kaydedince ortak kataloğa yazılır
  const [status, setStatus] = useState(entry?.status || "completed");
  const [platform, setPlatform] = useState(entry?.platform || "");
  const [store, setStore] = useState(entry?.store || "");
  const [emulated, setEmulated] = useState(!!entry?.emulated);
  const [playtime, setPlaytime] = useState<number | null>(entry?.playtime_sec ?? (entry?.hours ? Math.round(Number(entry.hours) * 3600) : null));
  const [progressSec, setProgressSec] = useState<number | null>(entry?.progress_sec ?? null);
  const [started, setStarted] = useState(entry?.started_on || "");
  const [date, setDate] = useState(entry?.date || "");
  const [note, setNote] = useState(entry?.progress || "");
  const [review, setReview] = useState(entry?.notes || "");
  const [rating, setRating] = useState(Number(entry?.rating) || 0); // 0-10
  const [favorite, setFavorite] = useState(!!entry?.favorite);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [suggestions, setSuggestions] = useState<Found[] | null>(null);
  const [suggestNote, setSuggestNote] = useState("");

  const t = TYPES[type];
  const isGame = type === "game";

  useEffect(() => {
    ref.current?.showModal();
    // Kayıtlı oyunu düzenlerken platform/mağaza önerileri için RAWG'den detayı çek
    if (src?.type === "game" && src.rawg_id && !game) loadGameOptions(src.rawg_id);
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
    setExtId(null); // elle değiştirilen isim artık seçilen içerik değil
    setCustom(true);
    clearTimeout(searchTimer.current);
    searchSeq.current++;
    setSuggestions(null);
    setSuggestNote("");
    if (text.trim().length < 2) return;
    searchTimer.current = setTimeout(() => search(text.trim()), 300);
  }

  async function search(text: string) {
    const seq = ++searchSeq.current;
    try {
      const list = await findContent(type, text);
      if (seq !== searchSeq.current) return;
      setSuggestions(list);
      if (!list.length && type === "music") setSuggestNote(isLink(text) ? "Bu link açılamadı. Adını elle yazabilirsin." : "Bulamadın mı? YouTube, YouTube Music ya da Spotify linkini yapıştır, bilgiler otomatik gelsin. Ya da adını ve sanatçısını elle yaz, herkes için Ancalog'a eklenir.");
      else setSuggestNote(list.length ? "" : isGame ? "Sonuç yok. Farklı yazmayı dene." : "");
      if (!list.length && !isGame && type !== "music") setSuggestions(null); // elle yazmak serbest
    } catch {
      if (seq === searchSeq.current) { setSuggestions([]); setSuggestNote("Arama şu an çalışmıyor."); }
    }
  }

  function pick(f: Found) {
    searchSeq.current++;
    setSuggestions(null);
    setError("");
    if (isGame && f.raw) {
      setPicked(gameFromRawg(f.raw));
      loadGameOptions(f.raw.id); // arama sonucunda geliştirici yok, detaydan gelir
      return;
    }
    // Diğer türlerde seçim sadece kutuları doldurur
    setTitle(f.title);
    setCreator(f.creator || "");
    setYear(f.year ? String(f.year) : "");
    setCover(f.cover || "");
    setExtId(f.ext_id || null);
    setCustom(!!f.custom);
    // TMDB aramasında yönetmen yok, ayrıntıdan gelir
    if (f.ext_id?.startsWith("tmdb:")) {
      tmdbDetail(f.ext_id).then((d) => { const c = tmdbCreator(d); if (c) setCreator((cur) => cur || c); }).catch(() => {});
    }
  }

  function changeType(next: EntryType) {
    setType(next);
    setExtId(null);
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
      data = { title: name, year: parseInt(year) || null, creator: creator.trim() || null, cover: url || null, rawg_id: null, ext_id: extId };
    }
    const startedOn = started || null;
    // Bitti işaretlenip tarih girilmediyse bugünü yaz (yıllık istatistik için)
    const finished = date || (status === "completed" ? today() : null);
    if (startedOn && finished && startedOn > finished) return setError("Başlama tarihi bitirme tarihinden sonra olamaz.");
    Object.assign(data, {
      type, status, date: finished, started_on: startedOn,
      platform: platform.trim() || null,
      store: isGame ? store.trim() || null : null,
      emulated: isGame && emulated,
      playtime_sec: playtime,
      progress_sec: progressSec,
      hours: playtime ? Math.round(playtime / 360) / 10 : null, // eski alanla uyumlu kalsın
      progress: note.trim() || null,
      rating,
      favorite,
      notes: review.trim() || null,
      updated_at: new Date().toISOString(),
    });

    setSaving(true);
    try {
      const db = sb();
      // Aramada olmayan içerik ortak kataloğa bir kez yazılır; aynısı varsa kayıt ona bağlanır (aynı şarkı iki kez açılmaz)
      if (!isGame && custom) {
        const c = await addCatalog({ type, title: data.title!, creator: data.creator ?? null, year: data.year ?? null, cover: data.cover ?? null, rawg_id: null, ext_id: data.ext_id })
          .catch(() => null); // katalog çalışmazsa kayıt yine de kaydedilsin
        if (c) Object.assign(data, { title: c.title, creator: c.creator, year: c.year, cover: c.cover, ext_id: c.ext_id });
      }
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
      const msg = (err as Error).message;
      setError(msg.includes("favori") ? msg : "Kaydedilemedi: " + msg);
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
  const credit = searchCredit(type);
  // 5'lik ölçekte 5 yıldız (her yarım = 1 puan), 10'lukta 10 yıldız (her yarım = 0,5 puan)
  const n = scale === 10 ? 10 : 5, step = 10 / n;

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
            {TYPE_KEYS.map((k) => (
              <button type="button" key={k} className={type === k ? "active" : ""} onClick={() => changeType(k)}>{TYPES[k].icon} {TYPES[k].label}</button>
            ))}
          </div>
        </div>
        <div className="field suggest-wrap">
          <label htmlFor="f-title">{isGame ? "Oyun ara" : type === "music" ? "Albüm / şarkı" : "İsim"}</label>
          {isGame && picked ? (
            <div className="picked">
              {safeUrl(picked.cover) ? <img src={picked.cover!} alt="" /> : <span className="noimg" />}
              <div className="info"><b>{picked.title}</b><span>{[picked.year, picked.creator].filter(Boolean).join(" · ")}</span></div>
              <button type="button" className="btn" onClick={() => { setPicked(null); setTitle(""); }}>Değiştir</button>
            </div>
          ) : (
            <input id="f-title" maxLength={200} autoComplete="off" autoFocus value={title}
              placeholder={isGame ? "Oyunun adını yaz ve listeden seç…" : type === "music" ? "Albüm / şarkı ara ya da YouTube, Spotify linki yapıştır…" : `${t.label} ara, listeden seç ya da elle yaz…`}
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
              {suggestions.map((f, i) => (
                <button type="button" key={i} onClick={() => pick(f)}>
                  {f.thumb
                    ? <img className={TYPES[f.type].square ? "sq" : ""} src={f.thumb} alt="" onError={(e) => (e.currentTarget.style.visibility = "hidden")} />
                    : <span className="noimg" />}
                  <span className="name">{f.title}{f.sub && <small>{f.sub}</small>}</span>
                  <span className="year">{f.year || ""}</span>
                </button>
              ))}
              {suggestNote && <div className="note">{suggestNote}</div>}
              <span className="credit">Veri: <a href={credit[1]} target="_blank" rel="noopener">{credit[0]}</a></span>
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
            <label className="check grow"><input type="checkbox" checked={emulated} onChange={(e) => setEmulated(e.target.checked)} /> 🕹️ Emülatörde oynadım</label>
          </div>
        )}
        <div className="row">
          <div className="field grow">
            <label>{t.time}</label>
            <HmsInput value={playtime} onChange={setPlaytime} label={t.time} />
          </div>
          <div className="field grow">
            <label>Şu anki ilerleme</label>
            <HmsInput value={progressSec} onChange={setProgressSec} label="Şu anki ilerleme" />
          </div>
        </div>
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
          <label htmlFor="f-note">Not <span className="muted">· akışta görünmez, kayda tıklayan görür</span></label>
          <input id="f-note" maxLength={200} placeholder={t.progress} value={note} onChange={(e) => setNote(e.target.value)} />
        </div>
        <div className="field">
          <label>Puan <span className="muted">{rating ? `(${scoreText(rating, scale)})` : ""}</span></label>
          <div className={`stars input ${n === 10 ? "ten" : ""}`}>
            {Array.from({ length: n }, (_, j) => j + 1).map((i) => {
              const v = rating - (i - 1) * step;
              return (
                <span key={i} className={`star ${v >= step ? "full" : v >= step / 2 ? "half" : ""}`}
                  onClick={(e) => setRating((i - (e.nativeEvent.offsetX < e.currentTarget.offsetWidth / 2 ? 0.5 : 0)) * step)}>★</span>
              );
            })}
            <button type="button" className="link clear" onClick={() => setRating(0)}>temizle</button>
          </div>
        </div>
        <label className="check"><input type="checkbox" checked={favorite} onChange={(e) => setFavorite(e.target.checked)} /> ❤️ Favorilerime ekle <span className="muted">(her kategoride en fazla 10)</span></label>
        {!isGame && (
          <div className="field">
            <label htmlFor="f-cover">Kapak görseli (URL)</label>
            <input id="f-cover" type="url" placeholder="https://…" value={cover} onChange={(e) => setCover(e.target.value)} />
          </div>
        )}
        <div className="field">
          <label htmlFor="f-review">İnceleme <span className="muted">· profilinde bu kayda tıklayanlar okuyup beğenebilir, yorum yapabilir</span></label>
          <textarea id="f-review" rows={3} maxLength={5000} value={review} onChange={(e) => setReview(e.target.value)} />
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
