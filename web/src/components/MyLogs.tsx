"use client";

import type { Entry, Item } from "@/lib/types";
import { statusLabel } from "@/lib/constants";
import { useApp } from "./AppProvider";

// İçerik sayfasında kendi logların: her sefer ayrı düzenlenir, altından yeni bir log (replay) eklenir
export function MyLogs({ logs, item }: { logs: Entry[]; item: Item }) {
  const { me, openForm } = useApp();
  const own = logs.filter((l) => l.user_id === me?.id).sort((a, b) => a.created_at.localeCompare(b.created_at));
  return (
    <>
      {own.map((l, i) => (
        <button key={l.id} className={`btn wide ${i === 0 ? "primary" : ""}`} onClick={() => openForm(l)}>
          {own.length > 1 ? `${i + 1}. log · ` : ""}{statusLabel(l.status, l.type)}{l.replay ? " · Replay" : ""} · Düzenle
        </button>
      ))}
      <button className="btn wide" onClick={() => openForm(null, { item, replay: true })}>↻ Yeni log ekle (replay)</button>
    </>
  );
}
