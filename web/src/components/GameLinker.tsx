/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { type Found, searchGames } from "@/lib/data";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

// Yönetici: kapağı ya da bilgisi gelmeyen bir oyunu IGDB'deki karşılığına bağlar. Ad yazılınca aranır, seçince o oyunun bütün loglarına gelir.
// Kişilerin başka sitelerden elle koyduğu kapaklara dokunulmaz (veritabanı öyle yapar).
export function GameLinker({ rawgId, title, onClose }: { rawgId: number | null; title: string; onClose: () => void }) {
  const { toast, refresh } = useApp();
  const router = useRouter();
  const ref = useRef<HTMLDialogElement>(null);
  const seq = useRef(0);
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
      searchGames(t, 10).then((r) => { if (mine === seq.current) setList(r); })
        .catch(() => { if (mine === seq.current) setError("Arama şu an çalışmıyor. Biraz sonra tekrar dener misin?"); });
    }, 250);
    return () => clearTimeout(timer);
  }, [text]);

  async function pick(f: Found) {
    const igdb = (f.raw as { igdb_id?: number } | undefined)?.igdb_id;
    if (!igdb || busy) return;
    setBusy(true);
    setError("");
    try {
      const target = await q<number>(sb().rpc("link_game", {
        p_rawg: rawgId && rawgId > 0 ? rawgId : null, p_title: title, p_igdb: igdb, p_cover: f.raw?.background_image ?? null,
      }));
      toast(`${f.title} bağlandı, loglar güncellendi ✓`);
      refresh();
      ref.current?.close();
      if (target && target !== rawgId) router.push(`/game/${target}`);
    } catch (err) {
      setError((err as Error).message);
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <div className="dialog-head">
        <h2>IGDB ile eşleştir</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
      </div>
      <p className="muted small" style={{ marginTop: 0 }}>Doğru oyunu seç: kapak ve bilgiler bu oyunun bütün loglarına gelir. Kişilerin elle koyduğu kapaklar kalır.</p>
      <div className="field">
        <label htmlFor="link-text">Oyunun adı</label>
        <input id="link-text" autoFocus autoComplete="off" value={text} onChange={(e) => setText(e.target.value)} />
      </div>
      {error && <p className="form-error">{error}</p>}
      {!list && !error && <div className="loading">Aranıyor…</div>}
      {list && !list.length && <div className="empty">Sonuç yok. Adı farklı yazmayı dene.</div>}
      {list && list.length > 0 && (
        <div className="suggest link-results">
          {list.map((f) => (
            <button type="button" key={f.rawg_id} disabled={busy} onClick={() => pick(f)}>
              {f.thumb ? <img src={f.thumb} alt="" /> : <span className="noimg" />}
              <span className="name">{f.title}<small>{f.year || "Tarih yok"}</small></span>
            </button>
          ))}
        </div>
      )}
    </dialog>
  );
}
