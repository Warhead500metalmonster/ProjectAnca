"use client";

import { useEffect, useRef, useState } from "react";
import type { PageEdit } from "@/lib/types";
import { safeUrl } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

interface Props {
  editKey: string;          // g:<rawg id> ya da tür:isim
  edit: PageEdit;           // şu anki düzenleme
  source: PageEdit;         // RAWG / TMDB'den gelen hâli (boş alanlarda örnek olarak görünür)
  creatorLabel: string;
  onClose: () => void;
}

// Yönetici: içerik sayfasındaki adı, kapağı, açıklamayı elle düzeltir. Boş bırakılan alan kaynaktan gelir.
export function PageEditor({ editKey, edit, source, creatorLabel, onClose }: Props) {
  const { me, toast, refresh } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [f, setF] = useState({
    title: edit.title || "", creator: edit.creator || "", year: edit.year ? String(edit.year) : "",
    cover: edit.cover || "", backdrop: edit.backdrop || "", description: edit.description || "", genres: (edit.genres || []).join(", "),
  });
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if ((f.cover && !safeUrl(f.cover)) || (f.backdrop && !safeUrl(f.backdrop))) return setError("Görsel linkleri https:// ile başlamalı.");
    const data: PageEdit = {};
    if (f.title.trim()) data.title = f.title.trim();
    if (f.creator.trim()) data.creator = f.creator.trim();
    if (parseInt(f.year)) data.year = parseInt(f.year);
    if (f.cover.trim()) data.cover = f.cover.trim();
    if (f.backdrop.trim()) data.backdrop = f.backdrop.trim();
    if (f.description.trim()) data.description = f.description.trim();
    const genres = f.genres.split(",").map((g) => g.trim()).filter(Boolean);
    if (genres.length) data.genres = genres;
    setSaving(true);
    try {
      const table = sb().from("content_edits");
      if (Object.keys(data).length) await q(table.upsert({ key: editKey, data, updated_by: me?.id, updated_at: new Date().toISOString() }, { onConflict: "key" }));
      else await q(table.delete().eq("key", editKey));
      ref.current?.close();
      toast("Sayfa güncellendi ✓");
      refresh();
    } catch (err) {
      setError("Kaydedilemedi: " + (err as Error).message);
      setSaving(false);
    }
  }

  async function reset() {
    if (!confirm("Bu sayfadaki tüm elle düzeltmeler silinsin mi? Bilgiler yine kaynaktan gelir.")) return;
    try {
      await q(sb().from("content_edits").delete().eq("key", editKey));
      ref.current?.close();
      toast("Düzeltmeler kaldırıldı");
      refresh();
    } catch (err) {
      setError("Olmadı: " + (err as Error).message);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form className="dialog-form" onSubmit={save}>
        <div className="dialog-head">
          <h2>Sayfayı düzenle</h2>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <p className="muted" style={{ margin: 0, fontSize: 14 }}>Boş bıraktığın alan kaynaktan (RAWG, TMDB…) gelmeye devam eder. Değişikliği herkes görür.</p>
        <div className="field"><label htmlFor="pe-title">Ad</label><input id="pe-title" maxLength={200} value={f.title} placeholder={source.title} onChange={set("title")} /></div>
        <div className="row">
          <div className="field grow"><label htmlFor="pe-creator">{creatorLabel}</label><input id="pe-creator" maxLength={200} value={f.creator} placeholder={source.creator} onChange={set("creator")} /></div>
          <div className="field small"><label htmlFor="pe-year">Yıl</label><input id="pe-year" type="number" min={1800} max={2100} value={f.year} placeholder={source.year ? String(source.year) : ""} onChange={set("year")} /></div>
        </div>
        <div className="field"><label htmlFor="pe-cover">Kapak görseli (link)</label><input id="pe-cover" type="url" value={f.cover} placeholder={source.cover || "https://…"} onChange={set("cover")} /></div>
        <div className="field"><label htmlFor="pe-bg">Arka plan görseli (link)</label><input id="pe-bg" type="url" value={f.backdrop} placeholder={source.backdrop || "https://…"} onChange={set("backdrop")} /></div>
        <div className="field"><label htmlFor="pe-genres">Türler <span className="muted">· virgülle ayır</span></label><input id="pe-genres" maxLength={300} value={f.genres} placeholder={(source.genres || []).join(", ")} onChange={set("genres")} /></div>
        <div className="field"><label htmlFor="pe-desc">Açıklama</label><textarea id="pe-desc" rows={6} maxLength={8000} value={f.description} placeholder={source.description?.slice(0, 300)} onChange={set("description")} /></div>
        {error && <p className="form-error">{error}</p>}
        <div className="actions">
          {Object.keys(edit).length > 0 && <button type="button" className="btn danger" onClick={reset}>Düzeltmeleri kaldır</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Vazgeç</button>
          <button type="submit" className="btn primary" disabled={saving}>Kaydet</button>
        </div>
      </form>
    </dialog>
  );
}
