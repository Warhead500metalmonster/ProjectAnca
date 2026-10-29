/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import { TYPES } from "@/lib/constants";
import { contentHref, safeUrl, today } from "@/lib/format";
import { upcoming, whenText } from "@/lib/upcoming";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";

export default function CalendarPage() {
  const { me, ready, mine } = useApp();
  const [force, setForce] = useState(0);
  const { data, error } = useLoad(() => upcoming(me!.id, mine, force > 0), [me?.id, mine.length, force], !!me && mine.length > 0);

  if (ready && !me) return <div className="empty">Takvimini görmek için <Link href="/login">giriş yap</Link>.</div>;
  if (error) return <div className="empty">Takvim yüklenemedi: {error}</div>;

  const byId = new Map(mine.map((e) => [e.id, e]));
  const items = (data || []).filter((u) => byId.has(u.id));
  const days = [...new Set(items.map((u) => u.date))];

  return (
    <div className="calendar-page">
      <div className="section-head">
        <h1>Çıkış takvimi</h1>
        <button className="btn" disabled={!data} onClick={() => setForce((n) => n + 1)}>Yenile</button>
      </div>
      <p className="muted">Planladığın oyunların ve filmlerin çıkış günü, izlediğin dizilerin ve animelerin yeni bölümleri. Çıkış günü geldiğinde siteye girince sana haber veririz.</p>
      {!data && mine.length > 0 ? <div className="loading">Tarihler toplanıyor…</div>
        : !items.length ? (
          <div className="empty">
            Yakında çıkacak bir şey yok.<br />
            <span className="muted small">Bir oyunu ya da filmi <b>Planlandı</b> olarak eklersen, ya da izlediğin dizi ve animeleri <b>İzliyorum</b>&apos;a koyarsan tarihleri burada görünür.</span>
          </div>
        ) : days.map((d) => (
          <section key={d} className={`cal-day ${d === today() ? "today" : ""}`}>
            <h2>{whenText(d)}</h2>
            {items.filter((u) => u.date === d).map((u) => {
              const e = byId.get(u.id)!;
              return (
                <Link key={u.id + u.what} href={contentHref(e)} className="cal-row">
                  {safeUrl(e.cover) ? <img src={e.cover!} alt="" /> : <span className="noimg" />}
                  <span className="cal-name"><b>{e.title}</b><small>{TYPES[e.type].label} · {u.what}</small></span>
                </Link>
              );
            })}
          </section>
        ))}
    </div>
  );
}
