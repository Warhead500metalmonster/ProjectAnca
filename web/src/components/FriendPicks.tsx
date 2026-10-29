"use client";

import Link from "next/link";
import type { Entry } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentHref, itemOf, scoreShort } from "@/lib/format";
import { friendPicks } from "@/lib/data";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar, Cover, displayName } from "./ui";

// Ana sayfada: arkadaşlarının çok sevdiği (9+), senin henüz kütüphanende olmayan şeyler
export function FriendPicks({ following, mine }: { following: string[]; mine: Entry[] }) {
  const { openForm, scale, version } = useApp();
  const { data } = useLoad(() => friendPicks(following, mine).catch(() => []), [following.join(","), mine.length, version], following.length > 0);
  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Arkadaşların öneriyor <span className="muted small">· çok sevdikleri, sende olmayanlar</span></h2></div>
      <div className="strip">
        {data.map(({ e, by }) => {
          const t = TYPES[e.type];
          const top = by[0];
          return (
            <div key={e.id} className="card pick">
              <div className={`poster ${t.square ? "square" : ""}`}>
                <Link href={contentHref(e)} className="pick-link" aria-label={e.title}>
                  <div className="ph">{t.label}</div>
                  <Cover src={e.cover} />
                </Link>
                <span className="kind">{t.label}</span>
                <button className="pick-add" title="Kütüphaneme ekle" aria-label="Kütüphaneme ekle"
                  onClick={(ev) => { ev.preventDefault(); openForm(null, { item: itemOf(e) }); }}>＋</button>
              </div>
              <Link href={contentHref(e)} className="card-title">{e.title}</Link>
              <div className="pick-by">
                <span className="pick-faces">{by.slice(0, 3).map((x) => <Avatar key={x.id} p={x.profiles} />)}</span>
                <span>{by.length > 1 ? `${displayName(top.profiles)} +${by.length - 1}` : displayName(top.profiles)} · ★ {scoreShort(top.rating || 0, scale)}</span>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
