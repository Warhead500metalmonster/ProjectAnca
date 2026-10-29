"use client";

import { useState } from "react";
import type { Entry, EntryType, Status } from "@/lib/types";
import { TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { avgText, daysTaken, fmtDate, fmtDur, fmtHoursShort, num, playSec, scoreText } from "@/lib/format";
import { useApp } from "@/components/AppProvider";
import { useProfile } from "@/components/ProfileShell";
import { Cover, commentCount, likeCount } from "@/components/ui";
import { Goals } from "@/components/Goals";

// Durum renkleri: renk körlüğü için doğrulanmış sırayla (yan yana duran dilimler ayırt edilebilsin)
const STATUS_ORDER: Status[] = ["active", "dropped", "completed", "paused", "planned", "owned"];
const STATUS_COLORS: Record<Status, string> = { active: "#3987e5", dropped: "#d95926", completed: "#199e70", paused: "#c98500", planned: "#d55181", owned: "#5b6270" };
const MONTHS = ["Oca", "Şub", "Mar", "Nis", "May", "Haz", "Tem", "Ağu", "Eyl", "Eki", "Kas", "Ara"];

function countBy<T>(list: T[], key: (x: T) => string | null | undefined) {
  const m = new Map<string, number>();
  for (const x of list) { const k = key(x); if (k) m.set(k, (m.get(k) || 0) + 1); }
  return [...m.entries()].sort((a, b) => b[1] - a[1]);
}

export function StatsTab() {
  const { entries, profile, isMe } = useProfile();
  const { scale, openView } = useApp();
  const [type, setType] = useState<EntryType | "all">("all");
  const [year, setYear] = useState("");       // çıkış yılı
  const [finish, setFinish] = useState("");   // bitirme yılı

  const scoped = entries.filter((e) => (type === "all" || e.type === type));
  const years = [...new Set(scoped.map((e) => e.year).filter(Boolean))].sort((a, b) => b! - a!) as number[];
  const finishYears = [...new Set(scoped.filter((e) => e.status === "completed" && e.date).map((e) => e.date!.slice(0, 4)))].sort().reverse();
  const list = scoped.filter((e) => (!year || String(e.year) === year) && (!finish || (e.status === "completed" && e.date?.startsWith(finish))));

  const done = list.filter((e) => e.status === "completed");
  const rated = list.filter((e) => e.rating > 0);
  const avg = rated.length ? rated.reduce((s, e) => s + Number(e.rating), 0) / rated.length : 0;
  const secs = list.reduce((s, e) => s + playSec(e), 0);
  const timed = done.map(daysTaken).filter((d): d is number => d !== null);
  const avgDays = timed.length ? timed.reduce((a, b) => a + b, 0) / timed.length : 0;

  // Bitirilenler: bir yıl seçiliyse aylara, değilse yıllara göre
  const timeline: [string, number][] = finish
    ? MONTHS.map((m, i) => [m, done.filter((e) => Number(e.date!.slice(5, 7)) === i + 1).length])
    : (() => {
      const ys = done.map((e) => Number(e.date?.slice(0, 4))).filter(Boolean);
      if (!ys.length) return [];
      const out: [string, number][] = [];
      for (let y = Math.min(...ys); y <= Math.max(...ys); y++) out.push([String(y), ys.filter((x) => x === y).length]);
      return out;
    })();

  // Puan dağılımı: 5'likte yarım yıldızlar, 10'lukta tam sayılar
  const bins: [string, number][] = scale === 10
    ? Array.from({ length: 10 }, (_, i) => [String(i + 1), rated.filter((e) => Math.ceil(Number(e.rating)) === i + 1).length])
    : Array.from({ length: 10 }, (_, i) => [num((i + 1) / 2), rated.filter((e) => Math.round(Number(e.rating)) === i + 1).length]);

  const decades = countBy(list, (e) => (e.year ? `${Math.floor(e.year / 10) * 10}'lar` : null)).sort((a, b) => a[0].localeCompare(b[0]));
  const best = [...rated].sort((a, b) => b.rating - a.rating)[0];
  const longest = [...list].sort((a, b) => playSec(b) - playSec(a))[0];
  const fastest = [...done].filter((e) => daysTaken(e) !== null).sort((a, b) => daysTaken(a)! - daysTaken(b)!)[0];
  const oldest = [...list].filter((e) => e.year).sort((a, b) => a.year! - b.year!)[0];
  const latest = [...done].filter((e) => e.date).sort((a, b) => b.date!.localeCompare(a.date!))[0];
  // Tersleri ve diğerleri
  const worst = [...rated].sort((a, b) => a.rating - b.rating)[0];
  const shortest = [...list].filter((e) => playSec(e) > 0).sort((a, b) => playSec(a) - playSec(b))[0];
  const slowest = [...done].filter((e) => daysTaken(e) !== null).sort((a, b) => daysTaken(b)! - daysTaken(a)!)[0];
  const newest = [...list].filter((e) => e.year).sort((a, b) => b.year! - a.year!)[0];
  const first = [...done].filter((e) => e.date).sort((a, b) => a.date!.localeCompare(b.date!))[0];
  const waiting = [...list].filter((e) => e.status === "planned").sort((a, b) => a.created_at.localeCompare(b.created_at))[0];
  const liked = [...list].filter((e) => likeCount(e) > 0).sort((a, b) => likeCount(b) - likeCount(a))[0];
  const talked = [...list].filter((e) => commentCount(e) > 0).sort((a, b) => commentCount(b) - commentCount(a))[0];
  const longReview = [...list].filter((e) => e.notes?.trim()).sort((a, b) => b.notes!.length - a.notes!.length)[0];

  const scope = [type !== "all" && TYPES[type].plural, year && `${year} çıkışlı`, finish && `${finish} yılında bitirilen`].filter(Boolean).join(" · ") || "Tüm zamanlar";

  return (
    <section className="section stats-page">
      <Goals profile={profile} entries={entries} isMe={isMe} />
      <div className="tabs">
        {([["all", "", "Tümü"], ...TYPE_KEYS.map((k) => [k, "", TYPES[k].label])] as [EntryType | "all", string, string][]).map(([k, icon, label]) => (
          <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setYear(""); setFinish(""); }}>{icon} {label}</button>
        ))}
      </div>
      <div className="filters">
        <select value={year} onChange={(e) => setYear(e.target.value)} aria-label="Çıkış yılı">
          <option value="">Çıkış yılı: hepsi</option>
          {years.map((y) => <option key={y} value={y}>{y} çıkışlı içerikler</option>)}
        </select>
        <select value={finish} onChange={(e) => setFinish(e.target.value)} aria-label="Bitirme yılı">
          <option value="">Bitirme yılı: tüm zamanlar</option>
          {finishYears.map((y) => <option key={y} value={y}>{y} yılında bitirdiklerim</option>)}
        </select>
        {(year || finish) && <button className="link" onClick={() => { setYear(""); setFinish(""); }}>Temizle</button>}
      </div>

      <div className="stats-hero">
        <div>
          <span className="muted">{profile.display_name || profile.username} · {scope}</span>
          <h2>{list.length ? `${list.length} içerik, ${done.length} tanesi bitti` : "Bu seçimde kayıt yok"}</h2>
        </div>
      </div>

      {list.length > 0 && (
        <>
          <div className="stats">
            {([
              [list.length, "Toplam kayıt"],
              [done.length, "Bitirilen"],
              [`%${Math.round((done.length / list.length) * 100)}`, "Tamamlama oranı"],
              [secs ? fmtHoursShort(secs) : "–", "Toplam süre"],
              [avg ? avgText(avg, scale) : "–", "Ortalama puan"],
              [avgDays ? `${num(avgDays)} gün` : "–", "Ortalama bitirme süresi"],
              [list.filter((e) => e.notes).length, "İnceleme"],
              [list.filter((e) => e.favorite).length, "Favori"],
            ] as [string | number, string][]).map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}
          </div>

          <div className="chart-card">
            <h3>Durumlar</h3>
            <div className="stack" role="img" aria-label="Durumlara göre dağılım">
              {STATUS_ORDER.map((s) => {
                const n = list.filter((e) => e.status === s).length;
                return n ? <span key={s} style={{ flex: n, background: STATUS_COLORS[s] }} title={`${statusLabel(s)}: ${n}`} /> : null;
              })}
            </div>
            <div className="legend">
              {STATUS_ORDER.map((s) => {
                const n = list.filter((e) => e.status === s).length;
                return n ? <span key={s}><i style={{ background: STATUS_COLORS[s] }} />{statusLabel(s, type === "all" ? null : type)} <b>{n}</b> <small>%{Math.round((n / list.length) * 100)}</small></span> : null;
              })}
            </div>
          </div>

          <div className="chart-grid">
            {timeline.length > 0 && <Columns title={finish ? `${finish} yılında aylara göre bitirilenler` : "Yıllara göre bitirilenler"} data={timeline} />}
            {rated.length > 0 && <Columns title={`Puan dağılımı (${scale} üzerinden)`} data={bins} />}
            {type === "all" && <Bars title="Türler" data={TYPE_KEYS.map((k) => [TYPES[k].label, list.filter((e) => e.type === k).length] as [string, number]).filter(([, n]) => n).sort((a, b) => b[1] - a[1])} />}
            <Bars title="Platform / nerede" data={countBy(list, (e) => e.platform).slice(0, 8)} />
            {(type === "all" || type === "game") && <Bars title="Mağazalar" data={countBy(list, (e) => e.store).slice(0, 8)} />}
            <Bars title="En çok kimden" data={countBy(list, (e) => e.creator?.split(",")[0].trim()).slice(0, 8)} />
            <Bars title="Çıkış dönemine göre" data={decades} />
          </div>

          <div className="section-head" style={{ marginTop: 28 }}><h2>Rekorlar</h2></div>
          <div className="records">
            {([
              ["En yüksek puan", best, best && scoreText(Number(best.rating), scale)],
              ["En düşük puan", worst !== best ? worst : undefined, worst && scoreText(Number(worst.rating), scale)],
              ["En uzun süre", longest && playSec(longest) ? longest : undefined, longest && fmtDur(playSec(longest))],
              ["En kısa süre", shortest !== longest ? shortest : undefined, shortest && fmtDur(playSec(shortest))],
              ["En hızlı bitirilen", fastest, fastest && `${daysTaken(fastest)} günde`],
              ["En yavaş bitirilen", slowest !== fastest ? slowest : undefined, slowest && `${daysTaken(slowest)} günde`],
              ["En eski içerik", oldest, oldest?.year],
              ["En yeni içerik", newest !== oldest ? newest : undefined, newest?.year],
              ["İlk bitirilen", first !== latest ? first : undefined, first?.date && fmtDate(first.date)],
              ["En son bitirilen", latest, latest?.date && fmtDate(latest.date)],
              ["En uzun süredir bekleyen", waiting, waiting && `${fmtDate(waiting.created_at.slice(0, 10))} tarihinden beri planda`],
              ["En çok beğenilen", liked, liked && `${likeCount(liked)} beğeni`],
              ["En çok yorum alan", talked, talked && `${commentCount(talked)} yorum`],
              ["En uzun inceleme", longReview, longReview && `${longReview.notes!.trim().split(/\s+/).length} kelime`],
            ] as [string, Entry | undefined, string | number | undefined][]).filter(([, e]) => e).map(([label, e, val]) => (
              <button key={label} className="record" onClick={() => openView(e!)}>
                <div className={`poster ${TYPES[e!.type].square ? "square" : ""}`}><div className="ph">{TYPES[e!.type].label}</div><Cover src={e!.cover} /></div>
                <div><span className="muted">{label}</span><b>{e!.title}</b><span>{val}</span></div>
              </button>
            ))}
          </div>
        </>
      )}

    </section>
  );
}

// Dikey sütun grafiği (tek seri, tek renk); değer üzerine gelince görünür
function Columns({ title, data }: { title: string; data: [string, number][] }) {
  const max = Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="cols-chart" style={{ gridTemplateColumns: `repeat(${data.length}, 1fr)` }}>
        {data.map(([k, n]) => (
          <div key={k} className="col" title={`${k}: ${n}`}>
            <span className="v">{n || ""}</span>
            <span className="bar" style={{ height: `${(n / max) * 100}%` }} />
            <span className="k">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Yatay çubuklar: etiket solda, değer sağda
function Bars({ title, data }: { title: string; data: [string, number][] }) {
  if (!data.length) return null;
  const max = Math.max(1, ...data.map(([, n]) => n));
  return (
    <div className="chart-card">
      <h3>{title}</h3>
      <div className="hbars">
        {data.map(([k, n]) => (
          <div key={k} className="hbar" title={`${k}: ${n}`}>
            <span className="k">{k}</span>
            <span className="track"><span className="bar" style={{ width: `${(n / max) * 100}%` }} /></span>
            <b>{n}</b>
          </div>
        ))}
      </div>
    </div>
  );
}
