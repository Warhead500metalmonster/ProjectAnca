"use client";

import { useEffect, useRef, useState } from "react";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

// event_post: id "etkinlikId/mesajId" biçiminde (yönetim etkinliğe gidebilsin)
export type ReportKind = "profile" | "entry" | "comment" | "list" | "forum_thread" | "forum_post" | "message" | "event_post";
// id: raporlanan şeyin kimliği; user: sahibi; excerpt: yazının o anki hali (sonra silinse de yönetim görsün); label: pencerede ne raporlandığı
export interface ReportTarget { kind: ReportKind; id: string; user?: string | null; excerpt?: string | null; label: string }

const REASONS = ["Hakaret ya da taciz", "Nefret söylemi", "Habersiz spoiler", "Spam ya da reklam", "Uygunsuz ya da +18 içerik", "Sahte hesap ya da taklit", "Kişisel bilgi paylaşımı", "Diğer"];

// Raporlama penceresi: sebebi seç, istersen birkaç kelime yaz; rapor yönetim paneline düşer
export function ReportDialog({ target, onClose }: { target: ReportTarget; onClose: () => void }) {
  const { toast } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { ref.current?.showModal(); }, []);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) return;
    setBusy(true);
    try {
      await q(sb().from("reports").insert({
        kind: target.kind, target_id: target.id, target_user: target.user || null, reason,
        note: note.trim() || null, excerpt: target.excerpt?.slice(0, 600) || null,
      }));
      toast("Teşekkürler, raporun yönetime ulaştı. En kısa sürede bakacağız.");
      ref.current?.close();
    } catch (err) {
      const m = (err as Error).message;
      toast(m.includes("reports") ? "Raporlama için veritabanı henüz güncellenmemiş (020)." : "Gönderilemedi: " + m);
      setBusy(false);
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <form className="dialog-form report-form" onSubmit={send}>
        <div className="dialog-head">
          <h2>Raporla</h2>
          <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
        </div>
        <p className="muted small" style={{ margin: 0 }}>{target.label}</p>
        <div className="report-reasons">
          {REASONS.map((r) => (
            <label key={r} className={`chip ${reason === r ? "active" : ""}`}>
              <input type="radio" name="reason" hidden checked={reason === r} onChange={() => setReason(r)} />{r}
            </label>
          ))}
        </div>
        <textarea className="input" rows={3} maxLength={1000} placeholder="İstersen birkaç kelimeyle anlat (isteğe bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
        <p className="muted small" style={{ margin: 0 }}>Raporun sadece yönetime görünür, raporladığın kişi kimin raporladığını bilmez.</p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => ref.current?.close()}>Vazgeç</button>
          <button className="btn primary" disabled={!reason || busy}>{busy ? "Gönderiliyor…" : "Raporu gönder"}</button>
        </div>
      </form>
    </dialog>
  );
}
