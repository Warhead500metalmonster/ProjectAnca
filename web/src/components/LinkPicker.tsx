/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import type { EntryType } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { type Found, searchCredit, searchSource } from "@/lib/data";

// Bir kaydı ya da içeriği gerçek sayfasına bağlamak için arama penceresi: adı yazılı gelir, doğru olanı seçersin.
// switchable: film / dizi / anime arasında tür değiştirilebilir (yanlış türde loglanmışsa)
export function LinkPicker({ type: initialType, title, heading, note, switchable = false, onPick, onClose }: {
  type: EntryType; title: string; heading?: string; note?: React.ReactNode; switchable?: boolean;
  onPick: (f: Found) => Promise<void>; onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);
  const [type, setType] = useState(initialType);
  const [text, setText] = useState(title);
  const [list, setList] = useState<Found[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { ref.current?.showModal(); }, []);
  useEffect(() => {
    const t = text.trim();
    if (t.length < 2) return;
    const mine = ++seq.current;
    const timer = setTimeout(() => {
      setError("");
      setList(null);
      searchSource(type, t).then((r) => { if (mine === seq.current) setList(r.filter((f) => !f.custom)); })
        .catch(() => { if (mine === seq.current) setError("Arama şu an çalışmıyor. Biraz sonra tekrar dener misin?"); });
    }, 300);
    return () => clearTimeout(timer);
  }, [text, type]);

  async function pick(f: Found) {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await onPick(f);
      ref.current?.close();
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  const credit = searchCredit(type);
  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="dialog-head">
        <h2>{heading || "Gerçek sayfasına bağla"}</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
      </div>
      {note && <p className="muted small" style={{ marginTop: 0 }}>{note}</p>}
      {switchable && (
        <div className="type-picker" style={{ marginBottom: 10 }}>
          {(["movie", "show", "anime"] as EntryType[]).map((k) => <button type="button" key={k} className={type === k ? "active" : ""} onClick={() => setType(k)}>{TYPES[k].label}</button>)}
        </div>
      )}
      <div className="field">
        <label htmlFor="link-text">Adı</label>
        <input id="link-text" autoFocus autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {!list && !error && <div className="loading">Aranıyor…</div>}
      {list && !list.length && <div className="empty">Sonuç yok. Adı farklı yazmayı dene (İngilizce ya da orijinal adıyla da olur).</div>}
      {list && list.length > 0 && (
        <div className="suggest link-results">
          {list.map((f, i) => (
            <button type="button" key={(f.ext_id || f.rawg_id || "") + String(i)} disabled={busy} onClick={() => pick(f)}>
              {f.thumb ? <img className={TYPES[f.type].square ? "sq" : ""} src={f.thumb} alt="" /> : <span className="noimg" />}
              <span className="name">{f.title}<small>{[f.year || "Tarih yok", f.sub].filter(Boolean).join(" · ")}</small></span>
            </button>
          ))}
        </div>
      )}
      <p className="muted small" style={{ marginBottom: 0 }}>Veri: <a href={credit[1]} target="_blank" rel="noopener">{credit[0]}</a></p>
    </dialog>
  );
}
