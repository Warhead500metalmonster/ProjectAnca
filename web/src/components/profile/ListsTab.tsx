"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { List } from "@/lib/types";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";
import { ListCard } from "@/components/ListCard";
import { ListEditor } from "@/components/ListEditor";

export function ListsTab() {
  const { profile, isMe } = useProfile();
  const { version } = useApp();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  // Gizli listeleri veritabanı sadece sahibine gösterir
  const { data, error } = useLoad(() => q<List[]>(sb().from("lists").select("*, list_items(id, type, title, cover, rawg_id, position)")
    .eq("user_id", profile.id).order("updated_at", { ascending: false })), [profile.id, version]);

  return (
    <section className="section">
      <div className="section-head">
        <h2>Listeler</h2>
        {isMe && <button className="btn primary" onClick={() => setCreating(true)}>+ Yeni liste</button>}
      </div>
      {error ? <div className="empty">Bir şeyler ters gitti: {error}</div>
        : !data ? <div className="loading">Yükleniyor…</div>
        : data.length ? <div className="list-grid">{data.map((l) => <ListCard key={l.id} l={l} />)}</div>
        : <div className="empty">{isMe ? <>Henüz listen yok. Oyunları, filmleri istediğin gibi gruplayabilirsin; sonra hangilerini bitirdiğini görürsün.<br />
            <button className="btn primary" onClick={() => setCreating(true)}>+ İlk listeni oluştur</button></> : "Henüz açık listesi yok."}</div>}
      {creating && <ListEditor list={null} onClose={() => setCreating(false)} onSaved={(l) => l && router.push(`/list/${l.id}`)} />}
    </section>
  );
}
