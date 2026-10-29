"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { PROFILE_COLS } from "@/lib/constants";
import { q, sb } from "@/lib/supabase";
import type { ProfileLite } from "@/lib/types";
import { Name } from "@/components/ui";
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
  const focus = useSearchParams().get("u"); // bir rozetten gelindiyse rozetin sahibi
  const { data: who } = useLoad(async () => {
    const [p, rows] = await Promise.all([
      q<ProfileLite | null>(sb().from("profiles").select(PROFILE_COLS).eq("id", focus!).maybeSingle()).catch(() => null),
      q<{ event_id: string }[]>(sb().from("event_members").select("event_id").eq("user_id", focus!)).catch(() => []),
    ]);
    return { p, ids: rows.map((r) => r.event_id) };
  }, [focus, version], !!focus);
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
      {who?.p && data && who.ids.length > 0 && (
        <section className="section">
          <div className="section-head"><h2><Name p={who.p} /> şu etkinliklere katıldı</h2><span className="muted small">Birine tıkla, sonucunu gör</span></div>
          <div className="ev-cards">{events.filter((e) => who.ids.includes(e.id)).map((e) => <EventCard key={e.id} ev={e} stats={data.counts[e.id]} focus={focus} />)}</div>
        </section>
      )}
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
