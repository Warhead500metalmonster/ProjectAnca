/* eslint-disable @next/next/no-img-element */
"use client";

import { useState } from "react";
import Link from "next/link";
import type { CatalogItem, EntryType, PageEdit, Profile } from "@/lib/types";
import { TYPES, TYPE_KEYS } from "@/lib/constants";
import { contentHref, likeEsc, safeUrl, timeAgo } from "@/lib/format";
import { q, sb, supabaseConfigured } from "@/lib/supabase";
import { useLoad } from "@/lib/useLoad";
import { useApp } from "@/components/AppProvider";
import { UserRow } from "@/components/ui";

// Yönetim paneli: sadece site sahibi ve yöneticiler girer (veritabanı da başkasına izin vermez)
export default function AdminPage() {
  const { me, ready, isAdmin } = useApp();
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
      </section>
      <Admins />
      <Catalog />
      <Edits />
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
