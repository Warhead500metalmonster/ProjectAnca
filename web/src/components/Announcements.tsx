"use client";

import { useState } from "react";
import type { Profile } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { CHANGELOG } from "@/lib/changelog";
import { fmtDate, timeAgo } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar, Name, RichText } from "./ui";

interface Post { id: string; title: string; body: string | null; pinned: boolean; created_at: string; author_id: string; profiles?: Profile | null }
type Item = { key: string; kind: "post" | "update"; title: string; body: string; at: string; pinned: boolean; post?: Post };

// Topluluk → Duyurular: site sahibinin yazdıkları (veritabanında) ve sitenin yenilikleri (kodda, lib/changelog.ts) bir arada.
export function Announcements() {
  const { isOwner, toast, version } = useApp();
  const [shown, setShown] = useState(3);
  const [open, setOpen] = useState<string | null>(null); // uzun yazının tamamı açık olan
  const [writing, setWriting] = useState(false);
  const [tick, setTick] = useState(0);
  const { data: posts } = useLoad(() => q<Post[]>(sb().from("announcements").select(`*, profiles(${PROFILE_COLS})`).order("created_at", { ascending: false }).limit(50))
    .catch(() => [] as Post[]), [version, tick], supabaseConfigured()); // tablo henüz yoksa yalnızca yenilikler görünür

  const items: Item[] = [
    ...(posts || []).map((p) => ({ key: p.id, kind: "post" as const, title: p.title, body: p.body || "", at: p.created_at, pinned: p.pinned, post: p })),
    ...CHANGELOG.map((c, i) => ({ key: `u${i}`, kind: "update" as const, title: c.title, body: c.body, at: c.date, pinned: false })),
  ].sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.at.localeCompare(a.at));

  async function remove(id: string) {
    if (!confirm("Bu duyuru silinsin mi?")) return;
    try { await q(sb().from("announcements").delete().eq("id", id)); setTick((t) => t + 1); toast("Duyuru silindi"); }
    catch (e) { toast("Silinemedi: " + (e as Error).message); }
  }

  return (
    <section className="section">
      <div className="section-head">
        <h2>Duyurular</h2>
        {isOwner && !writing && <button className="link" onClick={() => setWriting(true)}>+ Duyuru yaz</button>}
      </div>
      {writing && <Composer onDone={(ok) => { setWriting(false); if (ok) setTick((t) => t + 1); }} />}
      <div className="ann-list">
        {items.slice(0, shown).map((it) => {
          const isOpen = open === it.key;
          return (
            <article key={it.key} className={`ann ${it.kind} ${it.pinned ? "pinned" : ""} ${isOpen ? "open" : ""}`}>
              <button className="ann-row" onClick={() => setOpen(isOpen ? null : it.key)} aria-expanded={isOpen}>
                <span className="ann-tag">{it.pinned ? "Sabit" : it.kind === "post" ? "Duyuru" : "Yenilik"}</span>
                <b className="ann-title">{it.title}</b>
                <span className="ann-date">{it.kind === "post" ? timeAgo(it.at) : fmtDate(it.at)}</span>
                <span className="ann-caret" aria-hidden="true">{isOpen ? "−" : "+"}</span>
              </button>
              {isOpen && (
                <div className="ann-body">
                  {it.kind === "post" && it.post?.profiles && (
                    <div className="ann-by"><Avatar p={it.post.profiles} cls="sm" /><b><Name p={it.post.profiles} /></b>
                      {isOwner && <button className="link danger-link" onClick={() => remove(it.key)}>Sil</button>}</div>
                  )}
                  {it.body ? <RichText text={it.body} /> : null}
                </div>
              )}
            </article>
          );
        })}
      </div>
      {items.length > shown
        ? <button className="link ann-more" onClick={() => setShown((n) => n + 5)}>Daha eski duyurular ({items.length - shown})</button>
        : items.length > 3 && <button className="link ann-more" onClick={() => setShown(3)}>Daha az göster</button>}
    </section>
  );
}

// Site sahibinin duyuru yazma kutusu
function Composer({ onDone }: { onDone: (ok: boolean) => void }) {
  const { toast } = useApp();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [busy, setBusy] = useState(false);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy(true);
    try {
      await q(sb().from("announcements").insert({ title: title.trim(), body: body.trim() || null, pinned }));
      toast("Duyuru yayında");
      onDone(true);
    } catch (err) {
      const m = (err as Error).message;
      toast(m.includes("announcements") ? "Duyurular için veritabanı henüz güncellenmemiş (018)." : "Gönderilemedi: " + m);
      setBusy(false);
    }
  }

  return (
    <form className="ann-compose" onSubmit={send}>
      <input className="input" placeholder="Başlık" maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
      <textarea className="input" rows={4} maxLength={4000} placeholder="Ne söylemek istiyorsun? (isteğe bağlı)" value={body} onChange={(e) => setBody(e.target.value)} />
      <div className="ann-compose-bar">
        <label className="check"><input type="checkbox" checked={pinned} onChange={(e) => setPinned(e.target.checked)} /> En üste sabitle</label>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn" onClick={() => onDone(false)}>Vazgeç</button>
        <button className="btn primary" disabled={busy || !title.trim()}>{busy ? "Gönderiliyor…" : "Yayınla"}</button>
      </div>
    </form>
  );
}
