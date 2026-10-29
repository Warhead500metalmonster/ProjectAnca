"use client";

import Link from "next/link";
import { type AncEvent, dateLine, eventState, fetchEvents, memberCounts } from "@/lib/events";
import { cssUrl, safeUrl } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";

// Etkinlik kartı: kapak, durum, tarih, kaç kişi katıldı
export function EventCard({ ev, count }: { ev: AncEvent; count: number }) {
  const state = eventState(ev);
  const art = safeUrl(ev.cover) || safeUrl(ev.options[0]?.cover);
  return (
    <Link href={`/events/${ev.id}`} className={`ev-card ${state}`} style={art ? { backgroundImage: cssUrl(art) } : undefined}>
      <div className="ev-card-in">
        <span className={`ev-state ${state}`}>{state === "upcoming" ? "Yakında" : state === "live" ? "Sürüyor" : "Bitti"}</span>
        <b>{ev.title}</b>
        <span className="ev-card-date">{dateLine(ev)}</span>
        <span className="ev-card-foot">{count ? `${count} kişi katıldı` : "İlk katılan sen ol"}{ev.options.length > 1 ? ` · ${ev.options.length} sürüm` : ""}</span>
      </div>
    </Link>
  );
}

// Ana sayfa ve Topluluk: süren ya da yaklaşan etkinlikler (yoksa hiçbir şey çizmez)
export function EventBanner() {
  const { version } = useApp();
  const { data } = useLoad(async () => {
    const events = (await fetchEvents()).filter((e) => eventState(e) !== "ended").sort((a, b) => a.starts_on.localeCompare(b.starts_on)).slice(0, 2);
    return { events, counts: await memberCounts(events.map((e) => e.id)) };
  }, [version]);
  if (!data?.events.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Etkinlik</h2><Link href="/events">Bütün etkinlikler →</Link></div>
      <div className="ev-cards">{data.events.map((e) => <EventCard key={e.id} ev={e} count={data.counts[e.id] || 0} />)}</div>
    </section>
  );
}
