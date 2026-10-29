/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { Entry, EntryType } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { contentKey, norm, safeUrl } from "@/lib/format";
import { type Found, findContent } from "@/lib/data";
import { gameFromRawg } from "@/lib/rawg";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

// Favorilere doğrudan ekle: önce kütüphanende arar; yoksa dışarıdan bulup Kategorisiz olarak ekler ve favori yapar
export function FavPicker({ type: initial, onClose }: { type: EntryType; onClose: () => void }) {
  const { me, mine, toast, refresh } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [type, setType] = useState<EntryType>(initial);
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const [busy, setBusy] = useState(false);
  const seq = useRef(0);

  useEffect(() => { ref.current?.showModal(); }, []);

  // Yazdıkça dışarıda ara (kısa bir bekleme ile)
  useEffect(() => {
    const s = ++seq.current;
    const t = text.trim();
    if (t.length < 2) return;
    const timer = setTimeout(() => {
      findContent(type, t).then((list) => { if (s === seq.current) setFound(list.filter((f) => !f.custom).slice(0, 8)); })
        .catch(() => { if (s === seq.current) setFound([]); });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, type]);

  const favCount = mine.filter((e) => e.type === type && e.favorite).length;
  const needle = norm(text);
  const have = new Map(mine.filter((e) => e.type === type).map((e) => [contentKey(e), e]));
  // Kütüphanendekiler: yazı boşken en yüksek puanlıların önerilir
  const local = mine.filter((e) => e.type === type && !e.favorite && (!needle || norm(e.title).includes(needle)))
    .sort((a, b) => b.rating - a.rating || b.updated_at.localeCompare(a.updated_at)).slice(0, 6);
  const outside = (text.trim().length >= 2 ? found || [] : []).filter((f) => {
    const own = have.get(contentKey(f.raw ? { type, title: f.raw.name, rawg_id: f.raw.id } : f));
    return !own || !own.favorite;
  }).filter((f) => !local.some((e) => contentKey(e) === contentKey(f.raw ? { type, title: f.raw.name, rawg_id: f.raw.id } : f)));

  async function done(msg: string) {
    toast(msg);
    refresh();
    ref.current?.close();
  }

  async function addMine(e: Entry) {
    setBusy(true);
    try {
      await q(sb().from("entries").update({ favorite: true }).eq("id", e.id));
      await done(`“${e.title}” favorilerinde ♥`);
    } catch (err) {
      toast((err as Error).message.includes("favori") ? (err as Error).message : "Eklenemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function addNew(f: Found) {
    if (!me) return;
    const own = have.get(contentKey(f.raw ? { type, title: f.raw.name, rawg_id: f.raw.id } : f));
    if (own) return addMine(own);
    setBusy(true);
    try {
      const item = type === "game" && f.raw
        ? (({ rawg_id, title, year, creator, cover }) => ({ rawg_id, title, year, creator, cover, ext_id: null }))(gameFromRawg(f.raw))
        : { title: f.title, year: f.year, creator: f.creator, cover: f.cover, rawg_id: null, ext_id: f.ext_id ?? null };
      await q(sb().from("entries").insert({ ...item, type, status: "owned", favorite: true, rating: 0, user_id: me.id, updated_at: new Date().toISOString() }));
      await done(`“${item.title}” kütüphanene eklendi ve favorilerinde ♥`);
    } catch (err) {
      toast((err as Error).message.includes("favori") ? (err as Error).message : "Eklenemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} className="fav-picker">
      <div className="dialog-head">
        <h2>Favori ekle</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
      </div>
      <div className="type-picker">
        {TYPE_KEYS.map((k) => <button type="button" key={k} className={type === k ? "active" : ""} onClick={() => { setType(k); setFound(null); }}>{TYPES[k].label}</button>)}
      </div>
      <input className="input" autoFocus value={text} onChange={(e) => setText(e.target.value)}
        placeholder={`${TYPES[type].label} ara: kütüphanende yoksa da bulur`} />
      <p className="muted small">{favCount}/10 favori {TYPES[type].label.toLocaleLowerCase("tr")}. Kütüphanende olmayan bir şeyi seçersen <b>Kategorisiz</b> olarak eklenir; sonra istediğin duruma taşırsın.</p>
      <div className="suggest fav-results">
        {local.length > 0 && <div className="note">{needle ? "Kütüphanende" : "Kütüphanende en yüksek puan verdiklerin"}</div>}
        {local.map((e) => (
          <button type="button" key={e.id} disabled={busy} onClick={() => addMine(e)}>
            {safeUrl(e.cover) ? <img className={TYPES[type].square ? "sq" : ""} src={e.cover!} alt="" /> : <span className="noimg" />}
            <span className="name">{e.title}{e.year ? <small>{e.year}</small> : null}</span>
            <span className="year">♥ ekle</span>
          </button>
        ))}
        {outside.length > 0 && <div className="note">Kütüphanende yok, eklenip favori yapılır</div>}
        {outside.map((f, i) => (
          <button type="button" key={i} disabled={busy} onClick={() => addNew(f)}>
            {f.thumb ? <img className={TYPES[type].square ? "sq" : ""} src={f.thumb} alt="" /> : <span className="noimg" />}
            <span className="name">{f.title}{f.sub && <small>{f.sub}</small>}</span>
            <span className="year">{f.year || ""}</span>
          </button>
        ))}
        {text.trim().length >= 2 && found && !local.length && !outside.length && <div className="note">Bulunamadı, farklı yazmayı dene.</div>}
      </div>
    </dialog>
  );
}
