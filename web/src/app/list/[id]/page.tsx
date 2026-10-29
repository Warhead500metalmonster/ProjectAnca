/* eslint-disable @next/next/no-img-element */
"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import type { Entry, EntryType, List, ListItem, Status } from "@/lib/types";
import { PROFILE_COLS, TYPES, TYPE_KEYS, statusLabel } from "@/lib/constants";
import { contentHref, contentKey, itemOf, timeAgo } from "@/lib/format";
import { type Found, fetchEntries, findContent, searchCredit } from "@/lib/data";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, Cover, Name } from "@/components/ui";
import { ListEditor } from "@/components/ListEditor";

const SEGMENTS: [Status | "none", string, string][] = [
  ["completed", "Bitirdi", "#199e70"],
  ["active", "▶ Devam ediyor", "#3987e5"],
  ["paused", "⏸ Ara verdi", "#c98500"],
  ["dropped", "✖ Bıraktı", "#d95926"],
  ["planned", "Planladı", "#d55181"],
  ["none", "○ Hiç başlamadı", "#3a3f4b"],
];

export default function ListPage() {
  const { id } = useParams<{ id: string }>();
  const { me, mine, version } = useApp();

  const { data, error } = useLoad(async () => {
    const list = await q<List | null>(sb().from("lists").select(`*, profiles(${PROFILE_COLS}), list_items(*)`).eq("id", id).maybeSingle());
    if (!list) return null;
    // Karşılaştırma: giriş yaptıysan senin kütüphanen, yoksa listenin sahibininki
    const base = me ? null : await fetchEntries(list.user_id);
    return { list, base };
  }, [id, version, me?.id], supabaseConfigured());

  if (error) return <div className="empty">Bir şeyler ters gitti: {error}</div>;
  if (data === undefined) return <div className="loading">Yükleniyor…</div>;
  if (data === null) return <div className="empty">Bu liste yok ya da gizli.</div>;
  return <ListView list={data.list} base={data.base ?? mine} />;
}

function ListView({ list, base }: { list: List; base: Entry[] }) {
  const { me, refresh, toast, openView, openForm } = useApp();
  const router = useRouter();
  const isOwner = me?.id === list.user_id;
  const items = [...(list.list_items || [])].sort((a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at));
  const [editing, setEditing] = useState(false);
  const [noteFor, setNoteFor] = useState<{ id: string; text: string } | null>(null); // listeye özel notu düzenlenen içerik
  const owner = list.profiles || {};

  const byKey = new Map(base.map((e) => [contentKey(e), e]));
  const statusOf = (it: ListItem) => byKey.get(contentKey(it));
  const counts = Object.fromEntries(SEGMENTS.map(([s]) => [s, items.filter((it) => ((s2) => (!s2 || s2 === "owned" ? "none" : s2))(statusOf(it)?.status) === s).length])) as Record<Status | "none", number>;
  const pct = items.length ? Math.round((counts.completed / items.length) * 100) : 0;
  const who = me ? "Sen" : (owner.display_name || owner.username);

  async function removeItem(it: ListItem) {
    try {
      await q(sb().from("list_items").delete().eq("id", it.id));
      refresh();
    } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  async function saveNote() {
    if (!noteFor) return;
    try {
      await q(sb().from("list_items").update({ note: noteFor.text.trim() || null }).eq("id", noteFor.id));
      setNoteFor(null);
      refresh();
    } catch (err) { toast("Not kaydedilemedi: " + (err as Error).message); }
  }

  async function move(it: ListItem, dir: -1 | 1) {
    const i = items.indexOf(it), j = i + dir;
    if (j < 0 || j >= items.length) return;
    const order = [...items];
    [order[i], order[j]] = [order[j], order[i]];
    try {
      // Sıra numaralarını baştan yaz (eski kayıtlarda aynı numara olabilir)
      await Promise.all(order.map((x, k) => (x.position !== k ? q(sb().from("list_items").update({ position: k }).eq("id", x.id)) : null)));
      refresh();
    } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  return (
    <>
      <section className="list-head">
        <div className="crumbs"><Link href={`/u/${owner.username}/lists`}>@{owner.username} listeleri</Link></div>
        <h1>{list.title} {!list.is_public && <span className="tag">{list.unlisted ? "Liste dışı" : "Gizli"}</span>}</h1>
        {list.description && <p className="list-desc">{list.description}</p>}
        <div className="view-user">
          <Avatar p={owner} cls="sm" /> <Link href={`/u/${owner.username}`}><Name p={owner} /></Link>
          <span>· {items.length} içerik · {timeAgo(list.updated_at)} güncellendi</span>
        </div>
        {isOwner && (
          <div className="actions" style={{ marginTop: 12 }}>
            <button className="btn" onClick={() => setEditing(true)}>✎ Listeyi düzenle</button>
            {list.unlisted && !list.is_public && (
              <button className="btn" onClick={() => navigator.clipboard.writeText(location.href).then(() => toast("Link kopyalandı; kime verirsen o açabilir"), () => toast(location.href))}>Linki kopyala</button>
            )}
          </div>
        )}
      </section>

      {items.length > 0 && (
        <section className="progress-card">
          <div className="pc-top">
            <b>%{pct}</b>
            <span>
              {pct === 100 ? `${who === "Sen" ? "Bu listeyi tamamladın!" : `${who} bu listeyi tamamladı!`}`
                : `${who} bu listedeki ${items.length} içeriğin ${counts.completed} tanesini ${who === "Sen" ? "bitirdin" : "bitirdi"}.`}
              {counts.dropped > 0 && ` ${counts.dropped} tanesini ${who === "Sen" ? "bıraktın" : "bıraktı"}.`}
              {counts.active > 0 && ` ${counts.active} tanesine devam ${who === "Sen" ? "ediyorsun" : "ediyor"}.`}
            </span>
          </div>
          <div className="stack" role="img" aria-label="Liste ilerlemesi">
            {SEGMENTS.map(([s, label, color]) => counts[s] ? <span key={s} style={{ flex: counts[s], background: color }} title={`${label}: ${counts[s]}`} /> : null)}
          </div>
          <div className="legend">
            {SEGMENTS.map(([s, label, color]) => counts[s] ? <span key={s}><i style={{ background: color }} />{label} <b>{counts[s]}</b></span> : null)}
          </div>
          {!me && <p className="muted" style={{ margin: "8px 0 0", fontSize: 13 }}>Giriş yaparsan bu listeyi kendi kütüphanenle karşılaştırırız.</p>}
        </section>
      )}

      {isOwner && <AddToList list={list} count={items.length} />}

      <section className="section">
        {items.length ? (
          <div className="grid">
            {items.map((it, i) => {
              const e = statusOf(it);
              const t = TYPES[it.type];
              return (
                <div key={it.id} className="card li">
                  <Link href={contentHref(it)} className="card-link">
                    <div className={`poster ${t.square ? "square" : ""} ${e ? "" : "dim"}`}>
                      <div className="ph">{t.label}</div><Cover src={it.cover} />
                      <span className="rank">#{i + 1}</span>
                      <span className={`st badge ${e?.status || ""}`}>{e ? statusLabel(e.status, e.type) : "Loglanmadı"}</span>
                    </div>
                    <div className="card-title">{it.title}</div>
                    <div className="card-meta">{[t.label, it.year].filter(Boolean).join(" · ")}</div>
                  </Link>
                  {noteFor?.id === it.id ? (
                    <div className="li-note-edit">
                      <textarea rows={3} maxLength={1000} autoFocus placeholder="Bu içerik listede neden var?" value={noteFor.text}
                        onChange={(ev) => setNoteFor({ id: it.id, text: ev.target.value })} />
                      <div className="row-end">
                        <button className="btn" onClick={() => setNoteFor(null)}>Vazgeç</button>
                        <button className="btn primary" onClick={saveNote}>Kaydet</button>
                      </div>
                    </div>
                  ) : it.note && <p className="li-note">{it.note}</p>}
                  <div className="li-actions">
                    {me && (e && e.user_id === me.id
                      ? <button className="icon-btn" title="Kaydımı aç" onClick={() => openView({ ...e, profiles: me })}>Aç</button>
                      : !e && <button className="icon-btn" title="Kütüphaneme ekle" onClick={() => openForm(null, { item: itemOf(it) })}>＋</button>)}
                    {isOwner && <>
                      <button className="icon-btn" title={it.note ? "Notu düzenle" : "Not ekle"} onClick={() => setNoteFor({ id: it.id, text: it.note || "" })}>✎</button>
                      <button className="icon-btn" title="Öne al" onClick={() => move(it, -1)} disabled={i === 0}>←</button>
                      <button className="icon-btn" title="Geri al" onClick={() => move(it, 1)} disabled={i === items.length - 1}>→</button>
                      <button className="icon-btn" title="Listeden çıkar" onClick={() => removeItem(it)}>✕</button>
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <div className="empty">{isOwner ? "Liste boş. Yukarıdaki kutudan içerik ara ve ekle." : "Bu liste henüz boş."}</div>}
      </section>
      {editing && <ListEditor list={list} onClose={() => setEditing(false)}
        onSaved={(l) => (l ? refresh() : router.push(`/u/${owner.username}/lists`))} />}
    </>
  );
}

// Listenin sahibi için arama kutusu: seçilen içerik listeye eklenir
function AddToList({ list, count }: { list: List; count: number }) {
  const { refresh, toast } = useApp();
  const [type, setType] = useState<EntryType>("game");
  const [text, setText] = useState("");
  const [found, setFound] = useState<Found[] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const seq = useRef(0);

  function onText(v: string) {
    setText(v);
    clearTimeout(timer.current);
    const s = ++seq.current;
    if (v.trim().length < 2) return setFound(null);
    timer.current = setTimeout(async () => {
      const results = await findContent(type, v.trim()).catch(() => []);
      if (s === seq.current) setFound(results);
    }, 300);
  }

  async function add(f: Found | null) {
    const item = f ? itemOf(f) : { type, title: text.trim(), year: null, creator: null, cover: null, rawg_id: null, ext_id: null };
    if (!item.title) return;
    if ((list.list_items || []).some((x) => contentKey(x) === contentKey(item))) return toast("Bu içerik zaten listede.");
    try {
      await q(sb().from("list_items").insert({ list_id: list.id, ...item, position: count }));
      await q(sb().from("lists").update({ updated_at: new Date().toISOString() }).eq("id", list.id));
      setText(""); setFound(null);
      toast(`“${item.title}” eklendi ✓`);
      refresh();
    } catch (err) { toast("Eklenemedi: " + (err as Error).message); }
  }

  const credit = searchCredit(type);
  return (
    <section className="list-add">
      <select value={type} onChange={(e) => { setType(e.target.value as EntryType); setFound(null); setText(""); }} aria-label="Tür">
        {TYPE_KEYS.map((k) => <option key={k} value={k}>{TYPES[k].label}</option>)}
      </select>
      <div className="suggest-wrap grow">
        <input className="input" value={text} placeholder={`Listeye eklemek için ${TYPES[type].label.toLocaleLowerCase("tr")} ara…`} onChange={(e) => onText(e.target.value)} />
        {found && (
          <div className="suggest">
            {found.map((f, i) => (
              <button type="button" key={i} onClick={() => add(f)}>
                {f.thumb ? <img className={TYPES[f.type].square ? "sq" : ""} src={f.thumb} alt="" /> : <span className="noimg" />}
                <span className="name">{f.title}{f.sub && <small>{f.sub}</small>}</span>
                <span className="year">{f.year || ""}</span>
              </button>
            ))}
            {type !== "game" && text.trim() && <button type="button" onClick={() => add(null)}><span className="noimg" /><span className="name">“{text.trim()}” olarak ekle</span></button>}
            {!found.length && type === "game" && <div className="note">Sonuç yok.</div>}
            <span className="credit">Veri: <a href={credit[1]} target="_blank" rel="noopener">{credit[0]}</a></span>
          </div>
        )}
      </div>
    </section>
  );
}
