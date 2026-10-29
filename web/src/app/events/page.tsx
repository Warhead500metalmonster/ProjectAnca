"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { eventState, fetchEvents, memberStats } from "@/lib/events";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { EventCard, EventFeature } from "@/components/EventBanner";
import { EventForm } from "@/components/EventForm";

// Bütün etkinlikler: süren ve yaklaşanlar büyük vitrin olarak üstte, geçmişler arşivde. Yönetim buradan yeni etkinlik açar.
export default function EventsPage() {
  const { me, isAdmin, version } = useApp();
  const router = useRouter();
  const [creating, setCreating] = useState(false);
  const { data } = useLoad(async () => {
    const events = await fetchEvents();
    return { events, counts: await memberStats(events.map((e) => e.id), me?.id) };
  }, [version, me?.id]);

  const events = data?.events || [];
  // Önce sürenler, sonra en yakın başlayan
  const open = events.filter((e) => eventState(e) !== "ended")
    .sort((a, b) => (eventState(a) === "live" ? -1 : 0) - (eventState(b) === "live" ? -1 : 0) || a.starts_on.localeCompare(b.starts_on));
  const past = events.filter((e) => eventState(e) === "ended");

  return (
    <div className="ev-list-page">
      <section className="ev-list-head">
        <div>
          <h1>Etkinlikler</h1>
          <p className="muted">Aynı oyunu, filmi, diziyi hep birlikte oynuyor, izliyoruz. Bir etkinlik seç, sürümünü belirle, katıl. Acele yok, herkes kendi hızında.</p>
          <ol className="ev-steps-inline">
            <li><b>1</b> Etkinliğe gir</li>
            <li><b>2</b> Sürümünü seçip katıl</li>
            <li><b>3</b> Oynarken yaz, bitirince işaretle, rozetini kap</li>
          </ol>
        </div>
        {isAdmin && !creating && <button className="btn primary" onClick={() => setCreating(true)}>+ Yeni etkinlik</button>}
      </section>
      {creating && <EventForm onDone={(id) => { setCreating(false); if (id) router.push(`/events/${id}`); }} />}
      {!data ? <div className="loading">Yükleniyor…</div>
        : !events.length ? <div className="empty">Şu an etkinlik yok. Yakında burada olacak!</div>
        : (
          <>
            {open.length > 0 ? (
              <section className="section ev-feature-wrap">
                <div className="section-head"><h2>Şimdi ve yakında</h2></div>
                {open.map((e) => <EventFeature key={e.id} ev={e} stats={data.counts[e.id]} />)}
              </section>
            ) : <div className="empty">Şu an süren ya da yaklaşan etkinlik yok. Yenisi gelince burada olacak; aşağıdan geçmişlere bakabilirsin.</div>}
            {past.length > 0 && (
              <section className="section">
                <div className="section-head"><h2>Geçmiş etkinlikler</h2><span className="muted small">Arşiv: sonuçlar, katılanlar ve sohbet saklanır</span></div>
                <div className="ev-cards">{past.map((e) => <EventCard key={e.id} ev={e} stats={data.counts[e.id]} />)}</div>
              </section>
            )}
          </>
        )}
      {!me && <p className="muted ev-guest"><Link href="/signup">Ücretsiz katıl</Link>, etkinliklere sen de dahil ol.</p>}
    </div>
  );
}
