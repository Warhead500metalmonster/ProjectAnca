"use client";

import { useState } from "react";
import Link from "next/link";
import type { Entry, EntryType, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

// Yıllık hedef: "2026'da 30 oyun bitir". profiles.goals = {"2026": {"game": 30}}
export function Goals({ profile, entries, isMe }: { profile: Profile; entries: Entry[]; isMe: boolean }) {
  const { setMe, toast, refresh } = useApp();
  const year = String(new Date().getFullYear());
  const goals = (profile.goals?.[year] || {}) as Partial<Record<EntryType, number>>;
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<Record<string, string>>({});
  const set = Object.entries(goals).filter(([, n]) => n && n > 0) as [EntryType, number][];

  if (!set.length && !isMe) return null;

  const doneOf = (t: EntryType) => entries.filter((e) => e.type === t && e.status === "completed" && e.date?.startsWith(year)).length;

  function start() {
    setForm(Object.fromEntries(TYPE_KEYS.map((t) => [t, goals[t] ? String(goals[t]) : ""])));
    setEditing(true);
  }

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    const next = Object.fromEntries(TYPE_KEYS.map((t) => [t, Math.min(9999, parseInt(form[t]) || 0)]).filter(([, n]) => n)) as Record<string, number>;
    try {
      const updated = await q<Profile>(sb().from("profiles").update({ goals: { ...profile.goals, [year]: next } }).eq("id", profile.id).select().single());
      setMe(updated);
      setEditing(false);
      toast(Object.keys(next).length ? "Hedefin kaydedildi ✓" : "Hedef kaldırıldı");
      refresh();
    } catch (err) {
      toast("Kaydedilemedi: " + (err as Error).message);
    }
  }

  if (editing) {
    return (
      <form className="goals" onSubmit={save}>
        <div className="goals-head"><b>{year} hedeflerin</b><span className="muted small">Bu yıl kaç tane bitirmek istiyorsun? Boş bırakılan tür hedefe girmez.</span></div>
        <div className="goal-inputs">
          {TYPE_KEYS.map((t) => (
            <label key={t}>{TYPES[t].plural}
              <input className="input" type="number" min={0} max={9999} inputMode="numeric" value={form[t] || ""} placeholder="–"
                onChange={(e) => setForm((f) => ({ ...f, [t]: e.target.value }))} />
            </label>
          ))}
        </div>
        <div className="actions">
          <button type="button" className="btn" onClick={() => setEditing(false)}>Vazgeç</button>
          <button className="btn primary">Kaydet</button>
        </div>
      </form>
    );
  }

  if (!set.length) {
    return (
      <div className="goals empty-goal">
        <span><b>{year} hedefin yok.</b> Bu yıl kaç oyun, film ya da albüm bitirmek istediğini yaz, ilerlemeni burada gör.</span>
        <span className="goal-acts"><Link className="link" href={`/wrap/${profile.username}`}>Yıl özeti →</Link><button className="btn primary" onClick={start}>Hedef koy</button></span>
      </div>
    );
  }

  return (
    <div className="goals">
      <div className="goals-head">
        <b>{year} hedefleri</b>
        {isMe && <button className="link" onClick={start}>Düzenle</button>}
        <Link className="link" href={`/wrap/${profile.username}`}>Yıl özeti →</Link>
      </div>
      {set.map(([t, n]) => {
        const d = doneOf(t);
        return (
          <div key={t} className={`goal ${d >= n ? "hit" : ""}`}>
            <span>{TYPES[t].plural}</span>
            <div className="bar"><i style={{ width: `${Math.min(100, (d / n) * 100)}%` }} /></div>
            <b>{d} / {n}{d >= n ? " ✓" : ""}</b>
          </div>
        );
      })}
    </div>
  );
}
