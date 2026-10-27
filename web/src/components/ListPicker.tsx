"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { Item, List } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentKey } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";
import { Cover } from "./ui";

export const LIST_COLS = "id, title, is_public, updated_at, list_items(id, type, title, rawg_id, position)";

// Bir içeriği listelerime ekleyip çıkardığım pencere
export function ListPicker({ item, onClose }: { item: Item; onClose: () => void }) {
  const { me, toast, refresh } = useApp();
  const ref = useRef<HTMLDialogElement>(null);
  const [lists, setLists] = useState<List[] | null>(null);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState("");
  const key = contentKey(item);

  async function load() {
    setLists(await q<List[]>(sb().from("lists").select(LIST_COLS).eq("user_id", me!.id).order("updated_at", { ascending: false })));
  }
  useEffect(() => {
    ref.current?.showModal();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- tarayıcı deposundan / ağdan gelen veri
    load().catch((err) => toast("Listeler yüklenemedi: " + err.message));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addTo(list: List) {
    const items = list.list_items || [];
    const found = items.find((i) => contentKey(i) === key);
    setBusy(list.id);
    try {
      const db = sb();
      if (found) await q(db.from("list_items").delete().eq("id", found.id));
      else {
        const position = items.reduce((m, i) => Math.max(m, i.position + 1), 0);
        await q(db.from("list_items").insert({ list_id: list.id, ...item, position }));
      }
      await q(db.from("lists").update({ updated_at: new Date().toISOString() }).eq("id", list.id));
      toast(found ? `“${list.title}” listesinden çıkarıldı` : `“${list.title}” listesine eklendi ✓`);
      await load();
      refresh();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function create(ev: React.FormEvent) {
    ev.preventDefault();
    const title = name.trim();
    if (!title) return;
    setBusy("new");
    try {
      const list = await q<List>(sb().from("lists").insert({ title, user_id: me!.id }).select(LIST_COLS).single());
      setName("");
      await addTo({ ...list, list_items: [] });
    } catch (err) {
      toast("Liste oluşturulamadı: " + (err as Error).message);
      setBusy("");
    }
  }

  return (
    <dialog ref={ref} onClose={onClose} onClick={(e) => e.target === ref.current && ref.current?.close()}>
      <div className="dialog-head pad">
        <h2>Listeye ekle</h2>
        <button type="button" className="icon-btn" aria-label="Kapat" onClick={() => ref.current?.close()}>✕</button>
      </div>
      <div className="pick-body">
        <div className="pick-item">
          <div className={`poster ${TYPES[item.type].square ? "square" : ""}`}><div className="ph">{TYPES[item.type].icon}</div><Cover src={item.cover} /></div>
          <div><b>{item.title}</b><span className="muted">{[TYPES[item.type].label, item.year].filter(Boolean).join(" · ")}</span></div>
        </div>
        {lists === null ? <div className="loading">Yükleniyor…</div> : (
          <div className="pick-lists">
            {lists.map((l) => {
              const on = (l.list_items || []).some((i) => contentKey(i) === key);
              return (
                <button key={l.id} type="button" className={`pick-row ${on ? "on" : ""}`} disabled={!!busy} onClick={() => addTo(l)}>
                  <span className="tick">{on ? "✓" : "+"}</span>
                  <span className="grow">{l.title} <small className="muted">{(l.list_items || []).length} içerik{l.is_public ? "" : " · 🔒 gizli"}</small></span>
                </button>
              );
            })}
            {!lists.length && <p className="muted" style={{ margin: 0 }}>Henüz listen yok. Hemen bir tane oluştur:</p>}
          </div>
        )}
        <form className="comment-form" onSubmit={create}>
          <input value={name} maxLength={100} placeholder="Yeni liste adı (ör. 2026'da bitireceklerim)" onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" disabled={!!busy || !name.trim()}>Oluştur ve ekle</button>
        </form>
        {me && <Link className="link" href={`/u/${me.username}/lists`} onClick={() => ref.current?.close()}>Tüm listelerim →</Link>}
      </div>
    </dialog>
  );
}
