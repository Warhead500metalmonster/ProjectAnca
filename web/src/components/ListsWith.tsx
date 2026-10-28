"use client";

import type { EntryType, List } from "@/lib/types";
import { PROFILE_COLS } from "@/lib/constants";
import { likeEsc } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { ListCard } from "./ListCard";

// İçerik sayfasında: bu oyunun / filmin geçtiği herkese açık listeler
export function ListsWith({ rawgId, type, title, ext }: { rawgId?: number; type?: EntryType; title?: string; ext?: string | null }) {
  const { version } = useApp();
  const { data } = useLoad(async () => {
    const found = await Promise.all([
      rawgId ? q<{ list_id: string }[]>(sb().from("list_items").select("list_id").eq("rawg_id", rawgId).limit(500)) : Promise.resolve([]),
      !rawgId && type && title ? q<{ list_id: string }[]>(sb().from("list_items").select("list_id").eq("type", type).ilike("title", likeEsc(title)).limit(500)) : Promise.resolve([]),
      !rawgId && ext ? q<{ list_id: string }[]>(sb().from("list_items").select("list_id").eq("ext_id", ext).limit(500)) : Promise.resolve([]),
    ]);
    const ids = [...new Set(found.flat().map((x) => x.list_id))];
    if (!ids.length) return [];
    return q<List[]>(sb().from("lists").select(`*, profiles(${PROFILE_COLS}), list_items(id, type, title, cover, rawg_id, position)`)
      .in("id", ids.slice(0, 200)).eq("is_public", true).order("updated_at", { ascending: false }).limit(12));
  }, [rawgId, type, title, ext, version]);

  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Yer aldığı listeler</h2><span className="muted">{data.length}{data.length === 12 ? "+" : ""}</span></div>
      <div className="list-grid">{data.map((l) => <ListCard key={l.id} l={l} owner />)}</div>
    </section>
  );
}
