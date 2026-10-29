"use client";

import Link from "next/link";
import type { Entry } from "@/lib/types";
import { BADGES } from "@/lib/constants";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";

// Profilin Rozetler sekmesi: kazanılanlar üstte, kalanlar ilerleme çubuğuyla altta
export function BadgesTab() {
  const { profile, entries, isMe } = useProfile();
  const { badges } = useApp();
  const mine = (badges.get(profile.id) || []).filter((b) => BADGES[b]);
  const locked = Object.keys(BADGES).filter((b) => !mine.includes(b) && BADGES[b].earn);
  const progressOf = (b: string) => {
    const { earn = 1, progress } = BADGES[b];
    return progress ? Math.min(earn, progress(entries)) : null;
  };
  // En yakın olanlar önce: insanlar hangisine az kaldığını görsün
  const ranked = [...locked].sort((a, b) => ((progressOf(b) ?? -1) / (BADGES[b].earn || 1)) - ((progressOf(a) ?? -1) / (BADGES[a].earn || 1)));
  const total = Object.values(BADGES).filter((b) => b.earn).length;
  const earned = mine.filter((b) => BADGES[b].earn).length;

  return (
    <section className="section badges-page">
      <div className="badges-head">
        <div><b>{mine.length}</b><span>rozet</span></div>
        <div className="bar"><i style={{ width: `${(earned / total) * 100}%` }} /></div>
        <span className="muted small">{earned} / {total} kazanılabilir rozet açıldı</span>
      </div>

      {mine.length > 0 && (
        <>
          <h3 className="set-h">Kazanılanlar</h3>
          <div className="badge-grid">
            {mine.map((b) => {
              const inner = <><span className="b-icon">{BADGES[b].icon}</span><b>{BADGES[b].name}</b><small>{BADGES[b].desc}</small></>;
              // Etkinlik rozetleri etkinliğin sayfasına (biten etkinlikte arşive) götürür, rozetin sahibi orada öne çıkar
              return BADGES[b].href
                ? <Link key={b} href={`${BADGES[b].href}?u=${profile.id}`} className={`badge-card got ${BADGES[b].tone} link-card`}>{inner}<small className="b-go">Etkinliğe git →</small></Link>
                : <div key={b} className={`badge-card got ${BADGES[b].tone}`}>{inner}</div>;
            })}
          </div>
        </>
      )}

      {ranked.length > 0 && (
        <>
          <h3 className="set-h">{isMe ? "Sıradaki rozetlerin" : "Henüz kazanılmayanlar"}</h3>
          <div className="badge-grid">
            {ranked.map((b) => {
              const { icon, name, desc, earn = 1 } = BADGES[b];
              const n = progressOf(b);
              return (
                <div key={b} className="badge-card">
                  <span className="b-icon">{icon}</span>
                  <b>{name}</b>
                  <small>{desc}</small>
                  {n !== null && (
                    <>
                      <div className="bar"><i style={{ width: `${(n / earn) * 100}%` }} /></div>
                      <small className="b-left">{n >= earn ? "Birazdan gelecek!" : `${(earn - n).toLocaleString("tr")} kaldı`}</small>
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </section>
  );
}

// Ana sayfadaki "sıradaki rozetin" kartı: en az kalan iki rozet, insanları devam etmeye teşvik eder
export function NextBadges({ userId, username, entries }: { userId: string; username: string; entries: Entry[] }) {
  const { badges } = useApp();
  const mine = badges.get(userId) || [];
  const next = Object.keys(BADGES)
    .filter((b) => !mine.includes(b) && BADGES[b].progress)
    .map((b) => ({ b, n: Math.min(BADGES[b].earn || 1, BADGES[b].progress!(entries)), earn: BADGES[b].earn || 1 }))
    .filter((x) => x.n < x.earn) // tamamlananlar zaten birazdan gelir; "0 kaldı" yazmasın
    .sort((x, y) => y.n / y.earn - x.n / x.earn)
    .slice(0, 2);
  if (!next.length) return null;
  return (
    <div className="next-badges">
      <div className="goals-head"><b>Sıradaki rozetlerin</b><Link className="link" href={`/u/${username}/badges`}>Tüm rozetler →</Link></div>
      {next.map(({ b, n, earn }) => (
        <div key={b} className="goal">
          <span title={BADGES[b].desc}>{BADGES[b].name}</span>
          <div className="bar"><i style={{ width: `${(n / earn) * 100}%` }} /></div>
          <b>{(earn - n).toLocaleString("tr")} kaldı</b>
        </div>
      ))}
      <small className="muted">{next.map(({ b }) => BADGES[b].desc).join(" · ")}</small>
    </div>
  );
}
