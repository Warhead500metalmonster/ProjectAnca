"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { EMOJIS, type ReactionKind, reactionsOf, reactionsOff, snapshot, subscribe, toggleReaction, want } from "@/lib/reactions";
import { useApp } from "./AppProvider";

// Yazının altında: ♡ Beğen, verilen tepkiler (sayılarıyla) ve tepki seçici. Kendi verdiğin tepki renkli görünür, tekrar basınca geri alınır.
export function Reactions({ kind, id }: { kind: ReactionKind; id: string }) {
  const { me, toast } = useApp();
  const target = `${kind}:${id}`;
  useSyncExternalStore(subscribe, snapshot, () => 0);
  useEffect(() => { want(target); }, [target]);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => { if (e instanceof KeyboardEvent ? e.key === "Escape" : !box.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", close);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", close); };
  }, [open]);

  if (reactionsOff()) return null;
  const rows = reactionsOf(target) || [];
  const counts = EMOJIS.map((e) => ({ e, n: rows.filter((r) => r.emoji === e).length, mine: !!me && rows.some((r) => r.emoji === e && r.user_id === me.id) }));
  const liked = counts[0].mine;

  async function react(emoji: string) {
    setOpen(false);
    if (!me) return toast("Tepki vermek için giriş yap.");
    try { await toggleReaction(target, emoji, me.id); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  return (
    <span className="reacts" ref={box}>
      <button type="button" className={`react-like ${liked ? "on" : ""}`} onClick={() => react("♥")} aria-pressed={liked} title={liked ? "Beğeniyi geri al" : "Beğen"}>
        {liked ? "♥" : "♡"}{counts[0].n ? <b>{counts[0].n}</b> : <span className="react-word">Beğen</span>}
      </button>
      {counts.slice(1).filter((c) => c.n).map((c) => (
        <button type="button" key={c.e} className={`react-chip ${c.mine ? "on" : ""}`} onClick={() => react(c.e)} aria-pressed={c.mine} title={c.mine ? "Tepkini geri al" : "Sen de ekle"}>
          {c.e}<b>{c.n}</b>
        </button>
      ))}
      <button type="button" className="react-add" aria-label="Tepki ekle" aria-expanded={open} title="Tepki ekle" onClick={() => setOpen(!open)}>
        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M8.5 14.5a4 4 0 0 0 7 0M9 9.5h.01M15 9.5h.01" /></svg>
      </button>
      {open && (
        <span className="react-pick" role="menu">
          {EMOJIS.slice(1).map((e) => <button type="button" role="menuitem" key={e} className={counts.find((c) => c.e === e)?.mine ? "on" : ""} onClick={() => react(e)}>{e}</button>)}
        </span>
      )}
    </span>
  );
}
