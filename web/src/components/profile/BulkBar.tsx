"use client";

import { useState } from "react";
import type { Entry, EntryType, Status } from "@/lib/types";
import { STATUSES, statusLabel } from "@/lib/constants";
import { cleanTag } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "@/components/AppProvider";

const CHUNK = 150; // tek istekte en fazla bu kadar kayıt: adres çok uzayıp istek düşmesin

// Kütüphanede toplu düzenleme: seçilenlerin durumunu, platformunu değiştirir, etiket ekler ya da hepsini siler.
// updated_at'e dokunmaz; yüzlerce kayıt düzeltmek Topluluk akışını doldurmaz.
export function BulkBar({ entries, ids, type, total, onAll, onDone, onClose }: {
  entries: Entry[]; ids: Set<string>; type: EntryType | null; total: number; onAll: () => void; onDone: () => void; onClose: () => void;
}) {
  const { toast, refresh } = useApp();
  const [status, setStatus] = useState<Status | "">("");
  const [platform, setPlatform] = useState("");
  const [tag, setTag] = useState("");
  const [busy, setBusy] = useState(false);
  const list = [...ids];
  const clean = cleanTag(tag);
  const can = !!list.length && !busy && !!(status || platform.trim() || clean);

  async function chunks(run: (part: string[]) => PromiseLike<{ data: unknown; error: { message: string } | null }>, all = list) {
    for (let i = 0; i < all.length; i += CHUNK) await q(run(all.slice(i, i + CHUNK)));
  }

  async function apply() {
    setBusy(true);
    try {
      const patch = { ...(status && { status }), ...(platform.trim() && { platform: platform.trim().slice(0, 60) }) };
      if (Object.keys(patch).length) await chunks((part) => sb().from("entries").update(patch).in("id", part));
      if (clean) {
        // Etiketi olanlara eklenir, mevcut etiketleri silinmez; aynı etiketlere sahip olanlar birlikte güncellenir
        const groups = new Map<string, { tags: string[]; ids: string[] }>();
        for (const e of entries) {
          const had = e.tags || [];
          if (!ids.has(e.id) || had.includes(clean) || had.length >= 20) continue;
          const k = had.join("\n");
          (groups.get(k) || groups.set(k, { tags: had, ids: [] }).get(k)!).ids.push(e.id);
        }
        for (const g of groups.values()) await chunks((part) => sb().from("entries").update({ tags: [...g.tags, clean] }).in("id", part), g.ids);
      }
      toast(`${list.length} kayıt güncellendi ✓`);
      refresh();
      setStatus(""); setPlatform(""); setTag("");
      onDone();
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    if (!confirm(`${list.length} kayıt kalıcı olarak silinsin mi? Bu geri alınamaz.`)) return;
    setBusy(true);
    try {
      await chunks((part) => sb().from("entries").delete().in("id", part));
      toast(`${list.length} kayıt silindi`);
      refresh();
      onDone();
    } catch (err) {
      toast("Silinemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bulk-bar" role="region" aria-label="Toplu düzenleme">
      <div className="bulk-count">
        <b>{list.length} seçili</b>
        {list.length < total && <button type="button" className="link" onClick={onAll}>Tümünü seç ({total})</button>}
      </div>
      <select aria-label="Durum" value={status} onChange={(e) => setStatus(e.target.value as Status | "")}>
        <option value="">Durum: aynı kalsın</option>
        {STATUSES.filter((s) => s !== "owned").map((s) => <option key={s} value={s}>Durum: {statusLabel(s, type)}</option>)}
      </select>
      <input className="input" aria-label="Platform" maxLength={60} placeholder="Platform: aynı kalsın" value={platform} onChange={(e) => setPlatform(e.target.value)} />
      <input className="input" aria-label="Etiket ekle" maxLength={31} placeholder="Etiket ekle" value={tag} onChange={(e) => setTag(e.target.value)} />
      <button type="button" className="btn primary" disabled={!can} onClick={apply}>{busy ? "Kaydediliyor…" : "Uygula"}</button>
      <button type="button" className="btn danger" disabled={!list.length || busy} onClick={remove}>Sil</button>
      <button type="button" className="btn" onClick={onClose}>Vazgeç</button>
    </div>
  );
}
