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

const TABS = [["home", "Genel"], ["reports", "Raporlar"], ["members", "Üyeler"], ["content", "İçerikler"], ["comments", "Moderasyon"]] as const;
type Tab = (typeof TABS)[number][0];
// Yöneticinin elle verebileceği rozetler (site sahibi / yönetici rozeti hariç)
const GRANTABLE = Object.keys(BADGES).filter((b) => b !== "owner" && b !== "admin" && b !== "dev");

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
          Uygunsuz inceleme, yorum, forum mesajı ve listeleri <b>Moderasyon</b>&apos;dan; kişileri susturmak ya da profilini temizlemek için <b>Üyeler</b>&apos;e bak.
        </p>
        <div className="tabs" style={{ marginBottom: 0 }}>
          {TABS.map(([k, label]) => <button key={k} className={`tab ${tab === k ? "active" : ""}`} onClick={() => setTab(k)}>{label}</button>)}
        </div>
      </section>
      {tab === "home" && <><Overview /><NoticeEditor /></>}
      {tab === "reports" && <Reports />}
      {tab === "members" && <><Admins /><Members /><BlockedWords /></>}
      {tab === "content" && <><Catalog /><Edits /></>}
      {tab === "comments" && <><Reviews /><Comments /><ForumPosts /><PublicLists /></>}
    </>
  );
}

function Admins() {
  const { isAdmin, toast, loadBadges } = useApp();
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
      {isAdmin && (
        <form className="admin-add" onSubmit={(e) => { e.preventDefault(); if (name.trim()) set(name.trim().replace(/^@/, ""), true); }}>
          <input className="input" placeholder="Kullanıcı adı (ör. bensezar)" value={name} onChange={(e) => setName(e.target.value)} />
          <button className="btn primary" type="submit">Yönetici yap</button>
        </form>
      )}
      <div className="user-list">
        {data?.map(({ p, owner }) => (
          <div key={p.id} className="admin-row">
            <UserRow p={p} />
            {owner ? <span className="tag">Kurucu</span>
              : isAdmin ? <button className="btn danger" onClick={() => set(p.username, false)}>Çıkar</button> : null}
          </div>
        ))}
      </div>
      <p className="muted" style={{ fontSize: 13 }}>Yöneticiler senin yetkilerine sahiptir (sadece site sahibine işlem yapamazlar); yönetici yaptığın kişiye Yönetici rozeti kendiliğinden gelir. Üyeler listesinden de tek tıkla yönetici yapabilirsin.</p>
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
const MUTES: [number, string][] = [[1, "1 saat"], [24, "1 gün"], [72, "3 gün"], [168, "1 hafta"], [720, "1 ay"], [87600, "Süresiz"]];
const PARTS: [string, string, (p: Profile) => unknown][] = [
  ["name", "Görünen ad", (p) => p.display_name], ["bio", "Hakkında yazısı", (p) => p.bio], ["avatar", "Profil fotoğrafı", (p) => p.avatar_url],
  ["banner", "Kapak", (p) => p.banner_url], ["bg", "Arka plan", (p) => p.bg_url], ["song", "Profil şarkısı", (p) => p.song_url],
  ["home", "Ana sayfa yazısı", (p) => p.home_layout?.text],
];
const mutedNow = (p: Profile) => !!p.muted_until && p.muted_until > new Date().toISOString();

function Members() {
  const { badges, loadBadges, toast } = useApp();
  const [cleaning, setCleaning] = useState<{ id: string; parts: Set<string> } | null>(null);
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

  // Yönetici site sahibine, diğer yöneticilere sadece site sahibi işlem yapabilir (veritabanı da denetler)
  const canModerate = (p: Profile) => {
    const has = badges.get(p.id) || [];
    return !has.includes("owner");
  };

  // Tek tıkla yönetici yap / çıkar (Yönetici rozeti kendiliğinden gelir, gider)
  async function setAdmin(p: Profile, on: boolean) {
    if (!confirm(on ? `@${p.username} yönetici olsun mu? Senin yetkilerine sahip olur (site sahibine işlem yapamaz).` : `@${p.username} artık yönetici olmasın mı?`)) return;
    const { error } = await sb().rpc("set_admin", { p_username: p.username, p_on: on });
    if (error) return toast("Olmadı: " + error.message);
    toast(on ? `@${p.username} artık yönetici` : `@${p.username} yöneticilikten çıkarıldı`);
    loadBadges();
    setV((x) => x + 1);
  }

  async function mute(p: Profile, hours: number) {
    if (hours && !confirm(`@${p.username} ${MUTES.find(([h]) => h === hours)?.[1].toLocaleLowerCase("tr")} susturulsun mu? Bu sürede yorum, forum mesajı ve mesaj yazamaz (sana yazabilir).`)) return;
    const { error } = await sb().rpc("admin_mute", { p_username: p.username, p_hours: hours });
    if (error) return toast("Olmadı: " + error.message);
    toast(hours ? `@${p.username} susturuldu` : "Susturma kaldırıldı");
    setV((x) => x + 1);
  }

  async function clean(p: Profile) {
    if (!cleaning?.parts.size) return;
    const names = PARTS.filter(([k]) => cleaning.parts.has(k)).map(([, n]) => n).join(", ");
    if (!confirm(`@${p.username} profilinden silinsin mi: ${names}?`)) return;
    const { error } = await sb().rpc("admin_reset_profile", { p_username: p.username, p_parts: [...cleaning.parts] });
    if (error) return toast("Olmadı: " + error.message);
    toast("Profil temizlendi");
    setCleaning(null);
    setV((x) => x + 1);
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
                <small>@{p.username} · {timeAgo(p.created_at)} katıldı
                  {mutedNow(p) && <b className="muted-tag"> · {new Date(p.muted_until!).getFullYear() > new Date().getFullYear() + 5 ? "süresiz susturuldu" : `${new Date(p.muted_until!).toLocaleString("tr", { dateStyle: "short", timeStyle: "short" })} tarihine kadar susturuldu`}</b>}</small>
              </div>
              <div className="badge-toggles">
                {GRANTABLE.map((b) => (
                  <button key={b} className={`bdg-t ${has.includes(b) ? "on" : ""}`} title={`${BADGES[b].name}: ${BADGES[b].desc}`}
                    onClick={() => toggle(p, b, !has.includes(b))}>{BADGES[b].name}</button>
                ))}
              </div>
              {canModerate(p) && (
                <div className="acts">
                  <select className="btn" value="" aria-label="Sustur" onChange={(e) => mute(p, Number(e.target.value))}>
                    <option value="" disabled>{mutedNow(p) ? "Susturuldu" : "Sustur"}</option>
                    {mutedNow(p) && <option value="0">Susturmayı kaldır</option>}
                    {MUTES.map(([h, label]) => <option key={h} value={h}>{label}</option>)}
                  </select>
                  <button className="btn" onClick={() => setCleaning(cleaning?.id === p.id ? null : { id: p.id, parts: new Set() })}>Profili temizle</button>
                  <button className="btn" onClick={() => setAdmin(p, !has.includes("admin"))}>{has.includes("admin") ? "Yöneticilikten çıkar" : "Yönetici yap"}</button>
                  <button className="btn danger" onClick={() => removeUser(p)}>Hesabı sil</button>
                </div>
              )}
              {cleaning?.id === p.id && (
                <div className="admin-clean">
                  {PARTS.filter(([, , has]) => has(p)).length ? <>
                    <span className="muted small">Silinecekleri seç:</span>
                    {PARTS.filter(([, , has]) => has(p)).map(([k, label]) => (
                      <label key={k} className="check"><input type="checkbox" checked={cleaning.parts.has(k)}
                        onChange={() => setCleaning((c) => { const n = new Set(c!.parts); if (n.has(k)) n.delete(k); else n.add(k); return { id: p.id, parts: n }; })} /> {label}</label>
                    ))}
                    <button className="btn danger" disabled={!cleaning.parts.size} onClick={() => clean(p)}>Seçilenleri sil</button>
                  </> : <span className="muted small">Bu profilde temizlenecek bir şey yok.</span>}
                </div>
              )}
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

interface AdminEntry { id: string; title: string; notes: string | null; updated_at: string; user_id: string; profiles: Partial<Profile> | null }

// Son incelemeler: uygunsuz incelemeyi kaldır ya da kaydı tamamen sil
function Reviews() {
  const { toast } = useApp();
  const [v, setV] = useState(0);
  const { data } = useLoad(() => q<AdminEntry[]>(sb().from("entries").select(`id, title, notes, updated_at, user_id, profiles(${PROFILE_COLS})`)
    .not("notes", "is", null).order("updated_at", { ascending: false }).limit(40)), [v]);

  async function act(e: AdminEntry, kind: "review" | "entry") {
    const msg = kind === "review" ? `@${e.profiles?.username} kullanıcısının “${e.title}” incelemesi ve notları kaldırılsın mı?` : `@${e.profiles?.username} kullanıcısının “${e.title}” kaydı tamamen silinsin mi?`;
    if (!confirm(msg)) return;
    const { error } = await sb().rpc(kind === "review" ? "admin_clear_review" : "admin_delete_entry", { p_entry: e.id });
    if (error) return toast("Olmadı: " + error.message);
    toast(kind === "review" ? "İnceleme kaldırıldı" : "Kayıt silindi");
    setV((x) => x + 1);
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Son incelemeler</h2></div>
      {!data ? <div className="loading">Yükleniyor…</div> : !data.filter((e) => e.notes?.trim()).length ? <div className="empty">Henüz inceleme yok.</div> : (
        <div className="admin-list">
          {data.filter((e) => e.notes?.trim()).map((e) => (
            <div key={e.id} className="admin-item">
              <Link href={`/u/${e.profiles?.username}`}><Avatar p={e.profiles || {}} /></Link>
              <div className="info">
                <span><Link href={`/u/${e.profiles?.username}`}><b><Name p={e.profiles || {}} /></b></Link> → <Link href={`/u/${e.profiles?.username}?entry=${e.id}`}>{e.title}</Link></span>
                <p className="admin-comment">{e.notes}</p>
                <small>{timeAgo(e.updated_at)}</small>
              </div>
              <div className="acts">
                <button className="btn" onClick={() => act(e, "review")}>İncelemeyi kaldır</button>
                <button className="btn danger" onClick={() => act(e, "entry")}>Kaydı sil</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface AdminPost { id: string; body: string; created_at: string; thread_id: string; profiles: Partial<Profile> | null; forum_threads: { title: string } | null }
interface AdminThread { id: string; title: string; body: string; created_at: string; profiles: Partial<Profile> | null }

// Forum: son konular ve cevaplar
function ForumPosts() {
  const { toast } = useApp();
  const [v, setV] = useState(0);
  const { data } = useLoad(async () => {
    const [threads, posts] = await Promise.all([
      q<AdminThread[]>(sb().from("forum_threads").select(`id, title, body, created_at, profiles(${PROFILE_COLS})`).order("created_at", { ascending: false }).limit(15)),
      q<AdminPost[]>(sb().from("forum_posts").select(`id, body, created_at, thread_id, profiles(${PROFILE_COLS}), forum_threads(title)`).order("created_at", { ascending: false }).limit(30)),
    ]);
    return [
      ...threads.map((t) => ({ kind: "thread" as const, id: t.id, link: t.id, head: t.title, body: t.body, at: t.created_at, p: t.profiles })),
      ...posts.map((x) => ({ kind: "post" as const, id: x.id, link: x.thread_id, head: x.forum_threads?.title || "", body: x.body, at: x.created_at, p: x.profiles })),
    ].sort((a, b) => b.at.localeCompare(a.at));
  }, [v]);

  async function remove(kind: "thread" | "post", id: string) {
    if (!confirm(kind === "thread" ? "Bu konu bütün cevaplarıyla silinsin mi?" : "Bu cevap silinsin mi?")) return;
    try { await q(sb().from(kind === "thread" ? "forum_threads" : "forum_posts").delete().eq("id", id)); toast("Silindi"); setV((x) => x + 1); }
    catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Forum</h2><Link href="/forum">Foruma git →</Link></div>
      {!data ? <div className="loading">Yükleniyor…</div> : !data.length ? <div className="empty">Forumda henüz bir şey yok.</div> : (
        <div className="admin-list">
          {data.map((x) => (
            <div key={x.kind + x.id} className="admin-item">
              <Link href={`/u/${x.p?.username}`}><Avatar p={x.p || {}} /></Link>
              <div className="info">
                <span><Link href={`/u/${x.p?.username}`}><b><Name p={x.p || {}} /></b></Link> {x.kind === "thread" ? "konu açtı:" : "cevap yazdı:"} <Link href={`/forum/${x.link}`}>{x.head}</Link></span>
                <p className="admin-comment">{x.body}</p>
                <small>{timeAgo(x.at)}</small>
              </div>
              <div className="acts"><button className="btn danger" onClick={() => remove(x.kind, x.id)}>{x.kind === "thread" ? "Konuyu sil" : "Sil"}</button></div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

interface AdminList { id: string; title: string; description: string | null; updated_at: string; profiles: Partial<Profile> | null }

// Herkese açık listeler: uygunsuz olanı sil
function PublicLists() {
  const { toast } = useApp();
  const [v, setV] = useState(0);
  const { data } = useLoad(() => q<AdminList[]>(sb().from("lists").select(`id, title, description, updated_at, profiles(${PROFILE_COLS})`)
    .eq("is_public", true).order("updated_at", { ascending: false }).limit(30)), [v]);

  async function remove(l: AdminList) {
    if (!confirm(`@${l.profiles?.username} kullanıcısının “${l.title}” listesi silinsin mi? İçindekiler kişinin kütüphanesinde kalır.`)) return;
    const { error } = await sb().rpc("admin_delete_list", { p_list: l.id });
    if (error) return toast("Olmadı: " + error.message);
    toast("Liste silindi");
    setV((x) => x + 1);
  }

  return (
    <section className="section">
      <div className="section-head"><h2>Herkese açık listeler</h2></div>
      {!data ? <div className="loading">Yükleniyor…</div> : !data.length ? <div className="empty">Henüz liste yok.</div> : (
        <div className="admin-list">
          {data.map((l) => (
            <div key={l.id} className="admin-item">
              <Link href={`/u/${l.profiles?.username}`}><Avatar p={l.profiles || {}} /></Link>
              <div className="info">
                <span><Link href={`/u/${l.profiles?.username}`}><b><Name p={l.profiles || {}} /></b></Link> → <Link href={`/list/${l.id}`}>{l.title}</Link></span>
                {l.description && <p className="admin-comment">{l.description}</p>}
                <small>{timeAgo(l.updated_at)} güncellendi</small>
              </div>
              <div className="acts"><button className="btn danger" onClick={() => remove(l)}>Listeyi sil</button></div>
            </div>
          ))}
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

// ---------- Raporlar: kullanıcıların raporladıkları; içeriği sil, yazana uyarı gönder, banla ya da bir şey yapmadan kapat ----------
interface Report {
  id: string; kind: string; target_id: string; target_user: string | null; reason: string; note: string | null; excerpt: string | null;
  status: "open" | "resolved" | "dismissed"; created_at: string; reporter: Profile | null; target: Profile | null;
}
const KIND_NAMES: Record<string, string> = { profile: "Profil", entry: "Kayıt / inceleme", comment: "Yorum", list: "Liste", forum_thread: "Forum konusu", forum_post: "Forum cevabı", message: "Mesaj" };

function Reports() {
  const { toast, isAdmin, badges, loadBadges } = useApp();
  const [v, setV] = useState(0);
  const [show, setShow] = useState<"open" | "done">("open");
  const { data, error } = useLoad(() => {
    const req = sb().from("reports").select(`*, reporter:profiles!reports_reporter_id_fkey(${PROFILE_COLS}), target:profiles!reports_target_user_fkey(${PROFILE_COLS})`);
    return q<Report[]>((show === "open" ? req.eq("status", "open") : req.neq("status", "open")).order("created_at", { ascending: false }).limit(100));
  }, [v, show]);

  async function close(r: Report, status: "resolved" | "dismissed", msg: string) {
    try { await q(sb().from("reports").update({ status }).eq("id", r.id)); toast(msg); setV((x) => x + 1); }
    catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  // Raporlanan şeyin kendisini kaldır (türüne göre)
  async function removeContent(r: Report) {
    if (!confirm(`Raporlanan ${KIND_NAMES[r.kind].toLocaleLowerCase("tr")} silinsin mi?`)) return;
    let error: { message: string } | null = null;
    if (r.kind === "entry") ({ error } = await sb().rpc("admin_delete_entry", { p_entry: r.target_id }));
    else if (r.kind === "list") ({ error } = await sb().rpc("admin_delete_list", { p_list: r.target_id }));
    else if (r.kind === "comment") ({ error } = await sb().from("comments").delete().eq("id", r.target_id));
    else if (r.kind === "forum_thread") ({ error } = await sb().from("forum_threads").delete().eq("id", r.target_id));
    else if (r.kind === "forum_post") ({ error } = await sb().from("forum_posts").delete().eq("id", r.target_id));
    else if (r.kind === "profile" && r.target)
      ({ error } = await sb().rpc("admin_reset_profile", { p_username: r.target.username, p_parts: ["name", "bio", "avatar", "banner", "bg", "song", "home"] }));
    if (error) return toast("Olmadı: " + error.message);
    await close(r, "resolved", r.kind === "profile" ? "Profil temizlendi, rapor kapandı" : "İçerik silindi, rapor kapandı");
  }

  async function warn(r: Report) {
    if (!r.target) return;
    const body = prompt(`@${r.target.username} kişisine gidecek uyarı (siteye girince üstte görür):`,
      `${KIND_NAMES[r.kind]} için uyarı: "${r.reason}" sebebiyle raporlandı. Lütfen site kurallarına dikkat et.`);
    if (!body?.trim()) return;
    try {
      await q(sb().from("warnings").insert({ user_id: r.target.id, body: body.trim().slice(0, 1000) }));
      await close(r, "resolved", `@${r.target.username} kişisine uyarı gönderildi`);
    } catch (err) { toast("Olmadı: " + (err as Error).message); }
  }

  async function ban(r: Report) {
    const t = r.target;
    if (!t || !confirm(`@${t.username} süresiz susturulsun mu? Yorum, forum yazısı ve mesaj yazamaz (yönetime yazabilir). Üyeler sekmesinden istediğin zaman kaldırabilirsin.`)) return;
    const { error } = await sb().rpc("admin_mute", { p_username: t.username, p_hours: 87600 });
    if (error) return toast("Olmadı: " + error.message);
    await close(r, "resolved", `@${t.username} süresiz susturuldu`);
  }

  async function removeUser(r: Report) {
    const t = r.target;
    if (!t || prompt(`@${t.username} hesabı ve bütün kayıtları KALICI olarak silinecek, aynı e-postayla tekrar kayıt olamayacak. Onaylamak için kullanıcı adını yaz:`)?.trim().toLowerCase() !== t.username) return;
    const { error } = await sb().rpc("admin_delete_user", { p_username: t.username, p_ban: true });
    if (error) return toast("Olmadı: " + error.message);
    toast(`@${t.username} silindi ve engellendi`);
    setV((x) => x + 1);
    loadBadges();
  }

  // Site sahibine işlem yapılamaz (veritabanı da denetler)
  const canAct = (t: Profile | null) => !!t && isAdmin && !(badges.get(t.id) || []).includes("owner");
  const href = (r: Report) => r.kind === "profile" || r.kind === "message" ? `/u/${r.target?.username}`
    : r.kind === "entry" ? `/u/${r.target?.username}?entry=${r.target_id}` : r.kind === "list" ? `/list/${r.target_id}`
    : r.kind === "forum_thread" ? `/forum/${r.target_id}` : null;

  return (
    <section className="section">
      <div className="section-head">
        <h2>Raporlar</h2>
        <div className="mini-tabs">
          <button className={show === "open" ? "active" : ""} onClick={() => setShow("open")}>Bekleyenler</button>
          <button className={show === "done" ? "active" : ""} onClick={() => setShow("done")}>Kapananlar</button>
        </div>
      </div>
      {error ? <div className="muted">{error.includes("reports") ? "Raporlar için veritabanı henüz güncellenmemiş (020)." : error}</div>
        : !data ? <div className="loading">Yükleniyor…</div>
        : !data.length ? <div className="empty">{show === "open" ? "Bekleyen rapor yok. Her şey yolunda." : "Henüz kapanan rapor yok."}</div>
        : (
          <div className="report-list">
            {data.map((r) => {
              const link = href(r);
              return (
                <article key={r.id} className={`report-item ${r.status}`}>
                  <header>
                    <span className="ann-tag">{KIND_NAMES[r.kind] || r.kind}</span>
                    <b>{r.reason}</b>
                    <span className="muted small">{timeAgo(r.created_at)}</span>
                    {r.status !== "open" && <span className="muted small">· {r.status === "resolved" ? "işlem yapıldı" : "bir şey yapılmadı"}</span>}
                  </header>
                  <div className="report-who muted small">
                    {r.target ? <>Raporlanan: <Link href={`/u/${r.target.username}`}><b><Name p={r.target} /></b></Link> (@{r.target.username})</> : "Raporlanan kişi silinmiş"}
                    {" · "}Raporlayan: {r.reporter ? <Link href={`/u/${r.reporter.username}`}>@{r.reporter.username}</Link> : "silinmiş hesap"}
                  </div>
                  {r.excerpt && <blockquote className="report-excerpt">{r.excerpt}</blockquote>}
                  {r.note && <p className="report-note"><span className="muted small">Raporlayanın notu:</span> {r.note}</p>}
                  {r.status === "open" && (
                    <div className="report-actions">
                      {link && <Link className="btn" href={link} target="_blank">Gör</Link>}
                      {r.kind !== "message" && canAct(r.target) && <button className="btn danger-btn" onClick={() => removeContent(r)}>{r.kind === "profile" ? "Profili temizle" : "İçeriği sil"}</button>}
                      {canAct(r.target) && <button className="btn" onClick={() => warn(r)}>Uyarı gönder</button>}
                      {canAct(r.target) && <button className="btn danger-btn" onClick={() => ban(r)}>Banla (süresiz sustur)</button>}
                      {canAct(r.target) && <button className="btn danger-btn" onClick={() => removeUser(r)}>Hesabı sil</button>}
                      <span style={{ flex: 1 }} />
                      <button className="btn ghost" onClick={() => close(r, "dismissed", "Rapor kapatıldı, bir şey yapılmadı")}>Bir şey yapma</button>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
    </section>
  );
}
