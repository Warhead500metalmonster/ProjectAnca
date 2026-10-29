"use client";

import { useEffect, useRef, useState } from "react";
import type { List } from "@/lib/types";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

// Liste oluşturma / düzenleme penceresi
export function ListEditor({ list, onClose, onSaved }: { list: List | null; onClose: () => void; onSaved: (l: List | null) => void }) {
  const { me, toast } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [title, setTitle] = useState(list?.title || "");
  const [desc, setDesc] = useState(list?.description || "");
  const [vis, setVis] = useState<"public" | "unlisted" | "private">(list?.is_public ?? true ? "public" : list?.unlisted ? "unlisted" : "private");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return setError("Liste adı boş olamaz.");
    setBusy(true);
    try {
      // unlisted yalnızca kullanıldığında gönderilir (veritabanı güncellenmeden de liste kaydedilebilsin)
      const data = { title: title.trim(), description: desc.trim() || null, is_public: vis === "public",
        ...((vis === "unlisted" || list?.unlisted) && { unlisted: vis === "unlisted" }), updated_at: new Date().toISOString() };
      const saved = list
        ? await q<List>(sb().from("lists").update(data).eq("id", list.id).select().single())
        : await q<List>(sb().from("lists").insert({ ...data, user_id: me!.id }).select().single());
      toast(list ? "Liste güncellendi ✓" : "Liste oluşturuldu ✓");
      onSaved(saved);
      ref.current?.close();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!list || !confirm(`“${list.title}” listesi silinsin mi? İçindekiler kütüphanende kalır.`)) return;
    try {
      await q(sb().from("lists").delete().eq("id", list.id));
      toast("Liste silindi");
      onSaved(null);
      ref.current?.close();
    } catch (err) {
      setError((err as Error).message);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose}>
      <form className="dialog-form" onSubmit={submit}>
        <div className="dialog-head">
          <h2>{list ? "Listeyi düzenle" : "Yeni liste"}</h2>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <div className="field"><label htmlFor="lf-title">Liste adı</label>
          <input id="lf-title" maxLength={100} autoFocus value={title} placeholder="ör. Bitirmem gereken soulslike'lar" onChange={(e) => setTitle(e.target.value)} /></div>
        <div className="field"><label htmlFor="lf-desc">Açıklama</label>
          <textarea id="lf-desc" rows={3} maxLength={1000} value={desc} onChange={(e) => setDesc(e.target.value)} /></div>
        <div className="field"><label>Kimler görebilir?</label>
          <div className="vis-pick">
            {([["public", "Herkese açık", "Profilinde ve toplulukta görünür"], ["unlisted", "Liste dışı", "Hiçbir yerde görünmez, sadece linkini verdiğin kişiler açar"],
              ["private", "Gizli", "Sadece sen görürsün"]] as const).map(([k, name, hint]) => (
              <label key={k} className={`vis-opt ${vis === k ? "on" : ""}`}>
                <input type="radio" name="vis" checked={vis === k} onChange={() => setVis(k)} /> <b>{name}</b><span className="muted small">{hint}</span>
              </label>
            ))}
          </div>
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="actions">
          {list && <button type="button" className="btn danger" onClick={remove}>Listeyi sil</button>}
          <span className="spacer" />
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Vazgeç</button>
          <button className="btn primary" disabled={busy}>Kaydet</button>
        </div>
      </form>
    </dialog>
  );
}
