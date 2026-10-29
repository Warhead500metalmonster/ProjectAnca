"use client";

import Link from "next/link";
import { type AncEvent, type EventMember, eventState } from "@/lib/events";
import { cssUrl, safeUrl } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";

const STATUS = { joined: "Katıldı", playing: "Oynuyor", done: "Bitirdi ✓" } as const;

// Profilde: katıldığı etkinlikler (sürenler önce, geçmişler arkada). Herkes görür.
export function ProfileEvents() {
  const { profile } = useProfile();
  const { version } = useApp();
  const { data } = useLoad(() => q<(EventMember & { events: AncEvent | null })[]>(sb().from("event_members")
    .select("*, events(id, title, cover, options, starts_on, ends_on, kind)").eq("user_id", profile.id).order("joined_at", { ascending: false }).limit(30))
    .catch(() => []), [profile.id, version]);
  const list = (data || []).filter((m) => m.events);
  if (!list.length || profile.home_layout?.events === false) return null; // sahibi gizlediyse görünmez
  const order = { live: 0, upcoming: 1, ended: 2 };
  list.sort((a, b) => order[eventState(a.events!)] - order[eventState(b.events!)]);
  return (
    <section className="section">
      <div className="section-head"><h2>Katıldığı etkinlikler</h2><Link className="link" href="/events">Bütün etkinlikler</Link></div>
      <div className="pev-list">
        {list.map((m) => {
          const ev = m.events!;
          const opt = ev.options?.find((o) => o.id === m.choice);
          const art = safeUrl(opt?.cover) || safeUrl(ev.cover);
          const state = eventState(ev);
          return (
            <Link key={ev.id} href={`/events/${ev.id}`} className={`pev ${m.status} ${state}`} style={art ? { backgroundImage: cssUrl(art) } : undefined}>
              <span className={`ev-pill ${m.status}`}>{STATUS[m.status]}</span>
              <span className="pev-main">
                <b>{ev.title}</b>
                <span>{[opt?.label, state === "ended" ? "Geçmiş etkinlik" : state === "upcoming" ? "Yakında" : "Sürüyor"].filter(Boolean).join(" · ")}</span>
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
