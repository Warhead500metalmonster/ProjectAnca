/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Entry, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { MONTHS_TR as MONTHS, fmtHoursShort, playSec, safeUrl, scoreText } from "@/lib/format";
import { shareImage as shareCard } from "@/lib/shareImage";
import { fetchEntries } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, displayName } from "@/components/ui";

// Spotify Wrapped gibi: bir yılın ya da bir ayın özeti (?m=2026-10), paylaşılabilir sayfa
export default function WrapPage() {
  const { username } = useParams<{ username: string }>();
  const params = useSearchParams();
  const router = useRouter();
  const { scale, toast } = useApp();
  const name = decodeURIComponent(username).toLowerCase();

  const { data, error } = useLoad(async () => {
    const profile = await q<Profile | null>(sb().from("profiles").select("*").eq("username", name).maybeSingle());
    return profile ? { profile, entries: await fetchEntries(profile.id) } : null;
  }, [name], supabaseConfigured());

  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (data === undefined) return <div className="loading">Yükleniyor…</div>;
  if (data === null) return <div className="empty">@{name} diye bir kullanıcı yok.</div>;

  const { profile, entries } = data;
  const finished = (e: Entry) => e.status === "completed" && !!e.date;
  const years = [...new Set(entries.filter(finished).map((e) => e.date!.slice(0, 4)))].sort().reverse();
  const rawMonth = params.get("m") || "";
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(rawMonth) ? rawMonth : null;
  const year = month ? month.slice(0, 4) : params.get("y") || String(new Date().getFullYear());
  const period = month || year;
  const label = month ? `${MONTHS[Number(month.slice(5)) - 1]} ${year}` : year;
  const noun = month ? "Ayın" : "Yılın";
  const done = entries.filter((e) => finished(e) && e.date!.startsWith(period));
  const reviewed = entries.filter((e) => e.notes?.trim() && e.updated_at.startsWith(period));
  const inYear = entries.filter((e) => finished(e) && e.date!.startsWith(year));
  const months = MONTHS.map((_, i) => `${year}-${String(i + 1).padStart(2, "0")}`).filter((k) => inYear.some((e) => e.date!.startsWith(k)));
  const secs = done.reduce((s, e) => s + playSec(e), 0);
  const top = [...done].filter((e) => e.rating).sort((a, b) => b.rating - a.rating || playSec(b) - playSec(a)).slice(0, 5);
  const longest = [...done].sort((a, b) => playSec(b) - playSec(a)).filter((e) => playSec(e) > 0).slice(0, 3);
  const perMonth = MONTHS.map((_, i) => done.filter((e) => Number(e.date!.slice(5, 7)) === i + 1).length);
  const busiest = perMonth.indexOf(Math.max(...perMonth));
  const byType = TYPE_KEYS.map((t) => [t, done.filter((e) => e.type === t).length] as const).filter(([, n]) => n);
  const sorted = [...done].sort((a, b) => a.date!.localeCompare(b.date!));
  const max = Math.max(1, ...perMonth);

  async function share() {
    const url = location.href;
    const text = `${displayName(profile)} ${month ? `${label} ayında` : `${year} yılında`} ${done.length} şey bitirdi. Ancalog özeti:`;
    try {
      if (navigator.share) await navigator.share({ title: "Ancalog özeti", text, url });
      else { await navigator.clipboard.writeText(url); toast("Bağlantı kopyalandı ✓"); }
    } catch { /* paylaşım penceresi kapatıldı */ }
  }

  const shareImage = () => shareCard(`/wrap/${profile.username}/image?${month ? `m=${month}` : `y=${year}`}`, `ancalog-${profile.username}-${period}.png`, `Ancalog ${label} özeti`, toast);

  return (
    <div className="wrap-page">
      <section className="wrap-hero">
        <Link href={`/u/${profile.username}`} className="wrap-who"><Avatar p={profile} /> <span>@{profile.username}</span></Link>
        <h1><span className="grad">{label}</span> özeti</h1>
        {years.length > 1 && (
          <div className="chips">
            {years.map((y) => <button key={y} className={`chip ${y === year ? "active" : ""}`} onClick={() => router.replace(`?y=${y}`, { scroll: false })}>{y}</button>)}
          </div>
        )}
        {months.length > 0 && (
          <div className="chips">
            <button className={`chip ${!month ? "active" : ""}`} onClick={() => router.replace(`?y=${year}`, { scroll: false })}>Bütün yıl</button>
            {months.map((k) => <button key={k} className={`chip ${k === month ? "active" : ""}`} onClick={() => router.replace(`?m=${k}`, { scroll: false })}>{MONTHS[Number(k.slice(5)) - 1]}</button>)}
          </div>
        )}
        <div className="actions">
          <button className="btn primary" onClick={share}>Paylaş</button>
          {done.length > 0 && <button className="btn" onClick={shareImage}>Görsel olarak paylaş</button>}
        </div>
      </section>

      {!done.length ? <div className="empty">{month ? `${label} ayında` : `${year} yılında`} bitirilen bir şey yok.</div> : (
        <>
          <section className="wrap-big">
            <div><b>{done.length}</b><span>bitirilen</span></div>
            {secs > 0 && <div><b>{fmtHoursShort(secs)}</b><span>toplam süre</span></div>}
            {reviewed.length > 0 && <div><b>{reviewed.length}</b><span>inceleme</span></div>}
            {!month && <div><b>{MONTHS[busiest]}</b><span>en yoğun ay</span></div>}
          </section>

          <section className="wrap-types">
            {byType.map(([t, n]) => <div key={t}><b>{n}</b><span>{TYPES[t].plural.toLocaleLowerCase("tr")}</span></div>)}
          </section>

          {top.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>{noun} favorileri</h2></div>
              <div className="wrap-top">
                {top.map((e, i) => (
                  <div key={e.id} className={`wrap-card ${i === 0 ? "first" : ""}`}>
                    <div className={`poster ${TYPES[e.type].square ? "square" : ""}`}>{safeUrl(e.cover) ? <img src={e.cover!} alt="" /> : <div className="ph">{TYPES[e.type].label}</div>}</div>
                    <b>{i + 1}. {e.title}</b>
                    <span className="muted small">★ {scoreText(Number(e.rating), scale)}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {!month && <section className="section">
            <div className="section-head"><h2>Aylara göre</h2></div>
            <div className="wrap-months">
              {perMonth.map((n, i) => (
                <div key={i} title={`${MONTHS[i]}: ${n}`}><i style={{ height: `${(n / max) * 100}%` }} /><span>{MONTHS[i].slice(0, 3)}</span></div>
              ))}
            </div>
          </section>}

          <section className="section wrap-facts">
            {longest.length > 0 && <div><span>En uzun süren</span><b>{longest[0].title}</b><small>{fmtHoursShort(playSec(longest[0]))}</small></div>}
            <div><span>{noun} ilki</span><b>{sorted[0].title}</b><small>{sorted[0].date}</small></div>
            <div><span>{noun} sonuncusu</span><b>{sorted[sorted.length - 1].title}</b><small>{sorted[sorted.length - 1].date}</small></div>
          </section>
        </>
      )}
    </div>
  );
}
