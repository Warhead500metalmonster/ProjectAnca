/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import type { Entry } from "@/lib/types";
import { TYPES } from "@/lib/constants";
import { contentHref, safeUrl } from "@/lib/format";
import { upcoming, whenText } from "@/lib/upcoming";
import { useLoad } from "@/lib/useLoad";

// Ana sayfada: yakında çıkacak ilk birkaç şey (tamamı Çıkış takvimi sayfasında)
export function UpcomingStrip({ userId, mine }: { userId: string; mine: Entry[] }) {
  const { data } = useLoad(() => upcoming(userId, mine).catch(() => []), [userId, mine.length], mine.length > 0);
  const byId = new Map(mine.map((e) => [e.id, e]));
  const items = (data || []).filter((u) => byId.has(u.id)).slice(0, 8);
  if (!items.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Yaklaşanlar</h2><Link href="/calendar">Takvim →</Link></div>
      <div className="home-upcoming">
        {items.map((u) => {
          const e = byId.get(u.id)!;
          return (
            <Link key={u.id + u.what} href={contentHref(e)} className="cal-row">
              {safeUrl(e.cover) ? <img src={e.cover!} alt="" /> : <span className="noimg" />}
              <span className="cal-name"><b>{e.title}</b><small>{whenText(u.date).split(" · ")[0]} · {u.what}</small><small>{TYPES[e.type].label}</small></span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
