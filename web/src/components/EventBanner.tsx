/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { type AncEvent, type EventStats, dateLine, eventState, fetchEvents, memberStats } from "@/lib/events";
import { cssUrl, safeUrl, today } from "@/lib/format";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "./AppProvider";
import { Avatar } from "./ui";

const art = (ev: AncEvent) => safeUrl(ev.cover) || safeUrl(ev.options[0]?.cover);
const stateName = { upcoming: "Yakında", live: "Şu an sürüyor", ended: "Arşivde" } as const;

// Başlamasına ne kadar kaldı: "5 gün 23 saat" (dakikada bir tazelenir)
export function useLeft(date: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(date + "T00:00").getTime() - now);
  return { d: Math.floor(ms / 86400000), h: Math.floor(ms / 3600000) % 24, m: Math.floor(ms / 60000) % 60 };
}
function LeftText({ date }: { date: string }) {
  const { d, h, m } = useLeft(date);
  return <>{d ? `${d} gün ${h} saat` : h ? `${h} saat ${m} dakika` : `${m} dakika`} sonra başlıyor</>;
}

// Etkinlik kartı (liste ve arşiv): kapak, durum, tarih, katılanların yüzleri; geçmişte sonuç özeti
export function EventCard({ ev, stats }: { ev: AncEvent; stats?: EventStats }) {
  const state = eventState(ev);
  const a = art(ev);
  const n = stats?.n || 0, done = stats?.done || 0;
  return (
    <Link href={`/events/${ev.id}`} className={`ev-card ${state}`} style={a ? { backgroundImage: cssUrl(a) } : undefined}>
      <div className="ev-card-in">
        <span className={`ev-state ${state}`}>{stateName[state]}</span>
        <b>{ev.title}</b>
        <span className="ev-card-date">{state === "upcoming" && ev.starts_on > today() ? <LeftText date={ev.starts_on} /> : dateLine(ev)}</span>
        <span className="ev-card-foot">
          {stats?.faces.length ? <span className="ev-faces">{stats.faces.slice(0, 5).map((p) => <Avatar key={p.id} p={p} />)}</span> : null}
          {state === "ended"
            ? n ? `${n} kişi katıldı · ${done} kişi bitirdi` : "Kimse katılmadı"
            : n ? `${n} kişi katıldı${done ? ` · ${done} bitirdi` : ""}` : "İlk katılan sen ol"}
          {ev.options.length > 1 && state !== "ended" ? ` · ${ev.options.length} sürüm` : ""}
        </span>
        {stats?.mine && <span className="ev-card-mine">✓ Katıldın</span>}
      </div>
    </Link>
  );
}

// Ana sayfa ve Topluluk: öne çıkan etkinlik büyük vitrin olarak, varsa diğerleri küçük kart
export function EventBanner() {
  const { me, version } = useApp();
  const { data } = useLoad(async () => {
    const events = (await fetchEvents()).filter((e) => eventState(e) !== "ended")
      .sort((a, b) => (eventState(a) === "live" ? -1 : 0) - (eventState(b) === "live" ? -1 : 0) || a.starts_on.localeCompare(b.starts_on)).slice(0, 3);
    return { events, stats: await memberStats(events.map((e) => e.id), me?.id) };
  }, [version, me?.id]);
  if (!data?.events.length) return null;
  const [top, ...rest] = data.events;
  return (
    <section className="section ev-feature-wrap">
      <EventFeature ev={top} stats={data.stats[top.id]} />
      {rest.length > 0 && <div className="ev-cards">{rest.map((e) => <EventCard key={e.id} ev={e} stats={data.stats[e.id]} />)}</div>}
    </section>
  );
}

function EventFeature({ ev, stats }: { ev: AncEvent; stats?: EventStats }) {
  const state = eventState(ev);
  const a = art(ev);
  const covers = ev.options.map((o) => safeUrl(o.cover)).filter(Boolean).slice(0, 3);
  const { d, h, m } = useLeft(ev.starts_on);
  return (
    <Link href={`/events/${ev.id}`} className="ev-feature">
      <div className="ev-feature-bg" style={a ? { backgroundImage: cssUrl(a) } : undefined} aria-hidden="true" />
      <div className="ev-feature-in">
        <div className="ev-feature-text">
          <div className="ev-kicker"><span>✦ Ancalog etkinliği</span><span className={`ev-state ${state}`}>{stateName[state]}</span></div>
          <h2>{ev.title}</h2>
          {ev.options.length > 1 && <p className="ev-feature-opts">{ev.options.map((o) => o.label).join(" · ")}: hangisini istersen</p>}
          {state === "upcoming" ? (
            <div className="ev-count small"><div><b>{d}</b><span>gün</span></div><div><b>{h}</b><span>saat</span></div><div><b>{m}</b><span>dakika</span></div></div>
          ) : <p className="ev-date">{dateLine(ev)}</p>}
          <div className="ev-feature-foot">
            <span className="btn primary ev-cta">{stats?.mine ? "✓ Katıldın · Etkinliğe git" : "Katıl"}</span>
            <span className="ev-crowd">
              {stats?.faces.length ? <span className="ev-faces">{stats.faces.slice(0, 5).map((p) => <Avatar key={p.id} p={p} />)}</span> : null}
              <span>{stats?.n ? <><b>{stats.n}</b> kişi katıldı</> : "İlk katılan sen ol!"}</span>
            </span>
          </div>
        </div>
        {covers.length > 0 && (
          <div className={`ev-fan n${covers.length}`} aria-hidden="true">
            {covers.map((c, i) => <img key={i} src={c} alt="" style={{ "--i": i - (covers.length - 1) / 2 } as React.CSSProperties} />)}
          </div>
        )}
      </div>
    </Link>
  );
}
