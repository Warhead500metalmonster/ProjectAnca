/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { AvatarCrop, Entry, Profile } from "@/lib/types";
import { BADGES, SOCIALS, TYPES, activityVerb, statusLabel } from "@/lib/constants";
import { daysTaken, fmtDur, fmtHoursShort, num, playSec, safeUrl, scoreShort, scoreText, timeAgo, avgText, today } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import { useApp } from "./AppProvider";

type Who = Partial<Pick<Profile, "id" | "username" | "display_name" | "avatar_url">> | null | undefined;
export const displayName = (p: Who) => p?.display_name || p?.username || "?";

export function Avatar({ p, cls = "" }: { p: Who; cls?: string }) {
  const { badges } = useApp();
  const crown = p?.id && badges.get(p.id)?.includes("owner") ? " crown" : "";
  const url = safeUrl(p?.avatar_url);
  const c = (p as { avatar_crop?: AvatarCrop | null } | null | undefined)?.avatar_crop;
  // Kırpılmışsa: kutu sabit, içindeki resim seçilen noktaya göre kaydırılıp büyütülür
  if (url && c && (c.z > 1 || c.x !== 50 || c.y !== 50)) {
    return (
      <span className={`avatar ${cls}${crown} cropped`}>
        <img src={url} alt="" style={{ objectPosition: `${c.x}% ${c.y}%`, transform: `scale(${c.z})`, transformOrigin: `${c.x}% ${c.y}%` }} />
      </span>
    );
  }
  if (url) return <img className={`avatar ${cls}${crown}`} src={url} alt="" />;
  let h = 0;
  for (const c of p?.username || "") h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className={`avatar ${cls}${crown}`} style={{ background: `linear-gradient(135deg,hsl(${h} 70% 55%),hsl(${(h + 50) % 360} 70% 40%))` }}>
      {[...displayName(p)][0].toLocaleUpperCase("tr")}
    </span>
  );
}

// İsim + kazanılmış rozetlerin küçük simgeleri (site sahibi, öncü)
// Rozetler ismin yanında gösterilmez; profilde kendi sekmesinde durur
export function Name({ p }: { p: Who }) {
  return <>{displayName(p)}</>;
}

// entries verilirse kazanılmamış rozetlerde ilerleme gösterilir (ör. Eleştirmen 4/10)
export function BadgeChips({ id, showLocked = false, entries, max, more }: { id: string; showLocked?: boolean; entries?: Entry[]; max?: number; more?: string }) {
  const { badges } = useApp();
  const all = (badges.get(id) || []).filter((b) => BADGES[b]);
  const mine = max ? all.slice(0, max) : all;
  const locked = Object.keys(BADGES).filter((b) => !mine.includes(b) && BADGES[b].earn);
  if (!mine.length && !showLocked) return null;
  return (
    <div className="badge-row">
      {mine.map((b) => (
        BADGES[b].href
          ? <Link key={b} href={`${BADGES[b].href}?u=${id}`} className={`bdg ${BADGES[b].tone} link-bdg`} title={`${BADGES[b].desc} · tıkla, etkinliğe git`}>{BADGES[b].icon} {BADGES[b].name}</Link>
          : <span key={b} className={`bdg ${BADGES[b].tone}`} title={BADGES[b].desc}>{BADGES[b].icon} {BADGES[b].name}</span>
      ))}
      {more && <Link className="bdg more" href={more}>{all.length > mine.length ? `+${all.length - mine.length} rozet` : "Rozetler"} →</Link>}
      {showLocked && locked.length > 0 && (
        <details className="locked">
          <summary>Kazanabileceğin rozetler ({locked.length})</summary>
          <div className="badge-goals">
            {locked.map((b) => {
              const { icon, name, desc, earn = 1, progress } = BADGES[b];
              const n = entries && progress ? Math.min(earn, progress(entries)) : null;
              return (
                <div key={b} className="badge-goal">
                  <span className="bdg off">{icon} {name}</span>
                  <small>{desc}{n !== null ? ` · ${n.toLocaleString("tr")}/${earn.toLocaleString("tr")}` : ""}</small>
                  {n !== null && <i style={{ width: `${(n / earn) * 100}%` }} />}
                </div>
              );
            })}
          </div>
        </details>
      )}
    </div>
  );
}

export function socialUrl(key: string, v: string) {
  if (/^https:\/\//i.test(v)) return v;
  return SOCIALS.find((s) => s.key === key)?.url?.(v) || "";
}

export function Socials({ socials }: { socials?: Record<string, string> }) {
  const { toast } = useApp();
  const list = SOCIALS.filter((s) => socials?.[s.key]);
  if (!list.length) return null;
  return (
    <div className="socials">
      {list.map((s) => {
        const v = socials![s.key];
        if (s.key === "discord") {
          return (
            <button key={s.key} className="social" title="Kopyala"
              onClick={() => navigator.clipboard?.writeText(v).then(() => toast("Discord adı kopyalandı ✓"), () => {})}>
              {v}
            </button>
          );
        }
        const href = socialUrl(s.key, v);
        return href ? <a key={s.key} className="social" href={href} target="_blank" rel="noopener nofollow">{s.label}</a> : null;
      })}
    </div>
  );
}

// Yıldızlar her zaman 5 tane; puan 0-10 (yarım yıldız = 1)
export function Stars({ r, style }: { r: number; style?: React.CSSProperties }) {
  const rr = Math.round(r);
  return (
    <span className="stars" style={style}>
      {[1, 2, 3, 4, 5].map((i) => {
        const v = rr - (i - 1) * 2;
        return <span key={i} className={`star ${v >= 2 ? "full" : v === 1 ? "half" : ""}`}>★</span>;
      })}
    </span>
  );
}

// Puanı izleyenin seçtiği ölçekte göster: 5'likte yıldız, 10'lukta sayı
export function Rating({ r, big = false }: { r: number; big?: boolean }) {
  const { scale } = useApp();
  if (!r) return null;
  return scale === 10
    ? <span className={`score10 ${big ? "big" : ""}`} title={scoreText(r, 10)}>★ {num(r)}<small>/10</small></span>
    : <span title={scoreText(r, 5)}><Stars r={r} style={big ? { fontSize: 22 } : undefined} /></span>;
}

export function Cover({ src }: { src?: string | null }) {
  const url = safeUrl(src);
  // Yüklenemeyen görsel kaldırılır, altındaki ikon görünür
  return url ? <img src={url} alt="" loading="lazy" decoding="async" onError={(e) => e.currentTarget.remove()} /> : null;
}

// Puan dağılımı: ince sütunlar, solda yarım yıldız sağda beş yıldız; üzerine gelince kaç kişi olduğu
export function RatingBars({ ratings, wide = false }: { ratings: number[]; wide?: boolean }) {
  if (ratings.length < 2) return null;
  const bins = Array.from({ length: 10 }, (_, i) => ratings.filter((r) => Math.min(10, Math.max(1, Math.round(r))) === i + 1).length);
  const max = Math.max(...bins);
  return (
    <div className={`rbars ${wide ? "wide" : ""}`} role="img" aria-label="Puan dağılımı">
      <span className="rb-end">½</span>
      <span className="rb-cols">
        {bins.map((n, i) => <i key={i} className={n ? "" : "zero"} style={{ height: `${Math.max(6, (n / max) * 100)}%` }} title={`${num((i + 1) / 2)} yıldız: ${n}`} />)}
      </span>
      <span className="rb-end">★★★★★</span>
    </div>
  );
}

export function Stats({ list }: { list: Entry[] }) {
  const { scale } = useApp();
  const rated = list.filter((i) => i.rating > 0);
  const avg = rated.length ? rated.reduce((s, i) => s + Number(i.rating), 0) / rated.length : 0;
  const year = new Date().getFullYear().toString();
  const secs = list.reduce((s, i) => s + playSec(i), 0);
  const items: [string | number, string][] = [
    [list.filter((i) => i.status !== "planned").length, "Toplam kayıt"],
    [list.filter((i) => i.status === "planned").length, "Planlanan"],
    [list.filter((i) => i.status === "completed").length, "Bitirilen"],
    [list.filter((i) => i.status === "active").length, "Devam eden"],
    [list.filter((i) => i.status === "completed" && (i.date || "").startsWith(year)).length, "Bu yıl bitirilen"],
    [avg ? `★ ${avgText(avg, scale)}` : "–", "Ortalama puan"],
    ...(secs ? [[`${fmtHoursShort(secs)}`, "Toplam süre"] as [string, string]] : []),
  ];
  return <>{items.map(([b, s]) => <div className="stat" key={s}><b>{b}</b><span>{s}</span></div>)}</>;
}

// Dizi/animede bir bölüm daha izleyince tek dokunuş: sayaç artar, son bölümse bitirmek isteyip istemediği sorulur
function EpBump({ e }: { e: Entry }) {
  const { toast, refresh } = useApp();
  const [busy, setBusy] = useState(false);
  const total = e.episodes_total || 0;
  async function bump() {
    const next = (e.episode || 0) + 1;
    const patch: Partial<Entry> = { episode: next, updated_at: new Date().toISOString() };
    const last = total > 0 && next >= total;
    if (last && confirm(`Son bölüm! “${e.title}” bitti olarak işaretlensin mi?`)) Object.assign(patch, { status: "completed", date: today() });
    setBusy(true);
    try {
      await q(sb().from("entries").update(patch).eq("id", e.id));
      toast(patch.status === "completed" ? "Bitirdin, tebrikler!" : `${next}. bölüm ✓`);
      refresh();
    } catch (err) {
      const msg = (err as Error).message;
      toast(/episode/.test(msg) ? "Bölüm takibi birkaç dakika içinde açılacak." : "Kaydedilemedi: " + msg);
    } finally {
      setBusy(false);
    }
  }
  return (
    <button type="button" className="ep-bump" disabled={busy} onClick={bump} title="Bir bölüm daha izledim">
      {e.episode ? <span>{e.episode}{total ? `/${total}` : ""}</span> : null}+1
    </button>
  );
}

export function EntryCard({ e, kind = false, edit = false, wall = false }: { e: Entry; kind?: boolean; edit?: boolean; wall?: boolean }) {
  const { openForm, openView, scale } = useApp();
  const t = TYPES[e.type];
  const meta = [e.creator, e.year].filter(Boolean).join(" · ");
  const episodic = (e.type === "show" || e.type === "anime") && e.status === "active";
  const card = (
    <button className="card" onClick={() => (edit ? openForm(e) : openView(e))}>
      <div className={`poster ${t.square ? "square" : ""}`}>
        <div className="ph">{t.label}</div>
        <Cover src={e.cover} />
        {kind && <span className="kind">{t.label}</span>}
        {e.favorite && <span className="fav" title="Favori">♥</span>}
        {e.status !== "owned" && <span className={`st badge ${e.status}`}>{statusLabel(e.status, e.type)}</span>}
        {e.rating ? <span className="rating">★ {scoreShort(e.rating, scale)}</span> : null}
        {episodic && !edit && e.episode ? <span className="ep-pill">{e.episode}{e.episodes_total ? `/${e.episodes_total}` : ""}. bölüm</span> : null}
        {wall && <div className="hover"><b>{e.title}</b>{meta && <span>{meta}</span>}</div>}
      </div>
      {!wall && <div className="card-title">{e.title}</div>}
      {!wall && meta && <div className="card-meta">{meta}</div>}
    </button>
  );
  // Kendi devam eden dizinde kapağın köşesinde "+1 bölüm" (düğme içinde düğme olmasın diye yanına konur)
  return edit && episodic ? <div className="card-bump">{card}<EpBump e={e} /></div> : card;
}

export const likeCount = (e: Entry) => e.likes?.[0]?.count || 0;
export const commentCount = (e: Entry) => e.comments?.[0]?.count || 0;

// Kayıtla ilgili kısa etiketler: platform, emülatör, mağaza, ilerleme, süre, kaç günde bitti
// Dizi/animede kaçıncı bölümde: "S2 · 5/12. bölüm"
export const epText = (e: Entry) => e.episode
  ? `${e.season ? `S${e.season} · ` : ""}${e.episode}${e.episodes_total ? `/${e.episodes_total}` : ""}. bölüm`
  : "";

export function entryTags(e: Entry, { store = false, time = true } = {}) {
  const days = daysTaken(e);
  return [
    e.platform,
    e.emulated ? "Emülatör" : "",
    e.dlc ? "DLC dahil" : "",
    store ? e.store : "",
    e.status === "active" && e.progress_sec ? `▶ ${fmtDur(e.progress_sec)}` : "",
    epText(e),
    e.plays?.length ? `${e.plays.length + 1}. kez` : "",
    time && playSec(e) && !(e.status === "active" && e.progress_sec) ? fmtDur(playSec(e)) : "", // devam edende süre zaten ▶ ile yazıyor
    days ? `${days} günde` : "",
  ].filter(Boolean) as string[];
}

// Akışta incelemenin ilk satırları görünür; tamamını, beğeni ve yorumları kayda tıklayan sahibinin profilinde açar.
export function FeedItem({ e }: { e: Entry }) {
  const p = e.profiles || {};
  const t = TYPES[e.type];
  const profile = `/u/${p.username}`;
  const link = `${profile}?entry=${e.id}`;
  const extra = entryTags(e);
  const likes = likeCount(e), comments = commentCount(e);
  return (
    <div className="feed-item">
      <Link href={profile}><Avatar p={p} /></Link>
      <div className="text">
        <div className="line">
          <Link href={profile}><b><Name p={p} /></b></Link> {activityVerb(e)}:{" "}
          <Link className="title-link" href={link}>{e.title}</Link>
        </div>
        <div className="sub">
          <span>{t.label}</span>
          <Rating r={e.rating} />
          <span>{timeAgo(e.updated_at)}</span>
          {likes > 0 && <span title="Beğeni">♥ {likes}</span>}
          {comments > 0 && <span title="Yorum">{comments}</span>}
        </div>
        {(extra.length > 0 || e.favorite) && (
          <div className="chips-row">
            {extra.map((x) => <span className="tag" key={x}>{x}</span>)}
            {e.favorite && <span className="tag fav">♥ favori</span>}
          </div>
        )}
        {e.notes && <Link className="feed-review" href={link} title="İncelemenin tamamı"><RichText text={e.notes} /></Link>}
      </div>
      <Link className="thumb" href={link}>{t.label}<Cover src={e.cover} /></Link>
    </div>
  );
}

// Aynı kişinin art arda yaptığı aynı eylem tek kartta toplanır
function groupFeed(list: Entry[]) {
  const out: Entry[][] = [];
  for (const e of list) {
    const last = out[out.length - 1];
    if (last && last[0].user_id === e.user_id && activityVerb(last[0]) === activityVerb(e)) last.push(e);
    else out.push([e]);
  }
  return out;
}

function FeedGroup({ list }: { list: Entry[] }) {
  const p = list[0].profiles || {};
  const profile = `/u/${p.username}`;
  const types = [...new Set(list.map((e) => TYPES[e.type].label))].join(", ");
  const shown = list.slice(0, 8);
  return (
    <div className="feed-item group">
      <Link href={profile}><Avatar p={p} /></Link>
      <div className="text">
        <div className="line"><Link href={profile}><b><Name p={p} /></b></Link> {activityVerb(list[0])} <span className="grp-n">{list.length} içerik</span></div>
        <div className="sub"><span>{types}</span><span>{timeAgo(list[0].updated_at)}</span></div>
        <div className="grp-covers">
          {shown.map((e) => (
            <Link key={e.id} href={`${profile}?entry=${e.id}`} title={e.title} className="grp-cover"><span>{TYPES[e.type].label}</span><Cover src={e.cover} /></Link>
          ))}
          {list.length > shown.length && <span className="grp-more">+{list.length - shown.length}</span>}
        </div>
      </div>
    </div>
  );
}

// Uzun akışlar sayfanın sonuna kadar uzamasın: önce birkaçı, istenirse devamı
export function Feed({ list: all, empty, step = 8 }: { list: Entry[]; empty?: React.ReactNode; step?: number }) {
  const { blocked } = useApp();
  const [shown, setShown] = useState(step);
  const list = blocked.size ? all.filter((e) => !blocked.has(e.user_id)) : all; // engellediklerinin hareketleri görünmez
  if (!list.length) return <>{empty ?? <div className="empty">Henüz hareket yok.</div>}</>;
  const rows = groupFeed(list);
  return (
    <div className="feed">
      {rows.slice(0, shown).map((g) => (g.length > 1 ? <FeedGroup key={g[0].id} list={g} /> : <FeedItem key={g[0].id} e={g[0]} />))}
      {rows.length > shown && <button className="feed-more" onClick={() => setShown((n) => n + step * 2)}>Daha fazla göster ({rows.length - shown})</button>}
    </div>
  );
}

export function FollowButton({ id }: { id: string }) {
  const { me, following, toggleFollow } = useApp();
  if (me?.id === id) return null;
  if (!me) return <Link className="btn primary" href="/login">+ Takip et</Link>;
  const on = following.has(id);
  return <button className={`btn ${on ? "following" : "primary"}`} onClick={() => toggleFollow(id)}>{on ? "✓ Takip ediliyor" : "+ Takip et"}</button>;
}

export function UserRow({ p }: { p: Profile }) {
  return (
    <div className="user-row">
      <Link href={`/u/${p.username}`}><Avatar p={p} /></Link>
      <Link className="who" href={`/u/${p.username}`}><b><Name p={p} /></b><span>@{p.username}{p.bio ? " · " + p.bio : ""}</span></Link>
      <FollowButton id={p.id} />
    </div>
  );
}

// Saat-dakika-saniye kutuları; değer saniye olarak tutulur
export function HmsInput({ value, onChange, label }: { value: number | null; onChange: (v: number | null) => void; label: string }) {
  const h = value == null ? "" : String(Math.floor(value / 3600));
  const m = value == null ? "" : String(Math.floor((value % 3600) / 60));
  const s = value == null ? "" : String(value % 60);
  function set(part: "h" | "m" | "s", raw: string) {
    const parts = { h, m, s, [part]: raw.replace(/\D/g, "").slice(0, part === "h" ? 5 : 2) };
    const total = Number(parts.h || 0) * 3600 + Math.min(59, Number(parts.m || 0)) * 60 + Math.min(59, Number(parts.s || 0));
    onChange(total || null); // sıfır süre = girilmemiş
  }
  return (
    <div className="hms" aria-label={label}>
      <label><input inputMode="numeric" value={h} placeholder="0" onChange={(e) => set("h", e.target.value)} aria-label={`${label}: saat`} /><span>sa</span></label>
      <label><input inputMode="numeric" value={m} placeholder="0" onChange={(e) => set("m", e.target.value)} aria-label={`${label}: dakika`} /><span>dk</span></label>
      <label><input inputMode="numeric" value={s} placeholder="0" onChange={(e) => set("s", e.target.value)} aria-label={`${label}: saniye`} /><span>sn</span></label>
    </div>
  );
}

// İncelemede ve yorumda ||böyle|| yazılan yer spoiler olarak gizlenir, tıklayınca açılır
export function RichText({ text }: { text: string }) {
  const parts = text.split(/\|\|([\s\S]+?)\|\|/);
  return <>{parts.map((p, i) => (i % 2 ? <Spoiler key={i} text={p} /> : p))}</>;
}

function Spoiler({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`spoiler ${open ? "open" : ""}`} role="button" tabIndex={0} title={open ? undefined : "Spoiler: görmek için tıkla"}
      onClick={(e) => { if (!open) { e.preventDefault(); e.stopPropagation(); setOpen(true); } }}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); setOpen(true); } }}>{text}</span>
  );
}
