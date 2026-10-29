/* eslint-disable @next/next/no-img-element */
"use client";

import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import type { Entry, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { fmtHoursShort, playSec, safeUrl, scoreText } from "@/lib/format";
import { fetchEntries } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, displayName } from "@/components/ui";

const MONTHS = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];

// Spotify Wrapped gibi: bir yılın özeti, paylaşılabilir sayfa
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
  const year = params.get("y") || String(new Date().getFullYear());
  const done = entries.filter((e) => finished(e) && e.date!.startsWith(year));
  const reviewed = entries.filter((e) => e.notes?.trim() && e.updated_at.startsWith(year));
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
    const text = `${displayName(profile)} ${year} yılında ${done.length} şey bitirdi. Ancalog özeti:`;
    try {
      if (navigator.share) await navigator.share({ title: "Ancalog yıl özeti", text, url });
      else { await navigator.clipboard.writeText(url); toast("Bağlantı kopyalandı ✓"); }
    } catch { /* paylaşım penceresi kapatıldı */ }
  }

  // Özet kartını resim olarak: telefonda paylaşım penceresi (Instagram, WhatsApp...), bilgisayarda indirme
  async function shareImage() {
    toast("Görsel hazırlanıyor…");
    try {
      const token = (await sb().auth.getSession()).data.session?.access_token;
      const r = await fetch(`/wrap/${profile.username}/image?y=${year}`, { headers: token ? { authorization: `Bearer ${token}` } : {} });
      if (!r.ok) throw new Error(String(r.status));
      const file = new File([await r.blob()], `ancalog-${profile.username}-${year}.png`, { type: "image/png" });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: `Ancalog ${year} özeti` }).catch(() => {});
        return;
      }
      const a = document.createElement("a");
      a.href = URL.createObjectURL(file);
      a.download = file.name;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
      toast("Görsel indirildi ✓");
    } catch {
      toast("Görsel hazırlanamadı, biraz sonra tekrar dene.");
    }
  }

  return (
    <div className="wrap-page">
      <section className="wrap-hero">
        <Link href={`/u/${profile.username}`} className="wrap-who"><Avatar p={profile} /> <span>@{profile.username}</span></Link>
        <h1><span className="grad">{year}</span> özeti</h1>
        {years.length > 1 && (
          <div className="chips">
            {years.map((y) => <button key={y} className={`chip ${y === year ? "active" : ""}`} onClick={() => router.replace(`?y=${y}`, { scroll: false })}>{y}</button>)}
          </div>
        )}
        <div className="actions">
          <button className="btn primary" onClick={share}>Paylaş</button>
          {done.length > 0 && <button className="btn" onClick={shareImage}>Görsel olarak paylaş</button>}
        </div>
      </section>

      {!done.length ? <div className="empty">{year} yılında bitirilen bir şey yok.</div> : (
        <>
          <section className="wrap-big">
            <div><b>{done.length}</b><span>bitirilen</span></div>
            {secs > 0 && <div><b>{fmtHoursShort(secs)}</b><span>toplam süre</span></div>}
            {reviewed.length > 0 && <div><b>{reviewed.length}</b><span>inceleme</span></div>}
            <div><b>{MONTHS[busiest]}</b><span>en yoğun ay</span></div>
          </section>

          <section className="wrap-types">
            {byType.map(([t, n]) => <div key={t}><b>{n}</b><span>{TYPES[t].plural.toLocaleLowerCase("tr")}</span></div>)}
          </section>

          {top.length > 0 && (
            <section className="section">
              <div className="section-head"><h2>Yılın favorileri</h2></div>
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

          <section className="section">
            <div className="section-head"><h2>Aylara göre</h2></div>
            <div className="wrap-months">
              {perMonth.map((n, i) => (
                <div key={i} title={`${MONTHS[i]}: ${n}`}><i style={{ height: `${(n / max) * 100}%` }} /><span>{MONTHS[i].slice(0, 3)}</span></div>
              ))}
            </div>
          </section>

          <section className="section wrap-facts">
            {longest.length > 0 && <div><span>En uzun süren</span><b>{longest[0].title}</b><small>{fmtHoursShort(playSec(longest[0]))}</small></div>}
            <div><span>Yılın ilki</span><b>{sorted[0].title}</b><small>{sorted[0].date}</small></div>
            <div><span>Yılın sonuncusu</span><b>{sorted[sorted.length - 1].title}</b><small>{sorted[sorted.length - 1].date}</small></div>
          </section>
        </>
      )}
    </div>
  );
}
