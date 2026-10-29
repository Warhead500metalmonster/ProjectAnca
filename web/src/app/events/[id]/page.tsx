/* eslint-disable @next/next/no-img-element */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { type AncEvent, type EventMember, type EventOption, type MemberStatus, addToLibrary, dateLine, eventBadgeKey, eventState, fetchEvent, kindOf, libraryEntry, statusText, verbs } from "@/lib/events";
import { BADGES, PROFILE_COLS, TYPES } from "@/lib/constants";
import { cssUrl, safeUrl, timeAgo, today } from "@/lib/format";
import { q, sb } from "@/lib/supabase";
import type { ProfileLite } from "@/lib/types";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, Name, RichText } from "@/components/ui";
import { EventForm } from "@/components/EventForm";
import { friendsLine } from "@/components/EventBanner";

const STATUSES: MemberStatus[] = ["joined", "playing", "done"];

export default function EventPage() {
  const { id } = useParams<{ id: string }>();
  const focus = useSearchParams().get("u"); // rozetten gelindiyse rozetin sahibi
  const { me, isAdmin, toast, refresh, version } = useApp();
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [bump, setBump] = useState(0);
  const { data, error } = useLoad(() => fetchEvent(id), [id, version, bump]);

  if (error) return <div className="empty">Etkinlik yüklenemedi: {error}</div>;
  if (!data) return <div className="loading">Yükleniyor…</div>;
  const { ev, members } = data;
  if (!ev) return <div className="empty">Bu etkinlik bulunamadı. <Link href="/events">Bütün etkinlikler</Link></div>;

  const reload = () => { setBump((n) => n + 1); refresh(); };
  const my = me ? members.find((m) => m.user_id === me.id) : undefined;
  const ended = eventState(ev) === "ended";
  // Öne çıkan kişi: rozetten gelinen kişi; yoksa biten etkinlikte kendin
  const spot = members.find((m) => m.user_id === focus) || (ended ? my : undefined);

  async function remove() {
    if (!confirm(`“${ev!.title}” etkinliği silinsin mi? Katılımcıların kayıtları kütüphanelerinde kalır.`)) return;
    try {
      await q(sb().from("events").delete().eq("id", ev!.id));
      toast("Etkinlik silindi");
      router.replace("/events");
    } catch (err) { toast("Silinemedi: " + (err as Error).message); }
  }

  return (
    <div className="ev-page">
      <Hero ev={ev} members={members} my={my} />
      {spot && <Spotlight ev={ev} m={spot} members={members} self={spot.user_id === me?.id} />}
      {isAdmin && !editing && (
        <div className="ev-admin">
          <button className="btn" onClick={() => setEditing(true)}>Etkinliği düzenle</button>
          <button className="btn danger" onClick={remove}>Sil</button>
        </div>
      )}
      {editing && <EventForm ev={ev} onDone={() => { setEditing(false); reload(); }} />}

      {ended ? (
        <>
          <div className="ev-archive-note">
            <b>Bu etkinlik bitti ve arşivlendi.</b> Sonuçlar, katılanlar, notlar ve sohbet burada saklanıyor; artık yazılamaz ama istediğin zaman dönüp bakabilirsin.
          </div>
          <Results ev={ev} members={members} my={my} />
        </>
      ) : (
        <>
          {my ? (
            <>
              <MyPanel ev={ev} my={my} members={members} onChange={reload} />
              <Versions ev={ev} members={members} my={my} onChange={reload} />
              <Rewards ev={ev} />
            </>
          ) : (
            <>
              <Rewards ev={ev} />
              <HowTo kind={new Set(ev.options.map((o) => o.kind || ev.kind)).size > 1 ? null : ev.options[0]?.kind || ev.kind} />
              <Versions ev={ev} members={members} my={my} onChange={reload} />
              {/* Telefonda ekranın altında sabit Katıl düğmesi */}
              <a className="ev-sticky btn primary" href="#ev-versions">Etkinliğe katıl</a>
            </>
          )}
        </>
      )}

      {ev.description?.trim() && (
        <section className="section ev-about">
          <div className="section-head"><h2>Etkinlik hakkında</h2></div>
          <RichText text={ev.description} />
        </section>
      )}

      <People ev={ev} members={members} />
      <EventChat ev={ev} joined={!!my} closed={ended} />
      {!me && <p className="muted ev-guest"><Link href="/signup">Ücretsiz katıl</Link> ya da <Link href="/login">giriş yap</Link>, sen de etkinliğe dahil ol.</p>}
    </div>
  );
}

// Büyük kapak: başlık, tarih, geri sayım, katılanlar
function Hero({ ev, members, my }: { ev: AncEvent; members: EventMember[]; my?: EventMember }) {
  const { following, toast } = useApp();
  const friends = friendsLine(members.map((m) => m.profiles).filter(Boolean) as ProfileLite[], following);
  const state = eventState(ev);
  // Arkadaşını çağır: telefonda paylaşım penceresi, bilgisayarda link kopyalanır
  async function share() {
    const url = location.href.split("#")[0];
    try {
      if (navigator.share) await navigator.share({ title: ev.title, text: `${ev.title}: Ancalog'da hep birlikte! Sen de katıl.`, url });
      else { await navigator.clipboard.writeText(url); toast("Etkinlik linki kopyalandı, arkadaşına gönder!"); }
    } catch { /* paylaşım penceresi kapatıldı */ }
  }
  const done = members.filter((m) => m.status === "done").length;
  const art = safeUrl(ev.cover) || safeUrl(ev.options[0]?.cover);
  const covers = ev.options.map((o) => safeUrl(o.cover)).filter(Boolean).slice(0, 3);
  return (
    <section className={`ev-hero ${state}`} style={art ? { backgroundImage: cssUrl(art) } : undefined}>
      {covers.length > 1 && (
        <div className={`ev-fan hero n${covers.length}`} aria-hidden="true">
          {covers.map((c, i) => <img key={i} src={c} alt="" style={{ "--i": i - (covers.length - 1) / 2 } as React.CSSProperties} />)}
        </div>
      )}
      <div className="ev-hero-in">
        <div className="ev-kicker">
          <span>Etkinlik · {new Set(ev.options.map((o) => o.kind || ev.kind)).size > 1 ? "Karışık" : TYPES[ev.options[0]?.kind || ev.kind]?.label || "Oyun"}</span>
          <span className={`ev-state ${state}`}>{state === "upcoming" ? "Yakında" : state === "live" ? "Şu an sürüyor" : "Bitti · Arşivde"}</span>
        </div>
        <h1>{ev.title}</h1>
        <p className="ev-date">{dateLine(ev)}</p>
        {state === "upcoming" && <Countdown to={ev.starts_on} />}
        <div className="ev-hero-foot">
          {members.length > 0 ? (
            <div className="ev-crowd">
              <span className="ev-faces">{members.slice(-6).map((m) => <Avatar key={m.user_id} p={m.profiles} />)}</span>
              <span><b>{members.length}</b> kişi katıldı{done ? <> · <b>{done}</b> kişi bitirdi</> : null}{friends && <><br /><small>{friends}</small></>}</span>
            </div>
          ) : <span className="muted">İlk katılan sen ol!</span>}
          <div className="ev-hero-actions">
            {state !== "ended" && <button className="btn ev-share" onClick={share}>Arkadaşını çağır</button>}
            {my ? <a className="ev-joined" href="#ev-me">✓ Katıldın · {ev.options.find((o) => o.id === my.choice)?.label || "sürüm seçmedin"} · {statusText(my.status, kindOf(ev, my.choice))}</a>
              : state !== "ended" && <a className="btn primary ev-cta" href="#ev-versions">Katıl</a>}
          </div>
        </div>
      </div>
    </section>
  );
}

// Başlamasına kalan süre (dakikada bir tazelenir)
function Countdown({ to }: { to: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 30000); return () => clearInterval(t); }, []);
  const ms = Math.max(0, new Date(to + "T00:00").getTime() - now);
  const d = Math.floor(ms / 86400000), h = Math.floor(ms / 3600000) % 24, m = Math.floor(ms / 60000) % 60;
  return (
    <div className="ev-count" aria-label={`${d} gün ${h} saat ${m} dakika kaldı`}>
      <div><b>{d}</b><span>gün</span></div>
      <div><b>{h}</b><span>saat</span></div>
      <div><b>{m}</b><span>dakika</span></div>
    </div>
  );
}

// Sürüm kartları: seçince katılırsın (katıldıysan sürümün değişir)
function Versions({ ev, members, my, onChange }: { ev: AncEvent; members: EventMember[]; my?: EventMember; onChange: () => void }) {
  const { me, mine, toast } = useApp();
  const router = useRouter();
  const [toLib, setToLib] = useState(true);
  const [busy, setBusy] = useState(false);
  const state = eventState(ev);
  const options: EventOption[] = ev.options.length ? ev.options : [{ id: "", label: "Katıl" }];

  async function pick(o: EventOption) {
    if (!me) { toast("Katılmak için önce giriş yap."); return router.push("/login"); }
    if (my?.choice === o.id) return;
    setBusy(true);
    try {
      if (my) {
        await q(sb().from("event_members").update({ choice: o.id || null, updated_at: new Date().toISOString() }).eq("event_id", ev.id).eq("user_id", me.id));
        toast(`Sürümün değişti: ${o.label}`);
      } else {
        await q(sb().from("event_members").insert({ event_id: ev.id, user_id: me.id, choice: o.id || null, status: state === "live" ? "playing" : "joined" }));
        let lib = "";
        if (toLib && (o.rawg_id || o.ext_id || o.title) && !libraryEntry(mine, o)) {
          await addToLibrary(me.id, ev, o).then(() => { lib = state === "live" ? ` Kütüphanene ${verbs(o.kind || ev.kind).me} olarak eklendi.` : " Kütüphanene Planlandı olarak eklendi."; }).catch(() => {});
        }
        toast(`Katıldın, hoş geldin!${lib}`);
      }
      onChange();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (state === "ended") return null;
  return (
    <section className={`section ${my ? "ev-versions-small" : ""}`} id="ev-versions">
      <div className="section-head"><h2>{my ? (ev.options.length > 1 ? "Sürümünü değiştir" : "Etkinlik") : ev.options.length > 1 ? "Sürümünü seç, katıl" : "Katıl"}</h2>
        {ev.options.length > 1 && <span className="muted small">Hangisini istersen; sonra değiştirebilirsin</span>}</div>
      <div className={`ev-options n${Math.min(options.length, 4)}`}>
        {options.map((o) => {
          const who = members.filter((m) => (m.choice || "") === o.id);
          const mineHere = my && (my.choice || "") === o.id;
          return (
            <button key={o.id || "one"} className={`ev-opt ${mineHere ? "on" : ""}`} disabled={busy} onClick={() => pick(o)}>
              <div className="ev-opt-art">{safeUrl(o.cover) ? <img src={o.cover!} alt="" /> : <span className="ev-opt-ph">{o.label}</span>}</div>
              <div className="ev-opt-body">
                <b>{o.label}</b>
                {o.sub && <span className="muted small">{o.sub}</span>}
                <div className="ev-opt-who">
                  {who.length ? <><span className="ev-faces">{who.slice(0, 5).map((m) => <Avatar key={m.user_id} p={m.profiles} />)}</span>
                    <span>{who.length} kişi{who.some((m) => m.status === "done") ? ` · ${who.filter((m) => m.status === "done").length} bitirdi` : ""}</span></>
                    : <span className="muted small">Henüz kimse yok</span>}
                </div>
                <span className={`ev-opt-cta ${mineHere ? "on" : ""}`}>{mineHere ? "✓ Senin sürümün" : my ? "Buna geç" : verbs(o.kind || ev.kind).will}</span>
              </div>
            </button>
          );
        })}
      </div>
      {me && !my && <label className="check ev-tolib"><input type="checkbox" checked={toLib} onChange={(e) => setToLib(e.target.checked)} /> Seçtiğim sürümü kütüphaneme de ekle</label>}
    </section>
  );
}

// Katıldıysan: durumun, nerede olduğun, ayrılma
function MyPanel({ ev, my, members, onChange }: { ev: AncEvent; my: EventMember; members: EventMember[]; onChange: () => void }) {
  const { me, mine, toast, openForm } = useApp();
  const [note, setNote] = useState(my.note || "");
  const [busy, setBusy] = useState(false);
  const option = ev.options.find((o) => o.id === my.choice);
  const entry = libraryEntry(mine, option);

  async function setStatus(s: MemberStatus) {
    if (!me || s === my.status) return;
    setBusy(true);
    try {
      const now = new Date().toISOString();
      await q(sb().from("event_members").update({ status: s, finished_at: s === "done" ? now : null, updated_at: now }).eq("event_id", ev.id).eq("user_id", me.id));
      // Kütüphanedeki kaydı da güncel tut
      if (entry && s === "done" && entry.status !== "completed") await sb().from("entries").update({ status: "completed", date: today(), updated_at: now }).eq("id", entry.id);
      if (entry && s === "playing" && entry.status === "planned") await sb().from("entries").update({ status: "active", started_on: entry.started_on || today(), updated_at: now }).eq("id", entry.id);
      const rank = members.filter((m) => m.status === "done").length + 1;
      toast(s === "done" ? `Tebrikler! Bitiren ${rank}. kişisin.${entry && entry.status !== "completed" ? " Kütüphanende de Bitti yapıldı." : ""}` : s === "playing" ? verbs(kindOf(ev, my.choice)).cheer : "Tamam");
      onChange();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function saveNote() {
    if (!me) return;
    try {
      await q(sb().from("event_members").update({ note: note.trim().slice(0, 140) || null, updated_at: new Date().toISOString() }).eq("event_id", ev.id).eq("user_id", me.id));
      toast("Yazdığın herkese görünüyor");
      onChange();
    } catch (err) { toast("Kaydedilemedi: " + (err as Error).message); }
  }

  async function leave() {
    if (!me || !confirm("Etkinlikten ayrılmak istiyor musun? Kütüphanendeki kayıt yerinde kalır.")) return;
    try {
      await q(sb().from("event_members").delete().eq("event_id", ev.id).eq("user_id", me.id));
      toast("Etkinlikten ayrıldın");
      onChange();
    } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  return (
    <section className="section ev-me" id="ev-me">
      <div className="section-head"><h2>Senin durumun</h2>{option && <span className="muted small">{option.label}</span>}</div>
      <div className="seg ev-status">
        {STATUSES.map((s) => (
          <button key={s} type="button" disabled={busy} className={my.status === s ? "active" : ""} onClick={() => setStatus(s)}>{statusText(s, kindOf(ev, my.choice), true)}</button>
        ))}
      </div>
      <div className="ev-note">
        <input className="input" maxLength={140} value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => e.key === "Enter" && saveNote()}
          placeholder="Neredesin? ör. Su Tapınağı'ndayım, yardım! (spoiler verme)" />
        <button className="btn" disabled={note.trim() === (my.note || "")} onClick={saveNote}>Paylaş</button>
      </div>
      <div className="ev-me-foot">
        {entry ? <button className="link small" onClick={() => openForm(entry)}>Kütüphanendeki kaydını düzenle (puan, süre, inceleme)</button> : <span className="muted small">Bu sürüm kütüphanende yok.</span>}
        <button className="link danger" onClick={leave}>Etkinlikten ayrıl</button>
      </div>
    </section>
  );
}

// Katılımcılar: bitirenler sırasıyla üstte, sonra oynayanlar, sonra katılanlar
function People({ ev, members }: { ev: AncEvent; members: EventMember[] }) {
  if (!members.length) return null;
  const done = members.filter((m) => m.status === "done").sort((a, b) => (a.finished_at || "").localeCompare(b.finished_at || ""));
  const rest = members.filter((m) => m.status !== "done").sort((a, b) => (a.status === "playing" ? -1 : 0) - (b.status === "playing" ? -1 : 0) || b.updated_at.localeCompare(a.updated_at));
  const pct = Math.round((done.length / members.length) * 100);
  const label = (m: EventMember) => ev.options.find((o) => o.id === m.choice)?.label;
  const row = (m: EventMember, rank?: number) => (
    <div key={m.user_id} className={`ev-person ${m.status}`}>
      {rank ? <span className="ev-rank">{rank}.</span> : null}
      <Link href={`/u/${m.profiles?.username}`} className="ev-person-who"><Avatar p={m.profiles} /><Name p={m.profiles} /></Link>
      <div className="ev-person-mid">
        <div className="ev-person-tags">
          <span className={`ev-pill ${m.status}`}>{statusText(m.status, kindOf(ev, m.choice))}</span>
          {label(m) && <span className="ev-pill ver">{label(m)}</span>}
        </div>
        {m.note && <p className="ev-person-note">“{m.note}”</p>}
      </div>
      <span className="muted small ev-person-time">{timeAgo(m.status === "done" && m.finished_at ? m.finished_at : m.updated_at)}</span>
    </div>
  );
  return (
    <section className="section">
      <div className="section-head"><h2>Katılanlar</h2><span className="muted small">{members.length} kişi</span></div>
      <div className="ev-bar"><i style={{ width: `${pct}%` }} /><span>{done.length} / {members.length} kişi bitirdi</span></div>
      {done.length > 0 && <div className="ev-people"><h3>Bitirenler</h3>{done.map((m, i) => row(m, i + 1))}</div>}
      {rest.length > 0 && <div className="ev-people">{done.length > 0 && <h3>Yoldakiler</h3>}{rest.map((m) => row(m))}</div>}
    </section>
  );
}

// Etkinlik sohbeti: herkes okur, giriş yapan yazar. Spoiler işaretli mesajlar dokununca açılır.
// Yazıdaki resim linklerini ayır: doğrudan resim dosyaları, Imgur ve Discord linkleri
const IMG_URL = /https:\/\/[^\s<>"]+?(?:\.(?:jpe?g|png|gif|webp|avif)(?:\?[^\s<>"]*)?|(?=\s|$))/gi;
function imagesIn(body: string): { text: string; images: string[] } {
  const images: string[] = [];
  const text = body.replace(IMG_URL, (url) => {
    let u = url;
    const imgur = u.match(/^https:\/\/(?:www\.)?imgur\.com\/([A-Za-z0-9]{5,10})$/); // sayfa linki → resmin kendisi
    if (imgur) u = `https://i.imgur.com/${imgur[1]}.jpeg`;
    const isImg = /\.(jpe?g|png|gif|webp|avif)(\?|$)/i.test(u) || /^https:\/\/(i\.imgur\.com|media\.discordapp\.net|cdn\.discordapp\.com)\//i.test(u);
    if (!isImg) return url;
    images.push(u);
    return "";
  }).trim();
  return { text, images };
}

// Fotoğraf açılmazsa boş kutu yerine linki göster
function PostImage({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  return failed
    ? <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="ev-img-broken">Fotoğraf açılamadı: {src}</a>
    : <a href={src} target="_blank" rel="noopener noreferrer nofollow" className="ev-post-img"><img src={src} alt="" loading="lazy" onError={() => setFailed(true)} /></a>;
}

interface EventPost { id: string; event_id: string; user_id: string; body: string; spoiler: boolean; image?: string | null; created_at: string; profiles?: ProfileLite | null }

function EventChat({ ev, joined, closed }: { ev: AncEvent; joined: boolean; closed: boolean }) {
  const { me, isAdmin, blocked, toast, report } = useApp();
  const [text, setText] = useState("");
  const [spoiler, setSpoiler] = useState(false);
  const [image, setImage] = useState(""); // fotoğraf linki (isteğe bağlı)
  const [photo, setPhoto] = useState(false); // fotoğraf kutusu açık mı
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<Set<string>>(new Set()); // açılan spoilerlar
  const [v, setV] = useState(0);
  const { data } = useLoad(() => q<EventPost[]>(sb().from("event_posts").select(`*, profiles(${PROFILE_COLS})`).eq("event_id", ev.id)
    .order("created_at", { ascending: false }).limit(200)).catch(() => [] as EventPost[]), [ev.id, v]);
  const posts = (data || []).filter((x) => !blocked.has(x.user_id));

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!me || (!text.trim() && !image.trim())) return;
    const img = image.trim();
    if (img && !/^https:\/\/\S+$/i.test(img)) return toast("Fotoğraf linki https:// ile başlamalı.");
    setBusy(true);
    try {
      await q(sb().from("event_posts").insert({ event_id: ev.id, user_id: me.id, body: text.trim().slice(0, 1000) || "📷", spoiler, ...(img && { image: img }) }));
      setText("");
      setSpoiler(false);
      setImage("");
      setPhoto(false);
      setV((n) => n + 1);
    } catch (err) {
      toast("Gönderilemedi: " + (err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(x: EventPost) {
    if (!confirm("Bu mesaj silinsin mi?")) return;
    try { await q(sb().from("event_posts").delete().eq("id", x.id)); setV((n) => n + 1); }
    catch (err) { toast("Silinemedi: " + (err as Error).message); }
  }

  return (
    <section className="section ev-chat">
      <div className="section-head"><h2>Etkinlik sohbeti</h2>{posts.length > 0 && <span className="muted small">{posts.length} mesaj</span>}</div>
      {closed ? <p className="ev-closed">Etkinlik bittiği için sohbet kapandı. Yazılanlar arşivde duruyor.</p> : me ? (
        <form className="ev-chat-form" onSubmit={send}>
          <textarea className="input" rows={2} maxLength={1000} value={text} onChange={(e) => setText(e.target.value)}
            placeholder={joined ? "Nasıl gidiyor? Takıldığın yer, sevdiğin an, ipucu isteği…" : "Etkinlik hakkında bir şey yaz…"} />
          {photo && (
            <div className="ev-photo-in">
              <input className="input" type="url" placeholder="Fotoğraf linki (https://… .jpg, .png, .gif, Imgur, Discord…)" value={image} onChange={(e) => setImage(e.target.value)} />
              {/^https:\/\/\S+$/i.test(image.trim()) && <img src={image.trim()} alt="Önizleme" onError={(e) => (e.currentTarget.style.display = "none")} onLoad={(e) => (e.currentTarget.style.display = "")} />}
            </div>
          )}
          <div className="ev-chat-tools">
            <button type="button" className={`btn ${photo ? "on" : ""}`} onClick={() => { setPhoto(!photo); if (photo) setImage(""); }}>📷 Fotoğraf</button>
            <label className="check"><input type="checkbox" checked={spoiler} onChange={(e) => setSpoiler(e.target.checked)} /> Spoiler içeriyor (gizli gösterilsin)</label>
            <span className="spacer" />
            <button className="btn primary" disabled={busy || (!text.trim() && !image.trim())}>Gönder</button>
          </div>
        </form>
      ) : <p className="muted small">Yazmak için <Link href="/login">giriş yap</Link>.</p>}
      {!posts.length ? <p className="muted small">Henüz kimse yazmadı. İlk mesajı sen at!</p> : (
        <div className="ev-posts">
          {posts.map((x) => {
            const hidden = x.spoiler && !shown.has(x.id) && x.user_id !== me?.id;
            return (
              <div key={x.id} className="ev-post">
                <Link href={`/u/${x.profiles?.username}`}><Avatar p={x.profiles} /></Link>
                <div className="ev-post-main">
                  <div className="ev-post-head">
                    <Link href={`/u/${x.profiles?.username}`}><b><Name p={x.profiles} /></b></Link>
                    <span className="muted small">{timeAgo(x.created_at)}</span>
                    {x.spoiler && <span className="ev-pill">Spoiler</span>}
                    <span className="spacer" />
                    {me && x.user_id !== me.id && (
                      <button className="link small" onClick={() => report({ kind: "event_post", id: `${ev.id}/${x.id}`, user: x.user_id, excerpt: x.body, label: `“${ev.title}” etkinliğindeki bir mesaj` })}>Raporla</button>
                    )}
                    {me && (x.user_id === me.id || isAdmin) && <button className="link small danger" onClick={() => remove(x)}>Sil</button>}
                  </div>
                  {hidden
                    ? <button className="ev-spoiler" onClick={() => setShown((s) => new Set(s).add(x.id))}>Spoiler içeriyor. Görmek için dokun.</button>
                    : (() => {
                      // Mesaja yapıştırılan resim linkleri de fotoğraf olarak görünür (düğmeyi kullanmayanlar için)
                      const { text: rest, images } = imagesIn(x.body);
                      const all = [...new Set([...(x.image && safeUrl(x.image) ? [x.image] : []), ...images])];
                      return <>
                        {rest && rest !== "📷" && <div className="ev-post-body"><RichText text={rest} /></div>}
                        {all.map((src) => <PostImage key={src} src={src} />)}
                      </>;
                    })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Kazanılacak rozetler: katılana, bitirene, ilk bitirene, etkinliğe özel
function Rewards({ ev }: { ev: AncEvent }) {
  const special = ev.badge_name ? { icon: ev.badge_icon || "✦", name: ev.badge_name } : null;
  const items: [string, string, string][] = [
    [BADGES.event_join.icon, BADGES.event_join.name, "Katılınca"],
    [BADGES.event.icon, BADGES.event.name, "Bitirince"],
    ...(special ? [[special.icon, special.name, "Bitirince, bu etkinliğe özel"] as [string, string, string]] : []),
    [BADGES.event_first.icon, BADGES.event_first.name, "Herkesten önce bitirene"],
    [BADGES.event_regular.icon, BADGES.event_regular.name, "3 etkinliğe katılınca"],
  ];
  return (
    <section className="section ev-rewards">
      <div className="section-head"><h2>Kazanacağın rozetler</h2><span className="muted small">Profilinde herkes görür</span></div>
      <div className="ev-reward-list">
        {items.map(([icon, name, when]) => (
          <div key={name} className="ev-reward"><span className="ev-reward-icon">{icon}</span><b>{name}</b><small>{when}</small></div>
        ))}
      </div>
    </section>
  );
}

// Henüz katılmayanlara üç adımda nasıl işlediği
function HowTo({ kind }: { kind: AncEvent["kind"] | null }) {
  const v = kind ? verbs(kind) : { pick: "hangisini seçeceğini", step: "Başla, yaz" };
  return (
    <section className="section ev-howto">
      <div><span>1</span><b>Sürümünü seç</b><small>Aşağıdan {v.pick} seç, katıl.</small></div>
      <div><span>2</span><b>{v.step}</b><small>Nerede olduğunu yaz, sohbette gaz ver; spoiler gizli kalır.</small></div>
      <div><span>3</span><b>Bitir, rozeti kap</b><small>Bitirdim&apos;e bas; bitirenler listesine adın yazılsın.</small></div>
    </section>
  );
}

// Arşiv: biten etkinliğin sonuçları
function Results({ ev, members, my }: { ev: AncEvent; members: EventMember[]; my?: EventMember }) {
  const done = members.filter((m) => m.status === "done").sort((a, b) => (a.finished_at || "").localeCompare(b.finished_at || ""));
  const first = done[0];
  const byVersion = ev.options.map((o) => ({ o, n: members.filter((m) => m.choice === o.id).length, d: members.filter((m) => m.choice === o.id && m.status === "done").length }));
  const top = [...byVersion].sort((a, b) => b.n - a.n)[0];
  const rate = members.length ? Math.round((done.length / members.length) * 100) : 0;
  const myRank = my ? done.findIndex((m) => m.user_id === my.user_id) + 1 : 0;
  return (
    <section className="section ev-results">
      <div className="section-head"><h2>Sonuçlar</h2></div>
      <div className="ev-res-tiles">
        <div><b>{members.length}</b><span>katılan</span></div>
        <div><b>{done.length}</b><span>bitiren</span></div>
        <div><b>%{rate}</b><span>bitirme oranı</span></div>
        {top && top.n > 0 && <div><b className="small">{top.o.label}</b><span>en çok seçilen</span></div>}
      </div>
      {first && (
        <div className="ev-first">
          <span className="ev-reward-icon">{BADGES.event_first.icon}</span>
          <span>İlk bitiren: <Link href={`/u/${first.profiles?.username}`}><b><Name p={first.profiles} /></b></Link></span>
        </div>
      )}
      {my && <p className="muted">Sen: {my.status === "done" ? `bitirdin, ${myRank}. sıradasın. Helal olsun!` : "bu etkinliği yarıda bıraktın; bir dahakine!"}</p>}
      {byVersion.length > 1 && (
        <div className="ev-res-versions">
          {byVersion.map(({ o, n, d }) => (
            <div key={o.id} className="ev-res-row">
              <span>{o.label}</span>
              <div className="ev-res-bar"><i style={{ width: `${members.length ? (n / members.length) * 100 : 0}%` }} /></div>
              <span className="muted small">{n} kişi · {d} bitirdi</span>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

// Bir katılımcının bu etkinlikteki sonucu: rozetinden gelindiğinde ya da arşivde kendi sonucun
function Spotlight({ ev, m, members, self }: { ev: AncEvent; m: EventMember; members: EventMember[]; self: boolean }) {
  const { badges } = useApp();
  const opt = ev.options.find((o) => o.id === m.choice);
  const done = members.filter((x) => x.status === "done").sort((a, b) => (a.finished_at || "").localeCompare(b.finished_at || ""));
  const rank = done.findIndex((x) => x.user_id === m.user_id) + 1;
  const has = badges.get(m.user_id) || [];
  const earned = ["event_join", "event", ...(ev.badge_name ? [eventBadgeKey(ev.id)] : []), ...(rank === 1 ? ["event_first"] : [])]
    .filter((b) => has.includes(b) && BADGES[b] && (b !== "event" || m.status === "done"));
  const fmt = (d: string) => new Date(d).toLocaleDateString("tr", { day: "numeric", month: "long", year: "numeric" });
  const name = m.profiles?.display_name || m.profiles?.username || "";
  const kind = kindOf(ev, m.choice);
  return (
    <section className={`ev-spot ${m.status}`}>
      {safeUrl(opt?.cover) && <div className="ev-spot-art" style={{ backgroundImage: cssUrl(opt!.cover!) }} aria-hidden="true" />}
      <div className="ev-spot-in">
        <div className="ev-spot-who">
          <Link href={`/u/${m.profiles?.username}`}><Avatar p={m.profiles} cls="lg" /></Link>
          <div>
            <span className="ev-kicker"><span>{self ? "Senin sonucun" : `${name} bu etkinlikte`}</span></span>
            <h2>{m.status === "done" ? (rank === 1 ? "İlk bitiren oldu!" : `${rank}. bitiren`) : statusText(m.status, kind)}</h2>
            <p className="muted">
              {opt ? <>{opt.label}{opt.sub ? ` · ${opt.sub}` : ""}</> : "Sürüm seçmedi"}
              {m.status === "done" && m.finished_at ? ` · ${fmt(m.finished_at)} tarihinde bitirdi` : ` · ${fmt(m.joined_at)} tarihinde katıldı`}
            </p>
          </div>
        </div>
        {m.note && <blockquote className="ev-spot-note">“{m.note}”</blockquote>}
        {earned.length > 0 && (
          <div className="ev-spot-badges">
            <span className="muted small">Bu etkinlikte kazandığı rozetler:</span>
            {earned.map((b) => <span key={b} className={`bdg ${BADGES[b].tone}`} title={BADGES[b].desc}>{BADGES[b].icon} {BADGES[b].name}</span>)}
          </div>
        )}
      </div>
    </section>
  );
}
