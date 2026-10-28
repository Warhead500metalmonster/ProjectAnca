"use client";

import Link from "next/link";
import type { List } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { Cover } from "./ui";

// Liste kartı: ilk dört kapaktan kolaj, ad, içerik sayısı
export function ListCard({ l, owner = false }: { l: List; owner?: boolean }) {
  const items = [...(l.list_items || [])].sort((a, b) => a.position - b.position);
  return (
    <Link className="list-card" href={`/list/${l.id}`}>
      <div className="collage">
        {Array.from({ length: 4 }, (_, i) => items[i]).map((it, i) => (
          <div key={i} className="cell">{it ? <><span className="ph">{TYPES[it.type].label}</span><Cover src={it.cover} /></> : null}</div>
        ))}
      </div>
      <div className="list-card-body">
        <b>{l.title}</b>
        <span className="muted">
          {items.length} içerik{l.is_public ? "" : " · gizli"}
          {owner && l.profiles?.username ? ` · @${l.profiles.username}` : ""}
        </span>
      </div>
    </Link>
  );
}
