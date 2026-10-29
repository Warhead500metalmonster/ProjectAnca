"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { eventState, fetchEvents, memberCounts } from "@/lib/events";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { EventCard } from "@/components/EventBanner";
import { EventForm } from "@/components/EventForm";

// Bütün etkinlikler: sürenler, yaklaşanlar, bitenler. Yönetim buradan yeni etkinlik açar.
export default function EventsPage() {
  const { isAdmin, version } = useApp();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data } = useLoad(async () => {
    const events = await fetchEvents();
    return { events, counts: await memberCounts(events.map((e) => e.id)) };
  }, [version]);

  const events = data?.events || [];
  const groups = [
    ["live", "Şu an sürenler"],
    ["upcoming", "Yaklaşanlar"],
    ["ended", "Geçmiş etkinlikler"],
  ] as const;

  return (
    <div className="ev-list-page">
      <section className="search-hero">
        <h1>Etkinlikler</h1>
        <p className="muted" style={{ margin: 0 }}>Aynı oyunu, filmi, diziyi hep birlikte oynuyor, izliyoruz. Katıl, nerede olduğunu yaz, bitirince işaretle; acele yok, herkes kendi hızında.</p>
        {isAdmin && !creating && <button className="btn primary" onClick={() => setCreating(true)}>+ Yeni etkinlik</button>}
      </section>
      {creating && <EventForm onDone={(id) => { setCreating(false); if (id) router.push(`/events/${id}`); }} />}
      {!data ? <div className="loading">Yükleniyor…</div>
        : !events.length ? <div className="empty">Şu an etkinlik yok. Yakında burada olacak!</div>
        : groups.map(([state, name]) => {
          const list = events.filter((e) => eventState(e) === state);
          if (state === "upcoming") list.reverse(); // en yakını önce
          return list.length ? (
            <section key={state} className="section">
              <div className="section-head"><h2>{name}</h2></div>
              <div className="ev-cards">{list.map((e) => <EventCard key={e.id} ev={e} count={data.counts[e.id] || 0} />)}</div>
            </section>
          ) : null;
        })}
    </div>
  );
}
