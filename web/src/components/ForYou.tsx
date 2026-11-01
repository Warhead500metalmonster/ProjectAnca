"use client";

import type { EntryType } from "@/lib/types";
import { tastePicks } from "@/lib/data";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { PickStrip } from "./FriendPicks";

// Keşfet'in üstünde: sana en uyumlu kişilerin çok sevdiği, senin kütüphanende olmayan şeyler
export function ForYou({ type }: { type: EntryType | "all" }) {
  const { me, mine, mineLoaded, blocked, version } = useApp();
  const { data } = useLoad(() => tastePicks(me!.id, mine, blocked).catch(() => []), [me?.id, mine.length, blocked.size, version], !!me && mineLoaded);
  const list = (data || []).filter(({ e }) => type === "all" || e.type === type);
  if (!list.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Senin zevkine göre <span className="muted small">· sana en uyumlu kişilerin sevdikleri</span></h2></div>
      <PickStrip data={list} />
    </section>
  );
}
