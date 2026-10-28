/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogItem, EntryType, PageEdit, Profile } from "@/lib/types";
import { BADGES, PROFILE_COLS, TYPES, TYPE_KEYS } from "@/lib/constants";
import { contentHref, likeEsc, safeUrl, timeAgo, today } from "@/lib/format";
import { countOf, q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { Avatar, Name, UserRow } from "@/components/ui";
import { NOTICE_TONES, type Notice, fetchNotice } from "@/components/Announcement";

const TABS = [["home", "Genel"], ["members", "Üyeler"], ["content", "İçerikler"], ["comments", "Yorumlar"]] as const;
type Tab = (typeof TABS)[number][0];
// Yöneticinin elle verebileceği rozetler (site sahibi / yönetici rozeti hariç)
const GRANTABLE = Object.keys(BADGES).filter((b) => b !== "owner" && b !== "admin");

// Yönetim paneli: sadece site sahibi ve yöneticiler girer (veritabanı da başkasına izin vermez)
export default function AdminPage() {
  const { me, ready, isAdmin } = useApp();
  const [tab, setTab] = useState<Tab>("home");
  if (!supabaseConfigured()) return <div className="empty">Supabase ayarları eksik.</div>;
  if (!ready) return <div className="loading">Yükleniyor…</div>;
  if (!me || !isAdmin) return <div className="empty">Bu sayfa sadece yöneticiler için. </div>;
  return (
    <>
      <section className="search-hero">
        <h1>Yönetim paneli</h1>
        <p className="muted" style={{ margin: 0 }}>
          Bir oyunun, filmin ya da albümün sayfasını düzeltmek için o sayfaya git ve <b>Sayfayı düzenle</b>&apos;ye bas.
          Uygunsuz yorumları kayıt penceresinden silebilirsin.
        </p>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      </section>
      {tab === "home" && <><Overview /><NoticeEditor /></>}
      {tab === "members" && <><Admins /><Members /><BlockedWords /></>}
      {tab === "content" && <><Catalog /><Edits /></>}
      {tab === "comments" && <Comments />}
    </>
  );
}

function Admins() {
  const { isOwner, toast, loadBadges } = useApp();
  const [v, setV] = useState(0);
  const [name, setName] = useState("");
  const { data } = useLoad(async () => {
    const rows = await q<{ user_id: string; badge: string }[]>(sb().from("user_badges").select("user_id, badge").in("badge", ["owner", "admin"]));
    const ids = [...new Set(rows.map((r) => r.user_id))];
    const people = ids.length ? await q<Profile[]>(sb().from("profiles").select("*").in("id", ids)) : [];
    return people.map((p) => ({ p, owner: rows.some((r) => r.user_id === p.id && r.badge === "owner") }));
  }, [v]);

  async function set(username: string, on: boolean) {
    if (!on && !confirm(`@${username} artık yönetici olmasın mı?`)) return;
    const { error } = await sb().rpc("set_admin", { p_username: username, p_on: on });
    if (error) return toast("Olmadı: " + error.message);
    toast(on ? `@${username} artık yönetici ` : `@${username} yöneticilikten çıkarıldı`);
    setName("");
    setV((x) => x + 1);
    loadBadges();
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Yöneticiler</h2></div>
      {isOwner && (
        <form className="admin-add" onSubmit={(e) => { e.preventDefault(); if (name.trim()) set(name.trim().replace(/^@/, ""), true); }}>
          <input className="input" placeholder="Kullanıcı adı (ör. bensezar)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit">Yönetici yap</button>
        </form>
      )}
      <div className="user-list">
        {data?.map(({ p, owner }) => (
          <div key={p.id} className="admin-row">
            <UserRow p={p} />
            {owner ? <span className="tag">Site sahibi</span>
              : isOwner ? <button className="btn danger" onClick={() => set(p.username, false)}>Çıkar</button> : null}
          </div>
        ))}
      </div>
      {!isOwner && <p className="muted" style={{ fontSize: 13 }}>Yönetici ekleyip çıkarmayı sadece site sahibi yapabilir.</p>}
    </section>
  );
}

// Kullanıcıların elle / linkle eklediği ortak içerikler: düzelt, sil, kopyaları birleştir
function Catalog() {
  const { toast, refresh, version } = useApp();
  const [type, setType] = useState<EntryType>("music");
  const [text, setText] = useState("");
  const [v, setV] = useState(0);
  const [editing, setEditing] = useState<CatalogItem | null>(null);
  const [merging, setMerging] = useState<CatalogItem | null>(null);
  const reload = () => { setV((x) => x + 1); refresh(); };

  const { data } = useLoad(async () => {
    let req = sb().from("catalog").select("*").eq("type", type).order("created_at", { ascending: false }).limit(100);
    if (text.trim()) req = req.ilike("title", `%${likeEsc(text.trim())}%`);
    const rows = await q<CatalogItem[]>(req).catch(() => null);
    if (!rows) return null;
    const ids = [...new Set(rows.map((r) => r.created_by).filter(Boolean))] as string[];
    const people = ids.length ? await q<Profile[]>(sb().from("profiles").select("id, username").in("id", ids)) : [];
    return { rows, who: new Map(people.map((p) => [p.id, p.username])) };
  }, [type, text, v, version]);

  async function remove(c: CatalogItem) {
    if (!confirm(`“${c.title}” katalogdan silinsin mi? Bunu loglayanların kayıtları silinmez, sadece aramada çıkmaz.`)) return;
    try { await q(sb().from("catalog").delete().eq("id", c.id)); toast("Silindi"); reload(); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  async function merge(into: CatalogItem) {
    if (!merging || !confirm(`“${merging.title}” → “${into.title}” ile birleştirilsin mi? Kopyayı loglayanların kaydı asıl içeriğe bağlanır.`)) return;
    const { error } = await sb().rpc("merge_catalog", { p_from: merging.id, p_into: into.id });
    if (error) return toast("Olmadı: " + error.message);
    toast("Birleştirildi ✓");
    setMerging(null);
    reload();
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Kullanıcıların eklediği içerikler</h2><span className="muted">{data ? `${data.rows.length} içerik` : ""}</span></div>
      <p className="muted" style={{ marginTop: 0, fontSize: 14 }}>
        Aramada çıkmayıp elle ya da linkle eklenen şarkılar, albümler… Her biri bir kez kaydedilir, başkası aynısını eklemek isteyince bu kayıt çıkar.
        Burada adını düzeltirsen onu loglayan herkesin kaydı da düzelir.
      </p>
      <div className="tabs">
        {TYPE_KEYS.filter((k) => k !== "game").map((k) => (
          <button key={k} className={`tab ${type === k ? "active" : ""}`} onClick={() => { setType(k); setMerging(null); }}>{TYPES[k].label}</button>
        ))}
      </div>
      <input className="input" type="search" placeholder="Ara…" value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", margin: "12px 0" }} />
      {merging && (
        <div className="banner">
          <span><b>{merging.title}</b> hangi içerikle birleşsin? Aşağıdan asıl olanın yanındaki <b>Buna birleştir</b>&apos;e bas.</span>
          <button className="btn ghost" onClick={() => setMerging(null)}>Vazgeç</button>
        </div>
      )}
      {data === null ? <div className="empty">Katalog henüz kurulmamış. Önce 004 SQL&apos;ini çalıştır.</div>
        : !data ? <div className="loading">Yükleniyor…</div>
        : !data.rows.length ? <div className="empty">Burada henüz bir şey yok.</div> : (
          <div className="admin-list">
            {data.rows.map((c) => editing?.id === c.id ? <CatalogEditor key={c.id} c={c} onDone={(saved) => { setEditing(null); if (saved) reload(); }} /> : (
              <div key={c.id} className={`admin-item ${merging?.id === c.id ? "sel" : ""}`}>
                {safeUrl(c.cover) ? <img src={c.cover!} alt="" /> : <span className="noimg"></span>}
                <div className="info">
                  <Link href={contentHref(c)}><b>{c.title}</b></Link>
                  <span>{[c.creator, c.year, c.ext_id.split(":")[0] === "cat" ? "elle eklendi" : "linkle eklendi"].filter(Boolean).join(" · ")}</span>
                  <small>{data.who.get(c.created_by || "") ? `@${data.who.get(c.created_by!)} · ` : ""}{timeAgo(c.created_at)}</small>
                </div>
                <div className="acts">
                  {merging ? (merging.id !== c.id && <button className="btn primary" onClick={() => merge(c)}>Buna birleştir</button>) : (
                    <>
                      <button className="btn" onClick={() => setEditing(c)}>Düzenle</button>
                      <button className="btn" onClick={() => setMerging(c)} title="Aynı içeriğin kopyasıysa birleştir">Birleştir</button>
                      <button className="btn danger" onClick={() => remove(c)}>Sil</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
    </section>
  );
}

function CatalogEditor({ c, onDone }: { c: CatalogItem; onDone: (saved: boolean) => void }) {
  const { toast } = useApp();
  const [f, setF] = useState({ title: c.title, creator: c.creator || "", year: c.year ? String(c.year) : "", cover: c.cover || "" });
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF((x) => ({ ...x, [k]: e.target.value }));

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (!f.title.trim()) return toast("Ad boş olamaz");
    if (f.cover && !safeUrl(f.cover)) return toast("Kapak linki https:// ile başlamalı");
    try {
      await q(sb().from("catalog").update({ title: f.title.trim(), creator: f.creator.trim() || null, year: parseInt(f.year) || null, cover: f.cover.trim() || null }).eq("id", c.id));
      toast("Düzeltildi ✓ Loglayanların kayıtları da güncellendi");
      onDone(true);
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    }
  }

  return (
    <form className="admin-item editing" onSubmit={save}>
      <input className="input" value={f.title} onChange={set("title")} placeholder="Ad" maxLength={200} />
      <input className="input" value={f.creator} onChange={set("creator")} placeholder={TYPES[c.type].creator} maxLength={200} />
      <input className="input year" value={f.year} onChange={set("year")} placeholder="Yıl" inputMode="numeric" maxLength={4} />
      <input className="input" value={f.cover} onChange={set("cover")} placeholder="Kapak linki" />
      <div className="acts">
        <button className="btn" type="button" onClick={() => onDone(false)}>Vazgeç</button>
        <button className="btn primary" type="submit">Kaydet</button>
      </div>
    </form>
  );
}

// İçerik sayfalarında yapılan elle düzeltmeler
function Edits() {
  const { toast, version } = useApp();
  const [v, setV] = useState(0);
  const { data } = useLoad(() => q<{ key: string; data: PageEdit; updated_at: string }[]>(
    sb().from("content_edits").select("key, data, updated_at").order("updated_at", { ascending: false }).limit(100)).catch(() => null), [v, version]);

  const href = (key: string) => {
    if (key.startsWith("g:")) return `/game/${key.slice(2)}`;
    const i = key.indexOf(":");
    return `/c/${key.slice(0, i)}/${encodeURIComponent(key.slice(i + 1))}`;
  };

  async function remove(key: string) {
    if (!confirm("Bu sayfadaki elle düzeltmeler kaldırılsın mı?")) return;
    try { await q(sb().from("content_edits").delete().eq("key", key)); toast("Kaldırıldı"); setV((x) => x + 1); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  if (!data?.length) return null;
  return (
    <section className="section">
      <div className="section-head"><h2>Düzenlenmiş sayfalar</h2></div>
      <div className="admin-list">
        {data.map((e) => (
          <div key={e.key} className="admin-item">
            <span className="noimg">{e.key.startsWith("g:") ? "" : TYPES[e.key.split(":")[0] as EntryType]?.label || ""}</span>
            <div className="info">
              <Link href={href(e.key)}><b>{e.data.title || e.key.slice(e.key.indexOf(":") + 1)}</b></Link>
              <span>Değişenler: {Object.keys(e.data).map((k) => ({ title: "ad", creator: "yapımcı", year: "yıl", cover: "kapak", backdrop: "arka plan", description: "açıklama", genres: "türler" })[k] || k).join(", ")}</span>
              <small>{timeAgo(e.updated_at)}</small>
            </div>
            <div className="acts"><button className="btn danger" onClick={() => remove(e.key)}>Kaldır</button></div>
          </div>
        ))}
      </div>
    </section>
  );
}

// Site geneli sayılar ve son katılanlar
function Overview() {
  const { version } = useApp();
  const { data } = useLoad(async () => {
    const db = sb();
    const head = { count: "exact" as const, head: true };
    const week = new Date(Date.now() - 7 * 86400000).toISOString();
    const [members, entries, todayEntries, newMembers, comments, likes, lists, recent] = await Promise.all([
      countOf(db.from("profiles").select("id", head)),
      countOf(db.from("entries").select("id", head)),
      countOf(db.from("entries").select("id", head).gte("created_at", today())),
      countOf(db.from("profiles").select("id", head).gte("created_at", week)),
      countOf(db.from("comments").select("id", head)),
      countOf(db.from("likes").select("entry_id", head)),
      countOf(db.from("lists").select("id", head)),
      q<Profile[]>(db.from("profiles").select("*").order("created_at", { ascending: false }).limit(6)),
    ]);
    return { members, entries, todayEntries, newMembers, comments, likes, lists, recent };
  }, [version]);

  if (!data) return <div className="loading">Yükleniyor…</div>;
  const tiles: [number, string][] = [
    [data.members, "Üye"], [data.newMembers, "Bu hafta katılan"], [data.entries, "Toplam kayıt"], [data.todayEntries, "Bugün eklenen kayıt"],
    [data.comments, "Yorum"], [data.likes, "Beğeni"], [data.lists, "Liste"],
  ];
  return (
    <>
      <section className="section"><div className="stats">{tiles.map(([n, l]) => <div className="stat" key={l}><b>{n.toLocaleString("tr")}</b><span>{l}</span></div>)}</div></section>
      <section className="section">
        <div className="section-head"><h2>Son katılanlar</h2></div>
        <div className="user-list">
          {data.recent.map((p) => <div key={p.id} className="admin-row"><UserRow p={p} /><span className="muted small">{timeAgo(p.created_at)}</span></div>)}
        </div>
      </section>
    </>
  );
}

// Herkesin sayfanın üstünde göreceği duyuru
function NoticeEditor() {
  const { me, toast, refresh } = useApp();
  const [f, setF] = useState<Notice | null>(null);
  const { data } = useLoad(fetchNotice, []);
  const cur = f ?? data?.value ?? {};

  async function save(ev: React.FormEvent) {
    ev.preventDefault();
    if (cur.link && !/^https?:\/\//.test(cur.link)) return toast("Bağlantı https:// ile başlamalı");
    try {
      const table = sb().from("site_settings");
      if (cur.text?.trim()) {
        await q(table.upsert({ key: "announcement", value: { text: cur.text.trim(), tone: cur.tone || "info", link: cur.link?.trim() || undefined },
          updated_by: me?.id, updated_at: new Date().toISOString() }, { onConflict: "key" }));
        toast("Duyuru yayında ✓");
      } else {
        await q(table.delete().eq("key", "announcement"));
        toast("Duyuru kaldırıldı");
      }
      refresh();
    } catch (err) {
      toast("Olmadı: " + (err as Error).message);
    }
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Duyuru</h2></div>
      <form className="admin-notice" onSubmit={save}>
        <p className="muted small" style={{ margin: 0 }}>Yazdığın şey herkesin ekranının üstünde görünür. Kaldırmak için kutuyu boşaltıp kaydet.</p>
        <textarea className="input" rows={2} maxLength={300} placeholder="ör. Yeni özellik: profiline şarkı ekleyebilirsin!" value={cur.text || ""}
          onChange={(e) => setF({ ...cur, text: e.target.value })} />
        <div className="admin-add">
          <select value={cur.tone || "info"} onChange={(e) => setF({ ...cur, tone: e.target.value as Notice["tone"] })} aria-label="Duyuru türü">
            {NOTICE_TONES.map(([t, l]) => <option key={t} value={t}>{l}</option>)}
          </select>
          <input className="input" type="url" placeholder="Bağlantı (isteğe bağlı) https://…" value={cur.link || ""} onChange={(e) => setF({ ...cur, link: e.target.value })} />
          <button className="btn primary" type="submit">Kaydet</button>
        </div>
      </form>
    </section>
  );
}

// Üye ara, rozet ver / al
function Members() {
  const { badges, loadBadges, toast, isOwner } = useApp();
  const [text, setText] = useState("");
  const [v, setV] = useState(0);
  const { data } = useLoad(() => {
    const term = text.trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    const req = sb().from("profiles").select("*").limit(30);
    return q<Profile[]>(term ? req.ilike("username", `%${term}%`) : req.order("created_at", { ascending: false }));
  }, [text, v]);

  // Sadece site sahibi: hesabı ve her şeyini siler, istenirse e-postasıyla tekrar kayıt olmasını da engeller
  async function removeUser(p: Profile) {
    if (prompt(`@${p.username} hesabı ve bütün kayıtları, yorumları, mesajları KALICI olarak silinecek.
Onaylamak için kullanıcı adını yaz:`)?.trim().toLowerCase() !== p.username) return;
    const ban = confirm(`@${p.username} aynı e-postayla tekrar kayıt olamasın mı?

Tamam = engelle, İptal = sadece sil`);
    const { error } = await sb().rpc("admin_delete_user", { p_username: p.username, p_ban: ban });
    if (error) return toast("Olmadı: " + error.message);
    toast(`@${p.username} silindi${ban ? " ve engellendi" : ""}`);
    setV((x) => x + 1);
    loadBadges();
  }

  async function toggle(p: Profile, badge: string, on: boolean) {
    if (!on && !confirm(`@${p.username} kullanıcısının “${BADGES[badge].name}” rozeti alınsın mı?`)) return;
    const { error } = await sb().rpc("set_badge", { p_username: p.username, p_badge: badge, p_on: on });
    if (error) return toast("Olmadı: " + error.message);
    toast(on ? `@${p.username}: ${BADGES[badge].name} rozeti verildi` : "Rozet alındı");
    loadBadges();
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Üyeler ve rozetler</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>Rozete basınca verilir, renkli olana basınca geri alınır. Verilen rozet profilinde görünür.</p>
      <input className="input" type="search" placeholder="Kullanıcı ara…" value={text} onChange={(e) => setText(e.target.value)} style={{ width: "100%", marginBottom: 12 }} />
      <div className="admin-list">
        {data?.map((p) => {
          const has = badges.get(p.id) || [];
          return (
            <div key={p.id} className="admin-item member">
              <Link href={`/u/${p.username}`}><Avatar p={p} /></Link>
              <div className="info">
                <Link href={`/u/${p.username}`}><b><Name p={p} /></b></Link>
                <small>@{p.username} · {timeAgo(p.created_at)} katıldı</small>
              </div>
              <div className="badge-toggles">
                {GRANTABLE.map((b) => (
                  <button key={b} className={`bdg-t ${has.includes(b) ? "on" : ""}`} title={`${BADGES[b].name}: ${BADGES[b].desc}`}
                    onClick={() => toggle(p, b, !has.includes(b))}>{BADGES[b].name}</button>
                ))}
              </div>
              {isOwner && !has.includes("owner") && <div className="acts"><button className="btn danger" onClick={() => removeUser(p)}>Hesabı sil</button></div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface AdminComment { id: string; body: string; created_at: string; user_id: string; entry_id: string;
  profiles: Partial<Profile> | null; entries: { title: string; user_id: string } | null }

// Son yorumlar: uygunsuz olanı sil
function Comments() {
  const { toast } = useApp();
  const [v, setV] = useState(0);
  const { data } = useLoad(async () => {
    const rows = await q<AdminComment[]>(sb().from("comments").select(`id, body, created_at, user_id, entry_id, profiles(${PROFILE_COLS}), entries(title, user_id)`)
      .order("created_at", { ascending: false }).limit(50));
    const ids = [...new Set(rows.map((c) => c.entries?.user_id).filter(Boolean))] as string[];
    const owners = ids.length ? await q<Profile[]>(sb().from("profiles").select("id, username").in("id", ids)) : [];
    return { rows, owner: new Map(owners.map((o) => [o.id, o.username])) };
  }, [v]);

  async function remove(c: AdminComment) {
    if (!confirm(`Bu yorum silinsin mi?\n\n“${c.body.slice(0, 120)}”`)) return;
    try { await q(sb().from("comments").delete().eq("id", c.id)); toast("Yorum silindi"); setV((x) => x + 1); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  if (!data) return <div className="loading">Yükleniyor…</div>;
  return (
    <section className="section">
      <div className="section-head"><h2>Son yorumlar</h2><span className="muted">{data.rows.length} yorum</span></div>
      {!data.rows.length ? <div className="empty">Henüz yorum yok.</div> : (
        <div className="admin-list">
          {data.rows.map((c) => {
            const owner = data.owner.get(c.entries?.user_id || "");
            return (
              <div key={c.id} className="admin-item">
                <Link href={`/u/${c.profiles?.username}`}><Avatar p={c.profiles || {}} /></Link>
                <div className="info">
                  <span><Link href={`/u/${c.profiles?.username}`}><b><Name p={c.profiles || {}} /></b></Link>
                    {owner && <> → <Link href={`/u/${owner}?entry=${c.entry_id}`}>@{owner} · {c.entries?.title}</Link></>}</span>
                  <p className="admin-comment">{c.body}</p>
                  <small>{timeAgo(c.created_at)}</small>
                </div>
                <div className="acts"><button className="btn danger" onClick={() => remove(c)}>Sil</button></div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// Kullanıcı adında ve görünen adda geçemeyecek kelimeler
function BlockedWords() {
  const { toast } = useApp();
  const [word, setWord] = useState("");
  const [v, setV] = useState(0);
  const { data } = useLoad(() => q<{ word: string }[]>(sb().from("blocked_words").select("word").order("created_at", { ascending: false })).catch(() => null), [v]);
  const clean = (w: string) => w.toLowerCase().replace(/[^a-z0-9]/g, "");

  async function add(ev: React.FormEvent) {
    ev.preventDefault();
    const w = clean(word);
    if (w.length < 2) return toast("En az 2 harf yaz");
    try { await q(sb().from("blocked_words").insert({ word: w })); setWord(""); setV((x) => x + 1); toast(`“${w}” yasaklandı`); }
    catch (err) { toast("Olmadı: " + (err as Error).message); }
  }
  async function remove(w: string) {
    try { await q(sb().from("blocked_words").delete().eq("word", w)); setV((x) => x + 1); } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Yasaklı kelimeler</h2></div>
      <p className="muted small" style={{ marginTop: 0 }}>Bu kelimeler kullanıcı adında ya da görünen adda geçerse kayıt olunamaz, ad değiştirilemez. Boşluk ve alt çizgi yok sayılır.</p>
      {data === null ? <div className="empty">Önce 008 SQL&apos;ini çalıştır.</div> : (
        <>
          <form className="admin-add" onSubmit={add}>
            <input className="input" placeholder="ör. küfür ya da isim" value={word} onChange={(e) => setWord(e.target.value)} maxLength={30} />
            <button className="btn primary" type="submit">Yasakla</button>
          </form>
          <div className="chips">
            {data?.map(({ word: w }) => <button key={w} className="chip" title="Yasağı kaldır" onClick={() => remove(w)}>{w} ✕</button>)}
            {data?.length === 0 && <span className="muted small">Henüz yasaklı kelime yok.</span>}
          </div>
        </>
      )}
    </section>
  );
}
